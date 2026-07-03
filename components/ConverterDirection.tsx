"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { OrderDirection } from "@/lib/supabase/types";

type Ctx = {
  direction: OrderDirection;
  setDirection: (direction: OrderDirection) => void;
  // Bumped only when something outside the converter (the promo banner)
  // asks it to jump to sell — Converter uses this to focus/scroll its input,
  // which a plain tab click should NOT trigger.
  sellFocusToken: number;
  focusSell: () => void;
};

const ConverterDirectionContext = createContext<Ctx | null>(null);

export function ConverterDirectionProvider({ children }: { children: ReactNode }) {
  const [direction, setDirection] = useState<OrderDirection>("buy");
  const [sellFocusToken, setSellFocusToken] = useState(0);

  const focusSell = () => {
    setDirection("sell");
    setSellFocusToken((n) => n + 1);
  };

  return (
    <ConverterDirectionContext.Provider
      value={{ direction, setDirection, sellFocusToken, focusSell }}
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
