import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { supabase } from "./lib/supabaseClient";
import {
  authRedirectOrigin,
  loadAuthUserFromSession,
  resolveLoginEmail,
} from "./lib/supabaseAuth";
import * as sbAukt from "./lib/supabaseAuctions";
import {
  HOME_AUCTION_SLIDER_FADE_MS,
  HOME_AUCTION_SLIDER_INTERVAL_MS,
} from "./config/homeAuctionSlider";
import {
  fetchAuftraggeberProfile,
  fetchTransporteurProfile,
  invokeDeleteMyProfile,
  updateAuftraggeberProfile,
  updateAuthPassword,
  updateTransporteurProfile,
  type AuftraggeberProfile,
  type TransporteurProfile,
} from "./lib/supabaseAccount";
import { applyAuctionPrivacy, transporteurHatZuschlagViewer } from "./lib/auctionPrivacy";
import { isAppTestMode } from "./lib/appTestMode";
import { ortOeffentlich } from "./lib/ortPublic";
import type { Auction, AuctionDraft, Bid } from "./types/auction";
import {
  FahrerInfoBlock,
  GebotszeileRow,
  SterneBewertung,
} from "./components/auction/BidRowDisplay";
import {
  fetchPendingDeliveryRatings,
  fetchReceivedRatingsForProfile,
  submitLieferungBewertung,
  type PendingDeliveryRating,
  type ReceivedRatingRow,
} from "./lib/supabaseRatings";
import { TransporterLieferungScanBlock } from "./components/transporteur/TransporterLieferungScanBlock";
import QRCode from "qrcode";

/* ---------- AUTH / APP CONTEXT ---------- */
type UserRole = "auftraggeber" | "transporteur";

const useSupabase =
  import.meta.env.VITE_MOCK === "false" &&
  Boolean(
    (import.meta.env.SUPABASE_URL?.trim() ||
      import.meta.env.VITE_SUPABASE_URL?.trim()) &&
      (import.meta.env.SUPABASE_ANON_KEY?.trim() ||
        import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()),
  );

type AuthUser = {
  username: string;
  role: UserRole;
  /** Öffentliches Kürzel für Gebote (nur Transporteur) */
  initials?: string;
  userId?: string;
  email?: string;
};

type View =
  | "home"
  | "auction-form"
  | "meine-auktionen"
  | "auction-detail";

type TransporterInfo = {
  firma: string;
  kontakt: string;
  telefon: string;
  email: string;
};

const REJECT_LOCK_MS = 60 * 60 * 1000;

function subscribeAppHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

function getAppPageFromHash():
  | "landing"
  | "ueber-uns"
  | "agb"
  | "datenschutz"
  | "kontakt"
  | "impressum" {
  const raw = window.location.hash.trim();
  if (raw === "#/ueber-uns" || raw.startsWith("#/ueber-uns?")) {
    return "ueber-uns";
  }
  if (raw === "#/agb" || raw.startsWith("#/agb?")) {
    return "agb";
  }
  if (raw === "#/datenschutz" || raw.startsWith("#/datenschutz?")) {
    return "datenschutz";
  }
  if (raw === "#/kontakt" || raw.startsWith("#/kontakt?")) {
    return "kontakt";
  }
  if (raw === "#/impressum" || raw.startsWith("#/impressum?")) {
    return "impressum";
  }
  return "landing";
}

function UeberUnsPage() {
  return (
    <section id="ueber-uns" className="py-10 md:py-14">
      <div className="mx-auto max-w-3xl px-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
          Über uns
        </h1>
        <div className="mt-8 space-y-6 text-base leading-relaxed text-slate-600">
          <p>
            321 meins ist mehr als eine Plattform – es ist ein Versprechen.
            Entstanden aus einer einfachen, aber hartnäckigen Frage: Warum
            muss ein Transport teuer, kompliziert und intransparent sein?
          </p>
          <p>Die Antwort war: Muss er nicht.</p>
          <p>
            Wir haben einen Marktplatz geschaffen, der zwei Welten
            zusammenbringt, die sich längst hätten finden sollen. Menschen, die
            etwas transportieren müssen – und Transporteure, die jeden Tag auf
            Schweizer Strassen unterwegs sind, oft mit leerem Laderaum. Was
            vorher Tage dauerte und dutzende Telefonate kostete, erledigt unsere
            Plattform in Minuten. Fair, transparent, live.
          </p>
          <p>
            Unser Name ist Programm: 3-2-1 zählt den Countdown zur Auktion.
            &apos;Meins&apos; steht für den Moment, in dem beide Seiten
            gewinnen. Der Auftraggeber, weil er den besten Preis bekommt. Der
            Transporteur, weil er seine Leerfahrten füllt – ohne Fixkosten,
            ohne Risiko.
          </p>
          <p>
            Dabei haben wir von Anfang an auf das geachtet, was im digitalen
            Zeitalter oft zu kurz kommt: absolute Fairness. Transporteure müssen
            sich bei uns mit einem gültigen Versicherungsnachweis und ihrer
            UID-Nummer verifizieren – manuell geprüft, nicht nur ein automatischer
            Haken. Die Bezahlung läuft sicher über unseren Partner Stripe. Und
            unser QR-Code-System stellt sicher, dass kein Franken fliesst, bevor
            die Ware nicht heil beim Empfänger angekommen ist.
          </p>
          <p>
            Wir sind ein Schweizer Unternehmen, das Schweizer Werte in die
            digitale Welt überträgt: Verlässlichkeit, Diskretion, Qualität.
            Unsere Daten werden in der Schweiz gehostet, unsere Prozesse sind
            DSG-konform, und unsere Kunden sollen nie das Gefühl haben, mit einem
            gesichtslosen Algorithmus zu sprechen. Hinter 321 meins stehen
            echte Menschen mit einer echten Mission.
          </p>
          <p>
            Ob du ein Klavier transportieren, einen Umzug meistern oder einfach
            einen Karton von A nach B bringen willst – wir machen es einfach. Du
            stellst ein, der Markt macht den Rest.
          </p>
          <p className="font-semibold text-slate-900">
            Willkommen bei 321 meins.
          </p>
          <p className="font-semibold text-slate-900">Live. Fair. Günstig.</p>
        </div>
      </div>
    </section>
  );
}

function AgbLegalBody() {
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
        Allgemeine Geschäftsbedingungen (AGB) – 321 meins
      </h1>
      <div className="mt-8 space-y-8 text-base leading-relaxed text-slate-600">
          <div>
            <h2 className="text-lg font-bold text-slate-900">1. Geltungsbereich</h2>
            <p className="mt-2">
              Diese AGB gelten für die Nutzung der Plattform 321 meins, betrieben
              durch Imrli Amza, Bahnhofstrasse 191, 8620 Wetzikon,
              support@321-meins.ch. Mit der Registrierung akzeptierst du diese
              AGB.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              2. Leistung der Plattform
            </h2>
            <p className="mt-2">
              321 meins stellt eine technische Plattform zur Vermittlung von
              Transportaufträgen zwischen Auftraggebern und Transporteuren
              bereit. Die Plattform selbst erbringt keine Transportleistungen.
              Der Transportvertrag kommt ausschliesslich zwischen dem
              Auftraggeber und dem Transporteur zustande.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              3. Registrierung und Verifizierung
            </h2>
            <p className="mt-2">
              Die Nutzung erfordert eine kostenlose Registrierung. Transporteure
              müssen einen gültigen Versicherungsnachweis und ihre UID-Nummer
              hinterlegen. Die Verifizierung erfolgt manuell durch den
              Plattformbetreiber und kann 1–2 Werktage dauern. Ein Anspruch auf
              Freischaltung besteht nicht.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              4. Ablauf einer Auktion
            </h2>
            <p className="mt-2">
              Der Auftraggeber stellt einen Transport mit Start- und
              Zieladresse, Abhol- und Lieferdatum sowie optionalen Notizen ein.
              Transporteure geben in Echtzeit Gebote ab und unterbieten sich
              gegenseitig (Holländische Auktion). Nach Auktionsende kann der
              Auftraggeber das tiefste Gebot akzeptieren oder ablehnen. Bei
              Ablehnung kann die Auktion nach 60 Minuten erneut gestartet
              werden.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              5. Zustandekommen des Transportvertrags
            </h2>
            <p className="mt-2">
              Ein verbindlicher Transportvertrag zwischen Auftraggeber und
              Transporteur kommt zustande, sobald der Auftraggeber nach
              Auktionsende den Auftrag erteilt und die Zahlung geleistet hat. Mit
              der Zahlung erhält der Auftraggeber einen QR-Code als Bestätigung.
              Der Transporteur erhält Zugriff auf die vollständigen
              Kontaktdaten beider Parteien.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              6. Preise und Zahlungsbedingungen
            </h2>
            <p className="mt-2">
              Die Nutzung der Plattform ist für Auftraggeber kostenlos.
              Transporteure zahlen eine Provision in Höhe des bei der
              Registrierung vereinbarten Prozentsatzes, fällig nur bei erfolgreich
              vermitteltem Auftrag. Die Zahlung des Auftraggebers wird bei Stripe
              sicher hinterlegt und erst nach erfolgreicher Lieferung
              (QR-Code-Scan durch den Transporteur) an den Transporteur
              ausgelöst. Der Auftraggeber kann per TWINT, Kreditkarte oder
              Apple/Google Pay bezahlen.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">7. QR-Code-Sicherung</h2>
            <p className="mt-2">
              Der QR-Code dient als Nachweis der erfolgreichen Lieferung. Der
              Transporteur scannt den Code beim Empfänger. Erst durch diesen
              Scan wird die Zahlung an den Transporteur ausgelöst. Ohne gültigen
              Scan erfolgt keine Überweisung.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">8. Haftung</h2>
            <p className="mt-2">
              321 meins haftet ausschliesslich für Schäden, die durch vorsätzliche
              oder grob fahrlässige Pflichtverletzung des Plattformbetreibers
              entstehen. Für Schäden aus dem Transportvertrag (Beschädigung,
              Verlust, Verspätung, Nichterscheinen) haftet allein der Transporteur.
              Der Transporteur ist verpflichtet, eine gültige Transportversicherung
              vorzuweisen. 321 meins übernimmt keine Haftung für Leerfahrten,
              Ausfälle oder sonstige Schäden, die aus dem Verhalten des
              Auftraggebers entstehen.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">9. Bewertungssystem</h2>
            <p className="mt-2">
              Nach erfolgreicher Lieferung können sich Auftraggeber und
              Transporteur gegenseitig mit 1 bis 5 Sternen bewerten und einen
              optionalen Kommentar hinterlassen. Manipulation oder Missbrauch des
              Bewertungssystems führt zum Ausschluss.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">10. Datenschutz</h2>
            <p className="mt-2">
              Die Erhebung und Verarbeitung personenbezogener Daten erfolgt
              gemäss unserer Datenschutzerklärung und den anwendbaren Schweizer
              Datenschutzgesetzen.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">11. Änderung der AGB</h2>
            <p className="mt-2">
              Der Plattformbetreiber behält sich vor, diese AGB jederzeit zu
              ändern. Die geänderte Fassung wird auf der Plattform veröffentlicht
              und gilt ab dem Zeitpunkt der Veröffentlichung.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              12. Schlussbestimmungen
            </h2>
            <p className="mt-2">
              Es gilt Schweizer Recht. Gerichtsstand ist Wetzikon. Sollte eine
              Bestimmung dieser AGB unwirksam sein, bleibt die Gültigkeit der
              übrigen Bestimmungen unberührt.
            </p>
          </div>
        </div>
    </>
  );
}

function AgbPage() {
  return (
    <section id="agb" className="py-10 md:py-14">
      <div className="mx-auto max-w-3xl px-5">
        <AgbLegalBody />
      </div>
    </section>
  );
}

function DatenschutzLegalBody() {
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
        Datenschutzerklärung – 321 meins
      </h1>
      <div className="mt-8 space-y-8 text-base leading-relaxed text-slate-600">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              1. Verantwortliche Person
            </h2>
            <p className="mt-2">Imrli Amza</p>
            <p>Bahnhofstrasse 191, 8620 Wetzikon</p>
            <p>support@321-meins.ch</p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              2. Erhebung und Bearbeitung von Personendaten
            </h2>
            <p className="mt-2">
              Wir erheben und bearbeiten ausschliesslich Personendaten, die für
              die Nutzung unserer Plattform erforderlich sind:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Auftraggeber: Vorname, Name, Adresse, Telefon, E-Mail,
                Benutzername, Passwort (verschlüsselt)
              </li>
              <li>
                Transporteure: Firmenname, Vorname und Name der Kontaktperson,
                Adresse, Telefon, E-Mail, Benutzername, Passwort (verschlüsselt),
                UID-Nummer, Versicherungsnachweis
              </li>
              <li>
                Optionale Angaben: Bewertung (1–5 Sterne), Kommentar zur
                Bewertung
              </li>
            </ul>
            <p className="mt-3">
              Sämtliche Daten werden nur mit deiner ausdrücklichen Einwilligung
              im Rahmen der Registrierung erhoben.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              3. Zweck der Datenbearbeitung
            </h2>
            <p className="mt-2">
              Deine Personendaten werden ausschliesslich für folgende Zwecke
              verwendet:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Bereitstellung und Betrieb der Plattform 321 meins</li>
              <li>
                Vermittlung von Transportaufträgen zwischen Auftraggebern und
                Transporteuren
              </li>
              <li>Abwicklung der Bezahlung über unseren Partner Stripe</li>
              <li>
                Sicherstellung der Anonymität während laufender Auktionen
                (Kontaktdaten werden erst nach Auftragserteilung ausgetauscht)
              </li>
              <li>
                Ermöglichung des Bewertungssystems nach erfolgreicher Lieferung
              </li>
              <li>Erfüllung gesetzlicher Aufbewahrungspflichten</li>
            </ul>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              4. Weitergabe an Dritte
            </h2>
            <p className="mt-2">
              Eine Weitergabe deiner Personendaten an Dritte erfolgt
              ausschliesslich in den folgenden Fällen:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Stripe: Zur Abwicklung der Bezahlung. Deine Zahlungsdaten
                teilst du direkt mit Stripe – wir haben keinen Zugriff auf deine
                Kreditkarten- oder TWINT-Daten.
              </li>
              <li>
                Supabase: Hosting der Plattform. Alle Daten werden in der
                Schweiz gespeichert.
              </li>
              <li>
                Bei gesetzlicher Verpflichtung: Falls eine gesetzliche oder
                behördliche Anordnung vorliegt.
              </li>
            </ul>
            <p className="mt-3">
              Eine Weitergabe zu Marketingzwecken findet nicht statt.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              5. Speicherung der Daten
            </h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                Alle Personendaten werden in der Schweiz gehostet (Supabase,
                Infomaniak).
              </li>
              <li>
                Wir bewahren deine Daten nur so lange auf, wie es für den
                jeweiligen Zweck erforderlich ist.
              </li>
              <li>
                Transportaufträge (inkl. Adressdaten) werden 30 Tage nach
                erfolgreicher Lieferung automatisch gelöscht.
              </li>
              <li>
                Bei Löschung deines Profils werden sämtliche personenbezogenen
                Daten unwiderruflich entfernt, sofern keine gesetzliche
                Aufbewahrungspflicht besteht.
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">6. Deine Rechte</h2>
            <p className="mt-2">Du hast jederzeit das Recht auf:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Auskunft über deine bei uns gespeicherten Personendaten</li>
              <li>Berichtigung unrichtiger Daten</li>
              <li>Löschung deiner Daten (Profil löschen)</li>
              <li>Einschränkung der Bearbeitung</li>
              <li>
                Datenherausgabe oder -übertragung in einem gängigen Format
              </li>
            </ul>
            <p className="mt-3">
              Zur Ausübung deiner Rechte genügt eine E-Mail an{" "}
              support@321-meins.ch. Wir bearbeiten dein Anliegen innert 30 Tagen.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              7. Cookies und Tracking
            </h2>
            <p className="mt-2">
              Unsere Plattform verwendet ausschliesslich technisch notwendige
              Cookies (z.B. für die Login-Sitzung). Auf Analyse-Tools,
              Tracking-Cookies oder Werbenetzwerke verzichten wir vollständig.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">8. Datensicherheit</h2>
            <p className="mt-2">
              Wir setzen angemessene technische und organisatorische Massnahmen
              ein, um deine Daten gegen unbefugten Zugriff, Verlust, Zerstörung
              oder Missbrauch zu schützen. Dazu gehören SSL-Verschlüsselung,
              Hosting in der Schweiz und beschränkter Zugriff auf Personendaten.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              9. Änderungen dieser Datenschutzerklärung
            </h2>
            <p className="mt-2">
              Wir behalten uns vor, diese Datenschutzerklärung jederzeit
              anzupassen. Die aktuelle Version wird auf unserer Plattform
              veröffentlicht und tritt mit der Veröffentlichung in Kraft.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">10. Aufsichtsbehörde</h2>
            <p className="mt-2">
              Zuständige Aufsichtsbehörde für den Datenschutz in der Schweiz:
            </p>
            <p className="mt-2">
              Eidgenössischer Datenschutz- und Öffentlichkeitsbeauftragter (EDÖB)
              <br />
              Feldeggweg 1, 3003 Bern
              <br />
              <a
                href="https://www.edoeb.admin.ch"
                className="text-[var(--color-brand-700)] underline hover:no-underline"
              >
                www.edoeb.admin.ch
              </a>
            </p>
          </div>
        </div>
    </>
  );
}

function DatenschutzPage() {
  return (
    <section id="datenschutz" className="py-10 md:py-14">
      <div className="mx-auto max-w-3xl px-5">
        <DatenschutzLegalBody />
      </div>
    </section>
  );
}

function KontaktPage() {
  return (
    <section id="kontakt" className="py-10 md:py-14">
      <div className="mx-auto max-w-2xl px-5 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
          Kontakt
        </h1>
        <p className="mt-8 text-base leading-relaxed text-slate-600 md:text-lg">
          Hast du Fragen, Anregungen oder benötigst Hilfe? Wir sind für dich da.
        </p>
        <p className="mt-10">
          <a
            href="mailto:support@321-meins.ch"
            className="break-all text-2xl font-semibold tracking-tight text-slate-900 transition-colors hover:text-[var(--color-brand-700)] md:text-3xl"
          >
            support@321-meins.ch
          </a>
        </p>
        <p className="mt-8 text-sm leading-relaxed text-slate-500">
          Wir antworten innerhalb von 24 Stunden.
        </p>
      </div>
    </section>
  );
}

function ImpressumPage() {
  return (
    <section id="impressum" className="py-10 md:py-14">
      <div className="mx-auto max-w-2xl px-5 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
          Impressum
        </h1>
        <div className="mt-10 space-y-8 text-base leading-relaxed text-slate-600 md:text-lg">
          <p>
            <span className="font-semibold text-slate-900">
              Plattformbetreiber:{" "}
            </span>
            Imrli Amza
          </p>
          <p>
            <span className="font-semibold text-slate-900">Adresse: </span>
            Bahnhofstrasse 191, 8620 Wetzikon
          </p>
          <p>
            <span className="font-semibold text-slate-900">E-Mail: </span>
            <a
              href="mailto:support@321-meins.ch"
              className="break-all font-semibold text-slate-900 transition-colors hover:text-[var(--color-brand-700)]"
            >
              support@321-meins.ch
            </a>
          </p>
        </div>
        <p className="mt-12 text-sm leading-relaxed text-slate-500">
          Als Privatperson in der Schweiz betrieben.
        </p>
      </div>
    </section>
  );
}

const TRANSPORTER_DATA: Record<string, TransporterInfo> = {
  MG: { firma: "MoveFast GmbH", kontakt: "Max Gerber", telefon: "+41 44 123 45 67", email: "max.gerber@movefast.ch" },
  SC: { firma: "SwissCargo AG", kontakt: "Sabine Caprez", telefon: "+41 31 987 65 43", email: "s.caprez@swisscargo.ch" },
  TF: { firma: "Transit Forwarder GmbH", kontakt: "Tobias Frei", telefon: "+41 21 555 12 34", email: "tobias@transit-forwarder.ch" },
  BL: { firma: "Bern Logistik AG", kontakt: "Beat Lüthi", telefon: "+41 31 444 22 11", email: "beat.luethi@bern-logistik.ch" },
  ZR: { firma: "Zürich Relocations", kontakt: "Zora Reinhardt", telefon: "+41 44 333 88 99", email: "zora@zuerich-relocations.ch" },
  AW: { firma: "Alpen-Wagen GmbH", kontakt: "Andrea Wyss", telefon: "+41 41 200 12 34", email: "andrea@alpenwagen.ch" },
  LH: { firma: "Lenz Haustransport", kontakt: "Lukas Hofer", telefon: "+41 32 765 43 21", email: "kontakt@lenz-transport.ch" },
  CK: { firma: "City Kurier AG", kontakt: "Carla Köhli", telefon: "+41 22 789 12 34", email: "c.koehli@citykurier.ch" },
  BR: { firma: "Brückner Spedition", kontakt: "Bruno Brunner", telefon: "+41 71 654 32 10", email: "bruno@brueckner-sped.ch" },
  LM: { firma: "Lakemove AG", kontakt: "Lara Müller", telefon: "+41 41 888 77 66", email: "lara@lakemove.ch" },
  RT: { firma: "Rapid Transport", kontakt: "Ramon Tschudi", telefon: "+41 81 234 56 78", email: "ramon@rapid-transport.ch" },
  VK: { firma: "VanKurier GmbH", kontakt: "Viktor Keller", telefon: "+41 52 111 22 33", email: "viktor@vankurier.ch" },
  EN: { firma: "Express Now AG", kontakt: "Elena Naef", telefon: "+41 44 200 30 40", email: "e.naef@expressnow.ch" },
  DH: { firma: "Direkt Handling", kontakt: "Daniel Hug", telefon: "+41 33 567 89 01", email: "daniel@direkt-handling.ch" },
  FP: { firma: "Fairpreis Spedition", kontakt: "Fabian Probst", telefon: "+41 62 345 67 89", email: "fabian@fairpreis.ch" },
  WS: { firma: "Werner Spedition", kontakt: "Werner Spörri", telefon: "+41 71 432 10 98", email: "w.spoerri@werner-sped.ch" },
  JG: { firma: "Jet Cargo Group", kontakt: "Jana Gerber", telefon: "+41 44 567 12 34", email: "jana@jetcargo.ch" },
  PA: { firma: "Profi-Auftrag GmbH", kontakt: "Petra Aebischer", telefon: "+41 31 678 23 45", email: "petra@profi-auftrag.ch" },
  OM: { firma: "Omnibus Move AG", kontakt: "Oliver Müller", telefon: "+41 56 789 34 56", email: "o.mueller@omnibus-move.ch" },
  NB: { firma: "Nordwest Bewegung", kontakt: "Nora Bühler", telefon: "+41 61 890 45 67", email: "nora@nordwest-bewegung.ch" },
};

function getTransporterInfo(initials: string): TransporterInfo {
  return (
    TRANSPORTER_DATA[initials] ?? {
      firma: `Transporteur ${initials}`,
      kontakt: "—",
      telefon: "—",
      email: "—",
    }
  );
}

type LoginPayload = {
  username: string;
  role: UserRole;
  initials?: string;
  userId?: string;
  email?: string;
};

type AuthValue = {
  user: AuthUser | null;
  login: (payload: LoginPayload) => void;
  logout: () => void | Promise<void>;
  openLogin: (hint?: string | null) => void;
  closeLogin: () => void;
  loginOpen: boolean;
  loginModalHint: string | null;
  auctions: Auction[];
  addAuction: (draft: AuctionDraft) => Promise<string>;
  awardBid: (auctionId: string, bid: Bid) => Promise<void>;
  rejectBids: (auctionId: string) => Promise<void>;
  placeTransporterBid: (
    auctionId: string,
    price: number,
  ) => Promise<string | null>;
  transporterBidFocusId: string | null;
  setTransporterBidFocus: (id: string | null) => void;
  view: View;
  selectedAuctionId: string | null;
  auctionFormPrefill: AuctionDraft | null;
  consumeAuctionFormPrefill: () => void;
  goHome: () => void;
  goToMyAuctions: () => void;
  goToAuctionForm: (prefill?: AuctionDraft) => void;
  viewAuctionDetail: (id: string) => void;
  refreshAuctions: () => Promise<void>;
  /** Session-Profil (Benutzername/Kürzel) neu aus Supabase laden */
  refreshSessionUser: () => Promise<void>;
  markAuctionDeliveredMock: (anzeigeId: string) => void;
  /** Mock: Zahlung abschliessen → bezahlt_simuliert + QR */
  completePendingPaymentMock: (anzeigeId: string) => void;
  pendingDeliveryRatings: PendingDeliveryRating[];
  refreshPendingDeliveryRatings: () => Promise<void>;
  deliveryRatingModal: { anzeigeId: string; partnerName: string } | null;
  setDeliveryRatingModal: (
    v: { anzeigeId: string; partnerName: string } | null,
  ) => void;
};

const AuthContext = createContext<AuthValue | null>(null);

function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthContext");
  return ctx;
}

const INITIALS_POOL = [
  "MG", "SC", "TF", "BL", "ZR", "AW", "LH", "CK", "BR", "LM",
  "RT", "VK", "EN", "DH", "FP", "WS", "JG", "PA", "OM", "NB",
];

function randomInitials(exclude: Set<string>): string {
  const free = INITIALS_POOL.filter((x) => !exclude.has(x));
  if (free.length === 0) return INITIALS_POOL[0];
  return free[Math.floor(Math.random() * free.length)];
}

function mockRandomBidMeta(): Pick<Bid, "verifiziert" | "bewertung"> {
  return {
    verifiziert: Math.random() > 0.65 ? true : undefined,
    bewertung: Math.round((25 + Math.random() * 25)) / 10,
  };
}

function initialsFromUsername(username: string): string {
  const alnum = username.replace(/[^a-zA-Z]/g, "");
  if (alnum.length >= 2) return alnum.slice(0, 2).toUpperCase();
  const pad = (username + "XX").toUpperCase();
  return pad.slice(0, 2);
}

function initialsFromFirma(firma: string): string {
  const words = firma.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const a = words[0][0] ?? "X";
    const b = words[1][0] ?? "X";
    return (a + b).toUpperCase();
  }
  const alnum = firma.replace(/[^a-zA-Z0-9]/g, "");
  if (alnum.length >= 2) return alnum.slice(0, 2).toUpperCase();
  return "TX";
}

/** Nur Ortsname / Kurzbezeichnung – keine vollständige Strassenadresse */
function displayOrt(raw: string): string {
  return ortOeffentlich(raw);
}

function transporteurHatZuschlag(
  auction: Auction,
  u: Pick<AuthUser, "role" | "userId" | "username"> | null,
): boolean {
  if (!u || u.role !== "transporteur") return false;
  return transporteurHatZuschlagViewer(auction, {
    role: u.role,
    userId: u.userId,
    username: u.username,
  });
}

function transporterHatGebot(
  auction: Auction,
  username: string | undefined,
): boolean {
  return Boolean(
    username &&
      auction.bids.some((b) => b.bidderKey && b.bidderKey === username),
  );
}

/** ISO-Datum yyyy-mm-dd → tt.mm.jjjj */
function formatDatumDe(iso: string | undefined): string {
  const s = iso?.trim();
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  if (!y || !m || !d) return s;
  return `${d}.${m}.${y}`;
}

