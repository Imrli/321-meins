import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function Login() {
  const { login, mode, loading } = useAuth();
  const [benutzername, setBenutzername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? "/";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const r = await login(benutzername, password);
    if (r.error) {
      setError(r.error);
      return;
    }
    const home = r.profile?.rolle === "kunde" ? "/kunde" : "/transporteur";
    const dest =
      from && from !== "/" && from !== "/anmelden" && from !== "/registrieren" ? from : home;
    navigate(dest, { replace: true });
  }

  if (mode === "supabase-pending") {
    return (
      <div className="page-321 max-w-md">
        <div className="card-321 bg-amber-50 text-amber-900">
          <p className="text-center">Supabase-Login folgt, sobald das Projekt verbunden ist.</p>
          <p className="mt-2 text-center text-sm">
            Lokal: <code className="rounded bg-amber-100 px-1">VITE_MOCK</code> nicht auf{" "}
            <code className="rounded bg-amber-100 px-1">false</code> setzen.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <p className="page-321 text-center text-[#6B7280]">Laden …</p>;
  }

  return (
    <div className="page-321 max-w-md">
      <h1 className="title-page-321">Anmelden</h1>
      <p className="caption-321 mt-2">Benutzername und Passwort (lokal, Demo).</p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="benutzername" className="label-321">
            Benutzername
          </label>
          <input
            id="benutzername"
            name="benutzername"
            autoComplete="username"
            className="input-321"
            value={benutzername}
            onChange={(e) => setBenutzername(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="label-321">
            Passwort
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="input-321"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="text-sm text-[#DC2626]" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary-321 w-full">
          Anmelden
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#6B7280]">
        Noch kein Konto?{" "}
        <Link to="/registrieren" className="font-semibold text-[#1E3A5F] hover:underline">
          Registrieren
        </Link>
      </p>
    </div>
  );
}
