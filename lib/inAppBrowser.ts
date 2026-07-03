const IN_APP_BROWSER_MARKERS = [
  "FBAN",
  "FBAV",
  "Instagram",
  "Line/",
  "MicroMessenger",
  "TikTok",
  "BytedanceWebview",
  "Snapchat",
];

export function isInAppBrowser(userAgent = navigator.userAgent) {
  return IN_APP_BROWSER_MARKERS.some((marker) => userAgent.includes(marker));
}
