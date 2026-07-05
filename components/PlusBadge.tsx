import { useTranslations } from "next-intl";

// The "PLUS Points" unit, shown as a pleasant orange pill. `whitespace-nowrap`
// keeps it from breaking across two lines in tight input suffixes. On mobile
// the pill only shows "PLUS" — the unit word ("ქულას") is dropped to keep it
// compact — and reappears at the `sm` breakpoint and up. Pass `expandOnMobile`
// (the buy side, where points are what the user receives) to keep the full
// unit word visible on mobile too.
export function PlusBadge({
  className = "",
  expandOnMobile = false,
}: {
  className?: string;
  expandOnMobile?: boolean;
}) {
  const t = useTranslations("converter");
  const [brand, ...rest] = t("points").split(" ");
  const unit = rest.join(" ");
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 ${className}`}
    >
      {brand}
      {unit && (
        <span className={expandOnMobile ? "inline" : "hidden sm:inline"}>
          &nbsp;{unit}
        </span>
      )}
    </span>
  );
}
