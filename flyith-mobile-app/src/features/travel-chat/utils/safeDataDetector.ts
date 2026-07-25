export type DetectionType = "phoneNumber" | "link" | "email" | "address" | "date";

export interface DetectedEntity {
  type: DetectionType;
  text: string;
  start: number;
  end: number;
  data?: Record<string, string>;
}

export type NativeDataDetector = {
  prepareModel: (options?: { language?: string }) => Promise<boolean>;
  useDetectedEntities: (
    text: string,
    options?: {
      debounceMs?: number;
      types?: DetectionType[];
      language?: string;
      enabled?: boolean;
      autoPrepare?: boolean;
    }
  ) => { entities: DetectedEntity[]; isDetecting: boolean };
};

let native: NativeDataDetector | null = null;

try {
  // Throws when the native binary wasn't rebuilt with this module (Expo Go / stale dev client).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  native = require("react-native-data-detector") as NativeDataDetector;
} catch {
  native = null;
}

export const isNativeDataDetectorAvailable = native !== null;

export function getNativeDataDetector(): NativeDataDetector | null {
  return native;
}

export async function prepareModelSafe(language: "tr" | "en" = "en"): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.prepareModel({ language });
  } catch {
    return false;
  }
}

const URL_RE = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Loose international phone: +90 555 123 4567, (212) 555-0123, etc.
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4})?/g;

function pushMatches(
  text: string,
  regex: RegExp,
  type: DetectionType,
  dataKey: string,
  into: DetectedEntity[],
  occupied: boolean[]
): void {
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const value = match[0];
    // Skip short phone false-positives (years, prices, etc.)
    if (type === "phoneNumber") {
      const digits = value.replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 15) continue;
    }
    const start = match.index;
    const end = start + value.length;
    let overlaps = false;
    for (let i = start; i < end; i += 1) {
      if (occupied[i]) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;
    for (let i = start; i < end; i += 1) occupied[i] = true;
    into.push({
      type,
      text: value,
      start,
      end,
      data: { [dataKey]: value },
    });
  }
}

/** JS fallback when the native data-detector module isn't linked yet. */
export function detectJs(text: string): DetectedEntity[] {
  if (!text) return [];
  const occupied = Array.from({ length: text.length }, () => false);
  const entities: DetectedEntity[] = [];
  // Prefer structured contacts over loose phone matches.
  pushMatches(text, URL_RE, "link", "url", entities, occupied);
  pushMatches(text, EMAIL_RE, "email", "email", entities, occupied);
  pushMatches(text, PHONE_RE, "phoneNumber", "phoneNumber", entities, occupied);
  return entities.sort((a, b) => a.start - b.start);
}
