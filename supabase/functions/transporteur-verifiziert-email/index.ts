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

async function sendResend(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `${res.status} ${body}` };
  }
  return { ok: true };
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

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.warn(
      "transporteur-verifiziert-email: RESEND_API_KEY not set — skipping",
    );
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "no_resend" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const from =
    Deno.env.get("RESEND_FROM") ?? "321 meins <onboarding@resend.dev>";
  const verifiziert = body.verifiziert === true;
  const subject = verifiziert ? APPROVE_SUBJECT : REJECT_SUBJECT;
  const text = verifiziert ? APPROVE_TEXT : REJECT_TEXT;

  const r = await sendResend({
    apiKey: resendKey,
    from,
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

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
