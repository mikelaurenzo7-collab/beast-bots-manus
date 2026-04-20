import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import NavBar from "../components/NavBar";
import { Activity as ActivityIcon, CheckCircle, XCircle, Clock, Filter, FlaskConical } from "lucide-react";

type StatusFilter = "all" | "success" | "error" | "running" | "demo";

export default function Activity() {
  const { isAuthenticated, loading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const activityQuery = trpc.activity.list.useQuery(
    { limit: 50 },
    { enabled: isAuthenticated }
  );

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
          <div className="text-5xl mb-4">📋</div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Sign in to view activity</h1>
          <a href={getLoginUrl()}>
            <button className="pop-btn bg-foreground text-background px-6 py-3 rounded-xl font-bold mt-4">
              Sign In Free
            </button>
          </a>
        </div>
      </div>
    );
  }

  const allRuns = activityQuery.data ?? [];
  const filtered = statusFilter === "all" ? allRuns : allRuns.filter((r: any) => r.status === statusFilter);

  const counts = {
    all: allRuns.length,
    success: allRuns.filter((r: any) => r.status === "success").length,
    error: allRuns.filter((r: any) => r.status === "error").length,
    running: allRuns.filter((r: any) => r.status === "running").length,
    demo: allRuns.filter((r: any) => r.status === "demo").length,
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="container py-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-black text-foreground flex items-center gap-2">
              <ActivityIcon className="w-6 h-6 text-[#E8541A]" />
              Activity Log
            </h1>
            <p className="text-muted-foreground text-sm mt-1">All your agent runs in one place</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Total Runs", value: counts.all, color: "text-foreground" },
            { label: "Successful", value: counts.success, color: "text-[#2D9E5A]" },
            { label: "Errors", value: counts.error, color: "text-destructive" },
          ].map(({ label, value, color }) => (
            <div key={label} className="pop-card bg-card rounded-xl p-4 text-center">
              <div className={`font-display text-2xl font-black ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <Filter className="w-4 h-4 text-muted-foreground self-center" />
          {(["all", "success", "error", "running", "demo"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border-2 transition-all capitalize ${
                statusFilter === s
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:border-foreground/40"
              }`}
            >
              {s} {s !== "all" && `(${counts[s]})`}
            </button>
          ))}
        </div>

        {/* Activity list */}
        {activityQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shimmer h-16 rounded-xl border-2 border-border" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-display font-bold text-lg text-foreground mb-1">No activity yet</h3>
            <p className="text-muted-foreground text-sm">
              Install agents and run them to see activity here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((run: any) => (
              <div key={run.id} className="pop-card bg-card rounded-xl p-4 flex items-center gap-4">
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {run.status === "success" ? (
                    <CheckCircle className="w-5 h-5 text-[#2D9E5A]" />
                  ) : run.status === "error" ? (
                    <XCircle className="w-5 h-5 text-destructive" />
                  ) : run.status === "demo" ? (
                    <FlaskConical className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <Clock className="w-5 h-5 text-[#F5C842] animate-pulse" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{run.agentSlug}</p>
                    <span className="text-xs text-muted-foreground">·</span>
                    <p className="text-xs text-muted-foreground truncate">{run.action}</p>
                    {run.status === "demo" && (
                      <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                        Demo
                      </span>
                    )}
                  </div>
                  {run.outputSummary && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{run.outputSummary}</p>
                  )}
                  {run.errorMessage && (
                    <p className="text-xs text-destructive mt-0.5 truncate">{run.errorMessage}</p>
                  )}
                </div>

                {/* Meta */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">
                    {new Date(run.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(run.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {run.durationMs && (
                    <p className="text-xs text-muted-foreground">{(run.durationMs / 1000).toFixed(1)}s</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
