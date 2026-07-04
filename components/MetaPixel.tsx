"use client";

import { Suspense, useEffect } from "react";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { META_PIXEL_ID, trackOnce } from "@/lib/meta-pixel";

// The OAuth callback route appends ?signed_in=1 to its redirect so the app
// can tell a *completed* sign-in from a mere button click. Fire `Lead` once
// per browser, then strip the marker so refreshes and copied links are clean.
function SignInLead() {
  const signedIn = useSearchParams().get("signed_in") === "1";

  useEffect(() => {
    if (!signedIn) return;
    trackOnce("lead", "Lead");
    const url = new URL(window.location.href);
    url.searchParams.delete("signed_in");
    window.history.replaceState(null, "", url);
  }, [signedIn]);

  return null;
}

export function MetaPixel() {
  // Production only: `npm run dev` sessions must not feed the real dataset.
  if (!META_PIXEL_ID || process.env.NODE_ENV !== "production") return null;
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      {/* useSearchParams needs a Suspense boundary during prerender */}
      <Suspense fallback={null}>
        <SignInLead />
      </Suspense>
    </>
  );
}
