"use server";

import { createClient } from "@/lib/supabase/server";
import { quote, isDirectionEnabled, minGive, maxPoints } from "@/lib/pricing";
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
  // The account the user picked on the selection step. Validated server-side;
  // we never trust that it's available just because the client offered it.
  bankAccountId?: string;
  // The user's own bank details for this order, snapshotted onto the row so it
  // never changes if the user later edits their profile defaults.
  fullName?: string;
  accountNumber?: string;
  // Optional free-text note from the user (e.g. a phone number for support).
  comment?: string;
}): Promise<CreateOrderResult> {
  const { direction, points: inputPoints, bankAccountId } = input;
  const userFullName = input.fullName?.trim() || null;
  const userAccountNumber = input.accountNumber?.trim() || null;
  const comment = input.comment?.trim().slice(0, 500) || null;

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

  // Re-validate thresholds server-side — the client already gates on these,
  // but a client can't be trusted not to bypass its own checks.
  const giveAmount = direction === "buy" ? gel : points;
  const min = minGive(direction, settings);
  if (min > 0 && giveAmount < min) {
    return { ok: false, error: "below_minimum" };
  }
  const max = maxPoints(direction, settings);
  if (max > 0 && points > max) {
    return { ok: false, error: "above_maximum" };
  }

  // Resolve the bank account: use the one the user picked (must still be
  // available), otherwise fall back to the first available one.
  let accountId: string | null;
  if (bankAccountId) {
    const { data: picked } = await supabase
      .from("bank_accounts")
      .select("id, status")
      .eq("id", bankAccountId)
      .maybeSingle();
    if (!picked || picked.status !== "available") {
      return { ok: false, error: "account_unavailable" };
    }
    accountId = picked.id;
  } else {
    const { data: account } = await supabase
      .from("bank_accounts")
      .select("id")
      .eq("status", "available")
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    accountId = account?.id ?? null;
  }

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      direction,
      gel_amount: gel,
      points_amount: points,
      rate_used: multiplier,
      bank_account_id: accountId,
      user_full_name: userFullName,
      user_account_number: userAccountNumber,
      comment,
    })
    .select("id")
    .single();

  if (error || !order) {
    // The DB trigger (0008) re-validates everything this action already
    // checked, as defense-in-depth against a client bypassing this action
    // entirely. Surface its exception message as the same kind of error code.
    const dbError = error?.message ?? "";
    const known = [
      "direction_disabled",
      "below_minimum",
      "above_maximum",
      "order_limit_reached",
      "account_unavailable",
      "no_settings",
    ];
    const matched = known.find((code) => dbError.includes(code));
    return { ok: false, error: matched ?? "insert_failed" };
  }

  // Backfill the profile's defaults from this order if the user never set
  // them, so the next order prefills without asking again. Never overwrites
  // an existing value, and failure here shouldn't fail the order itself.
  if (userFullName || userAccountNumber) {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("full_name, account_number")
      .eq("id", user.id)
      .single();

    const profileUpdates: { full_name?: string; account_number?: string } = {};
    if (userFullName && !existingProfile?.full_name) {
      profileUpdates.full_name = userFullName;
    }
    if (userAccountNumber && !existingProfile?.account_number) {
      profileUpdates.account_number = userAccountNumber;
    }

    if (Object.keys(profileUpdates).length > 0) {
      await supabase.from("profiles").update(profileUpdates).eq("id", user.id);
    }
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
