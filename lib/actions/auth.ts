"use server";

import { createClient } from "@/lib/supabase/server";
import { isFirstSignIn, sendCompleteRegistrationCapiEvent } from "@/lib/meta-capi";

// Called by the client right after supabase.auth.verifyOtp() succeeds — email
// OTP has no server route in the middle to hook into, unlike the OAuth
// callback (app/auth/callback/route.ts). Re-validates the session server-side
// via getUser() rather than trusting the client for the identity used in the
// CAPI call.
export async function reportCompleteRegistration(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isFirstSignIn(user)) return;
  await sendCompleteRegistrationCapiEvent({
    userId: user.id,
    userEmail: user.email ?? null,
  });
}
