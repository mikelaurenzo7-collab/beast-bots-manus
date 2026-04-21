import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BEASTS } from "../shared/agents";
import { __resetCryptoKeyCache, decryptToken, encryptToken } from "./_core/crypto";
import "./runtime"; // side-effect registers all provider tools
import { getTool, getToolsForBeast, listToolNames, toolsToLlmSchema } from "./runtime/registry";

// Mock the DB module so executeBeast can be tested without a live MySQL.
vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return {
    ...original,
    getDecryptedToken: vi.fn(),
  };
});

// ─── Crypto round-trip ────────────────────────────────────────────────────────

describe("crypto", () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "a".repeat(32) + "b".repeat(32);
    __resetCryptoKeyCache();
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
    __resetCryptoKeyCache();
  });

  it("encrypts and decrypts a round-trip", () => {
    const secret = "ghp_exampleToken_abcdef1234567890";
    const { ciphertext, iv } = encryptToken(secret);

    expect(ciphertext).not.toContain(secret);
    expect(ciphertext).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(iv).toMatch(/^[A-Za-z0-9+/=]+$/);

    const decrypted = decryptToken(ciphertext, iv);
    expect(decrypted).toBe(secret);
  });

  it("produces a fresh IV per encryption (non-deterministic output)", () => {
    const first = encryptToken("same-secret");
    const second = encryptToken("same-secret");
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("passes through legacy plaintext when iv is null", () => {
    expect(decryptToken("raw-plaintext-value", null)).toBe("raw-plaintext-value");
    expect(decryptToken("raw-plaintext-value", undefined)).toBe("raw-plaintext-value");
  });

  it("rejects ciphertext missing the auth tag separator", () => {
    expect(() => decryptToken("no-colon-here", "AAAAAAAAAAAAAAAA")).toThrow(/Malformed/);
  });

  it("fails to decrypt if the auth tag has been tampered with", () => {
    const { ciphertext, iv } = encryptToken("hello");
    const [, ct] = ciphertext.split(":");
    const tampered = `${Buffer.from("tampered").toString("base64")}:${ct}`;
    expect(() => decryptToken(tampered, iv)).toThrow();
  });
});

// ─── Registry + drift guard ───────────────────────────────────────────────────

describe("tool registry", () => {
  it("registers the 3 flagship providers", () => {
    const names = listToolNames();
    expect(names).toContain("github.list_repos");
    expect(names).toContain("github.list_issues");
    expect(names).toContain("github.create_issue");
    expect(names).toContain("slack.list_channels");
    expect(names).toContain("slack.send_message");
    expect(names).toContain("notion.list_databases");
    expect(names).toContain("notion.append_block");
  });

  it("registers the extended provider set (google, linear, figma, linkedin, hubspot, discord)", () => {
    const names = new Set(listToolNames());
    for (const expected of [
      "google.gmail_list",
      "google.gmail_send",
      "google.calendar_list",
      "google.calendar_create_event",
      "linear.list_issues",
      "linear.create_issue",
      "figma.list_projects",
      "figma.get_file",
      "linkedin.profile",
      "linkedin.share_post",
      "hubspot.list_contacts",
      "hubspot.create_contact",
      "discord.list_guilds",
      "discord.get_me",
    ]) {
      expect(names.has(expected), `missing tool ${expected}`).toBe(true);
    }
  });

  it("getToolsForBeast filters by connected providers", () => {
    const tools = getToolsForBeast(
      ["github.list_repos", "slack.send_message"],
      new Set(["github"])
    );
    expect(tools.map((t) => t.name)).toEqual(["github.list_repos"]);
  });

  it("returns empty when nothing is connected", () => {
    expect(getToolsForBeast(["github.list_repos"], new Set())).toEqual([]);
  });

  it("toolsToLlmSchema produces OpenAI-style function definitions", () => {
    const schemas = toolsToLlmSchema([getTool("github.list_repos")!]);
    expect(schemas).toHaveLength(1);
    expect(schemas[0].type).toBe("function");
    expect(schemas[0].function.name).toBe("github.list_repos");
    expect(schemas[0].function.parameters).toMatchObject({ type: "object" });
  });

  it("drift guard — every wired beast's tools exist in the registry", () => {
    const registry = new Set(listToolNames());
    for (const beast of BEASTS) {
      if (!beast.tools) continue;
      for (const toolName of beast.tools) {
        expect(
          registry.has(toolName),
          `${beast.slug} references unknown tool "${toolName}"`
        ).toBe(true);
      }
    }
  });
});

