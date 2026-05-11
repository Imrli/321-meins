import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { AuftragsBoerse } from "@/components/transporteur/AuftragsBoerse";
import { EigeneGebote } from "@/components/transporteur/EigeneGebote";
import * as store from "@/lib/mockStore";
import { Benachrichtigung } from "@/components/gemeinsame/Benachrichtigung";

export function TransporteurDashboard() {
  const { profile, userId, loading, mode } = useAuth();

  if (mode === "supabase-pending") {
    return (
      <div className="page-321">
        <p className="text-amber-800">
          Lokal: VITE_MOCK nicht deaktivieren, bis Supabase angebunden ist.
        </p>
      </div>
    );
  }
  if (loading) return <p className="page-321 text-[#6B7280]">Laden …</p>;
  if (!profile || profile.rolle !== "transporteur" || !userId) {
    return <Navigate to="/anmelden" state={{ from: "/transporteur" }} replace />;
  }

  return (
    <div className="page-321 flex flex-col gap-6">
      <Benachrichtigung />

      <header>
        <h1 className="title-page-321">Börse</h1>
        <p className="caption-321 mt-1">Hallo, {profile.benutzername}.</p>
      </header>

      <section className="card-321 border-amber-200/80 bg-amber-50/70">
        <h2 className="text-sm font-semibold text-[#1E3A5F]">Zahlung (lokal testen)</h2>
        <p className="mt-2 text-sm text-[#6B7280]">
          Nur mit aktivem &quot;Zahlungsstatus&quot; darfst du bieten (wie später in der echten
          Lösung). Hier nur ein Schalter.
        </p>
        <label className="mt-4 flex min-h-12 max-w-sm cursor-pointer items-center gap-3 text-base font-medium text-[#1F2937]">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-slate-300 text-[#1E3A5F] focus:ring-[#1E3A5F]/30"
            checked={profile.zahlungsstatus}
            onChange={(e) => store.mockSetZahlungsstatus(userId, e.target.checked)}
          />
          Zahlung aktiv (Test)
        </label>
      </section>

      <AuftragsBoerse />

      <section className="flex flex-col gap-4">
        <h2 className="title-section-321">Meine Gebote</h2>
        <EigeneGebote />
      </section>
    </div>
  );
}
