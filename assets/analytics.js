/* eureka///CONSULTING 計測スクリプト（2026-11-07）
   1) GA4：ページビュー＋コンバージョンのクリック（予約・お問い合わせフォーム・資料請求フォーム）＋CTAの位置＋スクロール
   2) 訪問者ごとの記録：訪問者ID・何回目の来訪か・見たページ・滞在時間・どのCTAを押したかを Apps Script（スプレッドシート）へ送る
   3) Googleフォームへ訪問者IDを自動入力し、問い合わせと閲覧履歴をつなぐ
   個人を特定する情報（氏名・メール等）はこのスクリプトでは扱わない。つながるのはフォームで本人が入力したときだけ。 */
(function () {
  var C = window.EU_CONFIG || {}; var FE = C.formEntries || {};
  var LS = (function () { try { localStorage.setItem('_t', '1'); localStorage.removeItem('_t'); return localStorage; } catch (e) { return null; } })();
  function get(k) { try { var m = document.cookie.match('(?:^|; )' + k + '=([^;]*)'); if (m) return decodeURIComponent(m[1]); return LS ? LS.getItem(k) : null; } catch (e) { return null; } }
  function set(k, v, days) { try { document.cookie = k + '=' + encodeURIComponent(v) + ';path=/;max-age=' + (days * 86400) + ';SameSite=Lax' + (location.protocol === 'https:' ? ';Secure' : ''); if (LS) LS.setItem(k, v); } catch (e) {} }
  function rid() { return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).toUpperCase(); }

  /* 訪問者ID・セッション（30分無操作で次の来訪） */
  var now = Date.now();
  var vid = get('eu_vid'); var isNew = !vid; if (!vid) { vid = 'V' + rid(); }
  var last = parseInt(get('eu_last') || '0', 10); var vc = parseInt(get('eu_vc') || '0', 10); var sid = get('eu_sid');
  if (!sid || now - last > 30 * 60 * 1000) { vc += 1; sid = 'S' + rid(); }
  set('eu_vid', vid, 730); set('eu_vc', String(vc), 730); set('eu_sid', sid, 1); set('eu_last', String(now), 730);
  if (isNew) set('eu_first', new Date(now).toISOString(), 730);

  /* 流入元（最初の来訪の参照元・UTMを保持） */
  var q = new URLSearchParams(location.search); var utm = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) { if (q.get(k)) utm[k] = q.get(k); });
  /* 営業メールのリンクに付けた会社コード（?c=）を保持 */
  if (q.get('c')) set('eu_co', q.get('c').slice(0, 40), 730);
  var co = get('eu_co') || '';
  if (!get('eu_src')) set('eu_src', JSON.stringify({ ref: document.referrer || '', utm: utm, landing: location.pathname }), 730);

  /* GA4 */
  window.dataLayer = window.dataLayer || []; function gtag() { dataLayer.push(arguments); } window.gtag = window.gtag || gtag;
  if (C.ga4Id) {
    var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + C.ga4Id; document.head.appendChild(s);
    gtag('js', new Date());
    gtag('set', 'user_properties', { eu_vid: vid, eu_visit_count: vc, eu_company: co });
    gtag('config', C.ga4Id, { eu_vid: vid, visit_number: vc, page_type: document.body.getAttribute('data-page') || '' });
  }
  function ga(ev, p) { if (C.ga4Id) gtag('event', ev, p || {}); }

  /* Apps Script への送信（sendBeacon、失敗しても画面には影響しない） */
  function send(type, data) {
    if (!C.collectorUrl) return;
    var body = JSON.stringify(Object.assign({ type: type, vid: vid, sid: sid, visit: vc, co: co, path: location.pathname, title: document.title, ts: new Date().toISOString(), ua: navigator.userAgent, lang: navigator.language, vw: window.innerWidth }, data || {}));
    try { if (navigator.sendBeacon) { navigator.sendBeacon(C.collectorUrl, new Blob([body], { type: 'text/plain' })); return; } } catch (e) {}
    try { fetch(C.collectorUrl, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: body }); } catch (e) {}
  }
  var src = {}; try { src = JSON.parse(get('eu_src') || '{}'); } catch (e) {}
  send('page_view', { referrer: document.referrer || '', utm: utm, first_source: src, new_visitor: isNew });

  /* 滞在時間（画面が見えている時間だけ数える）とスクロール深度 */
  var active = 0, since = document.visibilityState === 'visible' ? Date.now() : 0, maxScroll = 0, sent = {}, closed = false;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { if (since) { active += Date.now() - since; since = 0; } leave(); }
    else { since = Date.now(); closed = false; }
  });
  window.addEventListener('pagehide', leave);
  function leave() { if (closed) return; closed = true; var t = active + (since ? Date.now() - since : 0); send('page_leave', { seconds: Math.round(t / 1000), max_scroll: maxScroll }); }
  window.addEventListener('scroll', function () {
    var h = document.documentElement; var p = Math.round((h.scrollTop + window.innerHeight) / h.scrollHeight * 100); if (p > maxScroll) maxScroll = p;
    [25, 50, 75, 90].forEach(function (m) { if (maxScroll >= m && !sent[m]) { sent[m] = 1; ga('scroll_depth', { percent: m }); } });
  }, { passive: true });

  /* コンバージョンのリンクを判定 */
  function kind(a) {
    var h = a.href || '';
    if (a.dataset.cv) return a.dataset.cv;
    if (/calendar\.google\.com\/calendar\/appointments/.test(h)) return 'booking';
    if (/docs\.google\.com\/forms\/.*1FAIpQLSfJbBi37/.test(h)) return 'contact_form';
    if (/docs\.google\.com\/forms\/.*1FAIpQLSel-Zq9k/.test(h)) return 'document_form';
    if (/^mailto:/.test(h)) return 'email';
    if (/^tel:/.test(h)) return 'phone';
    return '';
  }
  function where(a) {
    if (a.dataset.loc) return a.dataset.loc;
    var map = [['.site-header', 'header'], ['.sticky-cta', 'sticky_mobile'], ['.hero', 'hero'], ['.cta-band', 'cta_band'], ['.cta-inline', 'inline'], ['#ma-contact', 'mitsumori_bottom'], ['.site-footer', 'footer']];
    for (var i = 0; i < map.length; i++) if (a.closest(map[i][0])) return map[i][1];
    return 'body';
  }
  /* フォームへ訪問者IDを自動入力（Googleフォームの事前入力URL） */
  document.querySelectorAll('a[href]').forEach(function (a) {
    var k = kind(a); if (!k) return;
    var key = k === 'contact_form' ? FE.contact : k === 'document_form' ? FE.document : '';
    if (key) { try { var u = new URL(a.href); u.searchParams.set('usp', 'pp_url'); u.searchParams.set(key, vid); a.href = u.toString(); } catch (e) {} }
  });
  var EV = { booking: 'booking_click', contact_form: 'contact_form_click', document_form: 'document_form_click', email: 'email_click', phone: 'phone_click' };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var k = kind(a); var loc = where(a); var label = (a.textContent || '').trim().slice(0, 60);
    if (k) {
      ga(EV[k], { cta_location: loc, link_text: label, page_path: location.pathname, link_url: a.href.split('?')[0] });
      ga('generate_lead', { lead_type: k, cta_location: loc });
      send('cv_click', { cv: k, cta_location: loc, label: label });
    } else if (a.classList.contains('btn-red') || a.classList.contains('btn-navy') || a.classList.contains('btn-sub') || a.classList.contains('door') || a.classList.contains('more')) {
      ga('cta_click', { cta_location: loc, link_text: label, page_path: location.pathname });
      send('cta_click', { cta_location: loc, label: label, to: a.getAttribute('href') });
    }
  });
  window.EU_VID = vid;
})();