function auctionHatAdressSnapshot(a: Auction): boolean {
  const hasAbs = Boolean(
    a.absVorname?.trim() ||
      a.absName?.trim() ||
      a.absStrasse?.trim() ||
      a.absPlz?.trim() ||
      a.absOrt?.trim(),
  );
  const hasEmpf = Boolean(
    a.empfVorname?.trim() ||
      a.empfName?.trim() ||
      a.empfStrasse?.trim() ||
      a.empfPlz?.trim() ||
      a.empfOrt?.trim(),
  );
  return hasAbs || hasEmpf;
}

const DUMMY_AUFTRAGGEBER_EMAIL = "test@321-meins.ch";
const DUMMY_AUFTRAGGEBER_TELEFON = "079 123 45 67";

function absenderEmailAusAuction(a: Auction): string {
  const snap = (a.absEmail ?? "").trim();
  const join = (a.ownerEmail ?? "").trim();
  const v =
    (snap && snap !== "—" ? snap : "") ||
    (join && join !== "—" ? join : "");
  if (v) return v;
  return import.meta.env.DEV ? DUMMY_AUFTRAGGEBER_EMAIL : "—";
}

function absenderTelefonAusAuction(a: Auction): string {
  const snap = (a.absTelefon ?? "").trim();
  const join = (a.ownerTelefon ?? "").trim();
  const v =
    (snap && snap !== "—" ? snap : "") ||
    (join && join !== "—" ? join : "");
  if (v) return v;
  return import.meta.env.DEV ? DUMMY_AUFTRAGGEBER_TELEFON : "—";
}

/** Zwei Spalten (Label | Werte), z. B. in Auction-Detail-Grid. Mit vollstaendig immer Absender + Empfänger (fehlende Werte als "—"). */
function AuktionsPrivatAdressen({
  auction,
  vollstaendig,
}: {
  auction: Auction;
  vollstaendig?: boolean;
}) {
  if (!vollstaendig && !auctionHatAdressSnapshot(auction)) return null;
  const line2 = (a?: string, b?: string) =>
    [a, b].filter((x) => x?.trim()).join(" ");
  if (vollstaendig) {
    return (
      <>
        <span className="text-slate-500">Absender (Auftraggeber)</span>
        <div className="font-medium text-slate-900">
          <span className="block">
            {line2(auction.absVorname, auction.absName) || "—"}
          </span>
          <span className="block">{auction.absStrasse?.trim() || "—"}</span>
          <span className="block">
            {line2(auction.absPlz, auction.absOrt) || "—"}
          </span>
          <span className="block">
            E-Mail: {absenderEmailAusAuction(auction)}
          </span>
          <span className="block">
            Telefon: {absenderTelefonAusAuction(auction)}
          </span>
        </div>
        <span className="text-slate-500">Empfänger</span>
        <div className="font-medium text-slate-900">
          <span className="block">
            {line2(auction.empfVorname, auction.empfName) || "—"}
          </span>
          <span className="block">{auction.empfStrasse?.trim() || "—"}</span>
          <span className="block">
            {line2(auction.empfPlz, auction.empfOrt) || "—"}
          </span>
        </div>
      </>
    );
  }
  return (
    <>
      {(auction.absVorname?.trim() ||
        auction.absName?.trim() ||
        auction.absStrasse?.trim() ||
        auction.absPlz?.trim() ||
        auction.absOrt?.trim()) && (
        <>
          <span className="text-slate-500">Absender (Auftraggeber)</span>
          <div className="font-medium text-slate-900">
            <span className="block">
              {line2(auction.absVorname, auction.absName) || "—"}
            </span>
            <span className="block">
              {auction.absStrasse?.trim() || "—"}
            </span>
            <span className="block">
              {line2(auction.absPlz, auction.absOrt) || "—"}
            </span>
            <span className="block">
              E-Mail: {absenderEmailAusAuction(auction)}
            </span>
            <span className="block">
              Telefon: {absenderTelefonAusAuction(auction)}
            </span>
          </div>
        </>
      )}
      {(auction.empfVorname?.trim() ||
        auction.empfName?.trim() ||
        auction.empfStrasse?.trim() ||
        auction.empfPlz?.trim() ||
        auction.empfOrt?.trim()) && (
        <>
          <span className="text-slate-500">Empfänger</span>
          <div className="font-medium text-slate-900">
            <span className="block">
              {line2(auction.empfVorname, auction.empfName) || "—"}
            </span>
            <span className="block">
              {auction.empfStrasse?.trim() || "—"}
            </span>
            <span className="block">
              {line2(auction.empfPlz, auction.empfOrt) || "—"}
            </span>
          </div>
        </>
      )}
    </>
  );
}

function formatMassGewicht(a: Auction): string {
  const h = a.hoehe?.trim();
  const b = a.breite?.trim();
  const t = a.tiefe?.trim();
  const w = a.gewicht?.trim();
  const dims = [h, b, t].every((x) => x) ? `${h}×${b}×${t} cm` : null;
  const wg = w ? `${w} kg` : null;
  if (dims && wg) return `${dims}, ${wg}`;
  if (dims) return dims;
  if (wg) return wg;
  return "—";
}

/** Eine Zeile „Art“ für die Startseiten-Vorschau (wie bisher statisch). */
function formatHomePreviewArtLine(a: Auction): string {
  const n = a.notizen?.trim();
  if (n) {
    const first = n.split(/\n/)[0]?.trim() ?? "";
    if (first) return first.length > 92 ? `${first.slice(0, 89)}…` : first;
  }
  const m = formatMassGewicht(a);
  return m !== "—" ? m : "—";
}

function topThreeBidsLowestFirst(a: Auction): Bid[] {
  if (!a.bids.length) return [];
  return [...a.bids]
    .sort((x, y) => x.price - y.price || y.ts - x.ts)
    .slice(0, 3);
}

function homeSliderElapsed01(a: Auction, now: number): number {
  const len = Math.max(1, a.durationMs);
  return Math.min(1, Math.max(0, (now - a.startedAt) / len));
}

const LIEFERZEIT_LABEL: Record<
  "vormittags" | "nachmittags" | "flexibel",
  string
> = {
  vormittags: "Vormittags",
  nachmittags: "Nachmittags",
  flexibel: "Zeit flexibel",
};

function formatLieferanzeige(a: Auction): string {
  const datePart = a.lieferdatum?.trim();
  const pref = a.lieferzeitpraeferenz;
  if (!datePart) return "Flexibel";
  if (pref && LIEFERZEIT_LABEL[pref])
    return `${datePart} · ${LIEFERZEIT_LABEL[pref]}`;
  return datePart;
}

function getLowestBid(a: Auction): Bid | null {
  if (a.bids.length === 0) return null;
  return a.bids.reduce((best, b) =>
    b.price < best.price || (b.price === best.price && b.ts > best.ts) ? b : best,
  );
}

function getBidCap(a: Auction): number {
  const low = getLowestBid(a);
  return low ? low.price : a.startPrice;
}

function isAuctionLive(a: Auction, now: number): boolean {
  if (a.awardedAt || a.rejectedAt) return false;
  return now < a.startedAt + a.durationMs;
}

function isAuctionEndedRecently(a: Auction, now: number, hours = 24): boolean {
  const end = a.startedAt + a.durationMs;
  if (now < end) return false;
  return now - end < hours * 3600 * 1000;
}

function formatCountdownHms(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(file);
  });
}

function scrollToCta() {
  if (typeof window === "undefined") return;
  requestAnimationFrame(() => {
    document
      .getElementById("cta")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginModalHint, setLoginModalHint] = useState<string | null>(null);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [view, setView] = useState<View>("home");
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(
    null,
  );
  const [auctionFormPrefill, setAuctionFormPrefill] =
    useState<AuctionDraft | null>(null);
  const [transporterBidFocusId, setTransporterBidFocusId] = useState<
    string | null
  >(null);
  const [pendingDeliveryRatings, setPendingDeliveryRatings] = useState<
    PendingDeliveryRating[]
  >([]);
  const [deliveryRatingModal, setDeliveryRatingModal] = useState<{
    anzeigeId: string;
    partnerName: string;
  } | null>(null);

  const refreshPendingDeliveryRatings = useCallback(async () => {
    if (!useSupabase || !supabase || !user?.userId || !user.role) {
      setPendingDeliveryRatings([]);
      return;
    }
    const list = await fetchPendingDeliveryRatings(
      user.userId,
      user.role,
    );
    setPendingDeliveryRatings(list);
  }, [user?.userId, user?.role]);

  const auctionsForUi = useMemo(() => {
    if (!user) return [];
    return auctions.map((a) =>
      applyAuctionPrivacy(a, {
        userId: user.userId,
        role: user.role,
        username: user.username,
      }),
    );
  }, [auctions, user]);

  const appPage = useSyncExternalStore(
    subscribeAppHash,
    getAppPageFromHash,
    () => "landing",
  );

  useEffect(() => {
    if (appPage === "landing") return;
    window.scrollTo(0, 0);
  }, [appPage]);

  useEffect(() => {
    const noIndexLegalPage =
      appPage === "agb" ||
      appPage === "datenschutz" ||
      appPage === "impressum";
    const selector = 'meta[name="robots"][data-321meins-noindex="1"]';
    const existing = document.head.querySelector(selector);
    if (noIndexLegalPage) {
      if (!existing) {
        const meta = document.createElement("meta");
        meta.setAttribute("name", "robots");
        meta.setAttribute("content", "noindex");
        meta.setAttribute("data-321meins-noindex", "1");
        document.head.appendChild(meta);
      }
    } else {
      existing?.remove();
    }
  }, [appPage]);

  useEffect(() => {
    if (!useSupabase || !supabase) return;
    let cancelled = false;
    const syncUser = async (
      sessionUser: import("@supabase/supabase-js").User | null,
    ) => {
      if (!sessionUser) {
        if (!cancelled) setUser(null);
        return;
      }
      const au = await loadAuthUserFromSession(sessionUser);
      if (cancelled) return;
      if (au) {
        setUser({
          username: au.username,
          role: au.role,
          initials: au.initials,
          userId: au.userId,
          email: au.email,
        });
      } else {
        setUser(null);
      }
    };
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await syncUser(session?.user ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      void syncUser(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!useSupabase || !supabase || !user?.userId) {
      setPendingDeliveryRatings([]);
      return;
    }
    const client = supabase;
    let cancelled = false;
    const refresh = () => {
      void sbAukt.fetchAuctionsForUser().then((list) => {
        if (!cancelled) setAuctions(list);
      });
      void fetchPendingDeliveryRatings(user.userId!, user.role).then(
        (list) => {
          if (!cancelled) setPendingDeliveryRatings(list);
        },
      );
    };
    refresh();
    const ch = client
      .channel("app-data")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auktionen" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gebote" },
        refresh,
      )
      .subscribe();
    return () => {
      cancelled = true;
      void client.removeChannel(ch);
    };
  }, [useSupabase, user?.userId, user?.role]);

  /** Stripe Checkout: Rückkehr ?checkout=success&session_id=…&auction=… */
  useEffect(() => {
    if (!useSupabase || !supabase || !user?.userId) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("checkout") !== "success") return;
    const sessionId = q.get("session_id")?.trim();
    const aid = q.get("auction")?.trim();
    if (!sessionId || !aid) return;
    const doneKey = `checkout_done_${sessionId}`;
    if (sessionStorage.getItem(doneKey)) return;
    let cancelled = false;
    void (async () => {
      const r = await sbAukt.auctionZahlungCompleteCheckout(sessionId);
      if (cancelled || !r.ok) return;
      sessionStorage.setItem(doneKey, "1");
      setAuctions(await sbAukt.fetchAuctionsForUser());
      setSelectedAuctionId(aid);
      setView("auction-detail");
      const u = new URL(window.location.href);
      u.searchParams.delete("checkout");
      u.searchParams.delete("session_id");
      u.searchParams.delete("auction");
      window.history.replaceState(
        {},
        "",
        u.pathname + (u.searchParams.toString() ? `?${u.searchParams}` : "") + u.hash,
      );
      void supabase.functions.invoke("auftrag-qr-email", {
        body: { anzeige_id: aid },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [useSupabase, user?.userId]);

  /** E-Mail-Link ?bewerten=… → Bewertungsdialog */
  useEffect(() => {
    if (!useSupabase || !supabase || !user?.userId || !user.role) return;
    const q = new URLSearchParams(window.location.search);
    const bid = q.get("bewerten")?.trim();
    if (!bid) return;
    let cancelled = false;
    void (async () => {
      const list = await fetchPendingDeliveryRatings(user.userId!, user.role);
      if (cancelled) return;
      const hit = list.find((p) => p.anzeigeId === bid);
      setDeliveryRatingModal(
        hit
          ? { anzeigeId: hit.anzeigeId, partnerName: hit.partnerName }
          : { anzeigeId: bid, partnerName: "deinen Auftragspartner" },
      );
      const u = new URL(window.location.href);
      u.searchParams.delete("bewerten");
      const qs = u.searchParams.toString();
      window.history.replaceState(
        {},
        "",
        u.pathname + (qs ? `?${qs}` : "") + u.hash,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [useSupabase, user?.userId, user?.role]);

  // Mock-Gebote: alle paar Sekunden kommt für eine zufällige laufende Auktion
  // ein neues, niedrigeres Gebot rein. Beauftragte oder abgelehnte Auktionen
  // werden ignoriert.
  useEffect(() => {
    if (useSupabase) return;
    const t = setInterval(() => {
      setAuctions((prev) => {
        if (prev.length === 0) return prev;
        const now = Date.now();
        const liveIdxs = prev
          .map((a, i) => ({ a, i }))
          .filter(
            ({ a }) =>
              !a.awardedAt &&
              !a.rejectedAt &&
              isAuctionLive(a, now) &&
              a.bids.length < 9,
          );
        if (liveIdxs.length === 0) return prev;
        if (Math.random() > 0.65) return prev;
        const pick = liveIdxs[Math.floor(Math.random() * liveIdxs.length)];
        const auction = pick.a;
        const lastPrice = auction.bids[0]?.price ?? auction.startPrice;
        const minPrice = Math.floor(auction.startPrice * 0.55);
        const newPrice = Math.max(
          minPrice,
          lastPrice - Math.floor(Math.random() * 12 + 3),
        );
        if (newPrice >= lastPrice) return prev;
        const used = new Set(auction.bids.map((b) => b.initials));
        const initials = randomInitials(used);
        const next = [...prev];
        next[pick.i] = {
          ...auction,
          bids: [
            {
              initials,
              price: newPrice,
              ts: now,
              bidderKey: undefined,
              ...mockRandomBidMeta(),
            },
            ...auction.bids,
          ],
        };
        return next;
      });
    }, 3500);
    return () => clearInterval(t);
  }, [useSupabase]);

  const auth: AuthValue = {
    user,
    login: (payload) => {
      const initials =
        payload.role === "transporteur"
          ? (payload.initials ?? initialsFromUsername(payload.username))
          : undefined;
      setUser({
        username: payload.username,
        role: payload.role,
        initials,
        userId: payload.userId,
        email: payload.email,
      });
      setLoginOpen(false);
      setLoginModalHint(null);
    },
    logout: async () => {
      if (useSupabase && supabase) await supabase.auth.signOut();
      setUser(null);
      setView("home");
      setSelectedAuctionId(null);
      setAuctionFormPrefill(null);
      setTransporterBidFocusId(null);
      if (useSupabase) setAuctions([]);
    },
    openLogin: (hint) => {
      setLoginModalHint(hint ?? null);
      setLoginOpen(true);
    },
    closeLogin: () => {
      setLoginOpen(false);
      setLoginModalHint(null);
    },
    loginOpen,
    loginModalHint,
    auctions: auctionsForUi,
    addAuction: async (draft) => {
      if (!user || user.role !== "auftraggeber") return "";
      if (useSupabase && supabase) {
        const r = await sbAukt.insertAuction(user.userId ?? null, draft);
        if (!r.ok) {
          throw new Error(r.error);
        }
        const list = await sbAukt.fetchAuctionsForUser();
        setAuctions(list);
        return r.anzeigeId;
      }
      const id = `A-${2800 + Math.floor(Math.random() * 200)}`;
      const startPrice = 280 + Math.floor(Math.random() * 80);
      const newAuction: Auction = {
        id,
        ownerUsername: user.username,
        startedAt: Date.now(),
        bids: [],
        startPrice,
        absVorname: "—",
        absName: "—",
        absStrasse: "—",
        absPlz: "—",
        absOrt: "—",
        ...draft,
      };
      setAuctions((prev) => [newAuction, ...prev]);
      return id;
    },
    awardBid: async (auctionId, bid) => {
      if (useSupabase && supabase) {
        const row = auctions.find((x) => x.id === auctionId);
        const uuid =
          row?.auctionUuid ??
          (await sbAukt.resolveAuctionUuidByAnzeige(auctionId));
        if (!uuid || !bid.bidderKey?.trim()) return;
        const tid = await sbAukt.findTransporteurIdByUsername(bid.bidderKey);
        if (!tid) return;
        const award = await sbAukt.updateAuctionAward(uuid, bid.price, tid);
        if (award.ok) {
          setAuctions(await sbAukt.fetchAuctionsForUser());
        }
        return;
      }
      setAuctions((prev) =>
        prev.map((a) =>
          a.id === auctionId
            ? {
                ...a,
                awardedBid: bid,
                awardedAt: Date.now(),
                auctionStatus: "pending_payment",
                qrToken: undefined,
              }
            : a,
        ),
      );
    },
    rejectBids: async (auctionId) => {
      if (useSupabase && supabase) {
        const row = auctions.find((x) => x.id === auctionId);
        const uuid =
          row?.auctionUuid ??
          (await sbAukt.resolveAuctionUuidByAnzeige(auctionId));
        if (!uuid) return;
        const ok = await sbAukt.updateAuctionReject(uuid);
        if (ok) setAuctions(await sbAukt.fetchAuctionsForUser());
        return;
      }
      setAuctions((prev) =>
        prev.map((a) =>
          a.id === auctionId ? { ...a, rejectedAt: Date.now() } : a,
        ),
      );
    },
    placeTransporterBid: async (auctionId, price) => {
      if (!user || user.role !== "transporteur") return "Nicht angemeldet.";
      const initials = user.initials ?? initialsFromUsername(user.username);
      const a = auctions.find((x) => x.id === auctionId);
      if (!a) return "Auktion nicht gefunden.";
      const now = Date.now();
      if (!isAuctionLive(a, now)) return "Auktion ist nicht mehr aktiv.";
      const cap = getBidCap(a);
      if (!(price < cap)) return `Dein Gebot muss unter CHF ${cap} liegen.`;
      if (useSupabase && supabase && user.userId) {
        if (!a.auctionUuid)
          return "Auktion nicht synchronisiert.";
        const err = await sbAukt.insertBid(
          a.auctionUuid,
          user.userId,
          initials,
          user.username,
          price,
        );
        if (err) return err;
        setAuctions(await sbAukt.fetchAuctionsForUser());
        return null;
      }
      setAuctions((prev) =>
        prev.map((x) =>
          x.id === auctionId
            ? {
                ...x,
                bids: [
                  {
                    initials,
                    price,
                    ts: Date.now(),
                    bidderKey: user.username,
                  },
                  ...x.bids,
                ],
              }
            : x,
        ),
      );
      return null;
    },
    transporterBidFocusId,
    setTransporterBidFocus: setTransporterBidFocusId,
    view,
    selectedAuctionId,
    auctionFormPrefill,
    consumeAuctionFormPrefill: () => setAuctionFormPrefill(null),
    goHome: () => {
      setView("home");
      setSelectedAuctionId(null);
    },
    goToMyAuctions: () => {
      setView("meine-auktionen");
      setSelectedAuctionId(null);
      scrollToCta();
    },
    goToAuctionForm: (prefill) => {
      setAuctionFormPrefill(prefill ?? null);
      setView("auction-form");
      setSelectedAuctionId(null);
      scrollToCta();
    },
    viewAuctionDetail: (id) => {
      setSelectedAuctionId(id);
      setView("auction-detail");
      scrollToCta();
    },
    refreshAuctions: async () => {
      if (!useSupabase || !supabase) return;
      setAuctions(await sbAukt.fetchAuctionsForUser());
    },
    refreshSessionUser: async () => {
      if (!useSupabase || !supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const sessionUser = session?.user ?? null;
      if (!sessionUser) {
        setUser(null);
        return;
      }
      const au = await loadAuthUserFromSession(sessionUser);
      if (au) {
        setUser({
          username: au.username,
          role: au.role,
          initials: au.initials,
          userId: au.userId,
          email: au.email,
        });
      } else {
        setUser(null);
      }
    },
    markAuctionDeliveredMock: (anzeigeId) => {
      if (useSupabase) return;
      setAuctions((prev) =>
        prev.map((a) =>
          a.id === anzeigeId ? { ...a, auctionStatus: "bezahlt" } : a,
        ),
      );
    },
    completePendingPaymentMock: (anzeigeId) => {
      if (useSupabase) return;
      setAuctions((prev) =>
        prev.map((a) =>
          a.id === anzeigeId
            ? {
                ...a,
                auctionStatus: "bezahlt_simuliert",
                qrToken:
                  typeof crypto !== "undefined" && "randomUUID" in crypto
                    ? crypto.randomUUID()
                    : "mock-qr-token",
              }
            : a,
        ),
      );
    },
    pendingDeliveryRatings,
    refreshPendingDeliveryRatings,
    deliveryRatingModal,
    setDeliveryRatingModal,
  };

  return (
    <AuthContext.Provider value={auth}>
      <div className="min-h-screen bg-[var(--color-surface-alt)] text-[var(--color-ink)]">
        <Navbar />
        {appPage === "landing" ? (
          <>
            <CTA />
            <Hero />
            <TrustBar />
            <HowItWorks />
            <Audience />
            <Testimonials />
            <Stats />
            <LandingMidRegisterCta />
            <FAQ />
          </>
        ) : appPage === "ueber-uns" ? (
          <UeberUnsPage />
        ) : appPage === "agb" ? (
          <AgbPage />
        ) : appPage === "datenschutz" ? (
          <DatenschutzPage />
        ) : appPage === "kontakt" ? (
          <KontaktPage />
        ) : (
          <ImpressumPage />
        )}
        <Footer />
      </div>
      {loginOpen && <LoginModal />}
      <LieferungBewertenModal />
    </AuthContext.Provider>
  );
}

function LieferungBewertenModal() {
  const {
    user,
    deliveryRatingModal,
    setDeliveryRatingModal,
    refreshPendingDeliveryRatings,
    refreshAuctions,
  } = useAuth();
  const [sterne, setSterne] = useState(0);
  const [kommentar, setKommentar] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const open = deliveryRatingModal != null && user != null;
  const anzeigeId = deliveryRatingModal?.anzeigeId ?? "";
  const partnerName = deliveryRatingModal?.partnerName ?? "";

  useEffect(() => {
    if (!open) return;
    setSterne(0);
    setKommentar("");
    setErr(null);
  }, [open, anzeigeId]);

  if (!open || !user || !deliveryRatingModal) return null;

  const roleLabel =
    user.role === "auftraggeber" ? "Transporteur" : "Auftraggeber";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lieferung-bewerten-title"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm anim-fade-up"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) setDeliveryRatingModal(null);
      }}
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl">
        <h2
          id="lieferung-bewerten-title"
          className="text-xl font-extrabold tracking-tight text-slate-900"
        >
          Bewerte deine letzte Lieferung
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {roleLabel}:{" "}
          <span className="font-semibold text-slate-900">{partnerName}</span>
          <span className="block mt-1 text-xs text-slate-500">
            Auftrag #{anzeigeId}
          </span>
        </p>
        <div className="mt-5">
          <div className="text-sm font-medium text-slate-700">
            Sterne (1–5)
          </div>
          <div className="mt-2 flex gap-1" role="group" aria-label="Sterne">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={busy}
                aria-label={`${n} Sterne`}
                aria-pressed={sterne === n}
                onClick={() => setSterne(n)}
                className={`grid size-10 place-items-center rounded-lg border text-lg transition-colors ${
                  sterne >= n
                    ? "border-[#FF8000] bg-orange-50 text-[#FF8000]"
                    : "border-slate-200 bg-white text-slate-300 hover:border-slate-300"
                } disabled:opacity-50`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <label
            htmlFor="lieferung-bewerten-kommentar"
            className="text-sm font-medium text-slate-700"
          >
            Kommentar (optional, max. 300 Zeichen)
          </label>
          <textarea
            id="lieferung-bewerten-kommentar"
            rows={3}
            maxLength={300}
            disabled={busy}
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[var(--color-brand-400)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-400)]"
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {kommentar.length}/300
          </p>
        </div>
        {err && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {err}
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => setDeliveryRatingModal(null)}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Schliessen
          </button>
          <button
            type="button"
            disabled={busy || sterne < 1}
            onClick={() => {
              void (async () => {
                setErr(null);
                if (sterne < 1 || sterne > 5) {
                  setErr("Bitte 1 bis 5 Sterne wählen.");
                  return;
                }
                setBusy(true);
                const r = await submitLieferungBewertung(
                  anzeigeId,
                  sterne,
                  kommentar,
                );
                setBusy(false);
                if (!r.ok) {
                  setErr(r.error);
                  return;
                }
                setDeliveryRatingModal(null);
                await refreshPendingDeliveryRatings();
                await refreshAuctions();
              })();
            }}
            className="inline-flex items-center justify-center rounded-full bg-[var(--color-accent-500)] px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-[var(--color-accent-600)] disabled:opacity-50 btn-action-shine"
          >
            {busy ? "Senden …" : "Bewertung absenden"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- NAVBAR ---------- */
function Navbar() {
  const {
    user,
    openLogin,
    goToMyAuctions,
    pendingDeliveryRatings,
    setDeliveryRatingModal,
  } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#so-funktionierts", label: "So funktioniert's" },
    { href: "#fuer-wen", label: "Für wen" },
    { href: "#zahlen", label: "Zahlen" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <div className="sticky top-0 z-50">
      <header
        className={`transition-all ${
          scrolled
            ? "backdrop-blur-md bg-white/80 border-b border-slate-200/70"
            : "bg-transparent"
        }`}
      >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left hover:opacity-95"
          onClick={() => {
            window.location.hash = "";
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label="321 meins Startseite"
        >
          <Logo />
        </button>

        <ul className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-700">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="hover:text-[var(--color-brand-700)] transition-colors"
              >
                {l.label}
              </a>
            </li>
          ))}
          {user?.role === "auftraggeber" && (
            <li>
              <button
                type="button"
                onClick={goToMyAuctions}
                className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[var(--color-accent-500)] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 transition-colors hover:bg-[var(--color-accent-600)] btn-action-shine"
              >
                Meine Auktionen
              </button>
            </li>
          )}
        </ul>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-xs font-medium text-emerald-700 lg:inline-flex lg:items-center lg:gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Angemeldet als{" "}
                <span className="font-semibold">{user.username}</span>
              </span>
              <UserMenu />
            </>
          ) : (
            <button
              type="button"
              onClick={() => openLogin()}
              className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-[var(--color-brand-700)] transition-colors"
            >
              Login
            </button>
          )}
        </div>

        <button
          type="button"
          aria-label="Menü öffnen"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white"
        >
          <span className="relative block h-3 w-5">
            <span
              className={`absolute left-0 block h-[2px] w-full bg-slate-900 transition-all ${
                open ? "top-[5px] rotate-45" : "top-0"
              }`}
            />
            <span
              className={`absolute left-0 block h-[2px] w-full bg-slate-900 transition-all ${
                open ? "top-[5px] -rotate-45" : "top-[10px]"
              }`}
            />
          </span>
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <ul className="px-5 py-3">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-2 text-sm font-medium text-slate-700"
                >
                  {l.label}
                </a>
              </li>
            ))}
            {user?.role === "auftraggeber" && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    goToMyAuctions();
                  }}
                  className="inline-flex w-full items-center justify-center rounded-full bg-[var(--color-accent-500)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 transition-colors hover:bg-[var(--color-accent-600)] btn-action-shine"
                >
                  Meine Auktionen
                </button>
              </li>
            )}
            <li className="pt-2">
              <a
                href="#cta"
                onClick={() => setOpen(false)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand-700)] px-4 py-3 text-sm font-semibold text-white btn-action-shine"
              >
                Jetzt starten
                <ArrowRight className="size-4" />
              </a>
            </li>
          </ul>
        </div>
      )}
      </header>
      {user && pendingDeliveryRatings.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-center text-sm text-amber-950">
          <button
            type="button"
            onClick={() => {
              const first = pendingDeliveryRatings[0];
              setDeliveryRatingModal({
                anzeigeId: first.anzeigeId,
                partnerName: first.partnerName,
              });
            }}
            className="font-semibold underline decoration-amber-700 underline-offset-2 hover:text-amber-900"
          >
            Bewerte deine letzte Lieferung
          </button>
        </div>
      )}
      {isAppTestMode() && (
        <div
          className="h-[3px] w-full shrink-0 bg-[#999999] pointer-events-none"
          title="Testmodus aktiv: QR-, Scan- und Zahlungsablauf simuliert."
          aria-hidden
        />
      )}
    </div>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="grid size-9 place-items-center rounded-xl bg-[var(--color-brand-700)] text-white font-black shadow-sm">
        321
      </span>
      <span className="text-lg font-semibold tracking-tight text-[var(--color-brand-700)]">
        meins
      </span>
    </span>
  );
}

