import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Run } from "../lib/types";

export function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["runs"],
    queryFn: () => api.get<{ runs: Run[] }>("/v1/runs"),
  });

  return (
    <div className="page">
      <h1>Activity</h1>
      <div className="subtitle">Every run across every bot.</div>

      {isLoading && <div>Loading…</div>}

      <div className="grid" style={{ gap: 8 }}>
        {(data?.runs ?? []).map((r) => (
          <div key={r.id} className="card" style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <StatusChip status={r.status} />
              <span className="chip mono">{r.botSlug}</span>
              <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: "auto" }}>
                {new Date(r.createdAt).toLocaleString()}
              </span>
            </div>
            {r.inputSummary && <div style={{ fontWeight: 600 }}>{r.inputSummary}</div>}
            {r.outputSummary && (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>{r.outputSummary}</div>
            )}
            {r.errorMessage && (
              <div style={{ color: "var(--bad)", fontSize: 13 }}>
                {r.errorMessage}
              </div>
            )}
            {r.toolCalls && r.toolCalls.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {r.toolCalls.map((t, i) => (
                  <span
                    key={i}
                    className="chip mono"
                    style={{ color: t.ok ? "var(--good)" : "var(--bad)" }}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: Run["status"] }) {
  const color =
    status === "success" ? "var(--good)" : status === "error" ? "var(--bad)" : "var(--warn)";
  return <span className="chip" style={{ color }}>{status}</span>;
}
