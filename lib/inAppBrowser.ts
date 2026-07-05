import { useSyncExternalStore } from "react";

const IN_APP_BROWSER_MARKERS = [
  "FBAN",
  "FBAV",
  "Instagram",
  "Line/",
  "MicroMessenger",
  "TikTok",
  "BytedanceWebview",
  "Snapchat",
];

export function isInAppBrowser(userAgent = navigator.userAgent) {
  return IN_APP_BROWSER_MARKERS.some((marker) => userAgent.includes(marker));
}

// The user agent never changes within a page lifetime, so the "store" never
// emits updates.
const noopSubscribe = () => () => {};

// Render-safe variant: UA sniffing needs `navigator`, so the server snapshot
// answers false and hydration swaps in the real value.
export function useIsInAppBrowser() {
  return useSyncExternalStore(noopSubscribe, isInAppBrowser, () => false);
}
