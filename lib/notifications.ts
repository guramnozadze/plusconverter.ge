const RESEND_API_URL = "https://api.resend.com/emails";
const ORDER_ALERT_EMAIL = "gukanozadze@gmail.com";
const ORDER_ALERT_FROM = "PLUS Converter <onboarding@resend.dev>";

type OrderAlertInput = {
  orderId: string;
  direction: "buy" | "sell";
  gelAmount: number;
  pointsAmount: number;
  userEmail: string | null;
  userFullName: string | null;
  userAccountNumber: string | null;
  comment: string | null;
};

// Best-effort alert to the site owner via Resend. Never throws — called from
// `after()` in createOrder, so a delivery failure must not affect the order.
export async function sendOrderAlertEmail(input: OrderAlertInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const directionLabel = input.direction === "buy" ? "BUY" : "SELL";

  const lines = [
    `Direction: ${directionLabel}`,
    `Points: ${input.pointsAmount}`,
    `GEL: ${input.gelAmount}`,
    input.userEmail ? `Email: ${input.userEmail}` : null,
    input.userFullName ? `Name: ${input.userFullName}` : null,
    input.userAccountNumber ? `Account #: ${input.userAccountNumber}` : null,
    input.comment ? `Comment: ${input.comment}` : null,
    `Order ID: ${input.orderId}`,
  ].filter((line): line is string => line !== null);

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: ORDER_ALERT_FROM,
        to: ORDER_ALERT_EMAIL,
        subject: `New ${directionLabel} order — ${input.pointsAmount} pts`,
        text: lines.join("\n"),
      }),
    });
    if (!res.ok) {
      console.error("sendOrderAlertEmail failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("sendOrderAlertEmail failed", err);
  }
}

// Bank of Georgia's own SMS confirmation to the customer is unreliable
// between 22:00-10:00 Tbilisi time, so during that window we email them a
// receipt instead. Checked against Asia/Tbilisi regardless of server TZ.
function isBogSmsBlackout(date: Date): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tbilisi",
      hour: "numeric",
      hourCycle: "h23",
    }).format(date),
  );
  return hour >= 22 || hour < 10;
}

type PointsSentEmailInput = {
  orderId: string;
  pointsAmount: number;
  userEmail: string;
};

// Best-effort receipt to the customer confirming their points were sent, for
// buy orders completed during the BOG SMS blackout window. Never throws —
// called from `after()` in setOrderStatus, so a delivery failure must not
// affect the order.
export async function sendPointsSentEmail(input: PointsSentEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  if (!isBogSmsBlackout(new Date())) return;

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: ORDER_ALERT_FROM,
        to: input.userEmail,
        subject: `PLUS ქულები გამოგზავნილია / Your PLUS points have been sent`,
        text: [
          `${input.pointsAmount} PLUS ქულა გაიგზავნა თქვენს ანგარიშზე.`,
          `${input.pointsAmount} PLUS points have been sent to your account.`,
          ``,
          `შეკვეთის ID / Order ID: ${input.orderId}`,
        ].join("\n"),
      }),
    });
    if (!res.ok) {
      console.error("sendPointsSentEmail failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("sendPointsSentEmail failed", err);
  }
}
