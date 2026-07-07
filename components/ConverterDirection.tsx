"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { OrderDirection } from "@/lib/supabase/types";

type Ctx = {
  direction: OrderDirection;
  setDirection: (direction: OrderDirection) => void;
  // Bumped only when something outside the converter (the promo banner)
  // asks it to jump to a direction — Converter uses this to focus/scroll its
  // input, which a plain tab click should NOT trigger.
  focusToken: number;
  // Set alongside focusToken when the caller wants the "give" input
  // pre-filled (e.g. the promo banner's example amount).
  focusAmount: number | null;
  focusDirection: (direction: OrderDirection, amount?: number) => void;
};

const ConverterDirectionContext = createContext<Ctx | null>(null);

export function ConverterDirectionProvider({ children }: { children: ReactNode }) {
  const [direction, setDirection] = useState<OrderDirection>("sell");
  const [focusToken, setFocusToken] = useState(0);
  const [focusAmount, setFocusAmount] = useState<number | null>(null);

  const focusDirection = (next: OrderDirection, amount?: number) => {
    setDirection(next);
    setFocusAmount(amount ?? null);
    setFocusToken((n) => n + 1);
  };

  return (
    <ConverterDirectionContext.Provider
      value={{ direction, setDirection, focusToken, focusAmount, focusDirection }}
    >
      {children}
    </ConverterDirectionContext.Provider>
  );
}

export function useConverterDirection() {
  const ctx = useContext(ConverterDirectionContext);
  if (!ctx) {
    throw new Error(
      "useConverterDirection must be used within ConverterDirectionProvider",
    );
  }
  return ctx;
}
