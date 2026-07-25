import * as Location from "expo-location";
import { Linking, Platform } from "react-native";

// ─── Public types ─────────────────────────────────────────────────────────────

export type LocationPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  /** System-level denial — can only be resolved by opening app Settings. */
  | "settings_required";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapExpoStatus(
  status: Location.PermissionStatus,
  canAskAgain: boolean,
): LocationPermissionStatus {
  if (status === Location.PermissionStatus.GRANTED) return "granted";
  if (status === Location.PermissionStatus.DENIED && !canAskAgain) return "settings_required";
  if (status === Location.PermissionStatus.DENIED) return "denied";
  return "undetermined";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check the current foreground location permission status without prompting
 * the user. Safe to call as often as needed.
 */
export async function checkForegroundLocationPermission(): Promise<LocationPermissionStatus> {
  const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
  return mapExpoStatus(status, canAskAgain);
}

/**
 * Request foreground-only location permission (never background).
 * - Returns "granted" immediately if permission is already granted.
 * - Returns "settings_required" if the OS will no longer show a prompt;
 *   call `openLocationSettings()` to guide the user.
 * - Only the foreground permission is requested — the component that shows
 *   the user's dot should set `showsUserLocation` on the MapView only when
 *   this resolves to "granted".
 */
export async function requestForegroundLocation(): Promise<LocationPermissionStatus> {
  const current = await checkForegroundLocationPermission();
  if (current === "granted" || current === "settings_required") return current;

  const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
  return mapExpoStatus(status, canAskAgain);
}

/**
 * Open the app's system settings page so the user can manually enable
 * location access. Call after receiving a `settings_required` status.
 */
export function openLocationSettings(): void {
  if (Platform.OS === "ios") {
    void Linking.openURL("app-settings:");
  } else {
    void Linking.openSettings();
  }
}
