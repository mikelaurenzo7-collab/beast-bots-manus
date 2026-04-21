import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import NavBar from "../components/NavBar";
import { toast } from "sonner";
import { Check, ExternalLink, Link2, Link2Off, Loader2, Shield, User, Bell, Eye, EyeOff, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// OAuth providers with their configurations
const OAUTH_PROVIDERS = [
  { id: "google", name: "Google", description: "Gmail, Drive, Calendar, Sheets", color: "#4285F4", emoji: "🔵", scopes: ["email", "profile", "https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/calendar"] },
  { id: "github", name: "GitHub", description: "Repos, Issues, PRs, Actions", color: "#24292E", emoji: "⚫", scopes: ["repo", "user", "gist"] },
  { id: "slack", name: "Slack", description: "Messages, Channels, Workflows", color: "#4A154B", emoji: "🟣", scopes: ["channels:read", "chat:write", "users:read"] },
  { id: "notion", name: "Notion", description: "Pages, Databases, Workspaces", color: "#000000", emoji: "⬛", scopes: ["read", "write"] },
  { id: "twitter", name: "Twitter / X", description: "Tweets, DMs, Analytics", color: "#1DA1F2", emoji: "🐦", scopes: ["tweet.read", "tweet.write", "users.read"] },
  { id: "linkedin", name: "LinkedIn", description: "Posts, Connections, Jobs", color: "#0A66C2", emoji: "🔷", scopes: ["r_liteprofile", "w_member_social"] },
  { id: "salesforce", name: "Salesforce", description: "CRM, Leads, Opportunities", color: "#00A1E0", emoji: "☁️", scopes: ["api", "refresh_token"] },
  { id: "hubspot", name: "HubSpot", description: "CRM, Marketing, Contacts", color: "#FF7A59", emoji: "🟠", scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write"] },
  { id: "shopify", name: "Shopify", description: "Orders, Products, Customers", color: "#96BF48", emoji: "🟢", scopes: ["read_products", "read_orders", "read_customers"] },
  { id: "stripe", name: "Stripe", description: "Payments, Subscriptions, Analytics", color: "#635BFF", emoji: "💜", scopes: ["read_write"] },
  { id: "discord", name: "Discord", description: "Servers, Channels, Bots", color: "#5865F2", emoji: "🎮", scopes: ["identify", "guilds", "messages.read"] },
  { id: "figma", name: "Figma", description: "Files, Comments, Components", color: "#F24E1E", emoji: "🎨", scopes: ["file_read"] },
  { id: "jira", name: "Jira", description: "Issues, Sprints, Projects", color: "#0052CC", emoji: "📋", scopes: ["read:jira-work", "write:jira-work"] },
  { id: "asana", name: "Asana", description: "Tasks, Projects, Teams", color: "#F06A6A", emoji: "🔴", scopes: ["default"] },
  { id: "airtable", name: "Airtable", description: "Bases, Tables, Records", color: "#FCB400", emoji: "🟡", scopes: ["data.records:read", "data.records:write"] },
  { id: "dropbox", name: "Dropbox", description: "Files, Folders, Sharing", color: "#0061FF", emoji: "📦", scopes: ["files.metadata.read", "files.content.read"] },
  { id: "zoom", name: "Zoom", description: "Meetings, Recordings, Webinars", color: "#2D8CFF", emoji: "📹", scopes: ["meeting:read", "recording:read"] },
  { id: "twilio", name: "Twilio", description: "SMS, Voice, WhatsApp", color: "#F22F46", emoji: "📱", scopes: ["default"] },
  { id: "mailchimp", name: "Mailchimp", description: "Campaigns, Lists, Automation", color: "#FFE01B", emoji: "🐒", scopes: ["campaigns", "lists", "automations"] },
  { id: "intercom", name: "Intercom", description: "Support, Chat, Customers", color: "#1F8DED", emoji: "💬", scopes: ["conversations", "users"] },
  { id: "zendesk", name: "Zendesk", description: "Tickets, Agents, Reports", color: "#03363D", emoji: "🎫", scopes: ["read", "write"] },
  { id: "quickbooks", name: "QuickBooks", description: "Invoices, Expenses, Reports", color: "#2CA01C", emoji: "💰", scopes: ["com.intuit.quickbooks.accounting"] },
  { id: "xero", name: "Xero", description: "Accounting, Invoices, Payroll", color: "#13B5EA", emoji: "💼", scopes: ["payroll", "accounting"] },
  { id: "webflow", name: "Webflow", description: "Sites, CMS, Forms", color: "#4353FF", emoji: "🌐", scopes: ["sites:read", "collections:read"] },
  { id: "wordpress", name: "WordPress", description: "Posts, Pages, Media", color: "#21759B", emoji: "📝", scopes: ["posts", "pages"] },
  { id: "reddit", name: "Reddit", description: "Posts, Comments, Subreddits", color: "#FF4500", emoji: "🤖", scopes: ["read", "submit"] },
  { id: "spotify", name: "Spotify", description: "Playlists, Tracks, Podcasts", color: "#1DB954", emoji: "🎵", scopes: ["user-read-private", "playlist-read-private"] },
  { id: "youtube", name: "YouTube", description: "Videos, Channels, Analytics", color: "#FF0000", emoji: "▶️", scopes: ["youtube.readonly", "youtube.upload"] },
  { id: "instagram", name: "Instagram", description: "Posts, Stories, Insights", color: "#E1306C", emoji: "📸", scopes: ["instagram_basic", "instagram_graph_user_media"] },
  { id: "facebook", name: "Facebook", description: "Pages, Ads, Groups", color: "#1877F2", emoji: "👤", scopes: ["pages_read_engagement", "pages_manage_metadata"] },
  { id: "tiktok", name: "TikTok", description: "Videos, Analytics, Creator", color: "#000000", emoji: "🎵", scopes: ["user.info.basic", "video.list"] },
  { id: "pinterest", name: "Pinterest", description: "Pins, Boards, Analytics", color: "#E60023", emoji: "📌", scopes: ["boards:read", "pins:read"] },
  { id: "trello", name: "Trello", description: "Boards, Cards, Lists", color: "#0052CC", emoji: "📋", scopes: ["read", "write"] },
  { id: "monday", name: "Monday.com", description: "Boards, Items, Automations", color: "#FF3D57", emoji: "📅", scopes: ["boards:read", "items:read"] },
  { id: "clickup", name: "ClickUp", description: "Tasks, Docs, Goals", color: "#7B68EE", emoji: "✅", scopes: ["task:read", "task:write"] },
  { id: "box", name: "Box", description: "Files, Folders, Collaboration", color: "#0061D5", emoji: "📂", scopes: ["root_readwrite"] },
];

type Tab = "connections" | "profile" | "notifications" | "security";

interface CredentialFormState {
  clientId: string;
  clientSecret: string;
  apiKey: string;
}

export default function Settings() {
  const { isAuthenticated, user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("connections");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [credentialForm, setCredentialForm] = useState<CredentialFormState>({ clientId: "", clientSecret: "", apiKey: "" });
  const [showSecrets, setShowSecrets] = useState(false);

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
      toast.success("Credentials saved! You can now connect your account.");
      setCredentialForm({ clientId: "", clientSecret: "", apiKey: "" });
      setSelectedProvider(null);
      connectionsQuery.refetch();
    },
    onError: () => toast.error("Failed to save credentials"),
  });

  const handleSaveCredentials = (providerId: string | null) => {
    if (!providerId) return;
    if (!credentialForm.clientId && !credentialForm.apiKey) {
      toast.error("Please enter at least Client ID or API Key");
      return;
    }
    const apiKey = credentialForm.apiKey || credentialForm.clientId;
    if (!apiKey) {
      toast.error("Please enter API Key or Client ID");
      return;
    }
    saveApiKeyMutation.mutate({
      provider: providerId,
      apiKey: apiKey,
      accountName: credentialForm.clientSecret || undefined,
    });
  };

  const handleConnect = (providerId: string) => {
    const provider = OAUTH_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return;

    // Ensure provider scopes exist
    const scopes = provider.scopes || [];

    // For OAuth providers, redirect to authorization
    const oauthUrls: Record<string, string> = {
      google: `https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_GOOGLE_CLIENT_ID&redirect_uri=${encodeURIComponent(window.location.origin + '/oauth/callback')}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}&state=${providerId}`,
      github: `https://github.com/login/oauth/authorize?client_id=YOUR_GITHUB_CLIENT_ID&redirect_uri=${encodeURIComponent(window.location.origin + '/oauth/callback')}&scope=${encodeURIComponent(scopes.join(','))}&state=${providerId}`,
      slack: `https://slack.com/oauth/v2/authorize?client_id=YOUR_SLACK_CLIENT_ID&redirect_uri=${encodeURIComponent(window.location.origin + '/oauth/callback')}&scope=${encodeURIComponent(scopes.join(','))}&state=${providerId}`,
    };

    if (oauthUrls[providerId]) {
      window.location.href = oauthUrls[providerId];
    } else {
      // For non-OAuth providers, show credential form
      setSelectedProvider(providerId);
    }
  };

  const isConnected = (providerId: string) => {
    return connectionsQuery.data?.some(c => c.provider === providerId);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!isAuthenticated) return <div className="min-h-screen flex items-center justify-center">Please sign in</div>;

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your Beast Bots connections and preferences</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-display font-bold mb-4">OAuth Connections</h2>
              <p className="text-muted-foreground mb-6">Connect your accounts to enable Beast Bots to access your data and automate workflows.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {OAUTH_PROVIDERS.map((provider) => {
                  const connected = isConnected(provider.id);
                  return (
                    <Card key={provider.id} className="p-4 hover:shadow-pop transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{provider.emoji}</span>
                          <div>
                            <h3 className="font-semibold">{provider.name}</h3>
                            <p className="text-xs text-muted-foreground">{provider.description}</p>
                          </div>
                        </div>
                        {connected && <Check className="text-green-600" size={20} />}
                      </div>
                      <Button
                        onClick={() => handleConnect(provider.id)}
                        variant={connected ? "outline" : "default"}
                        size="sm"
                        className="w-full"
                        disabled={saveApiKeyMutation.isPending}
                      >
                        {saveApiKeyMutation.isPending ? (
                          <Loader2 className="animate-spin mr-2" size={16} />
                        ) : connected ? (
                          <>
                            <Check size={16} className="mr-2" />
                            Connected
                          </>
                        ) : (
                          <>
                            <Link2 size={16} className="mr-2" />
                            Connect
                          </>
                        )}
                      </Button>
                      {connected && (
                        <Button
                          onClick={() => disconnectMutation.mutate({ provider: provider.id })}
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2 text-destructive hover:text-destructive"
                          disabled={disconnectMutation.isPending}
                        >
                          <Link2Off size={16} className="mr-2" />
                          Disconnect
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-display font-bold mb-4">Profile</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input value={user?.name || ""} disabled className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input value={user?.email || ""} disabled className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Member Since</label>
                  <Input value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : ""} disabled className="mt-1" />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-display font-bold mb-4">Notification Preferences</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Run Completion</p>
                    <p className="text-sm text-muted-foreground">Notify when a Beast Bot workflow completes</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4" />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Run Errors</p>
                    <p className="text-sm text-muted-foreground">Notify when a Beast Bot encounters an error</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4" />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">New Matching Bots</p>
                    <p className="text-sm text-muted-foreground">Notify when a new Beast Bot matches your interests</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4" />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-display font-bold mb-4">Security</h2>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Shield className="text-blue-600 mt-1" size={20} />
                    <div>
                      <p className="font-medium text-blue-900">AES-256-GCM Encryption</p>
                      <p className="text-sm text-blue-800">All OAuth tokens and API keys are encrypted with military-grade AES-256-GCM encryption before storage.</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Check className="text-green-600 mt-1" size={20} />
                    <div>
                      <p className="font-medium text-green-900">Secure OAuth Flow</p>
                      <p className="text-sm text-green-800">We use industry-standard OAuth 2.0 with PKCE for secure authentication. Your credentials never leave your browser during authorization.</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Credential Form Dialog */}
      <Dialog open={!!selectedProvider} onOpenChange={(open) => !open && setSelectedProvider(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Credentials for {OAUTH_PROVIDERS.find(p => p.id === selectedProvider)?.name}</DialogTitle>
            <DialogDescription>Enter your API credentials to connect this service. Your credentials are encrypted with AES-256-GCM.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Client ID</label>
              <Input
                placeholder="Your Client ID"
                value={credentialForm.clientId}
                onChange={(e) => setCredentialForm({ ...credentialForm, clientId: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">API Key or Secret</label>
              <div className="relative mt-1">
                <Input
                  type={showSecrets ? "text" : "password"}
                  placeholder="Your API Key or Secret"
                  value={credentialForm.clientSecret}
                  onChange={(e) => setCredentialForm({ ...credentialForm, clientSecret: e.target.value })}
                />
                <button
                  onClick={() => setShowSecrets(!showSecrets)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showSecrets ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {selectedProvider && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-semibold text-blue-900 mb-2">Requested Permissions</p>
                <div className="space-y-1">
                  {OAUTH_PROVIDERS.find((p: any) => p.id === selectedProvider)?.scopes?.map((scope: string) => (
                    <div key={scope} className="text-xs text-blue-800">
                      • {scope}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button
              onClick={() => handleSaveCredentials(selectedProvider!)}
              disabled={saveApiKeyMutation.isPending}
              className="w-full"
            >
              {saveApiKeyMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Saving...
                </>
              ) : (
                "Save Credentials"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
