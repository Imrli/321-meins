/**
 * PDF-Auftragsbestätigung (Auftraggeber) + Transportauftrag (Transporteur) und E-Mail-Versand
 * nach erfolgreicher Zahlung (Stripe Checkout „paid“ oder simulierte Zahlung).
 * Testmodus: wie auftrag-qr-email → Mailpit / TEST_MAIL_CATCHALL.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { jsPDF } from "npm:jspdf@2.5.2";
import nodemailer from "npm:nodemailer@6.9.8";
import {
  edgeIsTestMode,
  mailpitSmtpHost,
  mailpitSmtpPort,
  testMailCatchall,
} from "./edgeTestMode.ts";

const PDF_MARGIN_MM = 14;
const PDF_MAX_W_MM = 182;
const PDF_BOTTOM_MM = 280;

function bytesToBase64(u8: Uint8Array): string {
  const chunk = 0x8000;
  let bin = "";
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function formatDeDate(d: string | null | undefined): string {
  if (!d || !String(d).trim()) return "—";
  const s = String(d).trim();
  const t = Date.parse(s.length <= 10 ? `${s}T12:00:00` : s);
  if (!Number.isFinite(t)) return s;
  return new Date(t).toLocaleDateString("de-CH");
}

function formatDeDateTime(dt: Date): string {
  return dt.toLocaleString("de-CH", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function addrLines(
  vorname: string,
  name: string,
  strasse: string,
  plz: string,
  ort: string,
): string {
  const n = `${vorname} ${name}`.trim() || "—";
  const a = [strasse, `${plz} ${ort}`.trim()].filter(Boolean).join(", ");
  return [n, a || "—"].join("\n");
}

function ensureY(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PDF_BOTTOM_MM) {
    doc.addPage();
    return PDF_MARGIN_MM;
  }
  return y;
}

function addWrapped(
  doc: jsPDF,
  y: number,
  text: string,
  fontSize: number,
  style: "normal" | "bold" = "normal",
): number {
  doc.setFont("helvetica", style);
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, PDF_MAX_W_MM);
  const lineH = fontSize * 0.45;
  for (const line of lines) {
    y = ensureY(doc, y, lineH + 1);
    doc.text(line, PDF_MARGIN_MM, y);
    y += lineH;
  }
  return y + 2;
}

function buildPdfAuftraggeber(params: {
  anzeigeId: string;
  paymentWhen: Date;
  abs: { vorname: string; name: string; strasse: string; plz: string; ort: string };
  empf: { vorname: string; name: string; strasse: string; plz: string; ort: string };
  notizen: string;
  abholdatum: string;
  lieferdatum: string;
  lieferzeit: string;
  transporter: {
    firmenname: string;
    kontakt: string;
    telefon: string;
    email: string;
  };
  priceChf: number;
}): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = PDF_MARGIN_MM;

  y = addWrapped(
    doc,
    y,
    "Auftragsbestätigung – 321 meins",
    16,
    "bold",
  );

  y = addWrapped(doc, y, `Auftragsnummer: ${params.anzeigeId}`, 11, "bold");
  y = addWrapped(
    doc,
    y,
    `Datum und Uhrzeit der Zahlung: ${formatDeDateTime(params.paymentWhen)}`,
    10,
  );

  y = addWrapped(doc, y, "Absender:", 10, "bold");
  y = addWrapped(
    doc,
    y,
    addrLines(
      params.abs.vorname,
      params.abs.name,
      params.abs.strasse,
      params.abs.plz,
      params.abs.ort,
    ),
    10,
  );

  y = addWrapped(doc, y, "Empfänger:", 10, "bold");
  y = addWrapped(
    doc,
    y,
    addrLines(
      params.empf.vorname,
      params.empf.name,
      params.empf.strasse,
      params.empf.plz,
      params.empf.ort,
    ),
    10,
  );

  y = addWrapped(doc, y, "Notizen des Auftraggebers:", 10, "bold");
  y = addWrapped(doc, y, (params.notizen || "").trim() || "—", 10);

  const zeit = (params.lieferzeit || "").trim();
  const abh = formatDeDate(params.abholdatum);
  const lie = formatDeDate(params.lieferdatum);
  y = addWrapped(doc, y, "Gewünschtes Abholdatum / Lieferdatum:", 10, "bold");
  y = addWrapped(
    doc,
    y,
    `Abholung: ${abh}\nLieferung: ${lie}${zeit ? `\nLieferzeit: ${zeit}` : ""}`,
    10,
  );

  y = addWrapped(doc, y, "Transporteur:", 10, "bold");
  const tr = params.transporter;
  y = addWrapped(
    doc,
    y,
    `${tr.firmenname || "—"}\nKontaktperson: ${tr.kontakt || "—"}\nTelefon: ${
      tr.telefon || "—"
    }\nE-Mail: ${tr.email || "—"}`,
    10,
  );

  y = addWrapped(doc, y, "Vereinbarter Preis in CHF:", 10, "bold");
  y = addWrapped(
    doc,
    y,
    `CHF ${params.priceChf.toFixed(2)}`,
    11,
    "bold",
  );

  y = addWrapped(doc, y, "Hinweis:", 10, "bold");
  y = addWrapped(
    doc,
    y,
    "Dein Geld wird sicher bei Stripe hinterlegt und erst nach erfolgreicher Lieferung (QR-Code-Scan) an den Transporteur überwiesen.",
    10,
  );

  const out = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(out);
}

function buildPdfTransporteur(params: {
  anzeigeId: string;
  orderWhen: Date;
  abs: {
    vorname: string;
    name: string;
    strasse: string;
    plz: string;
    ort: string;
    telefon: string;
    email: string;
  };
  empf: {
    vorname: string;
    name: string;
    strasse: string;
    plz: string;
    ort: string;
    telefon: string;
    email: string;
  };
  notizen: string;
  abholdatum: string;
  lieferdatum: string;
  lieferzeit: string;
  priceChf: number;
}): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = PDF_MARGIN_MM;

  y = addWrapped(doc, y, "Transportauftrag – 321 meins", 16, "bold");
  y = addWrapped(doc, y, `Auftragsnummer: ${params.anzeigeId}`, 11, "bold");
  y = addWrapped(
    doc,
    y,
    `Datum und Uhrzeit der Auftragserteilung: ${formatDeDateTime(params.orderWhen)}`,
    10,
  );

  y = addWrapped(doc, y, "Absender:", 10, "bold");
  const a = params.abs;
  y = addWrapped(
    doc,
    y,
    `${addrLines(a.vorname, a.name, a.strasse, a.plz, a.ort)}\nTelefon: ${
      (a.telefon || "").trim() || "—"
    }\nE-Mail: ${(a.email || "").trim() || "—"}`,
    10,
  );

  y = addWrapped(doc, y, "Empfänger:", 10, "bold");
  const e = params.empf;
  y = addWrapped(
    doc,
    y,
    `${addrLines(e.vorname, e.name, e.strasse, e.plz, e.ort)}\nTelefon: ${
      (e.telefon || "").trim() || "—"
    }\nE-Mail: ${(e.email || "").trim() || "—"}`,
    10,
  );

  y = addWrapped(doc, y, "Notizen des Auftraggebers:", 10, "bold");
  y = addWrapped(doc, y, (params.notizen || "").trim() || "—", 10);

  const zeit = (params.lieferzeit || "").trim();
  const abh = formatDeDate(params.abholdatum);
  const lie = formatDeDate(params.lieferdatum);
  y = addWrapped(doc, y, "Gewünschtes Abholdatum / Lieferdatum:", 10, "bold");
  y = addWrapped(
    doc,
    y,
    `Abholung: ${abh}\nLieferung: ${lie}${zeit ? `\nLieferzeit: ${zeit}` : ""}`,
    10,
  );

  y = addWrapped(doc, y, "Vereinbarter Preis in CHF:", 10, "bold");
  y = addWrapped(
    doc,
    y,
    `CHF ${params.priceChf.toFixed(2)}`,
    11,
    "bold",
  );

  y = addWrapped(doc, y, "Hinweis:", 10, "bold");
  y = addWrapped(
    doc,
    y,
    "Die Zahlung wurde vom Auftraggeber geleistet und bei Stripe hinterlegt. Sie wird nach erfolgreichem QR-Code-Scan an dich ausgelöst. Bitte kontaktiere den Absender vor Fahrtantritt, um die Übergabe zu bestätigen.",
    10,
  );

  const out = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(out);
}

async function sendPdfEmail(params: {
  toReal: string;
  subject: string;
  textBody: string;
  filename: string;
  pdf: Uint8Array;
}): Promise<void> {
  const to = params.toReal.trim();
  if (!to) {
    console.warn("orderConfirmationPdfs: kein Empfänger, Versand übersprungen");
    return;
  }

  const fromDefault = "321 meins <noreply@321-meins.local>";
  const from = Deno.env.get("QR_EMAIL_FROM") ?? fromDefault;

  if (edgeIsTestMode()) {
    const host = mailpitSmtpHost();
    const port = mailpitSmtpPort();
    const catchAll = testMailCatchall();
    const textMail =
      params.textBody +
      `\n\n[TESTMODUS] Versand an Mailpit/SMTP (${host}:${port}).\nUrsprünglicher Empfänger: ${to}\n`;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
    });
    await transporter.sendMail({
      from,
      to: catchAll,
      subject: "[TESTMODUS] " + params.subject,
      text: textMail,
      attachments: [
        {
          filename: params.filename,
          content: params.pdf,
          contentType: "application/pdf",
        },
      ],
    });
    return;
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const b64 = bytesToBase64(params.pdf);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM") ??
          "321 meins <onboarding@resend.dev>",
        to: [to],
        subject: params.subject,
        text: params.textBody,
        attachments: [{ filename: params.filename, content: b64 }],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Resend ${res.status}: ${t}`);
    }
    return;
  }

  const smtpHost = Deno.env.get("QR_EMAIL_SMTP_HOST")?.trim();
  if (smtpHost) {
    const port = Number(Deno.env.get("QR_EMAIL_SMTP_PORT") ?? "1025");
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port,
      secure: port === 465,
    });
    await transporter.sendMail({
      from,
      to,
      subject: params.subject,
      text: params.textBody,
      attachments: [
        {
          filename: params.filename,
          content: params.pdf,
          contentType: "application/pdf",
        },
      ],
    });
    return;
  }

  console.warn(
    "orderConfirmationPdfs: weder RESEND_API_KEY noch QR_EMAIL_SMTP_HOST gesetzt – kein E-Mail-Versand",
  );
}

export async function sendOrderConfirmationEmailsAfterPayment(
  admin: SupabaseClient,
  auctionId: string,
  paymentWhen: Date,
): Promise<void> {
  const { data: auk, error: aukErr } = await admin
    .from("auktionen")
    .select(
      "anzeige_id, awarded_betrag, notizen, abholdatum, lieferdatum, lieferzeit, " +
        "abs_vorname, abs_name, abs_strasse, abs_plz, abs_ort, abs_email, abs_telefon, " +
        "empf_vorname, empf_name, empf_strasse, empf_plz, empf_ort, " +
        "auftraggeber_id, awarded_transporteur_id",
    )
    .eq("id", auctionId)
    .maybeSingle();

  if (aukErr || !auk) {
    console.error("orderConfirmationPdfs: Auktion nicht geladen", aukErr);
    return;
  }

  const anzeigeId = String(auk.anzeige_id ?? "").trim() || auctionId;
  const betrag = Number(auk.awarded_betrag);
  const priceChf = Number.isFinite(betrag) ? betrag : 0;

  const agId = String(auk.auftraggeber_id ?? "").trim();
  let agEmail = "";
  if (agId) {
    const { data: agProf } = await admin
      .from("auftraggeber")
      .select("email")
      .eq("id", agId)
      .maybeSingle();
    agEmail = String(agProf?.email ?? "").trim();
    if (agEmail === "—") agEmail = "";
  }

  let trRow: {
    firmenname: string;
    vorname_kontakt: string;
    name_kontakt: string;
    telefon: string;
    email: string;
  } | null = null;

  const trId = auk.awarded_transporteur_id
    ? String(auk.awarded_transporteur_id)
    : "";
  if (trId) {
    const { data: tr, error: trErr } = await admin
      .from("transporteure")
      .select("firmenname, vorname_kontakt, name_kontakt, telefon, email")
      .eq("id", trId)
      .maybeSingle();
    if (trErr) {
      console.error("orderConfirmationPdfs: Transporteur nicht geladen", trErr);
    } else {
      trRow = tr as typeof trRow;
    }
  }

  const transporterBlock = {
    firmenname: String(trRow?.firmenname ?? "").trim(),
    kontakt:
      `${String(trRow?.vorname_kontakt ?? "").trim()} ${
        String(trRow?.name_kontakt ?? "").trim()
      }`.trim(),
    telefon: String(trRow?.telefon ?? "").trim(),
    email: String(trRow?.email ?? "").trim(),
  };

  const abs = {
    vorname: String(auk.abs_vorname ?? ""),
    name: String(auk.abs_name ?? ""),
    strasse: String(auk.abs_strasse ?? ""),
    plz: String(auk.abs_plz ?? ""),
    ort: String(auk.abs_ort ?? ""),
    telefon: String(auk.abs_telefon ?? ""),
    email: String(auk.abs_email ?? ""),
  };

  const empf = {
    vorname: String(auk.empf_vorname ?? ""),
    name: String(auk.empf_name ?? ""),
    strasse: String(auk.empf_strasse ?? ""),
    plz: String(auk.empf_plz ?? ""),
    ort: String(auk.empf_ort ?? ""),
    telefon: "",
    email: "",
  };

  const notizen = String(auk.notizen ?? "");
  const abholdatum = auk.abholdatum != null ? String(auk.abholdatum) : "";
  const lieferdatum = auk.lieferdatum != null ? String(auk.lieferdatum) : "";
  const lieferzeit = String(auk.lieferzeit ?? "");

  const pdfAg = buildPdfAuftraggeber({
    anzeigeId,
    paymentWhen,
    abs: {
      vorname: abs.vorname,
      name: abs.name,
      strasse: abs.strasse,
      plz: abs.plz,
      ort: abs.ort,
    },
    empf: {
      vorname: empf.vorname,
      name: empf.name,
      strasse: empf.strasse,
      plz: empf.plz,
      ort: empf.ort,
    },
    notizen,
    abholdatum,
    lieferdatum,
    lieferzeit,
    transporter: transporterBlock,
    priceChf,
  });

  const pdfTr = buildPdfTransporteur({
    anzeigeId,
    orderWhen: paymentWhen,
    abs,
    empf,
    notizen,
    abholdatum,
    lieferdatum,
    lieferzeit,
    priceChf,
  });

  const trEmail = transporterBlock.email;

  try {
    if (agEmail) {
      await sendPdfEmail({
        toReal: agEmail,
        subject: "Deine Auftragsbestätigung – 321 meins",
        textBody:
          `Hallo,\n\n` +
          `anbei findest du deine Auftragsbestätigung als PDF (Auftragsnummer ${anzeigeId}).\n\n` +
          `Mit freundlichen Grüssen\n321 meins`,
        filename: `auftragsbestaetigung-${anzeigeId}.pdf`,
        pdf: pdfAg,
      });
    } else {
      console.warn(
        "orderConfirmationPdfs: Auftraggeber ohne E-Mail – kein Versand Auftragsbestätigung",
      );
    }
  } catch (e) {
    console.error("orderConfirmationPdfs: E-Mail Auftraggeber", e);
  }

  try {
    if (trEmail) {
      await sendPdfEmail({
        toReal: trEmail,
        subject: "Neuer Transportauftrag – 321 meins",
        textBody:
          `Hallo,\n\n` +
          `anbei findest du den Transportauftrag als PDF (Auftragsnummer ${anzeigeId}).\n\n` +
          `Mit freundlichen Grüssen\n321 meins`,
        filename: `transportauftrag-${anzeigeId}.pdf`,
        pdf: pdfTr,
      });
    } else {
      console.warn(
        "orderConfirmationPdfs: Transporteur ohne E-Mail – kein Versand Transportauftrag",
      );
    }
  } catch (e) {
    console.error("orderConfirmationPdfs: E-Mail Transporteur", e);
  }
}
