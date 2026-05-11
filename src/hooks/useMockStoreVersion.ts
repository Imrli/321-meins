import { useEffect, useState } from "react";
import * as store from "@/lib/mockStore";

/**
 * Erzwingt Re-Render, wenn der Mock-Store (localStorage) Benachrichtigt.
 * (Bei useSyncExternalStore muss getSnapshot() dieselbe Referenz wiederverwenden
 *  — pro Listeninhalt wäre das aufwendig, daher ein simpler Tick.)
 */
export function useMockStoreVersion() {
  const [v, setV] = useState(0);
  useEffect(() => store.subscribeMock(() => setV((i) => i + 1)), []);
  return v;
}