// ─── Tool handlers (mocked fetch) ─────────────────────────────────────────────

type FetchCall = { url: string; init: RequestInit | undefined };

function mockFetch(
  responder: (url: string, init: RequestInit | undefined) => {
    status?: number;
    body: unknown;
  }
): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const { status = 200, body } = responder(url, init);
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    })
  );
  return calls;
}

describe("github tools", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("list_repos sends auth header and summarizes results", async () => {
    const calls = mockFetch((url) => {
      expect(url).toContain("api.github.com/user/repos");
      expect(url).toContain("sort=updated");
      return {
        body: [
          { full_name: "alice/apollo", description: null, stargazers_count: 3, private: false },
          { full_name: "alice/beacon", description: "hi", stargazers_count: 1, private: true },
        ],
      };
    });
    const tool = getTool("github.list_repos")!;
    const res = await tool.run({ userId: 1, token: "ghp_test", input: { limit: 10 } });
    expect(res.ok).toBe(true);
    expect(res.summary).toContain("alice/apollo");
    expect(res.summary).toContain("alice/beacon");
    const headers = (calls[0].init?.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe("Bearer ghp_test");
    expect(headers.accept).toBe("application/vnd.github+json");
  });

  it("create_issue posts JSON body and returns issue url", async () => {
    const calls = mockFetch((url, init) => {
      expect(url).toContain("/repos/acme/widgets/issues");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(init?.body as string);
      expect(body).toEqual({ title: "Bug!", body: "Details." });
      return { body: { number: 42, html_url: "https://gh/acme/widgets/issues/42", title: "Bug!" } };
    });
    const tool = getTool("github.create_issue")!;
    const res = await tool.run({
      userId: 1,
      token: "ghp_x",
      input: { owner: "acme", repo: "widgets", title: "Bug!", body: "Details." },
    });
    expect(res.ok).toBe(true);
    expect(res.summary).toContain("#42");
    expect(res.data).toMatchObject({ number: 42, url: "https://gh/acme/widgets/issues/42" });
    expect(calls).toHaveLength(1);
  });

  it("surfaces API errors as ok=false", async () => {
    mockFetch(() => ({ status: 401, body: { message: "Bad credentials" } }));
    const tool = getTool("github.list_repos")!;
    const res = await tool.run({ userId: 1, token: "bad", input: {} });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("401");
  });
});

describe("slack tools", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("send_message form-encodes and summarizes", async () => {
    const calls = mockFetch((url, init) => {
      expect(url).toBe("https://slack.com/api/chat.postMessage");
      expect(init?.method).toBe("POST");
      const bodyStr = init?.body instanceof URLSearchParams
        ? init.body.toString()
        : String(init?.body);
      expect(bodyStr).toContain("channel=%23general");
      expect(bodyStr).toContain("text=hello");
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");
      expect(headers.authorization).toBe("Bearer xoxb-test");
      return { body: { ok: true, ts: "1.0", channel: "C1" } };
    });
    const tool = getTool("slack.send_message")!;
    const res = await tool.run({
      userId: 1,
      token: "xoxb-test",
      input: { channel: "#general", text: "hello" },
    });
    expect(res.ok).toBe(true);
    expect(res.summary).toContain("#general");
    expect(calls).toHaveLength(1);
  });

  it("surfaces slack error field", async () => {
    mockFetch(() => ({ body: { ok: false, error: "not_in_channel" } }));
    const tool = getTool("slack.send_message")!;
    const res = await tool.run({
      userId: 1,
      token: "xoxb",
      input: { channel: "C1", text: "hi" },
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("not_in_channel");
  });
});

describe("notion tools", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("append_block sends notion-version header and PATCHes blocks", async () => {
    const calls = mockFetch((url, init) => {
      expect(url).toBe("https://api.notion.com/v1/blocks/page123/children");
      expect(init?.method).toBe("PATCH");
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers["notion-version"]).toBe("2022-06-28");
      expect(headers.authorization).toBe("Bearer secret_abc");
      const body = JSON.parse(init?.body as string);
      expect(body.children[0].paragraph.rich_text[0].text.content).toBe("note");
      return { body: { results: [{ id: "block-xyz" }] } };
    });
    const tool = getTool("notion.append_block")!;
    const res = await tool.run({
      userId: 1,
      token: "secret_abc",
      input: { pageId: "page123", text: "note" },
    });
    expect(res.ok).toBe(true);
    expect(res.summary).toContain("page123");
    expect(calls).toHaveLength(1);
  });
});

