import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import NavBar from "../components/NavBar";
import BeastCard from "../components/BeastCard";
import { Streamdown } from "streamdown";
import { Bot, Send, Sparkles, Trash2, User } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  recommendations?: string[];
};

const STARTER_PROMPTS = [
  "What agents should I use for email automation?",
  "Help me set up a GitHub workflow with notifications",
  "I want to automate my sales pipeline in Salesforce",
  "What's the best agent for social media posting?",
];

export default function Chat() {
  const { isAuthenticated, loading } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatQuery = trpc.chat.history.useQuery(undefined, { enabled: isAuthenticated });
  const agentsQuery = trpc.agents.list.useQuery({ limit: 80, offset: 0 });
  const sendMutation = trpc.chat.send.useMutation({
    onSuccess: (data) => {
      // Extract agent slug recommendations from content
      const allBeasts = agentsQuery.data?.items ?? [];
      const mentioned = allBeasts
        .filter((b) => data.content.toLowerCase().includes(b.name.toLowerCase()))
        .slice(0, 4)
        .map((b) => b.slug);
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: "assistant",
          content: data.content,
          recommendations: mentioned.length > 0 ? mentioned : undefined,
        },
      ]);
      setIsStreaming(false);
    },
    onError: () => setIsStreaming(false),
  });

  const clearMutation = trpc.chat.clear.useMutation({
    onSuccess: () => {
      setMessages([]);
      chatQuery.refetch();
    },
  });

  // Load history on mount
  useEffect(() => {
    if (chatQuery.data && messages.length === 0) {
      const hist = chatQuery.data.map((m: any) => ({
        id: String(m.id),
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      setMessages(hist);
    }
  }, [chatQuery.data]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    const userMsg: Message = {
      id: String(Date.now()),
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    sendMutation.mutate({ message: input.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <div className="container py-12">
          <div className="shimmer h-48 rounded-xl border-2 border-border" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <div className="container py-20 text-center max-w-md mx-auto">
          <div className="text-5xl mb-4">🤖</div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Sign in to chat with BeastBot AI</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Get personalized agent recommendations and workflow suggestions.
          </p>
          <a href={getLoginUrl()}>
            <button className="pop-btn bg-foreground text-background px-6 py-3 rounded-xl font-bold">
              Sign In Free
            </button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar />

      <div className="flex-1 container py-6 max-w-4xl mx-auto flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center shadow-pop-sm">
              <Bot className="w-5 h-5 text-background" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-foreground">BeastBot AI</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Your AI agent concierge
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => clearMutation.mutate()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear chat
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4 min-h-0">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-foreground flex items-center justify-center mb-4 shadow-pop-md">
                <Bot className="w-8 h-8 text-background" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground mb-2">
                Hi! I'm BeastBot AI 🤖
              </h2>
              <p className="text-muted-foreground text-sm max-w-md mb-6">
                I can help you find the perfect agents for your workflow, explain capabilities,
                and suggest automation strategies.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setInput(prompt);
                      setTimeout(() => handleSend(), 50);
                    }}
                    className="pop-card bg-card rounded-xl p-3 text-left text-sm text-foreground hover:bg-secondary transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                    msg.role === "user" ? "bg-foreground" : "bg-secondary border-2 border-border"
                  }`}>
                    {msg.role === "user" ? (
                      <User className="w-4 h-4 text-background" />
                    ) : (
                      <Bot className="w-4 h-4 text-foreground" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-2`}>
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-foreground text-background rounded-tr-sm"
                        : "bg-card border-2 border-border rounded-tl-sm"
                    }`}>
                      {msg.role === "assistant" ? (
                        <Streamdown>{msg.content}</Streamdown>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>

                    {/* Recommendations */}
                    {msg.recommendations && msg.recommendations.length > 0 && (
                      <div className="w-full">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Recommended agents:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {msg.recommendations.map((slug) => {
                            const beast = agentsQuery.data?.items.find((b: any) => b.slug === slug);
                            if (!beast) return null;
                            return <BeastCard key={slug} beast={beast} compact />;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isStreaming && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-secondary border-2 border-border">
                    <Bot className="w-4 h-4 text-foreground" />
                  </div>
                  <div className="bg-card border-2 border-border rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 flex gap-2 pt-3 border-t-2 border-border">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask BeastBot AI anything about agents..."
            rows={1}
            className="flex-1 px-4 py-3 bg-card border-2 border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
            style={{ minHeight: 48, maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="pop-btn bg-foreground text-background w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
