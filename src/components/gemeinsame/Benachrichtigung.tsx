import { useEffect, useRef, useState, useCallback } from "react";
import * as store from "@/lib/mockStore";
import { useAuth } from "@/hooks/useAuth";

type Toast = { id: string; text: string; kind: "neu" | "unterboten" };

/**
 * Lokal: neue Auktion + Unterboten-Hinweis (später: Supabase Realtime)
 */
export function Benachrichtigung() {
  const { profile, userId } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastKnown = useRef<Set<string>>(new Set());
  const seeded = useRef(false);

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  useEffect(() => {
    lastKnown.current = new Set();
    seeded.current = false;
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.rolle !== "transporteur" || userId == null) {
      return;
    }
    const uid = userId;

    function checkNewOrders() {
      const offen = store.listOffeneAuftraegeBoerse();
      if (!seeded.current) {
        for (const a of offen) lastKnown.current.add(a.id);
        seeded.current = true;
        return;
      }
      for (const a of offen) {
        if (!lastKnown.current.has(a.id)) {
          lastKnown.current.add(a.id);
          setToasts((t) => [
            ...t,
            { id: crypto.randomUUID(), text: "Neue Auktion in der Börse", kind: "neu" },
          ]);
        }
      }
    }

    function drainUndercuts() {
      for (;;) {
        const m = store.shiftUndercutMessage(uid);
        if (m == null) break;
        const text = m;
        setToasts((t) => [...t, { id: crypto.randomUUID(), text, kind: "unterboten" as const }]);
      }
    }

    const unsub = store.subscribeMock(() => {
      checkNewOrders();
      drainUndercuts();
    });
    checkNewOrders();
    drainUndercuts();
    return unsub;
  }, [profile?.rolle, userId]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed right-2 top-20 z-50 flex max-w-sm flex-col gap-2 sm:right-4"
      role="status"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={
            t.kind === "unterboten"
              ? "flex items-center justify-between gap-3 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-lg"
              : "flex items-center justify-between gap-3 rounded-[12px] border border-[#1E3A5F]/20 bg-white px-4 py-3 text-[#1F2937] shadow-lg"
          }
        >
          <p className="text-sm font-medium">{t.text}</p>
          <button
            type="button"
            className="shrink-0 text-[#6B7280] hover:text-[#1F2937]"
            onClick={() => dismiss(t.id)}
            aria-label="Schliessen"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
