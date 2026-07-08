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
// page after admin confirmation. Shares the same event_id as the browser
// event so Meta dedupes them if both arrive. Best-effort: never throws, since
// this must not affect order completion.
export async function sendPurchaseCapiEvent(
  input: PurchaseCapiInput,
): Promise<void> {
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
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: `purchase_${input.orderId}`,
        // Fired from a backend admin action, not a live website visit.
        action_source: "system_generated",
        user_data: userData,
        custom_data: {
          value: input.gelAmount,
          currency: "GEL",
          content_category: input.direction,
        },
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
      console.error("sendPurchaseCapiEvent failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("sendPurchaseCapiEvent failed", err);
  }
}
