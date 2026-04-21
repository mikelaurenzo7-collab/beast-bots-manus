import { DateTime } from "luxon";
import {
  DEFAULT_AUTO_PAUSE_AFTER_FAILURES,
  SCHEDULE_TIME_PATTERN,
  scheduleUsesLocalTime,
  type MissionSchedule,
  type ScheduleCadence,
} from "../../shared/schedules";

type ScheduleTimingInput = Pick<MissionSchedule, "cadence" | "timeOfDay" | "timezone">;

const CADENCE_MS: Record<Exclude<ScheduleCadence, "daily-at-time" | "weekdays-at-time">, number> = {
  "every-15-minutes": 15 * 60 * 1000,
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

function parseTimeOfDay(timeOfDay?: string) {
  if (!timeOfDay || !SCHEDULE_TIME_PATTERN.test(timeOfDay)) {
    throw new Error("Timed schedules require a time in HH:mm format.");
  }

  const [hour, minute] = timeOfDay.split(":").map(Number);
  return { hour, minute };
}

export function normalizeAutoPauseAfterFailures(value?: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_AUTO_PAUSE_AFTER_FAILURES;
  }

  return Math.min(10, Math.max(1, Math.trunc(value ?? DEFAULT_AUTO_PAUSE_AFTER_FAILURES)));
}

export function validateScheduleTiming(input: ScheduleTimingInput) {
  if (!scheduleUsesLocalTime(input.cadence)) {
    return;
  }

  parseTimeOfDay(input.timeOfDay);

  const timezone = input.timezone?.trim();
  if (!timezone) {
    throw new Error("Timed schedules require a timezone.");
  }

  const zonedNow = DateTime.now().setZone(timezone);
  if (!zonedNow.isValid) {
    throw new Error(`Unsupported timezone: ${timezone}`);
  }
}

export function calculateNextRunAt(input: ScheduleTimingInput, from = new Date()) {
  if (!scheduleUsesLocalTime(input.cadence)) {
    return new Date(from.getTime() + CADENCE_MS[input.cadence]).toISOString();
  }

  validateScheduleTiming(input);

  const { hour, minute } = parseTimeOfDay(input.timeOfDay);
  const timezone = input.timezone!.trim();
  const base = DateTime.fromJSDate(from, { zone: timezone });

  let next = base.set({ hour, minute, second: 0, millisecond: 0 });
  if (next <= base) {
    next = next.plus({ days: 1 });
  }

  if (input.cadence === "weekdays-at-time") {
    while (next.weekday > 5) {
      next = next.plus({ days: 1 }).set({ hour, minute, second: 0, millisecond: 0 });
    }
  }

  return next.toUTC().toISO({ suppressMilliseconds: false }) ?? next.toUTC().toJSDate().toISOString();
}