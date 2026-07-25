import type { ImageSourcePropType } from "react-native";

import { LOCAL_TRIP_IMAGES } from "../assets/localTripImages.generated";

/**
 * Folder-name aliases → canonical keys used in the generated asset map.
 * Covers Turkish spellings and known typos in the asset tree.
 */
const ALIASES: Record<string, string> = {
  amsterdam: "amsterdam",
  seul: "seul",
  seoul: "seul",
  moskova: "moskova",
  moscow: "moskova",
  florance: "florance",
  florence: "florance",
  stolkholm: "stolkholm",
  stockholm: "stolkholm",
  "nevsehir-kayseri": "nevsehir-kayseri",
  cappadocia: "nevsehir-kayseri",
  kapadokya: "nevsehir-kayseri",
  isvec: "isvec",
  sweden: "isvec",
  londra: "londra",
  london: "londra",
  england: "londra",
  fransa: "fransa",
  france: "fransa",
  paris: "paris",
  arabistan: "arabistan",
  "saudi-arabia": "arabistan",
  saudi: "arabistan",
  portugez: "portugez",
  portugal: "portugez",
  lisbon: "lisbon",
  lisboa: "lisbon",
  italy: "italia",
  italia: "italia",
  rome: "rome",
  roma: "rome",
  japanese: "japanese",
  japan: "japanese",
  tokyo: "tokyo",
  korean: "korean",
  korea: "korean",
  "south-korea": "korean",
  turkey: "turkey",
  turkiye: "turkey",
  istanbul: "istanbul",
  netherlands: "netherlands",
  holland: "netherlands",
  germany: "germany",
  berlin: "berlin",
  spain: "spain",
  barcelona: "barcelona",
  madrid: "madrid",
  russia: "russia",
  denmark: "denmark",
  copenhagen: "copenhagen",
  norvec: "norvec",
  norway: "norvec",
  oslo: "oslo",
  hostel: "buildings",
  otel: "buildings",
  hotel: "buildings",
};

function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveKey(destination: string): string | undefined {
  const raw = normalize(destination);
  if (!raw) return undefined;
  if (ALIASES[raw]) return ALIASES[raw];
  if (LOCAL_TRIP_IMAGES[raw]) return raw;

  // Try last token ("Amsterdam, Netherlands" → amsterdam)
  const parts = raw.split("-").filter(Boolean);
  for (let i = parts.length; i >= 1; i -= 1) {
    const slice = parts.slice(0, i).join("-");
    if (ALIASES[slice]) return ALIASES[slice];
    if (LOCAL_TRIP_IMAGES[slice]) return slice;
  }
  for (const part of parts) {
    if (ALIASES[part]) return ALIASES[part];
    if (LOCAL_TRIP_IMAGES[part]) return part;
  }
  return undefined;
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Pick a local trip image for a destination, or undefined if none match. */
export function findLocalTripImage(
  destination: string | undefined,
  seed = "0"
): ImageSourcePropType | undefined {
  if (!destination) return undefined;
  const key = resolveKey(destination);
  if (!key) return undefined;
  const list = LOCAL_TRIP_IMAGES[key];
  if (!list || list.length === 0) return undefined;
  return list[hashSeed(`${key}:${seed}`) % list.length];
}

export function hasLocalTripImages(destination: string | undefined): boolean {
  if (!destination) return false;
  const key = resolveKey(destination);
  return Boolean(key && LOCAL_TRIP_IMAGES[key]?.length);
}