/* ---------- USER MENU / KONTO ---------- */
function ProfileEditModal({
  onClose,
  role,
  userId,
  refreshSessionUser,
}: {
  onClose: () => void;
  role: UserRole;
  userId: string;
  refreshSessionUser: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [agForm, setAgForm] = useState<AuftraggeberProfile>({
    vorname: "",
    name: "",
    strasse: "",
    plz: "",
    ort: "",
    telefon: "",
    email: "",
  });
  const [trForm, setTrForm] = useState<TransporteurProfile>({
    firmenname: "",
    vorname_kontakt: "",
    name_kontakt: "",
    strasse: "",
    plz: "",
    ort: "",
    telefon: "",
    email: "",
  });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMismatch, setPwMismatch] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);
  const [receivedRatings, setReceivedRatings] = useState<ReceivedRatingRow[]>(
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      setReceivedRatings([]);
      if (role === "auftraggeber") {
        const r = await fetchAuftraggeberProfile(userId);
        if (cancelled) return;
        if (!r.ok) {
          setLoadError(r.error);
          setLoading(false);
          return;
        }
        setAgForm(r.data);
        const recv = await fetchReceivedRatingsForProfile(
          userId,
          "auftraggeber",
        );
        if (!cancelled) setReceivedRatings(recv);
      } else {
        const r = await fetchTransporteurProfile(userId);
        if (cancelled) return;
        if (!r.ok) {
          setLoadError(r.error);
          setLoading(false);
          return;
        }
        setTrForm(r.data);
        const recv = await fetchReceivedRatingsForProfile(
          userId,
          "transporteur",
        );
        if (!cancelled) setReceivedRatings(recv);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [role, userId]);

  const saveProfile = async () => {
    setProfileMsg(null);
    setProfileErr(null);
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (role === "auftraggeber") {
      const f = agForm;
      if (
        !f.vorname.trim() ||
        !f.name.trim() ||
        !f.strasse.trim() ||
        !f.plz.trim() ||
        !f.ort.trim() ||
        !f.telefon.trim() ||
        !f.email.trim()
      ) {
        setProfileErr("Bitte alle Felder ausfüllen.");
        return;
      }
      if (!emailRe.test(f.email.trim())) {
        setProfileErr("Bitte eine gültige E-Mail-Adresse eingeben.");
        return;
      }
    } else {
      const f = trForm;
      if (
        !f.firmenname.trim() ||
        !f.vorname_kontakt.trim() ||
        !f.name_kontakt.trim() ||
        !f.strasse.trim() ||
        !f.plz.trim() ||
        !f.ort.trim() ||
        !f.telefon.trim() ||
        !f.email.trim()
      ) {
        setProfileErr("Bitte alle Felder ausfüllen.");
        return;
      }
      if (!emailRe.test(f.email.trim())) {
        setProfileErr("Bitte eine gültige E-Mail-Adresse eingeben.");
        return;
      }
    }
    setProfileBusy(true);
    const r =
      role === "auftraggeber"
        ? await updateAuftraggeberProfile(userId, agForm)
        : await updateTransporteurProfile(userId, trForm);
    setProfileBusy(false);
    if (!r.ok) {
      setProfileErr(r.error);
      return;
    }
    setProfileMsg("Profil gespeichert.");
    await refreshSessionUser();
  };

  const savePassword = async () => {
    setPwMismatch(false);
    setPwErr(null);
    setPwOk(null);
    if (!pw1.trim()) {
      setPwErr("Bitte ein neues Passwort eingeben.");
      return;
    }
    if (pw1 !== pw2) {
      setPwMismatch(true);
      return;
    }
    setPwBusy(true);
    const r = await updateAuthPassword(pw1);
    setPwBusy(false);
    if (!r.ok) {
      setPwErr(r.error);
      return;
    }
    setPw1("");
    setPw2("");
    setPwOk("Passwort aktualisiert.");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-edit-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm anim-fade-up"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl md:p-8">
        <h2
          id="profile-edit-title"
          className="text-2xl font-extrabold tracking-tight text-slate-900"
        >
          Profil bearbeiten
        </h2>
        {loading && (
          <p className="mt-4 text-sm text-slate-600">Daten werden geladen …</p>
        )}
        {loadError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {loadError}
          </div>
        )}
        {!loading && !loadError && (
          <>
            {(role === "auftraggeber"
              ? agForm.bewertung != null && Number(agForm.bewertung) > 0
              : trForm.bewertung != null && Number(trForm.bewertung) > 0) && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <div className="font-semibold text-slate-800">
                  Deine durchschnittliche Bewertung
                </div>
                <div className="mt-1">
                  <SterneBewertung
                    value={
                      role === "auftraggeber"
                        ? agForm.bewertung ?? null
                        : trForm.bewertung ?? null
                    }
                  />
                </div>
                {Boolean(
                  (role === "auftraggeber"
                    ? agForm.bewertung_kommentar
                    : trForm.bewertung_kommentar
                  )?.trim(),
                ) && (
                  <p className="mt-2 text-slate-600">
                    <span className="font-medium text-slate-700">
                      Letzter Kommentar:{" "}
                    </span>
                    {role === "auftraggeber"
                      ? agForm.bewertung_kommentar
                      : trForm.bewertung_kommentar}
                  </p>
                )}
              </div>
            )}
            {receivedRatings.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Erhaltene Bewertungen
                </h3>
                <ul className="mt-2 space-y-3">
                  {receivedRatings.map((r) => (
                    <li
                      key={`${r.anzeigeId}-${r.sterne}`}
                      className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0 text-sm"
                    >
                      <span className="font-mono text-xs text-slate-500">
                        #{r.anzeigeId}
                      </span>
                      <div className="mt-0.5">
                        <SterneBewertung value={r.sterne} />
                      </div>
                      {r.kommentar?.trim() ? (
                        <p className="mt-1 whitespace-pre-wrap text-slate-600">
                          {r.kommentar}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-5 space-y-4">
              {role === "auftraggeber" ? (
                <>
                  <Field
                    label="Vorname"
                    name="vorname"
                    value={agForm.vorname}
                    onChange={(_, v) =>
                      setAgForm((p) => ({ ...p, vorname: v }))
                    }
                    required
                  />
                  <Field
                    label="Name"
                    name="name"
                    value={agForm.name}
                    onChange={(_, v) => setAgForm((p) => ({ ...p, name: v }))}
                    required
                  />
                  <Field
                    label="Strasse"
                    name="strasse"
                    value={agForm.strasse}
                    onChange={(_, v) =>
                      setAgForm((p) => ({ ...p, strasse: v }))
                    }
                    required
                  />
                  <Field
                    label="PLZ"
                    name="plz"
                    value={agForm.plz}
                    onChange={(_, v) => setAgForm((p) => ({ ...p, plz: v }))}
                    required
                  />
                  <Field
                    label="Ort"
                    name="ort"
                    value={agForm.ort}
                    onChange={(_, v) => setAgForm((p) => ({ ...p, ort: v }))}
                    required
                  />
                  <Field
                    label="Telefon"
                    name="telefon"
                    value={agForm.telefon}
                    onChange={(_, v) =>
                      setAgForm((p) => ({ ...p, telefon: v }))
                    }
                    required
                  />
                  <Field
                    label="E-Mail"
                    name="email"
                    value={agForm.email}
                    onChange={(_, v) =>
                      setAgForm((p) => ({ ...p, email: v }))
                    }
                    required
                  />
                </>
              ) : (
                <>
                  <Field
                    label="Firmenname"
                    name="firmenname"
                    value={trForm.firmenname}
                    onChange={(_, v) =>
                      setTrForm((p) => ({ ...p, firmenname: v }))
                    }
                    required
                  />
                  <Field
                    label="Vorname Kontaktperson"
                    name="vorname_kontakt"
                    value={trForm.vorname_kontakt}
                    onChange={(_, v) =>
                      setTrForm((p) => ({ ...p, vorname_kontakt: v }))
                    }
                    required
                  />
                  <Field
                    label="Name Kontaktperson"
                    name="name_kontakt"
                    value={trForm.name_kontakt}
                    onChange={(_, v) =>
                      setTrForm((p) => ({ ...p, name_kontakt: v }))
                    }
                    required
                  />
                  <Field
                    label="Strasse"
                    name="strasse"
                    value={trForm.strasse}
                    onChange={(_, v) =>
                      setTrForm((p) => ({ ...p, strasse: v }))
                    }
                    required
                  />
                  <Field
                    label="PLZ"
                    name="plz"
                    value={trForm.plz}
                    onChange={(_, v) => setTrForm((p) => ({ ...p, plz: v }))}
                    required
                  />
                  <Field
                    label="Ort"
                    name="ort"
                    value={trForm.ort}
                    onChange={(_, v) => setTrForm((p) => ({ ...p, ort: v }))}
                    required
                  />
                  <Field
                    label="Telefon"
                    name="telefon"
                    value={trForm.telefon}
                    onChange={(_, v) =>
                      setTrForm((p) => ({ ...p, telefon: v }))
                    }
                    required
                  />
                  <Field
                    label="E-Mail"
                    name="email"
                    value={trForm.email}
                    onChange={(_, v) =>
                      setTrForm((p) => ({ ...p, email: v }))
                    }
                    required
                  />
                </>
              )}
            </div>
            {profileErr && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {profileErr}
              </div>
            )}
            {profileMsg && (
              <p className="mt-4 text-sm font-medium text-emerald-700">
                {profileMsg}
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Schliessen
              </button>
              <button
                type="button"
                disabled={profileBusy}
                onClick={() => void saveProfile()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent-500)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 transition-colors hover:bg-[var(--color-accent-600)] disabled:opacity-60 btn-action-shine"
              >
                Profil speichern
                <ArrowRight className="size-4" />
              </button>
            </div>

            <div className="my-8 border-t border-slate-200" />

            <h3 className="text-lg font-bold text-slate-900">
              Passwort ändern
            </h3>
            <div className="mt-4 space-y-4">
              <Field
                label="Neues Passwort"
                name="pw1"
                type="password"
                autoComplete="new-password"
                value={pw1}
                onChange={(_, v) => {
                  setPw1(v);
                  setPwMismatch(false);
                }}
              />
              <Field
                label="Passwort wiederholen"
                name="pw2"
                type="password"
                autoComplete="new-password"
                value={pw2}
                onChange={(_, v) => {
                  setPw2(v);
                  setPwMismatch(false);
                }}
              />
            </div>
            {pwMismatch && (
              <p
                role="alert"
                className="mt-3 text-sm font-medium text-red-600"
              >
                Passwörter stimmen nicht überein
              </p>
            )}
            {pwErr && (
              <div
                role="alert"
                className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {pwErr}
              </div>
            )}
            {pwOk && (
              <p className="mt-3 text-sm font-medium text-emerald-700">{pwOk}</p>
            )}
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={pwBusy}
                onClick={() => void savePassword()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent-500)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 transition-colors hover:bg-[var(--color-accent-600)] disabled:opacity-60 btn-action-shine"
              >
                Passwort speichern
                <ArrowRight className="size-4" />
              </button>
            </div>
          </>
        )}
        {(loading || loadError) && (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Schliessen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteProfileConfirmModal({
  onClose,
  onAfterDelete,
}: {
  onClose: () => void;
  onAfterDelete: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const confirm = async () => {
    setErr(null);
    setBusy(true);
    const r = await invokeDeleteMyProfile();
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    onClose();
    await onAfterDelete();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-profile-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm anim-fade-up"
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl md:p-8">
        <h2
          id="delete-profile-title"
          className="text-xl font-extrabold tracking-tight text-slate-900"
        >
          Profil löschen
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Bist du sicher, dass du dein Profil löschen möchtest? Deine aktiven
          Auktionen und Gebote gehen dabei verloren. Wir würden uns freuen,
          dich bald wieder bei 321 meins begrüssen zu dürfen.
        </p>
        {err && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {err}
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-60"
          >
            Abrechen
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            className="inline-flex items-center justify-center rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? "Bitte warten …" : "Profil löschen"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserMenu() {
  const { user, logout, refreshSessionUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const canAccount =
    useSupabase && supabase && Boolean(user?.userId?.trim());

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Konto-Menü"
          onClick={() => setOpen((v) => !v)}
          className="grid size-10 cursor-pointer place-items-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-[var(--color-brand-300)] hover:text-[var(--color-brand-700)]"
        >
          <User className="size-5" />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl anim-fade-up"
          >
            <div className="px-3 py-2 text-xs text-slate-500">
              Angemeldet als{" "}
              <span className="font-semibold text-slate-900">
                {user.username}
              </span>
            </div>
            {canAccount && (
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false);
                  setProfileOpen(true);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                Profil bearbeiten
              </button>
            )}
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                if (canAccount) setProfileOpen(true);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Mein Konto
            </button>
            {canAccount && (
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false);
                  setDeleteOpen(true);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                Profil löschen
              </button>
            )}
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              Abmelden
            </button>
          </div>
        )}
      </div>
      {canAccount && profileOpen && user.userId && (
        <ProfileEditModal
          onClose={() => setProfileOpen(false)}
          role={user.role}
          userId={user.userId}
          refreshSessionUser={refreshSessionUser}
        />
      )}
      {canAccount && deleteOpen && (
        <DeleteProfileConfirmModal
          onClose={() => setDeleteOpen(false)}
          onAfterDelete={logout}
        />
      )}
    </>
  );
}

/* ---------- LOGIN MODAL ---------- */
function LoginModal() {
  const { login, closeLogin, loginModalHint } = useAuth();
  const [view, setView] = useState<"login" | "forgot">("login");
  const [role, setRole] = useState<UserRole>("auftraggeber");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLogin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeLogin]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, boolean> = {};
    if (!username.trim()) newErrors.username = true;
    if (!password.trim()) newErrors.password = true;
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitError("Bitte füllen Sie alle Pflichtfelder aus.");
      return;
    }
    setErrors({});
    setSubmitError(null);
    if (useSupabase && supabase) {
      const email = await resolveLoginEmail(username.trim(), role);
      if (!email) {
        setSubmitError("Benutzername/E-Mail oder Rolle passt nicht.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: password.trim(),
      });
      if (error) {
        setSubmitError(error.message);
        return;
      }
      closeLogin();
      return;
    }
    login({
      username: username.trim(),
      role,
      initials:
        role === "transporteur"
          ? initialsFromUsername(username.trim())
          : undefined,
    });
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!forgotEmail.trim() || !emailRe.test(forgotEmail.trim())) {
      setErrors({ forgotEmail: true });
      return;
    }
    setErrors({});
    setSubmitError(null);
    if (useSupabase && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(
        forgotEmail.trim(),
        { redirectTo: `${authRedirectOrigin()}/` },
      );
      if (error) {
        setSubmitError(error.message);
        return;
      }
    }
    setForgotSent(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeLogin();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm anim-fade-up"
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl md:p-8">
        {view === "login" && (
          <form onSubmit={(e) => void handleLogin(e)} noValidate>
            <h2
              id="login-title"
              className="text-2xl font-extrabold tracking-tight text-slate-900"
            >
              Anmelden
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Willkommen zurück bei 321 meins.
            </p>

            <div className="mt-5">
              <span className="block text-sm font-medium text-slate-700">
                Ich melde mich an als
              </span>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRole("auftraggeber")}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    role === "auftraggeber"
                      ? "border-[var(--color-brand-600)] bg-[var(--color-brand-50)] text-[var(--color-brand-800)]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  Auftraggeber
                </button>
                <button
                  type="button"
                  onClick={() => setRole("transporteur")}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    role === "transporteur"
                      ? "border-[var(--color-brand-600)] bg-[var(--color-brand-50)] text-[var(--color-brand-800)]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  Transporteur
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <Field
                label="Benutzername oder E-Mail"
                name="username"
                value={username}
                onChange={(_, v) => {
                  setUsername(v);
                  if (errors.username)
                    setErrors((p) => ({ ...p, username: false }));
                  if (submitError) setSubmitError(null);
                }}
                error={errors.username}
                required
                autoComplete="username"
              />
              <Field
                label="Passwort"
                name="password"
                value={password}
                onChange={(_, v) => {
                  setPassword(v);
                  if (errors.password)
                    setErrors((p) => ({ ...p, password: false }));
                  if (submitError) setSubmitError(null);
                }}
                error={errors.password}
                required
                type="password"
                autoComplete="current-password"
              />
            </div>

            <div className="mt-3 text-right">
              <button
                type="button"
                onClick={() => {
                  setView("forgot");
                  setErrors({});
                  setSubmitError(null);
                }}
                className="text-sm font-medium text-[var(--color-brand-700)] underline-offset-2 hover:underline"
              >
                Passwort vergessen?
              </button>
            </div>

            {submitError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {submitError}
              </div>
            )}

            {loginModalHint && view === "login" && (
              <p className="mt-4 text-sm text-slate-600">{loginModalHint}</p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeLogin}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent-500)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 transition-colors hover:bg-[var(--color-accent-600)] btn-action-shine"
              >
                Anmelden
                <ArrowRight className="size-4" />
              </button>
            </div>
          </form>
        )}

        {view === "forgot" && (
          <div>
            <h2
              id="login-title"
              className="text-2xl font-extrabold tracking-tight text-slate-900"
            >
              Passwort zurücksetzen
            </h2>

            {!forgotSent ? (
              <form onSubmit={(e) => void handleForgot(e)} noValidate>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Bitte gib deine E-Mail-Adresse ein. Wir senden dir einen Link
                  zum Zurücksetzen deines Passworts.
                </p>
                <div className="mt-5">
                  <Field
                    label="E-Mail-Adresse"
                    name="forgotEmail"
                    value={forgotEmail}
                    onChange={(_, v) => {
                      setForgotEmail(v);
                      if (errors.forgotEmail)
                        setErrors((p) => ({ ...p, forgotEmail: false }));
                      if (submitError) setSubmitError(null);
                    }}
                    error={errors.forgotEmail}
                    required
                    type="email"
                    autoComplete="email"
                  />
                </div>
                {submitError && (
                  <div
                    role="alert"
                    className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                  >
                    {submitError}
                  </div>
                )}
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setView("login");
                      setErrors({});
                    }}
                    className="text-sm font-medium text-[var(--color-brand-700)] underline-offset-2 hover:underline"
                  >
                    Zurück zur Anmeldung
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent-500)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 transition-colors hover:bg-[var(--color-accent-600)] btn-action-shine"
                  >
                    Link senden
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4">
                <div className="grid size-12 place-items-center rounded-full bg-emerald-500 text-white">
                  <Check className="size-6" />
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-700">
                  Wir haben dir einen Link an{" "}
                  <span className="font-semibold">{forgotEmail}</span> gesendet.
                  Bitte prüfe dein Postfach.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setView("login");
                    setForgotSent(false);
                    setForgotEmail("");
                  }}
                  className="mt-6 text-sm font-medium text-[var(--color-brand-700)] underline-offset-2 hover:underline"
                >
                  Zurück zur Anmeldung
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- HERO ---------- */
// Natural Earth 50m admin-0 countries, ISO CHE (Public Domain).
const SWISS_OUTLINE_VIEWBOX = "0 0 1000 434";
const SWISS_OUTLINE_PATH =
  "M769.10,68.96L775.33,71.64L789.99,80.69L786.55,96.13L769.82,120.97L760.94,141.10L759.96,156.53L761.64,163.76L764.65,163.66L780.64,164.76L788.77,164.74L814.43,168.92L835.01,175.02L838.97,181.47L841.66,189.32L866.10,200.07L894.13,207.01L903.62,204.78L938.42,179.66L951.87,183.84L960.00,197.18L959.64,204.25L950.04,230.95L948.38,245.28L956.65,254.76L957.52,262.14L955.09,268.88L941.23,269.49L922.60,265.84L906.85,254.30L894.95,255.68L884.59,258.65L879.30,269.55L874.60,282.59L876.10,289.84L883.55,295.41L889.24,307.30L893.39,322.66L896.53,329.73L893.07,332.87L883.27,334.97L875.16,332.90L860.93,314.51L854.28,307.51L843.04,306.28L823.21,310.74L792.78,321.03L780.50,320.99L770.06,318.92L760.28,310.18L751.99,293.35L749.32,282.78L743.51,283.12L724.04,280.06L714.96,284.24L714.88,301.46L713.10,322.91L703.32,336.77L676.16,360.74L666.18,371.20L662.21,378.70L661.37,385.23L665.52,396.51L671.17,407.29L666.46,413.42L652.10,416.64L641.96,410.09L638.03,398.44L616.06,382.54L626.05,369.23L624.37,365.93L588.09,359.02L572.44,348.96L550.49,331.29L546.40,323.71L547.32,299.10L546.06,293.13L543.13,290.22L532.50,290.41L517.69,298.97L504.03,311.73L476.08,326.13L473.17,329.22L482.55,343.26L482.13,348.73L459.37,371.11L455.04,378.49L426.15,392.54L412.93,397.80L372.86,387.46L361.79,386.24L343.94,393.16L318.57,399.75L277.76,406.30L262.74,401.50L255.63,396.99L252.10,390.21L241.80,378.24L230.22,371.14L222.17,363.41L211.43,354.94L204.54,347.87L213.71,325.28L207.02,317.33L203.58,305.99L205.36,298.31L201.67,296.43L164.77,292.00L134.14,293.41L112.18,300.96L94.29,313.50L92.15,316.20L93.25,318.46L102.15,329.99L87.06,342.14L63.92,351.59L47.51,352.55L40.30,350.72L40.00,337.70L53.56,332.90L65.82,324.42L69.93,312.47L71.43,304.06L58.51,293.89L60.09,287.66L68.11,275.85L72.76,265.40L79.13,256.36L104.65,241.58L130.29,226.73L134.16,210.96L136.12,191.75L139.75,187.14L174.33,175.65L182.96,171.10L187.31,164.58L214.52,143.05L241.46,121.70L246.89,114.55L251.42,110.35L251.42,106.87L248.03,104.19L235.19,102.40L230.86,95.63L244.81,83.53L262.26,76.11L279.21,76.01L286.02,79.42L285.66,83.43L292.97,87.73L305.81,89.16L321.70,87.65L337.46,83.13L347.18,72.35L352.83,64.21L377.59,54.90L394.50,59.59L441.48,60.82L475.68,58.29L497.12,51.98L523.70,51.98L541.53,55.54L544.68,55.02L549.58,54.19L554.43,50.80L571.22,48.47L573.48,45.65L572.78,42.75L569.76,41.27L549.12,42.77L541.23,40.54L539.21,35.39L545.84,26.45L561.04,19.15L573.93,17.36L583.20,19.31L605.86,32.87L611.29,33.28L614.43,30.85L619.14,29.48L626.96,32.14L635.75,40.54L637.21,41.83L687.76,38.89L699.10,38.89L733.40,53.62L769.10,68.96Z";

function SwissOutlineWatermark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={SWISS_OUTLINE_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      className={className ?? "h-full w-full"}
      aria-hidden
    >
      <path
        d={SWISS_OUTLINE_PATH}
        fill="none"
        stroke="#000000"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HeroRegisterChoiceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const choose = (role: "auftraggeber" | "transporteur") => {
    window.dispatchEvent(
      new CustomEvent("321meins-open-registration", { detail: role }),
    );
    scrollToCta();
    onClose();
  };

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hero-reg-choice-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id="hero-reg-choice-title"
            className="text-lg font-bold text-slate-900"
          >
            Jetzt registrieren
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-2xl leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Schliessen"
          >
            ×
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Wähle, wie du 321 meins nutzen möchtest.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => choose("auftraggeber")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent-500)] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-900/20 transition-colors hover:bg-[var(--color-accent-600)] btn-action-shine"
          >
            Als Auftraggeber registrieren
          </button>
          <button
            type="button"
            onClick={() => choose("transporteur")}
            className="btn-action-shine inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white bg-black px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-950"
          >
            Als Transporteur registrieren
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Hero() {
  const { user, goToAuctionForm } = useAuth();
  const [registerChoiceOpen, setRegisterChoiceOpen] = useState(false);
  const isAuftraggeber = user?.role === "auftraggeber";

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[var(--color-brand-800)]" />
      <div className="absolute inset-0 -z-10 bg-grid opacity-40" />
      <div className="absolute inset-0 -z-10 bg-radial-fade" />

      <div className="mx-auto grid max-w-6xl gap-8 px-5 pb-10 md:grid-cols-2 md:items-start md:pb-12">
        <div className="anim-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
            Live-Auktion läuft – Schweiz
          </span>

          <div
            className="pointer-events-none relative mt-5 w-full max-w-full"
            aria-hidden
          >
            <div className="relative mx-auto aspect-[1000/434] w-full">
              <SwissOutlineWatermark className="block h-full w-full" />
              <span className="absolute left-1/2 top-1/2 flex size-2 -translate-x-1/2 -translate-y-1/2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
            </div>
          </div>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            <span className="bg-gradient-to-r from-[var(--color-accent-300)] to-[var(--color-accent-500)] bg-clip-text text-transparent">
              Live. Fair. Günstig.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">
            Transporteure unterbieten sich in Echtzeit – du siehst den besten
            Preis sofort und sparst garantiert. Ohne versteckte Kosten, ohne
            endloses Vergleichen.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                if (isAuftraggeber) {
                  goToAuctionForm();
                  scrollToCta();
                } else {
                  setRegisterChoiceOpen(true);
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent-500)] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 hover:bg-[var(--color-accent-600)] transition-colors btn-action-shine"
            >
              {isAuftraggeber ? "Transport ausschreiben" : "Jetzt registrieren"}
              <ArrowRight className="size-4" />
            </button>
            <a
              href="#fuer-wen"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/10 transition-colors btn-action-shine"
            >
              Als Transporteur mitbieten
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-6 text-xs text-white/60">
            <TrustItem>Kostenlos einstellen</TrustItem>
            <TrustItem>Keine versteckten Kosten</TrustItem>
            <TrustItem>Sicher vermittelt</TrustItem>
          </div>
        </div>

        <div className="anim-fade-up [animation-delay:150ms]">
          <HomeAuctionSlider />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[var(--color-surface-alt)]" />
      <HeroRegisterChoiceModal
        open={registerChoiceOpen}
        onClose={() => setRegisterChoiceOpen(false)}
      />
    </section>
  );
}

function TrustItem({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      {children}
    </span>
  );
}

function HomeAuctionSlider() {
  const [slides, setSlides] = useState<Auction[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const indexRef = useRef(0);
  const touchStartX = useRef<number | null>(null);
  const now = useNow(1000);

  const fadeMs = HOME_AUCTION_SLIDER_FADE_MS;
  const autoMs = HOME_AUCTION_SLIDER_INTERVAL_MS;

  const loadSlides = useMemo(() => {
    return async () => {
      if (!useSupabase) return;
      const liveRaw = await sbAukt.fetchHomepageSliderLiveAuctions();
      const live = liveRaw.map((a) => applyAuctionPrivacy(a, null));
      setSlides(live);
    };
  }, []);

  useEffect(() => {
    if (!useSupabase) return;
    void loadSlides();
  }, [loadSlides]);

  useEffect(() => {
    if (!useSupabase) return;
    const t = setInterval(() => void loadSlides(), 90_000);
    return () => clearInterval(t);
  }, [loadSlides]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    setIndex((i) => (slides.length === 0 ? 0 : Math.min(i, slides.length - 1)));
  }, [slides.length]);

  const goTo = useCallback(
    (next: number) => {
      if (slides.length === 0) return;
      const len = slides.length;
      const n = ((next % len) + len) % len;
      setVisible(false);
      window.setTimeout(() => {
        setIndex(n);
        requestAnimationFrame(() => setVisible(true));
      }, fadeMs);
    },
    [slides.length, fadeMs],
  );

  const goNext = useCallback(() => {
    if (slides.length === 0) return;
    goTo(indexRef.current + 1);
  }, [goTo, slides.length]);

  const goPrev = useCallback(() => {
    if (slides.length === 0) return;
    goTo(indexRef.current - 1);
  }, [goTo, slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => {
      goNext();
    }, autoMs);
    return () => clearInterval(t);
  }, [slides.length, autoMs, goNext]);

  useEffect(() => {
    if (slides.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("input, textarea, select, [contenteditable=true]"))
        return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length, goNext, goPrev]);

  const auction = slides[index];

  // Keine Live-Auktionen → ursprüngliche statische Vorschau anzeigen.
  if (!auction) {
    return <AuctionPreview />;
  }

  const remaining = auction.startedAt + auction.durationMs - now;
  const timeUp = remaining <= 0;
  const leading = getLeadingBid(auction);
  const bidRows = topThreeBidsLowestFirst(auction);
  const elapsed = timeUp ? 1 : homeSliderElapsed01(auction, now);

  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[32px] bg-gradient-to-br from-white/10 to-white/0 blur-2xl" />
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          role="region"
          aria-roledescription="Karussell"
          aria-label="Live-Auktionen"
          tabIndex={0}
          className="rounded-[22px] bg-white p-6 outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          style={{ touchAction: "pan-y" }}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchStartX.current;
            touchStartX.current = null;
            if (start == null || slides.length <= 1) return;
            const x = e.changedTouches[0]?.clientX;
            if (x == null) return;
            const d = x - start;
            if (d > 56) goPrev();
            else if (d < -56) goNext();
          }}
        >
          <div
            className="transition-opacity ease-in-out"
            style={{
              opacity: visible ? 1 : 0,
              transitionDuration: `${fadeMs}ms`,
            }}
          >
            <div className="relative flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
                  <Truck className="size-4" />
                </span>
                <div className="min-w-0 text-xs font-medium text-slate-500">
                  Auftrag #{auction.id}
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500 anim-live" />
                LIVE
              </span>
            </div>

            <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
              <span className="text-slate-500">Von</span>
              <span className="font-medium text-slate-900">
                {auction.startort}
              </span>
              <span className="text-slate-500">Nach</span>
              <span className="font-medium text-slate-900">
                {auction.zielort}
              </span>
              <span className="text-slate-500">Art</span>
              <span className="font-medium text-slate-900">
                {formatHomePreviewArtLine(auction)}
              </span>
            </div>

            <div className="mt-5 rounded-2xl bg-gradient-to-br from-[var(--color-brand-700)] to-[var(--color-brand-800)] p-5 text-white">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-white/60">
                    Aktuelles Führungsgebot
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tabular-nums">
                      {leading !== null ? `CHF ${leading}` : "—"}
                    </span>
                    {leading !== null && !timeUp && (
                      <span className="anim-bid text-xs font-semibold text-emerald-300">
                        ▼
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-white/60">
                    Endet in
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold tabular-nums">
                    {timeUp ? "00:00" : formatRemaining(Math.max(0, remaining))}
                  </div>
                </div>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-[var(--color-accent-400)] transition-all"
                  style={{ width: `${elapsed * 100}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-white/70">
                <span>
                  {auction.bids.length}{" "}
                  {auction.bids.length === 1 ? "Gebot" : "Gebote"}
                </span>
                <span>Startpreis: CHF {auction.startPrice}</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {bidRows.map((bid, i) => (
                <div
                  key={`${bid.ts}-${bid.price}-${i}`}
                  className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm"
                >
                  <GebotszeileRow
                    bid={bid}
                    timeLabel={formatRelative(bid.ts, now)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {slides.length > 1 && (
        <div
          className="mt-3 flex justify-center gap-2"
          role="tablist"
          aria-label="Auktion wählen"
        >
          {slides.map((_, i) => (
            <button
              key={_.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Auktion ${i + 1} von ${slides.length}`}
              onClick={() => {
                if (i === index) return;
                goTo(i);
              }}
              className={`size-1.5 rounded-full transition-colors ${
                i === index
                  ? "bg-slate-700"
                  : "bg-slate-400/50 hover:bg-slate-500/80"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- AUCTION PREVIEW (statische Vorschau, Fallback wenn keine Live-Auktion) ---------- */
function AuctionPreview() {
  const [price, setPrice] = useState(248);
  const [bids, setBids] = useState(7);
  const [time, setTime] = useState({ m: 12, s: 34 });

  const previewBidRows = useMemo(
    () =>
      [
        {
          key: "a",
          bid: {
            initials: "MG",
            price,
            ts: Date.now(),
            verifiziert: true,
            bewertung: 4.2,
          } satisfies Bid,
          time: "gerade eben",
        },
        {
          key: "b",
          bid: {
            initials: "SA",
            price: price + 8,
            ts: Date.now(),
            bewertung: 3.8,
          } satisfies Bid,
          time: "vor 34 s",
        },
        {
          key: "c",
          bid: {
            initials: "UR",
            price: price + 15,
            ts: Date.now(),
            bewertung: 5.0,
          } satisfies Bid,
          time: "vor 1 min",
        },
      ] as const,
    [price],
  );

  useEffect(() => {
    const t = setInterval(() => {
      setPrice((p) => Math.max(189, p - Math.floor(Math.random() * 4 + 1)));
      setBids((b) => b + 1);
    }, 2800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setTime((x) => {
        let { m, s } = x;
        s -= 1;
        if (s < 0) {
          s = 59;
          m = Math.max(0, m - 1);
        }
        return { m, s };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[32px] bg-gradient-to-br from-white/10 to-white/0 blur-2xl" />
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="rounded-[22px] bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
                <Truck className="size-4" />
              </span>
              <div className="text-xs font-medium text-slate-500">
                Auftrag #A-2846
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500 anim-live" />
              LIVE
            </span>
          </div>

          <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <span className="text-slate-500">Von</span>
            <span className="font-medium text-slate-900">Zürich HB</span>
            <span className="text-slate-500">Nach</span>
            <span className="font-medium text-slate-900">Bern, Länggasse</span>
            <span className="text-slate-500">Art</span>
            <span className="font-medium text-slate-900">
              Umzug · 2-Zimmer · 3. Stock
            </span>
          </div>

          <div className="mt-5 rounded-2xl bg-gradient-to-br from-[var(--color-brand-700)] to-[var(--color-brand-800)] p-5 text-white">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-white/60">
                  Aktuelles Führungsgebot
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tabular-nums">
                    CHF {price}
                  </span>
                  <span className="anim-bid text-xs font-semibold text-emerald-300">
                    ▼
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-white/60">
                  Endet in
                </div>
                <div className="mt-1 font-mono text-2xl font-bold tabular-nums">
                  {String(time.m).padStart(2, "0")}:
                  {String(time.s).padStart(2, "0")}
                </div>
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[var(--color-accent-400)] transition-all"
                style={{ width: `${Math.min(100, (60 - time.m) * 1.6)}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-white/70">
              <span>{bids} Gebote</span>
              <span>Startpreis: CHF 320</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {previewBidRows.map((row) => (
              <div
                key={row.key}
                className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm"
              >
                <GebotszeileRow bid={row.bid} timeLabel={row.time} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- TRUST BAR ---------- */
function TrustBar() {
  const items = [
    "Swiss Made",
    "DSG-konform",
    "Verifizierte Fahrer",
    "Sicher bezahlen",
    "24/7 Support",
  ];
  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-5 py-4 text-xs font-medium uppercase tracking-wider text-slate-500">
        {items.map((x) => (
          <span key={x} className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4 text-[var(--color-brand-500)]" />
            {x}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ---------- HOW IT WORKS ---------- */
function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Transport ausschreiben",
      text: "Start, Ziel, Art des Transports, optionale Notizen und Auktionsdauer – in unter 60 Sekunden.",
      icon: <Pencil className="size-5" />,
    },
    {
      n: "02",
      title: "Live unterboten werden",
      text: "Transporteure geben in Echtzeit Gebote ab. Du siehst den niedrigsten Preis sofort.",
      icon: <Bolt className="size-5" />,
    },
    {
      n: "03",
      title: "Gewinner beauftragen",
      text: "Nach Auktionsende wählst du den besten Anbieter und bestätigst direkt in der App.",
      icon: <Check className="size-5" />,
    },
  ];

  return (
    <section id="so-funktionierts" className="py-10">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeader
          eyebrow="So funktioniert's"
          title="In drei Schritten zum besten Preis"
          subtitle="Kein Telefonieren, kein Vergleichen. Du stellst ein – der Markt kommt zu dir."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className="group relative rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:border-[var(--color-brand-300)] hover:shadow-xl"
            >
              <div className="absolute right-6 top-6 text-xs font-bold tracking-widest text-slate-300">
                {s.n}
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-700)] ring-1 ring-[var(--color-brand-100)]">
                {s.icon}
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {s.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- AUDIENCE ---------- */
function Audience() {
  return (
    <section id="fuer-wen" className="py-10">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeader
          eyebrow="Für wen"
          title="Zwei Seiten. Ein fairer Marktplatz."
          subtitle="Ob du transportieren lassen oder transportieren willst – 321 meins bringt euch direkt zusammen."
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <FeatureCard
            variant="primary"
            tag="Für Kunden"
            icon={<User className="size-5" />}
            title="Stelle ein, lehn dich zurück, spar bares Geld."
            bullets={[
              "Start- und Zielort, Art des Transports, Notizen",
              "Auktionsdauer frei wählbar (Tage, Stunden, Minuten, Sekunden)",
              "Live den niedrigsten Preis sehen",
              "Kein Match? Du kannst deine Auktion jederzeit erneut starten",
              "Sichere Bezahlung mit QR-Code: Dein Geld wird erst nach erfolgreicher Lieferung an den Transporteur überwiesen.",
            ]}
            cta="Als Auftraggeber registrieren"
            registrationRole="auftraggeber"
          />

          <FeatureCard
            variant="secondary"
            tag="Für Transporteure"
            icon={<Truck className="size-5" />}
            title="Hol dir Aufträge – zum Preis, den du willst."
            bullets={[
              "Live-Auktion: nur niedrigere Gebote in CHF",
              "Führungsgebot und dein letztes Gebot immer im Blick",
              "Sofort-Benachrichtigung, wenn du unterboten wirst",
              "Keine Grundgebühr",
              "Sichere Lieferbestätigung per QR-Code-Scan: Die Zahlung wird automatisch ausgelöst, sobald du den QR-Code beim Empfänger gescannt hast.",
            ]}
            cta="Als Transporteur registrieren"
            registrationRole="transporteur"
          />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  variant,
  tag,
  icon,
  title,
  bullets,
  cta,
  registrationRole,
}: {
  variant: "primary" | "secondary";
  tag: string;
  icon: React.ReactNode;
  title: string;
  bullets: string[];
  cta: string;
  registrationRole: "auftraggeber" | "transporteur";
}) {
  const isPrimary = variant === "primary";
  const openSameRegistrationAsTopCta = () => {
    window.dispatchEvent(
      new CustomEvent("321meins-open-registration", {
        detail: registrationRole,
      }),
    );
    scrollToCta();
  };
  return (
    <div
      className={`group relative overflow-hidden rounded-3xl border p-8 shadow-sm transition-all hover:shadow-xl ${
        isPrimary
          ? "border-[var(--color-brand-200)] bg-gradient-to-br from-white to-[var(--color-brand-50)]"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid size-10 place-items-center rounded-xl ${
            isPrimary
              ? "bg-[var(--color-brand-700)] text-white"
              : "bg-[var(--color-accent-50)] text-[var(--color-accent-600)] ring-1 ring-[var(--color-accent-100)]"
          }`}
        >
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {tag}
        </span>
      </div>

      <h3 className="mt-5 text-2xl font-bold leading-snug text-slate-900">
        {title}
      </h3>

      <ul className="mt-6 space-y-3">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-3 text-sm text-slate-700">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--color-accent-500)] text-white">
              <Check className="size-3" />
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <button
          type="button"
          onClick={openSameRegistrationAsTopCta}
          className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all btn-action-shine ${
            isPrimary
              ? "bg-[var(--color-accent-500)] text-white shadow-sm hover:bg-[var(--color-accent-600)]"
              : "border-2 border-[var(--color-brand-700)] text-[var(--color-brand-700)] hover:bg-[var(--color-brand-700)] hover:text-white"
          }`}
        >
          {cta}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------- TESTIMONIALS ---------- */
function Testimonials() {
  const quotes = [
    {
      text: "Statt drei Tage Angebote einzuholen hatte ich in 20 Minuten den besten Preis – 38 % unter meinem ersten Voranschlag.",
      firstName: "Sandra",
      lastNameInitial: "M",
      rating: 5,
    },
    {
      text: "Als kleine Speditionsfirma bekommen wir endlich planbare Aufträge, ohne auf Vergleichsportalen zu verlieren.",
      firstName: "Marco",
      lastNameInitial: "R",
      rating: 5,
    },
    {
      text: "Transparent, fair und richtig schnell. Ich habe meinen Klaviertransport zum Fixpreis bekommen – inklusive Versicherung.",
      firstName: "Elena",
      lastNameInitial: "K",
      rating: 5,
    },
  ];
  return (
    <section id="stimmen-community" className="py-10">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeader
          eyebrow="Stimmen aus der Community"
          title="Kunden und Transporteure, die uns vertrauen"
          subtitle="Über 4'000 abgeschlossene Auktionen – hier sind ein paar Stimmen."
        />

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {quotes.map((q) => {
            const displayName = `${q.firstName} ${q.lastNameInitial}.`;
            const initials =
              `${q.firstName[0] ?? ""}${q.lastNameInitial}`.toUpperCase();
            return (
              <figure
                key={displayName}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex gap-0.5 text-[var(--color-accent-500)]">
                  {Array.from({ length: q.rating }).map((_, i) => (
                    <Star key={i} className="size-4" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">
                  „{q.text}"
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-5">
                  <span className="grid size-10 place-items-center rounded-full bg-[var(--color-brand-700)] text-sm font-bold text-white">
                    {initials}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {displayName}
                    </div>
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- LANDING MID CTA (zwischen Stats & FAQ) ---------- */
function LandingMidRegisterCta() {
  const openRegistration = (role: "auftraggeber" | "transporteur") => {
    window.dispatchEvent(
      new CustomEvent("321meins-open-registration", { detail: role }),
    );
    scrollToCta();
  };

  return (
    <section className="border-y border-slate-200 bg-white py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-5 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
          Bereit, selbst zu sparen?
        </h2>
        <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">
          Stell deinen Transport jetzt ein – die ersten Gebote kommen meist
          innerhalb weniger Minuten.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => openRegistration("auftraggeber")}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent-500)] px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 transition-colors hover:bg-[var(--color-accent-600)] btn-action-shine"
          >
            Als Auftraggeber starten
            <ArrowRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => openRegistration("transporteur")}
            className="btn-action-shine inline-flex items-center justify-center gap-2 rounded-full border-2 border-white bg-black px-6 py-4 text-sm font-semibold text-white transition-colors hover:bg-slate-950"
          >
            Als Transporteur starten
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------- STATS ---------- */
function Stats() {
  const stats = [
    { k: "Ø 34%", v: "sparen" },
    { k: "<3 Min.", v: "Bis zum ersten Gebot" },
    { k: "4.8/5", v: "Basierend auf 127 Bewertungen" },
  ];
  return (
    <section id="zahlen" className="relative overflow-hidden py-24">
      <div className="absolute inset-0 -z-10 bg-[var(--color-brand-700)]" />
      <div className="absolute inset-0 -z-10 bg-grid opacity-30 mask-fade-b" />
      <div className="relative z-10 mx-auto max-w-6xl px-5">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {stats.map((s) => (
            <div key={s.v} className="text-center">
              <div className="text-5xl font-extrabold tracking-tight text-[var(--color-accent-500)] md:text-6xl">
                {s.k}
              </div>
              <div className="mx-auto mt-3 max-w-[18rem] px-2 text-center text-base font-normal leading-relaxed !text-slate-400 md:mt-4 md:max-w-[20rem] md:text-lg">
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */
const FAQ_AUFTRAGGEBER = [
  {
    q: "Wie funktioniert eine Transport-Auktion?",
    a: "Du stellst deinen Transport mit Start- und Zieladresse, Abhol- und Lieferdatum sowie optionalen Notizen und Bildern ein. Transporteure geben live Gebote ab und unterbieten sich gegenseitig. Du siehst den niedrigsten Preis in Echtzeit.",
  },
  {
    q: "Was kostet die Nutzung von 321 meins?",
    a: "Das Einstellen eines Transports und die Auktion sind für dich als Auftraggeber komplett kostenlos. Du zahlst nur den Preis des Gebots, das du am Ende akzeptierst. Keine versteckten Gebühren.",
  },
  {
    q: "Wie schnell bekomme ich Gebote?",
    a: "In der Regel trifft das erste Gebot innerhalb von wenigen Minuten ein. Die meisten Auktionen haben nach 10–15 Minuten mehrere Gebote.",
  },
  {
    q: "Sehe ich, wer transportiert?",
    a: "Während der Auktion sind Transporteure anonym (nur als Kürzel sichtbar). Du siehst aber ihre Sterne-Bewertung und ob sie verifiziert sind (V). Erst nachdem du den Auftrag erteilt hast, erhältst du die vollen Kontaktdaten des Transporteurs.",
  },
  {
    q: "Kann ich ein Gebot ablehnen?",
    a: "Ja, nach Auktionsende siehst du das tiefste Gebot und kannst entscheiden, ob du den Preis akzeptierst oder ablehnst. Lehnst du ab, kannst du die Auktion nach 60 Minuten erneut starten.",
  },
  {
    q: "Wie läuft die Bezahlung ab?",
    a: "Nachdem du den Auftrag erteilst, wirst du zur sicheren Bezahlung über Stripe weitergeleitet. Du kannst per TWINT, Kreditkarte oder Apple/Google Pay bezahlen. Der Betrag wird reserviert, aber erst nach erfolgreicher Lieferung an den Transporteur ausgezahlt.",
  },
  {
    q: "Was ist der QR-Code und wie funktioniert er?",
    a: "Nach deiner Bezahlung erhältst du einen einmaligen QR-Code. Leite diesen an den Empfänger der Ware weiter. Der Transporteur scannt den QR-Code bei der Übergabe mit seinem Handy – das bestätigt die erfolgreiche Lieferung und löst die Zahlung aus.",
  },
  {
    q: "Wie kontaktiere ich den Transporteur?",
    a: "Nach der Auftragserteilung siehst du die vollständigen Kontaktdaten des Transporteurs (Name, Telefon, E-Mail). Du kannst ihn direkt über die angezeigten Daten erreichen.",
  },
  {
    q: "Was passiert, wenn keine Gebote eingehen?",
    a: "Du kannst deine Auktion jederzeit erneut starten. Du behältst die volle Kontrolle.",
  },
  {
    q: "Wie sicher ist 321 meins?",
    a: "Deine Sicherheit hat für uns höchste Priorität. 321 meins ist komplett DSG-konform, alle Daten werden verschlüsselt in der Schweiz gehostet. Zahlungen laufen ausschliesslich über unseren zertifizierten Partner Stripe – weder wir noch Dritte haben Zugriff auf deine Zahlungsdaten. Für Auftraggeber: Dein Geld wird bei Auftragserteilung sicher bei Stripe hinterlegt, aber erst dann an den Transporteur überwiesen, wenn die Lieferung beim Empfänger angekommen ist – bestätigt durch den Scan des QR-Codes. Transporteure werden zudem vor der Freischaltung manuell geprüft (Versicherungsnachweis, UID-Nummer). Für Transporteure: Das Geld des Auftraggebers liegt nach der Auftragserteilung sicher bei Stripe bereit. Sobald du den QR-Code beim Empfänger gescannt hast, wird die Zahlung automatisch an dich ausgelöst. Transparent. Fair. Sicher – für beide Seiten.",
  },
  {
    q: "Wer haftet, wenn beim Transport etwas beschädigt wird oder der Transporteur nicht erscheint?",
    a: "Der Transportvertrag kommt direkt zwischen dir und dem Transporteur zustande. 321 meins stellt ausschliesslich die Plattform zur Vermittlung bereit und übernimmt keinerlei Haftung für Schäden, Verlust, Verspätung oder das Nichterscheinen des Transporteurs. Die Haftung liegt beim Transporteur, der vor der Freischaltung einen gültigen Versicherungsnachweis vorweisen muss. Erscheint ein Transporteur nicht zur Abholung, greift unsere QR-Code-Sicherung: Da dein Geld erst nach erfolgreicher Lieferung und Scan des QR-Codes überwiesen wird, entsteht dir kein finanzieller Schaden. Du kannst die Auktion danach erneut starten. Nach erfolgreicher Zahlung erhältst du eine Auftragsbestätigung als PDF mit allen relevanten Daten – als Nachweis für deine Unterlagen. Details regeln unsere AGB.",
  },
] as const;

const FAQ_TRANSPORTEURE = [
  {
    q: "Was kostet die Teilnahme?",
    a: "Die Registrierung ist kostenlos. Es gibt keine Grundgebühr. Du zahlst nur eine kleine Provision, wenn du einen Auftrag gewinnst.",
  },
  {
    q: "Kann ich als Einzelfahrer mitmachen?",
    a: "Ja, 321 meins richtet sich an alle – vom Einzelfahrer mit Lieferwagen bis zur Speditionsfirma. Du brauchst eine UID-Nummer und einen gültigen Versicherungsnachweis.",
  },
  {
    q: "Wie funktioniert das Bieten?",
    a: "Es gilt das Prinzip der Holländischen Auktion: Du unterbietest den aktuell tiefsten Preis. Nur Gebote unter dem Führungsgebot werden angenommen. Dein Kürzel bleibt anonym, deine Sterne-Bewertung und das Verifizierungs-Symbol (V) sind sichtbar.",
  },
  {
    q: "Was passiert, wenn ich überboten werde?",
    a: "Du erhältst sofort eine Benachrichtigung und kannst direkt ein neues, tieferes Gebot abgeben, solange die Auktion noch läuft.",
  },
  {
    q: "Was bedeutet das V-Symbol?",
    a: "Das V zeigt an, dass ein Transporteur offiziell verifiziert ist. Wir haben seinen Versicherungsnachweis und seine UID-Nummer manuell geprüft. Verifizierte Transporteure geniessen mehr Vertrauen bei Auftraggebern.",
  },
  {
    q: "Wie erhalte ich mein Geld?",
    a: "Nachdem du die Lieferung per QR-Code-Scan bestätigt hast, wird die Zahlung ausgelöst. Das Geld wird automatisch auf dein hinterlegtes Bankkonto überwiesen. Die Auszahlung erfolgt innert weniger Werktage.",
  },
  {
    q: "Wie bestätige ich eine erfolgreiche Lieferung?",
    a: "Bei der Übergabe scannst du mit deinem Handy den QR-Code, den dir der Empfänger zeigt. Der Scan bestätigt die Lieferung und löst automatisch die Zahlung an dich aus.",
  },
  {
    q: "Sehe ich die Kontaktdaten des Auftraggebers?",
    a: "Ja, sobald der Auftraggeber dir den Auftrag erteilt hat, siehst du alle Kontaktdaten des Absenders und des Empfängers in deiner Auftrags-Detailansicht.",
  },
  {
    q: "Wie sicher ist 321 meins?",
    a: "Deine Sicherheit hat für uns höchste Priorität. 321 meins ist komplett DSG-konform, alle Daten werden verschlüsselt in der Schweiz gehostet. Zahlungen laufen ausschliesslich über unseren zertifizierten Partner Stripe – weder wir noch Dritte haben Zugriff auf deine Zahlungsdaten. Für Auftraggeber: Dein Geld wird bei Auftragserteilung sicher bei Stripe hinterlegt, aber erst dann an den Transporteur überwiesen, wenn die Lieferung beim Empfänger angekommen ist – bestätigt durch den Scan des QR-Codes. Transporteure werden zudem vor der Freischaltung manuell geprüft (Versicherungsnachweis, UID-Nummer). Für Transporteure: Das Geld des Auftraggebers liegt nach der Auftragserteilung sicher bei Stripe bereit. Sobald du den QR-Code beim Empfänger gescannt hast, wird die Zahlung automatisch an dich ausgelöst. Transparent. Fair. Sicher – für beide Seiten.",
  },
  {
    q: "Was passiert, wenn der Auftraggeber nicht vor Ort ist oder die Ware nicht bereitstellt?",
    a: "Der Transportvertrag kommt direkt zwischen dir und dem Auftraggeber zustande. Vor Fahrtantritt hast du Zugriff auf die vollständigen Kontaktdaten des Absenders – inklusive Adresse, Telefonnummer und E-Mail. Wir empfehlen, vor der Abfahrt kurz Kontakt aufzunehmen, um die Übergabe zu bestätigen. Erscheint der Auftraggeber nicht oder ist die Ware nicht bereit, kannst du den Auftrag nicht abschliessen, und es wird keine Zahlung ausgelöst (QR-Code-Sicherung). 321 meins haftet nicht für entstandene Leerfahrten, Ausfälle oder sonstige Schäden, die aus dem Verhalten des Auftraggebers entstehen. Nach erfolgreicher Auftragserteilung erhältst du eine Transportbestätigung als PDF mit allen relevanten Daten – als Nachweis für deine Unterlagen. Details regeln unsere AGB.",
  },
] as const;

const FAQ_SUPPORT = {
  q: "Wie kontaktiere ich den Support?",
  a: "Unser Support ist per E-Mail unter support@321-meins.ch erreichbar. Wir antworten innert 24 Stunden.",
} as const;

function FAQCategoryTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="btn-action-shine relative my-5 flex w-full items-center bg-[#333333] px-6 py-4 shadow-sm first:mt-0 md:my-6 md:py-5"
    >
      <h3 className="relative z-[1] text-[1.0625rem] font-extrabold uppercase tracking-wide text-white md:text-lg">
        {children}
      </h3>
    </div>
  );
}

function FAQ() {
  return (
    <section id="faq" className="py-10">
      <div className="mx-auto max-w-3xl px-5">
        <SectionHeader
          eyebrow="FAQ"
          title="Häufig gefragt"
          subtitle="Alles Wichtige auf einen Blick."
          align="center"
        />
        <div className="mt-8 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <FAQCategoryTitle>FÜR AUFTRAGGEBER</FAQCategoryTitle>
          {FAQ_AUFTRAGGEBER.map((item, i) => (
            <FAQItem
              key={item.q}
              q={item.q}
              a={item.a}
              defaultOpen={i === 0}
            />
          ))}
          <FAQCategoryTitle>FÜR TRANSPORTEURE</FAQCategoryTitle>
          {FAQ_TRANSPORTEURE.map((item) => (
            <FAQItem key={item.q} q={item.q} a={item.a} />
          ))}
          <FAQItem q={FAQ_SUPPORT.q} a={FAQ_SUPPORT.a} />
        </div>
      </div>
    </section>
  );
}

function FAQItem({
  q,
  a,
  defaultOpen,
}: {
  q: string;
  a: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="font-semibold text-slate-900">{q}</span>
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-600 transition-transform ${
            open ? "rotate-45" : ""
          }`}
          aria-hidden
        >
          <Plus className="size-3.5" />
        </span>
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-5 text-sm leading-relaxed text-slate-600">
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- CTA ---------- */
function CTA() {
  const { user, view, goHome, goToAuctionForm } = useAuth();
  const [guestForm, setGuestForm] = useState<
    "auftraggeber" | "transporteur" | null
  >(null);

  useEffect(() => {
    const onOpenReg = (e: Event) => {
      const ce = e as CustomEvent<"auftraggeber" | "transporteur">;
      const d = ce.detail;
      if (d !== "auftraggeber" && d !== "transporteur") return;
      setGuestForm(d);
    };
    window.addEventListener(
      "321meins-open-registration",
      onOpenReg as EventListener,
    );
    return () =>
      window.removeEventListener(
        "321meins-open-registration",
        onOpenReg as EventListener,
      );
  }, []);

  return (
    <section id="cta" className="pt-10">
      <div className="mx-auto max-w-5xl px-5">
        <div className="mb-10">
          {user?.role === "transporteur" ? (
            <TransporterDashboard />
          ) : (
            <>
              <div className="relative overflow-hidden rounded-3xl bg-[var(--color-brand-800)] p-10 md:p-14">
                <div className="absolute -right-24 -top-24 size-80 rounded-full bg-[var(--color-accent-500)]/30 blur-3xl" />
                <div className="absolute -left-16 -bottom-16 size-64 rounded-full bg-[var(--color-brand-500)]/30 blur-3xl" />
                <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
                  <div>
                    <h2 className="text-3xl font-extrabold leading-tight text-white md:text-4xl">
                      Bereit, bares Geld zu sparen?
                    </h2>
                    <p className="mt-3 max-w-xl text-white/70">
                      Stell deinen Transport jetzt ein – die ersten Gebote
                      kommen meist innerhalb weniger Minuten.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setGuestForm("auftraggeber")}
                      aria-expanded={guestForm === "auftraggeber"}
                      aria-controls="auftraggeber-registrierung"
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent-500)] px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 hover:bg-[var(--color-accent-600)] transition-colors btn-action-shine"
                    >
                      Als Auftraggeber kostenlos registrieren
                      <ArrowRight className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGuestForm("transporteur")}
                      aria-expanded={guestForm === "transporteur"}
                      aria-controls="transporteur-registrierung"
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-4 text-sm font-semibold text-white backdrop-blur hover:bg-white/10 transition-colors btn-action-shine"
                    >
                      Als Transporteur registrieren
                    </button>
                  </div>
                </div>
              </div>

              {user && user.role === "auftraggeber" ? (
                <>
                  {view === "home" && (
                    <AuthenticatedCTA
                      username={user.username}
                      onStart={() => goToAuctionForm()}
                    />
                  )}
                  {view === "auction-form" && (
                    <AuctionForm onCancel={goHome} />
                  )}
                  {view === "meine-auktionen" && <MyAuctionsList />}
                  {view === "auction-detail" && <AuctionDetail />}
                </>
              ) : !user ? (
                <>
                  {guestForm === "auftraggeber" && <RegistrationForm />}
                  {guestForm === "transporteur" && (
                    <TransporteurRegistrationForm />
                  )}
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- TRANSPORTEUR DASHBOARD ---------- */
function TransporterDashboard() {
  const {
    user,
    auctions,
    placeTransporterBid,
    transporterBidFocusId,
    setTransporterBidFocus,
    refreshAuctions,
    markAuctionDeliveredMock,
    refreshPendingDeliveryRatings,
  } = useAuth();
  const now = useNow(250);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [bidOpenId, setBidOpenId] = useState<string | null>(null);
  const [bidInput, setBidInput] = useState<Record<string, string>>({});
  const [bidError, setBidError] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!transporterBidFocusId) return;
    const row = auctions.find((x) => x.id === transporterBidFocusId);
    const rowKey = row?.auctionUuid ?? transporterBidFocusId;
    setExpandedIds((s) => new Set(s).add(rowKey));
    setBidOpenId(rowKey);
    setTransporterBidFocus(null);
  }, [transporterBidFocusId, setTransporterBidFocus, auctions]);

  const toggleRow = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeAuctions = auctions
    .filter((a) => isAuctionLive(a, now))
    .sort((a, b) => a.startedAt - b.startedAt);

  const expiredAuctions = auctions
    .filter((a) => {
      const end = a.startedAt + a.durationMs;
      if (now < end) return false;
      if (isAuctionEndedRecently(a, now)) return true;
      if (user?.role === "transporteur" && transporteurHatZuschlag(a, user)) {
        const refMs = a.awardedAt ?? end;
        if (now - refMs < 14 * 24 * 60 * 60 * 1000) return true;
      }
      return false;
    })
    .sort((a, b) => b.startedAt + b.durationMs - (a.startedAt + a.durationMs));

  const myBidAuctions = auctions
    .filter(
      (a) =>
        user &&
        transporterHatGebot(a, user.username) &&
        isAuctionLive(a, now),
    )
    .sort((a, b) => b.startedAt - a.startedAt);

  const tableHeader = (
    <thead>
      <tr className="border-b border-slate-200 bg-[var(--color-brand-50)] text-[11px] font-bold uppercase tracking-wider text-slate-600">
        <th className="px-3 py-2.5">Auftrag</th>
        <th className="px-3 py-2.5">Von</th>
        <th className="px-3 py-2.5">Nach</th>
        <th className="px-3 py-2.5">Lieferdatum</th>
        <th className="px-3 py-2.5">Masse/Gew.</th>
        <th className="px-3 py-2.5">Führungsg.</th>
        <th className="px-3 py-2.5">Gebote</th>
        <th className="px-3 py-2.5">Endet in</th>
        <th className="px-3 py-2.5 text-right">Status</th>
      </tr>
    </thead>
  );

  const renderExpandableBlock = (
    a: Auction,
    opts: { showCountdown: boolean; actionMode: "bid" | "ended" | "status" },
  ) => {
    const rowKey = a.auctionUuid ?? a.id;
    const expanded = expandedIds.has(rowKey);
    const cap = getBidCap(a);
    const leader = getLowestBid(a);
    const remaining = a.startedAt + a.durationMs - now;
    const sortedBids = [...a.bids].sort((x, y) => y.ts - x.ts);
    const hideSensitiveEndedExpand =
      opts.actionMode === "ended" &&
      user?.role === "transporteur" &&
      !transporteurHatZuschlag(a, user);

    return (
      <>
        <tr
          key={rowKey}
          role="button"
          tabIndex={0}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("[data-no-row-toggle]"))
              return;
            toggleRow(rowKey);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleRow(rowKey);
            }
          }}
          className={`cursor-pointer border-b border-slate-100 text-sm transition-colors hover:bg-slate-50/80 ${
            expanded ? "bg-slate-50/50" : ""
          }`}
        >
          <td className="px-3 py-2.5 font-semibold text-slate-900">
            #{a.id}
          </td>
          <td className="px-3 py-2.5 text-slate-700">{displayOrt(a.startort)}</td>
          <td className="px-3 py-2.5 text-slate-700">{displayOrt(a.zielort)}</td>
          <td className="px-3 py-2.5 text-slate-600">
            {formatLieferanzeige(a)}
          </td>
          <td className="max-w-[140px] truncate px-3 py-2.5 text-xs text-slate-600">
            {formatMassGewicht(a)}
          </td>
          <td className="px-3 py-2.5">
            <span className="font-semibold tabular-nums text-slate-900">
              CHF {cap}
            </span>
            <span className="text-slate-400"> · </span>
            <span className="font-bold text-slate-700">
              {leader ? (
                <FahrerInfoBlock
                  initials={leader.initials}
                  verifiziert={leader.verifiziert}
                  bewertung={leader.bewertung}
                  initialsClassName="font-bold text-slate-700"
                />
              ) : (
                "—"
              )}
            </span>
          </td>
          <td className="px-3 py-2.5 tabular-nums text-slate-700">
            {a.bids.length}
          </td>
          <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-slate-800">
            {opts.showCountdown ? formatCountdownHms(remaining) : "—"}
          </td>
          <td className="px-3 py-2.5 text-right">
            {opts.actionMode === "bid" && (
              <button
                type="button"
                data-no-row-toggle
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedIds((s) => new Set(s).add(rowKey));
                  setBidOpenId(rowKey);
                  setBidError((be) => ({ ...be, [rowKey]: null }));
                }}
                className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[var(--color-accent-500)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-accent-600)] btn-action-shine"
              >
                Jetzt bieten
              </button>
            )}
            {opts.actionMode === "ended" && (
              <>
                {user && transporteurHatZuschlag(a, user) ? (
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                        a.auctionStatus === "bezahlt" ||
                        a.auctionStatus === "geliefert"
                          ? "bg-slate-100 text-slate-700"
                          : a.auctionStatus === "pending_payment"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          a.auctionStatus === "bezahlt" ||
                          a.auctionStatus === "geliefert"
                            ? "bg-slate-400"
                            : a.auctionStatus === "pending_payment"
                              ? "bg-slate-400"
                              : "bg-emerald-500"
                        }`}
                      />
                      {a.auctionStatus === "pending_payment"
                        ? "Wartet auf Zahlung"
                        : a.auctionStatus === "bezahlt"
                          ? "Bezahlt"
                          : a.auctionStatus === "geliefert"
                            ? "Geliefert"
                            : "AUFTRAG ERHALTEN"}
                    </span>
                    <button
                      type="button"
                      data-no-row-toggle
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRow(rowKey);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:border-[var(--color-brand-300)] hover:text-[var(--color-brand-700)]"
                    >
                      Details anzeigen
                      <ArrowRight className="size-3" />
                    </button>
                  </div>
                ) : user && transporterHatGebot(a, user.username) ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                    <span className="size-1.5 rounded-full bg-slate-400" />
                    Beendet
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                    <span className="size-1.5 rounded-full bg-slate-300" />
                    Beendet
                  </span>
                )}
              </>
            )}
            {opts.actionMode === "status" && user && (
              <TransporterMyBidStatusCell
                auction={a}
                username={user.username}
                onRebid={() => {
                  setTransporterBidFocus(a.id);
                  requestAnimationFrame(() => {
                    document
                      .getElementById("transporter-aktive-auktionen")
                      ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                  });
                }}
              />
            )}
          </td>
        </tr>
        {expanded && (
          <tr key={`${rowKey}-ex`} className="border-b border-slate-100 bg-white">
            <td colSpan={9} className="px-4 py-4">
              {a.notizen?.trim() && opts.actionMode !== "ended" && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Notizen
                  </span>
                  <p className="mt-1 whitespace-pre-wrap">{a.notizen}</p>
                </div>
              )}
              {a.imageDataUrls &&
                a.imageDataUrls.length > 0 &&
                !hideSensitiveEndedExpand && (
                <div className="mt-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Bilder
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.imageDataUrls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200"
                      />
                    ))}
                  </div>
                </div>
              )}
              {user &&
                transporteurHatZuschlag(a, user) &&
                auctionHatAdressSnapshot(a) &&
                opts.actionMode !== "ended" && (
                  <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-3 text-sm text-slate-800">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                      Adressen (nach Auftragserteilung)
                    </div>
                    <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                      <AuktionsPrivatAdressen auction={a} />
                    </div>
                  </div>
                )}
              {opts.actionMode === "ended" &&
                user &&
                transporteurHatZuschlag(a, user) && (
                  <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-3 text-sm text-slate-800">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                      Kontakt & Auftrag
                    </div>
                    <div className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                      <div className="min-w-0 flex-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                        <AuktionsPrivatAdressen auction={a} vollstaendig />
                      </div>
                      {a.auctionStatus !== "pending_payment" && (
                        <div className="shrink-0 sm:max-w-[13.5rem] sm:border-l sm:border-emerald-200/80 sm:pl-6">
                          <TransporterLieferungScanBlock
                            auction={a}
                            rowKey={rowKey}
                            refreshAuctions={refreshAuctions}
                            useSupabase={useSupabase}
                            markAuctionDeliveredMock={markAuctionDeliveredMock}
                            onAfterDeliveryConfirmed={() =>
                              void refreshPendingDeliveryRatings()
                            }
                          />
                        </div>
                      )}
                    </div>
                    <div className="mt-3 border-t border-emerald-100 pt-3 space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Auftragsdetails
                      </div>
                      {a.notizen?.trim() && (
                        <div>
                          <span className="text-xs font-medium text-slate-500">
                            Notizen
                          </span>
                          <p className="mt-0.5 whitespace-pre-wrap text-slate-900">
                            {a.notizen}
                          </p>
                        </div>
                      )}
                      <div className="grid gap-1 text-sm">
                        <div>
                          <span className="text-slate-500">
                            Gewünschtes Abholdatum:{" "}
                          </span>
                          <span className="font-medium text-slate-900">
                            {formatDatumDe(a.abholdatum)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">
                            Gewünschtes Lieferdatum:{" "}
                          </span>
                          <span className="font-medium text-slate-900">
                            {formatDatumDe(a.lieferdatum)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              <div className="mt-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Live-Gebote
                </span>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
                  {sortedBids.length === 0 ? (
                    <li className="text-slate-500">Noch keine Gebote.</li>
                  ) : (
                    sortedBids.slice(0, 12).map((b, i) => (
                      <li
                        key={`${b.ts}-${i}`}
                        className="min-w-0 rounded-lg bg-slate-50 px-2 py-1"
                      >
                        <GebotszeileRow
                          bid={b}
                          timeLabel={formatRelative(b.ts, now)}
                        />
                      </li>
                    ))
                  )}
                </ul>
              </div>
              {opts.actionMode === "bid" && bidOpenId === rowKey && (
                <div
                  className="mt-4 rounded-2xl border border-slate-200 bg-[var(--color-surface-alt)] p-4"
                  data-no-row-toggle
                  onClick={(e) => e.stopPropagation()}
                >
                  <label className="block text-sm font-semibold text-slate-800">
                    Dein Gebot (CHF)
                  </label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={bidInput[rowKey] ?? ""}
                      onChange={(e) => {
                        setBidInput((p) => ({
                          ...p,
                          [rowKey]: e.target.value,
                        }));
                        setBidError((be) => ({ ...be, [rowKey]: null }));
                      }}
                      placeholder={`Unter ${cap}`}
                      className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums outline-none focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-500)]/20"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void (async () => {
                          const raw = bidInput[rowKey]?.trim() ?? "";
                          const num = Number(raw);
                          if (!Number.isFinite(num) || num >= cap) {
                            setBidError((be) => ({
                              ...be,
                              [rowKey]: `Dein Gebot muss unter CHF ${cap} liegen.`,
                            }));
                            return;
                          }
                          const err = await placeTransporterBid(a.id, num);
                          if (err) {
                            setBidError((be) => ({ ...be, [rowKey]: err }));
                            return;
                          }
                          setBidInput((p) => ({ ...p, [rowKey]: "" }));
                          setBidError((be) => ({ ...be, [rowKey]: null }));
                          setBidOpenId(null);
                        })();
                      }}
                      className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand-700)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-800)] btn-action-shine"
                    >
                      Gebot abgeben
                    </button>
                  </div>
                  {bidError[rowKey] && (
                    <p className="mt-2 text-sm font-medium text-red-600">
                      {bidError[rowKey]}
                    </p>
                  )}
                </div>
              )}
            </td>
          </tr>
        )}
      </>
    );
  };

  return (
    <div
      id="transporteur-dashboard"
      className="mt-0 space-y-10 anim-fade-up md:mt-2"
    >
      <div className="rounded-3xl border border-[var(--color-brand-100)] bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-3xl">
              Transporteur-Dashboard
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Aktive Auktionen, kürzlich beendete Aufträge und deine Gebote –
              alles auf einen Blick.
            </p>
          </div>
          {user?.initials && (
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--color-brand-50)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-800)] ring-1 ring-[var(--color-brand-100)]">
              Öffentliches Kürzel:{" "}
              <span className="font-mono text-sm">{user.initials}</span>
            </span>
          )}
        </div>

        <div className="mt-8" id="transporter-aktive-auktionen">
          <h3 className="text-lg font-bold text-slate-900">
            Verfügbare aktive Auktionen
          </h3>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[920px] border-collapse">
              {tableHeader}
              <tbody>
                {activeAuctions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      Zurzeit keine aktiven Auktionen.
                    </td>
                  </tr>
                ) : (
                  activeAuctions.map((a) => (
                    <Fragment key={a.auctionUuid ?? a.id}>
                      {renderExpandableBlock(a, {
                        showCountdown: true,
                        actionMode: "bid",
                      })}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-10">
          <h3 className="text-lg font-bold text-slate-900">
            Abgelaufene Auktionen (letzte 24 Stunden)
          </h3>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[920px] border-collapse">
              {tableHeader}
              <tbody>
                {expiredAuctions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      Keine abgelaufenen Auktionen in den letzten 24 Stunden.
                    </td>
                  </tr>
                ) : (
                  expiredAuctions.map((a) => (
                    <Fragment key={a.auctionUuid ?? a.id}>
                      {renderExpandableBlock(a, {
                        showCountdown: false,
                        actionMode: "ended",
                      })}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-10">
          <h3 className="text-lg font-bold text-slate-900">Meine Gebote</h3>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[920px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-[var(--color-brand-50)] text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="px-3 py-2.5">Auftrag</th>
                  <th className="px-3 py-2.5">Von</th>
                  <th className="px-3 py-2.5">Nach</th>
                  <th className="px-3 py-2.5">Lieferdatum</th>
                  <th className="px-3 py-2.5">Masse/Gew.</th>
                  <th className="px-3 py-2.5">Führungsg.</th>
                  <th className="px-3 py-2.5">Gebote</th>
                  <th className="px-3 py-2.5">Endet in</th>
                  <th className="px-3 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {myBidAuctions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      Du hast noch auf keine Auktion geboten.
                    </td>
                  </tr>
                ) : (
                  myBidAuctions.map((a) => (
                    <Fragment key={a.auctionUuid ?? a.id}>
                      {renderExpandableBlock(a, {
                        showCountdown: isAuctionLive(a, now),
                        actionMode: "status",
                      })}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransporterMyBidStatusCell({
  auction,
  username,
  onRebid,
}: {
  auction: Auction;
  username: string;
  onRebid: () => void;
}) {
  const now = useNow(1000);
  const leader = getLowestBid(auction);
  const leading = Boolean(leader && leader.bidderKey === username);
  const isLive = isAuctionLive(auction, now);

  if (leading) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Führend
      </span>
    );
  }

  if (!isLive) {
    return null;
  }

  return (
    <button
      type="button"
      data-no-row-toggle
      onClick={(e) => {
        e.stopPropagation();
        onRebid();
      }}
      className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[var(--color-accent-500)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-accent-600)] btn-action-shine"
    >
      Bieten
    </button>
  );
}

/* ---------- AUTHENTICATED CTA ---------- */
function AuthenticatedCTA({
  username,
  onStart,
}: {
  username: string;
  onStart: () => void;
}) {
  return (
    <div
      id="auftraggeber-cta"
      className="mt-8 overflow-hidden rounded-3xl border border-[var(--color-brand-100)] bg-white p-7 shadow-sm md:p-10 anim-fade-up"
    >
      <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-50)] px-3 py-1 text-xs font-semibold text-[var(--color-accent-700)]">
            <span className="size-1.5 rounded-full bg-[var(--color-accent-500)]" />
            Eingeloggt als {username}
          </span>
          <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-3xl">
            Bereit für den nächsten Transport?
          </h3>
          <p className="mt-2 max-w-xl text-sm text-[var(--color-muted)]">
            Stell deine Auktion in unter einer Minute ein – Transporteure
            unterbieten sich live.
          </p>
        </div>
        <button
          type="button"
          onClick={onStart}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--color-accent-500)] px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 hover:bg-[var(--color-accent-600)] transition-colors btn-action-shine"
        >
          Transport ausschreiben
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------- REGISTRATION FORM ---------- */
type FormState = {
  vorname: string;
  nachname: string;
  strasse: string;
  plz: string;
  ort: string;
  telefon: string;
  email: string;
  benutzername: string;
  passwort: string;
  passwortWiederholen: string;
  agb: boolean;
  datenschutz: boolean;
};

const initialForm: FormState = {
  vorname: "",
  nachname: "",
  strasse: "",
  plz: "",
  ort: "",
  telefon: "",
  email: "",
  benutzername: "",
  passwort: "",
  passwortWiederholen: "",
  agb: false,
  datenschutz: false,
};

function RegistrationLegalModal({
  kind,
  onClose,
}: {
  kind: "agb" | "datenschutz" | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!kind) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind, onClose]);

  if (!kind) return null;

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={
          kind === "agb"
            ? "Allgemeine Geschäftsbedingungen"
            : "Datenschutzerklärung"
        }
        className="flex max-h-[min(85vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-end border-b border-slate-200 bg-white px-2 py-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-xl text-2xl leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Schliessen"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-7">
          {kind === "agb" ? <AgbLegalBody /> : <DatenschutzLegalBody />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RegistrationForm() {
  const { login } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [legalModalKind, setLegalModalKind] = useState<
    "agb" | "datenschutz" | null
  >(null);

  const update = (name: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (submitError) setSubmitError(false);
    if (apiError) setApiError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, boolean> = {};

    const requiredText: (keyof FormState)[] = [
      "vorname",
      "nachname",
      "strasse",
      "plz",
      "ort",
      "telefon",
      "email",
      "benutzername",
      "passwort",
      "passwortWiederholen",
    ];
    requiredText.forEach((k) => {
      const v = form[k];
      if (typeof v === "string" && !v.trim()) newErrors[k] = true;
    });

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (form.email.trim() && !emailRe.test(form.email.trim())) {
      newErrors.email = true;
    }

    if (
      form.passwort &&
      form.passwortWiederholen &&
      form.passwort !== form.passwortWiederholen
    ) {
      newErrors.passwort = true;
      newErrors.passwortWiederholen = true;
    }

    if (!form.agb) newErrors.agb = true;
    if (!form.datenschutz) newErrors.datenschutz = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitError(true);
      return;
    }

    setErrors({});
    setSubmitError(false);
    setApiError(null);

    if (useSupabase && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.passwort,
        options: {
          data: {
            app_role: "auftraggeber",
            vorname: form.vorname.trim(),
            name: form.nachname.trim(),
            strasse: form.strasse.trim(),
            plz: form.plz.trim(),
            ort: form.ort.trim(),
            telefon: form.telefon.trim(),
            benutzername: form.benutzername.trim(),
          },
        },
      });
      if (error) {
        setApiError(error.message);
        return;
      }
      const session =
        data.session ?? (await supabase.auth.getSession()).data.session;
      if (session) {
        const au = await loadAuthUserFromSession(session.user);
        if (au) {
          login({
            username: au.username,
            role: "auftraggeber",
            userId: au.userId,
            email: au.email,
          });
        }
      }
      return;
    }

    login({ username: form.benutzername.trim(), role: "auftraggeber" });
  };

  return (
    <>
    <form
      id="auftraggeber-registrierung"
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-10 anim-fade-up"
    >
      <h3 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
        Konto als Auftraggeber erstellen
      </h3>
      <p className="mt-2 text-sm text-slate-600">
        Kostenlos und in unter zwei Minuten – ohne versteckte Kosten.
      </p>

      <div className="mt-7 grid gap-5 md:grid-cols-2">
        <Field
          label="Vorname"
          name="vorname"
          value={form.vorname}
          onChange={update}
          error={errors.vorname}
          required
          autoComplete="given-name"
        />
        <Field
          label="Nachname"
          name="nachname"
          value={form.nachname}
          onChange={update}
          error={errors.nachname}
          required
          autoComplete="family-name"
        />

        <div className="md:col-span-2">
          <Field
            label="Strasse und Hausnummer"
            name="strasse"
            value={form.strasse}
            onChange={update}
            error={errors.strasse}
            required
            autoComplete="street-address"
          />
        </div>

        <div className="md:col-span-2 grid grid-cols-[120px_1fr] gap-5 sm:grid-cols-[160px_1fr]">
          <Field
            label="Postleitzahl"
            name="plz"
            value={form.plz}
            onChange={update}
            error={errors.plz}
            required
            inputMode="numeric"
            autoComplete="postal-code"
          />
          <Field
            label="Ort"
            name="ort"
            value={form.ort}
            onChange={update}
            error={errors.ort}
            required
            autoComplete="address-level2"
          />
        </div>

        <Field
          label="Telefonnummer"
          name="telefon"
          value={form.telefon}
          onChange={update}
          error={errors.telefon}
          required
          type="tel"
          autoComplete="tel"
        />
        <Field
          label="E-Mail-Adresse"
          name="email"
          value={form.email}
          onChange={update}
          error={errors.email}
          required
          type="email"
          autoComplete="email"
        />

        <div className="md:col-span-2">
          <Field
            label="Benutzername"
            name="benutzername"
            value={form.benutzername}
            onChange={update}
            error={errors.benutzername}
            required
            autoComplete="username"
          />
        </div>

        <Field
          label="Passwort"
          name="passwort"
          value={form.passwort}
          onChange={update}
          error={errors.passwort}
          required
          type="password"
          autoComplete="new-password"
        />
        <Field
          label="Passwort wiederholen"
          name="passwortWiederholen"
          value={form.passwortWiederholen}
          onChange={update}
          error={errors.passwortWiederholen}
          required
          type="password"
          autoComplete="new-password"
        />
      </div>

      <div className="mt-7 space-y-3">
        <CheckboxRow
          checked={form.agb}
          onToggle={() => update("agb", !form.agb)}
          error={errors.agb}
        >
          Ich akzeptiere die{" "}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLegalModalKind("agb");
            }}
            className="cursor-pointer bg-transparent p-0 font-semibold text-[var(--color-brand-700)] underline underline-offset-2 hover:text-[var(--color-brand-800)]"
          >
            AGB
          </button>
        </CheckboxRow>

        <CheckboxRow
          checked={form.datenschutz}
          onToggle={() => update("datenschutz", !form.datenschutz)}
          error={errors.datenschutz}
        >
          Ich akzeptiere die{" "}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLegalModalKind("datenschutz");
            }}
            className="cursor-pointer bg-transparent p-0 font-semibold text-[var(--color-brand-700)] underline underline-offset-2 hover:text-[var(--color-brand-800)]"
          >
            Datenschutzerklärung
          </button>
        </CheckboxRow>
      </div>

      {apiError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {apiError}
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          Bitte füllen Sie alle Pflichtfelder aus und akzeptieren Sie die AGB
          und Datenschutzerklärung.
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent-500)] px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 hover:bg-[var(--color-accent-600)] transition-colors btn-action-shine"
        >
          Konto erstellen
          <ArrowRight className="size-4" />
        </button>
      </div>
    </form>
    <RegistrationLegalModal kind={legalModalKind} onClose={() => setLegalModalKind(null)} />
    </>
  );
}

type FieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  error?: boolean;
  required?: boolean;
  readOnly?: boolean;
  type?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
};

function Field({
  label,
  name,
  value,
  onChange,
  error,
  required,
  readOnly,
  type = "text",
  autoComplete,
  inputMode,
  placeholder,
}: FieldProps) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="text-[var(--color-accent-600)]"> *</span>
        )}
      </span>
      <input
        type={type}
        name={name}
        value={value}
        readOnly={readOnly}
        onChange={(e) => {
          if (readOnly) return;
          onChange(name, e.target.value);
        }}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        className={`mt-1.5 block w-full rounded-xl border px-4 py-3 text-sm placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
          readOnly
            ? "cursor-default border-slate-200 bg-slate-50 text-slate-800 focus:border-slate-200 focus:ring-slate-100"
            : error
              ? "border-red-500 bg-white text-slate-900 focus:border-red-500 focus:ring-red-200"
              : "border-slate-200 bg-white text-slate-900 focus:border-[var(--color-brand-400)] focus:ring-[var(--color-brand-200)]"
        }`}
      />
    </label>
  );
}

function CheckboxRow({
  checked,
  onToggle,
  error,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
        error
          ? "border-red-500 bg-red-50/40"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-slate-300 accent-[var(--color-accent-500)]"
      />
      <span className="text-sm leading-relaxed text-slate-700">{children}</span>
    </label>
  );
}

/* ---------- TRANSPORTEUR REGISTRATION FORM ---------- */
type TransporteurFormState = {
  firmenname: string;
  vornameKontakt: string;
  nameKontakt: string;
  uid: string;
  strasse: string;
  plz: string;
  ort: string;
  telefon: string;
  email: string;
  versicherung: File | null;
  benutzername: string;
  passwort: string;
  passwortWiederholen: string;
  agb: boolean;
  datenschutz: boolean;
};

const initialTransporteurForm: TransporteurFormState = {
  firmenname: "",
  vornameKontakt: "",
  nameKontakt: "",
  uid: "",
  strasse: "",
  plz: "",
  ort: "",
  telefon: "",
  email: "",
  versicherung: null,
  benutzername: "",
  passwort: "",
  passwortWiederholen: "",
  agb: false,
  datenschutz: false,
};

function TransporteurRegistrationForm() {
  const { login } = useAuth();
  const [form, setForm] = useState<TransporteurFormState>(
    initialTransporteurForm,
  );
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [legalModalKind, setLegalModalKind] = useState<
    "agb" | "datenschutz" | null
  >(null);

  const update = (name: string, value: string | boolean | File | null) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (submitError) setSubmitError(false);
    if (apiError) setApiError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, boolean> = {};

    const requiredText: (keyof TransporteurFormState)[] = [
      "firmenname",
      "vornameKontakt",
      "nameKontakt",
      "uid",
      "strasse",
      "plz",
      "ort",
      "telefon",
      "email",
      "benutzername",
      "passwort",
      "passwortWiederholen",
    ];
    requiredText.forEach((k) => {
      const v = form[k];
      if (typeof v === "string" && !v.trim()) newErrors[k as string] = true;
    });

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (form.email.trim() && !emailRe.test(form.email.trim())) {
      newErrors.email = true;
    }

    const uidRe = /^CHE-\d{3}\.\d{3}\.\d{3}$/;
    if (form.uid.trim() && !uidRe.test(form.uid.trim())) {
      newErrors.uid = true;
    }

    if (
      form.passwort &&
      form.passwortWiederholen &&
      form.passwort !== form.passwortWiederholen
    ) {
      newErrors.passwort = true;
      newErrors.passwortWiederholen = true;
    }

    if (!form.versicherung) newErrors.versicherung = true;
    if (!form.agb) newErrors.agb = true;
    if (!form.datenschutz) newErrors.datenschutz = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitError(true);
      return;
    }

    setErrors({});
    setSubmitError(false);
    setApiError(null);

    if (useSupabase && supabase) {
      const kuerzel = initialsFromFirma(form.firmenname);
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.passwort,
        options: {
          data: {
            app_role: "transporteur",
            firmenname: form.firmenname.trim(),
            vorname_kontakt: form.vornameKontakt.trim(),
            name_kontakt: form.nameKontakt.trim(),
            uid: form.uid.trim(),
            strasse: form.strasse.trim(),
            plz: form.plz.trim(),
            ort: form.ort.trim(),
            telefon: form.telefon.trim(),
            benutzername: form.benutzername.trim(),
            kuerzel,
          },
        },
      });
      if (error) {
        setApiError(error.message);
        return;
      }
      const session =
        data.session ?? (await supabase.auth.getSession()).data.session;
      const u = session?.user;
      let sendTransporteurRegistrationMails = false;
      if (u && form.versicherung) {
        const safeName = form.versicherung.name.replace(/[^\w.-]+/g, "_");
        const path = `${u.id}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("versicherungsnachweise")
          .upload(path, form.versicherung);
        if (!upErr) {
          const { data: pub } = supabase.storage
            .from("versicherungsnachweise")
            .getPublicUrl(path);
          const { error: dbErr } = await supabase
            .from("transporteure")
            .update({
              versicherungsnachweis_url: pub.publicUrl,
            })
            .eq("id", u.id);
          if (!dbErr) sendTransporteurRegistrationMails = true;
        }
      }
      if (sendTransporteurRegistrationMails && session?.access_token) {
        void supabase.functions
          .invoke("transporteur-registration-emails", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          .then(({ error: invokeErr }) => {
            if (invokeErr) {
              console.warn(
                "[transporteur-registration-emails]",
                invokeErr.message,
              );
            }
          });
      }
      if (u) {
        const au = await loadAuthUserFromSession(u);
        if (au) {
          login({
            username: au.username,
            role: "transporteur",
            initials: au.initials,
            userId: au.userId,
            email: au.email,
          });
        }
      }
      return;
    }

    login({
      username: form.benutzername.trim(),
      role: "transporteur",
      initials: initialsFromFirma(form.firmenname),
    });
  };

  return (
    <>
    <form
      id="transporteur-registrierung"
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-10 anim-fade-up"
    >
      <h3 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
        Konto als Transporteur erstellen
      </h3>
      <p className="mt-2 text-sm text-slate-600">
        Schweizer Transportunternehmen – Registrierung kostenlos. Der
        Versicherungs­nachweis wird vor erster Auftragsannahme geprüft.
      </p>

      <div className="mt-7 grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field
            label="Firmenname"
            name="firmenname"
            value={form.firmenname}
            onChange={update}
            error={errors.firmenname}
            required
            autoComplete="organization"
          />
        </div>

        <Field
          label="Vorname Kontaktperson"
          name="vornameKontakt"
          value={form.vornameKontakt}
          onChange={update}
          error={errors.vornameKontakt}
          required
          autoComplete="given-name"
        />
        <Field
          label="Name Kontaktperson"
          name="nameKontakt"
          value={form.nameKontakt}
          onChange={update}
          error={errors.nameKontakt}
          required
          autoComplete="family-name"
        />

        <div className="md:col-span-2">
          <Field
            label="UID-Nummer"
            name="uid"
            value={form.uid}
            onChange={update}
            error={errors.uid}
            required
            placeholder="CHE-123.456.789"
          />
        </div>

        <div className="md:col-span-2">
          <Field
            label="Strasse und Hausnummer"
            name="strasse"
            value={form.strasse}
            onChange={update}
            error={errors.strasse}
            required
            autoComplete="street-address"
          />
        </div>

        <div className="md:col-span-2 grid grid-cols-[120px_1fr] gap-5 sm:grid-cols-[160px_1fr]">
          <Field
            label="Postleitzahl"
            name="plz"
            value={form.plz}
            onChange={update}
            error={errors.plz}
            required
            inputMode="numeric"
            autoComplete="postal-code"
          />
          <Field
            label="Ort"
            name="ort"
            value={form.ort}
            onChange={update}
            error={errors.ort}
            required
            autoComplete="address-level2"
          />
        </div>

        <Field
          label="Telefonnummer"
          name="telefon"
          value={form.telefon}
          onChange={update}
          error={errors.telefon}
          required
          type="tel"
          autoComplete="tel"
        />
        <Field
          label="E-Mail-Adresse"
          name="email"
          value={form.email}
          onChange={update}
          error={errors.email}
          required
          type="email"
          autoComplete="email"
        />

        <div className="md:col-span-2">
          <FileField
            label="Versicherungsnachweis"
            name="versicherung"
            file={form.versicherung}
            onChange={update}
            error={errors.versicherung}
            required
            accept="application/pdf,image/*"
            hint="PDF oder Bild · wird vor erster Auftragsannahme geprüft"
          />
        </div>

        <div className="md:col-span-2">
          <Field
            label="Benutzername"
            name="benutzername"
            value={form.benutzername}
            onChange={update}
            error={errors.benutzername}
            required
            autoComplete="username"
          />
        </div>

        <Field
          label="Passwort"
          name="passwort"
          value={form.passwort}
          onChange={update}
          error={errors.passwort}
          required
          type="password"
          autoComplete="new-password"
        />
        <Field
          label="Passwort wiederholen"
          name="passwortWiederholen"
          value={form.passwortWiederholen}
          onChange={update}
          error={errors.passwortWiederholen}
          required
          type="password"
          autoComplete="new-password"
        />
      </div>

      <div className="mt-7 space-y-3">
        <CheckboxRow
          checked={form.agb}
          onToggle={() => update("agb", !form.agb)}
          error={errors.agb}
        >
          Ich akzeptiere die{" "}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLegalModalKind("agb");
            }}
            className="cursor-pointer bg-transparent p-0 font-semibold text-[var(--color-brand-700)] underline underline-offset-2 hover:text-[var(--color-brand-800)]"
          >
            AGB
          </button>
        </CheckboxRow>

        <CheckboxRow
          checked={form.datenschutz}
          onToggle={() => update("datenschutz", !form.datenschutz)}
          error={errors.datenschutz}
        >
          Ich akzeptiere die{" "}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLegalModalKind("datenschutz");
            }}
            className="cursor-pointer bg-transparent p-0 font-semibold text-[var(--color-brand-700)] underline underline-offset-2 hover:text-[var(--color-brand-800)]"
          >
            Datenschutzerklärung
          </button>
        </CheckboxRow>
      </div>

      {apiError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {apiError}
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          Bitte füllen Sie alle Pflichtfelder aus und akzeptieren Sie die AGB
          und Datenschutzerklärung.
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--color-brand-800)] bg-transparent px-6 py-4 text-sm font-semibold text-[var(--color-brand-800)] hover:bg-[var(--color-brand-800)] hover:text-white transition-colors btn-action-shine"
        >
          Als Transporteur registrieren
          <ArrowRight className="size-4" />
        </button>
      </div>
    </form>
    <RegistrationLegalModal kind={legalModalKind} onClose={() => setLegalModalKind(null)} />
    </>
  );
}

