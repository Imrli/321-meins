/* 321 meins – Service Worker (Web Push + Badge für iOS-PWA) */

self.addEventListener("push", (event) => {
  let payload = { title: "321 meins", body: "", badge: 0 };
  try {
    payload = { ...payload, ...JSON.parse(event.data?.text() ?? "{}") };
  } catch {
    /* ignore */
  }

  const badge = Number(payload.badge);
  const title = String(payload.title ?? "321 meins");
  const body = String(payload.body ?? "");

  event.waitUntil(
    (async () => {
      if (Number.isFinite(badge) && badge >= 0 && "setAppBadge" in self.registration) {
        try {
          if (badge > 0) await self.registration.setAppBadge(badge);
          else await self.registration.clearAppBadge();
        } catch {
          /* ignore */
        }
      }

      if (!body) return;

      await self.registration.showNotification(title, {
        body,
        badge: "favicon-32.png",
        icon: "favicon-32.png",
        data: { url: payload.url ?? "./" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
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
