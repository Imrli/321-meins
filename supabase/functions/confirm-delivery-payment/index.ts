import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "npm:stripe@17.4.0";
import nodemailer from "npm:nodemailer@6.9.8";
import {
  edgeIsTestMode,
  mailpitSmtpHost,
  mailpitSmtpPort,
  testMailCatchall,
} from "../_shared/edgeTestMode.ts";
import { sendLieferungBewertungInviteEmails } from "../_shared/ratingRequestEmails.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function roundChf(n: number): number {
  return Math.round(n * 100) / 100;
}

async function sendPaymentEmails(opts: {
  edgeTest: boolean;
  resendKey: string | undefined;
  resendFrom: string;
  smtpHost: string | undefined;
  smtpPort: number;
  smtpFrom: string;
  toAuftraggeber: string;
  toTransporteur: string;
  anzeigeId: string;
  totalChf: number;
  provisionChf: number;
  payoutChf: number;
  simulated: boolean;
}): Promise<void> {
  const simLine = opts.simulated
    ? "\nHinweis: Test-/Simulationsmodus (kein Stripe-Einzug).\n"
    : "\n";

  const origAg = opts.toAuftraggeber;
  const origTr = opts.toTransporteur;
  const edgeTest = opts.edgeTest;
  const catchAll = testMailCatchall();

  const footerAg = edgeTest
    ? `\n[TESTMODUS] Ursprünglicher Empfänger (Auftraggeber): ${origAg}\n`
    : "";
  const footerTr = edgeTest
    ? `\n[TESTMODUS] Ursprünglicher Empfänger (Transporteur): ${origTr}\n`
    : "";

  const textAg =
    `Hallo,\n\n` +
    `die Lieferung für Auftrag #${opts.anzeigeId} wurde bestätigt. ` +
    `Die Zahlung ist erfolgt.${simLine}` +
    `Zahlungsdetails:\n` +
    `- Gesamtbetrag: CHF ${opts.totalChf.toFixed(2)}\n` +
    `- Plattformprovision (5 %): CHF ${opts.provisionChf.toFixed(2)}\n` +
    `- Auszahlung an den Transporteur (95 %): CHF ${opts.payoutChf.toFixed(2)}\n\n` +
    `Vielen Dank für die Nutzung von 321 meins.\n` +
    footerAg;

  const textTr =
    `Hallo,\n\n` +
    `die Lieferung für Auftrag #${opts.anzeigeId} wurde bestätigt und die Zahlung ausgelöst.${simLine}` +
    `Zahlungsdetails:\n` +
    `- Gesamtbetrag: CHF ${opts.totalChf.toFixed(2)}\n` +
    `- Plattformprovision (5 %): CHF ${opts.provisionChf.toFixed(2)}\n` +
    `- Deine Auszahlung (95 %): CHF ${opts.payoutChf.toFixed(2)}\n\n` +
    `Der Betrag wird in Kürze auf dein verbundenes Konto überwiesen.\n\n` +
    `321 meins\n` +
    footerTr;

  const subject =
    (edgeTest ? "[TESTMODUS] " : "") +
    `Auftrag #${opts.anzeigeId} – Lieferung bestätigt, Zahlung verarbeitet`;

  const rk = !edgeTest ? opts.resendKey : undefined;
  if (rk) {
    for (const [to, text] of [
      [origAg, textAg],
      [origTr, textTr],
    ] as const) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${rk}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: opts.resendFrom,
          to: [to],
          subject,
          text,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        console.error("Resend payment email", res.status, t);
      }
    }
    return;
  }

  const host = (edgeTest ? mailpitSmtpHost() : opts.smtpHost)?.trim();
  const port = edgeTest ? mailpitSmtpPort() : opts.smtpPort;
  const toAg = edgeTest ? catchAll : origAg;
  const toTr = edgeTest ? catchAll : origTr;

  if (host) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
      });
      await transporter.sendMail({
        from: opts.smtpFrom,
        to: toAg,
        subject: `${subject} (Auftraggeber)`,
        text: textAg,
      });
      await transporter.sendMail({
        from: opts.smtpFrom,
        to: toTr,
        subject: `${subject} (Transporteur)`,
        text: textTr,
      });
    } catch (e) {
      console.error("SMTP payment email", e);
    }
    return;
  }

  console.warn(
    "confirm-delivery-payment: keine E-Mail-Konfiguration (Mailpit-SMTP / RESEND)",
  );
}

