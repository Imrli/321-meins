import { useCallback, useState, useEffect, useSyncExternalStore } from "react";
import * as store from "@/lib/mockStore";
import { isMockMode } from "@/lib/isMockMode";
import type { Profil } from "@/types";

type AuthState = {
  loading: boolean;
  userId: string | null;
  profile: Profil | null;
};

export type AuthResult =
  | { error: string; profile: null }
  | { error: null; profile: Profil | null };

type RegisterInput = {
  email: string;
  password: string;
  benutzername: string;
  rolle: "kunde" | "transporteur";
};

function useMockAuth(): AuthState & {
  login: (b: string, p: string) => Promise<AuthResult>;
  register: (d: RegisterInput) => Promise<AuthResult>;
  logout: () => void;
} {
  const [boot, setBoot] = useState(true);
  useEffect(() => {
    setBoot(false);
  }, []);

  // useSyncExternalStore muss die gleiche Snapshot-Referenz wiederverwenden, sonst: Endlosschleife / leere Seite
  const state = useSyncExternalStore(
    (onStore) => {
      return store.subscribeMock(() => {
        syncAuthViewCache();
        onStore();
      });
    },
    () => authViewCache,
    getServerAuthSnapshot
  );

  const login = useCallback(
    async (benutzername: string, password: string): Promise<AuthResult> => {
      const r = store.mockLogin(benutzername, password);
      if (!r.ok) return { error: r.error, profile: null };
      return { error: null, profile: store.getSessionProfile() };
    },
    []
  );

  const register = useCallback(
    async (d: RegisterInput): Promise<AuthResult> => {
      const r = store.mockRegister(d);
      if (!r.ok) return { error: r.error, profile: null };
      return { error: null, profile: store.getSessionProfile() };
    },
    []
  );

  const logout = useCallback(() => {
    store.mockLogout();
  }, []);

  return {
    loading: boot,
    userId: state.userId,
    profile: state.profile,
    login,
    register,
    logout,
  };
}

type AuthView = { userId: string | null; profile: Profil | null };

let authViewCache: AuthView = readAuthView();

function readAuthView(): AuthView {
  return {
    userId: store.getSessionUserId(),
    profile: store.getSessionProfile(),
  };
}

function syncAuthViewCache() {
  authViewCache = readAuthView();
}

const serverAuthSnapshot: AuthView = { userId: null, profile: null };

function getServerAuthSnapshot() {
  return typeof document === "undefined" ? serverAuthSnapshot : authViewCache;
}

/**
 * Lokal: Mock-Auth. Später: hier Supabase-Session anbinden, wenn ‎VITE_MOCK=false.
 */
export function useAuth() {
  const mock = useMockAuth();

  if (!isMockMode()) {
    const pending: AuthResult = {
      error: "Supabase-Integration ist noch nicht aktiv (VITE_MOCK=false).",
      profile: null,
    };
    return {
      mode: "supabase-pending" as const,
      loading: false,
      userId: null,
      profile: null,
      login: async () => pending,
      register: async () => pending,
      logout: () => {},
    };
  }

  return {
    mode: "mock" as const,
    ...mock,
  };
}