type FileFieldProps = {
  label: string;
  name: string;
  file: File | null;
  onChange: (name: string, value: File | null) => void;
  error?: boolean;
  required?: boolean;
  accept?: string;
  hint?: string;
};

function FileField({
  label,
  name,
  file,
  onChange,
  error,
  required,
  accept,
  hint,
}: FileFieldProps) {
  return (
    <div className="block">
      <span className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-[var(--color-accent-600)]"> *</span>}
      </span>
      <label
        className={`mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border bg-white px-4 py-3 transition-colors hover:bg-slate-50 ${
          error ? "border-red-500" : "border-slate-200"
        }`}
      >
        <span className="grid size-9 place-items-center rounded-lg bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
          <Upload className="size-4" />
        </span>
        <span className="flex-1 truncate text-sm">
          {file ? (
            <span className="font-medium text-slate-900">{file.name}</span>
          ) : (
            <span className="text-slate-500">
              Datei wählen (PDF oder Bild)
            </span>
          )}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand-700)]">
          {file ? "Ändern" : "Auswählen"}
        </span>
        <input
          type="file"
          name={name}
          accept={accept}
          className="sr-only"
          onChange={(e) => onChange(name, e.target.files?.[0] ?? null)}
        />
      </label>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function auctionNotesContainContactInfo(notes: string): boolean {
  if (!notes || !notes.trim()) return false;
  const raw = notes;

  if (/[@＠]/.test(raw)) return true;

  if (
    /\b[a-z0-9._%+-]+\s+at\s+[a-z0-9._-]+(?:\s*(?:punkt|dot)\s*[a-z0-9._-]+)+/i.test(
      raw,
    )
  ) {
    return true;
  }
  if (
    /\b[a-z0-9._%+-]+\s+at\s+[a-z0-9._-]+\s*[\[(]?\s*dot\s*[\])]?\s*[a-z]{2,}/i.test(
      raw,
    )
  ) {
    return true;
  }
  if (/\b[a-z0-9._%+-]+\s+@\s+[a-z0-9._-]+/i.test(raw)) return true;
  if (/\b[a-z0-9._%+-]+\s+at\s+[a-z0-9._-]+\.[a-z]{2,}\b/i.test(raw))
    return true;

  function expandDigitWords(text: string): string {
    return text.replace(
      /\b(null|zero|oh|eins|one|zwei|two|drei|three|vier|four|fünf|fuenf|five|sechs|six|sieben|seven|acht|eight|neun|nine)\b/gi,
      (m) => {
        const k = m.toLowerCase().replace(/ü/g, "u");
        const map: Record<string, string> = {
          null: "0",
          zero: "0",
          oh: "0",
          eins: "1",
          one: "1",
          zwei: "2",
          two: "2",
          drei: "3",
          three: "3",
          vier: "4",
          four: "4",
          fünf: "5",
          fuenf: "5",
          five: "5",
          sechs: "6",
          six: "6",
          sieben: "7",
          seven: "7",
          acht: "8",
          eight: "8",
          neun: "9",
          nine: "9",
        };
        return map[k] ?? m;
      },
    );
  }

  let t = expandDigitWords(raw);
  t = t.replace(/\+\s*4\s*1/g, "0041");
  t = t.replace(/\b0\s*0\s*4\s*1\b/g, "0041");
  t = t.replace(/\bplus\s+4\s*1\b/gi, "0041");

  const digitsOnly = t.replace(/\D/g, "");
  if (/0041[1-9]\d{8,}/.test(digitsOnly)) return true;
  if (/41[1-9]\d{8,}/.test(digitsOnly)) return true;
  if (/0[1-9]\d{8}/.test(digitsOnly)) return true;
  if (/0[1-9]\d{9,}/.test(digitsOnly)) return true;
  if (/7[5-9]\d{7}/.test(digitsOnly)) return true;

  return false;
}

