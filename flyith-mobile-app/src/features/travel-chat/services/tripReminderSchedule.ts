import type { ItineraryDay } from "../types";
import { activityStableId } from "./placeResolution";

export type ReminderLeadMinutes = 15 | 30 | 60;

export interface ReminderActivityRef {
  activityId: string;
  dayNumber: number;
  dayDate?: string;
  title: string;
  placeName?: string;
  time?: string;
  fireAt: Date | null;
  reasonDisabled?: "past" | "no_datetime";
}

export function parseActivityDateTime(
  dayDate: string | undefined,
  time: string | undefined
): Date | null {
  if (!dayDate || !time) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) {
    return null;
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayDate.trim());
  if (!dateMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const fireAt = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(fireAt.getTime())) return null;
  return fireAt;
}

export function reminderFireAt(
  dayDate: string | undefined,
  time: string | undefined,
  leadMinutes: ReminderLeadMinutes,
  now = new Date()
): { fireAt: Date | null; reasonDisabled?: "past" | "no_datetime" } {
  const activityAt = parseActivityDateTime(dayDate, time);
  if (!activityAt) return { fireAt: null, reasonDisabled: "no_datetime" };
  const fireAt = new Date(activityAt.getTime() - leadMinutes * 60_000);
  if (fireAt.getTime() <= now.getTime()) {
    return { fireAt: null, reasonDisabled: "past" };
  }
  return { fireAt };
}

export function buildReminderActivityRefs(
  days: ItineraryDay[],
  leadMinutes: ReminderLeadMinutes,
  now = new Date()
): ReminderActivityRef[] {
  return days.flatMap((day) =>
    day.activities.map((activity, index) => {
      const activityId = activityStableId(day, activity, index);
      const { fireAt, reasonDisabled } = reminderFireAt(day.date, activity.time, leadMinutes, now);
      return {
        activityId,
        dayNumber: day.dayNumber,
        dayDate: day.date,
        title: activity.title,
        placeName: activity.placeName,
        time: activity.time,
        fireAt,
        reasonDisabled,
      };
    })
  );
}

export function tripReminderKey(tripId: string, activityId: string): string {
  return `${tripId}::${activityId}`;
}
