/**
 * Infomaniak SMTP für Transporteur-Benachrichtigungen (STARTTLS, Port 587).
 * Secret: INFOMANIAK_SMTP_PASS (Supabase Dashboard / CLI).
 */
import nodemailer from "npm:nodemailer@6.9.8";

const SMTP_HOST = "mail.infomaniak.com";
const SMTP_PORT = 587;
const SMTP_USER = "support@321-meins.ch";
const FROM_HEADER = `321 meins <${SMTP_USER}>`;

/** Kein echter Versand: lokaler Mock oder fehlendes App-Passwort. */
export function transporteurSmtpIsDryRun(): boolean {
  if (Deno.env.get("VITE_MOCK") === "true") return true;
  const pass = Deno.env.get("INFOMANIAK_SMTP_PASS")?.trim();
  return !pass;
}

export function logDryRunTransporteurMail(
  functionName: string,
  mail: { to: string; subject: string; text: string },
): void {
  console.log(
    `[${functionName}] MOCK (VITE_MOCK=true) oder INFOMANIAK_SMTP_PASS nicht gesetzt — keine E-Mail gesendet.`,
    JSON.stringify(mail),
  );
}

export async function sendTransporteurInfomaniakMail(mail: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const pass = Deno.env.get("INFOMANIAK_SMTP_PASS")?.trim() ?? "";
  if (!pass) {
    return { ok: false, error: "INFOMANIAK_SMTP_PASS missing" };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      requireTLS: true,
      auth: { user: SMTP_USER, pass },
    });
    await transporter.sendMail({
      from: FROM_HEADER,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
