import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { anzeige_id?: string; sterne?: number; kommentar?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anzeigeId = String(body.anzeige_id ?? "").trim();
  const sterne = Number(body.sterne);
  const kommentar = String(body.kommentar ?? "").trim().slice(0, 300);

  if (
    !anzeigeId ||
    !Number.isInteger(sterne) ||
    sterne < 1 ||
    sterne > 5
  ) {
    return new Response(JSON.stringify({ ok: false, error: "invalid" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: "server_misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const jwtClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await jwtClient.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const uid = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: auk, error: selErr } = await admin
    .from("auktionen")
    .select(
      "id, anzeige_id, status, auftraggeber_id, awarded_transporteur_id, bewertung_ag_sterne, bewertung_tr_sterne",
    )
    .eq("anzeige_id", anzeigeId)
    .maybeSingle();

  if (selErr || !auk) {
    return new Response(JSON.stringify({ ok: false, error: "invalid" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (auk.status !== "bezahlt") {
    return new Response(JSON.stringify({ ok: false, error: "invalid_state" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const agId = String(auk.auftraggeber_id ?? "");
  const trId = String(auk.awarded_transporteur_id ?? "");

  const isAg = agId === uid;
  const isTr = trId === uid;
  if (!isAg && !isTr) {
    return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (isAg) {
    if (auk.bewertung_ag_sterne != null) {
      return new Response(JSON.stringify({ ok: false, error: "already_rated" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: upd, error: upErr } = await admin
      .from("auktionen")
      .update({
        bewertung_ag_sterne: sterne,
        bewertung_ag_kommentar: kommentar || null,
      })
      .eq("id", auk.id)
      .is("bewertung_ag_sterne", null)
      .select("id")
      .maybeSingle();
    if (upErr || !upd) {
      return new Response(JSON.stringify({ ok: false, error: "already_rated" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { error: rpcErr } = await admin.rpc("recompute_transporteur_rating", {
      p_id: trId,
    });
    if (rpcErr) {
      console.error("lieferung-bewerten recompute_transporteur_rating", rpcErr);
    }
  } else {
    if (auk.bewertung_tr_sterne != null) {
      return new Response(JSON.stringify({ ok: false, error: "already_rated" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: upd, error: upErr } = await admin
      .from("auktionen")
      .update({
        bewertung_tr_sterne: sterne,
        bewertung_tr_kommentar: kommentar || null,
      })
      .eq("id", auk.id)
      .is("bewertung_tr_sterne", null)
      .select("id")
      .maybeSingle();
    if (upErr || !upd) {
      return new Response(JSON.stringify({ ok: false, error: "already_rated" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { error: rpcErr } = await admin.rpc("recompute_auftraggeber_rating", {
      p_id: agId,
    });
    if (rpcErr) {
      console.error("lieferung-bewerten recompute_auftraggeber_rating", rpcErr);
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
