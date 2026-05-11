import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import QRCode from "npm:qrcode@1.5.3";
import nodemailer from "npm:nodemailer@6.9.8";
import {
  edgeIsTestMode,
  mailpitSmtpHost,
  mailpitSmtpPort,
  testMailCatchall,
} from "../_shared/edgeTestMode.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function bytesToBase64(u8: Uint8Array): string {
  const chunk = 0x8000;
  let bin = "";
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { anzeige_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anzeigeId = String(body.anzeige_id ?? "").trim();
  if (!anzeigeId) {
    return new Response(JSON.stringify({ error: "anzeige_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: row, error: rowErr } = await supabase
    .from("auktionen")
    .select("qr_token, auftraggeber_id, anzeige_id")
    .eq("anzeige_id", anzeigeId)
    .maybeSingle();

  if (rowErr || !row || row.auftraggeber_id !== userData.user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!row.qr_token) {
    return new Response(JSON.stringify({ error: "no_qr_token" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: prof } = await supabase
    .from("auftraggeber")
    .select("email")
    .eq("id", userData.user.id)
    .maybeSingle();

  let to = String(prof?.email ?? "").trim();
  if (!to || to === "—") {
    to = String(userData.user.email ?? "").trim();
  }
  if (!to) {
    return new Response(JSON.stringify({ error: "no_recipient_email" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anzeige = String(row.anzeige_id ?? anzeigeId);
  const payload = JSON.stringify({
    auftrag_id: anzeige,
    token: row.qr_token,
  });

  let png: Buffer;
  try {
    png = await QRCode.toBuffer(payload, {
      type: "png",
      width: 400,
      margin: 2,
    });
  } catch (e) {
    console.error("QRCode.toBuffer", e);
    return new Response(JSON.stringify({ error: "qr_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const subject = `Dein QR-Code für Auftrag #${anzeige}`;
  const textBody =
    `Hallo,\n\n` +
    `dein Auftrag wurde erteilt. Im Anhang findest du den QR-Code für die Übergabe der Ware an den Empfänger.\n\n` +
    `Leite diesen QR-Code an den Empfänger weiter. Er wird bei der Übergabe vom Transporteur gescannt.\n\n` +
    `Mit freundlichen Grüssen\n321 meins`;

  const u8 = new Uint8Array(png.buffer, png.byteOffset, png.byteLength);
  const b64 = bytesToBase64(u8);

  if (edgeIsTestMode()) {
    const host = mailpitSmtpHost();
    const port = mailpitSmtpPort();
    const catchAll = testMailCatchall();
    const from =
      Deno.env.get("QR_EMAIL_FROM") ??
      "321 meins <noreply@321-meins.local>";
    const textMail =
      textBody +
      `\n\n[TESTMODUS] Versand an Mailpit/SMTP (${host}:${port}).\nUrsprünglicher Empfänger: ${to}\n`;
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
      });
      await transporter.sendMail({
        from,
        to: catchAll,
        subject: "[TESTMODUS] " + subject,
        text: textMail,
        attachments: [
          {
            filename: "auftrag-qr.png",
            content: png,
          },
        ],
      });
    } catch (e) {
      console.error("auftrag-qr-email mailpit test send", e);
      return new Response(
        JSON.stringify({ ok: false, error: "smtp_failed" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    return new Response(JSON.stringify({ ok: true, via: "mailpit_test" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:
          Deno.env.get("RESEND_FROM") ??
          "321 meins <onboarding@resend.dev>",
        to: [to],
        subject,
        text: textBody,
        attachments: [{ filename: "auftrag-qr.png", content: b64 }],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("Resend", res.status, t);
      return new Response(
        JSON.stringify({ ok: false, error: "resend_failed", detail: t }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    return new Response(JSON.stringify({ ok: true, via: "resend" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const smtpHost = Deno.env.get("QR_EMAIL_SMTP_HOST")?.trim();
  if (smtpHost) {
    const port = Number(Deno.env.get("QR_EMAIL_SMTP_PORT") ?? "1025");
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: port === 465,
      });
      await transporter.sendMail({
        from:
          Deno.env.get("QR_EMAIL_FROM") ??
          "321 meins <noreply@321-meins.local>",
        to,
        subject,
        text: textBody,
        attachments: [
          {
            filename: "auftrag-qr.png",
            content: png,
          },
        ],
      });
    } catch (e) {
      console.error("SMTP send", e);
      return new Response(
        JSON.stringify({ ok: false, error: "smtp_failed" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    return new Response(JSON.stringify({ ok: true, via: "smtp" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.warn(
    "auftrag-qr-email: weder RESEND_API_KEY noch QR_EMAIL_SMTP_HOST gesetzt",
  );
  return new Response(
    JSON.stringify({ ok: true, skipped: true, reason: "no_mailer" }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
