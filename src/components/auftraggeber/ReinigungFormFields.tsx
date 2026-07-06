import {
  AuctionField,
  AuctionSelect,
  DateTimeField,
  FormSection,
} from "@/components/auftraggeber/auctionFormUi";
import type { ReinigungFormState } from "@/components/auftraggeber/reinigungFormShared";

const jaNeinOptions = [
  { value: "Ja", label: "Ja" },
  { value: "Nein", label: "Nein" },
];

type Props = {
  form: ReinigungFormState;
  errors: Set<keyof ReinigungFormState>;
  onChange: (name: string, value: string | boolean) => void;
  sonderBlocked?: boolean;
};

export function ReinigungFormFields({
  form,
  errors,
  onChange,
  sonderBlocked,
}: Props) {
  const balkonJa = form.balkon_vorhanden === "Ja";

  return (
    <>
      <FormSection title="Adresse">
        <AuctionField
          label="Adresse der zu reinigenden Wohnung"
          name="adresse"
          value={form.adresse}
          onChange={onChange}
          required
          error={errors.has("adresse")}
          placeholder="Strasse, PLZ Ort"
          autoComplete="street-address"
        />
      </FormSection>

      <FormSection title="Grunddaten">
        <div className="grid gap-5 md:grid-cols-2">
          <AuctionField
            label="Wohnungsgrösse (m²)"
            name="wohnungsgroesse_qm"
            value={form.wohnungsgroesse_qm}
            onChange={onChange}
            required
            error={errors.has("wohnungsgroesse_qm")}
            type="number"
            inputMode="decimal"
            placeholder="z. B. 75"
          />
          <AuctionField
            label="Zimmeranzahl"
            name="zimmeranzahl"
            value={form.zimmeranzahl}
            onChange={onChange}
            required
            error={errors.has("zimmeranzahl")}
            type="number"
            inputMode="numeric"
            placeholder="z. B. 3.5"
          />
        </div>
      </FormSection>

      <FormSection title="Reinigungsart">
        <AuctionSelect
          label="Art der Reinigung"
          name="reinigungsart"
          value={form.reinigungsart}
          onChange={onChange}
          required
          error={errors.has("reinigungsart")}
          options={[
            { value: "Standard-Reinigung", label: "Standard-Reinigung" },
            { value: "Tiefenreinigung", label: "Tiefenreinigung" },
            { value: "Bau-Endreinigung", label: "Bau-Endreinigung" },
          ]}
        />
      </FormSection>

      <FormSection title="Zusatzleistungen">
        <div className="grid gap-5 md:grid-cols-2">
          <AuctionSelect
            label="Fensterreinigung"
            name="fensterreinigung"
            value={form.fensterreinigung}
            onChange={onChange}
            required
            error={errors.has("fensterreinigung")}
            options={jaNeinOptions}
          />
          <AuctionSelect
            label="Küchenreinigung"
            name="kuechenreinigung"
            value={form.kuechenreinigung}
            onChange={onChange}
            required
            error={errors.has("kuechenreinigung")}
            options={jaNeinOptions}
          />
          <AuctionSelect
            label="Kühlschrank abtauen?"
            name="kuehlschrank_abtauen"
            value={form.kuehlschrank_abtauen}
            onChange={onChange}
            required
            error={errors.has("kuehlschrank_abtauen")}
            options={jaNeinOptions}
          />
          <AuctionSelect
            label="Waschmaschine / Tumbler reinigen?"
            name="waschmaschine_tumbler"
            value={form.waschmaschine_tumbler}
            onChange={onChange}
            required
            error={errors.has("waschmaschine_tumbler")}
            options={jaNeinOptions}
          />
        </div>
      </FormSection>

      <FormSection title="Balkon">
        <AuctionSelect
          label="Balkon vorhanden?"
          name="balkon_vorhanden"
          value={form.balkon_vorhanden}
          onChange={onChange}
          required
          error={errors.has("balkon_vorhanden")}
          options={jaNeinOptions}
        />
        {balkonJa && (
          <AuctionField
            label="ca. Quadratmeter"
            name="balkon_qm"
            value={form.balkon_qm}
            onChange={onChange}
            type="number"
            inputMode="decimal"
            placeholder="Optional"
          />
        )}
      </FormSection>

      <FormSection title="Sonderwünsche & Garantie">
        <AuctionField
          label="Sonderwünsche"
          name="sonderwuensche"
          value={form.sonderwuensche}
          onChange={onChange}
          placeholder="Optional"
        />
        {sonderBlocked && (
          <p className="text-sm font-medium text-red-600">
            Keine Kontaktdaten in den Sonderwünschen erlaubt.
          </p>
        )}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:bg-slate-50">
          <input
            type="checkbox"
            checked={form.abgabegarantie}
            onChange={(e) => onChange("abgabegarantie", e.target.checked)}
            className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-slate-300 accent-[var(--color-accent-500)]"
          />
          <span className="text-sm leading-relaxed text-slate-700">
            <span className="font-medium text-slate-800">Abgabegarantie</span>
            <span className="mt-1 block text-slate-600">
              Der Auftragnehmer verlässt die Wohnung erst, wenn der Treuhänder
              / Eigentümer zufrieden ist und den QR-Code freigibt.
            </span>
          </span>
        </label>
      </FormSection>

      <FormSection title="Zeit & Zugang">
        <div className="grid gap-5 md:grid-cols-2">
          <DateTimeField
            label="Datum / Uhrzeit"
            name="datum_uhrzeit"
            value={form.datum_uhrzeit}
            onChange={onChange}
            required
            error={errors.has("datum_uhrzeit")}
          />
          <AuctionSelect
            label="Zeitfenster"
            name="zeitfenster"
            value={form.zeitfenster}
            onChange={onChange}
            required
            error={errors.has("zeitfenster")}
            options={[
              { value: "Flexibel", label: "Flexibel" },
              { value: "Vormittag", label: "Vormittag" },
              { value: "Nachmittag", label: "Nachmittag" },
            ]}
          />
        </div>
        <AuctionSelect
          label="Zugang zur Wohnung"
          name="zugang"
          value={form.zugang}
          onChange={onChange}
          required
          error={errors.has("zugang")}
          options={[
            { value: "Schlüsselübergabe", label: "Schlüsselübergabe" },
            { value: "Vor-Ort-Termin", label: "Vor-Ort-Termin" },
          ]}
        />
      </FormSection>
    </>
  );
}
