import { Bell, BellOff } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { useThemeColor } from "heroui-native";

import {
  cancelActivityReminder,
  cancelAllTripReminders,
  checkNotificationPermission,
  ensureAndroidChannel,
  listScheduledReminders,
  requestNotificationPermission,
  scheduleActivityReminder,
  type ActivityReminderKey,
  type LeadTimeMinutes,
  type SchedulableActivity,
} from "../services/tripNotifications";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TripRemindersProps {
  tripId: string;
  /**
   * Activities to display. Only those with both `date` and `time` can be
   * scheduled; the rest are silently filtered out. Construct these from
   * ItineraryDay.date + ItineraryActivity.time + indices.
   */
  activities: SchedulableActivity[];
  locale?: "tr" | "en";
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const LEAD_TIME_OPTIONS: LeadTimeMinutes[] = [15, 30, 60];

function activityKey(a: SchedulableActivity): string {
  return `${a.dayNumber}_${a.activityIndex}`;
}

function reminderKeyString(key: ActivityReminderKey): string {
  return `${key.dayNumber}_${key.activityIndex}`;
}

function openAppSettings(): void {
  if (Platform.OS === "ios") {
    void Linking.openURL("app-settings:");
  } else {
    void Linking.openSettings();
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TripReminders({
  tripId,
  activities,
  locale = "en",
}: TripRemindersProps): JSX.Element {
  const accentColor = useThemeColor("accent");
  const tr = locale === "tr";

  // Only activities that have both date and time are schedulable
  const validActivities = useMemo(
    () => activities.filter((a) => Boolean(a.date) && Boolean(a.time)),
    [activities],
  );

  // ── State ─────────────────────────────────────────────────────────────────

  const [isLoading, setIsLoading] = useState(true);
  const [permDenied, setPermDenied] = useState(false);
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [leadMinutes, setLeadMinutes] = useState<LeadTimeMinutes>(30);
  /** Keys (`${dayNumber}_${activityIndex}`) of activities with an active notification. */
  const [scheduledKeys, setScheduledKeys] = useState<Set<string>>(new Set());

  // Track current lead so we can cancel old identifiers on change
  const currentLeadRef = useRef<LeadTimeMinutes>(30);

  // ── Bootstrap: read state from expo-notifications ─────────────────────────

  const loadState = useCallback(async () => {
    setIsLoading(true);
    try {
      const granted = await checkNotificationPermission();
      if (!granted) {
        // Check if we've been permanently denied (no prompt needed yet — just show state)
        setPermDenied(false); // will be updated on first explicit request
      }

      const reminders = await listScheduledReminders(tripId);
      if (reminders.length > 0) {
        const keys = new Set(reminders.map((r) => reminderKeyString(r.key)));
        setScheduledKeys(keys);
        setGlobalEnabled(true);
        const firstLead = reminders[0].leadMinutes;
        setLeadMinutes(firstLead);
        currentLeadRef.current = firstLead;
      } else {
        setScheduledKeys(new Set());
        setGlobalEnabled(false);
      }
    } catch {
      // non-fatal — UI defaults to off
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadState();
    });
    return () => {
      cancelled = true;
    };
  }, [loadState]);

  // ── Global toggle ─────────────────────────────────────────────────────────

  const handleGlobalToggle = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          setPermDenied(true);
          return;
        }
        setPermDenied(false);
        await ensureAndroidChannel();

        const newKeys = new Set<string>();
        for (const activity of validActivities) {
          const key: ActivityReminderKey = {
            tripId,
            dayNumber: activity.dayNumber,
            activityIndex: activity.activityIndex,
          };
          const id = await scheduleActivityReminder(key, activity, leadMinutes);
          if (id) newKeys.add(activityKey(activity));
        }
        setScheduledKeys(newKeys);
        setGlobalEnabled(true);
      } else {
        await cancelAllTripReminders(tripId);
        setScheduledKeys(new Set());
        setGlobalEnabled(false);
      }
    },
    [tripId, validActivities, leadMinutes],
  );

  // ── Lead-time change ──────────────────────────────────────────────────────

  const handleLeadTimeChange = useCallback(
    async (newLead: LeadTimeMinutes) => {
      if (newLead === leadMinutes) return;

      setLeadMinutes(newLead);
      currentLeadRef.current = newLead;

      // If nothing is currently scheduled, just update the preference
      if (!globalEnabled || scheduledKeys.size === 0) return;

      // Cancel all existing (old lead-time identifiers) then reschedule
      await cancelAllTripReminders(tripId);
      const newKeys = new Set<string>();
      for (const activity of validActivities) {
        const aKey = activityKey(activity);
        if (!scheduledKeys.has(aKey)) continue;
        const key: ActivityReminderKey = {
          tripId,
          dayNumber: activity.dayNumber,
          activityIndex: activity.activityIndex,
        };
        const id = await scheduleActivityReminder(key, activity, newLead);
        if (id) newKeys.add(aKey);
      }
      setScheduledKeys(newKeys);
    },
    [tripId, validActivities, scheduledKeys, globalEnabled, leadMinutes],
  );

  // ── Per-activity toggle ───────────────────────────────────────────────────

  const handleActivityToggle = useCallback(
    async (activity: SchedulableActivity, enabled: boolean) => {
      const key: ActivityReminderKey = {
        tripId,
        dayNumber: activity.dayNumber,
        activityIndex: activity.activityIndex,
      };
      const aKey = activityKey(activity);

      if (enabled) {
        const id = await scheduleActivityReminder(key, activity, leadMinutes);
        if (id) {
          setScheduledKeys((prev) => new Set([...prev, aKey]));
        }
      } else {
        await cancelActivityReminder(key, leadMinutes);
        setScheduledKeys((prev) => {
          const next = new Set(prev);
          next.delete(aKey);
          return next;
        });
      }
    },
    [tripId, leadMinutes],
  );

  // ── Render: permission denied ─────────────────────────────────────────────

  if (permDenied) {
    return (
      <View style={styles.centeredState}>
        <BellOff size={40} color={accentColor} strokeWidth={1.5} />
        <Text style={styles.stateTitle}>
          {tr ? "Bildirim İzni Reddedildi" : "Notifications Disabled"}
        </Text>
        <Text style={styles.stateBody}>
          {tr
            ? "Hatırlatıcıları etkinleştirmek için uygulama ayarlarından bildirim iznini açın."
            : "Enable notifications in your device settings to use trip reminders."}
        </Text>
        <Pressable
          style={[styles.settingsBtn, { backgroundColor: accentColor }]}
          onPress={openAppSettings}
        >
          <Text style={styles.settingsBtnText}>{tr ? "Ayarları Aç" : "Open Settings"}</Text>
        </Pressable>
      </View>
    );
  }

  // ── Render: loading ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator color={accentColor} />
      </View>
    );
  }

  // ── Render: no schedulable activities ─────────────────────────────────────

  if (validActivities.length === 0) {
    return (
      <View style={styles.centeredState}>
        <Bell size={32} color={accentColor} strokeWidth={1.5} />
        <Text style={styles.stateBody}>
          {tr
            ? "Planlanabilir etkinlik bulunamadı. Tarihlerin girildiğinden emin olun."
            : "No schedulable activities found. Make sure dates and times are set."}
        </Text>
      </View>
    );
  }

  // ── Render: main UI ───────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Global enable toggle */}
      <View style={styles.globalRow}>
        <View style={styles.globalLabel}>
          <Bell size={18} color={accentColor} strokeWidth={1.5} />
          <Text style={styles.globalLabelText}>
            {tr ? "Hatırlatıcıları Etkinleştir" : "Enable Reminders"}
          </Text>
        </View>
        <Switch
          value={globalEnabled}
          onValueChange={(v) => void handleGlobalToggle(v)}
          trackColor={{ false: "#d1d5db", true: accentColor }}
          thumbColor="#ffffff"
          ios_backgroundColor="#d1d5db"
        />
      </View>

      {/* Lead-time selector — only visible when global is on */}
      {globalEnabled ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>
              {tr ? "NE KADAR ÖNCE?" : "HOW EARLY?"}
            </Text>
            <View style={styles.leadRow}>
              {LEAD_TIME_OPTIONS.map((minutes) => (
                <Pressable
                  key={minutes}
                  onPress={() => void handleLeadTimeChange(minutes)}
                  style={[
                    styles.leadChip,
                    leadMinutes === minutes && { backgroundColor: accentColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.leadChipText,
                      leadMinutes === minutes && styles.leadChipTextActive,
                    ]}
                  >
                    {minutes} {tr ? "dk" : "min"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Per-activity toggles */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>
              {tr ? "ETKİNLİKLER" : "ACTIVITIES"}
            </Text>
            <View style={styles.activityList}>
              {validActivities.map((activity) => {
                const aKey = activityKey(activity);
                const isOn = scheduledKeys.has(aKey);
                return (
                  <View key={aKey} style={styles.activityRow}>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {activity.title}
                      </Text>
                      <Text style={styles.activityMeta}>
                        {tr ? `Gün ${activity.dayNumber}` : `Day ${activity.dayNumber}`}
                        {" · "}
                        {activity.time}
                      </Text>
                    </View>
                    <Switch
                      value={isOn}
                      onValueChange={(v) => void handleActivityToggle(activity, v)}
                      trackColor={{ false: "#d1d5db", true: accentColor }}
                      thumbColor="#ffffff"
                      ios_backgroundColor="#d1d5db"
                    />
                  </View>
                );
              })}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  centeredState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  stateTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
  },
  stateBody: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
  settingsBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    marginTop: 4,
  },
  settingsBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  globalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f3f4f6",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  globalLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  globalLabelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "#9ca3af",
  },
  leadRow: {
    flexDirection: "row",
    gap: 8,
  },
  leadChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  leadChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  leadChipTextActive: {
    color: "#ffffff",
  },
  activityList: {
    gap: 6,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f9fafb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  activityInfo: {
    flex: 1,
    marginRight: 12,
    gap: 2,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  activityMeta: {
    fontSize: 11,
    color: "#9ca3af",
  },
});
