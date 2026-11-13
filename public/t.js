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
  var CLICK_PARAMS = { sccid: "sccid", ScCid: "sccid", ttclid: "ttclid", gclid: "gclid", gbraid: "gbraid", wbraid: "wbraid", fbclid: "fbclid" };
  var PURCHASE_EVENTS = { purchase: 1, order_completed: 1, checkout_completed: 1, transaction: 1, ecommerce_purchase: 1 };

  /* ── storage helpers (all wrapped: private mode can throw) ── */
  function get(store, k) { try { return window[store].getItem(k); } catch (e) { return null; } }
  function set(store, k, v) { try { window[store].setItem(k, v); } catch (e) {} }
  function del(store, k) { try { window[store].removeItem(k); } catch (e) {} }
  function readJson(store, k, fallback) { try { return JSON.parse(get(store, k)) || fallback; } catch (e) { return fallback; } }
  function rid(p) { return p + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

  var params = new URLSearchParams(location.search);
  if (params.get("ihd_debug") === "1") set("localStorage", "ihd_debug", "1");
  if (params.get("ihd_debug") === "0") del("localStorage", "ihd_debug");
  var DEBUG = get("localStorage", "ihd_debug") === "1";
  function log() { if (DEBUG) try { console.log.apply(console, ["[ihdaa]"].concat([].slice.call(arguments))); } catch (e) {} }

  var vid = get("localStorage", VID_KEY) || rid("v_");
  set("localStorage", VID_KEY, vid);
  var sid = get("sessionStorage", SID_KEY) || rid("s_");
  set("sessionStorage", SID_KEY, sid);

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
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) {
      var v = params.get(k);
      if (v) t[k] = v.trim().toLowerCase().slice(0, 200);
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
      set("localStorage", TOUCH_KEY, JSON.stringify(t));
      log("touch saved", t);
    }
  }

  function currentTouch() {
    var t = readJson("localStorage", TOUCH_KEY, null);
    if (t && t.ts && Date.now() - t.ts > TOUCH_TTL) { del("localStorage", TOUCH_KEY); return null; }
    return t;
  }

  /* ── transport: text/plain avoids a CORS preflight ── */
  function post(path, body) {
    return fetch(BASE + path, {
      method: "POST", keepalive: true, credentials: "omit",
      headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body)
    });
  }

  /* ── 2. page view ── */
  function trackVisit() {
    post("/api/track/visit", {
      vid: vid, sid: sid, path: location.pathname.slice(0, 500), title: (document.title || "").slice(0, 300),
      referrer: externalReferrer(), touch: currentTouch()
    }).catch(function () {});
  }

  /* ── 3. purchases, with a retry queue that survives closed tabs ── */
  function readQueue() { return readJson("localStorage", QUEUE_KEY, []); }
  function writeQueue(q) { set("localStorage", QUEUE_KEY, JSON.stringify(q.slice(-20))); }

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
    if (get("localStorage", SENT_PREFIX + ref)) return log("already sent", ref);
    set("localStorage", SENT_PREFIX + ref, String(Date.now()));

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

  captureTouch();
  trackVisit();
  watchDataLayer();
  flushQueue();
  log("loaded", { base: BASE, vid: vid, sid: sid, touch: currentTouch() });
})();
