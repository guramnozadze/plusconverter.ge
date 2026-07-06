const RESEND_API_URL = "https://api.resend.com/emails";
const ORDER_ALERT_EMAIL = "gukanozadze@gmail.com";
const ORDER_ALERT_FROM = "PLUS Converter <onboarding@resend.dev>";

type OrderAlertInput = {
  orderId: string;
  direction: "buy" | "sell";
  gelAmount: number;
  pointsAmount: number;
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