describe("google tools", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("gmail_list queries with q and fetches metadata headers", async () => {
    const calls = mockFetch((url) => {
      if (url.includes("/messages?")) {
        expect(url).toContain("q=is%3Aunread");
        expect(url).toContain("maxResults=2");
        return { body: { messages: [{ id: "m1", threadId: "t1" }, { id: "m2", threadId: "t2" }] } };
      }
      expect(url).toContain("format=metadata");
      const id = url.match(/messages\/(m\d)/)?.[1] ?? "?";
      return {
        body: {
          id,
          snippet: `snippet-${id}`,
          payload: {
            headers: [
              { name: "From", value: `user-${id}@example.com` },
              { name: "Subject", value: `Subject ${id}` },
              { name: "Date", value: "Mon, 21 Apr 2026 00:00:00 +0000" },
            ],
          },
        },
      };
    });
    const tool = getTool("google.gmail_list")!;
    const res = await tool.run({ userId: 1, token: "ya29.test", input: { limit: 2 } });
    expect(res.ok).toBe(true);
    expect(res.summary).toContain("Subject m1");
    const headers = (calls[0].init?.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe("Bearer ya29.test");
  });

  it("gmail_send posts a base64url RFC822 payload", async () => {
    const calls = mockFetch((url, init) => {
      expect(url).toContain("/messages/send");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(init?.body as string) as { raw: string };
      const decoded = Buffer.from(body.raw, "base64url").toString("utf8");
      expect(decoded).toContain("To: friend@example.com");
      expect(decoded).toContain("Subject: Hi");
      expect(decoded).toContain("hello world");
      return { body: { id: "msg-1", threadId: "thr-1" } };
    });
    const tool = getTool("google.gmail_send")!;
    const res = await tool.run({
      userId: 1,
      token: "ya29.test",
      input: { to: "friend@example.com", subject: "Hi", body: "hello world" },
    });
    expect(res.ok).toBe(true);
    expect(res.summary).toContain("friend@example.com");
    expect(calls).toHaveLength(1);
  });

  it("calendar_list hits v3 events with timeMin/timeMax and orderBy", async () => {
    const calls = mockFetch((url) => {
      expect(url).toContain("/calendars/primary/events");
      expect(url).toContain("orderBy=startTime");
      expect(url).toContain("singleEvents=true");
      return {
        body: {
          items: [
            { id: "e1", summary: "Standup", start: { dateTime: "2026-04-22T09:00:00Z" }, end: { dateTime: "2026-04-22T09:15:00Z" } },
          ],
        },
      };
    });
    const tool = getTool("google.calendar_list")!;
    const res = await tool.run({ userId: 1, token: "ya29", input: {} });
    expect(res.ok).toBe(true);
    expect(res.summary).toContain("Standup");
    expect(calls).toHaveLength(1);
  });
});

