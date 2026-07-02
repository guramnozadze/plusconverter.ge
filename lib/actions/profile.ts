"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

type ActionResult = { ok: boolean; error?: string };

// Empty/whitespace inputs are stored as NULL rather than "".
function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// Saves the caller's own profile defaults. RLS (`profiles_update_own`) restricts
// the write to the current user's row regardless of what's passed. Only keys
// present on `input` are written — omitting a field leaves it untouched,
// so callers (e.g. a username-only prompt) can't accidentally null out
// fields they never showed the user.
export async function saveProfile(input: {
  username?: string;
  fullName?: string;
  accountNumber?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const username = clean(input.username);
  if (username && /\s/.test(username)) {
    return { ok: false, error: "username_invalid" };
  }

  const updates: Partial<Profile> = {};
  if ("username" in input) updates.username = username;
  if ("fullName" in input) updates.full_name = clean(input.fullName);
  if ("accountNumber" in input) updates.account_number = clean(input.accountNumber);

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    // Unique violation on the case-insensitive username index.
    if (error.code === "23505") return { ok: false, error: "username_taken" };
    return { ok: false, error: "update_failed" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
