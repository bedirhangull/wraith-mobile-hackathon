import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ─── Public types ─────────────────────────────────────────────────────────────

export type LeadTimeMinutes = 15 | 30 | 60;

/** Uniquely identifies one activity within a trip for notification keying. */
export interface ActivityReminderKey {
  tripId: string;
  dayNumber: number;
  activityIndex: number;
}

/**
 * A scheduled reminder as reconstructed from expo-notifications.
 * No local persistence is needed — the scheduled-notification list is the
 * source of truth and survives screen reopens automatically.
 */
export interface ScheduledReminder {
  key: ActivityReminderKey;
  /** expo-notifications identifier, built from the stable key formula. */
  notificationId: string;
  leadMinutes: LeadTimeMinutes;
  /** The *activity* start time (not the notification trigger). */
  scheduledFor: Date;
}

/**
 * Minimum activity info needed to schedule a local reminder.
 * The parent constructs this from ItineraryDay.date + ItineraryActivity.time.
 */
export interface SchedulableActivity {
  dayNumber: number;
  activityIndex: number;
  title: string;
  /** ISO date string — YYYY-MM-DD — from ItineraryDay.date. */
  date: string;
  /** HH:MM time string from ItineraryActivity.time (e.g. "09:30"). */
  time: string;
}

// ─── Internal constants ───────────────────────────────────────────────────────

const CHANNEL_ID = "flyith_trip_reminders";
const ID_PREFIX = "flyith_reminder";
const VALID_LEADS: ReadonlyArray<LeadTimeMinutes> = [15, 30, 60];

// ─── Identifier encoding / decoding ──────────────────────────────────────────

/**
 * Stable notification identifier formula:
 *   flyith_reminder_{tripId}_day{N}_act{I}_{lead}m
 *
 * tripId may contain underscores, so the regex anchors the suffix.
 */
function buildId(key: ActivityReminderKey, lead: LeadTimeMinutes): string {
  return `${ID_PREFIX}_${key.tripId}_day${key.dayNumber}_act${key.activityIndex}_${lead}m`;
}

function parseId(id: string): { key: ActivityReminderKey; leadMinutes: LeadTimeMinutes } | null {
  const m = id.match(/^flyith_reminder_(.+)_day(\d+)_act(\d+)_(\d+)m$/);
  if (!m) return null;
  const lead = Number(m[4]) as LeadTimeMinutes;
  if (!VALID_LEADS.includes(lead)) return null;
  return {
    key: { tripId: m[1], dayNumber: Number(m[2]), activityIndex: Number(m[3]) },
    leadMinutes: lead,
  };
}

// ─── Permission ───────────────────────────────────────────────────────────────

/**
 * Request local notification permission, prompting the user if needed.
 * Returns `true` when permission is granted (or was already granted).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  const { status: next } = await Notifications.requestPermissionsAsync();
  return next === "granted";
}

/** Check current permission without prompting. */
export async function checkNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

// ─── Android channel ─────────────────────────────────────────────────────────

/**
 * Create (or silently update) the Android notification channel for trip
 * reminders. Safe to call multiple times — Android deduplicates by channel id.
 * No-op on iOS.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Trip Reminders",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#6366F1",
  });
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Compute the notification trigger time (activity time − lead minutes).
 * Returns `null` if the result is not in the future or the inputs are invalid.
 */
function buildTriggerDate(
  dateStr: string,
  timeStr: string,
  lead: LeadTimeMinutes,
): Date | null {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  if ([y, mo, d, h, min].some((n) => !Number.isFinite(n))) return null;
  const activityMs = new Date(y, mo - 1, d, h, min, 0, 0).getTime();
  const triggerMs = activityMs - lead * 60_000;
  if (triggerMs <= Date.now()) return null;
  return new Date(triggerMs);
}

// ─── Schedule / cancel ───────────────────────────────────────────────────────

