import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isFirstSignIn, sendCompleteRegistrationCapiEvent } from "@/lib/meta-capi";

// OAuth callback (non-localized). Supabase redirects here with a `code` that we
// exchange for a session; cookies are written via the server client.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  // Only allow same-origin relative redirects.
  const redirectTo = next.startsWith("/") ? `${origin}${next}` : origin;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // This route doesn't branch on which OAuth provider was used, so this
      // covers Google today and any future provider Supabase adds, with no
      // extra per-provider code.
      const { user } = data;
      if (user && isFirstSignIn(user)) {
        after(() =>
          sendCompleteRegistrationCapiEvent({
            userId: user.id,
            userEmail: user.email ?? null,
          }),
        );
      }
      // Marks the redirect as a *completed* sign-in so the client can fire
      // the Meta Pixel `CompleteRegistration` event (see components/MetaPixel.tsx).
      const url = new URL(redirectTo);
      url.searchParams.set("signed_in", "1");
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