describe("linear tools", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("list_issues posts a GraphQL query and maps node fields", async () => {
    const calls = mockFetch((url, init) => {
      expect(url).toBe("https://api.linear.app/graphql");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(init?.body as string) as { query: string; variables: Record<string, unknown> };
      expect(body.query).toContain("issues(");
      expect(body.variables.first).toBe(5);
      expect(body.variables.teamKey).toBe("ENG");
      return {
        body: {
          data: {
            issues: {
              nodes: [
                {
                  id: "i1",
                  identifier: "ENG-1",
                  title: "Fix bug",
                  state: { name: "In Progress", type: "started" },
                  assignee: { name: "Alice" },
                  url: "https://linear.app/x/ENG-1",
                },
              ],
            },
          },
        },
      };
    });
    const tool = getTool("linear.list_issues")!;
    const res = await tool.run({ userId: 1, token: "lin_api_test", input: { teamKey: "ENG", limit: 5 } });
    expect(res.ok).toBe(true);
    expect(res.summary).toContain("ENG-1");
    expect(calls).toHaveLength(1);
  });

  it("create_issue first looks up the team and then issueCreates", async () => {
    let phase = 0;
    mockFetch((_url, init) => {
      const body = JSON.parse(init?.body as string) as { query: string };
      phase += 1;
      if (phase === 1) {
        expect(body.query).toContain("teams(");
        return { body: { data: { teams: { nodes: [{ id: "team_123" }] } } } };
      }
      expect(body.query).toContain("issueCreate");
      return {
        body: {
          data: {
            issueCreate: {
              success: true,
              issue: { id: "i1", identifier: "ENG-42", url: "https://linear.app/x/ENG-42", title: "New" },
            },
          },
        },
      };
    });
    const tool = getTool("linear.create_issue")!;
    const res = await tool.run({
      userId: 1,
      token: "lin_api_test",
      input: { teamKey: "ENG", title: "New" },
    });
    expect(res.ok).toBe(true);
    expect(res.summary).toContain("ENG-42");
    expect(phase).toBe(2);
  });

  it("surfaces GraphQL errors", async () => {
    mockFetch(() => ({ body: { errors: [{ message: "not authorized" }] } }));
    const tool = getTool("linear.list_issues")!;
    const res = await tool.run({ userId: 1, token: "bad", input: {} });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("not authorized");
  });
});

describe("figma tools", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("get_file summarizes pages from the document tree", async () => {
    mockFetch((url) => {
      expect(url).toContain("/files/abc123");
      expect(url).toContain("depth=1");
      return {
        body: {
          name: "Design System",
          lastModified: "2026-04-01T00:00:00Z",
          document: { children: [{ name: "Cover", type: "CANVAS" }, { name: "Tokens", type: "CANVAS" }] },
        },
      };
    });
    const tool = getTool("figma.get_file")!;
    const res = await tool.run({ userId: 1, token: "figd_test", input: { fileKey: "abc123" } });
    expect(res.ok).toBe(true);
    expect(res.summary).toContain("Design System");
    expect(res.summary).toContain("2 pages");
  });
});

describe("linkedin tools", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("share_post derives urn from userinfo then posts ugcPosts", async () => {
    const calls: string[] = [];
    mockFetch((url, init) => {
      calls.push(url);
      if (url.endsWith("/v2/userinfo")) {
        return { body: { sub: "user-xyz", name: "Alice" } };
      }
      expect(url).toContain("/v2/ugcPosts");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(init?.body as string) as { author: string; visibility: Record<string, string> };
      expect(body.author).toBe("urn:li:person:user-xyz");
      expect(body.visibility["com.linkedin.ugc.MemberNetworkVisibility"]).toBe("PUBLIC");
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers["x-restli-protocol-version"]).toBe("2.0.0");
      return { body: { id: "urn:li:share:1" } };
    });
    const tool = getTool("linkedin.share_post")!;
    const res = await tool.run({ userId: 1, token: "li_test", input: { text: "hello world" } });
    expect(res.ok).toBe(true);
    expect(res.summary).toContain("urn:li:share:1");
    expect(calls).toHaveLength(2);
  });
});

