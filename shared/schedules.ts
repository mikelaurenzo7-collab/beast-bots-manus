import type { ConnectorId } from "./connectors";

export const SCHEDULE_CADENCE_VALUES = [
  "every-15-minutes",
  "hourly",
  "daily",
  "daily-at-time",
  "weekdays-at-time",
] as const;

export const LOCAL_TIME_SCHEDULE_CADENCE_VALUES = ["daily-at-time", "weekdays-at-time"] as const;

export const DEFAULT_AUTO_PAUSE_AFTER_FAILURES = 3;

export const SCHEDULE_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type ScheduleCadence = (typeof SCHEDULE_CADENCE_VALUES)[number];

export type SchedulePauseReason = "manual" | "failure-threshold";

export type MissionSchedule = {
  id: string;
  missionId: string;
  missionTitle: string;
  label: string;
  cadence: ScheduleCadence;
  enabled: boolean;
  payload: Record<string, unknown>;
  connectorIds: ConnectorId[];
  timeOfDay?: string;
  timezone?: string;
  consecutiveFailures: number;
  autoPauseAfterFailures: number;
  pausedReason?: SchedulePauseReason;
  createdAt: string;
  updatedAt: string;
  nextRunAt: string;
  lastRunAt?: string;
  lastRunStatus?: "success" | "error";
  lastRunSummary?: string;
};

export const SCHEDULE_CADENCE_OPTIONS: Array<{ label: string; value: ScheduleCadence }> = [
  { label: "Every 15 minutes", value: "every-15-minutes" },
  { label: "Hourly", value: "hourly" },
  { label: "Every 24 hours", value: "daily" },
  { label: "Daily at local time", value: "daily-at-time" },
  { label: "Weekdays at local time", value: "weekdays-at-time" },
];

export function getScheduleCadenceLabel(cadence: ScheduleCadence) {
  return SCHEDULE_CADENCE_OPTIONS.find((option) => option.value === cadence)?.label ?? cadence;
}

export function scheduleUsesLocalTime(cadence: ScheduleCadence) {
  return cadence === "daily-at-time" || cadence === "weekdays-at-time";
}

export function getScheduleTimingSummary(schedule: Pick<MissionSchedule, "cadence" | "timeOfDay" | "timezone">) {
  const label = getScheduleCadenceLabel(schedule.cadence);
  if (!scheduleUsesLocalTime(schedule.cadence)) {
    return label;
  }

  return `${label}${schedule.timeOfDay ? ` at ${schedule.timeOfDay}` : ""}${schedule.timezone ? ` · ${schedule.timezone}` : ""}`;
}

export function getScheduleGuardrailLabel(autoPauseAfterFailures: number) {
  return `Auto-pause after ${autoPauseAfterFailures} failed run${autoPauseAfterFailures === 1 ? "" : "s"}`;
}