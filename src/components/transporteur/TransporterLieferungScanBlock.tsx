import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import type { Auction } from "../../types/auction";
import { isAppTestMode } from "../../lib/appTestMode";
import {
  confirmAuctionDelivery,
  confirmAuctionDeliveryTestSimulate,
  type ConfirmDeliveryOutcome,
} from "../../lib/supabaseAuctions";

const DELIVERY_QR_FAIL =
  "Ungültiger QR-Code. Bitte versuche es erneut.";
const PAYMENT_FAIL =
  "Die Zahlung konnte nicht abgeschlossen werden. Bitte versuche es erneut oder kontaktiere den Support.";

function formatChf(n: number): string {
  const x = Number.isFinite(n) ? n : 0;
  return x.toFixed(2);
}

export function TransporterLieferungScanBlock({
  auction,
  rowKey,
  refreshAuctions,
  useSupabase,
  markAuctionDeliveredMock,
  onAfterDeliveryConfirmed,
}: {
  auction: Auction;
  rowKey: string;
  refreshAuctions: () => Promise<void>;
  useSupabase: boolean;
  markAuctionDeliveredMock: (anzeigeId: string) => void;
  onAfterDeliveryConfirmed?: () => void | Promise<void>;
}) {
  const readerId = useMemo(
    () => `tr-qr-${rowKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    [rowKey],
  );

  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");
  const [manualTok, setManualTok] = useState("");
  /** Nach erfolgreicher Lieferung: Live-Zahlung simuliert (kein Stripe / kein PaymentIntent) */
  const [simulatedPayment, setSimulatedPayment] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  const chfAmount = auction.awardedBid?.price ?? auction.startPrice ?? 0;

  useEffect(() => {
    if (auction.auctionStatus !== "bezahlt") return;
    try {
      if (
        sessionStorage.getItem(`321meins-delivery-sim-${auction.id}`) === "1"
      ) {
        setSimulatedPayment(true);
      }
    } catch {
      /* ignore */
    }
  }, [auction.auctionStatus, auction.id]);

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    if (!s) return;
    try {
      await s.stop();
    } catch {
      /* ignore */
    }
    try {
      s.clear();
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
  }, []);

  const finalizeOk = useCallback(
    async (res: ConfirmDeliveryOutcome) => {
      if (!res.ok) return;
      setBusy(false);
      setSimulatedPayment(res.simulated);
      if (res.simulated) {
        try {
          sessionStorage.setItem(
            `321meins-delivery-sim-${auction.id}`,
            "1",
          );
        } catch {
          /* ignore */
        }
      }
      if (useSupabase) await refreshAuctions();
      else markAuctionDeliveredMock(auction.id);
      await onAfterDeliveryConfirmed?.();
      setOpen(false);
      setManual(false);
      setManualTok("");
      await stopScanner();
    },
    [
      auction.id,
      markAuctionDeliveredMock,
      onAfterDeliveryConfirmed,
      refreshAuctions,
      stopScanner,
      useSupabase,
    ],
  );

  /** Testmodus: simulierter erfolgreicher Scan nach 1 s */
  useEffect(() => {
    if (!isAppTestMode() || !open) return;
    const canSim =
      auction.auctionStatus === "awarded" ||
      auction.auctionStatus === "bezahlt_simuliert";
    if (!canSim) return;
    let cancelled = false;
    setBusy(true);
    const t = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return;
        const res = useSupabase
          ? await confirmAuctionDeliveryTestSimulate(auction.id)
          : await confirmAuctionDelivery(auction.id, "test-mode-auto");
        if (cancelled) return;
        if (res.ok) await finalizeOk(res);
        else {
          setBusy(false);
          if (res.reason === "payment_failed") setErr(PAYMENT_FAIL);
          else setErr(DELIVERY_QR_FAIL);
        }
      })();
    }, 1000);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setBusy(false);
    };
  }, [
    open,
    auction.auctionStatus,
    auction.id,
    useSupabase,
    finalizeOk,
  ]);

  const handlePayload = useCallback(
    async (text: string) => {
      if (isAppTestMode()) return;
      setErr(null);
      let auftragId = "";
      let token = "";
      try {
        const j = JSON.parse(text) as { auftrag_id?: string; token?: string };
        if (j.auftrag_id != null && j.token != null) {
          auftragId = String(j.auftrag_id).trim();
          token = String(j.token).trim();
        }
      } catch {
        setErr(DELIVERY_QR_FAIL);
        return;
      }
      if (!auftragId || !token) {
        setErr(DELIVERY_QR_FAIL);
        return;
      }
      if (auftragId !== auction.id.trim()) {
        setErr(DELIVERY_QR_FAIL);
        return;
      }
      setBusy(true);
      const res = await confirmAuctionDelivery(auftragId, token);
      setBusy(false);
      if (res.ok) await finalizeOk(res);
      else {
        if (res.reason === "payment_failed") setErr(PAYMENT_FAIL);
        else setErr(DELIVERY_QR_FAIL);
      }
    },
    [
      auction.id,
      finalizeOk,
    ],
  );

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  const startCamera = async () => {
    if (isAppTestMode()) return;
    setErr(null);
    setManual(false);
    await stopScanner();
    const el = document.getElementById(readerId);
    if (!el) return;
    const h = new Html5Qrcode(readerId);
    scannerRef.current = h;
    try {
      await h.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          void (async () => {
            try {
              await h.stop();
              await h.clear();
            } catch {
              /* ignore */
            }
            scannerRef.current = null;
            await handlePayload(decoded);
          })();
        },
        () => {},
      );
    } catch {
      await stopScanner();
      if (!isAppTestMode()) {
        setManual(true);
        setManualId((p) => p || auction.id);
      }
      setErr(null);
    }
  };

  if (auction.auctionStatus === "bezahlt") {
    return (
      <div className="mt-0 space-y-2" data-no-row-toggle>
        <p className="text-sm font-medium text-emerald-700">
          Lieferung bestätigt – QR-Code gültig.
        </p>
        <p className="text-sm font-medium text-emerald-700">
          Zahlung erfolgreich ausgelöst. Der Betrag wird in Kürze auf dein
          Konto überwiesen.
        </p>
        {isAppTestMode() ? (
          <p className="text-sm font-medium text-amber-800">
            Zahlung simuliert – Betrag CHF {formatChf(chfAmount)} würde jetzt
            eingezogen.
          </p>
        ) : (
          simulatedPayment && (
            <p className="text-sm font-medium text-amber-800">
              Zahlung simuliert – im Live-Modus wird Stripe verwendet.
            </p>
          )
        )}
      </div>
    );
  }

  if (auction.auctionStatus === "geliefert") {
    return (
      <p
        className="mt-0 text-sm font-medium text-emerald-700"
        data-no-row-toggle
      >
        Lieferung bestätigt – QR-Code gültig.
      </p>
    );
  }

  return (
    <div
      className={`space-y-2 ${open ? "w-full min-w-0 sm:max-w-lg sm:ml-auto" : ""}`}
      data-no-row-toggle
      onClick={(e) => e.stopPropagation()}
    >
      {!open ? (
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            className="inline-flex min-h-[2.75rem] items-center justify-center rounded-full bg-[var(--color-accent-500)] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-orange-900/20 transition-colors hover:bg-[var(--color-accent-600)] btn-action-shine"
            onClick={() => {
              setOpen(true);
              setErr(null);
              setManual(false);
            }}
          >
            QR-Code scannen
          </button>
          <p className="max-w-[16rem] text-right text-[11px] leading-snug text-slate-500">
            Scanne den QR-Code, den dir der Empfänger bei der Übergabe zeigt.
          </p>
        </div>
      ) : (
        <div className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          {isAppTestMode() ? (
            <>
              <p className="text-[11px] text-slate-600">
                Testmodus: Erfolgreicher Scan wird in 1 Sekunde simuliert …
              </p>
              {busy && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Bitte kurz warten …
                </p>
              )}
              <div className="mt-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setOpen(false);
                    setManual(false);
                    setErr(null);
                    void stopScanner();
                  }}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 disabled:opacity-50"
                >
                  Schliessen
                </button>
              </div>
            </>
          ) : !manual ? (
            <>
              <div
                id={readerId}
                className="min-h-[200px] w-full max-w-sm overflow-hidden rounded-lg bg-black/5"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startCamera()}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
                >
                  Kamera starten
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setManual(true);
                    setManualId((p) => p || auction.id);
                    void stopScanner();
                  }}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
                >
                  Manuell eingeben
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setOpen(false);
                    setManual(false);
                    setErr(null);
                    void stopScanner();
                  }}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 disabled:opacity-50"
                >
                  Schliessen
                </button>
              </div>
            </>
          ) : (
            <div className="grid gap-2">
              <p className="text-[11px] text-slate-600">
                Keine Kamera verfügbar oder Test am Desktop: Auftrag-ID und
                Token wie im QR-Code (JSON) eingeben.
              </p>
              <input
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="Auftrag-ID (z. B. A-…)"
                className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-brand-500)]"
              />
              <input
                type="text"
                value={manualTok}
                onChange={(e) => setManualTok(e.target.value)}
                placeholder="Token (UUID)"
                className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-brand-500)]"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void handlePayload(
                      JSON.stringify({
                        auftrag_id: manualId.trim(),
                        token: manualTok.trim(),
                      }),
                    )
                  }
                  className="inline-flex items-center rounded-full bg-[var(--color-brand-700)] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-50 btn-action-shine"
                >
                  Prüfen
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setManual(false);
                    setErr(null);
                  }}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700"
                >
                  Zurück zur Kamera
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setOpen(false);
                    setManual(false);
                    void stopScanner();
                  }}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600"
                >
                  Schliessen
                </button>
              </div>
            </div>
          )}
          {err && (
            <p className="mt-2 text-sm font-medium text-red-600">{err}</p>
          )}
        </div>
      )}
    </div>
  );
}
