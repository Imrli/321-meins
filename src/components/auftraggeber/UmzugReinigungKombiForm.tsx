import { useMemo, useState } from "react";
import type { AuctionDraft } from "@/types/auction";
import {
  datumUhrzeitToAbholdatum,
  zeitfensterToLieferzeit,
} from "@/types/umzugDetails";
import type { UmzugZeitfenster } from "@/types/umzugDetails";
import {
  AuctionDurationField,
  DEFAULT_AUCTION_DURATION,
  durationValueToMs,
  type DurationValue,
} from "@/components/auftraggeber/auctionDuration";
import {
  AuctionField,
  AuctionTextarea,
  FormPartDivider,
  FormSection,
} from "@/components/auftraggeber/auctionFormUi";
import { ReinigungFormFields } from "@/components/auftraggeber/ReinigungFormFields";
import {
  buildReinigungDetails,
  collectReinigungMissing,
  initialReinigungForm,
  type ReinigungFormState,
} from "@/components/auftraggeber/reinigungFormShared";
import { UmzugFormFields } from "@/components/auftraggeber/UmzugFormFields";
import {
  buildUmzugDetails,
  collectUmzugMissing,
  initialUmzugForm,
  type UmzugFormState,
} from "@/components/auftraggeber/umzugFormShared";

type KombiFormProps = {
  onCancel: () => void;
  addAuction: (draft: AuctionDraft) => Promise<string>;
  goToMyAuctions: () => void;
  notesContactBlocked?: (notes: string) => boolean;
};

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m5 12 5 5 9-11" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}

