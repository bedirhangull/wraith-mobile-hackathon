import { ExternalLink, MapPin, Navigation } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { LatLng, Region } from "react-native-maps";

import { useThemeColor } from "heroui-native";

import type { ItineraryActivityKind, ItineraryDay } from "../types";
import {
  openLocationSettings,
  requestForegroundLocation,
  type LocationPermissionStatus,
} from "../services/locationPermissions";

// ─── Local types ──────────────────────────────────────────────────────────────

/**
 * Minimum shape this component needs from an activity.
 * The parent's ResolvedActivity (which extends ItineraryActivity) satisfies
 * this interface via TypeScript structural subtyping.
 */
interface MappableActivity {
  title: string;
  kind: ItineraryActivityKind;
  time?: string;
  placeName?: string;
  latitude?: number;
  longitude?: number;
}

/** ItineraryDay whose activities carry optional lat/lng. */
interface MappableDay extends Omit<ItineraryDay, "activities"> {
  activities: MappableActivity[];
}

interface PlacedMarker {
  key: string;
  coord: LatLng;
  label: string;
  /** 1-based sequential index within the currently-visible activities. */
  index: number;
  dayNumber: number;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TripRouteMapProps {
  days: MappableDay[];
  style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
  locale?: "tr" | "en";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeRegion(coords: LatLng[]): Region | null {
  if (coords.length === 0) return null;
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latPad = Math.max(maxLat - minLat, 0.01) * 0.4;
  const lngPad = Math.max(maxLng - minLng, 0.01) * 0.4;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: maxLat - minLat + latPad * 2,
    longitudeDelta: maxLng - minLng + lngPad * 2,
  };
}

function buildGoogleMapsUrl(coords: LatLng[]): string {
  if (coords.length === 0) return "https://maps.google.com";
  if (coords.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${coords[0].latitude},${coords[0].longitude}`;
  }
  const origin = `${coords[0].latitude},${coords[0].longitude}`;
  const dest = `${coords[coords.length - 1].latitude},${coords[coords.length - 1].longitude}`;
  const waypoints = coords
    .slice(1, -1)
    .map((c) => `${c.latitude},${c.longitude}`)
    .join("|");
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
  if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
  return url;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TripRouteMap({ days, style, locale = "en" }: TripRouteMapProps): JSX.Element {
  const mapRef = useRef<MapView>(null);
  const accentColor = useThemeColor("accent");
  const tr = locale === "tr";

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showUserLocation, setShowUserLocation] = useState(false);
  const [locPermStatus, setLocPermStatus] = useState<LocationPermissionStatus>("undetermined");

  // ── Derived data ─────────────────────────────────────────────────────────────

  const visibleDays = useMemo(
    () => (selectedDay === null ? days : days.filter((d) => d.dayNumber === selectedDay)),
    [days, selectedDay],
  );

  const markers = useMemo<PlacedMarker[]>(() => {
    const result: PlacedMarker[] = [];
    let seq = 0;
    for (const day of visibleDays) {
      for (const activity of day.activities) {
        if (
          activity.latitude == null ||
          activity.longitude == null ||
          !Number.isFinite(activity.latitude) ||
          !Number.isFinite(activity.longitude)
        )
          continue;
        seq += 1;
        result.push({
          key: `${day.dayNumber}-${seq}`,
          coord: { latitude: activity.latitude, longitude: activity.longitude },
          label: activity.placeName ?? activity.title,
          index: seq,
          dayNumber: day.dayNumber,
        });
      }
    }
    return result;
  }, [visibleDays]);

  const polylineCoords = useMemo(() => markers.map((m) => m.coord), [markers]);

  const initialRegion = useMemo<Region>(() => {
    const r = computeRegion(days.flatMap((d) =>
      d.activities
        .filter((a) => a.latitude != null && a.longitude != null)
        .map((a) => ({ latitude: a.latitude!, longitude: a.longitude! })),
    ));
    return (
      r ?? {
        latitude: 41.0082,
        longitude: 28.9784,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      }
    );
    // intentionally computed once from initial days
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleDaySelect = useCallback(
    (day: number | null) => {
      setSelectedDay(day);
      const targetDays = day === null ? days : days.filter((d) => d.dayNumber === day);
      const coords: LatLng[] = targetDays.flatMap((d) =>
        d.activities
          .filter((a) => a.latitude != null && a.longitude != null)
          .map((a) => ({ latitude: a.latitude!, longitude: a.longitude! })),
      );
      const newRegion = computeRegion(coords);
      if (newRegion) {
        // Small delay to let state settle before animating
        setTimeout(() => mapRef.current?.animateToRegion(newRegion, 400), 50);
      }
    },
    [days],
  );

  const handleToggleUserLocation = useCallback(async () => {
    if (showUserLocation) {
      setShowUserLocation(false);
      return;
    }
    const status = await requestForegroundLocation();
    setLocPermStatus(status);
    if (status === "granted") {
      setShowUserLocation(true);
    }
  }, [showUserLocation]);

  const handleOpenInMaps = useCallback(() => {
    void Linking.openURL(buildGoogleMapsUrl(polylineCoords));
  }, [polylineCoords]);

  // ── Empty guard ───────────────────────────────────────────────────────────────

  const hasAnyCoords = days.some((d) =>
    d.activities.some((a) => a.latitude != null && a.longitude != null),
  );

  if (!hasAnyCoords) {
    return (
      <View style={[styles.emptyContainer, style as object]}>
        <MapPin size={40} color={accentColor} strokeWidth={1.5} />
        <Text style={styles.emptyText}>
          {tr ? "Konum bilgisi yükleniyor…" : "Resolving place locations…"}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style as object]}>
      {/* Day filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabContent}
      >
        <Pressable
          onPress={() => handleDaySelect(null)}
          style={[styles.tab, selectedDay === null && { backgroundColor: accentColor }]}
        >
          <Text style={[styles.tabText, selectedDay === null && styles.tabTextActive]}>
            {tr ? "Tümü" : "All"}
          </Text>
        </Pressable>
        {days.map((day) => (
          <Pressable
            key={day.dayNumber}
            onPress={() => handleDaySelect(day.dayNumber)}
            style={[
              styles.tab,
              selectedDay === day.dayNumber && { backgroundColor: accentColor },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                selectedDay === day.dayNumber && styles.tabTextActive,
              ]}
            >
              {tr ? `Gün ${day.dayNumber}` : `Day ${day.dayNumber}`}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Permission denied banner — tapping opens system settings */}
      {(locPermStatus === "settings_required" || locPermStatus === "denied") && (
        <Pressable onPress={openLocationSettings} style={styles.permBanner}>
          <Text style={styles.permBannerText}>
            {tr
              ? "Konum erişimi reddedildi. Ayarları açmak için dokun."
              : "Location access denied. Tap to open Settings."}
          </Text>
        </Pressable>
      )}

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
      >
        {markers.map((marker) => (
          <Marker
            key={marker.key}
            coordinate={marker.coord}
            title={marker.label}
            tracksViewChanges={false}
          >
            {/* Custom numbered pin — inline style for reliable native rendering */}
            <View
              style={[
                styles.markerCircle,
                { backgroundColor: accentColor },
              ]}
            >
              <Text style={styles.markerText}>{marker.index}</Text>
            </View>
          </Marker>
        ))}

        {polylineCoords.length > 1 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={accentColor}
            strokeWidth={2.5}
            lineDashPattern={[10, 5]}
          />
        )}
      </MapView>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={() => void handleToggleUserLocation()}
          style={[
            styles.locationBtn,
            showUserLocation && { backgroundColor: accentColor },
          ]}
        >
          <Navigation
            size={15}
            color={showUserLocation ? "#ffffff" : accentColor}
            strokeWidth={2}
          />
          <Text
            style={[
              styles.locationBtnText,
              showUserLocation && styles.locationBtnTextActive,
            ]}
          >
            {tr ? "Konumum" : "My Location"}
          </Text>
        </Pressable>

        {polylineCoords.length > 0 && (
          <Pressable onPress={handleOpenInMaps} style={[styles.mapsBtn, { backgroundColor: accentColor }]}>
            <ExternalLink size={15} color="#ffffff" strokeWidth={2} />
            <Text style={styles.mapsBtnText}>
              {tr ? "Google Maps'te Aç" : "Open in Google Maps"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  tabScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  tabTextActive: {
    color: "#ffffff",
  },
  permBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  permBannerText: {
    fontSize: 12,
    color: "#92400e",
  },
  map: {
    flex: 1,
  },
  markerCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  markerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  bottomBar: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
  },
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
  },
  locationBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  locationBtnTextActive: {
    color: "#ffffff",
  },
  mapsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  mapsBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
});
