import { Button, Card, Typography, useThemeColor } from "heroui-native";
import { Phone, RefreshCw } from "lucide-react-native";
import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";

import {
  resolveItineraryPlaces,
  type ResolvedActivity,
} from "../services/resolveItineraryPlaces";
import type { ItineraryDay, PlaceOption, TripBrief } from "../types";

type Locale = "tr" | "en";

interface TripContactDirectoryProps {
  brief: TripBrief;
  days: ItineraryDay[];
  locale?: Locale;
}

interface DirectoryEntry {
  key: string;
  name: string;
  phone?: string;
  dayNumber: number;
  time?: string;
}

function collectKnownPlaces(brief: TripBrief): PlaceOption[] {
  const fromBrief = brief.shownPlaceOptions ?? [];
  const fromDayPlan = Object.values(brief.dayPlanSelections ?? {}).filter(
    Boolean
  ) as PlaceOption[];
  const byKey = new Map<string, PlaceOption>();
  for (const place of [...fromBrief, ...fromDayPlan]) {
    byKey.set(place.id || place.name.trim().toLowerCase(), place);
  }
  return [...byKey.values()];
}

export function TripContactDirectory({
  brief,
  days,
  locale = "en",
}: TripContactDirectoryProps): JSX.Element {
  const tr = locale === "tr";
  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");

  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const knownPlaces = useMemo(() => collectKnownPlaces(brief), [brief]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const flat = days.flatMap((day) =>
        day.activities
          .filter((activity) => Boolean(activity.placeName?.trim()))
          .map((activity) => ({ day, activity }))
      );

      const resolved = await resolveItineraryPlaces(
        flat.map(({ activity }) => activity),
        knownPlaces,
        { destination: brief.destination }
      );

      const next: DirectoryEntry[] = resolved.map((activity: ResolvedActivity, index) => {
        const day = flat[index]?.day;
        return {
          key: `${day?.dayNumber ?? index}-${activity.placeName ?? activity.title}-${index}`,
          name: activity.placeName ?? activity.title,
          phone: activity.phone,
          dayNumber: day?.dayNumber ?? index + 1,
          time: activity.time,
        };
      });

      // De-dupe by place name so the directory stays a clean phone list.
      const byName = new Map<string, DirectoryEntry>();
      for (const entry of next) {
        const key = entry.name.trim().toLowerCase();
        const existing = byName.get(key);
        if (!existing || (!existing.phone && entry.phone)) {
          byName.set(key, entry);
        }
      }
      setEntries([...byName.values()]);
    } catch {
      setError(tr ? "Rehber yüklenemedi." : "Couldn’t load the directory.");
    } finally {
      setLoading(false);
    }
  }, [brief.destination, days, knownPlaces, tr]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const call = useCallback((phone: string) => {
    const cleaned = phone.replace(/[^\d+]/g, "");
    if (!cleaned) return;
    void Linking.openURL(`tel:${cleaned}`);
  }, []);

  if (loading) {
    return (
      <View className="items-center justify-center gap-2 py-10">
        <ActivityIndicator color={accent} />
        <Typography.Paragraph className="text-sm text-muted">
          {tr ? "Telefon numaraları getiriliyor…" : "Fetching phone numbers…"}
        </Typography.Paragraph>
      </View>
    );
  }

  if (error) {
    return (
      <Card variant="secondary">
        <Card.Body className="gap-3">
          <Typography.Paragraph className="text-sm text-danger">{error}</Typography.Paragraph>
          <Button variant="secondary" onPress={() => void load()}>
            {tr ? "Tekrar dene" : "Retry"}
          </Button>
        </Card.Body>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Typography.Paragraph className="text-sm text-muted">
        {tr
          ? "Listelenecek mekan henüz yok."
          : "No places to list yet."}
      </Typography.Paragraph>
    );
  }

  return (
    <View className="gap-3">
      <Typography.Paragraph className="text-sm text-muted">
        {tr
          ? "Plandaki mekanların telefon numaraları."
          : "Phone numbers for places in your plan."}
      </Typography.Paragraph>

      {entries.map((entry) => (
        <Card key={entry.key} variant="secondary">
          <Card.Body className="gap-2">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                <Card.Title numberOfLines={2}>{entry.name}</Card.Title>
                <Card.Description>
                  {tr ? `Gün ${entry.dayNumber}` : `Day ${entry.dayNumber}`}
                  {entry.time ? ` · ${entry.time}` : ""}
                </Card.Description>
              </View>
              <Pressable
                disabled={!entry.phone}
                onPress={() => entry.phone && call(entry.phone)}
                className={`flex-row items-center gap-1.5 rounded-full px-3 py-2 ${
                  entry.phone ? "bg-accent/10" : "bg-surface-secondary opacity-60"
                }`}
              >
                <Phone size={14} color={entry.phone ? accent : muted} />
                <Typography.Paragraph className="text-xs font-semibold text-foreground">
                  {tr ? "Ara" : "Call"}
                </Typography.Paragraph>
              </Pressable>
            </View>

            {entry.phone ? (
              <Typography.Paragraph className="text-sm font-medium text-foreground">
                {entry.phone}
              </Typography.Paragraph>
            ) : (
              <Typography.Paragraph className="text-xs text-muted">
                {tr ? "Telefon bulunamadı" : "Phone not found"}
              </Typography.Paragraph>
            )}
          </Card.Body>
        </Card>
      ))}

      <Pressable
        onPress={() => void load()}
        className="flex-row items-center justify-center gap-2 rounded-full bg-surface-secondary py-3"
      >
        <RefreshCw size={14} color={muted} />
        <Typography.Paragraph className="text-xs font-semibold text-muted">
          {tr ? "Yenile" : "Refresh"}
        </Typography.Paragraph>
      </Pressable>
    </View>
  );
}
