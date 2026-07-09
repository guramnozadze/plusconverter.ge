"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { submitReview } from "@/lib/actions/reviews";

// Leave a one-time rating (+ optional comment) for a completed order.
export function ReviewForm({ orderId }: { orderId: string }) {
  const t = useTranslations("reviews");
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p className="surface-card rounded-xl border p-4 text-center text-sm text-green-600 dark:text-green-400">
        {t("submitted")}
      </p>
    );
  }

  async function submit() {
    if (rating < 1) return;
    setError(null);
    setBusy(true);
    const res = await submitReview({ orderId, rating, comment });
    if (res.ok) {
      setDone(true);
      router.refresh();
    } else {
      setError(res.error ?? "review_failed");
      setBusy(false);
    }
  }

  return (
    <div className="surface-card rounded-xl border p-4 space-y-3">
      <p className="text-sm font-medium">{t("leaveReview")}</p>

      {/* Star selector */}
      <div className="flex gap-1" role="radiogroup" aria-label={t("rating")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={String(n)}
            aria-checked={rating === n}
            role="radio"
            className={`text-2xl leading-none transition-colors ${
              (hover || rating) >= n ? "text-amber-400" : "text-foreground/25"
            }`}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("commentPlaceholder")}
        maxLength={500}
        rows={3}
        className="w-full resize-none rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/30"
      />

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {t(error === "already_reviewed" ? "alreadyReviewed" : "error")}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={rating < 1 || busy}
        className="w-full rounded-lg bg-foreground text-background py-2.5 text-sm font-medium disabled:opacity-40"
      >
        {t("submit")}
      </button>
    </div>
  );
}
