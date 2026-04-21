import { useEffect, useState } from "react";
import type { RunSynthesis } from "@shared/history";
import type { MissionDefinition } from "@shared/missions";
import {
  DEFAULT_AUTO_PAUSE_AFTER_FAILURES,
  SCHEDULE_CADENCE_OPTIONS,
  scheduleUsesLocalTime,
  type ScheduleCadence,
} from "@shared/schedules";
import { BriefcaseBusiness, CheckCircle2, Orbit, TriangleAlert } from "lucide-react";

type MissionResult = {
  ok: boolean;
  headline: string;
  narrative: string;
  sections: Array<{
    id: string;
    title: string;
    connectorLabel: string;
    ok: boolean;
    summary: string;
    data?: unknown;
    error?: string;
  }>;
  recommendedNext: string[];
  synthesis?: RunSynthesis;
};

type MissionWorkbenchProps = {
  mission?: (MissionDefinition & { readyConnectorCount: number }) | null;
  result?: MissionResult;
  isRunning?: boolean;
  isScheduling?: boolean;
  onRun: (missionId: string, payload: Record<string, unknown>) => void;
  onCreateSchedule: (input: {
    missionId: string;
    label: string;
    cadence: ScheduleCadence;
    payload: Record<string, unknown>;
    timeOfDay?: string;
    timezone?: string;
    autoPauseAfterFailures: number;
  }) => void;
};

const DEFAULT_SCHEDULE_TIME = "09:00";

function getDefaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function buildInitialValues(mission?: MissionDefinition | null) {
  if (!mission) return {} as Record<string, string>;
  return Object.fromEntries(
    Object.entries(mission.defaultPayload).map(([key, value]) => [key, value === undefined ? "" : String(value)])
  );
}

