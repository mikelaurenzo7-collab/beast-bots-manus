import { listDueMissionSchedules, markMissionScheduleRun } from "./stateStore";
import { executeMissionRun } from "../missionRunner";

const TICK_MS = 30_000;

let intervalHandle: NodeJS.Timeout | null = null;
const inFlightScheduleIds = new Set<string>();

export async function processDueMissionSchedules(now = new Date()) {
  const dueSchedules = await listDueMissionSchedules(now);
  let processed = 0;

  for (const schedule of dueSchedules) {
    if (inFlightScheduleIds.has(schedule.id)) continue;
    inFlightScheduleIds.add(schedule.id);
    try {
      await executeMissionRun(schedule.missionId, schedule.payload, {
        kind: "schedule",
        scheduleId: schedule.id,
        scheduleLabel: schedule.label,
      });
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[scheduler] failed schedule ${schedule.id}`, error);
      await markMissionScheduleRun(schedule.id, { ok: false, summary: message });
    } finally {
      inFlightScheduleIds.delete(schedule.id);
    }
  }

  return processed;
}

export function startMissionScheduler() {
  if (intervalHandle) return intervalHandle;
  void processDueMissionSchedules();
  intervalHandle = setInterval(() => {
    void processDueMissionSchedules();
  }, TICK_MS);
  intervalHandle.unref?.();
  return intervalHandle;
}

export function stopMissionScheduler() {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
}