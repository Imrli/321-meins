import { useState, type FormEvent } from "react";
import * as store from "@/lib/mockStore";

type Props = {
  auftragId: string;
  transporteurId: string;
  aktuellNiedrigstesChf: number | null;
};

function parseChf(s: string) {
  const n = Number(s.replace(",", ".").trim());
  return Number.isFinite(n) ? n : NaN;
}

export function GebotAbgeben({ auftragId, transporteurId, aktuellNiedrigstesChf }: Props) {
  const [preis, setPreis] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const p = parseChf(preis);
    if (!Number.isFinite(p)) {
      setErr("Bitte gültigen Preis in CHF.");
      return;
    }
    const r = store.mockAddGebot(auftragId, transporteurId, p);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setPreis("");
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
      {aktuellNiedrigstesChf != null ? (
        <p className="text-sm text-[#6B7280]">
          Aktuell führend: <span className="font-bold text-[#F4A261]">{aktuellNiedrigstesChf.toFixed(2)} CHF</span> — nur niedriger
        </p>
      ) : (
        <p className="text-sm text-[#6B7280]">Noch kein Gebot – du setzt die erste Marke (CHF)</p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[8rem] flex-1 flex-col">
          <label className="label-321">Gebot (CHF)</label>
          <input
            inputMode="decimal"
            className="input-321 font-mono font-bold text-[#1E3A5F]"
            value={preis}
            onChange={(e) => setPreis(e.target.value)}
            placeholder={aktuellNiedrigstesChf != null ? `< ${aktuellNiedrigstesChf.toFixed(2)}` : "z. B. 99"}
          />
        </div>
        <button type="submit" className="btn-primary-321 min-w-[7rem]">
          Bieten
        </button>
      </div>
      {err && <p className="text-sm font-medium text-[#DC2626]">{err}</p>}
    </form>
  );
}
