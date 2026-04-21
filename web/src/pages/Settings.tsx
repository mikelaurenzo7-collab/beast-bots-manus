import { useMutation, useQuery } from "@tanstack/react-query";
import { api, setSessionToken } from "../lib/api";

type SubscriptionSnapshot = {
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export function SettingsPage() {
  const sub = useQuery({
    queryKey: ["subscription"],
    queryFn: () => api.get<SubscriptionSnapshot>("/v1/billing/subscription"),
  });

  const checkout = useMutation({
    mutationFn: (cadence: "monthly" | "yearly") =>
      api.post<{ url: string }>("/v1/billing/checkout", {
        cadence,
        returnTo: window.location.origin + "/settings",
      }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const portal = useMutation({
    mutationFn: () => api.post<{ url: string }>("/v1/billing/portal", {}),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const isPro = sub.data?.plan === "pro" && sub.data?.status === "active";

  return (
    <div className="page">
      <h1>Settings</h1>
      <div className="subtitle">Account, billing, and privacy.</div>

      <div className="grid" style={{ gap: 12 }}>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Plan</div>
          {sub.isLoading ? (
            <p style={{ color: "var(--muted)" }}>Loading…</p>
          ) : isPro ? (
            <div>
              <div style={{ marginBottom: 6 }}>
                <span className="chip" style={{ color: "var(--good)" }}>
                  <span className="dot good" />
                  Pro — {sub.data?.status}
                </span>
              </div>
              {sub.data?.currentPeriodEnd && (
                <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 8 }}>
                  {sub.data.cancelAtPeriodEnd ? "Cancels on " : "Renews on "}
                  {new Date(sub.data.currentPeriodEnd).toLocaleDateString()}
                </div>
              )}
              <button
                className="btn ghost"
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
              >
                {portal.isPending ? "Opening…" : "Manage billing"}
              </button>
            </div>
          ) : (
            <div>
              <p style={{ color: "var(--muted)", marginTop: 0 }}>
                You're on the Free plan (50 runs/day). Pro unlocks 2,500
                runs/day, all OAuth connections, scheduled recipes, and push
                alerts on the iOS companion.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn"
                  onClick={() => checkout.mutate("monthly")}
                  disabled={checkout.isPending}
                >
                  {checkout.isPending ? "Redirecting…" : "Upgrade — $19/mo"}
                </button>
                <button
                  className="btn ghost"
                  onClick={() => checkout.mutate("yearly")}
                  disabled={checkout.isPending}
                >
                  Yearly — $149/yr
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Privacy</div>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            No tracking, no third-party analytics. Export or delete your data
            any time.
          </p>
          <button className="btn ghost">Export all data</button>{" "}
          <button className="btn danger">Delete my account</button>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Session</div>
          <button
            className="btn ghost"
            onClick={() => {
              setSessionToken(null);
              window.location.href = "/";
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
