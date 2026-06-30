import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renamed `middleware` → `proxy` (Node runtime, no edge). We compose
// two concerns into the single allowed proxy:
//   1. next-intl locale routing (produces the NextResponse)
//   2. Supabase auth session refresh (writes rotated cookies onto that response)
const handleI18nRouting = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);
  return updateSession(request, response);
}

export const config = {
  // Run on everything except API routes, the non-localized /auth callback,
  // Next internals, and files with an extension (e.g. favicon.ico).
  matcher: "/((?!api|auth|_next|_vercel|.*\\..*).*)",
};
