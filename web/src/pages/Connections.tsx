import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { BotCatalogResponse, Connection } from "../lib/types";

const PROVIDER_LABELS: Record<string, string> = {
  shopify: "Shopify",
  etsy: "Etsy",
  pinterest: "Pinterest",
  kalshi: "Kalshi",
};

export function ConnectionsPage() {
  const qc = useQueryClient();
  const connections = useQuery({
    queryKey: ["connections"],
    queryFn: () => api.get<{ connections: Connection[] }>("/v1/connections"),
  });
  const catalog = useQuery({
    queryKey: ["bot-catalog"],
    queryFn: () => api.get<BotCatalogResponse>("/v1/boss/catalog"),
  });

  const disconnect = useMutation({
    mutationFn: (provider: string) => api.delete(`/v1/connections/${provider}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  });

  const required = new Set(
    (catalog.data?.bots ?? []).flatMap((b) => b.requiredProviders)
  );
  const connected = new Map(
    (connections.data?.connections ?? []).map((c) => [c.provider, c])
  );

  return (
    <div className="page">
      <h1>Connections</h1>
      <div className="subtitle">
        Bring your own tokens. Stored encrypted with AES-256-GCM. We never see
        your OAuth secret — the exchange happens in your browser.
      </div>

      <div className="grid" style={{ gap: 10 }}>
        {Array.from(required).map((p) => {
          const c = connected.get(p);
          return (
            <div key={p} className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 700, flex: 1 }}>{PROVIDER_LABELS[p] ?? p}</div>
              {c ? (
                <>
                  <span className="chip" style={{ color: "var(--good)" }}>
                    <span className="dot good" />
                    {c.accountName ?? "Connected"}
                  </span>
                  <button
                    className="btn ghost"
                    onClick={() => disconnect.mutate(p)}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  className="btn"
                  onClick={() => startOAuth(p)}
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Kick off an OAuth flow. Each provider lives at /v1/oauth/:provider/start
 *  (wired up server-side in a follow-up PR). The callback posts the token
 *  to /v1/connections and redirects back. */
function startOAuth(provider: string) {
  const returnTo = encodeURIComponent(window.location.href);
  window.location.href = `/v1/oauth/${provider}/start?returnTo=${returnTo}`;
}
