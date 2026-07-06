import {
  AuctionCheckbox,
  AuctionField,
  AuctionSelect,
  AuctionTextarea,
  DateTimeField,
  FormSection,
} from "@/components/auftraggeber/auctionFormUi";
import type { UmzugFormState } from "@/components/auftraggeber/umzugFormShared";

type Props = {
  form: UmzugFormState;
  errors: Set<keyof UmzugFormState>;
  onChange: (name: string, value: string | boolean) => void;
  notizenBlocked?: boolean;
};

export function UmzugFormFields({
  form,
  errors,
  onChange,
  notizenBlocked,
}: Props) {
  const schachtelnJa = form.schachteln_benoetigt === "Ja";

  return (
    <>
      <FormSection title="Adressen">
        <div className="grid gap-5 md:grid-cols-2">
          <AuctionField
            label="Von (Startadresse)"
            name="von"
            value={form.von}
            onChange={onChange}
            required
            error={errors.has("von")}
            placeholder="Strasse, PLZ Ort"
            autoComplete="street-address"
          />
          <AuctionField
            label="Nach (Zieladresse)"
            name="nach"
            value={form.nach}
            onChange={onChange}
            required
            error={errors.has("nach")}
            placeholder="Strasse, PLZ Ort"
            autoComplete="street-address"
          />
        </div>
      </FormSection>

      <FormSection title="Umzugsdetails">
        <div className="grid gap-5 md:grid-cols-2">
          <AuctionSelect
            label="Umzugsart"
            name="umzugsart"
            value={form.umzugsart}
            onChange={onChange}
            required
            error={errors.has("umzugsart")}
            options={[
              { value: "Privat", label: "Privat" },
              { value: "Gewerbe", label: "Gewerbe" },
              { value: "Büro", label: "Büro" },
            ]}
          />
          <AuctionField
            label="Wohnungsgrösse (m²)"
            name="wohnungsgroesse_qm"
            value={form.wohnungsgroesse_qm}
            onChange={onChange}
            required
            error={errors.has("wohnungsgroesse_qm")}
            type="number"
            inputMode="decimal"
            placeholder="z. B. 85"
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
          <AuctionSelect
            label="Parkplatz vorhanden?"
            name="parkplatz"
            value={form.parkplatz}
            onChange={onChange}
            required
            error={errors.has("parkplatz")}
            options={[
              { value: "Ja", label: "Ja" },
              { value: "Nein", label: "Nein" },
            ]}
          />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <AuctionField
              label="Stockwerk Start"
              name="stockwerk_start"
              value={form.stockwerk_start}
              onChange={onChange}
              required
              error={errors.has("stockwerk_start")}
              type="number"
              inputMode="numeric"
              placeholder="z. B. 2"
            />
            <AuctionCheckbox
              checked={form.aufzug_start}
              onChange={(v) => onChange("aufzug_start", v)}
              label="Aufzug vorhanden"
            />
          </div>
          <div className="space-y-3">
            <AuctionField
              label="Stockwerk Ziel"
              name="stockwerk_ziel"
              value={form.stockwerk_ziel}
              onChange={onChange}
              required
              error={errors.has("stockwerk_ziel")}
              type="number"
              inputMode="numeric"
              placeholder="z. B. 0"
            />
            <AuctionCheckbox
              checked={form.aufzug_ziel}
              onChange={(v) => onChange("aufzug_ziel", v)}
              label="Aufzug vorhanden"
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Möbel & Demontage">
        <div className="grid gap-5 md:grid-cols-2">
          <AuctionSelect
            label="Möbel mit Demontage?"
            name="moebel_demontage"
            value={form.moebel_demontage}
            onChange={onChange}
            required
            error={errors.has("moebel_demontage")}
            options={[
              { value: "Ja, mit Demontage", label: "Ja, mit Demontage" },
              { value: "Ja, ohne Demontage", label: "Ja, ohne Demontage" },
              { value: "Nein", label: "Nein" },
            ]}
          />
          <AuctionField
            label="Besondere Möbel (z. B. Klavier, Tresor)"
            name="besondere_moebel"
            value={form.besondere_moebel}
            onChange={onChange}
            placeholder="Optional"
          />
        </div>
      </FormSection>

      <FormSection title="Schachteln & Verpackung">
        <AuctionSelect
          label="Benötigt der Kunde Umzugsschachteln?"
          name="schachteln_benoetigt"
          value={form.schachteln_benoetigt}
          onChange={onChange}
          required
          error={errors.has("schachteln_benoetigt")}
          options={[
            { value: "Ja", label: "Ja" },
            { value: "Nein", label: "Nein" },
          ]}
        />
        {schachtelnJa && (
          <div className="grid gap-5 md:grid-cols-2">
            <AuctionField
              label="Wie viele Schachteln wurden bereits vom Kunden selbst gepackt?"
              name="schachteln_kunde_gepackt"
              value={form.schachteln_kunde_gepackt}
              onChange={onChange}
              type="number"
              inputMode="numeric"
              placeholder="Optional"
            />
            <AuctionSelect
              label="Sollen zusätzliche Schachteln vom Umzugsunternehmen mitgebracht werden?"
              name="schachteln_unternehmen"
              value={form.schachteln_unternehmen}
              onChange={onChange}
              optional
              options={[
                { value: "Ja", label: "Ja" },
                { value: "Nein", label: "Nein" },
              ]}
            />
            <AuctionSelect
              label="Möchte der Kunde, dass die Schachteln am Zielort ausgepackt werden?"
              name="schachteln_auspacken"
              value={form.schachteln_auspacken}
              onChange={onChange}
              optional
              options={[
                { value: "Ja", label: "Ja" },
                { value: "Nein", label: "Nein" },
              ]}
            />
          </div>
        )}
      </FormSection>

      <FormSection title="Zusätzliche Dienstleistungen">
        <div className="grid gap-3 sm:grid-cols-3">
          <AuctionCheckbox
            checked={form.zusaetzlich_einpacken}
            onChange={(v) => onChange("zusaetzlich_einpacken", v)}
            label="Einpacken"
          />
          <AuctionCheckbox
            checked={form.zusaetzlich_auspacken}
            onChange={(v) => onChange("zusaetzlich_auspacken", v)}
            label="Auspacken"
          />
          <AuctionCheckbox
            checked={form.zusaetzlich_entsorgung}
            onChange={(v) => onChange("zusaetzlich_entsorgung", v)}
            label="Entsorgung von Verpackung"
          />
        </div>
      </FormSection>

      <FormSection title="Zeit & Notizen">
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
        <AuctionTextarea
          label="Notizen / Besonderheiten"
          name="notizen"
          value={form.notizen}
          onChange={onChange}
          optional
          placeholder="z. B. Sperrgut, enge Treppe, Schlüsselübergabe …"
        />
        {notizenBlocked && (
          <p className="text-sm font-medium text-red-600">
            Keine Kontaktdaten in den Notizen erlaubt.
          </p>
        )}
      </FormSection>
    </>
  );
}
