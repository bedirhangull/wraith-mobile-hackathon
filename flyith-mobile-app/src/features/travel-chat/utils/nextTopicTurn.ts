import type { AssistantTurn, SuggestionChip, TripBrief } from "../types";
import { nextMissingTopics, TOPICS, type TopicSpec } from "../state/topicChecklist";
import { isDayPlanSettled } from "../state/tripBrief";
import { creativeReadyPrompt } from "./chatCopy";

type Locale = "tr" | "en";

function chipsForTopic(
  topic: TopicSpec,
  brief: TripBrief,
  locale: Locale
): { prompt: string; chips: SuggestionChip[] } {
  const tr = locale === "tr";
  const onboarding = brief.onboarding;

  switch (topic.id) {
    case "destination": {
      const chips: SuggestionChip[] = [];
      const influencerPlace =
        onboarding?.influencerDestinations?.[0] ?? onboarding?.favoriteDestination;
      if (influencerPlace) {
        chips.push({
          id: `dest-${influencerPlace.toLowerCase().replace(/\s+/g, "-")}`,
          label: influencerPlace,
          description: onboarding?.favoriteInfluencer
            ? tr
              ? `${onboarding.favoriteInfluencer} rotası`
              : `${onboarding.favoriteInfluencer}'s vibe`
            : tr
              ? "Onboarding’den ilham"
              : "From your tastes",
          emoji: "✈",
          value: influencerPlace,
        });
      }
      chips.push(
        {
          id: "dest-europe",
          label: tr ? "Avrupa şehri" : "A European city",
          description: tr ? "Lisbon, Amsterdam, Roma…" : "Lisbon, Amsterdam, Rome…",
          emoji: "🌍",
        },
        {
          id: "dest-surprise",
          label: tr ? "Sürpriz öner" : "Surprise me",
          description: tr ? "Bütçeme uygun yer bul" : "Find somewhere that fits my budget",
          emoji: "✨",
        },
        {
          id: "dest-type",
          label: tr ? "Kendim yazarım" : "I'll type it",
          description: tr ? "Şehir adını yazacağım" : "I'll write the city name",
          emoji: "✍",
        }
      );
      return {
        prompt: tr ? "Nereye gitmek istersin?" : "Where do you want to go?",
        chips: chips.slice(0, 4),
      };
    }

    case "origin":
      return {
        prompt: tr ? "Nereden yola çıkmak istersin?" : "Where are you flying from?",
        chips: [
          {
            id: "origin-ist",
            label: "İstanbul",
            description: "IST / SAW",
            emoji: "🏙",
            value: "IST",
          },
          { id: "origin-ank", label: "Ankara", description: "ESB", emoji: "🏛", value: "ESB" },
          { id: "origin-ayt", label: "Antalya", description: "AYT", emoji: "🌊", value: "AYT" },
          {
            id: "origin-type",
            label: tr ? "Başka şehir" : "Another city",
            description: tr ? "Kalkış yerini yazarım" : "I'll type my departure city",
            emoji: "✍",
          },
        ],
      };

    case "dates":
      return {
        prompt: tr ? "Kaç gün kalmak istersin?" : "How many days do you want?",
        chips: [
          {
            id: "days-4",
            label: tr ? "4 gün" : "4 days",
            description: tr ? "Kısa kaçamak" : "A short getaway",
            emoji: "⚡",
            value: "4",
          },
          {
            id: "days-5",
            label: tr ? "5 gün" : "5 days",
            description: tr ? "Klasik şehir gezisi" : "Classic city break",
            emoji: "🏙",
            value: "5",
          },
          {
            id: "days-7",
            label: tr ? "7 gün" : "7 days",
            description: tr ? "Rahat tempo" : "Relaxed pace",
            emoji: "🌿",
            value: "7",
          },
          {
            id: "pick-dates",
            label: tr ? "Takvimden seç" : "Pick on calendar",
            description: tr ? "Tam tarihleri kendin belirle" : "Choose exact dates yourself",
            emoji: "📅",
          },
        ],
      };

    case "travelers":
      return {
        prompt: tr ? "Bu geziye kimler geliyor?" : "Who's coming on this trip?",
        chips: [
          {
            id: "travelers-solo",
            label: tr ? "Tek başıma" : "Solo",
            description: tr ? "1 yetişkin" : "1 adult",
            emoji: "🧍",
            value: "1",
          },
          {
            id: "travelers-couple",
            label: tr ? "Çift" : "Couple",
            description: tr ? "2 yetişkin" : "2 adults",
            emoji: "💑",
            value: "2",
          },
          {
            id: "travelers-friends",
            label: tr ? "Arkadaşlarla" : "Friends",
            description: tr ? "3–4 kişi" : "3–4 people",
            emoji: "👥",
            value: "3",
          },
          {
            id: "travelers-family",
            label: tr ? "Aile" : "Family",
            description: tr ? "Yetişkin + çocuk olabilir" : "Adults, maybe kids",
            emoji: "👨‍👩‍👧",
            value: "family",
          },
        ],
      };

    case "children":
      return {
        prompt: tr ? "Çocuk da geliyor mu?" : "Any children coming?",
        chips: [
          {
            id: "children-0",
            label: tr ? "Yok" : "None",
            description: tr ? "Sadece yetişkin" : "Adults only",
            emoji: "✓",
            value: "0",
          },
          {
            id: "children-1",
            label: tr ? "1 çocuk" : "1 child",
            description: tr ? "Yaşı sonra netleştiririz" : "Age can come next",
            emoji: "🧒",
            value: "1",
          },
          {
            id: "children-2",
            label: tr ? "2+ çocuk" : "2+ children",
            description: tr ? "Aile gezisi" : "Family trip",
            emoji: "👨‍👩‍👧‍👦",
            value: "2",
          },
        ],
      };

    case "budget": {
      const avg = onboarding?.averageBudget;
      return {
        prompt: tr ? "Bu gezi için toplam bütçen?" : "What's your total budget for this trip?",
        chips: [
          {
            id: "budget-800",
            label: "$800",
            description: tr ? "Sıkı bütçe" : "Tight budget",
            emoji: "💸",
            value: "800",
          },
          {
            id: "budget-1500",
            label: avg ? `$${avg}` : "$1500",
            description: avg
              ? tr
                ? "Onboarding ortalaman"
                : "Your usual average"
              : tr
                ? "Orta"
                : "Mid-range",
            emoji: "💳",
            value: String(avg ?? 1500),
          },
          {
            id: "budget-2500",
            label: "$2500",
            description: tr ? "Rahat" : "Comfortable",
            emoji: "✨",
            value: "2500",
          },
          {
            id: "budget-type",
            label: tr ? "Kendim yazarım" : "I'll type it",
            description: tr ? "Tam tutarı yazacağım" : "I'll enter the exact amount",
            emoji: "✍",
          },
        ],
      };
    }

    case "occasion":
      return {
        prompt: tr ? "Bu gezinin vesilesi ne?" : "What's the occasion?",
        chips: [
          {
            id: "occasion-getaway",
            label: tr ? "Kaçamak" : "Getaway",
            emoji: "🌴",
            value: "getaway",
          },
          {
            id: "occasion-birthday",
            label: tr ? "Doğum günü" : "Birthday",
            emoji: "🎂",
            value: "birthday",
          },
          {
            id: "occasion-anniversary",
            label: tr ? "Yıldönümü" : "Anniversary",
            emoji: "💍",
            value: "anniversary",
          },
          {
            id: "occasion-work",
            label: tr ? "Workcation" : "Workcation",
            emoji: "💻",
            value: "workcation",
          },
        ],
      };

    case "cabin_class":
      return {
        prompt: tr ? "Hangi kabin sınıfı?" : "Which cabin class?",
        chips: [
          { id: "cabin-1", label: tr ? "Ekonomi" : "Economy", emoji: "💺", value: "1" },
          {
            id: "cabin-2",
            label: tr ? "Premium ekonomi" : "Premium economy",
            emoji: "🆙",
            value: "2",
          },
          { id: "cabin-3", label: tr ? "Business" : "Business", emoji: "🥂", value: "3" },
          { id: "cabin-4", label: tr ? "First" : "First", emoji: "👑", value: "4" },
        ],
      };

    case "stops":
      return {
        prompt: tr ? "Aktarma olur mu?" : "Okay with stops?",
        chips: [
          {
            id: "stops-0",
            label: tr ? "Sadece direkt" : "Nonstop only",
            emoji: "➡",
            value: "0",
          },
          { id: "stops-1", label: tr ? "1 aktarma OK" : "1 stop OK", emoji: "🔀", value: "1" },
          { id: "stops-2", label: tr ? "2 aktarma OK" : "Up to 2 stops", emoji: "🔄", value: "2" },
        ],
      };

    case "bags":
      return {
        prompt: tr ? "Kabinde kaç çanta?" : "How many carry-ons?",
        chips: [
          { id: "bags-0", label: tr ? "Çanta yok" : "None", emoji: "✋", value: "0" },
          { id: "bags-1", label: "1", emoji: "🎒", value: "1" },
          { id: "bags-2", label: "2", emoji: "🧳", value: "2" },
        ],
      };

    case "accommodation_type":
      return {
        prompt: tr ? "Bu gezi için konaklama?" : "Where do you want to stay?",
        chips: [
          {
            id: "stay-hostel",
            label: "Hostel",
            description:
              onboarding?.hostelVsHotel === "hostel"
                ? tr
                  ? "Onboarding tercihin"
                  : "Your usual pick"
                : undefined,
            emoji: "🛏",
            value: "hostel",
          },
          { id: "stay-hotel", label: tr ? "Otel" : "Hotel", emoji: "🏨", value: "hotel" },
          { id: "stay-boutique", label: tr ? "Butik" : "Boutique", emoji: "✨", value: "boutique" },
          { id: "stay-resort", label: "Resort", emoji: "🏖", value: "resort" },
        ],
      };

    case "hotel_budget":
      return {
        prompt: tr ? "Gecelik üst sınırın nedir?" : "Max price per night?",
        chips: [
          {
            id: "nightly-80",
            label: "$80",
            description: tr ? "Uygun" : "Budget",
            emoji: "💸",
            value: "80",
          },
          {
            id: "nightly-150",
            label: "$150",
            description: tr ? "Orta" : "Mid-range",
            emoji: "💳",
            value: "150",
          },
          {
            id: "nightly-250",
            label: "$250",
            description: tr ? "Rahat" : "Comfortable",
            emoji: "✨",
            value: "250",
          },
          {
            id: "nightly-skip",
            label: tr ? "Fark etmez" : "No limit",
            description: tr ? "Esnek kal" : "Keep it flexible",
            emoji: "🤷",
          },
        ],
      };

    case "cuisine":
      return {
        prompt: tr ? "Ne yemek istersin?" : "What food are you craving?",
        chips: [
          {
            id: "food-street",
            label: tr ? "Sokak yemeği" : "Street food",
            emoji: "🌮",
            value: "street food",
          },
          {
            id: "food-local",
            label: tr ? "Yerel mutfak" : "Local cuisine",
            emoji: "🍲",
            value: "local",
          },
          {
            id: "food-seafood",
            label: tr ? "Deniz ürünleri" : "Seafood",
            emoji: "🦐",
            value: "seafood",
          },
          { id: "food-any", label: tr ? "Fark etmez" : "Anything", emoji: "😋", value: "any" },
        ],
      };

    case "travel_style":
      return {
        prompt: tr ? "Bu gezi daha çok ne olsun?" : "Cultural sights or experiences?",
        chips: [
          {
            id: "style-cultural",
            label: tr ? "Kültürel" : "Cultural",
            emoji: "🏛",
            value: "cultural",
          },
          {
            id: "style-experience",
            label: tr ? "Deneyim" : "Experience",
            emoji: "🎢",
            value: "experience",
          },
          { id: "style-mixed", label: tr ? "Karışık" : "Mixed", emoji: "⚖", value: "mixed" },
        ],
      };

    case "pace":
      return {
        prompt: tr ? "Tempo nasıl olsun?" : "What pace do you want?",
        chips: [
          { id: "pace-relaxed", label: tr ? "Sakin" : "Relaxed", emoji: "☕", value: "relaxed" },
          {
            id: "pace-balanced",
            label: tr ? "Dengeli" : "Balanced",
            emoji: "⚖",
            value: "balanced",
          },
          { id: "pace-packed", label: tr ? "Dolu dolu" : "Packed", emoji: "🏃", value: "packed" },
        ],
      };

    case "famous_vs_hidden":
      return {
        prompt: tr ? "Meşhur yerler mi, saklı köşeler mi?" : "Famous spots or hidden gems?",
        chips: [
          {
            id: "famous-famous",
            label: tr ? "Meşhur yerler" : "Famous spots",
            emoji: "🗼",
            value: "famous",
          },
          {
            id: "famous-hidden",
            label: tr ? "Saklı köşeler" : "Hidden gems",
            emoji: "🕵",
            value: "hidden",
          },
          { id: "famous-mix", label: tr ? "İkisi de" : "A mix", emoji: "🎯", value: "mix" },
        ],
      };

    case "nightlife":
      return {
        prompt: tr ? "Gece hayatı ilgini çeker mi?" : "Are you into nightlife?",
        chips: [
          {
            id: "nightlife-yes",
            label: tr ? "Evet, olsun" : "Yes, please",
            emoji: "🍸",
            value: "yes",
          },
          {
            id: "nightlife-chill",
            label: tr ? "Sakin barlar" : "Chill bars only",
            emoji: "🍷",
            value: "chill",
          },
          { id: "nightlife-no", label: tr ? "Gerek yok" : "Not for me", emoji: "🌙", value: "no" },
        ],
      };

    case "restaurants":
      return {
        prompt: tr
          ? `${brief.destination ?? "Şehirde"} için restoranlara bakalım mı?`
          : `Want me to pull restaurants in ${brief.destination ?? "the city"}?`,
        chips: [
          {
            id: "show-restaurants",
            label: tr ? "Restoranları göster" : "Show restaurants",
            description: tr ? "Gerçek puanlarla" : "With real ratings",
            emoji: "🍽",
          },
          {
            id: "skip-restaurants",
            label: tr ? "Şimdilik atla" : "Skip for now",
            description: tr ? "Sonra bakarız" : "We can do it later",
            emoji: "⏭",
          },
        ],
      };

    case "attractions":
      return {
        prompt: tr
          ? `${brief.destination ?? "Şehirde"} gezilecek yerlere bakalım mı?`
          : `Want to see things to do in ${brief.destination ?? "the city"}?`,
        chips: [
          {
            id: "show-attractions",
            label: tr ? "Gezilecek yerleri göster" : "Show top places",
            description: tr ? "En çok gidilenler" : "Most visited spots",
            emoji: "📸",
          },
          {
            id: "skip-attractions",
            label: tr ? "Şimdilik atla" : "Skip for now",
            description: tr ? "Sonra bakarız" : "We can do it later",
            emoji: "⏭",
          },
        ],
      };

    case "day_plan":
      return {
        prompt: tr
          ? `${brief.destination ?? "Şehirde"} için sabah–öğlen–akşam planına bakalım mı?`
          : `Want a morning / afternoon / evening plan for ${brief.destination ?? "the city"}?`,
        chips: [
          {
            id: "show-day-plan",
            label: tr ? "Günü planla" : "Plan the day",
            description: tr ? "Üç saat diliminde yerler" : "Places in three time slots",
            emoji: "🗓",
          },
          {
            id: "skip-day-plan",
            label: tr ? "Şimdilik atla" : "Skip for now",
            description: tr ? "Sonra bakarız" : "We can do it later",
            emoji: "⏭",
          },
        ],
      };

    default:
      // Localized, always answerable — never raw English goal text, never a lone "Devam".
      return {
        prompt: genericTopicPrompt(topic, locale),
        chips: [
          {
            id: `topic-${topic.id}-yes`,
            label: tr ? "Evet, önemli" : "Yes, matters",
            emoji: "👍",
            value: "yes",
          },
          {
            id: `topic-${topic.id}-no`,
            label: tr ? "Fark etmez" : "No preference",
            emoji: "🤷",
            value: "no",
          },
          { id: `topic-${topic.id}-type`, label: tr ? "Yazarım" : "I'll type it", emoji: "✍" },
        ],
      };
  }
}

