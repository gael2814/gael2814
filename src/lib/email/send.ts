import { prisma } from "../db";

export type OutgoingEmail = { to: string; subject: string; html: string; text: string; kind: string; orderId?: string };

/**
 * Sends a transactional email through Resend (https://resend.com).
 * Without RESEND_API_KEY the email is logged instead (useful for local preview).
 * Failures are recorded but never break the order flow.
 */
export async function sendEmail(email: OutgoingEmail): Promise<"sent" | "logged" | "failed"> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Ay Ay Tacos <onboarding@resend.dev>";
  let status: "sent" | "logged" | "failed" = "logged";
  let error: string | null = null;

  if (!key) {
    console.info(`[email:not-sent] RESEND_API_KEY missing. To: ${email.to} Subject: ${email.subject}\n${email.text}`);
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
        }),
      });
      if (res.ok) status = "sent";
      else {
        status = "failed";
        error = `Resend ${res.status}: ${(await res.text()).slice(0, 500)}`;
      }
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : String(e);
    }
  }

  try {
    await prisma.emailLog.create({
      data: { to: email.to, subject: email.subject, kind: email.kind, status, error, orderId: email.orderId ?? null },
    });
  } catch (e) {
    console.error("Failed to log email", e);
  }
  if (status === "failed") console.error(`[email:failed] ${email.subject} -> ${email.to}: ${error}`);
  return status;
}
