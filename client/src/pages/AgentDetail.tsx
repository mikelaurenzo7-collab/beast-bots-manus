import { useState } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { getMascotDataUrl } from "../lib/mascot";
import NavBar from "../components/NavBar";
import { BeastChatPanel } from "../components/BeastChatPanel";
import { toast } from "sonner";
import {
  ArrowLeft, Brain, Check, FlaskConical, Lock, MessageCircle, Play, Settings, Shield, Star, X, Zap, AlertCircle
} from "lucide-react";

type Customizations = Record<string, unknown>;

export default function AgentDetail() {
  const [, params] = useRoute("/agent/:slug");
  const slug = params?.slug ?? "";
  const { isAuthenticated } = useAuth();
  const [customizations, setCustomizations] = useState<Customizations>({});
  const [activeTab, setActiveTab] = useState<"overview" | "chat" | "customize" | "activity" | "memory">("overview");

  const agentQuery = trpc.agents.get.useQuery({ slug }, { enabled: !!slug });
  const installQuery = trpc.installations.get.useQuery({ agentSlug: slug }, { enabled: isAuthenticated && !!slug });
  const connectionQuery = trpc.connections.get.useQuery(
    { provider: agentQuery.data?.oauthProvider ?? "" },
    { enabled: isAuthenticated && !!agentQuery.data?.oauthProvider }
  );
  const activityQuery = trpc.activity.byAgent.useQuery(
    { agentSlug: slug, limit: 10 },
    { enabled: isAuthenticated && !!slug && activeTab === "activity" }
  );

  const memoriesQuery = trpc.memories.list.useQuery(
    { agentSlug: slug },
    { enabled: isAuthenticated && !!slug && activeTab === "memory" }
  );
  const deleteMemoryMutation = trpc.memories.delete.useMutation({
    onSuccess: () => {
      toast.success("Memory cleared");
      memoriesQuery.refetch();
    },
  });

  const installMutation = trpc.installations.install.useMutation({
    onSuccess: () => {
      toast.success(`${beast?.name} installed!`);
      installQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const uninstallMutation = trpc.installations.uninstall.useMutation({
    onSuccess: () => {
      toast.success("Agent uninstalled");
      installQuery.refetch();
    },
  });

  const customizeMutation = trpc.installations.updateCustomizations.useMutation({
    onSuccess: () => toast.success("Settings saved"),
  });

  const runMutation = trpc.activity.run.useMutation({
    onSuccess: () => toast.success("Run started! Check activity for results."),
    onError: (e) => toast.error(e.message),
  });

  const beast = agentQuery.data;
  const installation = installQuery.data;
  const isInstalled = !!installation;
  const hasConnection = !!connectionQuery.data;
  const isLive = !!beast?.systemPrompt && !!beast?.tools && beast.tools.length > 0;

  if (agentQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <div className="container py-12">
          <div className="shimmer h-64 rounded-xl border-2 border-border" />
        </div>
      </div>
    );
  }

  if (!beast) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <div className="container py-20 text-center">
          <div className="text-5xl mb-4">🤖</div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Beast not found</h1>
          <Link href="/marketplace">
            <button className="pop-btn bg-foreground text-background px-4 py-2 rounded-lg text-sm font-semibold mt-4">
              Back to Marketplace
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const mascotUrl = getMascotDataUrl(beast.slug, 120, beast.accentColor);

  const handleInstall = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    installMutation.mutate({ agentSlug: slug, customizations });
  };

  const handleSaveCustomizations = () => {
    const merged = {
      ...Object.fromEntries(beast.customizations.map((f) => [f.key, f.default])),
      ...customizations,
    };
    customizeMutation.mutate({ agentSlug: slug, customizations: merged });
  };

  const handleRun = (action: string) => {
    if (!isInstalled) return;
    runMutation.mutate({ agentSlug: slug, action, inputSummary: `Manual run: ${action}` });
  };

  const getFieldValue = (key: string, defaultVal: unknown) => {
    return customizations[key] !== undefined ? customizations[key] : defaultVal;
  };

  const setFieldValue = (key: string, val: unknown) => {
    setCustomizations((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="container py-6 max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <Link href="/marketplace">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Marketplace
          </button>
        </Link>

        {/* Hero card */}
        <div className="pop-card bg-card rounded-2xl p-6 md:p-8 mb-6 relative overflow-hidden">
          {/* Accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: beast.accentColor }} />

          <div className="flex flex-col md:flex-row gap-6">
            {/* Mascot */}
            <div
              className="w-28 h-28 md:w-36 md:h-36 rounded-2xl border-2 border-border bg-secondary flex-shrink-0 overflow-hidden"
            >
              <img src={mascotUrl} alt={beast.name} width={144} height={144} className="object-contain" />
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-start gap-2 mb-2">
                <h1 className="font-display text-2xl md:text-3xl font-black text-foreground">{beast.name}</h1>
                {beast.hot && (
                  <span className="badge-hot text-white text-xs font-bold px-2 py-0.5 rounded-full">🔥 HOT</span>
                )}
                {beast.new && (
                  <span className="bg-[#2D9E5A] text-white text-xs font-bold px-2 py-0.5 rounded-full">NEW</span>
                )}
                {isInstalled && (
                  <span className="bg-[#1A6EE8] text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Installed
                  </span>
                )}
              </div>

              <p className="text-muted-foreground text-sm mb-1 font-medium">{beast.tagline}</p>
              <p className="text-foreground text-sm leading-relaxed mb-4 max-w-lg">{beast.description}</p>

              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-[#F5C842] text-[#F5C842]" />
                  <span className="font-semibold text-foreground">{beast.rating}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Zap className="w-4 h-4" />
                  <span>{beast.installs.toLocaleString()} installs</span>
                </div>
                <span className="px-2 py-0.5 rounded-full border-2 border-border text-muted-foreground text-xs font-medium">
                  {beast.category}
                </span>
                <span className="px-2 py-0.5 rounded-full border-2 border-border text-muted-foreground text-xs font-medium">
                  {beast.platform}
                </span>
              </div>
            </div>

            {/* Install button */}
            <div className="flex flex-col gap-2 md:items-end">
              {isInstalled ? (
                <>
                  <button
                    onClick={() => setActiveTab("customize")}
                    className="pop-btn bg-secondary text-foreground px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Configure
                  </button>
                  <button
                    onClick={() => uninstallMutation.mutate({ agentSlug: slug })}
                    disabled={uninstallMutation.isPending}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Uninstall
                  </button>
                </>
              ) : (
                <button
                  onClick={handleInstall}
                  disabled={installMutation.isPending}
                  className="pop-btn bg-foreground text-background px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2"
                >
                  {installMutation.isPending ? (
                    <span className="animate-spin">⟳</span>
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {isAuthenticated ? "Install Beast" : "Sign In to Install"}
                </button>
              )}

              {beast.requiresOAuth && (
                <div className={`flex items-center gap-1.5 text-xs ${hasConnection ? "text-[#2D9E5A]" : "text-muted-foreground"}`}>
                  {hasConnection ? <Check className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {hasConnection ? `${beast.platform} connected` : `Requires ${beast.platform} OAuth`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b-2 border-border">
          {(["overview", ...(isLive ? (["chat"] as const) : []), "customize", "activity", ...(isInstalled ? (["memory"] as const) : [])] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 -mb-0.5 transition-colors flex items-center gap-1.5 ${
                activeTab === tab
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "chat" && <MessageCircle className="w-3.5 h-3.5" />}
              {tab === "memory" && <Brain className="w-3.5 h-3.5" />}
              {tab}
              {tab === "chat" && (
                <span className="ml-1 text-[10px] font-bold bg-[#2D9E5A] text-white px-1.5 py-0.5 rounded-full">LIVE</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Capabilities */}
            <div className="pop-card bg-card rounded-xl p-5">
              <h2 className="font-display font-bold text-base text-foreground mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#F5C842]" />
                Capabilities
              </h2>
              <ul className="space-y-2">
                {beast.capabilities.map((cap) => (
                  <li key={cap} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="w-3.5 h-3.5 text-[#2D9E5A] flex-shrink-0" />
                    {cap}
                  </li>
                ))}
              </ul>
            </div>

            {/* Permissions */}
            <div className="pop-card bg-card rounded-xl p-5">
              <h2 className="font-display font-bold text-base text-foreground mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#1A6EE8]" />
                Permissions Required
              </h2>
              <ul className="space-y-2">
                {beast.permissions.map((perm) => (
                  <li key={perm} className="flex items-center gap-2 text-sm text-foreground">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    {perm}
                  </li>
                ))}
              </ul>
              {beast.requiresOAuth && (
                <div className="mt-4 p-3 bg-secondary rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">OAuth Required:</strong> This agent needs access to your {beast.platform} account.
                    Your tokens are encrypted with AES-256-GCM.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            {isInstalled && beast.actions.length > 0 && (
              <div className="pop-card bg-card rounded-xl p-5 md:col-span-2">
                <h2 className="font-display font-bold text-base text-foreground mb-4 flex items-center gap-2">
                  <Play className="w-4 h-4 text-[#E8541A]" />
                  Quick Actions
                  {!isLive && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border flex items-center gap-1">
                      <FlaskConical className="w-3 h-3" />
                      Demo
                    </span>
                  )}
                </h2>
                <div className="flex flex-wrap gap-3">
                  {beast.actions.map((action) => (
                    <button
                      key={action}
                      onClick={() => handleRun(action)}
                      disabled={runMutation.isPending}
                      className="pop-btn bg-secondary text-foreground px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      <Play className="w-3.5 h-3.5" />
                      {action}
                    </button>
                  ))}
                </div>
                {isLive && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Or use the <button onClick={() => setActiveTab("chat")} className="font-semibold text-foreground underline">Chat</button> tab for multi-step workflows.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "chat" && isLive && (
          <BeastChatPanel
            agentSlug={beast.slug}
            beastName={beast.name}
            suggestedPrompts={beast.suggestedPrompts ?? []}
            isInstalled={isInstalled}
            hasConnection={hasConnection || !beast.requiresOAuth}
            platformName={beast.platform}
          />
        )}

        {activeTab === "customize" && (
          <div className="pop-card bg-card rounded-xl p-6">
            <h2 className="font-display font-bold text-lg text-foreground mb-6">Configuration</h2>

            {!isInstalled && (
              <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg border border-border mb-6">
                <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <p className="text-sm text-muted-foreground">Install this agent first to save customizations.</p>
              </div>
            )}

            <div className="space-y-6">
              {beast.customizations.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-semibold text-foreground mb-1">{field.label}</label>
                  {field.description && (
                    <p className="text-xs text-muted-foreground mb-2">{field.description}</p>
                  )}

                  {field.type === "toggle" && (
                    <button
                      onClick={() => setFieldValue(field.key, !getFieldValue(field.key, field.default))}
                      className={`relative w-12 h-6 rounded-full border-2 border-border transition-colors ${
                        getFieldValue(field.key, field.default) ? "bg-foreground" : "bg-secondary"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-background border border-border transition-transform ${
                          getFieldValue(field.key, field.default) ? "translate-x-6" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  )}

                  {field.type === "select" && (
                    <select
                      value={String(getFieldValue(field.key, field.default))}
                      onChange={(e) => setFieldValue(field.key, e.target.value)}
                      className="w-full max-w-xs px-3 py-2 bg-secondary border-2 border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {field.type === "slider" && (
                    <div className="flex items-center gap-3 max-w-sm">
                      <input
                        type="range"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={Number(getFieldValue(field.key, field.default))}
                        onChange={(e) => setFieldValue(field.key, Number(e.target.value))}
                        className="flex-1 accent-foreground"
                      />
                      <span className="text-sm font-semibold text-foreground w-12 text-right">
                        {String(getFieldValue(field.key, field.default))}
                      </span>
                    </div>
                  )}

                  {(field.type === "text" || field.type === "number") && (
                    <input
                      type={field.type}
                      value={String(getFieldValue(field.key, field.default))}
                      onChange={(e) => setFieldValue(field.key, field.type === "number" ? Number(e.target.value) : e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full max-w-sm px-3 py-2 bg-secondary border-2 border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground"
                    />
                  )}

                  {field.type === "textarea" && (
                    <textarea
                      value={String(getFieldValue(field.key, field.default))}
                      onChange={(e) => setFieldValue(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full max-w-sm px-3 py-2 bg-secondary border-2 border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground resize-none"
                    />
                  )}
                </div>
              ))}
            </div>

            {isInstalled && (
              <button
                onClick={handleSaveCustomizations}
                disabled={customizeMutation.isPending}
                className="pop-btn bg-foreground text-background px-6 py-2.5 rounded-xl font-bold text-sm mt-8 flex items-center gap-2"
              >
                {customizeMutation.isPending ? "Saving..." : "Save Configuration"}
              </button>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="pop-card bg-card rounded-xl p-6">
            <h2 className="font-display font-bold text-lg text-foreground mb-4">Recent Activity</h2>
            {!isAuthenticated ? (
              <p className="text-sm text-muted-foreground">Sign in to view activity logs.</p>
            ) : activityQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="shimmer h-12 rounded-lg border border-border" />
                ))}
              </div>
            ) : (activityQuery.data ?? []).length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">📋</div>
                <p className="text-sm text-muted-foreground">No runs yet. Use Quick Actions to run this agent.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(activityQuery.data ?? []).map((run: { id: number; action: string; status: string; durationMs?: number | null; createdAt: Date }) => (
                  <div key={run.id} className="flex items-center gap-3 p-3 bg-secondary rounded-lg border border-border">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      run.status === "success" ? "bg-[#2D9E5A]" :
                      run.status === "error" ? "bg-destructive" :
                      run.status === "demo" ? "bg-muted-foreground" :
                      "bg-[#F5C842] animate-pulse"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{run.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(run.createdAt).toLocaleString()}
                        {run.durationMs ? ` · ${(run.durationMs / 1000).toFixed(1)}s` : ""}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      run.status === "success" ? "bg-[#2D9E5A]/20 text-[#2D9E5A]" :
                      run.status === "error" ? "bg-destructive/20 text-destructive" :
                      run.status === "demo" ? "bg-muted text-muted-foreground" :
                      "bg-[#F5C842]/20 text-[#F5C842]"
                    }`}>
                      {run.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "memory" && (
          <div className="pop-card bg-card rounded-xl p-6">
            <div className="mb-6">
              <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
                <Brain className="w-5 h-5 text-[#1A6EE8]" />
                What {beast.name} knows about you
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Learned automatically from your conversations</p>
            </div>
            {memoriesQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="shimmer h-14 rounded-lg border border-border" />
                ))}
              </div>
            ) : (memoriesQuery.data ?? []).length === 0 ? (
              <div className="text-center py-12">
                <Brain className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">
                  No memories yet — start chatting and {beast.name} will learn your preferences
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {(memoriesQuery.data ?? []).map((memory: { id: number; key: string; value: string }) => (
                  <div
                    key={memory.id}
                    className="flex items-start gap-3 p-4 bg-secondary rounded-lg border border-border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{memory.key}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{memory.value}</p>
                    </div>
                    <button
                      onClick={() => deleteMemoryMutation.mutate({ id: memory.id })}
                      disabled={deleteMemoryMutation.isPending}
                      className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5"
                      title="Delete memory"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
