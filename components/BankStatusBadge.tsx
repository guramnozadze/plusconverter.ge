import { useTranslations } from "next-intl";
import type { BankAccountStatus } from "@/lib/supabase/types";

const STYLES: Record<BankAccountStatus, string> = {
  available:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  unavailable: "bg-black/10 text-foreground/60 dark:bg-white/10",
  sold_out: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export function BankStatusBadge({ status }: { status: BankAccountStatus }) {
  const t = useTranslations("bankStatus");
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {t(status)}
    </span>
  );
}
