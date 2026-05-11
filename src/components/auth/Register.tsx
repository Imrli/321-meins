import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function Register() {
  const { register, mode, loading, profile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [benutzername, setBenutzername] = useState("");
  const [rolle, setRolle] = useState<"kunde" | "transporteur">("kunde");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (profile) {
      setError("Du bist schon angemeldet.");
      return;
    }
    setError(null);
    const res = await register({ email, password, benutzername, rolle });
    if (res.error) {
      setError(res.error);
      return;
    }
    navigate(rolle === "kunde" ? "/kunde" : "/transporteur", { replace: true });
  }

  if (mode === "supabase-pending") {
    return (
      <div className="page-321 max-w-md">
        <div className="card-321 bg-amber-50 text-amber-900">
          <p className="text-center">Registrierung per Supabase folgt.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <p className="page-321 text-center text-[#6B7280]">Laden …</p>;
  }

  const radioClass =
    "flex min-h-12 flex-1 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-[#1F2937] transition has-[:checked]:border-[#1E3A5F] has-[:checked]:ring-2 has-[:checked]:ring-[#1E3A5F]/20";

  return (
    <div className="page-321 max-w-md">
      <h1 className="title-page-321">Registrieren</h1>
      <p className="caption-321 mt-2">Konto als Versender (kostenlos) oder als Transporteur anlegen.</p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="label-321">
            E-Mail
          </label>
          <input
            id="email"
            type="email"
            className="input-321"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="benutzername" className="label-321">
            Benutzername
          </label>
          <input
            id="benutzername"
            className="input-321"
            value={benutzername}
            onChange={(e) => setBenutzername(e.target.value)}
            required
            minLength={2}
            autoComplete="username"
          />
        </div>

        <div>
          <label htmlFor="password" className="label-321">
            Passwort
          </label>
          <input
            id="password"
            type="password"
            className="input-321"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
            autoComplete="new-password"
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="label-321">Ich bin …</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className={radioClass}>
              <input
                type="radio"
                name="rolle"
                value="kunde"
                checked={rolle === "kunde"}
                onChange={() => setRolle("kunde")}
              />
              <span className="font-medium">Kunde (Versand)</span>
            </label>
            <label className={radioClass}>
              <input
                type="radio"
                name="rolle"
                value="transporteur"
                checked={rolle === "transporteur"}
                onChange={() => setRolle("transporteur")}
              />
              <span className="font-medium">Transporteur</span>
            </label>
          </div>
        </fieldset>

        {rolle === "transporteur" && (
          <p className="text-sm text-[#6B7280]">
            Transport: Zahlungspflicht – im Dashboard kannst du für Tests &quot;Zahlung aktiv&quot; setzen.
          </p>
        )}

        {error && (
          <p className="text-sm text-[#DC2626]" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary-321 w-full">
          Konto anlegen
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#6B7280]">
        Schon dabei?{" "}
        <Link to="/anmelden" className="font-semibold text-[#1E3A5F] hover:underline">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
