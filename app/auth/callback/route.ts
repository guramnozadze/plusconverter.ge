import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Marks the redirect as a *completed* sign-in so the client can fire
      // the Meta Pixel `Lead` event (see components/MetaPixel.tsx).
      const url = new URL(redirectTo);
      url.searchParams.set("signed_in", "1");
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
