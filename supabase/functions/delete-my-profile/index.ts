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
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: "missing_authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const uid = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tr } = await admin
    .from("transporteure")
    .select("firmenname, email")
    .eq("id", uid)
    .maybeSingle();

  if (tr?.firmenname != null && tr?.email != null) {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const from =
        Deno.env.get("RESEND_FROM") ?? "321 meins <onboarding@resend.dev>";
      const firma = String(tr.firmenname);
      const em = String(tr.email);
      const r = await sendResend({
        apiKey: resendKey,
        from,
        to: SUPPORT_EMAIL,
        subject: `Profil gelöscht: ${firma} (${em})`,
        text:
          `Der Transporteur ${firma} (${em}) hat sein Profil gelöscht. Bitte prüfe den Grund und kontaktiere ihn gegebenenfalls.`,
      });
      if (!r.ok) {
        console.error("delete-my-profile: support mail failed", r.error);
      }
    } else {
      console.warn("delete-my-profile: RESEND_API_KEY not set — skipping mail");
    }
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) {
    return new Response(JSON.stringify({ ok: false, error: delErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
