import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

// Browser-side Supabase client (used in Client Components for Realtime, auth, etc.)
// Singleton: several components call this independently, and each
// createBrowserClient() call spins up its own GoTrueClient, which on mount
// checks the URL for an OAuth `code` param and tries to exchange it. Multiple
// instances doing that concurrently race to consume the same one-time-use
// code — only one can win, and losers fail silently (the SDK swallows the
// error and skips its URL-cleanup step on failure). One shared instance
// means the exchange only ever runs once.
let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}
