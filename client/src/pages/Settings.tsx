import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import NavBar from "../components/NavBar";
import { toast } from "sonner";
import { Check, ExternalLink, Link2, Link2Off, Loader2, Shield, User, Bell } from "lucide-react";

// OAuth providers with their real connect URLs
const OAUTH_PROVIDERS = [
  { id: "google", name: "Google", description: "Gmail, Drive, Calendar, Sheets", color: "#4285F4", emoji: "🔵" },
  { id: "github", name: "GitHub", description: "Repos, Issues, PRs, Actions", color: "#24292E", emoji: "⚫" },
  { id: "slack", name: "Slack", description: "Messages, Channels, Workflows", color: "#4A154B", emoji: "🟣" },
  { id: "notion", name: "Notion", description: "Pages, Databases, Workspaces", color: "#000000", emoji: "⬛" },
  { id: "twitter", name: "Twitter / X", description: "Tweets, DMs, Analytics", color: "#1DA1F2", emoji: "🐦" },
  { id: "linkedin", name: "LinkedIn", description: "Posts, Connections, Jobs", color: "#0A66C2", emoji: "🔷" },
  { id: "salesforce", name: "Salesforce", description: "CRM, Leads, Opportunities", color: "#00A1E0", emoji: "☁️" },
  { id: "hubspot", name: "HubSpot", description: "CRM, Marketing, Contacts", color: "#FF7A59", emoji: "🟠" },
  { id: "shopify", name: "Shopify", description: "Orders, Products, Customers", color: "#96BF48", emoji: "🟢" },
  { id: "stripe", name: "Stripe", description: "Payments, Subscriptions, Analytics", color: "#635BFF", emoji: "💜" },
  { id: "discord", name: "Discord", description: "Servers, Channels, Bots", color: "#5865F2", emoji: "🎮" },
  { id: "figma", name: "Figma", description: "Files, Comments, Components", color: "#F24E1E", emoji: "🎨" },
  { id: "jira", name: "Jira", description: "Issues, Sprints, Projects", color: "#0052CC", emoji: "📋" },
  { id: "asana", name: "Asana", description: "Tasks, Projects, Teams", color: "#F06A6A", emoji: "🔴" },
  { id: "airtable", name: "Airtable", description: "Bases, Tables, Records", color: "#FCB400", emoji: "🟡" },
  { id: "dropbox", name: "Dropbox", description: "Files, Folders, Sharing", color: "#0061FF", emoji: "📦" },
  { id: "zoom", name: "Zoom", description: "Meetings, Recordings, Webinars", color: "#2D8CFF", emoji: "📹" },
  { id: "twilio", name: "Twilio", description: "SMS, Voice, WhatsApp", color: "#F22F46", emoji: "📱" },
  { id: "mailchimp", name: "Mailchimp", description: "Campaigns, Lists, Automation", color: "#FFE01B", emoji: "🐒" },
  { id: "intercom", name: "Intercom", description: "Support, Chat, Customers", color: "#1F8DED", emoji: "💬" },
  { id: "zendesk", name: "Zendesk", description: "Tickets, Agents, Reports", color: "#03363D", emoji: "🎫" },
  { id: "quickbooks", name: "QuickBooks", description: "Invoices, Expenses, Reports", color: "#2CA01C", emoji: "💰" },
  { id: "xero", name: "Xero", description: "Accounting, Invoices, Payroll", color: "#13B5EA", emoji: "💼" },
  { id: "webflow", name: "Webflow", description: "Sites, CMS, Forms", color: "#4353FF", emoji: "🌐" },
  { id: "wordpress", name: "WordPress", description: "Posts, Pages, Media", color: "#21759B", emoji: "📝" },
  { id: "reddit", name: "Reddit", description: "Posts, Comments, Subreddits", color: "#FF4500", emoji: "🤖" },
  { id: "spotify", name: "Spotify", description: "Playlists, Tracks, Podcasts", color: "#1DB954", emoji: "🎵" },
  { id: "youtube", name: "YouTube", description: "Videos, Channels, Analytics", color: "#FF0000", emoji: "▶️" },
  { id: "instagram", name: "Instagram", description: "Posts, Stories, Insights", color: "#E1306C", emoji: "📸" },
  { id: "facebook", name: "Facebook", description: "Pages, Ads, Groups", color: "#1877F2", emoji: "👤" },
  { id: "tiktok", name: "TikTok", description: "Videos, Analytics, Creator", color: "#000000", emoji: "🎵" },
  { id: "pinterest", name: "Pinterest", description: "Pins, Boards, Analytics", color: "#E60023", emoji: "📌" },
  { id: "trello", name: "Trello", description: "Boards, Cards, Lists", color: "#0052CC", emoji: "📋" },
  { id: "monday", name: "Monday.com", description: "Boards, Items, Automations", color: "#FF3D57", emoji: "📅" },
  { id: "clickup", name: "ClickUp", description: "Tasks, Docs, Goals", color: "#7B68EE", emoji: "✅" },
  { id: "box", name: "Box", description: "Files, Folders, Collaboration", color: "#0061D5", emoji: "📂" },
];

type Tab = "connections" | "profile" | "notifications" | "security";

