import { useMemo, useState } from "react";
import type { RunHistoryEntry, RunKind } from "@shared/history";
import { Clock3, History, Trash2 } from "lucide-react";

type RunHistoryPanelProps = {
  entries: RunHistoryEntry[];
  isClearing?: boolean;
  onClear: () => void;
};

const FILTERS: Array<{ label: string; value: RunKind | "all" }> = [
  { label: "All", value: "all" },
  { label: "Missions", value: "mission" },
  { label: "Actions", value: "action" },
];

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export function RunHistoryPanel({ entries, isClearing, onClear }: RunHistoryPanelProps) {
  const [filter, setFilter] = useState<RunKind | "all">("all");

  const filtered = useMemo(
    () => (filter === "all" ? entries : entries.filter((entry) => entry.kind === filter)),
    [entries, filter]
  );

  return (
    <section id="history" className="paper-panel p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-[var(--line)] bg-[var(--blue)] text-[var(--paper)] shadow-[4px_4px_0_0_var(--line)]">
              <History className="h-5 w-5" />
            </div>
            <div>
              <p className="eyebrow">Run History</p>
              <h3 className="font-display text-2xl font-black text-[var(--ink)]">Audit trail</h3>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Every action and mission run through the app is recorded here with outcome, timing, payload, and step summaries. This is the beginning of operational trust.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              className={filter === option.value ? "ink-button text-sm" : "ghost-button text-sm"}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
          <button className="ghost-button text-sm" onClick={onClear} disabled={isClearing || entries.length === 0}>
            {isClearing ? "Clearing..." : "Clear history"}
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[var(--line)]/20 bg-[var(--surface-2)] p-5 text-sm leading-6 text-[var(--muted)]">
            No runs yet for this filter. Use the mission studio or action console to create the first audit record.
          </div>
        ) : (
          filtered.map((entry) => (
            <article key={entry.id} className="rounded-[1.75rem] border-2 border-[var(--line)] bg-[var(--surface)] p-5 shadow-[6px_6px_0_0_var(--line)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--line)]/15 bg-[var(--paper)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                      {entry.kind}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${entry.ok ? "border-[rgba(21,119,90,0.2)] bg-[rgba(21,119,90,0.08)] text-[var(--green)]" : "border-[rgba(239,106,61,0.2)] bg-[rgba(239,106,61,0.08)] text-[var(--orange)]"}`}>
                      {entry.ok ? "Success" : "Needs attention"}
                    </span>
                  </div>
                  <h4 className="mt-3 font-display text-2xl font-black text-[var(--ink)]">{entry.targetLabel}</h4>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{entry.summary}</p>
                  {entry.narrative ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{entry.narrative}</p> : null}
                </div>

                <div className="rounded-2xl border border-[var(--line)]/15 bg-[var(--paper)] px-4 py-3 text-sm text-[var(--muted)]">
                  <div className="flex items-center gap-2 font-semibold text-[var(--ink)]">
                    <Clock3 className="h-4 w-4" />
                    {entry.durationMs}ms
                  </div>
                  <p className="mt-1">{formatTimestamp(entry.createdAt)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {entry.connectorIds.map((connectorId) => (
                  <span key={connectorId} className="rounded-full border border-[var(--line)]/15 bg-[var(--paper)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                    {connectorId}
                  </span>
                ))}
                {entry.synthesis ? (
                  <span className="rounded-full border border-[var(--line)]/15 bg-[var(--paper)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                    {entry.synthesis.operatorVerdict} · {entry.synthesis.source === "openai" ? entry.synthesis.model : "heuristic"}
                  </span>
                ) : null}
              </div>

              <details className="mt-4 rounded-2xl border border-[var(--line)]/15 bg-[var(--paper)] p-4 text-sm text-[var(--muted)]">
                <summary className="cursor-pointer font-semibold text-[var(--ink)]">View payload and step trace</summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Payload</p>
                    <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[var(--line)]/10 bg-[var(--surface-2)] p-3 font-mono text-xs leading-6 text-[var(--ink)]">
                      {JSON.stringify(entry.payload, null, 2)}
                    </pre>
                    {entry.synthesis ? (
                      <div className="mt-4 rounded-xl border border-[var(--line)]/10 bg-[var(--surface-2)] p-3">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Executive Readout</p>
                        <p className="mt-2 leading-6 text-[var(--ink)]">{entry.synthesis.executiveSummary}</p>
                        <div className="mt-3 space-y-2">
                          {entry.synthesis.nextMoves.map((item) => (
                            <div key={item} className="rounded-lg border border-[var(--line)]/10 bg-[var(--paper)] p-3 text-sm leading-6 text-[var(--muted)]">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">Sections</p>
                    <div className="mt-2 space-y-2">
                      {entry.sections.map((section, index) => (
                        <div key={`${entry.id}-${index}`} className="rounded-xl border border-[var(--line)]/10 bg-[var(--surface-2)] p-3">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">{section.connectorLabel}</p>
                          <p className="mt-1 font-semibold text-[var(--ink)]">{section.title}</p>
                          <p className="mt-1 leading-6">{section.summary}</p>
                          {section.error ? <p className="mt-1 text-xs font-semibold text-[var(--orange)]">{section.error}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            </article>
          ))
        )}
      </div>
    </section>
  );
}