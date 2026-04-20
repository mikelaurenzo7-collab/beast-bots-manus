import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { BEASTS, getBeastBySlug, CATEGORIES } from "../shared/agents";

// ─── Test context helpers ─────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides: Partial<AuthenticatedUser> = {}): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@beastbots.ai",
    name: "Test Beast",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return { ctx };
}

// ─── Agents data tests ────────────────────────────────────────────────────────

describe("BEASTS data", () => {
  it("has exactly 80 agents", () => {
    expect(BEASTS.length).toBe(80);
  });

  it("has at least 14 categories", () => {
    const uniqueCategories = new Set(BEASTS.map((b) => b.category));
    expect(uniqueCategories.size).toBeGreaterThanOrEqual(14);
  });

  it("every agent has required fields", () => {
    for (const beast of BEASTS) {
      expect(beast.slug).toBeTruthy();
      expect(beast.name).toBeTruthy();
      expect(beast.tagline).toBeTruthy();
      expect(beast.description).toBeTruthy();
      expect(beast.category).toBeTruthy();
      expect(beast.platform).toBeTruthy();
      expect(beast.accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(beast.capabilities.length).toBeGreaterThan(0);
      expect(beast.permissions.length).toBeGreaterThan(0);
      expect(beast.rating).toBeGreaterThanOrEqual(1);
      expect(beast.rating).toBeLessThanOrEqual(5);
      expect(beast.installs).toBeGreaterThan(0);
    }
  });

  it("all slugs are unique", () => {
    const slugs = BEASTS.map((b) => b.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it("getBeastBySlug returns correct beast", () => {
    const beast = getBeastBySlug("gmail-beast");
    expect(beast).toBeDefined();
    expect(beast?.name).toContain("Gmail");
  });

  it("getBeastBySlug returns undefined for unknown slug", () => {
    const beast = getBeastBySlug("nonexistent-beast-12345");
    expect(beast).toBeUndefined();
  });

  it("CATEGORIES includes All plus category names", () => {
    expect(CATEGORIES[0]).toBe("All");
    expect(CATEGORIES.length).toBeGreaterThan(14);
  });
});

// ─── Agents router tests ──────────────────────────────────────────────────────

describe("agents router", () => {
  it("list returns all 80 agents by default", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.agents.list({ limit: 80, offset: 0 });
    expect(result.total).toBe(80);
    expect(result.items.length).toBe(80);
  });

  it("list filters by category", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.agents.list({ category: "Communication", limit: 80, offset: 0 });
    expect(result.items.every((b) => b.category === "Communication")).toBe(true);
  });

  it("list filters by search query", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.agents.list({ search: "gmail", limit: 80, offset: 0 });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.some((b) => b.slug === "gmail-beast")).toBe(true);
  });

  it("get returns a specific agent", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const beast = await caller.agents.get({ slug: "github-beast" });
    expect(beast).toBeDefined();
    expect(beast?.slug).toBe("github-beast");
  });

  it("get throws NOT_FOUND for unknown slug", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.agents.get({ slug: "fake-beast-xyz" })).rejects.toThrow();
  });

  it("featured returns agents marked as featured or hot", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const featured = await caller.agents.featured();
    expect(featured.length).toBeGreaterThan(0);
  });

  it("hot returns agents marked as hot", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const hot = await caller.agents.hot();
    expect(hot.length).toBeGreaterThan(0);
  });

  it("stats returns correct total count", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.agents.stats();
    expect(stats.total).toBe(BEASTS.length);
    expect(stats.categories).toBeGreaterThanOrEqual(14);
    expect(stats.avgRating).toBeGreaterThan(0);
  });
});

// ─── Auth router tests ────────────────────────────────────────────────────────

describe("auth router", () => {
  it("me returns null for unauthenticated user", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });

  it("me returns user for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeDefined();
    expect(user?.openId).toBe("test-user-001");
  });

  it("logout clears session cookie", async () => {
    const clearedCookies: string[] = [];
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "test-user",
        email: "test@test.com",
        name: "Test",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        clearCookie: (name: string) => clearedCookies.push(name),
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(clearedCookies).toContain(COOKIE_NAME);
  });
});

// ─── Mascot engine tests ──────────────────────────────────────────────────────

describe("agent customizations", () => {
  it("all agents have customizations array", () => {
    for (const beast of BEASTS) {
      expect(Array.isArray(beast.customizations)).toBe(true);
    }
  });

  it("all agents have actions array", () => {
    for (const beast of BEASTS) {
      expect(Array.isArray(beast.actions)).toBe(true);
      expect(beast.actions.length).toBeGreaterThan(0);
    }
  });

  it("toggle customizations have boolean defaults", () => {
    for (const beast of BEASTS) {
      for (const field of beast.customizations) {
        if (field.type === "toggle") {
          expect(typeof field.default).toBe("boolean");
        }
      }
    }
  });

  it("select customizations have options array", () => {
    for (const beast of BEASTS) {
      for (const field of beast.customizations) {
        if (field.type === "select") {
          expect(Array.isArray(field.options)).toBe(true);
          expect((field.options?.length ?? 0)).toBeGreaterThan(0);
        }
      }
    }
  });
});