const GENERIC_TOPIC_PROMPTS: Record<string, { tr: string; en: string }> = {
  flight_price_cap: {
    tr: "Uçuş için üst sınırın var mı?",
    en: "Any ceiling on the flight price?",
  },
  departure_window: {
    tr: "Kalkış saati tercihin var mı?",
    en: "Any preferred departure time?",
  },
  flight_duration: {
    tr: "Uzun aktarmalar seni rahatsız eder mi?",
    en: "Do long layovers bother you?",
  },
  airlines_emissions: {
    tr: "Tercih ettiğin bir havayolu var mı?",
    en: "Any airline you prefer?",
  },
  hotel_class: { tr: "Kaç yıldızlı bir yer olsun?", en: "What star class do you want?" },
  hotel_rating: { tr: "Misafir puanı senin için önemli mi?", en: "Does guest rating matter?" },
  hotel_amenities: { tr: "Otelde olmazsa olmazın var mı?", en: "Any must-have hotel amenities?" },
  hotel_policies: { tr: "Ücretsiz iptal şart mı?", en: "Do you need free cancellation?" },
  neighborhood: {
    tr: "Şehirde tercih ettiğin bir semt var mı?",
    en: "Any neighborhood you prefer?",
  },
  hotel_budget: { tr: "Gecelik üst sınırın nedir?", en: "Max price per night?" },
  dietary: { tr: "Beslenme kısıtın var mı?", en: "Any dietary restrictions?" },
  day_trip: {
    tr: "Şehir dışına günübirlik tur ister misin?",
    en: "Want a day trip outside the city?",
  },
  shopping_gifts: {
    tr: "Alışveriş için zaman ayıralım mı?",
    en: "Should we make time for shopping?",
  },
  events: {
    tr: "O tarihlerdeki etkinliklere bakalım mı?",
    en: "Want to see events on those dates?",
  },
  influencer_route: {
    tr: "Sevdiğin influencer'ın rotası ilgini çeker mi?",
    en: "Want your favorite influencer's route?",
  },
};

