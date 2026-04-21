import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Check, Plug } from "lucide-react";
import { api } from "../lib/api";
import type { BotCatalogResponse, Connection } from "../lib/types";

export function BotsPage() {
  const catalog = useQuery({
    queryKey: ["bot-catalog"],
    queryFn: () => api.get<BotCatalogResponse>("/v1/boss/catalog"),
  });
  const connections = useQuery({
    queryKey: ["connections"],
    queryFn: () => api.get<{ connections: Connection[] }>("/v1/connections"),
  });

  const connected = new Set(
    (connections.data?.connections ?? []).map((c) => c.provider)
  );

  const groups = groupByCategory(catalog.data?.bots ?? []);

  return (
    <div className="page">
      <h1>Bots</h1>
      <div className="subtitle">
        Specialist agents. Pick one, connect the account, let it work.
      </div>

      {Object.entries(groups).map(([category, bots]) => (
        <div key={category} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
            {formatCategory(category)}
          </h2>
          <div className="grid grid-cols-3" style={{ marginTop: 8 }}>
            {bots.map((b) => {
              const missing = b.requiredProviders.filter((p) => !connected.has(p));
              const ready = missing.length === 0;
              return (
                <Link key={b.slug} href={`/bots/${b.slug}`}>
                  <a style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="card" style={{ display: "grid", gap: 10, minHeight: 140 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{b.name}</div>
                        {ready ? (
                          <span className="chip" style={{ color: "var(--good)" }}>
                            <Check size={12} /> Ready
                          </span>
                        ) : (
                          <span className="chip" style={{ color: "var(--warn)" }}>
                            <Plug size={12} /> Connect
                          </span>
                        )}
                      </div>
                      <div style={{ color: "var(--muted)" }}>{b.tagline}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{b.revenueProposition}</div>
                    </div>
                  </a>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupByCategory<T extends { category: string }>(items: T[]) {
  const order = ["general", "ecommerce", "trading", "creator"];
  const out: Record<string, T[]> = {};
  for (const cat of order) out[cat] = [];
  for (const it of items) {
    if (!(it.category in out)) out[it.category] = [];
    out[it.category].push(it);
  }
  for (const k of Object.keys(out)) if (out[k].length === 0) delete out[k];
  return out;
}

function formatCategory(raw: string) {
  return raw === "general"
    ? "Generalist"
    : raw.charAt(0).toUpperCase() + raw.slice(1);
}
