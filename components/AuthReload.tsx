"use client";

import { useEffect } from "react";

// Consumes the `authed=1` marker the OAuth callback appends to its redirect.
// Forces one real hard reload (fresh document fetch) so the header reliably
// reflects the just-created session, working around production-only
// staleness that a soft `router.refresh()` doesn't fix. Self-limiting: the
// marker is stripped before reloading, so this can't loop.
export function AuthReload() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("authed")) return;
    url.searchParams.delete("authed");
    window.location.replace(url.pathname + url.search + url.hash);
  }, []);

  return null;
}
