/* 321 meins – Service Worker (Web Push + App-Badge, iOS-PWA) */

const SW_VERSION = "2026-09-11-pwa-admin-launch-v2";

/**
 * Badge aus Push-Payload setzen (iOS: nur über Push + self.navigator.setAppBadge).
 * @see https://webkit.org/blog/14112/badging-for-home-screen-web-apps/
 */
function setAppBadgeCount(count) {
  const n = Math.max(0, Math.floor(Number(count)));
  if (!Number.isFinite(n)) return Promise.resolve();

  const nav = self.navigator;
  if (!nav || !("setAppBadge" in nav)) return Promise.resolve();

  if (n > 0) return nav.setAppBadge(n);
  if ("clearAppBadge" in nav) return nav.clearAppBadge();
  return Promise.resolve();
}

function parsePushPayload(event) {
  const fallback = { title: "321 meins", body: "", badge: 0, url: "./" };
  if (!event.data) return fallback;
  try {
    return { ...fallback, ...event.data.json() };
  } catch {
    try {
      return { ...fallback, ...JSON.parse(event.data.text()) };
    } catch {
      return fallback;
    }
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);
  const badge = payload.badge;
  const title = String(payload.title ?? "321 meins");
  const body = String(payload.body ?? "").trim() || "Live-Auktionen aktualisiert.";

  /* iOS: Badge UND sichtbare Notification – sonst wird Push ignoriert / Badge nicht gesetzt. */
  event.waitUntil(
    Promise.all([
      setAppBadgeCount(badge),
      self.registration.showNotification(title, {
        body,
        badge: "favicon-32.png",
        icon: "favicon-32.png",
        tag: payload.tag ?? "321meins-badge",
        renotify: true,
        data: { url: payload.url ?? "./", badge },
      }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data?.url ?? "./";
  const base = new URL(raw, self.registration.scope);
  base.hash = "";
  const url = base.pathname + base.search;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
        return undefined;
      }),
  );
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

console.info("[sw]", SW_VERSION);
