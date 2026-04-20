import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { getMascotDataUrl } from "../lib/mascot";
import NavBar from "../components/NavBar";
import BeastCard from "../components/BeastCard";
import { Link } from "wouter";
import {
  Activity, Bot, Check, Link2, Plus, Settings, ShoppingBag, Zap, AlertCircle, Clock
} from "lucide-react";

export default function Dashboard() {
  const { isAuthenticated, user, loading } = useAuth();

  const installationsQuery = trpc.installations.list.useQuery(undefined, { enabled: isAuthenticated });
  const connectionsQuery = trpc.connections.list.useQuery(undefined, { enabled: isAuthenticated });
  const activityQuery = trpc.activity.list.useQuery({ limit: 15 }, { enabled: isAuthenticated });
  // dashboard stats via agents + activity queries

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
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Sign in to access your dashboard</h1>
          <p className="text-muted-foreground text-sm mb-6">Track your installed agents, connections, and activity.</p>
          <a href={getLoginUrl()}>
            <button className="pop-btn bg-foreground text-background px-6 py-3 rounded-xl font-bold">
              Sign In Free
            </button>
          </a>
        </div>
      </div>
    );
  }

  const installations = installationsQuery.data ?? [];
  const connections = connectionsQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const stats = {
    installedCount: installations.length,
    totalRuns: activity.length,
    successfulRuns: activity.filter((r: any) => r.status === 'success').length,
    connectionCount: connections.length,
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="container py-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-black text-foreground">
              Welcome back, {user?.name?.split(" ")[0] ?? "Beast"}! 👋
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {installations.length} agents installed · {connections.length} connections active
            </p>
          </div>
          <Link href="/marketplace">
            <button className="pop-btn bg-foreground text-background px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Agent
            </button>
          </Link>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Installed Agents", value: stats.installedCount, icon: Bot, color: "#7C3AED" },
              { label: "Total Runs", value: stats.totalRuns, icon: Zap, color: "#E8541A" },
              { label: "Successful Runs", value: stats.successfulRuns, icon: Check, color: "#2D9E5A" },
              { label: "Active Connections", value: stats.connectionCount, icon: Link2, color: "#1A6EE8" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="pop-card bg-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "22" }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{label}</span>
                </div>
                <div className="font-display text-2xl font-black text-foreground">{value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Installed agents */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg text-foreground">Your Beasts</h2>
              <Link href="/marketplace">
                <button className="text-xs text-muted-foreground hover:text-foreground font-medium">Browse more →</button>
              </Link>
            </div>

            {installationsQuery.isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="shimmer h-32 rounded-xl border-2 border-border" />
                ))}
              </div>
            ) : installations.length === 0 ? (
              <div className="pop-card bg-card rounded-xl p-8 text-center border-2 border-dashed border-border">
                <ShoppingBag className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-display font-bold text-foreground mb-1">No agents yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Browse the marketplace to install your first Beast Bot</p>
                <Link href="/marketplace">
                  <button className="pop-btn bg-foreground text-background px-4 py-2 rounded-lg text-sm font-semibold">
                    Browse Marketplace
                  </button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {installations.map((inst: any) => (
                  <div key={inst.agentSlug} className="relative">
                    <BeastCard beast={inst.agent} installed compact />
                    <Link href={`/agent/${inst.agentSlug}`}>
                      <button className="absolute bottom-2 right-2 w-6 h-6 rounded-md bg-secondary border border-border flex items-center justify-center hover:bg-foreground hover:text-background transition-colors">
                        <Settings className="w-3 h-3" />
                      </button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column: connections + activity */}
          <div className="space-y-6">
            {/* Connections */}
            <div className="pop-card bg-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-base text-foreground flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#1A6EE8]" />
                  Connections
                </h2>
                <Link href="/settings">
                  <button className="text-xs text-muted-foreground hover:text-foreground">Manage →</button>
                </Link>
              </div>

              {connectionsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="shimmer h-8 rounded-lg" />
                  ))}
                </div>
              ) : connections.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground mb-2">No OAuth connections yet</p>
                  <Link href="/settings">
                    <button className="text-xs font-semibold text-foreground hover:underline">Connect accounts →</button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {connections.slice(0, 6).map((conn) => (
                    <div key={conn.id} className="flex items-center gap-2 p-2 bg-secondary rounded-lg">
                      <div className="w-5 h-5 rounded flex items-center justify-center bg-[#2D9E5A]/20">
                        <Check className="w-3 h-3 text-[#2D9E5A]" />
                      </div>
                      <span className="text-xs font-medium text-foreground capitalize flex-1 truncate">
                        {conn.provider}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {(conn as any).accountEmail ? (conn as any).accountEmail.split("@")[0] : "connected"}
                      </span>
                    </div>
                  ))}
                  {connections.length > 6 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{connections.length - 6} more
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div className="pop-card bg-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-base text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#E8541A]" />
                  Recent Activity
                </h2>
                <Link href="/activity">
                  <button className="text-xs text-muted-foreground hover:text-foreground">View all →</button>
                </Link>
              </div>

              {activityQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="shimmer h-10 rounded-lg" />
                  ))}
                </div>
              ) : activity.length === 0 ? (
                <div className="text-center py-4">
                  <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No activity yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activity.map((run: any) => (
                    <div key={run.id} className="flex items-center gap-2 p-2 bg-secondary rounded-lg">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        run.status === "success" ? "bg-[#2D9E5A]" :
                        run.status === "error" ? "bg-destructive" :
                        "bg-[#F5C842] animate-pulse"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{run.agentSlug}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{run.action}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {new Date(run.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
