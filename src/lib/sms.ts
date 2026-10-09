import { prisma } from "./db";

/** US/Canada numbers → E.164 (+1XXXXXXXXXX). Returns null if it doesn't look like a valid number. */
export function toE164(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

export function smsConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID));
}

/**
 * Sends a text message through Twilio when configured. Without Twilio settings
 * the message is only logged. Failures are recorded and never break the kitchen flow.
 */
export async function sendSms(args: { to: string; body: string; kind: string; orderId?: string }): Promise<"sent" | "logged" | "failed"> {
  const to = toE164(args.to);
  let status: "sent" | "logged" | "failed" = "logged";
  let error: string | null = null;
  if (!to) {
    status = "failed";
    error = "Invalid phone number";
  } else if (!smsConfigured()) {
    if (process.env.NODE_ENV !== "test") console.info(`[sms:not-sent] Twilio not configured. To: ${to}\n${args.body}`);
  } else {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const form = new URLSearchParams({ To: to, Body: args.body });
      if (process.env.TWILIO_MESSAGING_SERVICE_SID) form.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
      else form.set("From", process.env.TWILIO_FROM!);
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      });
      if (res.ok) status = "sent";
      else {
        status = "failed";
        error = `Twilio ${res.status}: ${(await res.text()).slice(0, 300)}`;
      }
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : String(e);
    }
  }
  try {
    await prisma.emailLog.create({
      data: { to: to ?? args.to, subject: `[SMS] ${args.body.slice(0, 120)}`, kind: args.kind, status, error, orderId: args.orderId ?? null },
    });
  } catch (e) {
    console.error("Failed to log SMS", e);
  }
  if (status === "failed") console.error(`[sms:failed] ${args.to}: ${error}`);
  return status;
}
