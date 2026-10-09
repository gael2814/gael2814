import { formatCentsExact } from "../money";
import { formatDate, formatTime } from "../time";
import type { BusinessSettings } from "../settings";

export type EmailOrder = {
  number: number;
  customerName: string;
  serviceDate: string;
  pickupAt: Date;
  items: { name: string; quantity: number; unitCents: number }[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  taxLabel: string;
  notes: string | null;
  statusUrl: string;
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const C = { green: "#1f3d2b", terracotta: "#c4562a", mustard: "#e3a52b", cream: "#f3ebdc", ink: "#2a1f17" };

const logoUrl = () => `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/brand/logo.png`;

function addressLines(b: BusinessSettings): string[] {
  return [b.addressLine1, [b.city, b.state].filter(Boolean).join(", ") + (b.zip ? ` ${b.zip}` : "")].filter(Boolean);
}

function layout(b: BusinessSettings, title: string, inner: string): string {
  const contact = [b.phone, b.email].filter(Boolean).map(esc).join(" &middot; ");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.cream};font-family:Georgia,'Times New Roman',serif;color:${C.ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffaf0;border:3px solid ${C.green};border-radius:14px;overflow:hidden">
<tr><td style="background:${C.cream};padding:0">
  <div style="height:8px;background:${C.green};border-bottom:4px solid ${C.terracotta}"></div>
  <div style="padding:20px 24px 16px;text-align:center">
    <img src="${logoUrl()}" width="120" alt="Ay Ay Tacos" style="display:block;margin:0 auto 8px;width:120px;height:auto;border:0">
    <div style="font-family:Georgia,serif;font-size:15px;color:${C.terracotta};font-style:italic;font-weight:bold">${esc(b.tagline)}</div>
  </div>
</td></tr>
<tr><td style="padding:26px 26px 10px">${inner}</td></tr>
<tr><td style="padding:18px 26px 26px;border-top:2px dashed ${C.mustard};font-size:14px;line-height:1.5">
  <strong style="color:${C.green}">Pickup location</strong><br>${addressLines(b).map(esc).join("<br>")}
  ${contact ? `<br>${contact}` : ""}
</td></tr>
<tr><td style="background:${C.terracotta};color:${C.cream};text-align:center;padding:12px;font-size:13px">Gracias for supporting our small business! &mdash; Ay Ay Tacos</td></tr>
</table></td></tr></table></body></html>`;
}

function itemsTable(o: EmailOrder): string {
  const rows = o.items
    .map(
      (i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eadfc6">${i.quantity} &times; ${esc(i.name)}</td>
<td style="padding:6px 0;border-bottom:1px solid #eadfc6;text-align:right">${formatCentsExact(i.unitCents * i.quantity)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">${rows}
<tr><td style="padding:8px 0 2px">Subtotal</td><td style="text-align:right;padding:8px 0 2px">${formatCentsExact(o.subtotalCents)}</td></tr>
<tr><td style="padding:2px 0">${esc(o.taxLabel)}</td><td style="text-align:right;padding:2px 0">${formatCentsExact(o.taxCents)}</td></tr>
<tr><td style="padding:6px 0;font-weight:bold;font-size:17px;color:${C.green}">Total paid</td><td style="text-align:right;padding:6px 0;font-weight:bold;font-size:17px;color:${C.green}">${formatCentsExact(o.totalCents)}</td></tr>
</table>`;
}

function pickupBox(o: EmailOrder, label = "Estimated pickup time"): string {
  return `<div style="background:${C.green};color:${C.cream};border-radius:10px;padding:14px 16px;text-align:center;margin:16px 0">
<div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:${C.mustard}">${label}</div>
<div style="font-family:'Arial Black',Impact,sans-serif;font-size:28px">${formatTime(o.pickupAt)}</div>
<div style="font-size:14px">${formatDate(o.serviceDate)}</div></div>`;
}

function itemsText(o: EmailOrder): string {
  return o.items.map((i) => `- ${i.quantity} × ${i.name} — ${formatCentsExact(i.unitCents * i.quantity)}`).join("\n");
}

function totalsText(o: EmailOrder): string {
  return `Subtotal: ${formatCentsExact(o.subtotalCents)}\n${o.taxLabel}: ${formatCentsExact(o.taxCents)}\nTotal paid: ${formatCentsExact(o.totalCents)}`;
}

export function confirmationEmail(o: EmailOrder, b: BusinessSettings) {
  const subject = "Your Ay Ay Tacos Order Is Confirmed! 🌮";
  const inner = `<p style="font-size:17px;margin:0 0 8px">Hi ${esc(o.customerName)},</p>
<p style="margin:0 0 12px">Thank you for ordering from Ay Ay Tacos!</p>
<div style="font-family:'Arial Black',Impact,sans-serif;font-size:24px;color:${C.terracotta}">Order #${o.number}</div>
${pickupBox(o)}
<div style="font-weight:bold;color:${C.green};margin:8px 0 4px">Your order</div>
${itemsTable(o)}
${o.notes ? `<p style="font-size:14px;margin:12px 0 0"><strong>Your notes:</strong> ${esc(o.notes)}</p>` : ""}
<p style="margin:16px 0 4px"><strong>Please give us your order number (#${o.number}) when picking up.</strong></p>
<p style="margin:0 0 8px;font-size:14px"><a style="color:${C.terracotta}" href="${esc(o.statusUrl)}">Check your order status</a></p>`;
  const text = `Hi ${o.customerName},

Thank you for ordering from Ay Ay Tacos!

Order #${o.number}

Your order:
${itemsText(o)}

${totalsText(o)}

Estimated pickup time: ${formatTime(o.pickupAt)}, ${formatDate(o.serviceDate)}

Pickup location:
${addressLines(b).join("\n")}

Please give us your order number when picking up.
Order status: ${o.statusUrl}

Thank you for supporting your local taco shop!

— Ay Ay Tacos`;
  return { subject, html: layout(b, subject, inner), text };
}

export function pickupChangedEmail(o: EmailOrder, b: BusinessSettings, previous: Date) {
  const subject = `Updated pickup time for Ay Ay Tacos order #${o.number}`;
  const inner = `<p style="font-size:17px;margin:0 0 8px">Hi ${esc(o.customerName)},</p>
<p style="margin:0 0 8px">We've updated the pickup time for <strong>order #${o.number}</strong>.
It was ${formatTime(previous)} and is now:</p>
${pickupBox(o, "New pickup time")}
<div style="font-weight:bold;color:${C.green};margin:8px 0 4px">Your order</div>
${itemsTable(o)}
<p style="margin:16px 0 4px"><strong>Please give us your order number (#${o.number}) when picking up.</strong></p>
<p style="margin:0 0 8px;font-size:14px"><a style="color:${C.terracotta}" href="${esc(o.statusUrl)}">Check your order status</a></p>`;
  const text = `Hi ${o.customerName},

We've updated the pickup time for order #${o.number}.
Previous time: ${formatTime(previous)}
New pickup time: ${formatTime(o.pickupAt)}, ${formatDate(o.serviceDate)}

Your order:
${itemsText(o)}

${totalsText(o)}

Pickup location:
${addressLines(b).join("\n")}

Order status: ${o.statusUrl}

— Ay Ay Tacos`;
  return { subject, html: layout(b, subject, inner), text };
}

export function cancelledEmail(o: EmailOrder, b: BusinessSettings, refundCents: number) {
  const subject = `Your Ay Ay Tacos order #${o.number} was cancelled`;
  const refundLine = refundCents > 0 ? `A refund of ${formatCentsExact(refundCents)} has been issued to your original payment method. It may take 5–10 business days to appear.` : "";
  const inner = `<p style="font-size:17px;margin:0 0 8px">Hi ${esc(o.customerName)},</p>
<p>Your order <strong>#${o.number}</strong> for ${formatDate(o.serviceDate)} has been cancelled.</p>
${refundLine ? `<p>${esc(refundLine)}</p>` : ""}
<p>If you have questions, please contact us.</p>`;
  const text = `Hi ${o.customerName},\n\nYour order #${o.number} for ${formatDate(o.serviceDate)} has been cancelled.\n${refundLine}\n\n— Ay Ay Tacos`;
  return { subject, html: layout(b, subject, inner), text };
}

export function refundEmail(o: EmailOrder, b: BusinessSettings, refundCents: number) {
  const subject = `Refund issued for Ay Ay Tacos order #${o.number}`;
  const msg = `We've issued a refund of ${formatCentsExact(refundCents)} for order #${o.number}. It may take 5–10 business days to appear on your statement.`;
  const inner = `<p style="font-size:17px;margin:0 0 8px">Hi ${esc(o.customerName)},</p><p>${esc(msg)}</p>`;
  return { subject, html: layout(b, subject, inner), text: `Hi ${o.customerName},\n\n${msg}\n\n— Ay Ay Tacos` };
}

export function readyEmail(o: EmailOrder, b: BusinessSettings) {
  const subject = `Your Ay Ay Tacos order #${o.number} is ready! 🌮`;
  const inner = `<p style="font-size:17px;margin:0 0 8px">Hi ${esc(o.customerName)},</p>
<div style="background:${C.green};color:${C.cream};border-radius:10px;padding:16px;text-align:center;margin:12px 0">
<div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:${C.mustard}">Ready for pickup</div>
<div style="font-family:'Arial Black',Impact,sans-serif;font-size:30px">Order #${o.number}</div>
<div style="font-size:15px">Come on by, it&#39;s hot and waiting for you!</div></div>
<div style="font-weight:bold;color:${C.green};margin:8px 0 4px">Your order</div>
${itemsTable(o)}
<p style="margin:16px 0 4px"><strong>Please give us your order number (#${o.number}) when picking up.</strong></p>`;
  const text = `Hi ${o.customerName},

Your Ay Ay Tacos order #${o.number} is ready for pickup! Come on by, it's hot and waiting for you.

Your order:
${itemsText(o)}

Pickup location:
${addressLines(b).join("\n")}

Please give us your order number when picking up.

— Ay Ay Tacos`;
  return { subject, html: layout(b, subject, inner), text };
}

export function readySms(o: { number: number }, b: BusinessSettings): string {
  return `Ay Ay Tacos: your order #${o.number} is ready for pickup at ${b.addressLine1}, ${b.city}! Please give us your order number when you pick up. Reply STOP to opt out.`;
}
