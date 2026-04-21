import { setSessionToken } from "../lib/api";

export function SettingsPage() {
  return (
    <div className="page">
      <h1>Settings</h1>
      <div className="subtitle">Account, privacy, and billing.</div>

      <div className="grid" style={{ gap: 12 }}>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Billing</div>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            Free plan. Upgrade to Pro to raise your monthly run limit,
            schedule recipes, and enable push alerts on the iOS companion.
          </p>
          <button className="btn" disabled>
            Upgrade (soon)
          </button>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Privacy</div>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            No tracking, no third-party analytics. Your bot conversations are
            scoped to your account. Export or delete your data anytime.
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
