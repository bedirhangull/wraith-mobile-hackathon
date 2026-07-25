/** Soft timeout via Promise.race — does NOT abort the underlying fetch.
 * React Native often surfaces AbortController aborts as
 * `FetchRequestCanceledException`, which kills the chat mid-flight.
 * Ignoring a late response is safer than canceling the request. */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
        }, ms);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    // If we timed out first, swallow a late rejection so it isn't unhandled.
    void promise.catch(() => undefined);
  }
}

/** RN wraps cancels as "fetch failed: FetchRequestCanceledException…" — treat those as retryable. */
export function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError") return true;
  if (error instanceof TypeError) return true;
  const message = error.message.toLowerCase();
  return (
    message.includes("fetch request has been canceled") ||
    message.includes("fetchrequestcanceledexception") ||
    message.includes("network request failed") ||
    message.includes("timed out") ||
    message.includes("timeout")
  );
}
