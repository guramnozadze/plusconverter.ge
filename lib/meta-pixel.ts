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

// One-time conversions (Lead, Purchase): a localStorage guard keeps repeat
// visits and re-renders from refiring. Fires anyway if storage is unavailable
// (private mode) — a duplicate beats a lost conversion.
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
    fbq("track", event, ...(params ? [params] : []));
  });
}
