import { useMemo, useState } from "react";
import type { ConnectorId } from "@shared/connectors";
import { Bolt, BriefcaseBusiness, CalendarClock, Orbit, Sparkles, Workflow } from "lucide-react";
import { toast } from "sonner";
import { ActionConsole } from "../components/ActionConsole";
import { ConnectorCard } from "../components/ConnectorCard";
import { MissionCard } from "../components/MissionCard";
import { MissionWorkbench } from "../components/MissionWorkbench";
import { RunHistoryPanel } from "../components/RunHistoryPanel";
import { SchedulePanel } from "../components/SchedulePanel";
import { TopNav } from "../components/TopNav";
import { VaultWorkbench } from "../components/VaultWorkbench";
import { trpc } from "../lib/trpc";

type ProbeMap = Partial<Record<ConnectorId, { ok: boolean; summary: string; error?: string }>>;

export default function Home() {
  const [probeResults, setProbeResults] = useState<ProbeMap>({});
  const [selectedConnectorId, setSelectedConnectorId] = useState<ConnectorId>("github");
  const [selectedMissionId, setSelectedMissionId] = useState("release-radar");
  const [missionResults, setMissionResults] = useState<Record<string, NonNullable<ReturnType<typeof trpc.missions.run.useMutation>["data"]>>>({});
  const utils = trpc.useUtils();

  const productQuery = trpc.product.snapshot.useQuery();
  const connectorsQuery = trpc.connectors.list.useQuery();
  const missionsQuery = trpc.missions.list.useQuery();
  const schedulesQuery = trpc.schedules.list.useQuery();
  const actionsQuery = trpc.actions.list.useQuery();
  const historyQuery = trpc.history.list.useQuery({ limit: 30 });
  const toolsQuery = trpc.runtime.tools.useQuery();

  const probeMutation = trpc.connectors.probe.useMutation({
    onSuccess(result) {
      setProbeResults((current) => ({
        ...current,
        [result.connectorId]: { ok: result.ok, summary: result.summary, error: result.error },
      }));
      if (result.ok) toast.success(result.summary);
      else toast.error(result.summary);
    },
  });

  const missionMutation = trpc.missions.run.useMutation({
    async onSuccess(result, variables) {
      setMissionResults((current) => ({ ...current, [variables.missionId]: result }));
      if (result.ok) toast.success(result.headline);
      else toast.message(result.headline);
      await Promise.all([utils.history.list.invalidate(), utils.product.snapshot.invalidate()]);
    },
  });

  const actionMutation = trpc.actions.run.useMutation({
    async onSuccess(result) {
      if (result.ok) toast.success(result.summary);
      else toast.error(result.summary);
      await Promise.all([utils.history.list.invalidate(), utils.product.snapshot.invalidate()]);
    },
  });

  const saveSecretMutation = trpc.connectors.saveSecret.useMutation({
    async onSuccess(_, variables) {
      toast.success(`Saved ${variables.connectorId} secret to the Bot Boss vault.`);
      await Promise.all([
        utils.connectors.list.invalidate(),
        utils.actions.list.invalidate(),
        utils.missions.list.invalidate(),
        utils.product.snapshot.invalidate(),
      ]);
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const clearSecretMutation = trpc.connectors.clearSecret.useMutation({
    async onSuccess(_, variables) {
      toast.success(`Cleared saved ${variables.connectorId} secret.`);
      await Promise.all([
        utils.connectors.list.invalidate(),
        utils.actions.list.invalidate(),
        utils.missions.list.invalidate(),
        utils.product.snapshot.invalidate(),
      ]);
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const clearHistoryMutation = trpc.history.clear.useMutation({
    async onSuccess() {
      toast.success("Run history cleared.");
      await Promise.all([utils.history.list.invalidate(), utils.product.snapshot.invalidate()]);
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const createScheduleMutation = trpc.schedules.create.useMutation({
    async onSuccess(schedule) {
      toast.success(`Saved schedule: ${schedule.label}`);
      await Promise.all([
        utils.schedules.list.invalidate(),
        utils.product.snapshot.invalidate(),
      ]);
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const toggleScheduleMutation = trpc.schedules.setEnabled.useMutation({
    async onSuccess(schedule) {
      toast.success(schedule?.enabled ? `Resumed ${schedule.label}` : `Paused ${schedule?.label ?? "schedule"}`);
      await Promise.all([
        utils.schedules.list.invalidate(),
        utils.product.snapshot.invalidate(),
      ]);
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const deleteScheduleMutation = trpc.schedules.delete.useMutation({
    async onSuccess() {
      toast.success("Deleted mission schedule.");
      await Promise.all([
        utils.schedules.list.invalidate(),
        utils.product.snapshot.invalidate(),
      ]);
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const runScheduleMutation = trpc.schedules.runNow.useMutation({
    async onSuccess(result) {
      if (result.ok) toast.success(result.headline);
      else toast.message(result.headline);
      await Promise.all([
        utils.schedules.list.invalidate(),
        utils.history.list.invalidate(),
        utils.product.snapshot.invalidate(),
      ]);
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const product = productQuery.data;
  const connectors = connectorsQuery.data ?? [];
  const missions = missionsQuery.data ?? [];
  const schedules = schedulesQuery.data ?? [];
  const actions = actionsQuery.data ?? [];
  const historyEntries = historyQuery.data ?? [];
  const toolNames = toolsQuery.data ?? [];

  const heroStats = useMemo(
    () => ({
      connectors: product?.stats.connectors ?? connectors.length,
      actions: product?.stats.actions ?? actions.length,
      tools: product?.stats.tools ?? toolNames.length,
      configuredConnectorCount: product?.stats.configuredConnectorCount ?? 0,
      historyRuns: product?.stats.historyRuns ?? historyEntries.length,
      vaultEnabled: product?.stats.vaultEnabled ?? false,
      schedules: product?.stats.schedules ?? schedules.length,
      activeSchedules: product?.stats.activeSchedules ?? schedules.filter((schedule) => schedule.enabled).length,
    }),
    [actions.length, connectors.length, historyEntries.length, product, schedules, toolNames.length]
  );

  const selectedConnector = useMemo(
    () => connectors.find((connector) => connector.id === selectedConnectorId) ?? connectors[0],
    [connectors, selectedConnectorId]
  );

  const selectedMission = useMemo(
    () => missions.find((mission) => mission.id === selectedMissionId) ?? missions[0],
    [missions, selectedMissionId]
  );

  const missionResult = selectedMission ? missionResults[selectedMission.id] : undefined;
  const liveMissionCount = product?.stats.liveMissions ?? missions.filter((mission) => mission.status === "live").length;

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <TopNav stats={heroStats} />

      <main>
        <section className="hero-shell">
          <div className="container grid gap-10 pb-16 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pb-24 lg:pt-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)]/20 bg-[var(--paper)] px-4 py-2 shadow-[3px_3px_0_0_var(--line)]">
                <Sparkles className="h-4 w-4 text-[var(--orange)]" />
                <span className="text-xs font-black uppercase tracking-[0.18em] text-[var(--ink)]">
                  Operator-grade workflows for the real tools your team uses
                </span>
              </div>

              <h1 className="mt-6 max-w-4xl font-display text-5xl font-black leading-[0.95] text-[var(--ink)] md:text-7xl">
                One boss bot.
                <br />
                <span className="text-[var(--orange)]">Real connectors.</span>
                <br />
                <span className="text-[var(--blue)]">Actual operating leverage.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)] md:text-xl">
                {product?.marketVerdict ?? "Bot Boss replaces the fake breadth of an agent marketplace with a founder-grade control plane built around real systems and focused missions."}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button className="ink-button" onClick={() => missionMutation.mutate({ missionId: "daily-operator-snapshot" })}>
                  Run Daily Snapshot
                </button>
                <a href="#console" className="ghost-button">
                  Open Action Console
                </a>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Workflow, label: "Mission-first", value: `${liveMissionCount} live boss loops` },
                  { icon: BriefcaseBusiness, label: "Best wedge", value: "Founder control plane" },
                  { icon: CalendarClock, label: "Background ops", value: `${heroStats.activeSchedules} active schedules` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="paper-chip">
                    <Icon className="h-4 w-4 text-[var(--orange)]" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
                      <p className="mt-1 text-sm font-bold text-[var(--ink)]">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="paper-panel relative overflow-hidden p-6 md:p-8">
              <div className="absolute inset-x-0 top-0 h-2 bg-[linear-gradient(90deg,var(--orange),var(--gold),var(--blue))]" />
              <p className="eyebrow">Operator Thesis</p>
              <h2 className="mt-2 font-display text-3xl font-black text-[var(--ink)]">Why teams keep Bot Boss open</h2>
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-[var(--line)]/20 bg-[var(--surface-2)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">Promise</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink)]">{product?.positioning.promise}</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)]/20 bg-[var(--surface-2)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">Audience</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink)]">{product?.positioning.audience}</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)]/20 bg-[var(--ink)] p-4 text-[var(--paper)] shadow-[5px_5px_0_0_var(--line)]">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[rgba(255,248,238,0.68)]">Differentiation</p>
                  <p className="mt-2 text-sm leading-6">{product?.positioning.differentiation}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container pb-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Why this wins",
                body: product?.bestChance,
                icon: Bolt,
                accent: "var(--orange)",
              },
              {
                title: "What is real",
                body: `${heroStats.connectors} curated connectors, ${heroStats.actions} live actions, ${heroStats.tools} registered tools, and ${heroStats.historyRuns} persisted run records.`,
                icon: Orbit,
                accent: "var(--blue)",
              },
              {
                title: "What comes later",
                body: product?.positioning.designDirection,
                icon: Sparkles,
                accent: "var(--green)",
              },
            ].map(({ title, body, icon: Icon, accent }) => (
              <div key={title} className="paper-panel p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-[var(--line)] shadow-[4px_4px_0_0_var(--line)]" style={{ backgroundColor: `${accent}22` }}>
                  <Icon className="h-5 w-5" style={{ color: accent }} />
                </div>
                <h3 className="mt-4 font-display text-2xl font-black text-[var(--ink)]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="connectors" className="container py-12">
          <div className="section-head">
            <div>
              <p className="eyebrow">Connectors</p>
              <h2 className="font-display text-4xl font-black text-[var(--ink)]">The small set that actually matters</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[var(--muted)]">
              Every connector here exists because it helps Bot Boss see, decide, or push work. Nothing is here to pad a catalog.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {connectors.map((connector) => (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                probeResult={probeResults[connector.id]}
                selected={selectedConnector?.id === connector.id}
                isRunning={probeMutation.isPending && probeMutation.variables?.connectorId === connector.id}
                onProbe={() => probeMutation.mutate({ connectorId: connector.id })}
                onManage={() => setSelectedConnectorId(connector.id)}
              />
            ))}
          </div>

          <div className="mt-8">
            <VaultWorkbench
              connectors={connectors}
              selectedConnectorId={(selectedConnector?.id ?? "github") as ConnectorId}
              onSelect={(connectorId) => setSelectedConnectorId(connectorId)}
              onSave={(connectorId, token) => saveSecretMutation.mutate({ connectorId, token })}
              onClear={(connectorId) => clearSecretMutation.mutate({ connectorId })}
              savingConnectorId={saveSecretMutation.variables?.connectorId as ConnectorId | undefined}
              clearingConnectorId={clearSecretMutation.variables?.connectorId as ConnectorId | undefined}
            />
          </div>
        </section>

        <section id="missions" className="container py-12">
          <div className="section-head">
            <div>
              <p className="eyebrow">Missions</p>
              <h2 className="font-display text-4xl font-black text-[var(--ink)]">Sell workflows, not shelves</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[var(--muted)]">
              The winner here is not a crowded marketplace. It is a short list of operating loops that founders run every day.
            </p>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {missions.map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                selected={selectedMission?.id === mission.id}
                isRunning={missionMutation.isPending && missionMutation.variables?.missionId === mission.id}
                onOpen={() => setSelectedMissionId(mission.id)}
              />
            ))}
          </div>

          <div className="mt-8">
            <MissionWorkbench
              mission={selectedMission}
              result={missionResult}
              isRunning={missionMutation.isPending && missionMutation.variables?.missionId === selectedMission?.id}
              isScheduling={createScheduleMutation.isPending}
              onRun={(missionId, payload) => missionMutation.mutate({ missionId, payload })}
              onCreateSchedule={(input) => createScheduleMutation.mutate(input)}
            />
          </div>
        </section>

        <section className="container py-12">
          <SchedulePanel
            schedules={schedules}
            selectedMissionId={selectedMission?.id}
            togglingId={toggleScheduleMutation.variables?.scheduleId}
            deletingId={deleteScheduleMutation.variables?.scheduleId}
            runningId={runScheduleMutation.variables?.scheduleId}
            onToggle={(scheduleId, enabled) => toggleScheduleMutation.mutate({ scheduleId, enabled })}
            onDelete={(scheduleId) => deleteScheduleMutation.mutate({ scheduleId })}
            onRunNow={(scheduleId) => runScheduleMutation.mutate({ scheduleId })}
          />
        </section>

        <section id="console" className="container py-12">
          <ActionConsole actions={actions} isRunning={actionMutation.isPending} result={actionMutation.data} onRun={(actionId, payload) => actionMutation.mutate({ actionId, payload })} />
        </section>

        <section className="container py-12">
          <RunHistoryPanel entries={historyEntries} isClearing={clearHistoryMutation.isPending} onClear={() => clearHistoryMutation.mutate()} />
        </section>
      </main>
    </div>
  );
}