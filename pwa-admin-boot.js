/**
 * Vor React: Backoffice per Query-Parameter (iOS behält ?backoffice=1, Hash oft nicht).
 */
(function () {
  try {
    var params = new URLSearchParams(window.location.search);
    if (params.get("backoffice") === "1") return;

    var nav = window.navigator;
    var isStandalone =
      nav.standalone === true ||
      (window.matchMedia &&
        (window.matchMedia("(display-mode: standalone)").matches ||
          window.matchMedia("(display-mode: fullscreen)").matches));
    if (!isStandalone) return;

    var hash = (window.location.hash || "").trim();
    if (hash.indexOf("#/admin") === 0) return;
    if (hash && hash !== "#/" && hash !== "#") return;

    var launchAdmin = params.get("launch") === "admin";
    var adminHint = window.localStorage.getItem("321meins-pwa-admin-hint") === "1";
    if (!launchAdmin && !adminHint) return;

    params.set("backoffice", "1");
    var qs = params.toString();
    var target = window.location.pathname + (qs ? "?" + qs : "");
    window.location.replace(target);
  } catch (e) {
    /* ignore */
  }
})();
