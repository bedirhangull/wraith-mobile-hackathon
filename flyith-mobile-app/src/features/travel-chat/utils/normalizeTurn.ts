import type { AssistantTurn, SuggestionChip, TripBrief } from "../types";
import { chipsForNextTopic, isUselessContinueChip } from "./nextTopicTurn";

/**
 * Hermes-safe emoji detection — avoid `\p{Extended_Pictographic}` which can
 * throw or no-op on some RN engines and take the whole turn down with it.
 */
function isEmojiCodePoint(cp: number): boolean {
  return (
    (cp >= 0x1f300 && cp <= 0x1faff) || // misc pictographs + symbols
    (cp >= 0x1f900 && cp <= 0x1f9ff) || // supplemental
    (cp >= 0x1fa00 && cp <= 0x1faff) ||
    (cp >= 0x1f1e6 && cp <= 0x1f1ff) || // regional indicators (flags)
    (cp >= 0x2600 && cp <= 0x27bf) || // misc symbols + dingbats
    (cp >= 0x2300 && cp <= 0x23ff) || // misc technical (⌚ etc.)
    (cp >= 0x2b50 && cp <= 0x2b55) ||
    cp === 0x2934 ||
    cp === 0x2935 ||
    (cp >= 0x3297 && cp <= 0x3299) ||
    cp === 0x00a9 ||
    cp === 0x00ae ||
    cp === 0x2122
  );
}

function isEmojiJoiner(cp: number): boolean {
  return cp === 0x200d || cp === 0xfe0f || (cp >= 0x1f3fb && cp <= 0x1f3ff);
}

type Cp = { ch: string; cp: number };

function toCodePoints(text: string): Cp[] {
  return Array.from(text).map((ch) => ({ ch, cp: ch.codePointAt(0) ?? 0 }));
}

/** Consume one emoji cluster starting at `index`; returns end index. */
function consumeEmojiCluster(chars: Cp[], index: number): number {
  let i = index;
  if (i >= chars.length) return i;

  // Flag: two regional indicators
  if (chars[i].cp >= 0x1f1e6 && chars[i].cp <= 0x1f1ff) {
    i += 1;
    if (i < chars.length && chars[i].cp >= 0x1f1e6 && chars[i].cp <= 0x1f1ff) i += 1;
    return i;
  }

  if (!isEmojiCodePoint(chars[i].cp)) return index;
  i += 1;
  while (i < chars.length) {
    const { cp } = chars[i];
    if (isEmojiJoiner(cp)) {
      i += 1;
      continue;
    }
    if (isEmojiCodePoint(cp)) {
      // ZWJ sequence continuation (👩‍🚀) — only if previous was ZWJ
      if (i > 0 && chars[i - 1].cp === 0x200d) {
        i += 1;
        continue;
      }
      break;
    }
    break;
  }
  return i;
}

function stripFromFingerDown(text: string): string {
  const idx = text.indexOf("👇");
  return idx >= 0 ? text.slice(0, idx).trim() : text;
}

function stripOptionsBoilerplate(text: string): string {
  return text
    .replace(/\s*(?:Aşağıdaki|Asagidaki|Below(?: the)?|The options below)[^]*$/i, "")
    .trim();
}

function stripTrailingEmojiClusters(text: string): string {
  const chars = toCodePoints(text);
  let end = chars.length;

  // Eat trailing whitespace + emoji clusters from the end.
  while (end > 0) {
    while (end > 0 && (chars[end - 1].cp === 0x20 || chars[end - 1].cp === 0x0a)) {
      end -= 1;
    }
    if (end === 0) break;

    // Find start of a trailing emoji cluster
    let start = end;
    while (start > 0) {
      const prev = chars[start - 1].cp;
      if (isEmojiCodePoint(prev) || isEmojiJoiner(prev)) {
        start -= 1;
        continue;
      }
      break;
    }
    if (start < end && isEmojiCodePoint(chars[start].cp)) {
      end = start;
      continue;
    }
    break;
  }

  return chars
    .slice(0, end)
    .map((c) => c.ch)
    .join("")
    .trim();
}

