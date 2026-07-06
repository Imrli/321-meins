import { createContext, useContext, type ReactNode } from "react";
import type { UserRole } from "../lib/supabaseAuth";

/** Eingeloggter Nutzer (Rolle aus Supabase-Session / Profil-Tabellen). */
export type AppSessionUser = {
  username: string;
  role: UserRole;
  initials?: string;
  userId?: string;
  email?: string;
};

type AppAuthSessionValue = {
  user: AppSessionUser | null;
};

const AppAuthSessionContext = createContext<AppAuthSessionValue | null>(null);

export function AppAuthSessionProvider({
  user,
  children,
}: {
  user: AppSessionUser | null;
  children: ReactNode;
}) {
  return (
    <AppAuthSessionContext.Provider value={{ user }}>
      {children}
    </AppAuthSessionContext.Provider>
  );
}

/**
 * Session-Rolle für UI (z. B. LiveAuctionTable).
 * Nutzt den Auth-State aus `App.tsx` (Supabase: `auftraggeber` / `transporteure`, kein separates `users.user_type`).
 */
export function useAppAuthSession(): AppAuthSessionValue {
  const ctx = useContext(AppAuthSessionContext);
  if (!ctx) {
    throw new Error(
      "useAppAuthSession must be used within AppAuthSessionProvider (inside App)",
    );
  }
  return ctx;
}

/**
 * Effektive Rolle: eingeloggter User, sonst optional `VITE_TEST_ROLE` für lokale Tests.
 */
export function resolveSessionRole(
  user: AppSessionUser | null,
): UserRole | null {
  const test = import.meta.env.VITE_TEST_ROLE?.trim();
  if (test === "transporteur" || test === "auftraggeber") return test;
  return user?.role ?? null;
}
