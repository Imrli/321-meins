import * as store from "@/lib/mockStore";
import { FahrerInfoBlock } from "@/components/auction/BidRowDisplay";
import { useAuth } from "@/hooks/useAuth";
import { useMockStoreVersion } from "@/hooks/useMockStoreVersion";
import { CountdownTimer } from "./CountdownTimer";
import type { Auftrag } from "@/types";
import { useState } from "react";

/** Nur hier: einfache Minuten-Buttons; Sekunden-API des Stores */
const WIEDERHOLEN_MINUTEN = [1, 2, 3, 5, 10] as const;

function formatChf(n: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(n);
}

function AuftragKarte({ a, kundeId }: { a: Auftrag; kundeId: string }) {
  const leader = store.getAktuellNiedrigster(a.id);
  const [minWdh, setMinWdh] = useState<(typeof WIEDERHOLEN_MINUTEN)[number]>(5);
  const [wdhMsg, setWdhMsg] = useState<string | null>(null);

  const kannWiederholen =
    a.status === "leer_abgelaufen" &&
    a.wiederholbar_ab &&
    new Date(a.wiederholbar_ab).getTime() <= Date.now();

  function wiederholen() {
    setWdhMsg(null);
    const r = store.mockWiederholeAuftrag(a.id, kundeId, minWdh * 60);
    if (!r.ok) setWdhMsg(r.error);
    else setWdhMsg("Auktion erneut gestartet.");
  }

  const kundeMail = store.getKontaktEmail(kundeId);
  const winnerGeb = a.bestes_gebot_id ? store.getGebotById(a.bestes_gebot_id) : null;
  const winnerMail = winnerGeb ? store.getKontaktEmail(winnerGeb.transporteur_id) : null;

  return (
    <article className="card-321 flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1E3A5F]">
            {a.abholort} → {a.zielort}
          </h3>
          <p className="caption-321">{a.transport_art}</p>
        </div>
        <span className="badge-321 shrink-0">{store.getStatusLabel(a.status)}</span>
      </div>
      {a.beschreibung && <p className="text-sm text-[#1F2937]">{a.beschreibung}</p>}
      {a.notizen && <p className="caption-321">{a.notizen}</p>}
      {a.bilder[0] && (
        <div className="max-h-40 w-full max-w-sm overflow-hidden rounded-[12px] border border-slate-100">
          <img src={a.bilder[0]} alt="" className="h-full max-h-40 w-full object-cover" />
        </div>
      )}

      {a.status === "offen" && (
        <div className="flex flex-col items-center gap-4 border-y border-slate-100 py-6">
          <p className="text-sm font-medium text-[#6B7280]">Auktions-Ende</p>
          <CountdownTimer endIso={a.countdown_ende} vibrateId={a.id} size="xl" />
          <div className="text-center">
            <p className="text-sm text-[#6B7280]">Aktuell führend (niedrigster Preis)</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-[#F4A261] sm:text-4xl">
              {leader ? formatChf(leader.preis_chf) : "—"}
            </p>
            {leader && (
              <p className="caption-321 mt-1 inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                <FahrerInfoBlock
                  initials={store.getTransporterKuerzelForGebot(
                    leader.transporteur_id,
                  )}
                  {...store.getTransporteurGebotListeMeta(leader.transporteur_id)}
                />
                <span className="text-[#6B7280]">· in Echtzeit</span>
              </p>
            )}
            {!leader && <p className="caption-321 mt-1">Noch kein Gebot</p>}
          </div>
        </div>
      )}

      {a.status === "vermittelt" && winnerGeb && (
        <div className="rounded-[12px] border border-[#10B981]/30 bg-emerald-50/60 p-4">
          <p className="text-sm font-semibold text-[#1E3A5F]">Vermittelt</p>
          <p className="mt-1 text-2xl font-bold text-[#F4A261]">{formatChf(winnerGeb.preis_chf)}</p>
          <p className="mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#1F2937]">
            <span>Gewinner:</span>
            <FahrerInfoBlock
              initials={store.getTransporterKuerzelForGebot(
                winnerGeb.transporteur_id,
              )}
              {...store.getTransporteurGebotListeMeta(winnerGeb.transporteur_id)}
            />
          </p>
          <div className="mt-3 space-y-1 text-sm text-[#1F2937]">
            <p>
              <span className="text-[#6B7280]">Kontakt Kunde: </span>
              {kundeMail ?? "—"}
            </p>
            <p>
              <span className="text-[#6B7280]">Kontakt Transporteur: </span>
              {winnerMail ?? "—"}
            </p>
          </div>
        </div>
      )}

      {a.status === "leer_abgelaufen" && (
        <div className="space-y-3">
          <p className="text-sm text-[#1F2937]">
            Kein Transporteur hat ein Gebot abgegeben. Du kannst die Auktion in 1 Stunde neu starten.
          </p>
          {!kannWiederholen && a.wiederholbar_ab && (
            <p className="text-sm text-[#6B7280]">
              Warten bis: {new Date(a.wiederholbar_ab).toLocaleString("de-CH")}
            </p>
          )}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="label-321">Dauer (Min.)</label>
              <div className="flex flex-wrap gap-2">
                {WIEDERHOLEN_MINUTEN.map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={!kannWiederholen}
                    onClick={() => setMinWdh(m)}
                    className={`min-h-10 min-w-[2.75rem] rounded-lg border text-sm font-semibold transition disabled:opacity-40 ${
                      minWdh === m
                        ? "border-[#1E3A5F] bg-[#1E3A5F] text-white"
                        : "border-slate-200 bg-white text-[#1F2937] hover:bg-slate-50"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled={!kannWiederholen}
              onClick={wiederholen}
              className="btn-primary-321"
            >
              Auktion wiederholen
            </button>
          </div>
          {wdhMsg && (
            <p
              className={
                wdhMsg.includes("gestartet") ? "text-sm text-[#10B981]" : "text-sm text-[#DC2626]"
              }
            >
              {wdhMsg}
            </p>
          )}
        </div>
      )}

      {a.status === "offen" && (
        <p className="caption-321">Gebote nur unterbieten. Gleicher Preis nur beim ersten Vorkommen gültig.</p>
      )}
    </article>
  );
}

export function AuftragUebersicht() {
  const { userId } = useAuth();
  useMockStoreVersion();
  const data = userId ? store.listAuftraegeForKunde(userId) : [];

  if (!userId) return null;
  if (data.length === 0) {
    return (
      <p className="card-321 text-center text-[#6B7280]">
        Noch keine Auktionen. Starte oben die erste.
      </p>
    );
  }
  return (
    <section className="flex flex-col gap-4">
      <h2 className="title-section-321">Meine Auktionen</h2>
      <ul className="flex flex-col gap-4">
        {data.map((a) => (
          <li key={a.id}>
            <AuftragKarte a={a} kundeId={userId} />
          </li>
        ))}
      </ul>
    </section>
  );
}
