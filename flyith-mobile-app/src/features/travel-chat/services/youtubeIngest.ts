import { getYouTubeTranscript, getYouTubeVideo } from "./serpapi";
import type {
  SerpApiYouTubeTranscriptChapter,
  SerpApiYouTubeTranscriptSegment,
  SerpApiYouTubeVideoChapter,
  SerpApiYouTubeVideoResponse,
} from "./serpapi.types";
import { extractYouTubeVideoId, youtubeWatchUrl } from "../utils/youtubeUrl";

export interface YouTubeVideoSource {
  videoId: string;
  url: string;
  title: string;
  thumbnailUrl?: string;
  channelName?: string;
  channelThumbnailUrl?: string;
  publishedDate?: string;
  description?: string;
  views?: number;
  likes?: number;
  /** Chapters from the video metadata response. */
  chapters: { title: string; startMs: number }[];
  hasTranscriptLink: boolean;
}

export interface YouTubeTranscriptSource {
  segments: { startMs: number; text: string; startTimeText?: string }[];
  chapters: { title: string; startMs: number }[];
  languageCode: string;
}

export interface YouTubeIngestResult {
  video: YouTubeVideoSource;
  transcript: YouTubeTranscriptSource | null;
  /** How text context was built for Gemini. */
  textSource: "transcript" | "description_chapters" | "metadata_only";
  /** Compact text blob for LLM analysis (never store raw full transcript in brief). */
  analysisText: string;
}

const videoCache = new Map<string, YouTubeVideoSource>();
const transcriptCache = new Map<string, YouTubeTranscriptSource | null>();
const inflightVideo = new Map<string, Promise<YouTubeVideoSource>>();
const inflightTranscript = new Map<string, Promise<YouTubeTranscriptSource | null>>();

export function clearYouTubeCaches(): void {
  videoCache.clear();
  transcriptCache.clear();
  inflightVideo.clear();
  inflightTranscript.clear();
}

function mapVideo(videoId: string, response: SerpApiYouTubeVideoResponse): YouTubeVideoSource {
  const chapters = (response.chapters ?? []).map((chapter: SerpApiYouTubeVideoChapter) => ({
    title: chapter.title,
    startMs: Math.max(0, Math.round((chapter.time_start ?? 0) * 1000)),
  }));

  return {
    videoId,
    url: youtubeWatchUrl(videoId),
    title: response.title?.trim() || "YouTube video",
    thumbnailUrl: response.thumbnail,
    channelName: response.channel?.name,
    channelThumbnailUrl: response.channel?.thumbnail,
    publishedDate: response.published_date,
    description: response.description?.content?.trim() || undefined,
    views: response.extracted_views,
    likes: response.extracted_likes,
    chapters,
    hasTranscriptLink: Boolean(response.transcript?.serpapi_link),
  };
}

function mapTranscript(
  response: {
    transcript?: SerpApiYouTubeTranscriptSegment[];
    chapters?: SerpApiYouTubeTranscriptChapter[];
  },
  languageCode: string
): YouTubeTranscriptSource | null {
  const segments = (response.transcript ?? [])
    .filter((segment) => Boolean(segment.snippet?.trim()))
    .map((segment) => ({
      startMs: segment.start_ms,
      text: segment.snippet.trim(),
      startTimeText: segment.start_time_text,
    }));

  if (segments.length === 0) return null;

  return {
    segments,
    chapters: (response.chapters ?? []).map((chapter) => ({
      title: chapter.chapter,
      startMs: chapter.start_ms,
    })),
    languageCode,
  };
}

async function fetchVideoCached(videoId: string): Promise<YouTubeVideoSource> {
  const cached = videoCache.get(videoId);
  if (cached) return cached;

  const existing = inflightVideo.get(videoId);
  if (existing) return existing;

  const promise = (async () => {
    const response = await getYouTubeVideo(videoId);
    const mapped = mapVideo(videoId, response);
    videoCache.set(videoId, mapped);
    return mapped;
  })().finally(() => {
    inflightVideo.delete(videoId);
  });

  inflightVideo.set(videoId, promise);
  return promise;
}

