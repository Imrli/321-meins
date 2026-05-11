import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPPORT_EMAIL = "support@321-meins.ch";

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user?.email) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const role = userData.user.user_metadata?.app_role;
  if (role !== "transporteur") {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.warn(
      "transporteur-registration-emails: RESEND_API_KEY not set — skipping send",
    );
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "no_resend_key" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const from =
    Deno.env.get("RESEND_FROM") ??
    "321 meins <onboarding@resend.dev>";

  const transporterEmail = userData.user.email;
  const results: { target: string; ok: boolean; error?: string }[] = [];

  const r1 = await sendResend({
    apiKey: resendKey,
    from,
    to: transporterEmail,
    subject: "Deine Registrierung ist eingegangen",
    text: "Deine Registrierung ist bei uns eingegangen. Wir prüfen nun deine Unterlagen. Dies dauert in der Regel 1-2 Werktage.",
  });
  results.push({
    target: transporterEmail,
    ok: r1.ok,
    error: r1.error,
  });

  const r2 = await sendResend({
    apiKey: resendKey,
    from,
    to: SUPPORT_EMAIL,
    subject: "Neue Registrierung: Prüfung erforderlich",
    text: "Ein neuer Transporteur hat sich registriert und seinen Versicherungsnachweis hochgeladen. Bitte prüfe die Unterlagen im Supabase-Dashboard.",
  });
  results.push({ target: SUPPORT_EMAIL, ok: r2.ok, error: r2.error });

  for (const r of results) {
    if (!r.ok) {
      console.error(
        "transporteur-registration-emails: send failed",
        r.target,
        r.error,
      );
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
