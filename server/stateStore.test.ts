import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  calculateNextRunAt,
  clearConnectorSecret,
  clearRunHistory,
  createMissionSchedule,
  deleteMissionSchedule,
  listMissionSchedules,
  listRunHistory,
  markMissionScheduleRun,
  recordRun,
  resolveConnectorTokens,
  saveConnectorSecret,
  setMissionScheduleEnabled,
} from "./_core/stateStore";

let tempDir = "";

describe("state store", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bot-boss-store-"));
    process.env.BOT_BOSS_DATA_DIR = tempDir;
    process.env.BOT_BOSS_VAULT_KEY = "x".repeat(32);
  });

  afterEach(async () => {
    delete process.env.BOT_BOSS_DATA_DIR;
    delete process.env.BOT_BOSS_VAULT_KEY;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("saves and resolves encrypted connector tokens", async () => {
    await saveConnectorSecret("github", "ghp_secret_1234");

    const resolved = await resolveConnectorTokens({
      github: undefined,
      slack: undefined,
      notion: undefined,
      linear: undefined,
    });

    expect(resolved.github).toBe("ghp_secret_1234");

    await clearConnectorSecret("github");
    const cleared = await resolveConnectorTokens({
      github: undefined,
      slack: undefined,
      notion: undefined,
      linear: undefined,
    });
    expect(cleared.github).toBeUndefined();
  });

  it("records and clears run history", async () => {
    await recordRun({
      kind: "mission",
      targetId: "release-radar",
      targetLabel: "Release Radar",
      ok: true,
      summary: "Posted release radar",
      narrative: "Mission completed successfully.",
      durationMs: 120,
      connectorIds: ["github", "slack", "linear"],
      payload: { owner: "acme", repo: "core-app" },
      sections: [
        {
          title: "Slack brief",
          connectorId: "slack",
          connectorLabel: "Slack",
          ok: true,
          summary: "Posted to #launch-war-room",
        },
      ],
    });

    const history = await listRunHistory({ limit: 10 });
    expect(history).toHaveLength(1);
    expect(history[0]?.targetLabel).toBe("Release Radar");

    await clearRunHistory();
    const cleared = await listRunHistory({ limit: 10 });
    expect(cleared).toHaveLength(0);
  });

  it("creates, updates, and deletes mission schedules", async () => {
    const created = await createMissionSchedule(
      {
        missionId: "release-radar",
        missionTitle: "Release Radar",
        label: "Launch war room",
        cadence: "hourly",
        payload: { owner: "acme", repo: "core-app", slackChannel: "#launch-war-room" },
        connectorIds: ["github", "linear", "slack"],
      },
      { now: new Date("2026-04-21T08:00:00.000Z") }
    );

    expect(created.nextRunAt).toBe(calculateNextRunAt("hourly", new Date("2026-04-21T08:00:00.000Z")));

    const paused = await setMissionScheduleEnabled(created.id, false, { now: new Date("2026-04-21T08:10:00.000Z") });
    expect(paused?.enabled).toBe(false);

    const resumed = await setMissionScheduleEnabled(created.id, true, { now: new Date("2026-04-21T09:00:00.000Z") });
    expect(resumed?.enabled).toBe(true);
    expect(resumed?.nextRunAt).toBe(calculateNextRunAt("hourly", new Date("2026-04-21T09:00:00.000Z")));

    const marked = await markMissionScheduleRun(created.id, { ok: true, summary: "Posted release brief" }, { now: new Date("2026-04-21T10:00:00.000Z") });
    expect(marked?.lastRunStatus).toBe("success");
    expect(marked?.lastRunSummary).toBe("Posted release brief");

    const schedules = await listMissionSchedules();
    expect(schedules).toHaveLength(1);

    await deleteMissionSchedule(created.id);
    const clearedSchedules = await listMissionSchedules();
    expect(clearedSchedules).toHaveLength(0);
  });

  it("supports local-time schedules and auto-pauses after repeated failures", async () => {
    const created = await createMissionSchedule(
      {
        missionId: "release-radar",
        missionTitle: "Release Radar",
        label: "Weekday launch pulse",
        cadence: "weekdays-at-time",
        timeOfDay: "09:30",
        timezone: "UTC",
        autoPauseAfterFailures: 2,
        payload: { owner: "acme", repo: "core-app", slackChannel: "#launch-war-room" },
        connectorIds: ["github", "linear", "slack"],
      },
      { now: new Date("2026-04-24T10:00:00.000Z") }
    );

    expect(created.nextRunAt).toBe(
      calculateNextRunAt(
        { cadence: "weekdays-at-time", timeOfDay: "09:30", timezone: "UTC" },
        new Date("2026-04-24T10:00:00.000Z")
      )
    );

    const firstFailure = await markMissionScheduleRun(
      created.id,
      { ok: false, summary: "Slack delivery failed" },
      { now: new Date("2026-04-27T09:30:00.000Z") }
    );
    expect(firstFailure?.enabled).toBe(true);
    expect(firstFailure?.consecutiveFailures).toBe(1);
    expect(firstFailure?.pausedReason).toBeUndefined();

    const secondFailure = await markMissionScheduleRun(
      created.id,
      { ok: false, summary: "Slack delivery failed again" },
      { now: new Date("2026-04-28T09:30:00.000Z") }
    );
    expect(secondFailure?.enabled).toBe(false);
    expect(secondFailure?.consecutiveFailures).toBe(2);
    expect(secondFailure?.pausedReason).toBe("failure-threshold");

    const resumed = await setMissionScheduleEnabled(created.id, true, { now: new Date("2026-04-28T12:00:00.000Z") });
    expect(resumed?.enabled).toBe(true);
    expect(resumed?.consecutiveFailures).toBe(0);
    expect(resumed?.pausedReason).toBeUndefined();
  });
});