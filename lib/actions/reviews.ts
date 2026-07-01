"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: boolean; error?: string };

// Error tokens raised by the submit_review RPC (`raise exception '<token>'`).
const KNOWN_ERRORS = new Set([
  "order_not_reviewable",
  "no_username",
  "invalid_rating",
  "already_reviewed",
]);

// Submit a one-time rating (+ optional comment) for the caller's own completed
// order. Ownership, completion, username and immutability are all enforced by
// the SECURITY DEFINER RPC; RLS is defense-in-depth.
export async function submitReview(input: {
  orderId: string;
  rating: number;
  comment?: string;
}): Promise<ActionResult> {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false, error: "invalid_rating" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const comment = input.comment?.trim().slice(0, 500) || null;

  const { error } = await supabase.rpc("submit_review", {
    p_order_id: input.orderId,
    p_rating: input.rating,
    p_comment: comment,
  });

  if (error) {
    // Postgres exception messages come through on `error.message`.
    const token = KNOWN_ERRORS.has(error.message) ? error.message : "review_failed";
    return { ok: false, error: token };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
