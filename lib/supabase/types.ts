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
  updated_at: string;
};

export type BankAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
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
  status: OrderStatus;
  user_confirmed: boolean;
  created_at: string;
  completed_at: string | null;
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
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      mark_order_paid: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
