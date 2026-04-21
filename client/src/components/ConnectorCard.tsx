import type { ConnectorWithStatus } from "@shared/connectors";
import { ArrowUpRight, CheckCircle2, FolderKey, PlugZap, ShieldAlert } from "lucide-react";

type ProbeResult = {
  ok: boolean;
  summary: string;
  error?: string;
};

type ConnectorCardProps = {
  connector: ConnectorWithStatus;
  probeResult?: ProbeResult;
  isRunning?: boolean;
  selected?: boolean;
  onProbe: () => void;
  onManage: () => void;
};

function getSourceLabel(connector: ConnectorWithStatus) {
  if (connector.vaultLocked) return "Vault locked";
  if (connector.source === "vault") return "Vault";
  if (connector.source === "env") return "Boot env";
  return "Needs token";
}

export function ConnectorCard({ connector, probeResult, isRunning, selected, onProbe, onManage }: ConnectorCardProps) {
  const statusLabel = connector.configured ? "Live" : connector.vaultLocked ? "Locked" : "Needs token";
  const sourceLabel = getSourceLabel(connector);

  return (
    <article className={`paper-panel flex h-full flex-col gap-4 p-5 ${selected ? "bg-[rgba(255,249,241,0.98)]" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{connector.category}</p>
          <h3 className="font-display text-2xl font-black text-[var(--ink)]">{connector.label}</h3>
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{connector.tagline}</p>
        </div>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[var(--line)] text-[var(--ink)] shadow-[4px_4px_0_0_var(--line)]"
          style={{ backgroundColor: `${connector.accentColor}22` }}
        >
          <PlugZap className="h-5 w-5" />
        </div>
      </div>

      <p className="text-sm leading-6 text-[var(--muted)]">{connector.description}</p>

      <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
        <span className="rounded-full border border-[var(--line)]/15 bg-[var(--paper)] px-2.5 py-1">{sourceLabel}</span>
        {connector.maskedToken ? <span className="rounded-full border border-[var(--line)]/15 bg-[var(--paper)] px-2.5 py-1">{connector.maskedToken}</span> : null}
      </div>

      <div className="rounded-2xl border border-[var(--line)]/20 bg-[var(--surface-2)] p-3 text-sm text-[var(--muted)]">
        <p className="font-semibold text-[var(--ink)]">Why this stays in the first build</p>
        <p className="mt-1 leading-6">{connector.whyItMatters}</p>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)]/20 bg-[var(--paper)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink)]">
          {connector.configured ? <CheckCircle2 className="h-3.5 w-3.5 text-[var(--green)]" /> : <ShieldAlert className="h-3.5 w-3.5 text-[var(--orange)]" />}
          {statusLabel}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="ghost-button text-sm" onClick={onManage}>
            {selected ? "Selected" : "Manage"}
            <FolderKey className="h-4 w-4" />
          </button>
          <button className="ink-button text-sm" onClick={onProbe} disabled={isRunning || !connector.configured}>
            {isRunning ? "Probing..." : "Probe"}
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)]/20 bg-[var(--paper)] p-3 text-sm">
        <p className="font-semibold text-[var(--ink)]">Latest</p>
        <p className="mt-1 leading-6 text-[var(--muted)]">
          {probeResult?.summary ?? (connector.vaultLocked
            ? `Vault data exists, but Bot Boss cannot decrypt it until BOT_BOSS_VAULT_KEY is available at boot.`
            : `Use the in-app vault or ${connector.tokenEnv} to activate this connector.`)}
        </p>
        {probeResult?.error ? <p className="mt-2 text-xs font-semibold text-[var(--orange)]">{probeResult.error}</p> : null}
      </div>
    </article>
  );
}