import type { Auftrag, AuftragStatus, Gebot, Profil } from "@/types";

/** Obere Grenze wie Rad: Tg 0–7, Std/Min/Sek voll (7 T. + 23:59:59) */
const MAX_COUNTDOWN_PICKER_SEK = 7 * 86400 + 23 * 3600 + 59 * 60 + 59;

const DB_KEY = "321meins_db_v2";
const SESSION_KEY = "321meins_session_uid";

type MockAccount = {
  id: string;
  email: string;
  password: string;
  profile: Profil;
};

type MockDb = {
  accounts: MockAccount[];
  auftraege: Auftrag[];
  gebote: Gebot[];
};

let memory: MockDb | null = null;
const listeners = new Set<() => void>();

/** Laufzeit-Benachrichtigungen: Unterboten */
const undercutQueue: { userId: string; text: string }[] = [];

function defaultDb(): MockDb {
  return { accounts: [], auftraege: [], gebote: [] };
}

function readDb(): MockDb {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      memory = JSON.parse(raw) as MockDb;
      migrateAuftraege(memory);
      return memory;
    }
    // Migration von v1
    const rawV1 = localStorage.getItem("321meins_db_v1");
    if (rawV1) {
      const v1 = JSON.parse(rawV1) as { accounts: MockAccount[]; auftraege: unknown[]; gebote: Gebot[] };
      memory = {
        accounts: v1.accounts,
        auftraege: [],
        gebote: v1.gebote,
      };
      for (const row of v1.auftraege as Record<string, unknown>[]) {
        const id = String(row.id);
        const a: Auftrag = {
          id,
          kunde_id: String(row.kunde_id),
          dienstleistung_typ: "transport",
          beschreibung: (row.beschreibung as string) ?? null,
          notizen: null,
          bilder: (row.bilder as string[]) ?? [],
          abholort: (row.abholort as string) ?? null,
          zielort: (row.zielort as string) ?? null,
          gewicht_kg: row.gewicht_kg as number | null,
          laenge_cm: row.laenge_cm as number | null,
          breite_cm: row.breite_cm as number | null,
          hoehe_cm: row.hoehe_cm as number | null,
          countdown_dauer_sekunden: 600,
          countdown_ende: String(row.countdown_ende),
          status: mapLegacyStatus(String(row.status)),
          bestes_gebot_id: (row.bestes_gebot_id as string) ?? null,
          anfrage_key: `legacy|${id}`,
          wiederholbar_ab: null,
          created_at: String(row.created_at),
        };
        memory.auftraege.push(a);
      }
      try {
        localStorage.removeItem("321meins_db_v1");
      } catch {
        /* ok */
      }
      writeDb(memory);
    } else {
      memory = defaultDb();
    }
  } catch {
    memory = defaultDb();
  }
  return memory;
}

function mapLegacyStatus(s: string): AuftragStatus {
  if (s === "offen") return "offen";
  if (s === "angenommen" || s === "gebote_fertig") return "vermittelt";
  if (s === "abgelehnt") return "leer_abgelaufen";
  return "leer_abgelaufen";
}

function migrateAuftraege(db: MockDb) {
  for (const a of db.auftraege) {
    const legacy = a as Auftrag & { transport_art?: string };
    if (!a.dienstleistung_typ) {
      a.dienstleistung_typ =
        legacy.transport_art === "Sonstiges" || !legacy.transport_art
          ? "transport"
          : legacy.transport_art;
    }
    delete legacy.transport_art;
    if (!("anfrage_key" in a) || !(a as Auftrag).anfrage_key) {
      a.anfrage_key = `legacy|${a.id}`;
    }
    if (a.wiederholbar_ab === undefined) a.wiederholbar_ab = null;
    const legacyCountdown = a as Auftrag & { countdown_minuten?: number };
    if (legacyCountdown.countdown_dauer_sekunden == null) {
      legacyCountdown.countdown_dauer_sekunden =
        legacyCountdown.countdown_minuten != null
          ? legacyCountdown.countdown_minuten * 60
          : 600;
    }
    delete legacyCountdown.countdown_minuten;
    if (a.status === "gebote_fertig" as unknown as AuftragStatus) a.status = "vermittelt";
    if (a.status === "angenommen" as unknown) a.status = "vermittelt";
    if (a.status === "abgelehnt" as unknown) a.status = "leer_abgelaufen";
  }
}

