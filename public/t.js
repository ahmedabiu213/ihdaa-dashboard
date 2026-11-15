/*
 * Ihdaa storefront tracker.
 * Install once in Google Tag Manager as a Custom HTML tag on All Pages:
 *   <script src="https://ihdaa-dashboard.vercel.app/t.js" async></script>
 *
 * What it does
 *   1. Remembers where the donor came from (UTMs or ad click IDs), last non-direct touch, for 30 days.
 *   2. Reports each page view (no personal data).
 *   3. On purchase, reports the order number + that touch, plus the amount as a fallback.
 *      Amounts reported here are UNVERIFIED; Salla's own order data replaces them.
 *
 * Debug: open the store with ?ihd_debug=1 (sticks for the browser) or ?ihd_debug=0 to stop.
 */
(function () {
  if (window.__ihdTracker) return;
  window.__ihdTracker = true;

  var script = document.currentScript;
  var BASE = script && script.src ? new URL(script.src).origin : "https://ihdaa-dashboard.vercel.app";
  var TOUCH_KEY = "ihd_touch", VID_KEY = "ihd_vid", SID_KEY = "ihd_sid", QUEUE_KEY = "ihd_queue", SENT_PREFIX = "ihd_sent_";
  var TOUCH_TTL = 30 * 24 * 3600 * 1000;
  // Ad click IDs, matched case-insensitively (Snapchat sends "ScCid").
  var CLICK_PARAMS = { sccid: "sccid", ttclid: "ttclid", gclid: "gclid", gbraid: "gbraid", wbraid: "wbraid", fbclid: "fbclid" };
  var PURCHASE_EVENTS = { purchase: 1, order_completed: 1, checkout_completed: 1, transaction: 1, ecommerce_purchase: 1 };

  /* ── storage helpers (all wrapped: private mode can throw) ── */
  function get(store, k) { try { return window[store].getItem(k); } catch (e) { return null; } }
  function set(store, k, v) { try { window[store].setItem(k, v); } catch (e) {} }
  function del(store, k) { try { window[store].removeItem(k); } catch (e) {} }
  function readJson(store, k, fallback) { try { return JSON.parse(get(store, k)) || fallback; } catch (e) { return fallback; } }
  function rid(p) { return p + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

  /* Cookies back up localStorage: some in-app browsers block or clear one but not the other. */
  function cookieGet(k) {
    try {
      var m = document.cookie.match(new RegExp("(?:^|; )" + k + "=([^;]*)"));
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) { return null; }
  }
  function cookieSet(k, v, days) {
    try {
      if (v.length > 1800) return; // stay well under the cookie size limit
      document.cookie = k + "=" + encodeURIComponent(v) + "; path=/; max-age=" + days * 86400 + "; SameSite=Lax" +
        (location.protocol === "https:" ? "; Secure" : "");
    } catch (e) {}
  }
  function getBoth(k) { return get("localStorage", k) || cookieGet(k); }
  function setBoth(k, v, days) { set("localStorage", k, v); cookieSet(k, v, days); }

  /* Query parameters with lowercase names, so UTM_Source / ScCid / sccid all match. */
  var params = (function () {
    var map = {}, raw = {};
    try {
      new URLSearchParams(location.search).forEach(function (v, k) { raw[k] = v; if (map[k.toLowerCase()] == null) map[k.toLowerCase()] = v; });
    } catch (e) {
      location.search.replace(/^\?/, "").split("&").forEach(function (pair) {
        var i = pair.indexOf("="); if (i < 1) return;
        try { var k = decodeURIComponent(pair.slice(0, i)), v = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, " ")); raw[k] = v; map[k.toLowerCase()] = v; } catch (e2) {}
      });
    }
    return { get: function (k) { var v = map[String(k).toLowerCase()]; return v == null ? null : v; } };
  })();
  if (params.get("ihd_debug") === "1") set("localStorage", "ihd_debug", "1");
  if (params.get("ihd_debug") === "0") del("localStorage", "ihd_debug");
  var DEBUG = get("localStorage", "ihd_debug") === "1";
  function log() { if (DEBUG) try { console.log.apply(console, ["[ihdaa]"].concat([].slice.call(arguments))); } catch (e) {} }

  var vid = getBoth(VID_KEY) || rid("v_");
  setBoth(VID_KEY, vid, 365);
  // A session ends after 30 minutes without a page view (session cookie + sessionStorage).
  var sid = get("sessionStorage", SID_KEY) || cookieGet(SID_KEY) || rid("s_");
  set("sessionStorage", SID_KEY, sid);
  cookieSet(SID_KEY, sid, 30 / 1440);

  /* ── 1. attribution touch ── */
  function externalReferrer() {
    try {
      if (!document.referrer) return null;
      var host = new URL(document.referrer).hostname;
      return host === location.hostname ? null : document.referrer;
    } catch (e) { return null; }
  }

  function captureTouch() {
    var t = {};
    // Platforms' own auto-tagging is captured as-is: TikTok puts the campaign name in
    // utm_campaign and its ID in utm_id. Source/medium are lowercased; names keep their case.
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id"].forEach(function (k) {
      var v = params.get(k);
      if (v) t[k] = (k === "utm_source" || k === "utm_medium" ? v.trim().toLowerCase() : v.trim()).slice(0, 200);
    });
    for (var p in CLICK_PARAMS) {
      var c = params.get(p);
      if (c) { t.click_type = CLICK_PARAMS[p]; t.click_id = c.slice(0, 300); break; }
    }
    var ref = externalReferrer();
    if (ref) t.referrer = ref.slice(0, 500);
    // Only a real source replaces the stored touch: a direct visit never erases an ad click.
    if (t.utm_source || t.click_id || t.referrer) {
      t.landing = (location.pathname + location.search).slice(0, 500);
      t.ts = Date.now();
      setBoth(TOUCH_KEY, JSON.stringify(t), 30);
      log("touch saved", t);
    }
  }

  function currentTouch() {
    var t = null;
    try { t = JSON.parse(getBoth(TOUCH_KEY)); } catch (e) {}
    if (t && t.ts && Date.now() - t.ts > TOUCH_TTL) { del("localStorage", TOUCH_KEY); cookieSet(TOUCH_KEY, "", 0); return null; }
    return t;
  }

  /* ── transport: text/plain avoids a CORS preflight ── */
  function post(path, body) {
    var data = JSON.stringify(body);
    if (typeof fetch === "function") {
      return fetch(BASE + path, {
        method: "POST", keepalive: true, credentials: "omit",
        headers: { "Content-Type": "text/plain" }, body: data
      });
    }
    // Very old browsers: sendBeacon gives no response, so report it as accepted.
    var ok = false;
    try { ok = navigator.sendBeacon(BASE + path, data); } catch (e) {}
    return { then: function (f) { if (ok) f({ ok: true, status: 202 }); return this; }, "catch": function (f) { if (!ok) f(); return this; } };
  }

  /* ── 2. page view ── */
  function trackVisit() {
    var body = {
      vid: vid, sid: sid, path: location.pathname.slice(0, 500), title: (document.title || "").slice(0, 300),
      referrer: externalReferrer(), q: location.search.slice(0, 600) || null, touch: currentTouch()
    };
    // One retry: mobile networks often drop the first request right after an ad click.
    post("/api/track/visit", body).then(function (r) { log("visit sent", r && r.status); })
      ["catch"](function () { setTimeout(function () { post("/api/track/visit", body)["catch"](function () {}); }, 2500); });
  }

  /* ── 3. purchases, with a retry queue that survives closed tabs ── */
  // Kept in memory too, so purchases still send when storage is blocked.
  var memQueue = [], memSent = {};
  function readQueue() {
    var stored = readJson("localStorage", QUEUE_KEY, []);
    return stored.length ? stored : memQueue;
  }
  function writeQueue(q) { memQueue = q.slice(-20); set("localStorage", QUEUE_KEY, JSON.stringify(memQueue)); }

  function flushQueue() {
    var q = readQueue();
    if (!q.length) return;
    var keep = [], pending = q.length;
    q.forEach(function (item) {
      if (Date.now() - item.at > 7 * 24 * 3600 * 1000 || item.tries >= 8) return done(null);
      post("/api/track/purchase", item.body).then(function (r) {
        if (r.ok || (r.status >= 400 && r.status < 500)) { log("purchase delivered", item.body.order_ref, r.status); done(null); }
        else { item.tries++; done(item); }
      }).catch(function () { item.tries++; done(item); });
    });
    function done(retry) { if (retry) keep.push(retry); if (--pending === 0) writeQueue(keep); }
  }

  function num(v) {
    if (v && typeof v === "object") v = v.amount != null ? v.amount : v.value;
    var n = parseFloat(v);
    return isFinite(n) ? n : null;
  }

  function reportPurchase(o, origin) {
    if (!o || typeof o !== "object") return;
    var ref = o.transaction_id || o.order_id || o.id || o.reference_id || o.order_number;
    if (ref == null || ref === "") return;
    ref = String(ref).slice(0, 64);
    if (memSent[ref] || get("localStorage", SENT_PREFIX + ref) || cookieGet(SENT_PREFIX + ref)) return log("already sent", ref);
    memSent[ref] = 1;
    set("localStorage", SENT_PREFIX + ref, String(Date.now()));
    cookieSet(SENT_PREFIX + ref, "1", 7);

    var items = (o.items || o.products || []).slice(0, 50).map(function (i) {
      return {
        product_id: num(i.item_id || i.product_id || i.id),
        name: String(i.item_name || i.name || "").slice(0, 300) || null,
        quantity: num(i.quantity) || 1,
        price: num(i.price)
      };
    });
    var body = {
      vid: vid, sid: sid, order_ref: ref,
      reference_id: o.reference_id != null ? String(o.reference_id) : null,
      total: num(o.value != null ? o.value : (o.revenue != null ? o.revenue : o.total)),
      currency: o.currency || null,
      items: items,
      touch: currentTouch()
    };
    log("purchase (" + origin + ")", body);
    var q = readQueue(); q.push({ body: body, at: Date.now(), tries: 0 }); writeQueue(q);
    flushQueue();
  }

  /* dataLayer formats: GA4 object, gtag() arguments, and Universal Analytics */
  function fromDataLayer(entry) {
    if (!entry) return null;
    if (typeof entry.length === "number" && entry[0] === "event") {
      return PURCHASE_EVENTS[String(entry[1]).toLowerCase()] ? entry[2] : null;
    }
    if (typeof entry !== "object" || !entry.event) return null;
    if (!PURCHASE_EVENTS[String(entry.event).toLowerCase()]) return null;
    var ec = entry.ecommerce || entry;
    if (ec.purchase) {
      var af = ec.purchase.actionField || {};
      return { transaction_id: af.id, value: af.revenue, items: ec.purchase.products || [] };
    }
    return ec;
  }

  function watchDataLayer() {
    window.dataLayer = window.dataLayer || [];
    var dl = window.dataLayer;
    for (var i = 0; i < dl.length; i++) {
      if (DEBUG && dl[i] && dl[i].event) log("dataLayer (existing)", dl[i].event, dl[i]);
      var p = fromDataLayer(dl[i]);
      if (p) reportPurchase(p, "dataLayer");
    }
    var orig = dl.push;
    dl.push = function () {
      var res = orig.apply(dl, arguments);
      for (var a = 0; a < arguments.length; a++) {
        if (DEBUG && arguments[a] && (arguments[a].event || arguments[a][0])) log("dataLayer push", arguments[a]);
        var p = fromDataLayer(arguments[a]);
        if (p) reportPurchase(p, "dataLayer");
      }
      return res;
    };
  }

  /* Fallback when the theme pushes no purchase event: an order number in the
     thank-you page address still links the donation to its ad source (no amount). */
  function thankYouFallback() {
    if (!/thank|success|order|checkout/i.test(location.pathname)) return;
    var ref = params.get("order_id") || params.get("order") || params.get("reference_id") || params.get("ref");
    var m = !ref && location.pathname.match(/(?:orders?|thank-?you|success)\/(\d{5,})/i);
    if (m) ref = m[1];
    if (ref) setTimeout(function () { reportPurchase({ order_id: ref }, "thank-you-url"); }, 3000);
  }

  /* Each step is isolated: a failure in one never stops the others. */
  function safe(name, fn) { try { fn(); } catch (e) { log(name + " failed", e && e.message); } }

  /* The theme may replace window.dataLayer after we hooked it, or push before GTM
     loaded us: re-scan for a minute so a purchase event is never missed. */
  function rescanDataLayer() {
    var runs = 0;
    var timer = setInterval(function () {
      runs++;
      safe("rescan", function () {
        var dl = window.dataLayer || [];
        for (var i = 0; i < dl.length; i++) { var p = fromDataLayer(dl[i]); if (p) reportPurchase(p, "dataLayer-rescan"); }
      });
      if (runs >= 40) clearInterval(timer);
    }, 1500);
  }

  function start() {
    safe("touch", captureTouch);
    safe("visit", trackVisit);
    safe("dataLayer", watchDataLayer);
    safe("rescan", rescanDataLayer);
    safe("thank-you", thankYouFallback);
    safe("queue", flushQueue);
  }

  // Prerendered pages are not real visits until they are shown.
  if (document.visibilityState === "prerender") {
    document.addEventListener("visibilitychange", function once() {
      if (document.visibilityState !== "prerender") { document.removeEventListener("visibilitychange", once); start(); }
    });
  } else {
    start();
  }
  log("loaded", { base: BASE, vid: vid, sid: sid, touch: currentTouch() });
})();
