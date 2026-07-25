type Locale = "tr" | "en";

type CopyPool = Record<Locale, string[]>;

const lastPicked = new Map<string, number>();

/** Pick a line from a pool, avoiding the same one twice in a row. */
export function pickCopy(pool: CopyPool, locale: Locale, poolKey: string): string {
  const lines = pool[locale] ?? pool.en;
  if (lines.length === 0) return "";
  if (lines.length === 1) return lines[0];
  const last = lastPicked.get(poolKey) ?? -1;
  let next = Math.floor(Math.random() * lines.length);
  if (next === last) next = (next + 1) % lines.length;
  lastPicked.set(poolKey, next);
  return lines[next];
}

export const SNAG_POOL: CopyPool = {
  tr: [
    "Orada takıldım — başka yoldan gidelim.",
    "Ufak bir pürüz; kaldığımız yerden devam.",
    "O kapı kapalı, yan kapıyı deneyelim.",
    "Bir anlık kesinti — senin için sıradaki adıma geçiyorum.",
    "O turda boş döndüm; daha net bir seçenekle devam edelim.",
  ],
  en: [
    "Hit a bump there — let's take another path.",
    "Small snag; picking up where we left off.",
    "That door's closed — trying the side one.",
    "Brief hiccup — moving you to the next step.",
    "Came back empty on that one; let's try a clearer option.",
  ],
};

export const READY_PROMPT_POOL: CopyPool = {
  tr: [
    "Temeller hazır — planı bir gözden geçirelim mi?",
    "Parçalar yerine oturdu; rotanı birlikte bakalım mı?",
    "Çekirdek hazır. Planı açıp inceleyelim mi?",
    "Her şey toplanmış görünüyor — planı gözden geçirelim?",
  ],
  en: [
    "Basics are set — shall we review the plan?",
    "Pieces are in place; want a look at your route?",
    "Core's ready. Open the plan together?",
    "Looks gathered — review the plan?",
  ],
};

export const PLAN_READY_POOL: CopyPool = {
  tr: [
    "Senin için özelleştirilmiş plan hazır — bir bak istersen.",
    "Rotanı derledim; gözden geçirebilirsin.",
    "Plan masada. İnceleyip dokunabilirsin.",
  ],
  en: [
    "Your custom plan is ready — take a look.",
    "I put your route together; you can review it.",
    "Plan's on the table. Peek and tweak away.",
  ],
};

type ActionKey =
  | "search_flights"
  | "search_flexible_dates"
  | "search_hotels"
  | "explore_destinations"
  | "search_places"
  | "search_events"
  | "search_day_plan"
  | "default";

const SEARCH_READY: Record<ActionKey, CopyPool> = {
  search_flights: {
    tr: [
      "Uçuşlar masada — hangisi senlik?",
      "Bağlantıları dizdim; birini seç.",
      "Uçuş seçeneklerin hazır, birine dokun.",
    ],
    en: [
      "Flights are on the table — which one's yours?",
      "Laid out the connections; pick one.",
      "Flight options ready — tap one.",
    ],
  },
  search_flexible_dates: {
    tr: [
      "Tarih aralıklarını sıraladım — birini seç.",
      "Takvimden birkaç seçenek çıktı; hangisi uyuyor?",
      "Esnek tarihler hazır, bir aralık kap.",
    ],
    en: [
      "Lined up some date ranges — pick one.",
      "A few calendar options popped up; which fits?",
      "Flexible dates ready — grab a range.",
    ],
  },
  search_hotels: {
    tr: [
      "Kalacak yerleri dizdim — birini kap.",
      "Konaklama seçeneklerin hazır; hangisi senin?",
      "Oteller masada, birine bak.",
    ],
    en: [
      "Lined up stays — grab one.",
      "Stay options ready; which one's yours?",
      "Hotels on the table — take a look.",
    ],
  },
  explore_destinations: {
    tr: [
      "Birkaç rota fikri topladım.",
      "Destinasyon önerilerin hazır.",
      "Gidebileceğin yerleri sıraladım.",
    ],
    en: [
      "Gathered a few route ideas.",
      "Destination ideas are ready.",
      "Lined up places you could go.",
    ],
  },
  search_places: {
    tr: [
      "Yerler hazır — birine bakabilirsin.",
      "Mekanları dizdim; hangisi çağırıyor?",
      "Liste geldi, birine dokun.",
    ],
    en: [
      "Places are ready — take a peek.",
      "Lined up spots; which is calling?",
      "List's in — tap one.",
    ],
  },
  search_events: {
    tr: ["Etkinlikler hazır.", "Ajandanda birkaç şey buldum.", "Yerel etkinlikler geldi."],
    en: ["Events are ready.", "Found a few things on the calendar.", "Local events just landed."],
  },
  search_day_plan: {
    tr: [
      "Günün planı hazır — sabah, öğlen ve akşam için seç.",
      "Üç dilime ayırdım; her dilimden bir yer kap.",
      "Sabah–öğlen–akşam seçenekleri masada.",
    ],
    en: [
      "Day plan ready — pick morning, afternoon, and evening.",
      "Split into three slots; grab one place each.",
      "Morning–afternoon–evening options are up.",
    ],
  },
  default: {
    tr: ["Sonuçlar hazır.", "Buldum — bakabilirsin.", "Liste geldi."],
    en: ["Results are ready.", "Found them — take a look.", "List just landed."],
  },
};