describe("hubspot tools", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("list_contacts pulls email/firstname/lastname/company properties", async () => {
    mockFetch((url) => {
      expect(url).toContain("/crm/v3/objects/contacts");
      expect(url).toContain("properties=email,firstname,lastname,company");
      return {
        body: {
          results: [
            { id: "c1", properties: { email: "a@x.com", firstname: "Ada", lastname: "Lovelace", company: "Analytics" } },
          ],
        },
      };
    });
    const tool = getTool("hubspot.list_contacts")!;
    const res = await tool.run({ userId: 1, token: "pat-test", input: {} });
    expect(res.ok).toBe(true);
    expect(res.summary).toContain("a@x.com");
  });

  it("create_contact posts properties payload", async () => {
    mockFetch((url, init) => {
      expect(url).toContain("/crm/v3/objects/contacts");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(init?.body as string) as { properties: Record<string, string> };
      expect(body.properties.email).toBe("new@x.com");
      expect(body.properties.firstname).toBe("New");
      return { body: { id: "99", properties: body.properties } };
    });
    const tool = getTool("hubspot.create_contact")!;
    const res = await tool.run({
      userId: 1,
      token: "pat-test",
      input: { email: "new@x.com", firstname: "New" },
    });
    expect(res.ok).toBe(true);
    expect(res.summary).toContain("99");
    expect(res.summary).toContain("new@x.com");
  });
});

describe("discord tools", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("list_guilds uses bearer auth and summarizes server names", async () => {
    mockFetch((url, init) => {
      expect(url).toContain("/users/@me/guilds");
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers.authorization).toBe("Bearer disc_test");
      return {
        body: [
          { id: "g1", name: "Alpha", owner: true },
          { id: "g2", name: "Beta", owner: false },
        ],
      };
    });
    const tool = getTool("discord.list_guilds")!;
    const res = await tool.run({ userId: 1, token: "disc_test", input: {} });
    expect(res.ok).toBe(true);
    expect(res.summary).toContain("Alpha");
    expect(res.summary).toContain("Beta");
  });
});

// ─── Provider registry + credential resolution ────────────────────────────────

describe("provider registry", () => {
  const ORIG_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIG_ENV };
  });

  it("resolves credentials from standard env vars and disables when missing", async () => {
    const { getProviderConfig, getProviderCredentials, listEnabledProviderIds } = await import(
      "./_core/providers"
    );
    // Clear anything that might leak from the outer env
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    const github = getProviderConfig("github")!;
    expect(getProviderCredentials(github)).toBeNull();

    process.env.GITHUB_CLIENT_ID = "gh_id";
    process.env.GITHUB_CLIENT_SECRET = "gh_secret";
    expect(getProviderCredentials(github)).toEqual({ clientId: "gh_id", clientSecret: "gh_secret" });
    expect(listEnabledProviderIds()).toContain("github");
  });

  it("includes all wired providers in the registry", async () => {
    const { listProviders } = await import("./_core/providers");
    const ids = new Set(listProviders().map((p) => p.id));
    for (const expected of [
      "github",
      "google",
      "slack",
      "notion",
      "linear",
      "discord",
      "figma",
      "linkedin",
      "microsoft",
      "hubspot",
    ]) {
      expect(ids.has(expected), `missing provider ${expected}`).toBe(true);
    }
  });
});

// ─── executeBeast integration (mocked LLM + fetch) ────────────────────────────

