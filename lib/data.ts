import { createClient } from "@/lib/supabase/server";
import type { BankAccount, Settings } from "@/lib/supabase/types";

const DEFAULT_SETTINGS: Settings = {
  id: 1,
  buy_multiplier: 1.5,
  sell_multiplier: 1.5,
  buy_enabled: true,
  sell_enabled: true,
  timer_minutes: 30,
  updated_at: new Date(0).toISOString(),
};

// Reads the singleton settings row. Falls back to defaults if it isn't seeded
// yet so the converter still renders.
export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();
  return data ?? DEFAULT_SETTINGS;
}

export async function getBankAccounts(): Promise<BankAccount[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("sort_order", { ascending: true });
  return data ?? [];
}
