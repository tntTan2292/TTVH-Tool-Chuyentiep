// Cầu nối "Xử lý 3.0": Side Panel -> tab Pack & Send (world: MAIN).
// Cung cấp driver cho VNPCore.xuly30.createController: runStep(stepNo, codes).
// Tự chuyển tab đến đúng màn hình (6.2, 3.2, 3.8.1) rồi gọi window.VNPXuLy30.runStep trong trang.
(function (g) {
  'use strict';

  var SITE_PATTERN = 'https://packnsend.vnpost.vn/*';
  var STEP_PAGE = { 1: '6.2', 2: '6.2', 3: '3.2', 4: '3.8.1' };
  var PAGE_URL = {
    '6.2': 'https://packnsend.vnpost.vn/quan-ly-kho/danh-sach-cho-nhap-kho.html',
    '3.2': 'https://packnsend.vnpost.vn/lap-ban-ke-bd13.html',
    '3.8.1': 'https://packnsend.vnpost.vn/' + encodeURI('thêm-mới-vu-hồi-chuyến-thư.html')
  };
  var LOAD_TIMEOUT_MS = 30000;

  var tabId = null;

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function pickTab() {
    if (tabId !== null) {
      try {
        var t = await chrome.tabs.get(tabId);
        if (t && t.url && t.url.indexOf('https://packnsend.vnpost.vn/') === 0) return t;
      } catch (e) { /* tab đã đóng */ }
      tabId = null;
    }
    var tabs = await chrome.tabs.query({ url: SITE_PATTERN });
    if (!tabs.length) return null;
    var pick = tabs.filter(function (t) { return t.active; })[0] || tabs[0];
    tabId = pick.id;
    return pick;
  }

  function probe() {
    return {
      ready: !!(window.VNPXuLy30 && window.jQuery),
      page: window.VNPXuLy30 ? window.VNPXuLy30.where() : '',
      login: !!document.getElementById('fLogin') || /\/Account\/Login/i.test(location.pathname),
      path: location.pathname
    };
  }

  async function readProbe(id) {
    try {
      var r = await chrome.scripting.executeScript({ target: { tabId: id }, world: 'MAIN', func: probe });
      return r && r[0] && r[0].result;
    } catch (e) { return null; } // trang đang tải lại
  }

  // Đảm bảo tab đang ở đúng màn hình và đã nạp xong. Trả về null nếu ổn, hoặc kết quả runStep báo lỗi sớm.
  async function ensurePage(tab, pageKey) {
    var p = await readProbe(tab.id);
    if (p && p.login) return { sessionExpired: true, message: 'Tab Pack & Send đang ở trang đăng nhập. Hãy đăng nhập lại rồi chạy tiếp.' };
    if (!(p && p.ready && p.page === pageKey)) {
      await chrome.tabs.update(tab.id, { url: PAGE_URL[pageKey] });
      var t0 = Date.now();
      await sleep(800);
      for (;;) {
        p = await readProbe(tab.id);
        if (p && p.login) return { sessionExpired: true, message: 'Hệ thống chuyển về trang đăng nhập. Hãy đăng nhập lại rồi chạy tiếp.' };
        if (p && p.ready && p.page === pageKey) break;
        if (Date.now() - t0 > LOAD_TIMEOUT_MS) throw new Error('Không mở được màn hình ' + pageKey + ' (quá thời gian chờ). Kiểm tra quyền truy cập menu này.');
        await sleep(300);
      }
      await sleep(500);
    }
    return null;
  }

  // Kiểm tra trước khi chạy: có tab Pack & Send, đã đăng nhập.
  async function check() {
    var tab = await pickTab();
    if (!tab) return { ok: false, message: 'Không thấy tab Pack & Send đang mở. Hãy mở https://packnsend.vnpost.vn/, đăng nhập rồi thử lại.' };
    var p = await readProbe(tab.id);
    if (!p) return { ok: false, message: 'Không đọc được tab Pack & Send. Hãy tải lại tab (F5) rồi thử lại.' };
    if (p.login) return { ok: false, message: 'Tab Pack & Send đang ở trang đăng nhập. Hãy đăng nhập rồi thử lại.' };
    return { ok: true, tabId: tab.id };
  }

  function createDriver() {
    return {
      runStep: async function (stepNo, codes) {
        var tab = await pickTab();
        if (!tab) return { sessionExpired: true, message: 'Không thấy tab Pack & Send đang mở. Hãy mở lại tab, đăng nhập rồi chạy tiếp.' };
        var early = await ensurePage(tab, STEP_PAGE[stepNo]);
        if (early) return early;
        var res = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: function (n, list) { return window.VNPXuLy30.runStep(n, list); },
          args: [stepNo, codes]
        });
        var out = res && res[0] && res[0].result;
        if (!out) throw new Error('Trang không trả về kết quả (trang vừa tải lại?)');
        return out;
      }
    };
  }

  g.VNPXuLy30Bridge = { check: check, createDriver: createDriver };
})(window);