/* ---------- AUCTION FORM ---------- */
type AuctionFormState = {
  startort: string;
  zielort: string;
  empfVorname: string;
  empfName: string;
  empfStrasse: string;
  empfPlz: string;
  empfOrt: string;
  abholdatum: string;
  lieferdatum: string;
  lieferzeitpraeferenz: "" | "vormittags" | "nachmittags" | "flexibel";
  hoehe: string;
  breite: string;
  tiefe: string;
  gewicht: string;
  notizen: string;
};

const initialAuctionForm: AuctionFormState = {
  startort: "",
  zielort: "",
  empfVorname: "",
  empfName: "",
  empfStrasse: "",
  empfPlz: "",
  empfOrt: "",
  abholdatum: "",
  lieferdatum: "",
  lieferzeitpraeferenz: "",
  hoehe: "",
  breite: "",
  tiefe: "",
  gewicht: "",
  notizen: "",
};

type AbsenderProfil = {
  vorname: string;
  name: string;
  strasse: string;
  plz: string;
  ort: string;
};

const emptyAbsender: AbsenderProfil = {
  vorname: "",
  name: "",
  strasse: "",
  plz: "",
  ort: "",
};

type DurationValue = { days: number; hours: number; minutes: number };

/** Ohne explizite Tage: nur Minuten/Stunden zählen (Default 1 Tag führte zu ~24h, wenn nur Minuten gewählt wurden). */
const DEFAULT_AUCTION_DURATION: DurationValue = {
  days: 0,
  hours: 0,
  minutes: 5,
};

