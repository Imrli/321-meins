import { useState, type FormEvent, type ChangeEvent } from "react";
import * as store from "@/lib/mockStore";
import { useAuth } from "@/hooks/useAuth";
import {
  DurationWheelPicker,
  durationToSekunden,
  type DurationWheelValue,
} from "@/components/kunde/DurationWheelPicker";

const TRANSPORT_ARTEN = ["Möbel", "Paletten", "Express", "Kühlgut", "Sonstiges"];

const DEFAULT_DAUER: DurationWheelValue = { days: 0, hours: 0, minutes: 5, seconds: 0 };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("Datei"));
    r.readAsDataURL(file);
  });
}

export function AuftragErstellen() {
  const { profile, userId } = useAuth();
  const [transportArt, setTransportArt] = useState(TRANSPORT_ARTEN[0]!);
  const [beschreibung, setBeschreibung] = useState("");
  const [notizen, setNotizen] = useState("");
  const [abhol, setAbhol] = useState("");
  const [ziel, setZiel] = useState("");
  const [gewicht, setGewicht] = useState("");
  const [L, setL] = useState("");
  const [B, setB] = useState("");
  const [H, setH] = useState("");
  const [dauer, setDauer] = useState<DurationWheelValue>(DEFAULT_DAUER);
  const [pickerKey, setPickerKey] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!userId || !profile) return null;

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    setMsg(null);
    const f = e.target.files ? Array.from(e.target.files) : [];
    if (f.length > 3) {
      setMsg("Maximal 3 Bilder.");
      return;
    }
    setFiles(f);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setMsg(null);
    setBusy(true);
    try {
      const sek = durationToSekunden(dauer);
      if (sek < 1) {
        setMsg("Bitte eine Auktionsdauer von mindestens 1 Sekunde wählen.");
        return;
      }
      const dataUrls = await Promise.all(files.map(fileToDataUrl));
      const r = store.mockStartAuftrag({
        kundeId: userId,
        transportArt,
        beschreibung,
        notizen,
        abholort: abhol,
        zielort: ziel,
        gewicht_kg: gewicht ? Number(gewicht) : null,
        laenge_cm: L ? Number(L) : null,
        breite_cm: B ? Number(B) : null,
        hoehe_cm: H ? Number(H) : null,
        bilder: dataUrls,
        countdownSekunden: sek,
      });
      if (!r.ok) {
        setMsg(r.error);
        return;
      }
      setBeschreibung("");
      setNotizen("");
      setAbhol("");
      setZiel("");
      setGewicht("");
      setL("");
      setB("");
      setH("");
      setFiles([]);
      setDauer(DEFAULT_DAUER);
      setPickerKey((k) => k + 1);
      setMsg("Auktion gestartet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-321">
      <h2 className="title-section-321">Neue Auktion</h2>
      <p className="caption-321 mt-2">
        Start- und Zielort, Art des Auftrags, Countdown wählen – dann Auktion starten. Nicht mehr
        änderbar, sobald der Countdown läuft.
      </p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-321">Abholort</label>
            <input className="input-321" value={abhol} onChange={(e) => setAbhol(e.target.value)} required />
          </div>
          <div>
            <label className="label-321">Zielort</label>
            <input className="input-321" value={ziel} onChange={(e) => setZiel(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="label-321">Art des Auftrags</label>
          <select
            className="input-321"
            value={transportArt}
            onChange={(e) => setTransportArt(e.target.value)}
          >
            {TRANSPORT_ARTEN.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-321">Beschreibung / Ladung</label>
          <textarea
            className="textarea-321 min-h-20"
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
            required
            rows={3}
          />
        </div>
        <div>
          <label className="label-321">Notizen (optional)</label>
          <textarea
            className="textarea-321 min-h-16"
            value={notizen}
            onChange={(e) => setNotizen(e.target.value)}
            rows={2}
          />
        </div>

        <div>
          <label className="label-321">Bilder (optional, max. 3)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            className="block w-full text-sm text-[#6B7280] file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#1F2937] hover:file:bg-slate-50"
            onChange={onFiles}
          />
          {files.length > 0 && (
            <p className="caption-321 mt-2">{files.map((f) => f.name).join(", ")}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="label-321">Gew. kg (opt.)</label>
            <input
              type="number"
              min={0}
              step="0.1"
              className="input-321"
              value={gewicht}
              onChange={(e) => setGewicht(e.target.value)}
            />
          </div>
          <div>
            <label className="label-321">L cm (opt.)</label>
            <input type="number" min={0} className="input-321" value={L} onChange={(e) => setL(e.target.value)} />
          </div>
          <div>
            <label className="label-321">B cm (opt.)</label>
            <input type="number" min={0} className="input-321" value={B} onChange={(e) => setB(e.target.value)} />
          </div>
          <div>
            <label className="label-321">H cm (opt.)</label>
            <input type="number" min={0} className="input-321" value={H} onChange={(e) => setH(e.target.value)} />
          </div>
        </div>

        <div className="flex w-full flex-col items-center pt-2">
          <DurationWheelPicker
            key={pickerKey}
            defaultValue={DEFAULT_DAUER}
            onChange={setDauer}
          />
        </div>

        {msg && (
          <p
            className={
              msg.includes("gestartet") || msg.includes("Wiederholt")
                ? "text-sm font-medium text-[#10B981]"
                : "text-sm font-medium text-[#DC2626]"
            }
            role="status"
          >
            {msg}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary-321 w-full sm:max-w-sm">
          {busy ? "Starte …" : "Auktion starten"}
        </button>
      </form>
    </section>
  );
}
