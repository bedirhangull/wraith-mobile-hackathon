const TURKISH_CHARS = /[çğıöşüÇĞİÖŞÜ]/;
const TURKISH_WORDS =
  /\b(bir|bu|şu|ve|ile|için|ama|çok|daha|sonra|burada|şimdi|gün|gezi|seyahat|gidiyoruz|geldik|göreceğiz|yemek|mekan)\b/g;

/** Cheap heuristic: treat the last user message as Turkish if it has Turkish letters or common Turkish tokens. */
export function detectReplyLocale(lastUserText: string | undefined): "tr" | "en" {
  if (!lastUserText) return "en";
  if (TURKISH_CHARS.test(lastUserText)) return "tr";
  const lower = lastUserText.toLowerCase();
  if (/\b(merhaba|selam|nereye|uçuş|otel|tatil|lütfen|evet|hayır)\b/.test(lower)) return "tr";
  if ((lower.match(TURKISH_WORDS)?.length ?? 0) >= 2) return "tr";
  return "en";
}
