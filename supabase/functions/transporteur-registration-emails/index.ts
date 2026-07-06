import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
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

const SUPPORT_EMAIL = "support@321-meins.ch";

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

  const transporterEmail = userData.user.email;
  const mails = [
    {
      target: transporterEmail,
      subject: "Deine Registrierung ist eingegangen",
      text:
        "Deine Registrierung ist bei uns eingegangen. Wir prüfen nun deine Unterlagen. Dies dauert in der Regel 1-2 Werktage.",
    },
    {
      target: SUPPORT_EMAIL,
      subject: "Neue Registrierung: Prüfung erforderlich",
      text:
        "Ein neuer Transporteur hat sich registriert und seinen Versicherungsnachweis hochgeladen. Bitte prüfe die Unterlagen im Supabase-Dashboard.",
    },
  ] as const;

  if (transporteurSmtpIsDryRun()) {
    for (const m of mails) {
      logDryRunTransporteurMail("transporteur-registration-emails", {
        to: m.target,
        subject: m.subject,
        text: m.text,
      });
    }
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

  const results: { target: string; ok: boolean; error?: string }[] = [];
  for (const m of mails) {
    const r = await sendTransporteurInfomaniakMail({
      to: m.target,
      subject: m.subject,
      text: m.text,
    });
    results.push({
      target: m.target,
      ok: r.ok,
      error: r.ok ? undefined : r.error,
    });
    if (!r.ok) {
      console.error(
        "transporteur-registration-emails: send failed",
        m.target,
        r.error,
      );
    }
  }

  return new Response(JSON.stringify({ ok: true, results, via: "infomaniak_smtp" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