function keepMaxEmojiClusters(text: string, max: number): string {
  const chars = toCodePoints(text);
  const out: string[] = [];
  let seen = 0;
  let i = 0;
  while (i < chars.length) {
    const next = consumeEmojiCluster(chars, i);
    if (next > i) {
      seen += 1;
      if (max < 0 || seen <= max) {
        for (let k = i; k < next; k += 1) out.push(chars[k].ch);
      }
      i = next;
      continue;
    }
    out.push(chars[i].ch);
    i += 1;
  }
  return out
    .join("")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Keep at most `max` emojis in assistant prose. Strips trailing emoji trails
 * (the "👇 📅 ✈️ 🌷 …" pattern) so bubbles stay readable.
 */
export function clampTextEmojis(text: string, max = 1): string {
  if (!text) return text;
  let cleaned = stripFromFingerDown(text);
  cleaned = stripOptionsBoilerplate(cleaned);
  cleaned = stripTrailingEmojiClusters(cleaned);
  if (max <= 0) return keepMaxEmojiClusters(cleaned, 0);
  return keepMaxEmojiClusters(cleaned, max);
}

/** Exactly one emoji for a chip icon, or undefined. */
export function singleChipEmoji(value?: string): string | undefined {
  if (!value) return undefined;
  const chars = toCodePoints(value);
  for (let i = 0; i < chars.length; i += 1) {
    const next = consumeEmojiCluster(chars, i);
    if (next > i) {
      return chars
        .slice(i, next)
        .map((c) => c.ch)
        .join("");
    }
  }
  return undefined;
}

function normalizeChip(chip: SuggestionChip): SuggestionChip {
  return {
    ...chip,
    emoji: singleChipEmoji(chip.emoji),
    label: chip.label.trim(),
    description: chip.description ? clampTextEmojis(chip.description, 0) : chip.description,
  };
}

function looksLikeChoicePrompt(text: string): boolean {
  return /[?？]|👇|aşağıdaki|asagidaki|seçenek|secenek|options below|choose (one|from)|hangi |kaç |kac /i.test(
    text
  );
}

/** Contextual fallback cards — always match what the brief still needs next. Never "Devam". */
export function fallbackChoiceChips(
  brief: TripBrief,
  locale: "tr" | "en",
  askedTopicIds: Iterable<string> = []
): SuggestionChip[] {
  return chipsForNextTopic(brief, locale, askedTopicIds).chips;
}

export function fallbackChoicePrompt(brief: TripBrief, locale: "tr" | "en"): string {
  return chipsForNextTopic(brief, locale).prompt;
}

function isDatePhaseChip(chip: SuggestionChip): boolean {
  return (
    chip.id === "pick-dates" ||
    chip.id === "flexible" ||
    chip.id.startsWith("days-") ||
    /esneğ|esneg|takvim|flexible|calendar|\bgün\b|\bdays?\b/i.test(`${chip.id} ${chip.label}`)
  );
}

/** Date/calendar chips are illegal until destination + origin exist. */
export function canOfferDateChips(brief: TripBrief): boolean {
  return Boolean((brief.destination || brief.destinationAirportCode) && brief.originAirportCode);
}

/**
 * Force chips to match the current planning phase. Always drops premature
 * Esneğim / Takvimden seç / N gün cards.
 */
export function gateChipsToBriefPhase(
  chips: SuggestionChip[],
  brief: TripBrief,
  locale: "tr" | "en",
  askedTopicIds: Iterable<string> = []
): SuggestionChip[] {
  const normalized = chips
    .map(normalizeChip)
    .filter((chip) => chip.label.length > 0 && !isUselessContinueChip(chip));

  if (!canOfferDateChips(brief)) {
    const withoutDates = normalized.filter((chip) => !isDatePhaseChip(chip));
    if (withoutDates.length >= 2) return withoutDates;
    return fallbackChoiceChips(brief, locale, askedTopicIds);
  }

  if (normalized.length >= 2) return normalized;
  return fallbackChoiceChips(brief, locale, askedTopicIds);
}

function detectLocaleFromText(text: string): "tr" | "en" {
  if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) return "tr";
  if (
    /\b(ve|bir|istiyorum|istersin|hangi|kaç|gün|seç|tamam|nereye|merhaba|selam|gitmek|yazarım|öner)\b/i.test(
      text
    )
  ) {
    return "tr";
  }
  return "en";
}

