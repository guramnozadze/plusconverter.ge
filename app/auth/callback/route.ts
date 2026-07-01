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
      return NextResponse.redirect(redirectTo);
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
