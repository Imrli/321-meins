import {
  logDryRunTransporteurMail,
  sendTransporteurInfomaniakMail,
  transporteurSmtpIsDryRun,
} from "../_shared/transporteurInfomaniakMail.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APPROVE_SUBJECT = "Registrierung erfolgreich geprüft";
const APPROVE_TEXT =
  "Deine Registrierung wurde erfolgreich geprüft. Dein Profil ist nun als verifiziert (V) auf der Plattform sichtbar.";
const REJECT_SUBJECT = "Registrierung: Nachweis erforderlich";
const REJECT_TEXT =
  "Vielen Dank für deine Registrierung. Leider konnten wir deinen Versicherungsnachweis nicht akzeptieren. Bitte sende uns eine gültige Versicherungspolice (keine Offerte, kein unleserliches Dokument), da nur so sichergestellt ist, dass der Versicherungsschutz tatsächlich besteht. Du kannst das Dokument in deinem Profil aktualisieren. Sobald uns der korrekte Nachweis vorliegt, schalten wir dein Konto umgehend frei.";

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

  const secret = Deno.env.get("TRANSPORTEUR_VERIFIZIERT_WEBHOOK_SECRET");
  const auth = req.headers.get("Authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", {
      status: 401,
      headers: corsHeaders,
    });
  }

  let body: { email?: string; verifiziert?: boolean };
  try {
    body = (await req.json()) as { email?: string; verifiziert?: boolean };
  } catch {
    return new Response("Bad request", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const email = body.email?.trim();
  if (!email || !email.includes("@")) {
    return new Response("Bad request", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const verifiziert = body.verifiziert === true;
  const subject = verifiziert ? APPROVE_SUBJECT : REJECT_SUBJECT;
  const text = verifiziert ? APPROVE_TEXT : REJECT_TEXT;

  if (transporteurSmtpIsDryRun()) {
    logDryRunTransporteurMail("transporteur-verifiziert-email", {
      to: email,
      subject,
      text,
    });
    return new Response(
      JSON.stringify({
        ok: true,
        skipped: true,
        reason: "dry_run",
        via: "console",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const r = await sendTransporteurInfomaniakMail({
    to: email,
    subject,
    text,
  });
  if (!r.ok) {
    console.error("transporteur-verifiziert-email:", r.error);
    return new Response(JSON.stringify({ ok: false, error: r.error }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, via: "infomaniak_smtp" }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