function genericTopicPrompt(topic: TopicSpec, locale: Locale): string {
  const copy = GENERIC_TOPIC_PROMPTS[topic.id];
  if (copy) return locale === "tr" ? copy.tr : copy.en;
  return locale === "tr" ? "Bu konuda tercihin var mı?" : "Any preference here?";
}

/** Without these there is no trip — they may be re-asked even once asked before. */
export const ESSENTIAL_TOPIC_IDS = new Set(["destination", "origin", "dates"]);

export interface NextTopicTurn {
  /** undefined once every core topic is answered — time to wrap up, not ask more. */
  topicId?: string;
  prompt: string;
  chips: SuggestionChip[];
}

/**
 * Topic-aware chips for whatever the brief still needs. Skips topics already put
 * on screen so the same question can't come back, and never emits a lone Devam.
 */
export function chipsForNextTopic(
  brief: TripBrief,
  locale: Locale,
  askedTopicIds: Iterable<string> = []
): NextTopicTurn {
  const skip = new Set(askedTopicIds);
  const next =
    nextMissingTopics(brief, 1, { coreOnly: true, skipIds: askedTopicIds })[0] ??
    // Nothing new to ask, but a trip still can't be booked without these —
    // only re-ask essentials the user has NOT already answered.
    nextMissingTopics(brief, TOPICS.length, { coreOnly: true }).find(
      (topic) => ESSENTIAL_TOPIC_IDS.has(topic.id) && !skip.has(topic.id)
    );
  if (!next) {
    if (!isDayPlanSettled(brief)) {
      // Already asked once — don't re-emit the same chips (search may still be in flight).
      if (skip.has("day_plan")) {
        return { topicId: "day_plan", prompt: "", chips: [] };
      }
      const tr = locale === "tr";
      return {
        topicId: "day_plan",
        prompt: tr
          ? "Planı kilitlemeden önce bir günü birlikte kuralım mı?"
          : "Before we lock the plan — shall we sketch one day together?",
        chips: [
          {
            id: "show-day-plan",
            label: tr ? "Gün planını göster" : "Show a day plan",
            description: tr ? "Sabah / öğlen / akşam" : "Morning / afternoon / evening",
            emoji: "🗓",
          },
          {
            id: "skip-day-plan",
            label: tr ? "Gerek yok" : "Skip for now",
            description: tr ? "Doğrudan plana geç" : "Go straight to the plan",
            emoji: "⏭",
          },
        ],
      };
    }
    return {
      prompt: readyPrompt(locale),
      chips: [
        {
          id: "create-travel-plan",
          label: locale === "tr" ? "Seyahat planımı oluştur" : "Create my travel plan",
          description: locale === "tr" ? "Özelleştirilmiş rota" : "A tailored itinerary",
          emoji: "✨",
        },
        {
          id: "review-plan",
          label: locale === "tr" ? "Planı gözden geçir" : "Review my plan",
          description: locale === "tr" ? "Gün gün program" : "Day-by-day itinerary",
          emoji: "📋",
        },
      ],
    };
  }
  return { topicId: next.id, ...chipsForTopic(next, brief, locale) };
}

