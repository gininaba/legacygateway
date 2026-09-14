/* Legacy Gateway JS shim — injected only when "transpile JS" is enabled.
   Plain ES5. No dependencies beyond the polyfills loaded before it.

   Problem it solves: site JS often calls fetch('/api/x') or
   XHR.open('GET','/x'). Those resolve against OUR origin, not the real
   site. We rewrite path-absolute and absolute URLs back into the proxy
   namespace (/p/<scheme>/<host>/…) on the fly. Same-origin policy stays
   intact because every request still hits the gateway origin. */
(function () {
  "use strict";

  function baseUrl() {
    var m = document.querySelector('meta[name="lg-base"]');
    if (m) {
      var c = m.getAttribute("content");
      if (c) return c;
    }
    // Fallback: derive from the address bar /p/<scheme>/<host>/...
    var parts = String(location.pathname).split("/");
    if (parts[1] === "p" && parts[2] && parts[3]) {
      return parts[2] + "://" + parts[3] + "/";
    }
    return "";
  }

  var BASE = baseUrl();
  if (!BASE) return;
  var BASE_HOST = /^(https?:)\/\/([^/]+)/.exec(BASE);

  function toProxy(u) {
    if (!u || typeof u !== "string") return u;
    if (u.charAt(0) === "#") return u;
    if (/^(data|blob|javascript|mailto|about):/i.test(u)) return u;
    if (u.indexOf("/p/" + (BASE_HOST[1] === "https:" ? "https" : "http") + "/") === 0) return u; // already proxied
    if (/^https?:\/\//i.test(u)) {
      var m = /^(https?):\/\/([^/]+)([^?#]*)([\s\S]*)$/.exec(u);
      if (!m) return u;
      return "/p/" + m[1] + "/" + m[2] + (m[3] || "/") + (m[4] || "");
    }
    if (u.charAt(0) === "/" && u.charAt(1) !== "/") {
      return "/p/" + (BASE_HOST[1] === "https:" ? "https" : "http") + "/" + BASE_HOST[2] + u;
    }
    if (u.indexOf("//") === 0) {
      var s = BASE_HOST[1].replace(":", "");
      var m2 = /^\/\/([^/]+)([^?#]*)([\s\S]*)$/.exec(u);
      if (!m2) return u;
      return "/p/" + s + "/" + m2[1] + (m2[2] || "/") + (m2[3] || "");
    }
    return u; // relative: resolves inside /p/… naturally
  }

  // ---- fetch (polyfilled by whatwg-fetch) ---------------------------------
  if (window.fetch) {
    var _fetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        if (typeof input === "string") return _fetch(toProxy(input), init);
        if (input && input.url) {
          input = new Request(toProxy(input.url), input);
        }
      } catch (e) {}
      return _fetch(input, init);
    };
  }

  // ---- XMLHttpRequest -------------------------------------------------------
  if (window.XMLHttpRequest && window.XMLHttpRequest.prototype) {
    var _open = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function (method, url) {
      var args = Array.prototype.slice.call(arguments);
      try {
        args[1] = toProxy(url);
      } catch (e) {}
      return _open.apply(this, args);
    };
  }

  // ---- navigator.sendBeacon --------------------------------------------------
  if (window.navigator && window.navigator.sendBeacon) {
    var _beacon = window.navigator.sendBeacon.bind(window.navigator);
    window.navigator.sendBeacon = function (url, data) {
      try {
        return _beacon(toProxy(url), data);
      } catch (e) {
        return false;
      }
    };
  }

  // ---- window.open -----------------------------------------------------------
  if (window.open) {
    var _wo = window.open.bind(window);
    window.open = function (url, name, specs) {
      try {
        if (url) url = toProxy(String(url));
      } catch (e) {}
      return _wo(url, name, specs);
    };
  }

  // Neuter service worker registration (iOS 9 has none, but transpiled
  // bundles sometimes sniff for it and crash on undefined behavior).
  if (window.navigator && !("serviceWorker" in window.navigator)) {
    try {
      window.navigator.serviceWorker = {
        register: function () {
          return Promise.resolve({
            installing: null,
            waiting: null,
            active: null,
            scope: "/",
            update: function () {
              return Promise.resolve();
            },
            unregister: function () {
              return Promise.resolve(true);
            },
            addEventListener: function () {},
          });
        },
        getRegistration: function () {
          return Promise.resolve(undefined);
        },
        getRegistrations: function () {
          return Promise.resolve([]);
        },
      };
    } catch (e) {}
  }
})();
