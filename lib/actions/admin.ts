"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BankAccountStatus, OrderStatus } from "@/lib/supabase/types";

type ActionResult = { ok: boolean; error?: string };

// All writes below are additionally guarded by RLS (`is_admin()`), so even if
// these were called by a non-admin the database would reject them.

export async function updateSettings(input: {
  buy_multiplier: number;
  sell_multiplier: number;
  buy_enabled: boolean;
  sell_enabled: boolean;
  timer_minutes: number;
  // Thresholds; 0 = no limit.
  buy_min_gel: number;
  buy_max_points: number;
  sell_min_points: number;
  sell_max_gel: number;
}): Promise<ActionResult> {
  if (
    !Number.isFinite(input.buy_multiplier) ||
    input.buy_multiplier <= 0 ||
    !Number.isFinite(input.sell_multiplier) ||
    input.sell_multiplier <= 0 ||
    !Number.isInteger(input.timer_minutes) ||
    input.timer_minutes <= 0 ||
    !Number.isFinite(input.buy_min_gel) ||
    input.buy_min_gel < 0 ||
    !Number.isFinite(input.buy_max_points) ||
    input.buy_max_points < 0 ||
    !Number.isFinite(input.sell_min_points) ||
    input.sell_min_points < 0 ||
    !Number.isFinite(input.sell_max_gel) ||
    input.sell_max_gel < 0
  ) {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function createBankAccount(input: {
  bank_name: string;
  account_name: string;
  account_number: string;
  id_number?: string;
  status: BankAccountStatus;
  sort_order: number;
}): Promise<ActionResult> {
  if (!input.bank_name || !input.account_name || !input.account_number) {
    return { ok: false, error: "invalid_input" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("bank_accounts").insert(input);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function updateBankAccountStatus(
  id: string,
  status: BankAccountStatus,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bank_accounts")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteBankAccount(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

// Hide/unhide a community review. RLS (`reviews_update_admin`) enforces admin.
export async function setReviewHidden(
  reviewId: string,
  hidden: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reviews")
    .update({ hidden })
    .eq("id", reviewId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath("/", "layout");
  return { ok: true };
}
