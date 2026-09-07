/* 321 meins – Service Worker (Web Push + App-Badge für iOS-PWA) */

const SW_VERSION = "2026-09-07-badge-v2";

/** Badge aus Push-Payload setzen – funktioniert auch bei geschlossener App (iOS: navigator.setAppBadge). */
async function applyBadgeFromPayload(raw) {
  const count = Math.max(0, Math.floor(Number(raw)));
  if (!Number.isFinite(count)) return;

  const nav = self.navigator;
  if (nav && typeof nav.setAppBadge === "function") {
    if (count > 0) await nav.setAppBadge(count);
    else if (typeof nav.clearAppBadge === "function") await nav.clearAppBadge();
    return;
  }

  const reg = self.registration;
  if (reg && typeof reg.setAppBadge === "function") {
    if (count > 0) await reg.setAppBadge(count);
    else if (typeof reg.clearAppBadge === "function") await reg.clearAppBadge();
  }
}

function parsePushPayload(event) {
  const fallback = {
    title: "321 meins",
    body: "",
    badge: 0,
    silent: false,
    url: "./",
  };
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

function isSilentPush(payload) {
  if (payload.silent === true) return true;
  const body = String(payload.body ?? "").trim();
  return body === "" || body === "\u200B";
}

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);
  const badge = payload.badge;
  const title = String(payload.title ?? "321 meins");
  const body = String(payload.body ?? "");
  const silent = isSilentPush(payload);

  event.waitUntil(
    (async () => {
      await applyBadgeFromPayload(badge);

      if (silent) return;

      await self.registration.showNotification(title, {
        body,
        badge: "favicon-32.png",
        icon: "favicon-32.png",
        tag: payload.tag ?? "321meins-live",
        renotify: true,
        data: { url: payload.url ?? "./", badge },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "./";
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
