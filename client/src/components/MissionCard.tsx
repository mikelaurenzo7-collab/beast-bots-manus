import type { MissionDefinition } from "@shared/missions";
import { ArrowRight, Orbit, Sparkles } from "lucide-react";

type MissionCardProps = {
  mission: MissionDefinition & { readyConnectorCount: number };
  isRunning?: boolean;
  selected?: boolean;
  onOpen: () => void;
};

export function MissionCard({ mission, isRunning, selected, onOpen }: MissionCardProps) {
  const isLive = mission.status === "live";

  return (
    <article className={`paper-panel relative overflow-hidden p-5 ${selected ? "bg-[rgba(255,249,241,0.98)]" : ""}`}>
      <div className="absolute right-4 top-4 rounded-full border border-[var(--line)]/15 bg-[var(--paper)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">
        {isLive ? "Live" : "Next"}
      </div>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[var(--line)] bg-[var(--ink)] text-[var(--paper)] shadow-[4px_4px_0_0_var(--line)]">
        {isLive ? <Sparkles className="h-5 w-5" /> : <Orbit className="h-5 w-5" />}
      </div>
      <p className="eyebrow">Mission</p>
      <h3 className="font-display text-2xl font-black text-[var(--ink)]">{mission.title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{mission.description}</p>

      <div className="mt-4 rounded-2xl border border-[var(--line)]/20 bg-[var(--surface-2)] p-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Outcome</p>
        <p className="mt-2 text-sm leading-6 text-[var(--ink)]">{mission.outcome}</p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
          {mission.readyConnectorCount}/{mission.connectorIds.length} connectors ready
        </p>
        <button className={selected ? "ink-button text-sm" : "ghost-button text-sm"} disabled={isRunning} onClick={onOpen}>
          {isRunning && selected ? "Running..." : selected ? "Selected" : isLive ? "Open mission" : "Open blueprint"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}