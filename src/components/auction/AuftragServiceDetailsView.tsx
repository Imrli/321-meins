import type { ReactNode } from "react";
import { FormPartDivider } from "@/components/auftraggeber/auctionFormUi";
import type { Auction } from "@/types/auction";
import type { ReinigungDetails } from "@/types/reinigungDetails";
import type { UmzugDetails } from "@/types/umzugDetails";

function formatDatumUhrzeit(iso: string | undefined): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso.trim());
  if (Number.isNaN(d.getTime())) return iso.trim();
  return d.toLocaleString("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        {children}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  if (value == null || value === "") return null;
  return (
    <>
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </>
  );
}

function boolJaNein(v: boolean | undefined): string {
  return v ? "Ja" : "Nein";
}

function zusaetzlicheUmzug(d: UmzugDetails): string | null {
  const parts: string[] = [];
  if (d.zusaetzliche.einpacken) parts.push("Einpacken");
  if (d.zusaetzliche.auspacken) parts.push("Auspacken");
  if (d.zusaetzliche.entsorgung_verpackung) parts.push("Entsorgung von Verpackung");
  return parts.length > 0 ? parts.join(", ") : null;
}

function UmzugDetailsBlock({ d }: { d: UmzugDetails }) {
  return (
    <div className="space-y-5">
      <DetailSection title="Adressen">
        <DetailRow label="Von (Startadresse)" value={d.von} />
        <DetailRow label="Nach (Zieladresse)" value={d.nach} />
      </DetailSection>

      <DetailSection title="Umzugsdetails">
        <DetailRow label="Umzugsart" value={d.umzugsart} />
        <DetailRow label="Wohnungsgrösse (m²)" value={d.wohnungsgroesse_qm} />
        <DetailRow label="Zimmeranzahl" value={d.zimmeranzahl} />
        <DetailRow label="Parkplatz vorhanden?" value={d.parkplatz} />
        <DetailRow label="Stockwerk Start" value={d.stockwerk_start} />
        <DetailRow
          label="Aufzug Start"
          value={boolJaNein(d.aufzug_start)}
        />
        <DetailRow label="Stockwerk Ziel" value={d.stockwerk_ziel} />
        <DetailRow label="Aufzug Ziel" value={boolJaNein(d.aufzug_ziel)} />
      </DetailSection>

      <DetailSection title="Möbel & Demontage">
        <DetailRow label="Möbel mit Demontage?" value={d.moebel_demontage} />
        <DetailRow
          label="Besondere Möbel"
          value={d.besondere_moebel?.trim() || null}
        />
      </DetailSection>

      <DetailSection title="Schachteln & Verpackung">
        <DetailRow
          label="Benötigt der Kunde Umzugsschachteln?"
          value={d.schachteln_benoetigt}
        />
        {d.schachteln_benoetigt === "Ja" && (
          <>
            <DetailRow
              label="Schachteln vom Kunden gepackt"
              value={d.schachteln_kunde_gepackt ?? null}
            />
            <DetailRow
              label="Zusätzliche Schachteln vom Unternehmen"
              value={d.schachteln_unternehmen ?? null}
            />
            <DetailRow
              label="Schachteln am Zielort auspacken"
              value={d.schachteln_auspacken ?? null}
            />
          </>
        )}
      </DetailSection>

      <DetailSection title="Zusätzliche Dienstleistungen">
        <DetailRow label="Auswahl" value={zusaetzlicheUmzug(d)} />
      </DetailSection>

      <DetailSection title="Zeit & Notizen">
        <DetailRow
          label="Datum / Uhrzeit"
          value={formatDatumUhrzeit(d.datum_uhrzeit)}
        />
        <DetailRow label="Zeitfenster" value={d.zeitfenster} />
        <DetailRow
          label="Notizen / Besonderheiten"
          value={d.notizen?.trim() || null}
        />
      </DetailSection>
    </div>
  );
}

function ReinigungDetailsBlock({ d }: { d: ReinigungDetails }) {
  return (
    <div className="space-y-5">
      <DetailSection title="Adresse">
        <DetailRow
          label="Adresse der zu reinigenden Wohnung"
          value={d.adresse}
        />
      </DetailSection>

      <DetailSection title="Grunddaten">
        <DetailRow label="Wohnungsgrösse (m²)" value={d.wohnungsgroesse_qm} />
        <DetailRow label="Zimmeranzahl" value={d.zimmeranzahl} />
      </DetailSection>

      <DetailSection title="Reinigungsart">
        <DetailRow label="Art der Reinigung" value={d.reinigungsart} />
      </DetailSection>

      <DetailSection title="Zusatzleistungen">
        <DetailRow label="Fensterreinigung" value={d.fensterreinigung} />
        <DetailRow label="Küchenreinigung" value={d.kuechenreinigung} />
        <DetailRow label="Kühlschrank abtauen?" value={d.kuehlschrank_abtauen} />
        <DetailRow
          label="Waschmaschine / Tumbler reinigen?"
          value={d.waschmaschine_tumbler}
        />
      </DetailSection>

      <DetailSection title="Balkon">
        <DetailRow label="Balkon vorhanden?" value={d.balkon_vorhanden} />
        {d.balkon_vorhanden === "Ja" && (
          <DetailRow label="ca. Quadratmeter" value={d.balkon_qm ?? null} />
        )}
      </DetailSection>

      <DetailSection title="Sonderwünsche & Garantie">
        <DetailRow
          label="Sonderwünsche"
          value={d.sonderwuensche?.trim() || null}
        />
        <DetailRow
          label="Abgabegarantie"
          value={d.abgabegarantie ? "Ja" : "Nein"}
        />
      </DetailSection>

      <DetailSection title="Zeit & Zugang">
        <DetailRow
          label="Datum / Uhrzeit"
          value={formatDatumUhrzeit(d.datum_uhrzeit)}
        />
        <DetailRow label="Zeitfenster" value={d.zeitfenster} />
        <DetailRow label="Zugang zur Wohnung" value={d.zugang} />
      </DetailSection>
    </div>
  );
}

export function AuftragServiceDetailsView({
  auction,
  compact,
  embedded,
}: {
  auction: Auction;
  /** Kompakte Box für Tabellen-Expand */
  compact?: boolean;
  /** Nur Inhalt, ohne Rahmen (z. B. in Kontakt-Block) */
  embedded?: boolean;
}) {
  const { umzugDetails, reinigungDetails } = auction;
  if (!umzugDetails && !reinigungDetails) return null;

  const inner = (
    <>
      {umzugDetails && reinigungDetails && (
        <>
          <UmzugDetailsBlock d={umzugDetails} />
          <FormPartDivider title="Reinigung" />
          <ReinigungDetailsBlock d={reinigungDetails} />
        </>
      )}
      {umzugDetails && !reinigungDetails && (
        <UmzugDetailsBlock d={umzugDetails} />
      )}
      {!umzugDetails && reinigungDetails && (
        <ReinigungDetailsBlock d={reinigungDetails} />
      )}
    </>
  );

  if (embedded) {
    return <div className="mt-2 space-y-5">{inner}</div>;
  }

  if (compact) {
    return (
      <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Auftragsdetails
        </div>
        <div className="mt-3">{inner}</div>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 md:p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Auftragsdetails
      </div>
      <div className="mt-4 space-y-5">{inner}</div>
    </div>
  );
}
