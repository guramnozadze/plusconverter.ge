// Hand-maintained DB types mirroring supabase/migrations/0001_init.sql.
// Keep in sync with the migration (or regenerate with `supabase gen types`).

export type OrderDirection = "buy" | "sell";
export type OrderStatus = "pending" | "completed" | "cancelled";
export type BankAccountStatus = "available" | "unavailable" | "sold_out";

// NOTE: these are `type` aliases (not `interface`) on purpose — object-literal
// type aliases are assignable to `Record<string, unknown>`, which postgrest-js
// requires for its `Row`/`Insert`/`Update` constraints. Interfaces are not, and
// would make every query result resolve to `never`.

export type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  account_number: string | null;
  is_admin: boolean;
  created_at: string;
};

export type Settings = {
  id: number;
  // Multipliers applied on top of the fixed 400 points/GEL base value.
  buy_multiplier: number;
  sell_multiplier: number;
  buy_enabled: boolean;
  sell_enabled: boolean;
  timer_minutes: number;
  // Thresholds; 0 = no limit. Mins are on the "give" leg (GEL for buy, points
  // for sell). Buy max is the points leg directly; sell max is a GEL budget
  // (what the admin can afford to pay sellers) that the points cap is
  // derived from at the current sell rate.
  buy_min_gel: number;
  buy_max_points: number;
  sell_min_points: number;
  sell_max_gel: number;
  updated_at: string;
};

export type BankAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  id_number: string | null;
  status: BankAccountStatus;
  sort_order: number;
  created_at: string;
};

export type Order = {
  id: string;
  user_id: string;
  direction: OrderDirection;
  gel_amount: number;
  points_amount: number;
  rate_used: number;
  bank_account_id: string | null;
  user_full_name: string | null;
  user_account_number: string | null;
  comment: string | null;
  status: OrderStatus;
  user_confirmed: boolean;
  created_at: string;
  completed_at: string | null;
};

// Public community-feed row. Denormalized on purpose: no user_id, snapshot name.
export type Review = {
  id: string;
  order_id: string;
  display_name: string;
  direction: OrderDirection;
  points_amount: number;
  rating: number | null;
  comment: string | null;
  hidden: boolean;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      settings: {
        Row: Settings;
        Insert: Partial<Settings>;
        Update: Partial<Settings>;
        Relationships: [];
      };
      bank_accounts: {
        Row: BankAccount;
        Insert: Partial<BankAccount> & {
          bank_name: string;
          account_name: string;
          account_number: string;
        };
        Update: Partial<BankAccount>;
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: Partial<Order> & {
          user_id: string;
          direction: OrderDirection;
          gel_amount: number;
          points_amount: number;
          rate_used: number;
        };
        Update: Partial<Order>;
        Relationships: [];
      };
      reviews: {
        Row: Review;
        Insert: Partial<Review> & {
          order_id: string;
          display_name: string;
          direction: OrderDirection;
          points_amount: number;
        };
        Update: Partial<Review>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_total_points_sold: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_platform_stats: {
        Args: Record<string, never>;
        Returns: { total_orders: number; total_points: number }[];
      };
      mark_order_paid: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      submit_review: {
        Args: { p_order_id: string; p_rating: number; p_comment: string | null };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
