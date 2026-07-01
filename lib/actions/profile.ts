"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: boolean; error?: string };

// Empty/whitespace inputs are stored as NULL rather than "".
function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// Saves the caller's own profile defaults. RLS (`profiles_update_own`) restricts
// the write to the current user's row regardless of what's passed.
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

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      full_name: clean(input.fullName),
      account_number: clean(input.accountNumber),
    })
    .eq("id", user.id);

  if (error) {
    // Unique violation on the case-insensitive username index.
    if (error.code === "23505") return { ok: false, error: "username_taken" };
    return { ok: false, error: "update_failed" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