export function MissionWorkbench({ mission, result, isRunning, isScheduling, onRun, onCreateSchedule }: MissionWorkbenchProps) {
  const [values, setValues] = useState<Record<string, string>>(buildInitialValues(mission));
  const [scheduleLabel, setScheduleLabel] = useState("");
  const [scheduleCadence, setScheduleCadence] = useState<ScheduleCadence>("daily");
  const [scheduleTimeOfDay, setScheduleTimeOfDay] = useState(DEFAULT_SCHEDULE_TIME);
  const [scheduleTimezone, setScheduleTimezone] = useState(getDefaultTimezone());
  const [autoPauseAfterFailures, setAutoPauseAfterFailures] = useState(DEFAULT_AUTO_PAUSE_AFTER_FAILURES);

  useEffect(() => {
    setValues(buildInitialValues(mission));
    setScheduleLabel(mission ? `${mission.title} schedule` : "");
    setScheduleCadence("daily");
    setScheduleTimeOfDay(DEFAULT_SCHEDULE_TIME);
    setScheduleTimezone(getDefaultTimezone());
    setAutoPauseAfterFailures(DEFAULT_AUTO_PAUSE_AFTER_FAILURES);
  }, [mission?.id]);

  if (!mission) return null;

  const buildPayload = () => {
    const payload: Record<string, unknown> = {};
    for (const field of mission.fields) {
      const raw = values[field.key] ?? "";
      if (field.type === "number") {
        if (raw !== "") payload[field.key] = Number(raw);
        continue;
      }
      if (!field.required && raw.trim() === "") continue;
      payload[field.key] = raw;
    }
    return payload;
  };

  const submit = () => {
    const payload = buildPayload();
    onRun(mission.id, payload);
  };

  const createSchedule = () => {
    const payload = buildPayload();
    onCreateSchedule({
      missionId: mission.id,
      label: scheduleLabel.trim(),
      cadence: scheduleCadence,
      payload,
      timeOfDay: scheduleUsesLocalTime(scheduleCadence) ? scheduleTimeOfDay : undefined,
      timezone: scheduleUsesLocalTime(scheduleCadence) ? scheduleTimezone.trim() : undefined,
      autoPauseAfterFailures,
    });
  };

  return (
    <section className="paper-panel grid gap-6 p-5 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-[var(--line)] bg-[var(--orange)] text-[var(--paper)] shadow-[4px_4px_0_0_var(--line)]">
            <BriefcaseBusiness className="h-5 w-5" />
          </div>
          <div>
            <p className="eyebrow">Mission Studio</p>
            <h3 className="font-display text-2xl font-black text-[var(--ink)]">{mission.title}</h3>
          </div>
        </div>

        <p className="text-sm leading-6 text-[var(--muted)]">{mission.description}</p>

        <div className="mt-4 rounded-2xl border border-[var(--line)]/20 bg-[var(--surface-2)] p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">Outcome</p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink)]">{mission.outcome}</p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
            {mission.readyConnectorCount}/{mission.connectorIds.length} required connectors ready
          </p>
        </div>

        {mission.fields.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {mission.fields.map((field) => (
              <div key={field.key} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                <label className="field-label">{field.label}</label>
                {field.type === "textarea" ? (
                  <textarea
                    className="field-input min-h-28 resize-y"
                    placeholder={field.placeholder}
                    value={values[field.key] ?? ""}
                    onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                ) : field.type === "select" ? (
                  <select
                    className="field-input"
                    value={values[field.key] ?? field.options?.[0]?.value ?? ""}
                    onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                  >
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === "number" ? "number" : "text"}
                    className="field-input"
                    placeholder={field.placeholder}
                    value={values[field.key] ?? ""}
                    onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                )}
                {field.description ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{field.description}</p> : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="ink-button" disabled={isRunning || mission.status !== "live"} onClick={submit}>
            {isRunning ? "Running..." : mission.runLabel}
          </button>
          {mission.status !== "live" ? <p className="text-sm font-semibold text-[var(--muted)]">This is a blueprint mission, not a live workflow yet.</p> : null}
        </div>

        {mission.status === "live" ? (
          <div className="mt-6 rounded-2xl border border-[var(--line)]/20 bg-[var(--surface-2)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">Background automation</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Save the current mission inputs as a schedule and Bot Boss will run this workflow in the background and record each outcome into history.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">Schedule label</label>
                <input
                  type="text"
                  className="field-input"
                  placeholder={`${mission.title} schedule`}
                  value={scheduleLabel}
                  onChange={(event) => setScheduleLabel(event.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Cadence</label>
                <select className="field-input" value={scheduleCadence} onChange={(event) => setScheduleCadence(event.target.value as ScheduleCadence)}>
                  {SCHEDULE_CADENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {scheduleUsesLocalTime(scheduleCadence) ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="field-label">Local run time</label>
                  <input
                    type="time"
                    className="field-input"
                    value={scheduleTimeOfDay}
                    onChange={(event) => setScheduleTimeOfDay(event.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label">Timezone</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="America/New_York"
                    value={scheduleTimezone}
                    onChange={(event) => setScheduleTimezone(event.target.value)}
                  />
                </div>
              </div>
            ) : null}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">Failure guardrail</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="field-input"
                  value={autoPauseAfterFailures}
                  onChange={(event) => setAutoPauseAfterFailures(Math.min(10, Math.max(1, Number(event.target.value) || DEFAULT_AUTO_PAUSE_AFTER_FAILURES)))}
                />
              </div>
              <div className="rounded-2xl border border-[var(--line)]/15 bg-[var(--paper)] px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                Bot Boss will automatically pause this schedule after {autoPauseAfterFailures} failed run{autoPauseAfterFailures === 1 ? "" : "s"} in a row.
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="ghost-button" disabled={isScheduling} onClick={createSchedule}>
                {isScheduling ? "Saving..." : "Save schedule"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-[2rem] border-2 border-[var(--line)] bg-[var(--ink)] p-5 text-[var(--paper)] shadow-[8px_8px_0_0_var(--line)]">
        <p className="eyebrow text-[var(--paper)]/70">Mission Output</p>
        <h4 className="mt-2 font-display text-2xl font-black">{result?.headline ?? mission.title}</h4>
        <p className="mt-2 text-sm leading-6 text-[rgba(255,248,238,0.72)]">
          {result?.narrative ?? "Run the mission to see each step, which connector handled it, and what Bot Boss recommends next."}
        </p>

        <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[rgba(255,248,238,0.58)]">Executive Readout</p>
              <p className="mt-1 text-sm leading-6 text-[rgba(255,248,238,0.82)]">
                {result?.synthesis?.executiveSummary ?? "Bot Boss will add an executive readout here. Without OPENAI_API_KEY it falls back to a deterministic operator summary."}
              </p>
            </div>
            {result?.synthesis ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--paper)]">
                {result.synthesis.operatorVerdict}
                <span className="text-[rgba(255,248,238,0.58)]">{result.synthesis.source === "openai" ? result.synthesis.model : "heuristic"}</span>
              </span>
            ) : null}
          </div>
          {result?.synthesis?.nextMoves?.length ? (
            <div className="mt-3 space-y-2">
              {result.synthesis.nextMoves.map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-black/10 p-3 text-sm leading-6 text-[rgba(255,248,238,0.82)]">
                  {item}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-5 space-y-3">
          {(result?.sections ?? []).length > 0 ? (
            result?.sections.map((section) => (
              <div key={section.id} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[rgba(255,248,238,0.58)]">{section.connectorLabel}</p>
                    <p className="mt-1 text-sm font-bold text-[var(--paper)]">{section.title}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--paper)]">
                    {section.ok ? <CheckCircle2 className="h-3 w-3 text-[#89f0bb]" /> : <TriangleAlert className="h-3 w-3 text-[#ffb09a]" />}
                    {section.ok ? "Good" : "Needs attention"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[rgba(255,248,238,0.82)]">{section.summary}</p>
                {section.error ? <p className="mt-2 text-xs font-semibold text-[#ffb09a]">{section.error}</p> : null}
                {section.data ? (
                  <details className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-[rgba(255,248,238,0.8)]">
                    <summary className="cursor-pointer font-bold uppercase tracking-[0.14em] text-[rgba(255,248,238,0.58)]">View structured data</summary>
                    <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words font-mono leading-6">{JSON.stringify(section.data, null, 2)}</pre>
                  </details>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <div className="flex items-start gap-3">
                <Orbit className="mt-0.5 h-4 w-4 text-[rgba(255,248,238,0.58)]" />
                <p className="text-sm leading-6 text-[rgba(255,248,238,0.78)]">No run output yet. This panel becomes the operating trace for the selected mission.</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[rgba(255,248,238,0.58)]">Recommended Next</p>
          <div className="mt-3 space-y-2">
            {(result?.recommendedNext ?? [mission.outcome]).map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-black/10 p-3 text-sm leading-6 text-[rgba(255,248,238,0.82)]">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}