describe("executeBeast", () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  const originalForgeKey = process.env.BUILT_IN_FORGE_API_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "k".repeat(64);
    process.env.BUILT_IN_FORGE_API_KEY = "test-forge-key";
    __resetCryptoKeyCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    process.env.ENCRYPTION_KEY = originalKey;
    process.env.BUILT_IN_FORGE_API_KEY = originalForgeKey;
    __resetCryptoKeyCache();
  });

  it("runs the tool-use loop: LLM requests a tool, tool fires, LLM sees result, final reply returned", async () => {
    const dbModule = await import("./db");
    vi.mocked(dbModule.getDecryptedToken).mockResolvedValue({
      token: "ghp_stubbed",
      connection: {} as never,
    });

    const fetchCalls: { url: string; init: RequestInit | undefined }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        fetchCalls.push({ url, init });

        if (url.includes("/chat/completions")) {
          const llmCallCount = fetchCalls.filter((c) => c.url.includes("/chat/completions")).length;
          if (llmCallCount === 1) {
            return new Response(
              JSON.stringify({
                id: "r1",
                created: 0,
                model: "gemini-2.5-flash",
                choices: [
                  {
                    index: 0,
                    message: {
                      role: "assistant",
                      content: "",
                      tool_calls: [
                        {
                          id: "call_1",
                          type: "function",
                          function: {
                            name: "github.list_repos",
                            arguments: JSON.stringify({ limit: 2 }),
                          },
                        },
                      ],
                    },
                    finish_reason: "tool_calls",
                  },
                ],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            );
          }
          // Second LLM call: assert it received the tool result, then finalize.
          const payload = JSON.parse(init?.body as string);
          const toolMsg = payload.messages.find((m: { role: string }) => m.role === "tool");
          expect(toolMsg, "second LLM call must include a tool-role message").toBeTruthy();
          expect(toolMsg.tool_call_id).toBe("call_1");
          const parsed = JSON.parse(toolMsg.content);
          expect(parsed.ok).toBe(true);
          expect(parsed.summary).toContain("alice/apollo");
          return new Response(
            JSON.stringify({
              id: "r2",
              created: 0,
              model: "gemini-2.5-flash",
              choices: [
                {
                  index: 0,
                  message: {
                    role: "assistant",
                    content: "You have 2 repos: alice/apollo, alice/beacon.",
                  },
                  finish_reason: "stop",
                },
              ],
              usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        if (url.includes("api.github.com/user/repos")) {
          return new Response(
            JSON.stringify([
              { full_name: "alice/apollo", description: null, stargazers_count: 1, private: false },
              { full_name: "alice/beacon", description: null, stargazers_count: 0, private: false },
            ]),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const { executeBeast } = await import("./runtime/execute");
    const beast = BEASTS.find((b) => b.slug === "github-beast")!;
    const result = await executeBeast({
      userId: 1,
      beast,
      history: [],
      message: "list my repos",
    });

    expect(result.reply).toContain("alice/apollo");
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].toolName).toBe("github.list_repos");
    expect(result.runs[0].result.ok).toBe(true);
    expect(result.tokensUsed).toBe(43); // 15 + 28

    const llmCalls = fetchCalls.filter((c) => c.url.includes("/chat/completions"));
    expect(llmCalls).toHaveLength(2);
    const ghCalls = fetchCalls.filter((c) => c.url.includes("api.github.com"));
    expect(ghCalls).toHaveLength(1);
  });

  it("returns connection hint when no providers are connected", async () => {
    const dbModule = await import("./db");
    vi.mocked(dbModule.getDecryptedToken).mockResolvedValue(null);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/chat/completions")) {
          // Assert the missing-provider hint system message was injected.
          const payload = JSON.parse(init?.body as string);
          const hint = payload.messages.find(
            (m: { role: string; content: string }) =>
              m.role === "system" && typeof m.content === "string" && m.content.includes("not connected")
          );
          expect(hint).toBeTruthy();
          return new Response(
            JSON.stringify({
              id: "r",
              created: 0,
              model: "gemini-2.5-flash",
              choices: [
                {
                  index: 0,
                  message: {
                    role: "assistant",
                    content: "Please connect GitHub in Settings first.",
                  },
                  finish_reason: "stop",
                },
              ],
              usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const { executeBeast } = await import("./runtime/execute");
    const beast = BEASTS.find((b) => b.slug === "github-beast")!;
    const result = await executeBeast({
      userId: 1,
      beast,
      history: [],
      message: "list my repos",
    });
    expect(result.reply).toContain("connect");
    expect(result.runs).toHaveLength(0);
  });

  it("throws when beast has no persona config", async () => {
    const { executeBeast } = await import("./runtime/execute");
    const demoBeast = BEASTS.find((b) => !b.systemPrompt)!;
    await expect(
      executeBeast({ userId: 1, beast: demoBeast, history: [], message: "hi" })
    ).rejects.toThrow(/persona config/);
  });
});