const SEARCH_FAILED: Record<ActionKey, CopyPool> = {
  search_flights: {
    tr: [
      "Uçuşlarda boş döndüm — tarihleri biraz oynatalım mı?",
      "Bu uçuş araması tutmadı; başka bir açı deneyelim.",
    ],
    en: [
      "Came back empty on flights — tweak the dates?",
      "That flight search didn't stick; another angle?",
    ],
  },
  search_flexible_dates: {
    tr: [
      "Tarih taraması boş kaldı — başka bir ay deneyelim mi?",
      "Esnek tarihlerde sonuç yok; süreyi değiştirelim mi?",
    ],
    en: [
      "Date scan came up empty — try another month?",
      "Nothing on flexible dates; change the length?",
    ],
  },
  search_hotels: {
    tr: [
      "Konaklamada boş döndüm — tarih veya bütçeyi gevşetelim mi?",
      "Otel araması tutmadı; başka filtre deneyelim.",
    ],
    en: [
      "Stays came back empty — loosen dates or budget?",
      "Hotel search didn't stick; try other filters.",
    ],
  },
  explore_destinations: {
    tr: [
      "Rota önerisi gelmedi — başka bir çıkış noktası deneyelim mi?",
      "Destinasyon listesi boş kaldı.",
    ],
    en: ["No route ideas came back — try another departure?", "Destination list came up empty."],
  },
  search_places: {
    tr: [
      "Mekan araması boş kaldı — başka bir kategori deneyelim mi?",
      "Yerlerde sonuç yok; sorguyu değiştirelim.",
    ],
    en: ["Place search came up empty — try another category?", "No spots; let's rephrase."],
  },
  search_events: {
    tr: ["Etkinlik bulamadım — tarihlere bir bakalım mı?", "Ajanda boş kaldı."],
    en: ["Couldn't find events — peek at the dates?", "Calendar came up empty."],
  },
  search_day_plan: {
    tr: [
      "Gün planı için yer bulamadım — başka bir şehir dilimi deneyelim mi?",
      "Slotlar boş kaldı; tekrar deneyelim.",
    ],
    en: ["Couldn't fill the day plan — try another area?", "Slots came up empty; let's retry."],
  },
  default: {
    tr: [
      "Arama tutmadı — başka bir seçenek deneyelim.",
      "Bu tur boş döndü; farklı bir yoldan gidelim.",
    ],
    en: ["That search didn't stick — try another option.", "Came back empty; another path."],
  },
};

function actionKey(actionType: string): ActionKey {
  if (actionType in SEARCH_READY) return actionType as ActionKey;
  return "default";
}

export function creativeSearchReady(actionType: string, locale: Locale): string {
  const key = actionKey(actionType);
  return pickCopy(SEARCH_READY[key], locale, `ready:${key}`);
}

const RESEARCH_READY: Record<ActionKey, CopyPool> = {
  search_flights: {
    tr: [
      "Sen seçtikten sonra biraz daha kurcaladım — bunlar daha iyi olabilir.",
      "Bir tur daha attım; şu seçenekler önceki seçiminden daha net duruyor.",
      "Yeniden taradım — bak, bunlar öne çıktı.",
    ],
    en: [
      "Dug a bit more after your pick — these might be better.",
      "Another pass; these look clearer than before.",
      "Rescanned — here are the standouts.",
    ],
  },
  search_hotels: {
    tr: [
      "Konaklamayı bir kez daha taradım — bunlar daha yakışır gibi.",
      "Seçiminden sonra yeni seçenekler çıkardım.",
    ],
    en: ["Scanned stays again — these might fit better.", "Found fresher options after your pick."],
  },
  search_flexible_dates: {
    tr: [
      "Tarihleri yeniden taradım — şu aralıklar daha iyi duruyor.",
      "Bir tur daha; esnek tarihler güncellendi.",
    ],
    en: ["Rescanned dates — these ranges look stronger.", "Another pass; flexible dates updated."],
  },
  explore_destinations: {
    tr: [
      "Rotaları yeniden kurcaladım — yenileri geldi.",
      "Bir tur daha; destinasyon listesi güncellendi.",
    ],
    en: ["Dug into routes again — fresh ideas.", "Another pass; destination list updated."],
  },
  search_places: {
    tr: ["Mekanları yeniden taradım — şunlara bak.", "Bir tur daha; liste tazelendi."],
    en: ["Rescanned places — take a look.", "Another pass; list refreshed."],
  },
  search_events: {
    tr: ["Etkinlikleri yeniden taradım.", "Ajanda yenilendi."],
    en: ["Rescanned events.", "Calendar refreshed."],
  },
  search_day_plan: {
    tr: [
      "Gün planını yeniledim — slotlar güncellendi.",
      "Bir tur daha; sabah–öğlen–akşam tazelendi.",
    ],
    en: [
      "Refreshed the day plan — slots updated.",
      "Another pass; morning–afternoon–evening refreshed.",
    ],
  },
  default: {
    tr: [
      "Bir tur daha kurcaladım — bunlar daha iyi olabilir.",
      "Yeniden taradım; güncel liste geldi.",
    ],
    en: ["Dug a bit more — these might be better.", "Rescanned; here's the fresh list."],
  },
};

export function creativeResearchReady(actionType: string, locale: Locale): string {
  const key = actionKey(actionType);
  return pickCopy(RESEARCH_READY[key], locale, `research:${key}`);
}

export function creativeSearchFailed(actionType: string, locale: Locale): string {
  const key = actionKey(actionType);
  return pickCopy(SEARCH_FAILED[key], locale, `fail:${key}`);
}

export function creativeSnag(locale: Locale): string {
  return pickCopy(SNAG_POOL, locale, "snag");
}

export function creativeReadyPrompt(locale: Locale): string {
  return pickCopy(READY_PROMPT_POOL, locale, "ready-prompt");
}

export function creativePlanReady(locale: Locale): string {
  return pickCopy(PLAN_READY_POOL, locale, "plan-ready");
}