/** Build chips for a specific topic id (out-of-order asks, e.g. origin before explore). */
export function buildTopicTurn(
  topicId: string,
  brief: TripBrief,
  locale: Locale
): { topicId: string; prompt: string; chips: SuggestionChip[] } | null {
  const topic = TOPICS.find((entry) => entry.id === topicId);
  if (!topic) return null;
  return { topicId: topic.id, ...chipsForTopic(topic, brief, locale) };
}

function readyPrompt(locale: Locale): string {
  return creativeReadyPrompt(locale);
}

/** Build a local suggestions turn for the next missing checklist topic. */
export function buildNextTopicTurn(
  brief: TripBrief,
  locale: Locale,
  askedTopicIds: Iterable<string> = []
): AssistantTurn {
  const { prompt, chips } = chipsForNextTopic(brief, locale, askedTopicIds);
  return { kind: "suggestions", prompt, chips };
}

export function withSkippedTopic(brief: TripBrief, topicId: string): Partial<TripBrief> {
  const current = brief.skippedTopics ?? [];
  if (current.includes(topicId)) return {};
  return { skippedTopics: [...current, topicId] };
}

/** Map a chip id/label to a brief patch so taps actually answer the question. */
export function briefPatchFromChip(
  chipId: string,
  label: string,
  brief?: TripBrief
): Partial<TripBrief> | undefined {
  if (
    chipId.startsWith("dest-") &&
    !["dest-type", "dest-surprise", "dest-europe"].includes(chipId)
  ) {
    return { destination: label };
  }

  if (chipId.startsWith("days-")) {
    const days = Number(chipId.replace("days-", ""));
    if (Number.isFinite(days) && days > 0) return { tripLengthDays: days };
  }

  if (chipId.startsWith("famous-")) {
    const value = chipId.replace("famous-", "") as TripBrief["famousVsHiddenGems"];
    if (value === "famous" || value === "hidden" || value === "mix") {
      return { famousVsHiddenGems: value };
    }
  }

  if (chipId === "nightlife-yes") return { nightlifeInterest: true };
  if (chipId === "nightlife-chill") return { nightlifeInterest: true };
  if (chipId === "nightlife-no") return { nightlifeInterest: false };

  if (
    brief &&
    (chipId === "skip-restaurants" || chipId === "skip-attractions" || chipId === "skip-day-plan")
  ) {
    return withSkippedTopic(brief, chipId.replace("skip-", ""));
  }
  if (chipId === "origin-ist") return { originAirportCode: "IST" };
  if (chipId === "origin-ank") return { originAirportCode: "ESB" };
  if (chipId === "origin-ayt") return { originAirportCode: "AYT" };

  if (chipId === "travelers-solo") {
    return { adults: 1, travelers: 1, companionType: "solo", children: 0 };
  }
  if (chipId === "travelers-couple") {
    return { adults: 2, travelers: 2, companionType: "couple", children: 0 };
  }
  if (chipId === "travelers-friends") {
    return { adults: 3, travelers: 3, companionType: "friends" };
  }
  if (chipId === "travelers-family") {
    return { adults: 2, travelers: 2, companionType: "family" };
  }

  if (chipId === "children-0") return { children: 0 };
  if (chipId === "children-1") return { children: 1 };
  if (chipId === "children-2") return { children: 2 };

  if (chipId.startsWith("budget-") && chipId !== "budget-type") {
    const amount = Number(chipId.replace("budget-", ""));
    if (Number.isFinite(amount)) return { budgetTotalUSD: amount };
  }

  if (chipId.startsWith("occasion-")) {
    return { occasion: chipId.replace("occasion-", "") };
  }

  if (chipId.startsWith("cabin-")) {
    const n = Number(chipId.replace("cabin-", "")) as 1 | 2 | 3 | 4;
    if (n >= 1 && n <= 4) return { travelClass: n };
  }

  if (chipId.startsWith("stops-")) {
    const n = Number(chipId.replace("stops-", "")) as 0 | 1 | 2 | 3;
    if (n >= 0 && n <= 3) return { maxStops: n };
  }

  if (chipId.startsWith("bags-")) {
    const n = Number(chipId.replace("bags-", ""));
    if (Number.isFinite(n)) return { carryOnBags: n };
  }

  if (chipId.startsWith("stay-")) {
    const type = chipId.replace("stay-", "") as TripBrief["accommodationType"];
    if (type === "hostel" || type === "hotel" || type === "boutique" || type === "resort") {
      return { accommodationType: type };
    }
  }

  if (chipId.startsWith("nightly-") && chipId !== "nightly-skip") {
    const amount = Number(chipId.replace("nightly-", ""));
    if (Number.isFinite(amount)) return { maxPricePerNightUSD: amount };
  }
  if (chipId === "nightly-skip" && brief) {
    return withSkippedTopic(brief, "hotel_budget");
  }

  if (chipId.startsWith("food-")) {
    const value = chipId.replace("food-", "");
    if (value === "any") return { cuisineTypes: ["any"], foodPreferences: ["any"] };
    return { cuisineTypes: [label], foodPreferences: [label] };
  }

  if (chipId.startsWith("style-")) {
    const style = chipId.replace("style-", "") as TripBrief["travelStyle"];
    if (style === "cultural" || style === "experience" || style === "mixed") {
      return { travelStyle: style };
    }
  }

  if (chipId.startsWith("pace-")) {
    const pace = chipId.replace("pace-", "") as TripBrief["pace"];
    if (pace === "relaxed" || pace === "balanced" || pace === "packed") {
      return { pace };
    }
  }

  // Generic yes/no topic chips — mark a boolean-ish field when possible
  if (chipId.startsWith("topic-") && chipId.endsWith("-yes")) {
    const id = chipId.replace(/^topic-/, "").replace(/-yes$/, "");
    if (id === "day_trip") return { dayTripInterest: true };
    if (id === "nightlife") return { nightlifeInterest: true };
    if (id === "events") return { eventInterest: true };
    if (id === "shopping_gifts") return { shoppingInterest: true, giftShopping: true };
    if (id === "influencer_route") return { influencerRouteAccepted: true };
  }
  if (chipId.startsWith("topic-") && chipId.endsWith("-no")) {
    const id = chipId.replace(/^topic-/, "").replace(/-no$/, "");
    if (id === "day_trip") return { dayTripInterest: false };
    if (id === "nightlife") return { nightlifeInterest: false };
    if (id === "events") return { eventInterest: false };
    if (id === "shopping_gifts") return { shoppingInterest: false, giftShopping: false };
    if (id === "influencer_route") return { influencerRouteAccepted: false };
    if (id === "children") return { children: 0 };
    // "No preference" on anything else means: stop asking about it.
    if (brief) return withSkippedTopic(brief, id);
  }

  return undefined;
}

export function isUselessContinueChip(chip: SuggestionChip): boolean {
  return (
    chip.id === "continue" ||
    /^devam$/i.test(chip.label.trim()) ||
    /^continue$/i.test(chip.label.trim())
  );
}