function writeDb(db: MockDb) {
  memory = db;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.error("localStorage voll", e);
  }
  listeners.forEach((l) => l());
}

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeMock(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function buildAnfrageKey(abhol: string, ziel: string, transportArt: string, kundeId: string) {
  const n = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  return `${kundeId}::${n(abhol)}|${n(ziel)}|${n(transportArt)}`;
}

function findLowestBids(gebote: Gebot[]) {
  if (gebote.length === 0) return { min: null as number | null, leaders: [] as Gebot[] };
  let min = Infinity;
  for (const g of gebote) min = Math.min(min, g.preis_chf);
  const atMin = gebote.filter((g) => g.preis_chf === min);
  atMin.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { min, leaders: atMin };
}

function finalizeExpired(db: MockDb) {
  const now = Date.now();
  let changed = false;
  for (const a of db.auftraege) {
    if (a.status !== "offen") continue;
    if (new Date(a.countdown_ende).getTime() > now) continue;
    const forOrder = db.gebote.filter((g) => g.auftrag_id === a.id);
    const { min, leaders } = findLowestBids(forOrder);
    if (min !== null && leaders.length > 0) {
      a.status = "vermittelt";
      a.bestes_gebot_id = leaders[0].id;
    } else {
      a.status = "leer_abgelaufen";
      a.bestes_gebot_id = null;
      const w = new Date();
      w.setHours(w.getHours() + 1);
      a.wiederholbar_ab = w.toISOString();
    }
    changed = true;
  }
  if (changed) writeDb(db);
}

export function getMockSnapshot() {
  const db = readDb();
  finalizeExpired(db);
  return db;
}

function findAccountByUsername(db: MockDb, benutzername: string) {
  return db.accounts.find(
    (a) => a.profile.benutzername.toLowerCase() === benutzername.toLowerCase()
  );
}

function findAccountById(db: MockDb, id: string) {
  return db.accounts.find((a) => a.id === id);
}

export function getSessionUserId(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function getSessionProfile(): Profil | null {
  const id = getSessionUserId();
  if (!id) return null;
  const db = getMockSnapshot();
  return findAccountById(db, id)?.profile ?? null;
}

export function getKontaktEmail(userId: string): string | null {
  return findAccountById(getMockSnapshot(), userId)?.email ?? null;
}

export function mockLogin(
  benutzername: string,
  password: string
): { ok: true } | { ok: false; error: string } {
  const db = readDb();
  const acc = findAccountByUsername(db, benutzername);
  if (!acc || acc.password !== password) return { ok: false, error: "Anmeldung fehlgeschlagen." };
  sessionStorage.setItem(SESSION_KEY, acc.id);
  notify();
  return { ok: true };
}

export function mockLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  notify();
}

export function mockRegister(input: {
  email: string;
  password: string;
  benutzername: string;
  rolle: "kunde" | "transporteur";
}): { ok: true } | { ok: false; error: string } {
  const db = readDb();
  if (findAccountByUsername(db, input.benutzername)) {
    return { ok: false, error: "Dieser Benutzername ist schon vergeben." };
  }
  if (db.accounts.some((a) => a.email.toLowerCase() === input.email.toLowerCase())) {
    return { ok: false, error: "Diese E-Mail ist schon registriert." };
  }
  const id = crypto.randomUUID();
  const profile: Profil = {
    id,
    rolle: input.rolle,
    benutzername: input.benutzername.trim(),
    zahlungsstatus: false,
    created_at: new Date().toISOString(),
    ...(input.rolle === "transporteur"
      ? {
          gebotsliste_verifiziert: Math.random() > 0.55,
          gebotsliste_bewertung: Math.round(28 + Math.random() * 22) / 10,
        }
      : {}),
  };
  db.accounts.push({
    id,
    email: input.email.trim(),
    password: input.password,
    profile,
  });
  writeDb(db);
  sessionStorage.setItem(SESSION_KEY, id);
  notify();
  return { ok: true };
}

export function mockSetZahlungsstatus(userId: string, on: boolean) {
  const db = readDb();
  const acc = findAccountById(db, userId);
  if (!acc || acc.profile.rolle !== "transporteur") return;
  acc.profile = { ...acc.profile, zahlungsstatus: on };
  writeDb(db);
}

function istGesperrtFuerAnfrage(db: MockDb, kundeId: string, key: string) {
  const now = Date.now();
  for (const a of db.auftraege) {
    if (a.kunde_id !== kundeId || a.anfrage_key !== key) continue;
    if (a.status === "leer_abgelaufen" && a.wiederholbar_ab && new Date(a.wiederholbar_ab).getTime() > now) {
      return { blocked: true as const, bis: a.wiederholbar_ab };
    }
  }
  return { blocked: false as const };
}

export function mockStartAuftrag(input: {
  kundeId: string;
  transportArt: string;
  beschreibung: string;
  notizen: string;
  abholort: string;
  zielort: string;
  gewicht_kg: number | null;
  laenge_cm: number | null;
  breite_cm: number | null;
  hoehe_cm: number | null;
  bilder: string[];
  countdownSekunden: number;
}): { ok: true; id: string } | { ok: false; error: string } {
  const sec = Math.floor(input.countdownSekunden);
  if (sec < 1) {
    return { ok: false, error: "Wähle eine Dauer von mindestens 1 Sekunde." };
  }
  if (sec > MAX_COUNTDOWN_PICKER_SEK) {
    return { ok: false, error: "Maximale Auktionsdauer überschritten." };
  }
  if (input.bilder.length > 3) {
    return { ok: false, error: "Maximal 3 Bilder." };
  }
  const db = readDb();
  const key = buildAnfrageKey(input.abholort, input.zielort, input.transportArt, input.kundeId);
  const sperre = istGesperrtFuerAnfrage(db, input.kundeId, key);
  if (sperre.blocked) {
    return {
      ok: false,
      error: `Diese Anfrage kannst du frühestens wieder starten, wenn die Wartestunde abgelaufen ist (bis ${new Date(sperre.bis).toLocaleString("de-CH")}).`,
    };
  }
  const end = new Date(Date.now() + sec * 1000);
  const a: Auftrag = {
    id: crypto.randomUUID(),
    kunde_id: input.kundeId,
    dienstleistung_typ: "transport",
    beschreibung: input.beschreibung.trim() || null,
    notizen: input.notizen.trim() || null,
    bilder: input.bilder,
    abholort: input.abholort.trim(),
    zielort: input.zielort.trim(),
    gewicht_kg: input.gewicht_kg,
    laenge_cm: input.laenge_cm,
    breite_cm: input.breite_cm,
    hoehe_cm: input.hoehe_cm,
    countdown_dauer_sekunden: sec,
    countdown_ende: end.toISOString(),
    status: "offen",
    bestes_gebot_id: null,
    anfrage_key: key,
    wiederholbar_ab: null,
    created_at: new Date().toISOString(),
  };
  db.auftraege.push(a);
  writeDb(db);
  return { ok: true, id: a.id };
}

/** Auftrag mit gleichem anfrage_key und Countdown erneut (nach Wartezeit) */
export function mockWiederholeAuftrag(auftragId: string, kundeId: string, countdownSekunden: number) {
  const sec = Math.floor(countdownSekunden);
  if (sec < 1 || sec > MAX_COUNTDOWN_PICKER_SEK) {
    return { ok: false as const, error: "Ungültige Dauer." };
  }
  const db = readDb();
  const src = db.auftraege.find((x) => x.id === auftragId);
  if (!src || src.kunde_id !== kundeId) return { ok: false as const, error: "Auftrag nicht gefunden." };
  if (src.status !== "leer_abgelaufen") return { ok: false as const, error: "Nur nach leerer Auktion wiederholbar." };
  if (!src.wiederholbar_ab || new Date(src.wiederholbar_ab).getTime() > Date.now()) {
    return { ok: false as const, error: "Warte die 1 Stunde ab." };
  }
  return mockStartAuftrag({
    kundeId,
    transportArt: src.dienstleistung_typ,
    beschreibung: src.beschreibung ?? "",
    notizen: src.notizen ?? "",
    abholort: src.abholort ?? "",
    zielort: src.zielort ?? "",
    gewicht_kg: src.gewicht_kg,
    laenge_cm: src.laenge_cm,
    breite_cm: src.breite_cm,
    hoehe_cm: src.hoehe_cm,
    bilder: src.bilder,
    countdownSekunden: sec,
  });
}

function auftragIstBietbar(a: Auftrag) {
  if (a.status !== "offen") return false;
  return new Date(a.countdown_ende).getTime() > Date.now();
}

export function mockAddGebot(auftragId: string, transporteurId: string, preis_chf: number) {
  const db = readDb();
  const t = findAccountById(db, transporteurId);
  if (!t?.profile.rolle || t.profile.rolle !== "transporteur" || !t.profile.zahlungsstatus) {
    return { ok: false as const, error: "Nur zahlungsaktive Transporteure können bieten." };
  }
  const a = db.auftraege.find((x) => x.id === auftragId);
  if (!a) return { ok: false as const, error: "Auftrag nicht gefunden." };
  if (!auftragIstBietbar(a)) {
    return { ok: false as const, error: "Auktion beendet." };
  }
  if (preis_chf <= 0) return { ok: false as const, error: "Preis muss grösser 0 sein." };
  const existing = db.gebote.filter((g) => g.auftrag_id === auftragId);
  const { min: altesMin, leaders: alteLeiter } = findLowestBids(existing);
  if (altesMin !== null && preis_chf >= altesMin) {
    return { ok: false as const, error: `Nur niedriger: aktuell ${altesMin.toFixed(2)} CHF` };
  }
  if (altesMin !== null && alteLeiter.length > 0) {
    const führend = alteLeiter[0];
    if (führend.transporteur_id !== transporteurId) {
      undercutQueue.push({
        userId: führend.transporteur_id,
        text: `Unterboten: neues Gebot unter ${führend.preis_chf.toFixed(2)} CHF`,
      });
    }
  }
  const g: Gebot = {
    id: crypto.randomUUID(),
    auftrag_id: auftragId,
    transporteur_id: transporteurId,
    preis_chf,
    created_at: new Date().toISOString(),
  };
  db.gebote.push(g);
  writeDb(db);
  return { ok: true as const, gebot: g };
}

export function shiftUndercutMessage(transporteurId: string): string | null {
  const i = undercutQueue.findIndex((x) => x.userId === transporteurId);
  if (i === -1) return null;
  const [e] = undercutQueue.splice(i, 1);
  return e.text;
}

export function listAuftraegeForKunde(kundeId: string): Auftrag[] {
  return getMockSnapshot()
    .auftraege.filter((a) => a.kunde_id === kundeId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listOffeneAuftraegeBoerse(): Auftrag[] {
  return getMockSnapshot()
    .auftraege.filter(
      (a) => a.status === "offen" && new Date(a.countdown_ende).getTime() > Date.now()
    )
    .sort((a, b) => a.countdown_ende.localeCompare(b.countdown_ende));
}

export function listGeboteForAuftrag(auftragId: string): Gebot[] {
  return getMockSnapshot()
    .gebote.filter((g) => g.auftrag_id === auftragId)
    .sort((a, b) => a.preis_chf - b.preis_chf || a.created_at.localeCompare(b.created_at));
}

export function getAktuellNiedrigster(auftragId: string) {
  const g = listGeboteForAuftrag(auftragId);
  return g[0] ?? null;
}

export function getLetztesEigenesGebot(auftragId: string, transporteurId: string) {
  const list = getMockSnapshot()
    .gebote.filter((g) => g.auftrag_id === auftragId && g.transporteur_id === transporteurId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return list[0] ?? null;
}

export function listEigeneGebote(transporteurId: string) {
  const db = getMockSnapshot();
  return db.gebote
    .filter((g) => g.transporteur_id === transporteurId)
    .map((g) => {
      const ax = db.auftraege.find((x) => x.id === g.auftrag_id);
      return { gebot: g, auftrag: ax };
    })
    .sort((x, y) => y.gebot.created_at.localeCompare(x.gebot.created_at));
}

export function getProfilname(userId: string): string {
  return findAccountById(getMockSnapshot(), userId)?.profile.benutzername ?? userId.slice(0, 8);
}

/** Öffentliches Kürzel für Gebotslisten – kein Benutzer-/Firmenname. */
export function getTransporterKuerzelForGebot(transporteurId: string): string {
  const name =
    findAccountById(getMockSnapshot(), transporteurId)?.profile.benutzername ?? transporteurId;
  const alnum = name.replace(/[^a-zA-Z]/g, "");
  if (alnum.length >= 2) return alnum.slice(0, 2).toUpperCase();
  return (name + "XX").toUpperCase().slice(0, 2);
}

export function getTransporteurGebotListeMeta(transporteurId: string): {
  verifiziert: boolean;
  bewertung: number | null;
} {
  const acc = findAccountById(getMockSnapshot(), transporteurId);
  if (!acc || acc.profile.rolle !== "transporteur") {
    return { verifiziert: false, bewertung: null };
  }
  const p = acc.profile;
  const bw = p.gebotsliste_bewertung;
  return {
    verifiziert: p.gebotsliste_verifiziert === true,
    bewertung:
      typeof bw === "number" && Number.isFinite(bw)
        ? Math.min(5, Math.max(0, Math.round(bw * 10) / 10))
        : null,
  };
}

export function formatGebotRelativeFromIso(iso: string, nowMs: number): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "—";
  const diff = Math.max(0, nowMs - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return "gerade eben";
  if (s < 60) return `vor ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `vor ${m} min`;
  const h = Math.floor(m / 60);
  return `vor ${h} Std`;
}

export function getGebotById(id: string) {
  return getMockSnapshot().gebote.find((g) => g.id === id);
}

export function getAuftragById(id: string) {
  return getMockSnapshot().auftraege.find((a) => a.id === id);
}

export function canBidOnOrder(a: Auftrag) {
  return auftragIstBietbar(a);
}

export function mockResetAll() {
  memory = defaultDb();
  undercutQueue.length = 0;
  try {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem("321meins_db_v1");
  } catch {
    /* ok */
  }
  sessionStorage.removeItem(SESSION_KEY);
  notify();
}

export function getStatusLabel(s: AuftragStatus) {
  const map: Record<AuftragStatus, string> = {
    offen: "Auktion live",
    vermittelt: "Vermittelt",
    leer_abgelaufen: "Keine Gebote",
  };
  return map[s];
}

