import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { AlertCircle, Bot, CheckCircle2, Send, Trash2, User, Wrench, XCircle } from "lucide-react";

type ToolRunSummary = {
  toolName: string;
  label: string;
  ok: boolean;
  summary: string;
  error?: string;
  durationMs: number;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  runs?: ToolRunSummary[];
};

type Props = {
  agentSlug: string;
  beastName: string;
  suggestedPrompts: string[];
  isInstalled: boolean;
  hasConnection: boolean;
  platformName: string;
};

export function BeastChatPanel({
  agentSlug,
  beastName,
  suggestedPrompts,
  isInstalled,
  hasConnection,
  platformName,
}: Props) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);

  const historyQuery = trpc.activity.chatHistory.useQuery(
    { agentSlug, limit: 50 },
    { enabled: isInstalled }
  );

  useEffect(() => {
    if (historyQuery.data && messages.length === 0) {
      setMessages(
        historyQuery.data.map((m) => ({
          id: String(m.id),
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    }
  }, [historyQuery.data]);

  const chatMutation = trpc.activity.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: "assistant",
          content: data.reply,
          runs: data.runs,
        },
      ]);
      setIsSending(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setIsSending(false);
    },
  });

  const clearMutation = trpc.activity.clearChat.useMutation({
    onSuccess: () => {
      setMessages([]);
      historyQuery.refetch();
    },
  });

  const send = (content: string) => {
    if (!content.trim() || isSending) return;
    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()), role: "user", content: content.trim() },
    ]);
    setInput("");
    setIsSending(true);
    chatMutation.mutate({ agentSlug, message: content.trim() });
  };

  if (!isInstalled) {
    return (
      <div className="pop-card bg-card rounded-xl p-6 text-center">
        <AlertCircle className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-foreground font-semibold mb-1">Install {beastName} to chat</p>
        <p className="text-xs text-muted-foreground">
          Installation unlocks the live chat thread and tool access.
        </p>
      </div>
    );
  }

  if (!hasConnection) {
    return (
      <div className="pop-card bg-card rounded-xl p-6 text-center">
        <AlertCircle className="w-6 h-6 text-[#E8541A] mx-auto mb-3" />
        <p className="text-sm text-foreground font-semibold mb-1">Connect {platformName} first</p>
        <p className="text-xs text-muted-foreground">
          Head to <a href="/settings" className="font-semibold text-foreground underline">Settings</a> to save your {platformName} token. The beast can't call tools without it.
        </p>
      </div>
    );
  }

  return (
    <div className="pop-card bg-card rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b-2 border-border">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-foreground" />
          <h3 className="font-display font-bold text-sm text-foreground">{beastName} Chat</h3>
          <span className="text-[10px] font-bold bg-[#2D9E5A] text-white px-1.5 py-0.5 rounded-full">LIVE</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => clearMutation.mutate({ agentSlug })}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      <div className="p-5 h-[480px] overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Bot className="w-10 h-10 text-foreground mb-3" />
            <p className="text-sm font-semibold text-foreground mb-2">Chat with {beastName}</p>
            <p className="text-xs text-muted-foreground mb-5 max-w-md">
              Ask in plain English — the beast picks tools and runs them against your {platformName} account.
            </p>
            {suggestedPrompts.length > 0 && (
              <div className="grid grid-cols-1 gap-2 w-full max-w-md">
                {suggestedPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    disabled={isSending}
                    className="pop-card bg-secondary hover:bg-foreground/5 rounded-lg p-3 text-left text-xs text-foreground transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                  m.role === "user" ? "bg-foreground" : "bg-secondary border-2 border-border"
                }`}
              >
                {m.role === "user" ? (
                  <User className="w-4 h-4 text-background" />
                ) : (
                  <Bot className="w-4 h-4 text-foreground" />
                )}
              </div>
              <div className={`max-w-[80%] flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-foreground text-background rounded-tr-sm"
                      : "bg-secondary border-2 border-border rounded-tl-sm"
                  }`}
                >
                  {m.role === "assistant" ? <Streamdown>{m.content}</Streamdown> : <p>{m.content}</p>}
                </div>
                {m.runs && m.runs.length > 0 && (
                  <details className="w-full bg-muted/30 border border-border rounded-lg text-xs">
                    <summary className="px-3 py-1.5 cursor-pointer font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Wrench className="w-3 h-3" />
                      {m.runs.length} tool call{m.runs.length === 1 ? "" : "s"}
                    </summary>
                    <div className="px-3 py-2 space-y-1.5">
                      {m.runs.map((r, i) => (
                        <div key={i} className="flex items-start gap-2">
                          {r.ok ? (
                            <CheckCircle2 className="w-3 h-3 mt-0.5 text-[#2D9E5A] shrink-0" />
                          ) : (
                            <XCircle className="w-3 h-3 mt-0.5 text-destructive shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-[11px] text-foreground">{r.toolName}</p>
                            <p className="text-muted-foreground">{r.summary}</p>
                            {r.error && <p className="text-destructive">{r.error}</p>}
                          </div>
                          <span className="text-muted-foreground text-[10px] shrink-0">{r.durationMs}ms</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          ))
        )}
        {isSending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-secondary border-2 border-border">
              <Bot className="w-4 h-4 text-foreground" />
            </div>
            <div className="bg-secondary border-2 border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 p-4 border-t-2 border-border">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder={`Ask ${beastName} anything…`}
          rows={1}
          className="flex-1 px-4 py-2.5 bg-secondary border-2 border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
          style={{ minHeight: 44, maxHeight: 120 }}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || isSending}
          className="pop-btn bg-foreground text-background w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
