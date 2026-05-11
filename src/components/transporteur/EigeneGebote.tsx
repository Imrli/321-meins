import * as store from "@/lib/mockStore";
import { useAuth } from "@/hooks/useAuth";
import { useMockStoreVersion } from "@/hooks/useMockStoreVersion";

function formatChf(n: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(
    n
  );
}

export function EigeneGebote() {
  const { userId } = useAuth();
  useMockStoreVersion();
  const rows = userId ? store.listEigeneGebote(userId) : [];

  if (!userId) return null;
  if (rows.length === 0) {
    return <p className="card-321 text-center text-[#6B7280]">Du hast noch keine Gebote abgegeben.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {rows.map(({ gebot, auftrag: a }) => (
        <li
          key={gebot.id}
          className="card-321 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-mono text-lg font-bold text-[#F4A261]">{formatChf(gebot.preis_chf)}</p>
            <p className="text-sm text-[#1F2937]">
              {a ? a.abholort : "?"} → {a ? a.zielort : "—"}
            </p>
            {a && (
              <p className="mt-1"><span className="badge-321">{store.getStatusLabel(a.status)}</span></p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
