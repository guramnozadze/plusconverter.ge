import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { fetchWithTimeout } from "@/lib/supabase/fetch-with-timeout";
import type { BankAccount, Database, Review, Settings } from "@/lib/supabase/types";

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
// yet so the converter still renders. Cached (world-readable, RLS "settings_select_all")
// and tag-invalidated the instant an admin saves changes (lib/actions/admin.ts), so
// caching here can't show a stale rate for longer than it takes the admin's own write
// to complete. createOrder (lib/actions/orders.ts) re-reads this table directly and
// never trusts this cached copy, so pricing correctness is unaffected either way.
export const getSettings = unstable_cache(
  async (): Promise<Settings> => {
    const supabase = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { fetch: fetchWithTimeout() } },
    );
    const { data } = await supabase
      .from("settings")
      .select("*")
      .eq("id", 1)
      .single();
    return data ?? DEFAULT_SETTINGS;
  },
  ["settings"],
  { revalidate: 3600, tags: ["settings"] },
);

// Same reasoning as getSettings above: world-readable (RLS "bank_accounts_select_all"),
// tag-invalidated on any admin write (lib/actions/admin.ts).
export const getBankAccounts = unstable_cache(
  async (): Promise<BankAccount[]> => {
    const supabase = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { fetch: fetchWithTimeout() } },
    );
    const { data } = await supabase
      .from("bank_accounts")
      .select("*")
      .order("sort_order", { ascending: true });
    return data ?? [];
  },
  ["bank-accounts"],
  { revalidate: 3600, tags: ["bank-accounts"] },
);

export type PlatformStats = { totalOrders: number; totalPoints: number; totalUsers: number };

const DEFAULT_PLATFORM_STATS: PlatformStats = {
  totalOrders: 0,
  totalPoints: 0,
  totalUsers: 0,
};

// Cached across all requests for an hour — unstable_cache can't read the
// per-request auth cookies, so this uses a plain anon client, which is fine
// since get_platform_stats() is a public, cookie-free RPC.
export const getPlatformStats = unstable_cache(
  async (): Promise<PlatformStats> => {
    const supabase = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { fetch: fetchWithTimeout() } },
    );
    const { data } = await supabase.rpc("get_platform_stats");
    const row = data?.[0];
    if (!row) return DEFAULT_PLATFORM_STATS;
    return {
      totalOrders: row.total_orders,
      totalPoints: row.total_points,
      totalUsers: row.total_users,
    };
  },
  ["platform-stats"],
  { revalidate: 3600 },
);

// Cached across all requests for 5 minutes — the homepage community feed
// doesn't need to be instant. Tagged "reviews" so submitting or
// hiding/unhiding a review (lib/actions/reviews.ts, lib/actions/admin.ts)
// can force it fresh immediately via revalidateTag instead of waiting out
// the window. Public/non-hidden rows only, so the plain anon client is fine.
export const getReviewsFeed = unstable_cache(
  async (): Promise<Review[]> => {
    const supabase = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { fetch: fetchWithTimeout() } },
    );
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("hidden", false)
      .order("created_at", { ascending: false });
    return (data ?? []) as Review[];
  },
  ["reviews-feed"],
  { revalidate: 300, tags: ["reviews"] },
);
