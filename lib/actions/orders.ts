"use server";

import { createClient } from "@/lib/supabase/server";
import { quote, isDirectionEnabled } from "@/lib/pricing";
import type { OrderDirection } from "@/lib/supabase/types";

export type CreateOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

// Authoritative order creation. `points` is the canonical input; the GEL leg and
// the multiplier are recomputed server-side from the settings row, so a client
// cannot forge a favorable price by tampering with the request.
export async function createOrder(input: {
  direction: OrderDirection;
  points: number;
}): Promise<CreateOrderResult> {
  const { direction, points: inputPoints } = input;

  if (direction !== "buy" && direction !== "sell") {
    return { ok: false, error: "invalid_direction" };
  }
  if (!Number.isFinite(inputPoints) || inputPoints <= 0) {
    return { ok: false, error: "invalid_amount" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (!settings) return { ok: false, error: "no_settings" };

  if (!isDirectionEnabled(direction, settings)) {
    return { ok: false, error: "direction_disabled" };
  }

  const { gel, points, multiplier } = quote(direction, inputPoints, settings);

  // Assign the first available bank account (others still shown for scarcity).
  const { data: account } = await supabase
    .from("bank_accounts")
    .select("id")
    .eq("status", "available")
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      direction,
      gel_amount: gel,
      points_amount: points,
      rate_used: multiplier,
      bank_account_id: account?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !order) {
    return { ok: false, error: "insert_failed" };
  }

  return { ok: true, orderId: order.id };
}

// User reports they've paid. Backed by a SECURITY DEFINER RPC that only flips
// `user_confirmed` on the caller's own pending order.
export async function markOrderPaid(orderId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_order_paid", {
    p_order_id: orderId,
  });
  return { ok: !error };
}
