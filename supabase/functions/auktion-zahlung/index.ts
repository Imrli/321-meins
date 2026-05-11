import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "npm:stripe@17.4.0";
import { sendOrderConfirmationEmailsAfterPayment } from "../_shared/orderConfirmationPdfs.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function newQrToken(): string {
  return crypto.randomUUID();
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
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")?.trim() ?? "";
  const frontendBase = (
    Deno.env.get("FRONTEND_URL") ??
    Deno.env.get("SITE_URL") ??
    "http://127.0.0.1:5173"
  ).replace(/\/$/, "");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    action?: string;
    anzeige_id?: string;
    session_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const action = String(body.action ?? "").trim();
  const jwtClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await jwtClient.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const uid = userData.user.id;

  // ----- create_checkout -----
  if (action === "create_checkout") {
    if (!stripeSecret) {
      return new Response(
        JSON.stringify({ ok: false, error: "no_stripe" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const anzeigeId = String(body.anzeige_id ?? "").trim();
    if (!anzeigeId) {
      return new Response(JSON.stringify({ error: "anzeige_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: row, error: selErr } = await jwtClient
      .from("auktionen")
      .select("id, anzeige_id, awarded_betrag, status, auftraggeber_id")
      .eq("anzeige_id", anzeigeId)
      .maybeSingle();

    if (selErr || !row || row.auftraggeber_id !== uid) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (row.status !== "pending_payment") {
      return new Response(JSON.stringify({ error: "invalid_state" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountChf = Number(row.awarded_betrag);
    if (!Number.isFinite(amountChf) || amountChf <= 0) {
      return new Response(JSON.stringify({ error: "invalid_amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const unitAmount = Math.round(amountChf * 100);
    if (unitAmount < 50) {
      return new Response(JSON.stringify({ error: "amount_too_small" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anzeige = String(row.anzeige_id ?? anzeigeId);
    const successUrl =
      `${frontendBase}/?checkout=success&session_id={CHECKOUT_SESSION_ID}&auction=${
        encodeURIComponent(anzeige)
      }`;
    const cancelUrl = `${frontendBase}/?checkout=cancel&auction=${
      encodeURIComponent(anzeige)
    }`;

    try {
      const stripe = new Stripe(stripeSecret);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        locale: "de",
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: row.id as string,
        metadata: {
          auction_id: row.id as string,
          anzeige_id: anzeige,
          auftraggeber_id: uid,
        },
        line_items: [
          {
            price_data: {
              currency: "chf",
              unit_amount: unitAmount,
              product_data: {
                name: `Transportauftrag ${anzeige}`,
                description: "321 meins – Zahlung wird bis zur Lieferung reserviert.",
              },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          capture_method: "manual",
          metadata: {
            auction_id: row.id as string,
            anzeige_id: anzeige,
          },
        },
      });

      return new Response(
        JSON.stringify({ ok: true, url: session.url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (e) {
      console.error("create_checkout", e);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "stripe_error",
          message: e instanceof Error ? e.message : String(e),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  // ----- complete_checkout -----
  if (action === "complete_checkout") {
    if (!serviceKey) {
      return new Response(JSON.stringify({ error: "server_misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sessionId = String(body.session_id ?? "").trim();
    if (!sessionId || !stripeSecret) {
      return new Response(JSON.stringify({ error: "invalid_request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const stripe = new Stripe(stripeSecret);
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"],
      });

      if (session.payment_status !== "paid") {
        return new Response(JSON.stringify({ error: "not_paid" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const metaAg = String(session.metadata?.auftraggeber_id ?? "").trim();
      if (metaAg !== uid) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const auctionUuid = String(session.metadata?.auction_id ?? "").trim();
      if (!auctionUuid) {
        return new Response(JSON.stringify({ error: "invalid_session" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const piRaw = session.payment_intent;
      const piId = typeof piRaw === "string"
        ? piRaw
        : piRaw && typeof piRaw === "object" && "id" in piRaw
          ? String((piRaw as { id: string }).id)
          : "";

      if (!piId) {
        return new Response(JSON.stringify({ error: "no_payment_intent" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const admin = createClient(supabaseUrl, serviceKey);
      const qr = newQrToken();

      const { data: updated, error: updErr } = await admin
        .from("auktionen")
        .update({
          status: "awarded",
          qr_token: qr,
          payment_intent_id: piId,
        })
        .eq("id", auctionUuid)
        .eq("auftraggeber_id", uid)
        .eq("status", "pending_payment")
        .select("anzeige_id")
        .maybeSingle();

      if (updErr || !updated) {
        console.error("complete_checkout update", updErr);
        return new Response(JSON.stringify({ error: "update_failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        await sendOrderConfirmationEmailsAfterPayment(
          admin,
          auctionUuid,
          new Date(),
        );
      } catch (e) {
        console.error("complete_checkout order confirmation emails", e);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          anzeige_id: String(updated.anzeige_id ?? ""),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (e) {
      console.error("complete_checkout", e);
      return new Response(
        JSON.stringify({
          error: "stripe_error",
          message: e instanceof Error ? e.message : String(e),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  // ----- simulate_payment (ohne Live-Stripe bzw. mit APP_TEST_MODE) -----
  if (action === "simulate_payment") {
    const allowSim =
      !stripeSecret || Deno.env.get("APP_TEST_MODE") === "true";
    if (!allowSim) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!serviceKey) {
      return new Response(JSON.stringify({ error: "server_misconfigured" }), {
        status: 500,
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

    const { data: row, error: selErr } = await jwtClient
      .from("auktionen")
      .select("id, status, auftraggeber_id")
      .eq("anzeige_id", anzeigeId)
      .maybeSingle();

    if (selErr || !row || row.auftraggeber_id !== uid) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (row.status !== "pending_payment") {
      return new Response(JSON.stringify({ error: "invalid_state" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const qr = newQrToken();
    const piSimulated = `pi_sim_${newQrToken().replace(/-/g, "")}`;

    const { data: updated, error: updErr } = await admin
      .from("auktionen")
      .update({
        status: "bezahlt_simuliert",
        qr_token: qr,
        payment_intent_id: piSimulated,
      })
      .eq("id", row.id)
      .eq("auftraggeber_id", uid)
      .eq("status", "pending_payment")
      .select("anzeige_id")
      .maybeSingle();

    if (updErr || !updated) {
      console.error("simulate_payment update", updErr);
      return new Response(JSON.stringify({ error: "update_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      await sendOrderConfirmationEmailsAfterPayment(
        admin,
        String(row.id),
        new Date(),
      );
    } catch (e) {
      console.error("simulate_payment order confirmation emails", e);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        anzeige_id: String(updated.anzeige_id ?? anzeigeId),
        simulated: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ error: "unknown_action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
