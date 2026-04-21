import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { api } from "../lib/api";
import type {
  BotCatalogResponse,
  ChatHistoryResponse,
  ChatMessage,
  RunResponse,
} from "../lib/types";

export function BotChatPage({ slug }: { slug: string }) {
  const catalog = useQuery({
    queryKey: ["bot-catalog"],
    queryFn: () => api.get<BotCatalogResponse>("/v1/boss/catalog"),
  });
  const bot = useMemo(
    () => catalog.data?.bots.find((b) => b.slug === slug),
    [catalog.data, slug]
  );

  const qc = useQueryClient();
  const history = useQuery({
    queryKey: ["chat", slug],
    queryFn: () =>
      api.get<ChatHistoryResponse>(`/v1/boss/chat?botSlug=${encodeURIComponent(slug)}`),
  });

  const [draft, setDraft] = useState("");
  const [toolCallsByRun, setToolCallsByRun] = useState<
    Record<number, RunResponse["toolCalls"]>
  >({});
  const endRef = useRef<HTMLDivElement>(null);

  const run = useMutation({
    mutationFn: (message: string) =>
      api.post<RunResponse>("/v1/boss/run", {
        botSlug: slug,
        message,
        useHistory: true,
      }),
    onSuccess: (resp) => {
      setToolCallsByRun((prev) => ({ ...prev, [resp.runId]: resp.toolCalls }));
      qc.invalidateQueries({ queryKey: ["chat", slug] });
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
  });

  const messages = useMemo(() => {
    const rows = history.data?.messages ?? [];
    return [...rows].sort((a, b) => a.id - b.id);
  }, [history.data]);

  if (!bot) {
    return <div className="page">Loading bot…</div>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        height: "100%",
      }}
    >
      <header
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16 }}>{bot.name}</div>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>{bot.tagline}</div>
      </header>

      <div style={{ padding: "16px 24px", overflowY: "auto" }}>
        {messages.length === 0 && !run.isPending && (
          <div className="empty">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              Hi, I'm the {bot.name}.
            </div>
            <div>{bot.revenueProposition}</div>
          </div>
        )}

        <div style={{ display: "grid", gap: 12, maxWidth: 820, margin: "0 auto" }}>
          {messages.map((m) => (
            <Message
              key={m.id}
              message={m}
              toolCalls={m.runId ? toolCallsByRun[m.runId] ?? [] : []}
            />
          ))}
          {run.isPending && (
            <div className="card" style={{ alignSelf: "flex-start", maxWidth: 240 }}>
              <span className="mono" style={{ color: "var(--muted)" }}>
                thinking…
              </span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text || run.isPending) return;
          setDraft("");
          run.mutate(text);
        }}
        style={{
          padding: "12px 24px 20px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: 8,
          maxWidth: 1180,
        }}
      >
        <input
          autoFocus
          placeholder={`Ask ${bot.name}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{
            flex: 1,
            padding: "10px 14px",
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--surface)",
            color: "var(--text)",
          }}
        />
        <button className="btn" disabled={!draft.trim() || run.isPending}>
          <Send size={14} />
          Send
        </button>
      </form>
    </div>
  );
}

function Message(props: {
  message: ChatMessage;
  toolCalls: RunResponse["toolCalls"];
}) {
  const { message, toolCalls } = props;
  const isUser = message.role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div style={{ maxWidth: 620, display: "grid", gap: 6 }}>
        <div
          className="card"
          style={{
            background: isUser ? "var(--accent)" : "var(--surface)",
            color: isUser ? "var(--accent-contrast)" : "var(--text)",
          }}
        >
          <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
        </div>
        {toolCalls && toolCalls.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {toolCalls.map((t, i) => (
              <span
                key={i}
                className="chip"
                style={{ color: t.ok ? "var(--good)" : "var(--bad)" }}
                title={t.summary}
              >
                <span className={`dot ${t.ok ? "good" : "bad"}`} />
                {t.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
