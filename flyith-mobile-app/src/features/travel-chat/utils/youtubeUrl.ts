/**
 * Extract a YouTube video id from common share / embed / shorts URLs.
 * Returns null when the text is not a recognizable YouTube link.
 */
export function extractYouTubeVideoId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Bare 11-char id pasted alone
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  let url: URL;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    url = new URL(withProtocol);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  const isYouTube =
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "youtu.be";
  if (!isYouTube) return null;

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return isVideoId(id) ? id! : null;
  }

  const v = url.searchParams.get("v");
  if (isVideoId(v)) return v!;

  const pathMatch = url.pathname.match(
    /^\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})(?:\/|$)/i
  );
  if (pathMatch?.[1]) return pathMatch[1];

  return null;
}

export function isYouTubeUrl(text: string): boolean {
  return extractYouTubeVideoId(text) != null && /youtu\.?be/i.test(text);
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function isVideoId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{11}$/.test(value);
}
