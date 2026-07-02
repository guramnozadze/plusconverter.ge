import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { BankAccount, Database, Settings } from "@/lib/supabase/types";

const DEFAULT_SETTINGS: Settings = {
  id: 1,
  buy_multiplier: 1.5,
  sell_multiplier: 1.5,
  buy_enabled: true,
  sell_enabled: true,
  timer_minutes: 30,
  buy_min_gel: 0,
  buy_max_points: 0,
  sell_min_points: 0,
  sell_max_gel: 0,
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

// Cached across all requests for an hour — `unstable_cache` can't read the
// per-request auth cookies, so this uses a plain anon client, which is fine
// since get_total_points_sold() is a public, cookie-free RPC.
export const getTotalPointsSold = unstable_cache(
  async (): Promise<number> => {
    const supabase = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data } = await supabase.rpc("get_total_points_sold");
    return data ?? 0;
  },
  ["total-points-sold"],
  { revalidate: 3600 },
);
