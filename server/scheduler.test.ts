import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMissionSchedule, listMissionSchedules, listRunHistory, saveConnectorSecret } from "./_core/stateStore";
import { processDueMissionSchedules } from "./_core/scheduler";

let tempDir = "";

describe("scheduler", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bot-boss-scheduler-"));
    process.env.BOT_BOSS_DATA_DIR = tempDir;
    process.env.BOT_BOSS_VAULT_KEY = "x".repeat(32);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    delete process.env.BOT_BOSS_DATA_DIR;
    delete process.env.BOT_BOSS_VAULT_KEY;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("processes due mission schedules and records history", async () => {
    await saveConnectorSecret("github", "ghp_test_1234");
    await createMissionSchedule(
      {
        missionId: "daily-operator-snapshot",
        missionTitle: "Daily Operator Snapshot",
        label: "Morning founder snapshot",
        cadence: "hourly",
        payload: {},
        connectorIds: ["github", "slack", "notion", "linear"],
      },
      { now: new Date(Date.now() - 2 * 60 * 60 * 1000) }
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("api.github.com/user/repos")) {
          return new Response(
            JSON.stringify([{ full_name: "acme/core", description: "Core", stargazers_count: 4, private: false }]),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const processed = await processDueMissionSchedules(new Date());
    expect(processed).toBe(1);

    const history = await listRunHistory({ limit: 10 });
    expect(history[0]?.targetLabel).toBe("Morning founder snapshot");

    const schedules = await listMissionSchedules();
    expect(schedules[0]?.lastRunStatus).toBe("success");
  });
});