/**
 * Outgoing email (magic sign-in links).
 *
 * Locally this goes to Mailpit (SMTP 127.0.0.1:1025, inbox at
 * http://localhost:8025). In production set SMTP_* to the real provider.
 */
import "server-only";
import nodemailer from "nodemailer";

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (transport) return transport;
  const port = Number(process.env.SMTP_PORT || 587);
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Send the sign-in link. Plain, readable HTML that works in every mail app. */
export async function sendMagicLinkEmail(to: string, name: string, link: string) {
  const first = name.trim().split(/\s+/)[0] || "there";
  await getTransport().sendMail({
    from: process.env.MAIL_FROM || "PUNCH Canteen <no-reply@punchng.com>",
    to,
    subject: "Your PUNCH Canteen sign-in link",
    text: `Hello ${first},\n\nUse this link to sign in to PUNCH Canteen:\n${link}\n\nThe link works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#222b35">
  <div style="font-size:28px;font-weight:800;color:#ba2536;letter-spacing:1px">PUNCH <span style="font-size:13px;color:#2a4a8a;letter-spacing:3px">CANTEEN</span></div>
  <p>Hello ${escape(first)},</p>
  <p>Click the button below to sign in to PUNCH Canteen.</p>
  <p style="margin:28px 0"><a href="${escape(link)}" style="background:#d71920;color:#fff;padding:13px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Sign in</a></p>
  <p style="color:#66707b;font-size:13px">The link works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.</p>
</div>`,
  });
}
