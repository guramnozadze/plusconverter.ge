import { createHash } from "crypto";
import type { OrderDirection } from "@/lib/supabase/types";

const CAPI_URL = (pixelId: string) =>
  `https://graph.facebook.com/v21.0/${pixelId}/events`;

// The Conversions API expects pre-hashed identifiers (unlike the browser
// pixel, which hashes client-side) — normalize the same way Meta does before
// hashing: trim and lowercase.
function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

type CapiEventInput = {
  eventName: string;
  eventId: string;
  userId: string;
  userEmail: string | null;
  customData?: Record<string, unknown>;
};

// Shared sender for every server-side Meta event. Best-effort: never throws,
// since tracking must never affect the action that triggered it. `eventId`
// must match the browser twin's trackOnce key (lib/meta-pixel.ts) so Meta
// dedupes the two instead of double-counting.
async function sendCapiEvent(input: CapiEventInput): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !accessToken) return;

  const userData: Record<string, string[]> = {
    external_id: [sha256(input.userId)],
  };
  if (input.userEmail) userData.em = [sha256(input.userEmail)];

  const body = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        // Fired from a backend action, not a live website visit.
        action_source: "system_generated",
        user_data: userData,
        ...(input.customData ? { custom_data: input.customData } : {}),
      },
    ],
    access_token: accessToken,
  };

  try {
    const res = await fetch(CAPI_URL(pixelId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(
        `sendCapiEvent(${input.eventName}) failed`,
        res.status,
        await res.text(),
      );
    }
  } catch (err) {
    console.error(`sendCapiEvent(${input.eventName}) failed`, err);
  }
}

type PurchaseCapiInput = {
  orderId: string;
  userId: string;
  userEmail: string | null;
  gelAmount: number;
  direction: OrderDirection;
};

// Server-side mirror of the browser Purchase event (components/OrderView.tsx),
// fired from the admin action that actually completes the order. Catches
// purchases the browser pixel misses when the buyer never reopens the order
// page after admin confirmation.
export function sendPurchaseCapiEvent(input: PurchaseCapiInput): Promise<void> {
  return sendCapiEvent({
    eventName: "Purchase",
    eventId: `purchase_${input.orderId}`,
    userId: input.userId,
    userEmail: input.userEmail,
    customData: {
      value: input.gelAmount,
      currency: "GEL",
      content_category: input.direction,
    },
  });
}

type CompleteRegistrationCapiInput = {
  userId: string;
  userEmail: string | null;
};

// Server-side mirror of the browser CompleteRegistration event. Fired from
// both sign-in paths: app/auth/callback/route.ts for OAuth (that route
// doesn't branch on provider, so this covers Google today and any future
// provider Supabase adds, with no extra code) and lib/actions/auth.ts for
// email OTP, which has no server route of its own to hook into.
export function sendCompleteRegistrationCapiEvent(
  input: CompleteRegistrationCapiInput,
): Promise<void> {
  return sendCapiEvent({
    eventName: "CompleteRegistration",
    eventId: `registration_${input.userId}`,
    userId: input.userId,
    userEmail: input.userEmail,
  });
}

// True only on a user's very first sign-in ever (account creation and this
// login happened together). Meta's event_id dedup window is ~48h, so without
// this guard a returning user re-authenticating weeks later would count as a
// fresh CompleteRegistration instead of being deduped against nothing.
export function isFirstSignIn(user: {
  created_at: string;
  last_sign_in_at?: string | null;
}): boolean {
  const created = new Date(user.created_at).getTime();
  const lastSignIn = new Date(user.last_sign_in_at ?? user.created_at).getTime();
  return Math.abs(lastSignIn - created) < 60_000;
}
