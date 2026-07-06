const DEFAULT_TIMEOUT_MS = 10_000;

// A stalled upstream request should fail fast, not hold a Fluid function open
// until the platform kills it at the 300s ceiling. Pass as `global.fetch` to
// createClient/createServerClient.
export function fetchWithTimeout(timeoutMs = DEFAULT_TIMEOUT_MS): typeof fetch {
  return (input, init) =>
    fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}
