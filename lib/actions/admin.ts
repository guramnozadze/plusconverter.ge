"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BankAccountStatus, OrderStatus } from "@/lib/supabase/types";

type ActionResult = { ok: boolean; error?: string };

// All writes below are additionally guarded by RLS (`is_admin()`), so even if
// these were called by a non-admin the database would reject them.

export async function updateSettings(input: {
  buy_rate: number;
  sell_rate: number;
  buy_enabled: boolean;
  sell_enabled: boolean;
  timer_minutes: number;
}): Promise<ActionResult> {
  if (
    !Number.isFinite(input.buy_rate) ||
    input.buy_rate <= 0 ||
    !Number.isFinite(input.sell_rate) ||
    input.sell_rate <= 0 ||
    !Number.isInteger(input.timer_minutes) ||
    input.timer_minutes <= 0
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