async function maybeSendLieferungBewertungInvites(
  admin: ReturnType<typeof createClient>,
  args: {
    auctionUuid: string;
    anzeigeId: string;
    auftraggeberId: string;
    awardedTransporteurId: string;
    ratingInviteSentAt: string | null | undefined;
  },
): Promise<void> {
  if (args.ratingInviteSentAt) return;

  const { data: fresh } = await admin
    .from("auktionen")
    .select("rating_invite_sent_at")
    .eq("id", args.auctionUuid)
    .maybeSingle();
  if (fresh?.rating_invite_sent_at) return;

  const { data: meta } = await admin
    .from("auktionen")
    .select(
      `transporteure ( firmenname, vorname_kontakt, name_kontakt ),
       auftraggeber ( vorname, name )`,
    )
    .eq("id", args.auctionUuid)
    .maybeSingle();

  const trN = meta?.transporteure as
    | { firmenname?: string; vorname_kontakt?: string; name_kontakt?: string }
    | null
    | undefined;
  const agN = meta?.auftraggeber as
    | { vorname?: string; name?: string }
    | null
    | undefined;

  const transporteurName =
    (trN?.firmenname?.trim() ||
      `${String(trN?.vorname_kontakt ?? "").trim()} ${
        String(trN?.name_kontakt ?? "").trim()
      }`.trim()) ||
    "";
  const auftraggeberName =
    `${String(agN?.vorname ?? "").trim()} ${String(agN?.name ?? "").trim()}`
      .trim() || "";

  const { data: agProf } = await admin
    .from("auftraggeber")
    .select("email")
    .eq("id", args.auftraggeberId)
    .maybeSingle();
  const { data: trProf } = await admin
    .from("transporteure")
    .select("email")
    .eq("id", args.awardedTransporteurId)
    .maybeSingle();

  const toAg = String(agProf?.email ?? "").trim();
  const toTr = String(trProf?.email ?? "").trim();

  const frontendBase =
    Deno.env.get("FRONTEND_URL") ??
    Deno.env.get("SITE_URL") ??
    "http://127.0.0.1:5173";

  await sendLieferungBewertungInviteEmails({
    anzeigeId: args.anzeigeId,
    frontendBase,
    toAuftraggeber: toAg,
    toTransporteur: toTr,
    transporteurName,
    auftraggeberName,
  });

  await admin
    .from("auktionen")
    .update({ rating_invite_sent_at: new Date().toISOString() })
    .eq("id", args.auctionUuid)
    .is("rating_invite_sent_at", null);
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
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")?.trim() ?? "";

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    anzeige_id?: string;
    qr_token?: string;
    test_simulate?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const testSimulate = body.test_simulate === true;
  const anzeigeId = String(body.anzeige_id ?? "").trim();
  const qrRaw = String(body.qr_token ?? "").trim();

  if (!anzeigeId || (!testSimulate && !qrRaw)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (testSimulate && !edgeIsTestMode()) {
    return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
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

  if (!serviceKey) {
    console.error("confirm-delivery-payment: SUPABASE_SERVICE_ROLE_KEY fehlt");
    return new Response(JSON.stringify({ ok: false, error: "server_misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: row, error: selErr } = await admin
    .from("auktionen")
    .select(
      `
      id,
      anzeige_id,
      status,
      qr_token,
      payment_intent_id,
      awarded_betrag,
      awarded_transporteur_id,
      auftraggeber_id,
      rating_invite_sent_at
    `,
    )
    .eq("anzeige_id", anzeigeId)
    .maybeSingle();

  if (selErr || !row) {
    console.warn("confirm-delivery-payment select", selErr);
    return new Response(JSON.stringify({ ok: false, error: "invalid" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (row.awarded_transporteur_id !== uid) {
    return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (row.status === "bezahlt") {
    return new Response(
      JSON.stringify({ ok: true, simulated: false, already_complete: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const dbTok = row.qr_token != null ? String(row.qr_token).trim() : "";
  const canDeliver =
    row.status === "awarded" || row.status === "bezahlt_simuliert";
  if (!canDeliver || !dbTok) {
    return new Response(JSON.stringify({ ok: false, error: "invalid" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!testSimulate && dbTok !== qrRaw) {
    return new Response(JSON.stringify({ ok: false, error: "invalid" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const piId = row.payment_intent_id != null
    ? String(row.payment_intent_id).trim()
    : "";

  const piIsSimulatedPlaceholder = /^pi_sim_/i.test(piId);
  let simulated =
    testSimulate || !stripeSecret || !piId || piIsSimulatedPlaceholder;
  let amountCentsCaptured: number | null = null;
  let currency = "chf";

  if (!simulated) {
    try {
      const stripe = new Stripe(stripeSecret);
      const pi = await stripe.paymentIntents.capture(piId);
      amountCentsCaptured =
        typeof pi.amount_received === "number"
          ? pi.amount_received
          : typeof pi.amount === "number"
            ? pi.amount
            : null;
      if (pi.currency) currency = String(pi.currency).toLowerCase();

      const { data: trRow } = await admin
        .from("transporteure")
        .select("stripe_connect_account_id")
        .eq("id", uid)
        .maybeSingle();

      const dest = trRow?.stripe_connect_account_id != null
        ? String(trRow.stripe_connect_account_id).trim()
        : "";

      if (dest && amountCentsCaptured != null && amountCentsCaptured > 0) {
        const transferAmt = Math.floor(amountCentsCaptured * 0.95);
        if (transferAmt > 0) {
          await stripe.transfers.create({
            amount: transferAmt,
            currency,
            destination: dest,
          });
        }
      } else if (!dest) {
        console.warn(
          "confirm-delivery-payment: kein stripe_connect_account_id, keine Transfer-Auszahlung",
        );
      }
    } catch (e) {
      console.error("Stripe capture/transfer", e);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "payment_failed",
          message: e instanceof Error ? e.message : String(e),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  const { data: updated, error: updErr } = await admin
    .from("auktionen")
    .update({ status: "bezahlt", qr_token: null })
    .eq("id", row.id)
    .in("status", ["awarded", "bezahlt_simuliert"])
    .eq("qr_token", dbTok)
    .select("id")
    .maybeSingle();

  if (updErr || !updated) {
    console.error("confirm-delivery-payment update", updErr);
    return new Response(
      JSON.stringify({ ok: false, error: "payment_failed", message: "db_update" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const totalFromDb = row.awarded_betrag != null ? Number(row.awarded_betrag) : NaN;
  let totalChf = Number.isFinite(totalFromDb) ? totalFromDb : 0;
  if (amountCentsCaptured != null) {
    totalChf = roundChf(amountCentsCaptured / 100);
  }
  if (totalChf <= 0) totalChf = 0;
  const provisionChf = roundChf(totalChf * 0.05);
  const payoutChf = roundChf(totalChf * 0.95);

  const { data: agProf } = await admin
    .from("auftraggeber")
    .select("email")
    .eq("id", row.auftraggeber_id)
    .maybeSingle();

  const { data: trProf } = await admin
    .from("transporteure")
    .select("email")
    .eq("id", uid)
    .maybeSingle();

  let toAg = String(agProf?.email ?? "").trim();
  let toTr = String(trProf?.email ?? "").trim();
  if (!toAg) toAg = "";
  if (!toTr) toTr = "";

  const edgeTest = edgeIsTestMode();
  const resendKey = edgeTest ? undefined : Deno.env.get("RESEND_API_KEY");
  const resendFrom =
    Deno.env.get("RESEND_FROM") ?? "321 meins <onboarding@resend.dev>";
  const smtpHost = Deno.env.get("PAYMENT_EMAIL_SMTP_HOST")?.trim();
  const smtpPort = Number(Deno.env.get("PAYMENT_EMAIL_SMTP_PORT") ?? "1025");
  const smtpFrom =
    Deno.env.get("PAYMENT_EMAIL_FROM") ??
    "321 meins <noreply@321-meins.local>";

  if (toAg && toTr) {
    await sendPaymentEmails({
      edgeTest,
      resendKey: resendKey ?? undefined,
      resendFrom,
      smtpHost: smtpHost ?? undefined,
      smtpPort,
      smtpFrom,
      toAuftraggeber: toAg,
      toTransporteur: toTr,
      anzeigeId,
      totalChf,
      provisionChf,
      payoutChf,
      simulated,
    });
  } else {
    console.warn("confirm-delivery-payment: fehlende E-Mail-Adresse(n)", {
      toAg: Boolean(toAg),
      toTr: Boolean(toTr),
    });
  }

  try {
    await maybeSendLieferungBewertungInvites(admin, {
      auctionUuid: String(row.id),
      anzeigeId,
      auftraggeberId: String(row.auftraggeber_id),
      awardedTransporteurId: String(row.awarded_transporteur_id ?? ""),
      ratingInviteSentAt: row.rating_invite_sent_at as string | null | undefined,
    });
  } catch (e) {
    console.error("confirm-delivery-payment rating invites", e);
  }

  return new Response(
    JSON.stringify({ ok: true, simulated }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
