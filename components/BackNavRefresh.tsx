"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

// Next's client router occasionally updates the URL bar on browser back/
// forward (a `popstate`) without actually swapping the rendered segment -
// the address bar shows the previous page but the DOM still shows the one
// you navigated away from (e.g. going back from /order/new to / after the
// converter's `router.push`). `router.refresh()` re-fetches the current
// route's RSC payload and forces the tree to resync with the URL. Cheap
// here since the whole app already renders `force-dynamic` (see the layout
// comment on that flag) - every route is fetched fresh on normal
// navigation anyway, this just closes the gap for the popstate case.
export function BackNavRefresh() {
  const router = useRouter();

  useEffect(() => {
    const onPopState = () => router.refresh();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);

  return null;
}
