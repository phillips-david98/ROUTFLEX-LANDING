/* Reviewed deployment configuration. Never read destinations from URL or storage. */
(function () {
  "use strict";
  const page = new URL(window.location.href);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(page.hostname);
  Object.defineProperty(window, "RoutflexAuthConfig", {
    value: Object.freeze({
      recoveryDemoEnabled: false,
      recoveryEnabled: local && page.protocol === "http:" && page.port === "5500",
      apiBase: local ? "http://localhost:3100/core" : new URL("/core", page.origin).href,
      moduleLinks: Object.freeze(local ? {
        planning: "http://localhost:8080/frontend/map.html",
        ops: "http://localhost:5173/",
        palm: "http://localhost:5173/palm",
        sales: "http://localhost:5174/",
      } : {}),
    }), writable: false, configurable: false,
  });
})();