export function UmzugReinigungKombiForm({
  onCancel,
  addAuction,
  goToMyAuctions,
  notesContactBlocked = () => false,
}: KombiFormProps) {
  const [umzug, setUmzug] = useState<UmzugFormState>(initialUmzugForm);
  const [reinigung, setReinigung] =
    useState<ReinigungFormState>(initialReinigungForm);
  const [gesamtpreis, setGesamtpreis] = useState("");
  const [bemerkungen, setBemerkungen] = useState("");
  const [umzugErrors, setUmzugErrors] = useState<Set<keyof UmzugFormState>>(
    new Set(),
  );
  const [reinigungErrors, setReinigungErrors] = useState<
    Set<keyof ReinigungFormState>
  >(new Set());
  const [kombiErrors, setKombiErrors] = useState<{ gesamtpreis?: boolean }>({});
  const [showError, setShowError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [duration, setDuration] = useState<DurationValue>(DEFAULT_AUCTION_DURATION);

  const notizenBlocked = useMemo(
    () =>
      notesContactBlocked(umzug.notizen) ||
      notesContactBlocked(reinigung.sonderwuensche) ||
      notesContactBlocked(bemerkungen),
    [
      umzug.notizen,
      reinigung.sonderwuensche,
      bemerkungen,
      notesContactBlocked,
    ],
  );

  const updateUmzug = (name: string, value: string | boolean) => {
    setUmzug((prev) => ({ ...prev, [name]: value }));
    setSubmitError(null);
    if (typeof value === "string" && umzugErrors.has(name as keyof UmzugFormState)) {
      const next = new Set(umzugErrors);
      next.delete(name as keyof UmzugFormState);
      setUmzugErrors(next);
    }
  };

  const updateReinigung = (name: string, value: string | boolean) => {
    setReinigung((prev) => ({ ...prev, [name]: value }));
    setSubmitError(null);
    if (
      typeof value === "string" &&
      reinigungErrors.has(name as keyof ReinigungFormState)
    ) {
      const next = new Set(reinigungErrors);
      next.delete(name as keyof ReinigungFormState);
      setReinigungErrors(next);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const uMissing = collectUmzugMissing(umzug);
    const rMissing = collectReinigungMissing(reinigung);
    const preisMissing = !gesamtpreis.trim() || Number(gesamtpreis) <= 0;

    setUmzugErrors(uMissing);
    setReinigungErrors(rMissing);
    setKombiErrors({ gesamtpreis: preisMissing });

    if (uMissing.size > 0 || rMissing.size > 0 || preisMissing) {
      setShowError(true);
      return;
    }
    if (notizenBlocked) return;
    setShowError(false);

    const abholdatum = datumUhrzeitToAbholdatum(umzug.datum_uhrzeit);
    if (!abholdatum) {
      setSubmitError("Bitte im Umzug-Teil Datum und Uhrzeit angeben.");
      return;
    }

    const preis = Number(gesamtpreis);
    const umzugDetails = buildUmzugDetails(umzug);
    const reinigungDetails = buildReinigungDetails(reinigung);

    const durationResult = durationValueToMs(duration);
    if (!durationResult.ok) {
      setSubmitError(durationResult.error);
      return;
    }

    try {
      const newId = await addAuction({
        startort: umzug.von.trim(),
        zielort: umzug.nach.trim(),
        empfVorname: "–",
        empfName: "–",
        empfStrasse: umzug.nach.trim(),
        empfPlz: "–",
        empfOrt: "–",
        abholdatum,
        lieferdatum: abholdatum,
        lieferzeitpraeferenz: zeitfensterToLieferzeit(
          umzug.zeitfenster as UmzugZeitfenster,
        ),
        notizen: bemerkungen.trim() || undefined,
        durationMs: durationResult.durationMs,
        startPrice: preis,
        umzugDetails,
        reinigungDetails,
      });
      if (!newId) {
        setSubmitError(
          "Die Auktion konnte nicht gespeichert werden. Bitte prüfe deine Anmeldung und Verbindung.",
        );
        return;
      }
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Die Auktion konnte nicht gespeichert werden.",
      );
    }
  };

  if (success) {
    return (
      <div
        id="umzug-reinigung-erfassen"
        className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-8 anim-fade-up"
      >
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
            <CheckIcon className="size-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-extrabold text-emerald-900">
              Auktion gestartet!
            </h3>
            <p className="mt-1 text-sm text-emerald-800">
              Dein Kombi-Auftrag Umzug + Reinigung von{" "}
              <strong>{umzug.von}</strong> nach <strong>{umzug.nach}</strong> ist
              live (Startpreis CHF {Number(gesamtpreis)}).
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setUmzug(initialUmzugForm);
                  setReinigung(initialReinigungForm);
                  setGesamtpreis("");
                  setBemerkungen("");
                  setDuration(DEFAULT_AUCTION_DURATION);
                  setSuccess(false);
                  goToMyAuctions();
                }}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors btn-action-shine"
              >
                Zu meinen Auktionen
                <ArrowIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setUmzug(initialUmzugForm);
                  setReinigung(initialReinigungForm);
                  setGesamtpreis("");
                  setBemerkungen("");
                  setDuration(DEFAULT_AUCTION_DURATION);
                  setSuccess(false);
                  onCancel();
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                Zurück zur Übersicht
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      id="umzug-reinigung-erfassen"
      onSubmit={onSubmit}
      noValidate
      className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm anim-fade-up"
    >
      <div className="border-b border-slate-100 px-7 py-5 md:px-10">
        <h3 className="text-xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-2xl">
          Auftrag erfassen
        </h3>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          <span className="inline-flex items-center rounded-full bg-[var(--color-brand-50)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-brand-700)] ring-1 ring-[var(--color-brand-100)]">
            Umzug + Reinigung
          </span>
          <span className="ml-2">
            – Ein Preis für beide Leistungen, live in der Auktion.
          </span>
        </p>
      </div>

      <div className="space-y-8 px-7 py-7 md:px-10 md:py-9">
        <div className="space-y-8">
          <p className="text-base font-bold text-[var(--color-brand-700)]">
            Teil 1: Umzug
          </p>
          <UmzugFormFields
            form={umzug}
            errors={umzugErrors}
            onChange={updateUmzug}
            notizenBlocked={notesContactBlocked(umzug.notizen)}
          />
        </div>

        <FormPartDivider title="Teil 2: Reinigung" />

        <div className="space-y-8">
          <ReinigungFormFields
            form={reinigung}
            errors={reinigungErrors}
            onChange={updateReinigung}
            sonderBlocked={notesContactBlocked(reinigung.sonderwuensche)}
          />
        </div>

        <FormPartDivider title="Gesamtauftrag" />

        <FormSection title="Preis & Bemerkungen">
          <div className="grid gap-5 md:grid-cols-2">
            <AuctionField
              label="Gesamtpreis (CHF)"
              name="gesamtpreis"
              value={gesamtpreis}
              onChange={(_name, v) => {
                setGesamtpreis(v);
                setSubmitError(null);
                if (kombiErrors.gesamtpreis) setKombiErrors({});
              }}
              required
              error={kombiErrors.gesamtpreis}
              type="number"
              inputMode="decimal"
              placeholder="z. B. 2500"
            />
          </div>
          <p className="text-xs text-slate-500">
            Ein Preis für Umzug und Reinigung zusammen – wird als Startpreis in
            der Live-Auktion angezeigt.
          </p>
          <AuctionTextarea
            label="Bemerkungen zum Gesamtauftrag"
            name="bemerkungen"
            value={bemerkungen}
            onChange={(_, v) => setBemerkungen(v)}
            optional
            placeholder="Optional: Abstimmung Umzug/Reinigung, Termine, Besonderheiten …"
          />
          {notesContactBlocked(bemerkungen) && (
            <p className="text-sm font-medium text-red-600">
              Keine Kontaktdaten in den Bemerkungen erlaubt.
            </p>
          )}
        </FormSection>

        <AuctionDurationField value={duration} onChange={setDuration} />

        {showError && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            Bitte füllen Sie alle Pflichtfelder aus.
          </p>
        )}
        {submitError && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {submitError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={notizenBlocked}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent-500)] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 transition-colors hover:bg-[var(--color-accent-600)] disabled:cursor-not-allowed disabled:opacity-50 btn-action-shine"
          >
            Auktion starten
            <ArrowIcon className="size-4" />
          </button>
        </div>
      </div>
    </form>
  );
}
