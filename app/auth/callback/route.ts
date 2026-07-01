import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
      // The session just changed; every page under the locale layout (which
      // reads the auth cookie in Header) needs its cached render invalidated,
      // or the landing page can render stale signed-out markup post-redirect.
      revalidatePath("/", "layout");
      // In production the very first render after this redirect can still
      // show signed-out markup (cache/propagation lag we haven't root-caused
      // yet). `authed=1` tells AuthReload to force one real hard reload —
      // a fresh document fetch, not a soft RSC refresh — the first time the
      // landing page mounts.
      const url = new URL(redirectTo);
      url.searchParams.set("authed", "1");
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
