"use client";

import { Suspense, useEffect } from "react";
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
  // Gated on the env var alone: local envs simply don't define it.
  if (!META_PIXEL_ID) return null;
  return (
    <>
      {/* Plain inline tag (not next/script): it shows up in the SSR HTML, so
          a deployed pixel is verifiable with curl, and it executes before
          hydration instead of after. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
      {/* useSearchParams needs a Suspense boundary during prerender */}
      <Suspense fallback={null}>
        <SignInLead />
      </Suspense>
    </>
  );
}