async function fetchTranscriptCached(
  videoId: string,
  languageCode: string
): Promise<YouTubeTranscriptSource | null> {
  const cacheKey = `${videoId}|${languageCode}`;
  if (transcriptCache.has(cacheKey)) return transcriptCache.get(cacheKey) ?? null;

  const existing = inflightTranscript.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const response = await getYouTubeTranscript(videoId, languageCode);
      const mapped = mapTranscript(response, languageCode);
      if (mapped || languageCode === "en") {
        transcriptCache.set(cacheKey, mapped);
        return mapped;
      }
      const fallback = await getYouTubeTranscript(videoId, "en");
      const fallbackMapped = mapTranscript(fallback, "en");
      transcriptCache.set(cacheKey, fallbackMapped);
      return fallbackMapped;
    } catch {
      // Language mismatch / unavailable — try English once as a controlled fallback.
      if (languageCode !== "en") {
        try {
          const fallback = await getYouTubeTranscript(videoId, "en");
          const mapped = mapTranscript(fallback, "en");
          transcriptCache.set(cacheKey, mapped);
          return mapped;
        } catch {
          transcriptCache.set(cacheKey, null);
          return null;
        }
      }
      transcriptCache.set(cacheKey, null);
      return null;
    }
  })().finally(() => {
    inflightTranscript.delete(cacheKey);
  });

  inflightTranscript.set(cacheKey, promise);
  return promise;
}

/** Exported for unit tests — prefer transcript, else description+chapters. */
export function buildAnalysisText(
  video: YouTubeVideoSource,
  transcript: YouTubeTranscriptSource | null
): { text: string; textSource: YouTubeIngestResult["textSource"] } {
  const header = [
    `Title: ${video.title}`,
    video.channelName ? `Channel: ${video.channelName}` : null,
    video.publishedDate ? `Published: ${video.publishedDate}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (transcript && transcript.segments.length > 0) {
    // Cap length so Gemini stays within practical token budget.
    const joined = transcript.segments
      .map((segment) => `[${segment.startTimeText ?? msToClock(segment.startMs)}] ${segment.text}`)
      .join("\n");
    const capped = joined.length > 24_000 ? `${joined.slice(0, 24_000)}\n…` : joined;
    const chapterBlock =
      transcript.chapters.length > 0
        ? `\nChapters:\n${transcript.chapters
            .map((chapter) => `- [${msToClock(chapter.startMs)}] ${chapter.title}`)
            .join("\n")}`
        : "";
    return {
      textSource: "transcript",
      text: `${header}${chapterBlock}\n\nTranscript:\n${capped}`,
    };
  }

  const chapters =
    video.chapters.length > 0
      ? `\nChapters:\n${video.chapters
          .map((chapter) => `- [${msToClock(chapter.startMs)}] ${chapter.title}`)
          .join("\n")}`
      : "";
  if (video.description || video.chapters.length > 0) {
    return {
      textSource: "description_chapters",
      text: `${header}${chapters}\n\nDescription:\n${video.description ?? "(none)"}`,
    };
  }

  return {
    textSource: "metadata_only",
    text: header,
  };
}

function msToClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Resolve a pasted YouTube URL into metadata + optional transcript for travel analysis.
 * Never uses the sample API key from docs — always goes through `env.serpApiKey`.
 */
export async function ingestYouTubeUrl(
  rawUrl: string,
  options?: { languageCode?: string }
): Promise<YouTubeIngestResult> {
  const videoId = extractYouTubeVideoId(rawUrl);
  if (!videoId) {
    throw new Error("Not a recognizable YouTube URL");
  }

  const languageCode = options?.languageCode ?? "en";
  const video = await fetchVideoCached(videoId);

  let transcript: YouTubeTranscriptSource | null = null;
  if (video.hasTranscriptLink) {
    transcript = await fetchTranscriptCached(videoId, languageCode);
  }

  const { text, textSource } = buildAnalysisText(video, transcript);
  return { video, transcript, textSource, analysisText: text };
}
