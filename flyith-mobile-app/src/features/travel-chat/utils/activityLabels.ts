import type { OrbState } from "expo-thinking-orbs";

import type { ActivityKind } from "../types";

type Locale = "tr" | "en";

// Several phrases per activity so the indicator reads like real progress
// instead of a single static "Thinking".
const PHRASES: Record<ActivityKind, Record<Locale, string[]>> = {
  thinking: {
    tr: ["Düşünüyorum"],
    en: ["Thinking"],
  },
  flights: {
    tr: ["Uçuşları arıyorum", "Fiyatları karşılaştırıyorum", "En iyi bağlantıları buluyorum"],
    en: ["Searching flights", "Comparing fares", "Finding the best connections"],
  },
  flexible_dates: {
    tr: ["Tarihleri tarıyorum", "Ay boyunca fiyatlara bakıyorum", "En uygun günleri buluyorum"],
    en: ["Scanning dates", "Pricing the whole month", "Finding the cheapest days"],
  },
  hotels: {
    tr: ["Otellere bakıyorum", "Konaklama seçeneklerini süzüyorum", "Puanları karşılaştırıyorum"],
    en: ["Looking for hotels", "Filtering stays", "Comparing ratings"],
  },
  destinations: {
    tr: ["Rotalara bakıyorum", "İlham topluyorum", "Uygun şehirleri buluyorum"],
    en: ["Exploring destinations", "Gathering inspiration", "Finding reachable cities"],
  },
  restaurants: {
    tr: ["Restoranları arıyorum", "Yerel lezzetlere bakıyorum", "Yorumları okuyorum"],
    en: ["Finding restaurants", "Tasting the local scene", "Reading reviews"],
  },
  attractions: {
    tr: ["Gezilecek yerleri arıyorum", "Öne çıkanlara bakıyorum", "Yorumları okuyorum"],
    en: ["Finding things to do", "Checking the highlights", "Reading reviews"],
  },
  events: {
    tr: ["Etkinlikleri arıyorum", "Festivallere bakıyorum", "Yerel ajandayı tarıyorum"],
    en: ["Looking up events", "Checking festivals", "Scanning the local calendar"],
  },
  day_plan: {
    tr: ["Gününü kurguluyorum", "Sabah–öğlen–akşam yerlerini arıyorum", "Rotanı birleştiriyorum"],
    en: [
      "Sketching your day",
      "Finding morning / afternoon / evening spots",
      "Piecing the route together",
    ],
  },
  plan: {
    tr: ["Planını hazırlıyorum", "Günleri sıralıyorum", "Her şeyi bir araya getiriyorum"],
    en: ["Building your plan", "Lining up the days", "Putting it all together"],
  },
  youtube: {
    tr: [
      "Video detaylarını okuyorum",
      "Transcripti analiz ediyorum",
      "Rotayı çıkarıyorum",
    ],
    en: [
      "Reading video details",
      "Analyzing the transcript",
      "Extracting the route",
    ],
  },
  influencer: {
    tr: [
      "Influencer rotasını yüklüyorum",
      "Mekanları eşleştiriyorum",
      "Rotayı çıkarıyorum",
    ],
    en: [
      "Loading the creator route",
      "Matching places",
      "Extracting the route",
    ],
  },
};

export function activityPhrases(
  activity: ActivityKind | null | undefined,
  locale: Locale
): string[] {
  return PHRASES[activity ?? "thinking"][locale];
}

/** Map chat activity to an expo-thinking-orbs animation state. */
export function orbStateForActivity(activity: ActivityKind | null | undefined): OrbState {
  if (!activity || activity === "thinking" || activity === "plan") return "working";
  return "searching";
}
