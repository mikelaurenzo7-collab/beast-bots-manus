import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import NavBar from "../components/NavBar";
import { Bell, CheckCheck, Info, AlertCircle, Sparkles } from "lucide-react";

export default function Notifications() {
  const { isAuthenticated, loading } = useAuth();

  const notificationsQuery = trpc.notifications.list.useQuery(
    { limit: 50 },
    { enabled: isAuthenticated }
  );

  const markReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => notificationsQuery.refetch(),
  });

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
          <div className="text-5xl mb-4">🔔</div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Sign in to view notifications</h1>
          <a href={getLoginUrl()}>
            <button className="pop-btn bg-foreground text-background px-6 py-3 rounded-xl font-bold mt-4">
              Sign In Free
            </button>
          </a>
        </div>
      </div>
    );
  }

  const notifications = notificationsQuery.data ?? [];
  const unread = notifications.filter((n: any) => !n.readAt);

  const getIcon = (type: string) => {
    switch (type) {
      case "run_complete": return <CheckCheck className="w-4 h-4 text-[#2D9E5A]" />;
      case "run_error": return <AlertCircle className="w-4 h-4 text-destructive" />;
      case "new_agent": return <Sparkles className="w-4 h-4 text-[#7C3AED]" />;
      default: return <Info className="w-4 h-4 text-[#1A6EE8]" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="container py-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-black text-foreground flex items-center gap-2">
              <Bell className="w-6 h-6 text-[#E8541A]" />
              Notifications
            </h1>
            {unread.length > 0 && (
              <p className="text-muted-foreground text-sm mt-1">{unread.length} unread</p>
            )}
          </div>
          {unread.length > 0 && (
            <button
              onClick={() => markReadMutation.mutate()}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {notificationsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shimmer h-16 rounded-xl border-2 border-border" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-display font-bold text-lg text-foreground mb-1">No notifications yet</h3>
            <p className="text-muted-foreground text-sm">
              You'll be notified when your agents complete runs or encounter errors.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif: any) => (
              <div
                key={notif.id}
                className={`pop-card rounded-xl p-4 flex items-start gap-3 cursor-pointer transition-all ${
                  !notif.readAt ? "bg-card border-l-4 border-l-[#E8541A]" : "bg-card opacity-70"
                }`}
                onClick={() => {
                  if (!notif.readAt) {
                    markReadMutation.mutate();
                  }
                }}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{notif.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(notif.createdAt).toLocaleString()}
                  </p>
                </div>
                {!notif.readAt && (
                  <div className="w-2 h-2 rounded-full bg-[#E8541A] flex-shrink-0 mt-1.5" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
