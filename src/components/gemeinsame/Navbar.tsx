import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const linkBase =
  "min-h-11 inline-flex items-center rounded-lg px-3 text-base font-medium text-[#1F2937] transition hover:bg-slate-100";
const linkActive = "bg-[#1E3A5F]/10 text-[#1E3A5F] font-semibold";

export function Navbar() {
  const navigate = useNavigate();
  const { profile, logout, mode } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:max-w-4xl">
        <Link to="/" className="text-lg font-bold text-[#1E3A5F] sm:text-xl">
          321 meins
        </Link>
        {mode === "supabase-pending" && (
          <span className="text-xs font-medium text-amber-700 sm:text-sm">Supabase: bald</span>
        )}
        <nav className="flex flex-1 flex-wrap items-center justify-end gap-2">
          {!profile && (
            <>
              <Link to="/anmelden" className={linkBase}>
                Anmelden
              </Link>
              <Link
                to="/registrieren"
                className="btn-primary-321 inline-flex items-center justify-center min-h-11 px-4 text-base"
              >
                Registrieren
              </Link>
            </>
          )}
          {profile?.rolle === "kunde" && (
            <NavLink
              to="/kunde"
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ""}`}
            >
              Kunde
            </NavLink>
          )}
          {profile?.rolle === "transporteur" && (
            <NavLink
              to="/transporteur"
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ""}`}
            >
              Transport
            </NavLink>
          )}
          {profile && (
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/", { replace: true });
              }}
              className="btn-ghost-321 inline-flex items-center text-sm"
            >
              Abmelden
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
