/**
 * Synchron vor React (iOS-PWA): Backoffice-Hash setzen.
 * Wird aus index.html geladen – kein ES-Modul (sofortige Ausführung).
 */
(function () {
  try {
    var nav = window.navigator;
    var isIosPwa = nav.standalone === true;
    var isStandalone =
      isIosPwa ||
      (window.matchMedia &&
        (window.matchMedia("(display-mode: standalone)").matches ||
          window.matchMedia("(display-mode: fullscreen)").matches));
    if (!isStandalone) return;

    var hash = (window.location.hash || "").trim();
    if (hash.indexOf("#/admin") === 0) return;
    if (hash && hash !== "#/" && hash !== "#") return;

    var params = new URLSearchParams(window.location.search);
    var launchAdmin = params.get("launch") === "admin";
    var adminHint = window.localStorage.getItem("321meins-pwa-admin-hint") === "1";

    if (!launchAdmin && !adminHint) return;

    var target = window.location.pathname + window.location.search + "#/admin";
    window.location.replace(target);
  } catch (e) {
    /* ignore */
  }
})();
