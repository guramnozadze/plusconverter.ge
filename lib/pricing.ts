import type { OrderDirection, Settings } from "@/lib/supabase/types";

export const POINTS_DECIMALS = 2;
export const GEL_DECIMALS = 2;

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export type Conversion = {
  /** GEL leg of the trade. */
  gel: number;
  /** PLUS points leg of the trade. */
  points: number;
  /** points-per-GEL rate applied. */
  rate: number;
};

/**
 * Canonical conversion math, shared by the client converter (preview) and the
 * server action (authoritative). `inputAmount` is interpreted per direction:
 *   - buy:  the user pays this many GEL and receives points
 *   - sell: the user sends this many points and receives GEL
 */
export function computeConversion(
  direction: OrderDirection,
  inputAmount: number,
  settings: Pick<Settings, "buy_rate" | "sell_rate">,
): Conversion {
  if (direction === "buy") {
    const rate = settings.buy_rate;
    return {
      gel: round(inputAmount, GEL_DECIMALS),
      points: round(inputAmount * rate, POINTS_DECIMALS),
      rate,
    };
  }

  const rate = settings.sell_rate;
  return {
    gel: round(inputAmount / rate, GEL_DECIMALS),
    points: round(inputAmount, POINTS_DECIMALS),
    rate,
  };
}

export function isDirectionEnabled(
  direction: OrderDirection,
  settings: Pick<Settings, "buy_enabled" | "sell_enabled">,
): boolean {
  return direction === "buy" ? settings.buy_enabled : settings.sell_enabled;
}
