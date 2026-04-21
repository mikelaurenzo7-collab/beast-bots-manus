import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { BotCatalogResponse, Connection } from "../lib/types";

const PROVIDERS: Record<string, { label: string; kind: "oauth" | "shop-oauth" | "api-key" }> = {
  shopify: { label: "Shopify", kind: "shop-oauth" },
  etsy: { label: "Etsy", kind: "oauth" },
  pinterest: { label: "Pinterest", kind: "oauth" },
  kalshi: { label: "Kalshi", kind: "api-key" },
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
        Bring your own tokens. Stored encrypted with AES-256-GCM; disconnect
        any time.
      </div>

      <div className="grid" style={{ gap: 10 }}>
        {Array.from(required).map((p) => (
          <ConnectionRow
            key={p}
            provider={p}
            connection={connected.get(p) ?? null}
            onDisconnect={() => disconnect.mutate(p)}
            onConnected={() => qc.invalidateQueries({ queryKey: ["connections"] })}
          />
        ))}
      </div>
    </div>
  );
}

function ConnectionRow(props: {
  provider: string;
  connection: Connection | null;
  onDisconnect: () => void;
  onConnected: () => void;
}) {
  const { provider, connection } = props;
  const cfg = PROVIDERS[provider] ?? { label: provider, kind: "oauth" as const };

  return (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontWeight: 700, flex: 1 }}>{cfg.label}</div>
        {connection ? (
          <>
            <span className="chip" style={{ color: "var(--good)" }}>
              <span className="dot good" />
              {connection.accountName ?? "Connected"}
            </span>
            <button className="btn ghost" onClick={props.onDisconnect}>
              Disconnect
            </button>
          </>
        ) : null}
      </div>
      {!connection && cfg.kind === "shop-oauth" && (
        <ShopifyConnect onConnected={props.onConnected} />
      )}
      {!connection && cfg.kind === "oauth" && (
        <StandardOAuthConnect provider={provider} />
      )}
      {!connection && cfg.kind === "api-key" && <KalshiConnect onConnected={props.onConnected} />}
    </div>
  );
}

function StandardOAuthConnect({ provider }: { provider: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { authorizeUrl } = await api.post<{ authorizeUrl: string }>(
        `/v1/oauth/${provider}/start`,
        { returnTo: window.location.href }
      );
      window.location.href = authorizeUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn" onClick={start} disabled={busy}>
        {busy ? "Connecting…" : "Connect"}
      </button>
      {error && <div style={{ color: "var(--bad)", marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function ShopifyConnect({ onConnected: _ }: { onConnected: () => void }) {
  const [shop, setShop] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const normalized = shop.trim().toLowerCase().replace(/^https?:\/\//, "");
      const { authorizeUrl } = await api.post<{ authorizeUrl: string }>(
        "/v1/oauth/shopify/start",
        { shop: normalized, returnTo: window.location.href }
      );
      window.location.href = authorizeUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        placeholder="your-store.myshopify.com"
        value={shop}
        onChange={(e) => setShop(e.target.value)}
        style={{
          flex: 1,
          padding: "8px 12px",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          color: "var(--text)",
        }}
      />
      <button className="btn" onClick={start} disabled={busy || !shop}>
        {busy ? "Connecting…" : "Connect"}
      </button>
      {error && <div style={{ color: "var(--bad)" }}>{error}</div>}
    </div>
  );
}

function KalshiConnect(props: { onConnected: () => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/v1/oauth/kalshi/connect", { apiKey: key });
      props.onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        type="password"
        placeholder="Kalshi API key"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        style={{
          flex: 1,
          padding: "8px 12px",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          color: "var(--text)",
        }}
      />
      <button className="btn" onClick={submit} disabled={busy || key.length < 10}>
        {busy ? "Validating…" : "Save"}
      </button>
      {error && <div style={{ color: "var(--bad)" }}>{error}</div>}
    </div>
  );
}
