export type ChatIntent =
  | "day_plan"
  | "restaurants"
  | "attractions"
  | "events"
  | "other_flights"
  | "other_hotels"
  | "review_plan"
  | "create_plan";

type Locale = "tr" | "en";

interface IntentPattern {
  intent: ChatIntent;
  patterns: RegExp[];
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: "day_plan",
    patterns: [
      /\bgün(ümü|ümüze)?\s*planla/i,
      /\bgün\s*plan(ı|i|ını)?\b/i,
      /\bplan\s*my\s*day\b/i,
      /\bday\s*plan\b/i,
      /\bmorning\s*(afternoon|evening)\b/i,
      /\bsabah\s*(öğle|ogle|akşam|aksam)\b/i,
    ],
  },
  {
    intent: "restaurants",
    patterns: [
      /\brestoran/i,
      /\byemek\b/i,
      /\bnerede\s*ye(sek|sem|yelim)/i,
      /\brestaurants?\b/i,
      /\bwhere\s*(to\s*)?eat\b/i,
      /\bfood\s*(spots?|places?)\b/i,
    ],
  },
  {
    intent: "attractions",
    patterns: [
      /\bgezilecek\b/i,
      /\bgörülecek\b/i,
      /\bgorulecek\b/i,
      /\battractions?\b/i,
      /\bthings?\s*to\s*(see|do)\b/i,
      /\bsights?\b/i,
      /\bmuseum/i,
    ],
  },
  {
    intent: "events",
    patterns: [/\betkinlik/i, /\bfestival/i, /\bevents?\b/i, /\bconcert/i],
  },
  {
    intent: "other_flights",
    patterns: [
      /\bbaşka\s*uçuş/i,
      /\bbaska\s*ucus/i,
      /\bdaha\s*(iyi\s*)?uçuş/i,
      /\bother\s*flights?\b/i,
      /\bmore\s*flights?\b/i,
      /\bdifferent\s*flights?\b/i,
      /\bresearch\s*flights?\b/i,
    ],
  },
  {
    intent: "other_hotels",
    patterns: [
      /\bbaşka\s*otel/i,
      /\bbaska\s*otel/i,
      /\bdaha\s*(iyi\s*)?(otel|konaklama)/i,
      /\bother\s*(hotels?|stays?)\b/i,
      /\bmore\s*(hotels?|stays?)\b/i,
      /\bdifferent\s*(hotels?|stays?)\b/i,
    ],
  },
  {
    intent: "review_plan",
    patterns: [
      /\bplan(ı|i)?\s*gözden\s*geçir/i,
      /\bplan(ı|i)?\s*gozden\s*gecir/i,
      /\breview\s*(my\s*)?plan\b/i,
      /\bshow\s*(me\s*)?(the\s*)?plan\b/i,
    ],
  },
  {
    intent: "create_plan",
    patterns: [
      /\bseyahat\s*plan(ımı|imi)?\s*oluştur/i,
      /\bseyahat\s*plan(ımı|imi)?\s*olustur/i,
      /\bcreate\s*(my\s*)?(travel\s*)?plan\b/i,
      /\bbuild\s*(my\s*)?plan\b/i,
    ],
  },
];

/** Detect a late free-text intent. Returns null when the message is not a clear request. */
export function detectChatIntent(text: string, _locale?: Locale): ChatIntent | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 3) return null;
  for (const entry of INTENT_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(trimmed))) {
      return entry.intent;
    }
  }
  return null;
}
