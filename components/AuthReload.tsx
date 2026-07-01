"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// Keeps server-rendered auth state (Header, via getUserProfile) in sync with
// the browser. Two mechanisms, since either can be the one that actually
// fires depending on how the OAuth redirect lands:
//
// 1. Consumes the `authed=1` marker our /auth/callback route appends after a
//    server-side code exchange, forcing one real hard reload (fresh document
//    fetch) so Header reflects the new session immediately.
// 2. In production the Supabase redirect can land the `code` param on a page
//    other than /auth/callback (e.g. if that exact URL isn't in the
//    project's allowed redirect list) — the browser SDK's `detectSessionInUrl`
//    then exchanges it client-side instead, which our server-rendered Header
//    never learns about on its own. `onAuthStateChange` + `router.refresh()`
//    re-fetches the server render whenever the client-side session changes,
//    regardless of which path created it.
export function AuthReload() {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("authed")) return;
    url.searchParams.delete("authed");
    window.location.replace(url.pathname + url.search + url.hash);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // onAuthStateChange fires an extra synthetic event (INITIAL_SESSION)
      // as soon as we subscribe, on top of whatever real transition is in
      // flight (e.g. a client-side code exchange after OAuth). Refreshing on
      // every event re-fetched the same URL 2-3x in a row; only SIGNED_IN /
      // SIGNED_OUT represent an actual state change worth a re-render.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
