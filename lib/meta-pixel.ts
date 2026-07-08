// Meta Pixel event helpers. Everything no-ops when the pixel isn't configured
// (no NEXT_PUBLIC_META_PIXEL_ID) or its script is blocked by the browser.

type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

// The pixel script loads afterInteractive, so an event fired from a mount
// effect can race it — poll briefly instead of dropping the event.
function withFbq(send: (fbq: Fbq) => void) {
  if (typeof window === "undefined" || !META_PIXEL_ID) return;
  if (window.fbq) {
    send(window.fbq);
    return;
  }
  let tries = 0;
  const id = setInterval(() => {
    if (window.fbq) {
      clearInterval(id);
      send(window.fbq);
    } else if (++tries >= 20) {
      clearInterval(id);
    }
  }, 250);
}

export function track(event: string, params?: Record<string, unknown>) {
  withFbq((fbq) => fbq("track", event, ...(params ? [params] : [])));
}

// Advanced Matching: re-init with the user's plain-text email so Meta can
// hash and match it client-side. Call right before a track/trackOnce once the
// email is known — fbq('init', ...) is cheap to repeat and doesn't reset
// event history, but the match data doesn't persist across a fresh page load.
export function setAdvancedMatching(userData: { em?: string }) {
  withFbq((fbq) => fbq("init", META_PIXEL_ID, userData));
}

// One-time conversions (CompleteRegistration, Purchase): a localStorage guard
// keeps repeat visits and re-renders from refiring. Fires anyway if storage
// is unavailable (private mode) — a duplicate beats a lost conversion.
//
// `key` doubles as Meta's eventID: when a server-side Conversions API twin
// exists for this event (lib/meta-capi.ts), passing the same key there makes
// Meta dedupe the two instead of double-counting.
export function trackOnce(
  key: string,
  event: string,
  params?: Record<string, unknown>,
) {
  const storageKey = `fbq_once_${key}`;
  try {
    if (localStorage.getItem(storageKey)) return;
  } catch {}
  withFbq((fbq) => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
    fbq("track", event, params ?? {}, { eventID: key });
  });
}
