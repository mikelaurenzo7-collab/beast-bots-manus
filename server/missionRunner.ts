import { ENV } from "./_core/env";
import { markMissionScheduleRun, recordRun, resolveConnectorTokens } from "./_core/stateStore";
import { getMissionById } from "../shared/missions";
import { runMissionWithTokens } from "./runtime/orchestrator";

export type MissionRunSource =
  | { kind: "manual" }
  | { kind: "schedule"; scheduleId: string; scheduleLabel: string };

export async function executeMissionRun(
  missionId: string,
  payload: Record<string, unknown>,
  source: MissionRunSource = { kind: "manual" }
) {
  const mission = getMissionById(missionId);
  if (!mission) {
    throw new Error(`Unknown mission: ${missionId}`);
  }

  const startedAt = Date.now();
  const tokens = await resolveConnectorTokens(ENV.connectorTokens);
  const result = await runMissionWithTokens(missionId, payload, tokens);

  await recordRun({
    kind: "mission",
    targetId: mission.id,
    targetLabel: source.kind === "schedule" ? source.scheduleLabel : mission.title,
    ok: result.ok,
    summary: result.headline,
    narrative: source.kind === "schedule" ? `${mission.title}. ${result.narrative}` : result.narrative,
    error: result.sections.find((section) => !section.ok)?.error,
    durationMs: Date.now() - startedAt,
    connectorIds: mission.connectorIds,
    payload,
    synthesis: result.synthesis,
    sections: result.sections.map((section) => ({
      title: section.title,
      connectorId: section.connectorId,
      connectorLabel: section.connectorLabel,
      ok: section.ok,
      summary: section.summary,
      error: section.error,
    })),
  });

  if (source.kind === "schedule") {
    await markMissionScheduleRun(source.scheduleId, {
      ok: result.ok,
      summary: result.headline,
    });
  }

  return result;
}