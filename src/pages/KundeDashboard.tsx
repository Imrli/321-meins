import { useAuth } from "@/hooks/useAuth";
import { AuftragErstellen } from "@/components/kunde/AuftragErstellen";
import { AuftragUebersicht } from "@/components/kunde/AuftragUebersicht";
import { Navigate } from "react-router-dom";

export function KundeDashboard() {
  const { profile, loading, mode } = useAuth();
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
  if (!profile || profile.rolle !== "kunde") {
    return <Navigate to="/anmelden" state={{ from: "/kunde" }} replace />;
  }
  return (
    <div className="page-321 flex flex-col gap-6">
      <header>
        <h1 className="title-page-321">Auktionen</h1>
        <p className="caption-321 mt-1">Hallo, {profile.benutzername}.</p>
      </header>
      <AuftragErstellen />
      <AuftragUebersicht />
    </div>
  );
}
