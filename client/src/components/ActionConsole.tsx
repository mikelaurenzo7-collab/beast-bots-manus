import { useEffect, useMemo, useState } from "react";
import type { ActionDefinition } from "@shared/actions";
import { Terminal, TriangleAlert } from "lucide-react";

type ActionResult = {
  ok: boolean;
  summary: string;
  error?: string;
  data?: unknown;
};

type ActionConsoleProps = {
  actions: Array<ActionDefinition & { configured: boolean }>;
  isRunning?: boolean;
  result?: ActionResult | null;
  onRun: (actionId: string, payload: Record<string, unknown>) => void;
};

function buildInitialValues(action?: ActionDefinition) {
  if (!action) return {} as Record<string, string>;
  return Object.fromEntries(
    Object.entries(action.defaultPayload).map(([key, value]) => [key, value === undefined ? "" : String(value)])
  );
}

export function ActionConsole({ actions, isRunning, result, onRun }: ActionConsoleProps) {
  const [selectedActionId, setSelectedActionId] = useState(actions[0]?.id ?? "");
  const selectedAction = useMemo(
    () => actions.find((action) => action.id === selectedActionId) ?? actions[0],
    [actions, selectedActionId]
  );
  const [values, setValues] = useState<Record<string, string>>(buildInitialValues(selectedAction));

  useEffect(() => {
    setValues(buildInitialValues(selectedAction));
  }, [selectedAction]);

  const submit = () => {
    if (!selectedAction) return;

    const payload: Record<string, unknown> = {};
    for (const field of selectedAction.fields) {
      const raw = values[field.key] ?? "";
      if (field.type === "number") {
        if (raw !== "") payload[field.key] = Number(raw);
        continue;
      }

      if (!field.required && raw.trim() === "") continue;
      payload[field.key] = raw;
    }

    onRun(selectedAction.id, payload);
  };

  return (
    <section className="paper-panel grid gap-6 p-5 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-[var(--line)] bg-[var(--blue)] text-[var(--paper)] shadow-[4px_4px_0_0_var(--line)]">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <p className="eyebrow">Live Console</p>
            <h3 className="font-display text-2xl font-black text-[var(--ink)]">Action Console</h3>
          </div>
        </div>

        <p className="mb-5 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          This is the core product behavior: a single operator surface with a small number of real, high-value actions.
          Read first, then write with intent.
        </p>

        <label className="field-label">Action</label>
        <select
          className="field-input mb-4"
          value={selectedAction?.id ?? ""}
          onChange={(event) => setSelectedActionId(event.target.value)}
        >
          {actions.map((action) => (
            <option key={action.id} value={action.id}>
              {action.label} {action.configured ? "" : "• needs token"}
            </option>
          ))}
        </select>

        {selectedAction ? (
          <>
            <div className="mb-4 rounded-2xl border border-[var(--line)]/20 bg-[var(--surface-2)] p-4">
              <p className="text-sm font-bold text-[var(--ink)]">{selectedAction.description}</p>
              {selectedAction.caution ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--orange)]/20 bg-[rgba(239,106,61,0.08)] p-3 text-xs text-[var(--muted)]">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--orange)]" />
                  <p>{selectedAction.caution}</p>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {selectedAction.fields.map((field) => (
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
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button className="ink-button" disabled={isRunning || !selectedAction.configured} onClick={submit}>
                {isRunning ? "Running..." : "Run action"}
              </button>
              {!selectedAction.configured ? <p className="text-sm font-semibold text-[var(--orange)]">Activate this connector in the vault workbench or provide its boot env token.</p> : null}
            </div>
          </>
        ) : null}
      </div>

      <div className="rounded-[2rem] border-2 border-[var(--line)] bg-[var(--ink)] p-5 text-[var(--paper)] shadow-[8px_8px_0_0_var(--line)]">
        <p className="eyebrow text-[var(--paper)]/70">Latest Result</p>
        <h4 className="mt-2 font-display text-2xl font-black">Console Output</h4>
        <p className="mt-2 text-sm leading-6 text-[rgba(255,248,238,0.72)]">
          The result surface is intentionally plain. Fancy chrome is irrelevant if the system cannot prove it touched a real API.
        </p>

        <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[rgba(255,248,238,0.58)]">Summary</p>
          <p className="mt-2 text-sm leading-6">{result?.summary ?? "Run an action to inspect a live connector."}</p>
          {result?.error ? <p className="mt-3 text-xs font-semibold text-[#ffb09a]">{result.error}</p> : null}
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[rgba(255,248,238,0.58)]">Structured Data</p>
          <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-[rgba(255,248,238,0.84)]">
            {result?.data ? JSON.stringify(result.data, null, 2) : "No payload yet."}
          </pre>
        </div>
      </div>
    </section>
  );
}