/**
 * Schedule a local notification for `activity` at `leadMinutes` before its
 * start time. Returns the notification identifier on success, or `null` when:
 * - the computed trigger is not in the future, or
 * - notification permission is missing.
 *
 * Cancels any pre-existing notification with the same key before scheduling,
 * making this operation idempotent.
 */
export async function scheduleActivityReminder(
  key: ActivityReminderKey,
  activity: SchedulableActivity,
  leadMinutes: LeadTimeMinutes,
): Promise<string | null> {
  const triggerDate = buildTriggerDate(activity.date, activity.time, leadMinutes);
  if (!triggerDate) return null;
  if (!(await checkNotificationPermission())) return null;

  await ensureAndroidChannel();

  const identifier = buildId(key, leadMinutes);
  // Idempotent — cancel before rescheduling
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: activity.title,
      body: `Starting in ${leadMinutes} minutes`,
      // Store activity start time in data so listScheduledReminders can
      // reconstruct ScheduledReminder.scheduledFor without parsing the trigger.
      data: {
        tripId: key.tripId,
        dayNumber: key.dayNumber,
        activityIndex: key.activityIndex,
        leadMinutes,
        activityStartMs: triggerDate.getTime() + leadMinutes * 60_000,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  return identifier;
}

/**
 * Cancel the scheduled notification for a specific activity + lead time pair.
 * Silently no-ops if the notification does not exist.
 */
export async function cancelActivityReminder(
  key: ActivityReminderKey,
  leadMinutes: LeadTimeMinutes,
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(buildId(key, leadMinutes)).catch(
    () => undefined,
  );
}

/**
 * Cancel ALL scheduled trip reminders for `tripId` (across all lead times
 * and all activities). Use when the user disables reminders globally.
 */
export async function cancelAllTripReminders(tripId: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => parseId(n.identifier)?.key.tripId === tripId)
      .map((n) =>
        Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined),
      ),
  );
}

// ─── List / reconcile ────────────────────────────────────────────────────────

/**
 * Returns all currently-scheduled reminders for `tripId` by reading from
 * expo-notifications. No local state is needed — this list survives screen
 * reopens automatically, making it the persistent source of truth.
 */
export async function listScheduledReminders(tripId: string): Promise<ScheduledReminder[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const results: ScheduledReminder[] = [];

  for (const n of all) {
    const parsed = parseId(n.identifier);
    if (!parsed || parsed.key.tripId !== tripId) continue;
    // activityStartMs was stored in data at schedule time
    const activityStartMs = n.content.data?.activityStartMs as number | undefined;
    if (!activityStartMs) continue;
    results.push({
      key: parsed.key,
      notificationId: n.identifier,
      leadMinutes: parsed.leadMinutes,
      scheduledFor: new Date(activityStartMs),
    });
  }

  return results;
}

/**
 * Reconcile scheduled notifications so they exactly match `activities` at the
 * given `leadMinutes`:
 * - Cancels notifications that are no longer in the desired set.
 * - Schedules any missing notifications.
 *
 * Skips activities whose computed trigger is not in the future.
 */
export async function reconcileReminders(
  tripId: string,
  activities: SchedulableActivity[],
  leadMinutes: LeadTimeMinutes,
): Promise<void> {
  const existing = await listScheduledReminders(tripId);
  const existingIds = new Set(existing.map((r) => r.notificationId));

  // Build desired identifier → { key, activity } map
  const desired = new Map<string, { key: ActivityReminderKey; activity: SchedulableActivity }>();
  for (const activity of activities) {
    const key: ActivityReminderKey = {
      tripId,
      dayNumber: activity.dayNumber,
      activityIndex: activity.activityIndex,
    };
    desired.set(buildId(key, leadMinutes), { key, activity });
  }

  // Cancel notifications no longer desired
  await Promise.all(
    [...existingIds]
      .filter((id) => !desired.has(id))
      .map((id) =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
      ),
  );

  // Schedule missing notifications (sequential to respect permission + channel setup)
  for (const [id, { key, activity }] of desired) {
    if (!existingIds.has(id)) {
      await scheduleActivityReminder(key, activity, leadMinutes);
    }
  }
}
