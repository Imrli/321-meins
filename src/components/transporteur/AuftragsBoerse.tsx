import * as store from "@/lib/mockStore";
import type { Bid } from "@/types/auction";
import { GebotszeileRow } from "@/components/auction/BidRowDisplay";
import { useAuth } from "@/hooks/useAuth";
import { useMockStoreVersion } from "@/hooks/useMockStoreVersion";
import { CountdownTimer } from "@/components/kunde/CountdownTimer";
import { GebotAbgeben } from "./GebotAbgeben";
import { useEffect, useState } from "react";

function formatChf(n: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(n);
}

export function AuftragsBoerse() {
  const { userId, profile } = useAuth();
  const canBid = profile?.rolle === "transporteur" && profile.zahlungsstatus;

  useMockStoreVersion();
  const offen = store.listOffeneAuftraegeBoerse();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!userId) return null;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="title-section-321">Auktionen (live)</h2>
        <p className="caption-321 mt-1">
          Nur unterbieten. Der niedrigste Preis führt. Bei gleichem Preis zählt das frühere Gebot.
        </p>
        {!canBid && (
          <p className="mt-2 text-sm text-amber-800">
            Aktiviere &quot;Zahlung aktiv (Test)&quot;, um mitzubieten.
          </p>
        )}
      </div>
      {offen.length === 0 ? (
        <p className="card-321 text-center text-[#6B7280]">Keine laufende Auktion.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {offen.map((a) => {
            const gebote = store.listGeboteForAuftrag(a.id);
            const leader = store.getAktuellNiedrigster(a.id);
            const meins = userId ? store.getLetztesEigenesGebot(a.id, userId) : null;
            return (
              <li key={a.id} className="card-321">
                <p className="text-xs font-medium uppercase text-[#6B7280]">{a.dienstleistung_typ}</p>
                <p className="mt-1 font-medium text-[#1F2937]">
                  {a.beschreibung?.slice(0, 200)}
                  {a.beschreibung && a.beschreibung.length > 200 ? "…" : ""}
                </p>
                <p className="mt-1 text-sm text-[#6B7280]">
                  {a.abholort} → {a.zielort}
                  {a.gewicht_kg != null && ` · ${a.gewicht_kg} kg`}
                </p>
                {a.bilder[0] && (
                  <div className="mt-2 max-h-32 max-w-sm overflow-hidden rounded-[12px]">
                    <img src={a.bilder[0]} alt="" className="max-h-32 w-full object-cover" />
                  </div>
                )}
                <div className="mt-4 flex flex-col items-center gap-2">
                  <p className="text-sm text-[#6B7280]">Ende in</p>
                  <CountdownTimer endIso={a.countdown_ende} vibrateId={`t-${a.id}`} size="lg" />
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-[#6B7280]">Aktuell führend</p>
                  <p className="text-2xl font-bold text-[#F4A261] sm:text-3xl">
                    {leader ? formatChf(leader.preis_chf) : "—"}
                  </p>
                  {meins && (
                    <p className="caption-321 mt-1">
                      Dein letztes Gebot: {formatChf(meins.preis_chf)}
                    </p>
                  )}
                </div>
                <h3 className="mt-4 text-sm font-semibold text-[#1E3A5F]">Alle Gebote (günstig zuerst)</h3>
                {gebote.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">Noch keine Gebote.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {gebote.map((g) => {
                      const meta = store.getTransporteurGebotListeMeta(
                        g.transporteur_id,
                      );
                      const bid: Bid = {
                        initials: store.getTransporterKuerzelForGebot(
                          g.transporteur_id,
                        ),
                        price: g.preis_chf,
                        ts: new Date(g.created_at).getTime(),
                        verifiziert: meta.verifiziert ? true : undefined,
                        bewertung: meta.bewertung,
                      };
                      return (
                        <li
                          key={g.id}
                          className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5"
                        >
                          <GebotszeileRow
                            bid={bid}
                            timeLabel={store.formatGebotRelativeFromIso(
                              g.created_at,
                              now,
                            )}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
                {canBid && (
                  <GebotAbgeben
                    auftragId={a.id}
                    transporteurId={userId}
                    aktuellNiedrigstesChf={leader?.preis_chf ?? null}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
