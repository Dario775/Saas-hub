/**
 * Helper utility to perform fetch requests with exponential backoff retries.
 * Particularly useful for handling rate limits (HTTP 429) and transient server errors (HTTP 5xx).
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  initialDelay = 1000
): Promise<Response> {
  let lastResponse: Response | null = null;
  let lastError: any = null;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }

      lastResponse = response;

      // Retry on 429 (Too Many Requests) or 5xx server errors (transient errors)
      if (response.status === 429 || response.status >= 500) {
        const backoff = initialDelay * Math.pow(2, i);
        console.warn(
          `[fetchWithRetry] Status ${response.status} detected. Retrying in ${backoff}ms... (Attempt ${i + 1} of ${retries})`
        );
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      // For other client errors (400, 401, 403, 404, etc.), do not retry and return immediately
      return response;
    } catch (error) {
      lastError = error;
      const backoff = initialDelay * Math.pow(2, i);
      console.warn(
        `[fetchWithRetry] Network error: ${
          error instanceof Error ? error.message : String(error)
        }. Retrying in ${backoff}ms... (Attempt ${i + 1} of ${retries})`
      );
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  if (lastResponse) {
    return lastResponse;
  }
  throw lastError || new Error(`Failed to fetch after ${retries} attempts`);
}