function msToDuration(ms: number): DurationValue {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.min(7, Math.floor(total / 86400));
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return { days, hours, minutes };
}

function AuctionForm({ onCancel }: { onCancel: () => void }) {
  const {
    user,
    addAuction,
    goToMyAuctions,
    auctionFormPrefill,
    consumeAuctionFormPrefill,
  } = useAuth();
  const [absender, setAbsender] = useState<AbsenderProfil>(emptyAbsender);
  const [form, setForm] = useState<AuctionFormState>(() =>
    auctionFormPrefill
      ? {
          startort: auctionFormPrefill.startort,
          zielort: auctionFormPrefill.zielort,
          empfVorname: auctionFormPrefill.empfVorname ?? "",
          empfName: auctionFormPrefill.empfName ?? "",
          empfStrasse: auctionFormPrefill.empfStrasse ?? "",
          empfPlz: auctionFormPrefill.empfPlz ?? "",
          empfOrt: auctionFormPrefill.empfOrt ?? "",
          abholdatum: auctionFormPrefill.abholdatum ?? "",
          lieferdatum: auctionFormPrefill.lieferdatum ?? "",
          lieferzeitpraeferenz:
            auctionFormPrefill.lieferzeitpraeferenz ?? "",
          hoehe: auctionFormPrefill.hoehe ?? "",
          breite: auctionFormPrefill.breite ?? "",
          tiefe: auctionFormPrefill.tiefe ?? "",
          gewicht: auctionFormPrefill.gewicht ?? "",
          notizen: auctionFormPrefill.notizen ?? "",
        }
      : initialAuctionForm,
  );
  const [duration, setDuration] = useState<DurationValue>(() =>
    auctionFormPrefill
      ? msToDuration(auctionFormPrefill.durationMs)
      : DEFAULT_AUCTION_DURATION,
  );
  useEffect(() => {
    if (auctionFormPrefill) consumeAuctionFormPrefill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadAbsender() {
      if (!user || user.role !== "auftraggeber") {
        if (!cancelled) setAbsender(emptyAbsender);
        return;
      }
      if (useSupabase && supabase && user.userId) {
        const { data, error } = await supabase
          .from("auftraggeber")
          .select("vorname,name,strasse,plz,ort")
          .eq("id", user.userId)
          .maybeSingle();
        if (cancelled) return;
        if (data && !error) {
          setAbsender({
            vorname: String(data.vorname ?? "").trim(),
            name: String(data.name ?? "").trim(),
            strasse: String(data.strasse ?? "").trim(),
            plz: String(data.plz ?? "").trim(),
            ort: String(data.ort ?? "").trim(),
          });
        } else {
          setAbsender({
            vorname: "—",
            name: "—",
            strasse: "—",
            plz: "—",
            ort: "—",
          });
        }
      } else {
        setAbsender({
          vorname: "—",
          name: "—",
          strasse: "—",
          plz: "—",
          ort: "—",
        });
      }
    }
    void loadAbsender();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const [images, setImages] = useState<File[]>([]);
  const [retainedImageUrls, setRetainedImageUrls] = useState<string[]>(
    () => auctionFormPrefill?.imageDataUrls ?? [],
  );
  const [errors, setErrors] = useState<Set<keyof AuctionFormState>>(new Set());
  const [showError, setShowError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const notizenContactBlocked = useMemo(
    () => auctionNotesContainContactInfo(form.notizen),
    [form.notizen],
  );

  const update = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setSubmitError(null);
    if (errors.has(name as keyof AuctionFormState)) {
      const next = new Set(errors);
      next.delete(name as keyof AuctionFormState);
      setErrors(next);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const required: (keyof AuctionFormState)[] = [
      "startort",
      "zielort",
      "empfVorname",
      "empfName",
      "empfStrasse",
      "empfPlz",
      "empfOrt",
      "abholdatum",
      "lieferdatum",
    ];
    const missing = new Set<keyof AuctionFormState>();
    required.forEach((k) => {
      const v = form[k];
      if (typeof v === "string" && !v.trim()) missing.add(k);
    });
    setErrors(missing);
    if (missing.size > 0) {
      setShowError(true);
      return;
    }
    if (auctionNotesContainContactInfo(form.notizen)) return;
    setShowError(false);

    const totalSeconds =
      duration.days * 86400 + duration.hours * 3600 + duration.minutes * 60;
    const durationMs = Math.max(60_000, totalSeconds * 1000);
    if (totalSeconds < 60) {
      setSubmitError("Die Auktionsdauer muss mindestens 1 Minute betragen.");
      return;
    }
    setSubmitError(null);
    const fromFiles =
      images.length > 0
        ? await Promise.all(images.map((f) => fileToDataUrl(f)))
        : [];
    const imageDataUrls = [...retainedImageUrls, ...fromFiles];
    let newId = "";
    try {
      newId = await addAuction({
        startort: form.startort,
        zielort: form.zielort,
        empfVorname: form.empfVorname.trim(),
        empfName: form.empfName.trim(),
        empfStrasse: form.empfStrasse.trim(),
        empfPlz: form.empfPlz.trim(),
        empfOrt: form.empfOrt.trim(),
        abholdatum: form.abholdatum.trim(),
        lieferdatum: form.lieferdatum.trim(),
        lieferzeitpraeferenz: form.lieferzeitpraeferenz || undefined,
        hoehe: form.hoehe || undefined,
        breite: form.breite || undefined,
        tiefe: form.tiefe || undefined,
        gewicht: form.gewicht || undefined,
        notizen: form.notizen || undefined,
        imageDataUrls:
          imageDataUrls.length > 0 ? imageDataUrls : undefined,
        durationMs,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Die Auktion konnte nicht gespeichert werden.";
      setSubmitError(msg);
      return;
    }
    if (!newId) {
      setSubmitError(
        "Die Auktion konnte nicht gespeichert werden. Bitte prüfe deine Anmeldung und Verbindung, oder versuche es kurz erneut.",
      );
      return;
    }
    setSuccess(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (success) {
    return (
      <div
        id="transport-ausschreiben"
        className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-8 anim-fade-up"
      >
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
            <Check className="size-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-extrabold text-emerald-900">
              Auktion gestartet!
            </h3>
            <p className="mt-1 text-sm text-emerald-800">
              Dein Transport von <strong>{form.startort}</strong> nach{" "}
              <strong>{form.zielort}</strong> ist live. Du erhältst eine
              Benachrichtigung, sobald das erste Gebot eingeht.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setForm(initialAuctionForm);
                  setDuration(DEFAULT_AUCTION_DURATION);
                  setImages([]);
                  setRetainedImageUrls([]);
                  setSuccess(false);
                  goToMyAuctions();
                }}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors btn-action-shine"
              >
                Zu meinen Auktionen
                <ArrowRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm(initialAuctionForm);
                  setDuration(DEFAULT_AUCTION_DURATION);
                  setImages([]);
                  setRetainedImageUrls([]);
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
      id="transport-ausschreiben"
      onSubmit={onSubmit}
      noValidate
      className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm anim-fade-up"
    >
      <div className="border-b border-slate-100 px-7 py-5 md:px-10">
        <h3 className="text-xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-2xl">
          Transport ausschreiben
        </h3>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Sag uns, was wohin soll – Transporteure unterbieten sich live.
        </p>
      </div>

      <div className="space-y-6 px-7 py-7 md:px-10 md:py-9">
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Startort"
            name="startort"
            value={form.startort}
            onChange={update}
            required
            error={errors.has("startort")}
            placeholder="z. B. Zürich"
            autoComplete="off"
          />
          <Field
            label="Zielort"
            name="zielort"
            value={form.zielort}
            onChange={update}
            required
            error={errors.has("zielort")}
            placeholder="z. B. Bern"
            autoComplete="off"
          />
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-800">
            Absender (Auftraggeber)
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Aus deinem Profil; hier nicht änderbar.
          </p>
          <div className="mt-3 grid gap-5 md:grid-cols-2">
            <Field
              label="Vorname"
              name="absender_vorname"
              value={absender.vorname}
              onChange={() => {}}
              readOnly
              autoComplete="off"
            />
            <Field
              label="Name"
              name="absender_name"
              value={absender.name}
              onChange={() => {}}
              readOnly
              autoComplete="off"
            />
            <Field
              label="Strasse und Hausnummer"
              name="absender_strasse"
              value={absender.strasse}
              onChange={() => {}}
              readOnly
              autoComplete="street-address"
            />
            <Field
              label="PLZ"
              name="absender_plz"
              value={absender.plz}
              onChange={() => {}}
              readOnly
              autoComplete="postal-code"
            />
            <Field
              label="Ort"
              name="absender_ort"
              value={absender.ort}
              onChange={() => {}}
              readOnly
              autoComplete="address-level2"
            />
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-800">Empfänger</h4>
          <div className="mt-3 grid gap-5 md:grid-cols-2">
            <Field
              label="Vorname"
              name="empfVorname"
              value={form.empfVorname}
              onChange={update}
              required
              error={errors.has("empfVorname")}
              autoComplete="given-name"
            />
            <Field
              label="Name"
              name="empfName"
              value={form.empfName}
              onChange={update}
              required
              error={errors.has("empfName")}
              autoComplete="family-name"
            />
            <Field
              label="Strasse und Hausnummer"
              name="empfStrasse"
              value={form.empfStrasse}
              onChange={update}
              required
              error={errors.has("empfStrasse")}
              autoComplete="street-address"
            />
            <Field
              label="PLZ"
              name="empfPlz"
              value={form.empfPlz}
              onChange={update}
              required
              error={errors.has("empfPlz")}
              autoComplete="postal-code"
            />
            <Field
              label="Ort"
              name="empfOrt"
              value={form.empfOrt}
              onChange={update}
              required
              error={errors.has("empfOrt")}
              autoComplete="address-level2"
            />
          </div>
        </div>

        <label className="block">
          <span className="block text-sm font-medium text-slate-700">
            Gewünschtes Abholdatum
            <span className="text-[var(--color-accent-600)]"> *</span>
          </span>
          <input
            type="date"
            name="abholdatum"
            value={form.abholdatum}
            onChange={(e) => update("abholdatum", e.target.value)}
            className={`mt-1.5 block w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 ${
              errors.has("abholdatum")
                ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                : "border-slate-200 focus:border-[var(--color-brand-400)] focus:ring-[var(--color-brand-200)]"
            }`}
          />
        </label>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">
              Gewünschtes Lieferdatum
              <span className="text-[var(--color-accent-600)]"> *</span>
            </span>
            <input
              type="date"
              name="lieferdatum"
              value={form.lieferdatum}
              onChange={(e) => update("lieferdatum", e.target.value)}
              className={`mt-1.5 block w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 ${
                errors.has("lieferdatum")
                  ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                  : "border-slate-200 focus:border-[var(--color-brand-400)] focus:ring-[var(--color-brand-200)]"
              }`}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">
              Uhrzeitpräferenz{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <select
              name="lieferzeitpraeferenz"
              value={form.lieferzeitpraeferenz}
              onChange={(e) =>
                update(
                  "lieferzeitpraeferenz",
                  e.target.value as AuctionFormState["lieferzeitpraeferenz"],
                )
              }
              className="mt-1.5 block w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-[var(--color-brand-400)] focus:ring-2 focus:ring-[var(--color-brand-200)]"
            >
              <option value="">Keine Angabe</option>
              <option value="vormittags">Vormittags</option>
              <option value="nachmittags">Nachmittags</option>
              <option value="flexibel">Zeit flexibel</option>
            </select>
          </label>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800">
            Masse & Gewicht{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DimensionField
              label="Höhe"
              unit="cm"
              name="hoehe"
              value={form.hoehe}
              onChange={update}
            />
            <DimensionField
              label="Breite"
              unit="cm"
              name="breite"
              value={form.breite}
              onChange={update}
            />
            <DimensionField
              label="Tiefe"
              unit="cm"
              name="tiefe"
              value={form.tiefe}
              onChange={update}
            />
            <DimensionField
              label="Gewicht"
              unit="kg"
              name="gewicht"
              value={form.gewicht}
              onChange={update}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="auction-notizen"
            className="block text-sm font-semibold text-slate-800"
          >
            Notizen{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="auction-notizen"
            name="notizen"
            rows={4}
            value={form.notizen}
            onChange={(e) => update("notizen", e.target.value)}
            placeholder="Zerbrechlich, Treppenhaus 2. Stock, Liefertermin flexibel …"
            className={`mt-1.5 block w-full resize-y rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition-colors ${
              notizenContactBlocked
                ? "border-2 border-red-600 focus:border-red-600 focus:ring-2 focus:ring-red-200"
                : "border border-slate-200 focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-500)]/20"
            }`}
          />
          {notizenContactBlocked && (
            <p className="mt-2 text-sm font-medium text-red-600">
              Keine Kontaktdaten erlaubt. Bitte entferne Telefonnummern und
              E-Mail-Adressen aus deinen Notizen.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800">
            Auktionsdauer
          </label>
          <DurationWheel value={duration} onChange={setDuration} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800">
            Bild{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          {retainedImageUrls.length > 0 && (
            <div className="mb-3 mt-1.5 flex flex-wrap gap-2">
              {retainedImageUrls.map((url, i) => (
                <div key={i} className="relative">
                  <img
                    src={url}
                    alt=""
                    className="size-20 rounded-xl object-cover ring-1 ring-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setRetainedImageUrls((xs) => xs.filter((_, j) => j !== i))
                    }
                    className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-white text-[10px] font-bold text-slate-600 shadow ring-1 ring-slate-200 hover:text-red-600"
                    aria-label="Bild entfernen"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <ImageDrop value={images} onChange={setImages} />
        </div>

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
            disabled={notizenContactBlocked}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent-500)] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 transition-colors hover:bg-[var(--color-accent-600)] disabled:cursor-not-allowed disabled:opacity-50 btn-action-shine"
          >
            Auktion starten
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </form>
  );
}

/* ---------- MEINE AUKTIONEN ---------- */
type AuctionStatus =
  | "live"
  | "keine-gebote"
  | "beendet"
  | "leer-beendet"
  | "beauftragt"
  | "abgelehnt";

function getAuctionStatus(a: Auction, now: number): AuctionStatus {
  if (a.awardedAt) return "beauftragt";
  if (a.rejectedAt) return "abgelehnt";
  const ended = now >= a.startedAt + a.durationMs;
  if (!ended) {
    return a.bids.length === 0 ? "keine-gebote" : "live";
  }
  return a.bids.length === 0 ? "leer-beendet" : "beendet";
}

function formatLockMinutes(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  if (minutes <= 1) return "weniger als 1 Min.";
  return `${minutes} Min.`;
}

function buildPrefillFromAuction(a: Auction): AuctionDraft {
  return {
    startort: a.startort,
    zielort: a.zielort,
    empfVorname: a.empfVorname ?? "",
    empfName: a.empfName ?? "",
    empfStrasse: a.empfStrasse ?? "",
    empfPlz: a.empfPlz ?? "",
    empfOrt: a.empfOrt ?? "",
    hoehe: a.hoehe,
    breite: a.breite,
    tiefe: a.tiefe,
    gewicht: a.gewicht,
    notizen: a.notizen,
    abholdatum: a.abholdatum,
    lieferdatum: a.lieferdatum,
    lieferzeitpraeferenz: a.lieferzeitpraeferenz,
    imageDataUrls: a.imageDataUrls,
    durationMs: a.durationMs,
  };
}

function getLeadingBid(a: Auction): number | null {
  if (a.bids.length === 0) return null;
  return Math.min(...a.bids.map((b) => b.price));
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function formatRelative(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return "gerade eben";
  if (s < 60) return `vor ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `vor ${m} min`;
  const h = Math.floor(m / 60);
  return `vor ${h} Std`;
}

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function MyAuctionsList() {
  const { user, auctions, viewAuctionDetail, goToAuctionForm } = useAuth();
  const now = useNow(1000);
  /* RLS liefert Auftraggebern aus Supabase ohnehin nur eigene Auktionen.
   * Im Mock-Modus filtern wir lokal über den Benutzernamen. */
  const mine = !user
    ? []
    : useSupabase && user.role === "auftraggeber"
      ? auctions
      : auctions.filter((a) => a.ownerUsername === user.username);

  if (mine.length === 0) {
    return (
      <div
        id="meine-auktionen"
        className="mt-8 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm anim-fade-up md:p-14"
      >
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--color-brand-50)] text-[var(--color-brand-700)] ring-1 ring-[var(--color-brand-100)]">
          <Truck className="size-6" />
        </div>
        <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-[var(--color-ink)]">
          Du hast noch keine Auktion gestartet.
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted)]">
          Schreibe deinen ersten Transport aus – Transporteure unterbieten sich
          live.
        </p>
        <button
          type="button"
          onClick={() => goToAuctionForm()}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent-500)] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 hover:bg-[var(--color-accent-600)] transition-colors btn-action-shine"
        >
          Jetzt Transport ausschreiben
          <ArrowRight className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div id="meine-auktionen" className="mt-8 anim-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-2xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-3xl">
            Meine Auktionen
          </h3>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {mine.length === 1
              ? "1 Auktion in deinem Konto"
              : `${mine.length} Auktionen in deinem Konto`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => goToAuctionForm()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent-500)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 hover:bg-[var(--color-accent-600)] transition-colors btn-action-shine"
        >
          Neuer Transport
          <ArrowRight className="size-4" />
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {mine.map((a) => (
          <AuctionCard
            key={a.id}
            auction={a}
            now={now}
            onOpen={() => viewAuctionDetail(a.id)}
          />
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AuctionStatus }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500 anim-live" />
        LIVE
      </span>
    );
  }
  if (status === "keine-gebote") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent-50)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-accent-700)]">
        <span className="size-1.5 rounded-full bg-[var(--color-accent-500)]" />
        KEINE GEBOTE
      </span>
    );
  }
  if (status === "beauftragt") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
        <span className="size-1.5 rounded-full bg-emerald-600" />
        BEAUFTRAGT
      </span>
    );
  }
  if (status === "abgelehnt") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
        <span className="size-1.5 rounded-full bg-rose-500" />
        ABGELEHNT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
      <span className="size-1.5 rounded-full bg-slate-400" />
      BEENDET
    </span>
  );
}

function AuctionCard({
  auction,
  now,
  onOpen,
}: {
  auction: Auction;
  now: number;
  onOpen: () => void;
}) {
  const status = getAuctionStatus(auction, now);
  const leading = getLeadingBid(auction);
  const remaining = auction.startedAt + auction.durationMs - now;

  return (
    <div className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-200)] hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Auftrag #{auction.id}
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="grid size-6 place-items-center rounded-md bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
              <Truck className="size-3.5" />
            </span>
            <div className="min-w-0 truncate font-semibold text-slate-900">
              {auction.startort}{" "}
              <span className="mx-1 text-slate-400">→</span>{" "}
              {auction.zielort}
            </div>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {status === "live" && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[var(--color-brand-50)] p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-brand-700)]/70">
              Führungsgebot
            </div>
            <div className="mt-0.5 text-lg font-extrabold tabular-nums text-[var(--color-brand-800)]">
              CHF {leading}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Endet in
            </div>
            <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-slate-900">
              {formatRemaining(remaining)}
            </div>
          </div>
        </div>
      )}

      {status === "keine-gebote" && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <div className="font-medium text-slate-700">
            Noch kein Gebot eingegangen
          </div>
          <div className="mt-0.5 text-slate-500">
            Endet in{" "}
            <span className="font-mono font-semibold tabular-nums text-slate-700">
              {formatRemaining(remaining)}
            </span>
          </div>
        </div>
      )}

      {status === "beendet" && (
        <div className="mt-4 rounded-xl border border-[var(--color-accent-200)] bg-[var(--color-accent-50)] p-3 text-xs text-[var(--color-accent-700)]">
          <div className="font-semibold">Entscheidung ausstehend</div>
          <div className="mt-0.5 text-slate-700">
            Tiefstes Gebot:{" "}
            <span className="font-bold tabular-nums">CHF {leading}</span> ·{" "}
            {auction.bids.length}{" "}
            {auction.bids.length === 1 ? "Gebot" : "Gebote"}
          </div>
        </div>
      )}

      {status === "leer-beendet" && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          Auktion beendet · keine Gebote eingegangen
        </div>
      )}

      {status === "beauftragt" && auction.awardedBid && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          {auction.auctionStatus === "bezahlt" ? (
            <>
              <div className="font-semibold">
                Lieferung bestätigt – Zahlung erfolgt.
              </div>
              <div className="mt-0.5 text-slate-700">
                Vielen Dank für die Nutzung von 321 meins.
              </div>
              <div className="mt-2 border-t border-emerald-100 pt-2 text-slate-700">
                Preis:{" "}
                <span className="font-bold tabular-nums text-slate-900">
                  CHF {auction.awardedBid.price}
                </span>{" "}
                ·{" "}
                <FahrerInfoBlock
                  initials={auction.awardedBid.initials}
                  verifiziert={auction.awardedBid.verifiziert}
                  bewertung={auction.awardedBid.bewertung}
                  initialsClassName="font-medium text-slate-700"
                />
              </div>
            </>
          ) : (
            <>
              <div className="font-semibold">Auftrag erteilt</div>
              <div className="mt-0.5 text-slate-700">
                Preis:{" "}
                <span className="font-bold tabular-nums text-slate-900">
                  CHF {auction.awardedBid.price}
                </span>{" "}
                ·{" "}
                <FahrerInfoBlock
                  initials={auction.awardedBid.initials}
                  verifiziert={auction.awardedBid.verifiziert}
                  bewertung={auction.awardedBid.bewertung}
                  initialsClassName="font-medium text-slate-700"
                />
              </div>
            </>
          )}
        </div>
      )}

      {status === "abgelehnt" && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <div className="font-semibold text-slate-700">
            Alle Gebote abgelehnt
          </div>
          <div className="mt-0.5">
            {auction.rejectedAt &&
              now < auction.rejectedAt + REJECT_LOCK_MS &&
              `Erneut startbar in ${formatLockMinutes(
                auction.rejectedAt + REJECT_LOCK_MS - now,
              )}`}
            {auction.rejectedAt &&
              now >= auction.rejectedAt + REJECT_LOCK_MS &&
              "Sperre abgelaufen – kann erneut gestartet werden"}
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center justify-end">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-[var(--color-brand-300)] hover:text-[var(--color-brand-700)]"
        >
          Details anzeigen
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function AuctionDetail() {
  const {
    user,
    auctions,
    selectedAuctionId,
    goToMyAuctions,
    goToAuctionForm,
    awardBid,
    rejectBids,
    refreshAuctions,
    completePendingPaymentMock,
  } = useAuth();
  const now = useNow(1000);
  const auction = auctions.find(
    (a) =>
      a.id === selectedAuctionId &&
      user &&
      a.ownerUsername === user.username,
  );

  if (!auction) {
    return (
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 anim-fade-up">
        Auktion nicht gefunden.
        <div className="mt-4">
          <button
            type="button"
            onClick={goToMyAuctions}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-700)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-brand-800)] transition-colors btn-action-shine"
          >
            Zurück zur Übersicht
          </button>
        </div>
      </div>
    );
  }

  const status = getAuctionStatus(auction, now);
  const leading = getLeadingBid(auction);
  const remaining = auction.startedAt + auction.durationMs - now;
  const elapsed = Math.min(
    1,
    Math.max(0, (now - auction.startedAt) / auction.durationMs),
  );
  const winnerBid =
    auction.awardedBid ??
    (auction.bids.length > 0 ? getLowestBid(auction) : null);

  const handleAward = async () => {
    if (!winnerBid) return;
    await awardBid(auction.id, winnerBid);
  };
  const handleReject = () => {
    void rejectBids(auction.id);
  };
  const handleRestart = () => {
    goToAuctionForm(buildPrefillFromAuction(auction));
  };

  const lockRemaining = auction.rejectedAt
    ? auction.rejectedAt + REJECT_LOCK_MS - now
    : 0;
  const locked = status === "abgelehnt" && lockRemaining > 0;

  return (
    <div className="mt-8 anim-fade-up">
      <button
        type="button"
        onClick={goToMyAuctions}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-[var(--color-brand-700)]"
      >
        <span aria-hidden>←</span> Zurück zu Meine Auktionen
      </button>

      <div className="relative mt-4">
        <div className="absolute -inset-6 -z-10 rounded-[32px] bg-gradient-to-br from-[var(--color-brand-700)]/10 to-transparent blur-2xl" />
        <div className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
          <div className="rounded-[22px] p-6 md:p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
                  <Truck className="size-4" />
                </span>
                <div className="text-xs font-medium text-slate-500">
                  Auftrag #{auction.id}
                </div>
              </div>
              <StatusBadge status={status} />
            </div>

            <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
              <span className="text-slate-500">Von</span>
              <span className="font-medium text-slate-900">
                {auction.startort}
              </span>
              <span className="text-slate-500">Nach</span>
              <span className="font-medium text-slate-900">
                {auction.zielort}
              </span>
              <AuktionsPrivatAdressen auction={auction} />
              {(auction.hoehe ||
                auction.breite ||
                auction.tiefe ||
                auction.gewicht) && (
                <>
                  <span className="text-slate-500">Masse</span>
                  <span className="font-medium text-slate-900">
                    {[
                      auction.hoehe && `H ${auction.hoehe} cm`,
                      auction.breite && `B ${auction.breite} cm`,
                      auction.tiefe && `T ${auction.tiefe} cm`,
                      auction.gewicht && `${auction.gewicht} kg`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </>
              )}
              {auction.notizen && (
                <>
                  <span className="text-slate-500">Notizen</span>
                  <span className="font-medium text-slate-900">
                    {auction.notizen}
                  </span>
                </>
              )}
            </div>

            {(status === "live" || status === "keine-gebote") && (
              <div className="mt-5 rounded-2xl bg-gradient-to-br from-[var(--color-brand-700)] to-[var(--color-brand-800)] p-5 text-white">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-white/60">
                      Aktuelles Führungsgebot
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-4xl font-extrabold tabular-nums">
                        {leading !== null ? `CHF ${leading}` : "—"}
                      </span>
                      {leading !== null && status === "live" && (
                        <span className="anim-bid text-xs font-semibold text-emerald-300">
                          ▼
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wider text-white/60">
                      Endet in
                    </div>
                    <div className="mt-1 font-mono text-2xl font-bold tabular-nums">
                      {formatRemaining(remaining)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent-400)] transition-all"
                    style={{ width: `${elapsed * 100}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-white/70">
                  <span>
                    {auction.bids.length}{" "}
                    {auction.bids.length === 1 ? "Gebot" : "Gebote"}
                  </span>
                  <span>Startpreis: CHF {auction.startPrice}</span>
                </div>
              </div>
            )}

            {status === "beendet" && winnerBid && (
              <WinnerDecision
                auction={auction}
                winnerBid={winnerBid}
                onAccept={handleAward}
                onReject={handleReject}
              />
            )}

            {status === "beauftragt" && auction.awardedBid && (
              <AwardedSection
                auction={auction}
                awardedBid={auction.awardedBid}
                refreshAuctions={refreshAuctions}
                completePendingPaymentMock={completePendingPaymentMock}
              />
            )}

            {status === "abgelehnt" && (
              <RejectedSection
                locked={locked}
                lockRemaining={lockRemaining}
                onRestart={handleRestart}
              />
            )}

            {status === "leer-beendet" && (
              <EmptyEndedSection onRestart={handleRestart} />
            )}

            <div className="mt-5">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {status === "beauftragt" ? "Alle Gebote" : "Letzte Gebote"}
              </h4>
              {auction.bids.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-sm text-slate-500">
                  Noch keine Gebote eingegangen.
                </div>
              ) : (
                <div className="space-y-2">
                  {auction.bids.slice(0, 8).map((b, i) => {
                    const isWinner =
                      auction.awardedBid &&
                      auction.awardedBid.ts === b.ts &&
                      auction.awardedBid.initials === b.initials;
                    return (
                      <div
                        key={`${b.ts}-${i}`}
                        className={`min-w-0 rounded-xl border px-3 py-2 text-sm ${
                          isWinner
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-slate-100 bg-slate-50/60"
                        }`}
                      >
                        <GebotszeileRow
                          bid={b}
                          timeLabel={formatRelative(b.ts, now)}
                          timeSuffix={
                            isWinner ? (
                              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                Gewinner
                              </span>
                            ) : undefined
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WinnerDecision({
  auction,
  winnerBid,
  onAccept,
  onReject,
}: {
  auction: Auction;
  winnerBid: Bid;
  onAccept: () => void | Promise<void>;
  onReject: () => void;
}) {
  const totalBids = auction.bids.length;
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border-2 border-emerald-300 bg-emerald-50/70">
      <div className="flex items-center justify-between gap-3 border-b border-emerald-200/70 bg-white/60 px-5 py-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
          Gewinner-Angebot
        </span>
        <span className="text-[11px] font-medium text-emerald-700/80">
          aus {totalBids} {totalBids === 1 ? "Gebot" : "Geboten"}
        </span>
      </div>
      <div className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <FahrerInfoBlock
              initials={winnerBid.initials}
              verifiziert={winnerBid.verifiziert}
              bewertung={winnerBid.bewertung}
              initialsClassName="text-base font-bold text-slate-900"
            />
            <div className="mt-1 text-xs text-slate-500">
              Anonym bis zur Auftragserteilung
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-700/80">
              Tiefstes Gebot
            </div>
            <div className="mt-0.5 text-3xl font-extrabold tabular-nums text-emerald-800">
              CHF {winnerBid.price}
            </div>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-white/70 px-3 py-2.5 text-xs leading-relaxed text-emerald-900 ring-1 ring-emerald-200/60">
          Mit der Auftragserteilung akzeptierst du den vereinbarten Preis. Es
          folgt unmittelbar die Zahlung (Stripe oder Testmodus).
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onReject}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Ablehnen
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent-500)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 transition-colors hover:bg-[var(--color-accent-600)] btn-action-shine"
          >
            Auftrag erteilen
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * QR nur nach bestätigter Zahlung (nicht bei pending_payment / vor Checkout).
 * DB: Stripe → `awarded` + qr_token; Sim → `bezahlt_simuliert` + qr_token.
 */
function auctionShowsPaidHandoverQr(a: Auction): boolean {
  const token = a.qrToken?.trim();
  if (!token) return false;
  const st = String(a.auctionStatus ?? "").trim();
  return (
    st === "bezahlt_simuliert" ||
    st === "bezahlt" ||
    st === "awarded"
  );
}

function AuftragQrNachErteilung({ auction }: { auction: Auction }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!auctionShowsPaidHandoverQr(auction)) {
      setDataUrl(null);
      return;
    }
    const id = auction.id?.trim() ?? "";
    const token = auction.qrToken!.trim();
    if (!id) {
      setDataUrl(null);
      return;
    }
    const payload = JSON.stringify({ auftrag_id: id, token });
    void QRCode.toDataURL(payload, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [auction.id, auction.qrToken, auction.auctionStatus]);
  if (!dataUrl) return null;
  return (
    <div className="flex flex-col items-center border-b border-emerald-100 bg-white px-5 py-4">
      <img
        src={dataUrl}
        alt=""
        className="h-auto w-full max-w-[280px] rounded-lg"
      />
      <p className="mt-3 max-w-md text-center text-sm text-slate-600">
        {isAppTestMode()
          ? "Testmodus: QR mit Dummy-Daten (reale Übergabe im Live-Betrieb mit authentischem Code)."
          : "Leite diesen QR-Code an den Empfänger der Ware weiter. Er wird bei der Übergabe vom Transporteur gescannt."}
      </p>
    </div>
  );
}

type SimulatedPaymentMethod = "twint" | "card" | "wallet";

function IconTwintMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 72 40" aria-hidden>
      <path
        fill="none"
        stroke="#0066B3"
        strokeWidth="3.5"
        strokeLinecap="round"
        d="M10 28 C 22 8, 50 8, 62 28"
      />
      <path
        fill="none"
        stroke="#0096FF"
        strokeWidth="3.5"
        strokeLinecap="round"
        d="M10 12 C 22 32, 50 32, 62 12"
      />
    </svg>
  );
}

function IconCreditCardsGeneric({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 56 36" aria-hidden>
      <rect x="1" y="8" width="40" height="24" rx="3" fill="#1e3a5f" />
      <rect
        x="8"
        y="4"
        width="40"
        height="24"
        rx="3"
        fill="#f8fafc"
        stroke="#94a3b8"
        strokeWidth="1.25"
      />
      <rect x="12" y="10" width="10" height="7" rx="1" fill="#ca8a04" />
      <rect x="12" y="19" width="28" height="3.5" rx="0.75" fill="#cbd5e1" />
      <circle cx="40" cy="24" r="3.5" fill="#1434cb" />
      <circle cx="46" cy="24" r="3.5" fill="#eb001b" />
    </svg>
  );
}

function IconAppleSilhouette({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 30" aria-hidden>
      <path
        fill="currentColor"
        d="M17.7 15.7c.1-2.4 2-3.7 2.1-3.7-.1.6-.8 2-1.6 2.9-.8.9-1.7 1.5-2.7 1.5h-.1c-.4 0-1.2-.4-2-.4-.9 0-1.7.4-2.1.4h-.1c-1.1-.1-2-1-2.9-2.2-1.7-2.4-1.4-6 1.5-7.5 1.2-.1 2.2.7 2.9.7.7 0 1.5-.7 2.9-.7.5 0 1.9.1 2.9 1.1-.1 0-.2.1-.2.1-1.7 1-1.4 3.5 1.2 3.4zm-3.6-12.2c.8-.9 1.3-2.1 1.2-3.4-1.1 0-2.4.7-3.2 1.7-.7.8-1.3 2.2-1.1 3.5 1.2.1 2.3-.6 3.1-1.8z"
      />
    </svg>
  );
}

function IconGooglePayMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AwardedSection({
  auction,
  awardedBid,
  refreshAuctions,
  completePendingPaymentMock,
}: {
  auction: Auction;
  awardedBid: Bid;
  refreshAuctions: () => Promise<void>;
  completePendingPaymentMock: (anzeigeId: string) => void;
}) {
  const { user } = useAuth();
  const mockInfo = useMemo(
    () => getTransporterInfo(awardedBid.initials),
    [awardedBid.initials],
  );
  const [info, setInfo] = useState({
    kontakt: mockInfo.kontakt,
    telefon: mockInfo.telefon,
    email: mockInfo.email,
  });
  const [payBusy, setPayBusy] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [payUi, setPayUi] = useState<"idle" | "test_modal" | "simulate_modal">(
    "idle",
  );
  const [simulatedPaymentMethod, setSimulatedPaymentMethod] =
    useState<SimulatedPaymentMethod>("twint");

  useEffect(() => {
    if (payUi === "test_modal" || payUi === "simulate_modal") {
      setSimulatedPaymentMethod("twint");
    }
  }, [payUi]);

  const pendingPay = auction.auctionStatus === "pending_payment";
  const showHandoverQr = auctionShowsPaidHandoverQr(auction);
  const [paymentKick, setPaymentKick] = useState(0);

  useEffect(() => {
    if (auction.auctionStatus !== "pending_payment") {
      try {
        sessionStorage.removeItem(`stripe_ck_${auction.id}`);
      } catch {
        /* ignore */
      }
    }
  }, [auction.auctionStatus, auction.id]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("checkout") !== "cancel") return;
    if ((q.get("auction") ?? "").trim() !== auction.id.trim()) return;
    try {
      sessionStorage.removeItem(`stripe_ck_${auction.id}`);
    } catch {
      /* ignore */
    }
    setPayErr(null);
    const u = new URL(window.location.href);
    u.searchParams.delete("checkout");
    u.searchParams.delete("auction");
    const qs = u.searchParams.toString();
    window.history.replaceState(
      {},
      "",
      u.pathname + (qs ? `?${qs}` : "") + u.hash,
    );
    setPaymentKick((k) => k + 1);
  }, [auction.id]);

  useEffect(() => {
    if (auction.auctionStatus !== "pending_payment") return;
    if (payErr) return;
    if (payBusy || payUi !== "idle") return;

    let cancelled = false;
    const ck = `stripe_ck_${auction.id}`;

    const run = async () => {
      if (isAppTestMode()) {
        if (!cancelled) setPayUi("test_modal");
        return;
      }
      if (!useSupabase || !supabase) return;
      try {
        if (sessionStorage.getItem(ck) === "pending") return;
        sessionStorage.setItem(ck, "pending");
      } catch {
        /* ignore */
      }
      setPayBusy(true);
      try {
        const r = await sbAukt.auctionZahlungCreateCheckout(auction.id);
        if (cancelled) return;
        if (r.ok) {
          try {
            sessionStorage.setItem(ck, "redirect");
          } catch {
            /* ignore */
          }
          window.location.assign(r.url);
          return;
        }
        try {
          sessionStorage.removeItem(ck);
        } catch {
          /* ignore */
        }
        if (r.error === "no_stripe") {
          if (!cancelled) setPayUi("simulate_modal");
          return;
        }
        if (!cancelled) {
          setPayErr(
            "Checkout konnte nicht gestartet werden. Bitte später erneut versuchen.",
          );
        }
      } finally {
        if (!cancelled) setPayBusy(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    auction.auctionStatus,
    auction.id,
    payErr,
    payBusy,
    payUi,
    paymentKick,
  ]);

  useEffect(() => {
    if (auction.auctionStatus === "pending_payment") return;
    const fallback = () =>
      setInfo({
        kontakt: mockInfo.kontakt,
        telefon: mockInfo.telefon,
        email: mockInfo.email,
      });

    if (!useSupabase || !supabase) {
      fallback();
      return;
    }

    let cancelled = false;
    void (async () => {
      const idFromAuction = String(auction.awardedTransporteurId ?? "").trim();
      const tid =
        idFromAuction ||
        (awardedBid.bidderKey?.trim()
          ? await sbAukt.findTransporteurIdByUsername(awardedBid.bidderKey)
          : null);
      if (!tid) {
        if (!cancelled) fallback();
        return;
      }
      const { data, error } = await supabase
        .from("transporteure")
        .select("vorname_kontakt, name_kontakt, telefon, email")
        .eq("id", tid)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        console.warn("[AwardedSection] transporteure", error, { tid });
        fallback();
        return;
      }
      const vk = String(data.vorname_kontakt ?? "").trim();
      const nk = String(data.name_kontakt ?? "").trim();
      const kontakt =
        [vk, nk].filter(Boolean).join(" ").trim() || nk || vk || "—";
      setInfo({
        kontakt,
        telefon: String(data.telefon ?? "").trim() || "—",
        email: String(data.email ?? "").trim() || "—",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    auction.auctionStatus,
    auction.awardedTransporteurId,
    auction.id,
    awardedBid.bidderKey,
    mockInfo,
  ]);

  async function confirmSimulatedPayment() {
    setPayErr(null);
    setPayBusy(true);
    try {
      if (useSupabase && supabase) {
        let ok = false;
        const r = await sbAukt.auctionZahlungSimulate(auction.id);
        if (r.ok) {
          ok = true;
        } else if (isAppTestMode() && user?.userId) {
          const qrTok =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : null;
          if (qrTok) {
            const piSim = `pi_sim_${qrTok.replace(/-/g, "")}`;
            const { data: rowUpd, error: uerr } = await supabase
              .from("auktionen")
              .update({
                status: "bezahlt_simuliert",
                qr_token: qrTok,
                payment_intent_id: piSim,
              })
              .eq("anzeige_id", auction.id.trim())
              .eq("auftraggeber_id", user.userId)
              .eq("status", "pending_payment")
              .select("anzeige_id")
              .maybeSingle();
            if (!uerr && rowUpd) ok = true;
            else
              console.warn(
                "[AwardedSection] simulate payment client fallback",
                uerr,
              );
          }
        }
        if (ok) {
          await refreshAuctions();
          void supabase.functions.invoke("auftrag-qr-email", {
            body: { anzeige_id: auction.id },
          });
        } else {
          setPayErr("Zahlung konnte nicht bestätigt werden.");
        }
      } else {
        completePendingPaymentMock(auction.id);
      }
    } finally {
      setPayBusy(false);
      setPayUi("idle");
    }
  }

  const subject = encodeURIComponent(
    `Auftrag ${auction.id}: ${auction.startort} → ${auction.zielort}`,
  );

  const closePayModal = () => {
    if (payBusy) return;
    setPayUi("idle");
    setPaymentKick((k) => k + 1);
  };

  return (
    <>
      {pendingPay && payErr && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900">
          <p className="font-medium">{payErr}</p>
          <button
            type="button"
            onClick={() => {
              setPayErr(null);
              setPaymentKick((k) => k + 1);
            }}
            className="mt-2 text-xs font-semibold text-red-800 underline-offset-2 hover:underline"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {!pendingPay && (
        <div className="mt-5 overflow-hidden rounded-2xl border-2 border-emerald-400 bg-white">
          <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-800">
            <span className="grid size-6 place-items-center rounded-full bg-emerald-600 text-white">
              <Check className="size-3.5" />
            </span>
            Auftrag erteilt – Kontaktdaten freigegeben
          </div>
          {auction.auctionStatus === "bezahlt" && (
            <div className="border-b border-emerald-100 bg-emerald-50/90 px-5 py-3 text-sm text-emerald-900">
              <p className="font-semibold">
                Lieferung bestätigt – Zahlung erfolgt.
              </p>
              <p className="mt-1 text-slate-700">
                Vielen Dank für die Nutzung von 321 meins.
              </p>
            </div>
          )}
          <div className="p-5">
            <div className="min-w-0">
              <FahrerInfoBlock
                initials={awardedBid.initials}
                verifiziert={awardedBid.verifiziert}
                bewertung={awardedBid.bewertung}
                initialsClassName="text-base font-bold text-slate-900"
              />
              <div className="mt-2 text-xs text-slate-500">
                Vereinbarter Preis:{" "}
                <span className="font-bold tabular-nums text-slate-900">
                  CHF {awardedBid.price}
                </span>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Kontakt</dt>
              <dd className="font-medium text-slate-900">{info.kontakt}</dd>
              <dt className="text-slate-500">Telefon</dt>
              <dd>
                <a
                  href={`tel:${info.telefon.replace(/\s+/g, "")}`}
                  className="font-medium text-[var(--color-brand-700)] underline-offset-2 hover:underline"
                >
                  {info.telefon}
                </a>
              </dd>
              <dt className="text-slate-500">E-Mail</dt>
              <dd>
                <a
                  href={`mailto:${info.email}?subject=${subject}`}
                  className="font-medium text-[var(--color-brand-700)] underline-offset-2 hover:underline"
                >
                  {info.email}
                </a>
              </dd>
            </dl>

            {showHandoverQr && (
              <p className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-sm font-medium text-emerald-900">
                {auction.auctionStatus === "bezahlt_simuliert"
                  ? "Zahlung erfolgreich simuliert – Dein QR-Code wird jetzt generiert."
                  : "Zahlung erfolgreich – Dein QR-Code wird jetzt generiert."}
              </p>
            )}

            <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
              Der Transporteur wurde per Benachrichtigung und E-Mail über den
              Zuschlag informiert.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`mailto:${info.email}?subject=${subject}`}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-700)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-800)] btn-action-shine"
              >
                Transporteur kontaktieren
                <ArrowRight className="size-4" />
              </a>
            </div>
          </div>
          {showHandoverQr && <AuftragQrNachErteilung auction={auction} />}
        </div>
      )}

      {payUi !== "idle" && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={closePayModal}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !payBusy) closePayModal();
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/15 ring-1 ring-black/5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sim-pay-title"
            onClick={(e) => e.stopPropagation()}
          >
            {payUi === "test_modal" ? (
              <div className="border-b border-amber-200/90 bg-amber-50 px-5 py-3.5 text-xs leading-relaxed text-amber-950">
                <span className="font-bold">Testmodus.</span> Es wird keine
                echte Abbuchung ausgelöst – du wählst nur eine simulierte
                Zahlungsart.
              </div>
            ) : (
              <div className="border-b border-slate-200 bg-slate-100 px-5 py-3.5 text-xs leading-relaxed text-slate-800">
                <span className="font-bold">Stripe nicht verbunden.</span> Wähle
                eine simulierte Methode; es erfolgt kein echter Einzug.
              </div>
            )}
            <div className="bg-white px-6 pb-6 pt-5">
              <h4
                id="sim-pay-title"
                className="text-base font-bold tracking-tight text-slate-900"
              >
                Zahlungsmethode wählen
              </h4>
              <p className="mt-1.5 text-sm leading-snug text-slate-600">
                Tippe eine Option. Die Auswahl dient nur der Simulation – im
                Live-Betrieb würdest du hier mit TWINT, Karte oder Wallet
                bezahlen.
              </p>
              <div
                className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3"
                role="radiogroup"
                aria-label="Simulierte Zahlungsmethode"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={simulatedPaymentMethod === "twint"}
                  disabled={payBusy}
                  onClick={() => setSimulatedPaymentMethod("twint")}
                  className={`flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-2xl border-2 px-3 py-4 text-center transition-all disabled:opacity-60 ${
                    simulatedPaymentMethod === "twint"
                      ? "border-[var(--color-accent-500)] bg-white shadow-lg shadow-orange-900/10 ring-2 ring-[var(--color-accent-500)]/25"
                      : "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white hover:shadow-md"
                  }`}
                >
                  <IconTwintMark className="h-11 w-20 shrink-0" />
                  <span className="text-sm font-bold text-slate-900">TWINT</span>
                  <span className="text-[11px] font-medium leading-tight text-slate-500">
                    Sofort (Simulation)
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={simulatedPaymentMethod === "card"}
                  disabled={payBusy}
                  onClick={() => setSimulatedPaymentMethod("card")}
                  className={`flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-2xl border-2 px-3 py-4 text-center transition-all disabled:opacity-60 ${
                    simulatedPaymentMethod === "card"
                      ? "border-[var(--color-accent-500)] bg-white shadow-lg shadow-orange-900/10 ring-2 ring-[var(--color-accent-500)]/25"
                      : "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white hover:shadow-md"
                  }`}
                >
                  <IconCreditCardsGeneric className="h-11 w-[4.5rem] shrink-0" />
                  <span className="text-sm font-bold text-slate-900">
                    Kreditkarte
                  </span>
                  <span className="text-[11px] font-medium leading-tight text-slate-500">
                    Visa / Mastercard (Simulation)
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={simulatedPaymentMethod === "wallet"}
                  disabled={payBusy}
                  onClick={() => setSimulatedPaymentMethod("wallet")}
                  className={`flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-2xl border-2 px-3 py-4 text-center transition-all disabled:opacity-60 ${
                    simulatedPaymentMethod === "wallet"
                      ? "border-[var(--color-accent-500)] bg-white shadow-lg shadow-orange-900/10 ring-2 ring-[var(--color-accent-500)]/25"
                      : "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white hover:shadow-md"
                  }`}
                >
                  <div className="flex h-11 shrink-0 items-center justify-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white">
                      <IconAppleSilhouette className="h-6 w-5" />
                    </div>
                    <IconGooglePayMark className="size-10 shrink-0" />
                  </div>
                  <span className="text-sm font-bold leading-tight text-slate-900">
                    Apple Pay / Google Pay
                  </span>
                  <span className="text-[11px] font-medium leading-tight text-slate-500">
                    Wallet (Simulation)
                  </span>
                </button>
              </div>
              <div className="mt-8 flex flex-col items-center gap-3 border-t border-slate-100 pt-6">
                <button
                  type="button"
                  disabled={payBusy}
                  onClick={() => void confirmSimulatedPayment()}
                  className="inline-flex w-full max-w-sm items-center justify-center rounded-full bg-[var(--color-accent-500)] px-8 py-3.5 text-base font-semibold text-white shadow-md shadow-orange-900/20 transition-colors hover:bg-[var(--color-accent-600)] disabled:cursor-not-allowed disabled:opacity-60 btn-action-shine"
                >
                  {payUi === "test_modal"
                    ? "Zahlung bestätigen (Test)"
                    : "Zahlung simulieren"}
                </button>
                <button
                  type="button"
                  disabled={payBusy}
                  onClick={closePayModal}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RejectedSection({
  locked,
  lockRemaining,
  onRestart,
}: {
  locked: boolean;
  lockRemaining: number;
  onRestart: () => void;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h4 className="text-sm font-bold text-slate-900">
        Du hast alle Gebote abgelehnt.
      </h4>
      <p className="mt-1 text-sm text-slate-600">
        Du kannst diese Auktion in 60 Minuten erneut starten. Die Transporteure
        werden über die Ablehnung nicht informiert.
      </p>

      <div className="mt-4">
        {locked ? (
          <button
            type="button"
            disabled
            aria-disabled
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-400"
          >
            <span aria-hidden>🔒</span>
            Verfügbar in {formatLockMinutes(lockRemaining)}
          </button>
        ) : (
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-500)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 transition-colors hover:bg-[var(--color-accent-600)] btn-action-shine"
          >
            Auktion erneut starten
            <ArrowRight className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyEndedSection({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h4 className="text-sm font-bold text-slate-900">
        Für diese Auktion sind keine Gebote eingegangen.
      </h4>
      <p className="mt-1 text-sm text-slate-600">
        Möchtest du die Auktion erneut starten? Deine Daten werden ins Formular
        übernommen.
      </p>
      <div className="mt-4">
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-500)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 transition-colors hover:bg-[var(--color-accent-600)] btn-action-shine"
        >
          Auktion erneut starten
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function DimensionField({
  label,
  unit,
  name,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          type="text"
          inputMode="decimal"
          name={name}
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d.,]/g, "");
            onChange(name, v);
          }}
          placeholder="0"
          className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition-colors focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-500)]/20"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-slate-400">
          {unit}
        </span>
      </div>
    </div>
  );
}

/* ---------- DURATION WHEEL (iOS-style, 3 columns) ---------- */
const WHEEL_ITEM = 44;
const WHEEL_HEIGHT = 5 * WHEEL_ITEM;
const WHEEL_PAD = WHEEL_HEIGHT / 2 - WHEEL_ITEM / 2;

function DurationWheel({
  value,
  onChange,
}: {
  value: DurationValue;
  onChange: (v: DurationValue) => void;
}) {
  return (
    <div className="mt-2 rounded-2xl border border-slate-200 bg-[var(--color-surface-alt)] p-5">
      <div className="flex items-start justify-center gap-3 sm:gap-5">
        <WheelColumn
          label="Tage"
          max={7}
          value={value.days}
          onValueChange={(v) => onChange({ ...value, days: v })}
        />
        <WheelColumn
          label="Stunden"
          max={23}
          value={value.hours}
          onValueChange={(v) => onChange({ ...value, hours: v })}
        />
        <WheelColumn
          label="Minuten"
          max={59}
          value={value.minutes}
          onValueChange={(v) => onChange({ ...value, minutes: v })}
        />
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">
        Wischen oder scrollen, um die Dauer einzustellen.
      </p>
    </div>
  );
}

function WheelColumn({
  label,
  max,
  value,
  onValueChange,
}: {
  label: string;
  max: number;
  value: number;
  onValueChange: (v: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const v = Math.min(max, Math.max(0, value));
    el.scrollTop = v * WHEEL_ITEM;
  }, [max, value]);

  const handleScroll = () => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => {
      const el = scroller.current;
      if (!el) return;
      const y = el.scrollTop;
      const v = Math.min(max, Math.max(0, Math.round(y / WHEEL_ITEM)));
      el.scrollTo({ top: v * WHEEL_ITEM, behavior: "smooth" });
      onValueChange(v);
    }, 100);
  };

  return (
    <div className="flex flex-col items-center">
      <span className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <div
        className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner"
        style={{ width: 88, height: WHEEL_HEIGHT }}
        role="group"
        aria-label={label}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 border-y-2 border-[var(--color-brand-700)]/70"
          style={{ height: WHEEL_ITEM }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-white to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-white to-transparent"
          aria-hidden
        />
        <div
          ref={scroller}
          onScroll={handleScroll}
          className="wheel-scroll h-full w-full snap-y snap-mandatory overflow-y-auto scroll-smooth"
          style={{ scrollbarWidth: "none" }}
        >
          <div style={{ height: WHEEL_PAD, flexShrink: 0 }} aria-hidden />
          {Array.from({ length: max + 1 }, (_, n) => (
            <div
              key={n}
              className="flex snap-center snap-always items-center justify-center font-mono text-2xl font-bold tabular-nums text-[var(--color-ink)]"
              style={{ height: WHEEL_ITEM, minHeight: WHEEL_ITEM }}
            >
              {String(n).padStart(2, "0")}
            </div>
          ))}
          <div style={{ height: WHEEL_PAD, flexShrink: 0 }} aria-hidden />
        </div>
      </div>
    </div>
  );
}

/* ---------- IMAGE DROP ---------- */
const MAX_IMAGES = 3;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function ImageDrop({
  value,
  onChange,
}: {
  value: File[];
  onChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    if (value.length === 0) {
      setPreviews([]);
      return;
    }
    const urls = value.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [value]);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted = Array.from(files).filter((f) =>
      ACCEPTED_IMAGE_TYPES.includes(f.type),
    );
    if (accepted.length === 0) return;
    const remaining = MAX_IMAGES - value.length;
    if (remaining <= 0) return;
    onChange([...value, ...accepted.slice(0, remaining)]);
  };

  const removeAt = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const canAddMore = value.length < MAX_IMAGES;
  const openPicker = () => {
    if (!canAddMore) return;
    inputRef.current?.click();
  };

  return (
    <div className="mt-1.5">
      <div
        onDragEnter={(e) => {
          if (!canAddMore) return;
          e.preventDefault();
          e.stopPropagation();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
        }}
        onDragOver={(e) => {
          if (!canAddMore) return;
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          if (!canAddMore) return;
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={openPicker}
        role="button"
        tabIndex={canAddMore ? 0 : -1}
        aria-disabled={!canAddMore}
        onKeyDown={(e) => {
          if (!canAddMore) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          !canAddMore
            ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
            : dragActive
              ? "cursor-pointer border-[var(--color-brand-500)] bg-[var(--color-brand-50)]"
              : "cursor-pointer border-slate-300 bg-slate-50 hover:border-[var(--color-brand-400)] hover:bg-white"
        }`}
      >
        <span className="grid size-10 place-items-center rounded-full bg-white text-[var(--color-brand-700)] ring-1 ring-slate-200">
          <Upload className="size-5" />
        </span>
        <p className="text-sm font-semibold text-slate-800">
          Bild hierher ziehen oder{" "}
          <span className="text-[var(--color-brand-700)] underline-offset-2 hover:underline">
            auswählen
          </span>{" "}
          – JPG, PNG oder WebP, max. 3 Dateien
        </p>
        {value.length > 0 && (
          <p className="text-xs text-slate-500">
            {value.length} von {MAX_IMAGES} Bildern ausgewählt
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {value.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="group relative size-24 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              {previews[idx] && (
                <img
                  src={previews[idx]}
                  alt={`Vorschau ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(idx);
                }}
                aria-label={`Bild ${idx + 1} entfernen`}
                className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-white/95 text-slate-700 shadow ring-1 ring-slate-200 transition-colors hover:bg-white hover:text-red-600"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-3.5"
                  aria-hidden
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type TransporteurFooterModalKind = "werden" | "vorteile" | "kosten" | null;

function TransporteurInfoModal({
  kind,
  onClose,
}: {
  kind: TransporteurFooterModalKind;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!kind) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind, onClose]);

  if (!kind) return null;

  const title =
    kind === "werden"
      ? "Wie werde ich Transporteur?"
      : kind === "vorteile"
        ? "Vorteile für Fahrer"
        : "Kosten & Provision";

  const body =
    kind === "werden" ? (
      <div className="space-y-4 text-sm leading-relaxed text-slate-600 md:text-base">
        <p>
          Auf 321 meins werden nur <strong className="font-semibold text-slate-900">verifizierte Transporteure</strong> zugelassen – damit Auftraggeber und Fahrer sich auf dieselbe Qualität verlassen können.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-slate-900">Registrierung:</strong>{" "}
            Eröffne dein Konto mit Firmendaten, gültiger{" "}
            <strong className="font-semibold text-slate-900">UID-Nummer</strong>{" "}
            (Format CHE-xxx.xxx.xxx) und lade einen{" "}
            <strong className="font-semibold text-slate-900">Versicherungsnachweis</strong>{" "}
            für deinen Transport hoch (PDF oder Bild).
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Manuelle Prüfung:</strong>{" "}
            Wir schauen uns deine Angaben persönlich an – in der Regel innerhalb von{" "}
            <strong className="font-semibold text-slate-900">1–2 Werktagen</strong>.
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Freischaltung:</strong>{" "}
            Nach positiver Prüfung erhältst du ein{" "}
            <strong className="font-semibold text-slate-900">verifiziertes Profil mit „V“</strong>{" "}
            und kannst <strong className="font-semibold text-slate-900">sofort an Live-Auktionen mitbieten</strong>.
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Keine Einstiegskosten:</strong>{" "}
            <strong className="font-semibold text-slate-900">Keine Grundgebühr</strong>,{" "}
            <strong className="font-semibold text-slate-900">keine Monatsgebühren</strong> – du startest ohne Fixkosten auf der Plattform.
          </li>
        </ul>
        <p className="text-slate-500">
          Bereit? Wähle im Login die Rolle Transporteur und lege dein Profil in wenigen Minuten an.
        </p>
      </div>
    ) : kind === "vorteile" ? (
      <div className="space-y-4 text-sm leading-relaxed text-slate-600 md:text-base">
        <p>
          321 meins verbindet Auftraggeber und Transporteure –{" "}
          <strong className="font-semibold text-slate-900">live, fair und ohne Vermittlungs-Bingo</strong>. Als Fahrer profitierst du von einem klaren, digitalen Ablauf.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-slate-900">Leerfahrten füllen:</strong>{" "}
            Nutze freie Kapazität und entlege Strecken gezielt – und verdiene, wenn sich ein Preis für dich rechnet.
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Deine Zeit, deine Routen:</strong>{" "}
            Volle Flexibilität – du entscheidest, wann du aktiv bist und welche Aufträge du ins Auge fasst.
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Live-Auktionen:</strong>{" "}
            Faire Preisfindung in Echtzeit – transparent für alle Beteiligten.
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Vertrauen durch „V“:</strong>{" "}
            Verifizierte Profile mit einheitlichem Gütesiegel erhöhen die Akzeptanz bei Auftraggebern.
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Zahlungsabwicklung über Stripe:</strong>{" "}
            Der Auftraggeber bezahlt sicher ein; die Auszahlung an dich wird{" "}
            <strong className="font-semibold text-slate-900">erst nach erfolgreicher Lieferung ausgelöst</strong>, wenn der QR-Code beim Empfänger gescannt wurde.
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Bewertungen:</strong>{" "}
            Zuverlässige Lieferungen und freundlicher Service werden sichtbar – gute Arbeit kann sich bis zu{" "}
            <strong className="font-semibold text-slate-900">fünf Sternen</strong> auszahlen.
          </li>
        </ul>
      </div>
    ) : (
      <div className="space-y-4 text-sm leading-relaxed text-slate-600 md:text-base">
        <p>
          Auf 321 meins soll klar sein,{" "}
          <strong className="font-semibold text-slate-900">womit du als Transporteur rechnest</strong> – ohne Überraschungen im Kleingedruckten.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-slate-900">Registrierung:</strong>{" "}
            Kostenlos.
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Provision:</strong>{" "}
            <strong className="font-semibold text-slate-900">10&nbsp;% des vereinbarten Endpreises</strong>{" "}
            (des vom Auftraggeber angenommenen und bezahlten Transportpreises).
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Nur bei Erfolg:</strong>{" "}
            Provision fällig, wenn eine Vermittlung <strong className="font-semibold text-slate-900">erfolgreich abgeschlossen</strong> ist – nicht schon beim Bieten.
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Keine Standkosten auf der Plattform:</strong>{" "}
            Keine Grundgebühr, keine Monatsgebühren.
          </li>
          <li>
            <strong className="font-semibold text-slate-900">MwSt.:</strong>{" "}
            Preise und Provision verstehen sich <strong className="font-semibold text-slate-900">inklusive MwSt.</strong>, soweit schweizerisch anwendbar.
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Transparenz:</strong>{" "}
            Keine versteckten Plattformkosten aus unserer Sicht – du weisst vor Abgabe, wie sich die Provision auf dein Gebot auswirkt.
          </li>
        </ul>
      </div>
    );

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transporteur-info-modal-title"
        className="flex max-h-[min(82vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <h2
            id="transporteur-info-modal-title"
            className="text-base font-bold leading-snug text-slate-900 md:text-lg pr-2"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-xl leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Schliessen"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-6">
          {body}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FooterTransporteureCol({
  onOpenModal,
}: {
  onOpenModal: (k: Exclude<TransporteurFooterModalKind, null>) => void;
}) {
  const items: {
    kind: Exclude<TransporteurFooterModalKind, null>;
    label: string;
  }[] = [
    { kind: "werden", label: "Wie werde ich Transporteur?" },
    { kind: "vorteile", label: "Vorteile für Fahrer" },
    { kind: "kosten", label: "Kosten & Provision" },
  ];
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-900">Transporteure</h4>
      <ul className="mt-4 space-y-2.5">
        {items.map(({ kind, label }) => (
          <li key={kind}>
            <button
              type="button"
              onClick={() => onOpenModal(kind)}
              className="cursor-pointer text-left text-sm text-slate-600 transition-colors hover:text-[var(--color-brand-700)]"
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- FOOTER ---------- */
function Footer() {
  const [transporteurModal, setTransporteurModal] =
    useState<TransporteurFooterModalKind>(null);

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:grid-cols-5">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
            321 meins ist der Schweizer Marktplatz für faire, transparente
            Transport-Auktionen. Live. Sicher. Ohne versteckte Kosten.
          </p>
        </div>

        <FooterCol
          title="Produkt"
          links={[
            "So funktioniert's",
            "Preise",
            "Sicherheit",
            "Stimmen aus der Community",
          ]}
        />
        <FooterCol
          title="Unternehmen"
          links={["Über uns", "Kontakt", "AGB", "Impressum", "Datenschutz"]}
        />
        <FooterTransporteureCol onOpenModal={setTransporteurModal} />
      </div>

      <TransporteurInfoModal
        kind={transporteurModal}
        onClose={() => setTransporteurModal(null)}
      />

      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-5 text-xs text-slate-500 md:flex-row">
          <span>© {new Date().getFullYear()} 321 meins – Made in Switzerland</span>
          <span>Sicher. Vermittelt. Keine versteckten Kosten.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l}>
            <a
              href={
                l === "So funktioniert's"
                  ? "#so-funktionierts"
                  : l === "Preise"
                    ? "#faq"
                    : l === "Stimmen aus der Community"
                      ? "#stimmen-community"
                      : l === "Über uns"
                        ? "#/ueber-uns"
                        : l === "Kontakt"
                          ? "#/kontakt"
                          : l === "AGB"
                            ? "#/agb"
                            : l === "Impressum"
                              ? "#/impressum"
                              : l === "Datenschutz"
                                ? "#/datenschutz"
                                : "#"
              }
              className="text-sm text-slate-600 hover:text-[var(--color-brand-700)] transition-colors"
            >
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- SHARED ---------- */
function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={`max-w-2xl ${
        align === "center" ? "mx-auto text-center" : ""
      }`}
    >
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-600)]">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ---------- ICONS (inline SVG, kein externes Asset) ---------- */
type IconProps = { className?: string };

function ArrowRight({ className }: IconProps) {
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

function Check({ className }: IconProps) {
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

function Plus({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ShieldCheck({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function Truck({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 17V6a1 1 0 0 1 1-1h10v12" />
      <path d="M14 9h4l3 4v4h-2" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

function User({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function Pencil({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function Star({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 2.5 14.9 9l7.1.6-5.4 4.7 1.7 6.9L12 17.8 5.7 21.2l1.7-6.9L2 9.6 9.1 9 12 2.5Z" />
    </svg>
  );
}

function Upload({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8 12 3 7 8" />
      <path d="M12 3v12" />
    </svg>
  );
}

function Bolt({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
    </svg>
  );
}
