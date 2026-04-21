import type { MissionSchedule } from "@shared/schedules";
import { getScheduleGuardrailLabel, getScheduleTimingSummary } from "@shared/schedules";
import { CalendarClock, Play, Power, Trash2 } from "lucide-react";

type SchedulePanelProps = {
  schedules: MissionSchedule[];
  selectedMissionId?: string;
  togglingId?: string;
  deletingId?: string;
  runningId?: string;
  onToggle: (scheduleId: string, enabled: boolean) => void;
  onDelete: (scheduleId: string) => void;
  onRunNow: (scheduleId: string) => void;
};

function formatWhen(value?: string) {
  return value ? new Date(value).toLocaleString() : "Not yet";
}

export function SchedulePanel({
  schedules,
  selectedMissionId,
  togglingId,
  deletingId,
  runningId,
  onToggle,
  onDelete,
  onRunNow,
}: SchedulePanelProps) {
  return (
    <section id="schedules" className="paper-panel p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-[var(--line)] bg-[var(--gold)] text-[var(--ink)] shadow-[4px_4px_0_0_var(--line)]">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <p className="eyebrow">Schedules</p>
              <h3 className="font-display text-2xl font-black text-[var(--ink)]">Background mission runs</h3>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Save a schedule from the mission studio and Bot Boss will run that workflow in the background, write the outcome into history, and keep the next run window moving automatically.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {schedules.length === 0 ? (
          <div className="rounded-2xl border border-[var(--line)]/20 bg-[var(--surface-2)] p-5 text-sm leading-6 text-[var(--muted)]">
            No schedules yet. Pick a live mission, fill the fields, and save a schedule from the mission studio.
          </div>
        ) : (
          schedules.map((schedule) => (
            <article
              key={schedule.id}
              className={`rounded-[1.75rem] border-2 border-[var(--line)] bg-[var(--surface)] p-5 shadow-[6px_6px_0_0_var(--line)] ${selectedMissionId === schedule.missionId ? "bg-[rgba(255,249,241,0.98)]" : ""}`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--line)]/15 bg-[var(--paper)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                      {schedule.enabled ? "active" : "paused"}
                    </span>
                    <span className="rounded-full border border-[var(--line)]/15 bg-[var(--paper)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                      {getScheduleTimingSummary(schedule)}
                    </span>
                    {schedule.lastRunStatus ? (
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${schedule.lastRunStatus === "success" ? "border-[rgba(21,119,90,0.2)] bg-[rgba(21,119,90,0.08)] text-[var(--green)]" : "border-[rgba(239,106,61,0.2)] bg-[rgba(239,106,61,0.08)] text-[var(--orange)]"}`}>
                        {schedule.lastRunStatus}
                      </span>
                    ) : null}
                    {schedule.pausedReason === "failure-threshold" ? (
                      <span className="rounded-full border border-[rgba(239,106,61,0.2)] bg-[rgba(239,106,61,0.08)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--orange)]">
                        auto-paused
                      </span>
                    ) : null}
                    {schedule.consecutiveFailures > 0 ? (
                      <span className="rounded-full border border-[var(--line)]/15 bg-[var(--paper)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                        {schedule.consecutiveFailures} failed in a row
                      </span>
                    ) : null}
                  </div>
                  <h4 className="mt-3 font-display text-2xl font-black text-[var(--ink)]">{schedule.label}</h4>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{schedule.missionTitle}</p>
                  {schedule.lastRunSummary ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Last result: {schedule.lastRunSummary}</p> : null}
                </div>

                <div className="rounded-2xl border border-[var(--line)]/15 bg-[var(--paper)] px-4 py-3 text-sm text-[var(--muted)]">
                  <p className="font-semibold text-[var(--ink)]">Guardrail</p>
                  <p className="mt-1">{getScheduleGuardrailLabel(schedule.autoPauseAfterFailures)}</p>
                  <p className="mt-3 font-semibold text-[var(--ink)]">Timing</p>
                  <p className="mt-1">{getScheduleTimingSummary(schedule)}</p>
                  <p className="mt-3 font-semibold text-[var(--ink)]">Next run</p>
                  <p className="mt-1">{formatWhen(schedule.nextRunAt)}</p>
                  <p className="mt-3 font-semibold text-[var(--ink)]">Last run</p>
                  <p className="mt-1">{formatWhen(schedule.lastRunAt)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {schedule.connectorIds.map((connectorId) => (
                  <span key={connectorId} className="rounded-full border border-[var(--line)]/15 bg-[var(--paper)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                    {connectorId}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button className="ghost-button text-sm" disabled={togglingId === schedule.id} onClick={() => onToggle(schedule.id, !schedule.enabled)}>
                  {togglingId === schedule.id ? "Saving..." : schedule.enabled ? "Pause" : "Resume"}
                  <Power className="h-4 w-4" />
                </button>
                <button className="ink-button text-sm" disabled={runningId === schedule.id} onClick={() => onRunNow(schedule.id)}>
                  {runningId === schedule.id ? "Running..." : "Run now"}
                  <Play className="h-4 w-4" />
                </button>
                <button className="ghost-button text-sm" disabled={deletingId === schedule.id} onClick={() => onDelete(schedule.id)}>
                  {deletingId === schedule.id ? "Deleting..." : "Delete"}
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <details className="mt-4 rounded-2xl border border-[var(--line)]/15 bg-[var(--paper)] p-4 text-sm text-[var(--muted)]">
                <summary className="cursor-pointer font-semibold text-[var(--ink)]">View scheduled payload</summary>
                <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[var(--line)]/10 bg-[var(--surface-2)] p-3 font-mono text-xs leading-6 text-[var(--ink)]">
                  {JSON.stringify(schedule.payload, null, 2)}
                </pre>
              </details>
            </article>
          ))
        )}
      </div>
    </section>
  );
}