/**
 * E-Mail nach Lieferbestätigung: beide Parteien zur Bewertung einladen (Mailpit im Testmodus).
 */
import nodemailer from "npm:nodemailer@6.9.8";
import {
  edgeIsTestMode,
  mailpitSmtpHost,
  mailpitSmtpPort,
  testMailCatchall,
} from "./edgeTestMode.ts";

const SUBJECT = "Bewerte deine Erfahrung – 321 meins";

function ratingLink(base: string, anzeigeId: string): string {
  const u = new URL(base.replace(/\/$/, "") + "/");
  u.searchParams.set("bewerten", anzeigeId);
  return u.toString();
}

async function sendOne(opts: {
  toReal: string;
  textBody: string;
  edgeTest: boolean;
  resendKey: string | undefined;
  resendFrom: string;
  smtpHost: string | undefined;
  smtpPort: number;
  smtpFrom: string;
}): Promise<void> {
  const to = opts.toReal.trim();
  if (!to) return;

  if (opts.edgeTest) {
    const host = mailpitSmtpHost();
    const port = mailpitSmtpPort();
    const catchAll = testMailCatchall();
    const textMail =
      opts.textBody +
      `\n\n[TESTMODUS] Versand an Mailpit/SMTP (${host}:${port}).\nUrsprünglicher Empfänger: ${to}\n`;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
    });
    await transporter.sendMail({
      from: opts.smtpFrom,
      to: catchAll,
      subject: "[TESTMODUS] " + SUBJECT,
      text: textMail,
    });
    return;
  }

  if (opts.resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: opts.resendFrom,
        to: [to],
        subject: SUBJECT,
        text: opts.textBody,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Resend ${res.status}: ${t}`);
    }
    return;
  }

  const host = opts.smtpHost?.trim();
  if (host) {
    const transporter = nodemailer.createTransport({
      host,
      port: opts.smtpPort,
      secure: opts.smtpPort === 465,
    });
    await transporter.sendMail({
      from: opts.smtpFrom,
      to,
      subject: SUBJECT,
      text: opts.textBody,
    });
    return;
  }

  console.warn(
    "ratingRequestEmails: keine E-Mail-Konfiguration (Mailpit / RESEND / SMTP)",
  );
}

export async function sendLieferungBewertungInviteEmails(opts: {
  anzeigeId: string;
  frontendBase: string;
  toAuftraggeber: string;
  toTransporteur: string;
  /** z. B. Firmenname oder Kontaktperson */
  transporteurName: string;
  /** Vorname + Name Auftraggeber */
  auftraggeberName: string;
}): Promise<void> {
  const base = opts.frontendBase.replace(/\/$/, "");
  const link = ratingLink(base, opts.anzeigeId);

  const edgeTest = edgeIsTestMode();
  const resendKey = edgeTest ? undefined : Deno.env.get("RESEND_API_KEY");
  const resendFrom =
    Deno.env.get("RESEND_FROM") ?? "321 meins <onboarding@resend.dev>";
  const smtpHost = Deno.env.get("QR_EMAIL_SMTP_HOST")?.trim();
  const smtpPort = Number(Deno.env.get("QR_EMAIL_SMTP_PORT") ?? "1025");
  const smtpFrom =
    Deno.env.get("QR_EMAIL_FROM") ?? "321 meins <noreply@321-meins.local>";

  const trLabel = opts.transporteurName.trim() || "deinem Transporteur";
  const agLabel = opts.auftraggeberName.trim() || "deinem Auftraggeber";

  const textAg =
    `Hallo,\n\n` +
    `Deine Lieferung wurde erfolgreich abgeschlossen. Bitte bewerte deine Erfahrung mit dem Transporteur ${trLabel} mit 1 bis 5 Sternen und hinterlasse optional einen kurzen Kommentar.\n\n` +
    `Direkt zur Bewertung:\n${link}\n\n` +
    `Mit freundlichen Grüssen\n321 meins`;

  const textTr =
    `Hallo,\n\n` +
    `Deine Lieferung wurde erfolgreich abgeschlossen. Bitte bewerte deine Erfahrung mit dem Auftraggeber ${agLabel} mit 1 bis 5 Sternen und hinterlasse optional einen kurzen Kommentar.\n\n` +
    `Direkt zur Bewertung:\n${link}\n\n` +
    `Mit freundlichen Grüssen\n321 meins`;

  const mailOpts = {
    edgeTest,
    resendKey: resendKey ?? undefined,
    resendFrom,
    smtpHost: smtpHost ?? undefined,
    smtpPort,
    smtpFrom,
  };

  if (opts.toAuftraggeber.trim()) {
    await sendOne({ ...mailOpts, toReal: opts.toAuftraggeber, textBody: textAg });
  }
  if (opts.toTransporteur.trim()) {
    await sendOne({
      ...mailOpts,
      toReal: opts.toTransporteur,
      textBody: textTr,
    });
  }
}