/**
 * Hardens a model turn. Never throws — a failure here must not kill the chat.
 * `conversationLocale` wins over sniffing the model's own text, so a stray English
 * sentence can't flip a Turkish chat's chips to English.
 */
export function normalizeAssistantTurn(
  turn: AssistantTurn,
  brief: TripBrief,
  conversationLocale?: "tr" | "en",
  askedTopicIds: Iterable<string> = []
): AssistantTurn {
  const localeOf = (text: string): "tr" | "en" => conversationLocale ?? detectLocaleFromText(text);
  try {
    if (turn.kind === "image") {
      return {
        ...turn,
        caption: turn.caption ? clampTextEmojis(turn.caption, 1) : turn.caption,
      };
    }

    if (turn.kind === "system_notice") {
      return { ...turn, text: clampTextEmojis(turn.text, 0) };
    }

    if (turn.kind === "suggestions") {
      const prompt = clampTextEmojis(turn.prompt ?? "", 1);
      const locale = localeOf(prompt || turn.prompt || "");
      let chips = gateChipsToBriefPhase(turn.chips, brief, locale, askedTopicIds);

      // Model asked a real question but only sent Devam / empty → replace with topic chips + prompt.
      const next = chipsForNextTopic(brief, locale, askedTopicIds);
      const modelChipsWereUseless =
        turn.chips.length === 0 ||
        turn.chips.every(isUselessContinueChip) ||
        (turn.chips.length === 1 && isUselessContinueChip(turn.chips[0]));
      if (modelChipsWereUseless) {
        chips = next.chips;
      }

      let nextPrompt = prompt;
      if (modelChipsWereUseless || !prompt) {
        nextPrompt = next.prompt;
      } else if (
        !canOfferDateChips(brief) &&
        /tarih|date|takvim|esnek|calendar|flexible|kaç gün|kac gun/i.test(prompt)
      ) {
        if (!brief.destination && !brief.destinationAirportCode) {
          nextPrompt = locale === "tr" ? "Nereye gitmek istersin?" : "Where do you want to go?";
        } else if (!brief.originAirportCode) {
          nextPrompt =
            locale === "tr" ? "Nereden yola çıkmak istersin?" : "Where are you flying from?";
        }
      }

      return { kind: "suggestions", prompt: nextPrompt, chips };
    }

    if (turn.kind === "question") {
      const rawText = turn.text;
      const text = clampTextEmojis(rawText, 1);
      const locale = localeOf(rawText);
      const quick = turn.quickReplies?.map((reply) => reply.trim()).filter(Boolean) ?? [];
      if (quick.length >= 2) {
        const chips = gateChipsToBriefPhase(
          quick.map((label, index) => ({
            id: `qr-${index}-${label}`,
            label: clampTextEmojis(label, 0) || label,
            emoji: singleChipEmoji(label),
          })),
          brief,
          locale,
          askedTopicIds
        );
        return { kind: "suggestions", prompt: text, chips };
      }
      if (looksLikeChoicePrompt(rawText) || looksLikeChoicePrompt(text)) {
        return {
          kind: "suggestions",
          prompt: text,
          chips: fallbackChoiceChips(brief, locale, askedTopicIds),
        };
      }
      return { kind: "question", text, quickReplies: quick.length > 0 ? quick : undefined };
    }

    if (turn.kind === "text") {
      const rawText = turn.text;
      const text = clampTextEmojis(rawText, 1);
      if (looksLikeChoicePrompt(rawText) || looksLikeChoicePrompt(text)) {
        return {
          kind: "suggestions",
          prompt: text,
          chips: fallbackChoiceChips(brief, localeOf(rawText), askedTopicIds),
        };
      }
      return { kind: "text", text };
    }

    return turn;
  } catch (error) {
    console.warn("[normalizeAssistantTurn] failed, returning raw turn:", error);
    return turn;
  }
}
