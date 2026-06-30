import type { OrderDirection, Settings } from "@/lib/supabase/types";

// Bank of Georgia's fixed face value: 1 GEL = 400 PLUS points (never changes).
export const BASE_POINTS_PER_GEL = 400;
// July 5th spend bonus: points are worth double when spent at the bank.
export const JULY_BONUS = 2;

export const POINTS_DECIMALS = 2;
export const GEL_DECIMALS = 2;

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function multiplierFor(
  direction: OrderDirection,
  settings: Pick<Settings, "buy_multiplier" | "sell_multiplier">,
): number {
  return direction === "buy" ? settings.buy_multiplier : settings.sell_multiplier;
}

// The two legs are linked by:  gel = (points / 400) * multiplier
export function gelFromPoints(points: number, multiplier: number): number {
  return round((points / BASE_POINTS_PER_GEL) * multiplier, GEL_DECIMALS);
}

export function pointsFromGel(gel: number, multiplier: number): number {
  if (multiplier <= 0) return 0;
  return round((gel / multiplier) * BASE_POINTS_PER_GEL, POINTS_DECIMALS);
}

// Face value of a points amount at the bank (no multiplier).
export function bankValueGel(points: number): number {
  return round(points / BASE_POINTS_PER_GEL, GEL_DECIMALS);
}

// What the points are worth to spend on July 5th (double face value).
export function julyValueGel(points: number): number {
  return round((points / BASE_POINTS_PER_GEL) * JULY_BONUS, GEL_DECIMALS);
}

export type Quote = {
  /** PLUS points leg. */
  points: number;
  /** GEL leg (paid for buy, received for sell). */
  gel: number;
  /** multiplier applied (also snapshotted onto the order as rate_used). */
  multiplier: number;
};

/**
 * Authoritative quote from a points quantity, shared by the client preview and
 * the server action. `points` is the canonical input for both directions:
 *   - buy:  user receives `points`, pays `gel`
 *   - sell: user sends `points`, receives `gel`
 */
export function quote(
  direction: OrderDirection,
  points: number,
  settings: Pick<Settings, "buy_multiplier" | "sell_multiplier">,
): Quote {
  const multiplier = multiplierFor(direction, settings);
  return {
    points: round(points, POINTS_DECIMALS),
    gel: gelFromPoints(points, multiplier),
    multiplier,
  };
}

export function isDirectionEnabled(
  direction: OrderDirection,
  settings: Pick<Settings, "buy_enabled" | "sell_enabled">,
): boolean {
  return direction === "buy" ? settings.buy_enabled : settings.sell_enabled;
}