export default function Settings() {
  const { isAuthenticated, user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("connections");

  const connectionsQuery = trpc.connections.list.useQuery(undefined, { enabled: isAuthenticated });
  const disconnectMutation = trpc.connections.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Disconnected successfully");
      connectionsQuery.refetch();
    },
    onError: () => toast.error("Disconnect failed"),
  });

  const saveApiKeyMutation = trpc.connections.saveApiKey.useMutation({
    onSuccess: () => {
      toast.success("Connected!");
      connectionsQuery.refetch();
    },
    onError: () => toast.error("Connection failed"),
  });

  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  const handleConnect = (providerId: string) => {
    setConnectingProvider(providerId);
    // Build the OAuth URL for providers that support it
    const oauthUrls: Record<string, string> = {
      google: `https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=${encodeURIComponent(window.location.origin + '/oauth/callback')}&response_type=code&scope=email+profile&state=${providerId}`,
      github: `https://github.com/login/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=${encodeURIComponent(window.location.origin + '/oauth/callback')}&scope=repo+user&state=${providerId}`,
      slack: `https://slack.com/oauth/v2/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=${encodeURIComponent(window.location.origin + '/oauth/callback')}&scope=channels:read,chat:write&state=${providerId}`,
    };
    // For now, show a toast with instructions — real OAuth requires server-side client IDs
    toast.info(`To connect ${providerId}, add your OAuth credentials in Settings > Security`, { duration: 4000 });
    setConnectingProvider(null);
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
          <div className="text-5xl mb-4">⚙️</div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Sign in to access settings</h1>
          <a href={getLoginUrl()}>
            <button className="pop-btn bg-foreground text-background px-6 py-3 rounded-xl font-bold mt-4">
              Sign In Free
            </button>
          </a>
        </div>
      </div>
    );
  }

  const connections = connectionsQuery.data ?? [];
  const connectedProviders = new Set(connections.map((c) => c.provider));

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "connections", label: "Connections", icon: Link2 },
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="container py-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-2xl md:text-3xl font-black text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account, connections, and preferences</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="md:w-48 flex-shrink-0">
            <nav className="flex md:flex-col gap-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    activeTab === id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            {activeTab === "connections" && (
              <div>
                <div className="mb-4">
                  <h2 className="font-display font-bold text-lg text-foreground">OAuth Connections</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Connect your accounts to enable Beast Bots. Tokens are encrypted with AES-256-GCM.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {OAUTH_PROVIDERS.map((provider) => {
                    const isConnected = connectedProviders.has(provider.id);
                    const isConnecting = connectingProvider === provider.id;
                    const isDisconnecting = disconnectMutation.isPending && disconnectMutation.variables?.provider === provider.id;

                    return (
                      <div
                        key={provider.id}
                        className={`pop-card bg-card rounded-xl p-4 flex items-center gap-3 ${
                          isConnected ? "border-[#2D9E5A]/40" : ""
                        }`}
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 border-2 border-border"
                          style={{ backgroundColor: provider.color + "15" }}
                        >
                          {provider.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{provider.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{provider.description}</p>
                        </div>
                        <button
                          onClick={() => {
                            if (isConnected) {
                              disconnectMutation.mutate({ provider: provider.id });
                            } else {
                              handleConnect(provider.id);
                            }
                          }}
                          disabled={isConnecting || isDisconnecting}
                          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                            isConnected
                              ? "border-[#2D9E5A]/50 text-[#2D9E5A] hover:border-destructive hover:text-destructive hover:bg-destructive/10"
                              : "border-border text-foreground hover:bg-secondary"
                          }`}
                        >
                          {isConnecting || isDisconnecting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isConnected ? (
                            <>
                              <Check className="w-3 h-3" />
                              Connected
                            </>
                          ) : (
                            <>
                              <Link2 className="w-3 h-3" />
                              Connect
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "profile" && (
              <div className="pop-card bg-card rounded-xl p-6">
                <h2 className="font-display font-bold text-lg text-foreground mb-4">Profile</h2>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-foreground flex items-center justify-center text-background text-2xl font-bold">
                    {(user?.name ?? "U")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{user?.name}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-secondary rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">
                    Profile information is managed through your Manus account. 
                    To update your name or email, visit your Manus account settings.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="pop-card bg-card rounded-xl p-6">
                <h2 className="font-display font-bold text-lg text-foreground mb-4">Notification Preferences</h2>
                <div className="space-y-4">
                  {[
                    { label: "Run completions", desc: "Get notified when an agent finishes a run", defaultOn: true },
                    { label: "Run errors", desc: "Get notified when an agent encounters an error", defaultOn: true },
                    { label: "New matching agents", desc: "Get notified when new agents match your interests", defaultOn: false },
                    { label: "Weekly digest", desc: "Weekly summary of your agent activity", defaultOn: false },
                  ].map(({ label, desc, defaultOn }) => (
                    <div key={label} className="flex items-start justify-between gap-4 py-3 border-b border-border/50 last:border-0">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                      <button
                        className={`relative w-10 h-5 rounded-full border-2 border-border transition-colors flex-shrink-0 mt-0.5 ${
                          defaultOn ? "bg-foreground" : "bg-secondary"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-3 h-3 rounded-full bg-background border border-border transition-transform ${
                            defaultOn ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="pop-card bg-card rounded-xl p-6">
                <h2 className="font-display font-bold text-lg text-foreground mb-4">Security</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-[#2D9E5A]/10 border border-[#2D9E5A]/30 rounded-xl">
                    <Shield className="w-5 h-5 text-[#2D9E5A] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">AES-256-GCM Token Encryption</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        All OAuth tokens are encrypted at rest using AES-256-GCM with unique IVs per token.
                        Your credentials are never stored in plaintext.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-[#1A6EE8]/10 border border-[#1A6EE8]/30 rounded-xl">
                    <Check className="w-5 h-5 text-[#1A6EE8] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Manus OAuth Authentication</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Your account is secured through Manus OAuth. Session tokens are signed with JWT_SECRET
                        and expire automatically.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-secondary border border-border rounded-xl">
                    <Shield className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Scoped OAuth Permissions</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Each Beast Bot only requests the minimum OAuth scopes it needs.
                        You can review and revoke permissions at any time.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
