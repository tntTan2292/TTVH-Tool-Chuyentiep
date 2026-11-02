// Cầu nối "Xử lý 3.0": Side Panel -> tab Pack & Send (world: MAIN).
// Cung cấp driver cho VNPCore.xuly30.createController: runStep(stepNo, codes).
// Tự chuyển tab đến đúng màn hình (6.2, 3.2, 3.8.1) rồi gọi window.VNPXuLy30.runStep trong trang.
(function (g) {
  'use strict';

  var SITE_PATTERN = 'https://packnsend.vnpost.vn/*';
  var STEP_PAGE = { 1: '6.2', 2: '6.2', 3: '3.2', 4: '3.8.1' };
  var PAGE_URL = {
    '6.2': '', // URL cũ của audit thực ra là 6.1; 6.2 được mở qua menu của trang
    '3.2': 'https://packnsend.vnpost.vn/lap-ban-ke-bd13.html',
    '3.8.1': 'https://packnsend.vnpost.vn/' + encodeURI('thêm-mới-vu-hồi-chuyến-thư.html')
  };
  var LOAD_TIMEOUT_MS = 30000;
  var EXPECTED_VERSION = 15; // phải khớp VERSION trong page/xuly30-page.js

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

  function probe(expected) {
    return {
      ready: !!(window.VNPXuLy30 && window.VNPXuLy30.version === expected && window.jQuery),
      page: window.VNPXuLy30 ? window.VNPXuLy30.where() : '',
      login: !!document.getElementById('fLogin') || /\/Account\/Login/i.test(location.pathname),
      path: location.pathname
    };
  }

  // Từ khóa nhận diện mục menu (đã bỏ dấu, chữ thường) cho từng màn hình.
  var MENU_WORDS = { '6.2': ['6.2', 'vu hoi'], '3.2': ['3.2', 'bd13'], '3.8.1': ['3.8.1'] };

  function findMenuLink(words) {
    function plain(t) { return String(t || '').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').toLowerCase(); }
    var as = document.querySelectorAll('a');
    for (var i = 0; i < as.length; i++) {
      var t = plain(as[i].textContent);
      if (words.every(function (w) { return t.indexOf(w) !== -1; })) {
        var h = as[i].getAttribute('href') || '';
        if (h && h !== '#' && h.indexOf('javascript') !== 0) return { href: as[i].href };
        as[i].click();
        return { clicked: true };
      }
    }
    return null;
  }

  async function readProbe(id) {
    try {
      var r = await chrome.scripting.executeScript({ target: { tabId: id }, world: 'MAIN', func: probe, args: [EXPECTED_VERSION] });
      return r && r[0] && r[0].result;
    } catch (e) { return null; } // trang đang tải lại
  }

  // Đảm bảo tab đang ở đúng màn hình và đã nạp xong. Trả về null nếu ổn, hoặc kết quả runStep báo lỗi sớm.
  async function ensurePage(tab, pageKey) {
    var p = await readProbe(tab.id);
    if (p && p.login) return { sessionExpired: true, message: 'Tab Pack & Send đang ở trang đăng nhập. Hãy đăng nhập lại rồi chạy tiếp.' };
    // Luôn nạp mới màn hình ở đầu mỗi bước (như người dùng F5 khi sang module/bước mới) để bỏ popup, bảng và trạng thái cũ.
    {
      var url = '';
      try {
        var ml = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: findMenuLink, args: [MENU_WORDS[pageKey]] });
        var link = ml && ml[0] && ml[0].result;
        if (link && link.href) url = link.href;
        else if (link && link.clicked) url = '__clicked__';
      } catch (e) { /* tab đang tải: dùng địa chỉ dự phòng */ }
      if (!url) url = PAGE_URL[pageKey];
      if (!url) throw new Error('Không tìm thấy mục menu ' + pageKey + ' trên trang Pack & Send. Hãy tự mở màn hình ' + pageKey + ' một lần rồi chạy lại.');
      var here = '';
      try { here = (await chrome.tabs.get(tab.id)).url || ''; } catch (e) { here = ''; }
      if (p && p.ready && p.page === pageKey && here) await chrome.tabs.reload(tab.id);
      else if (url !== '__clicked__') await chrome.tabs.update(tab.id, { url: url });
      var t0 = Date.now();
      await sleep(1000);
      for (;;) {
        p = await readProbe(tab.id);
        if (p && p.login) return { sessionExpired: true, message: 'Hệ thống chuyển về trang đăng nhập. Hãy đăng nhập lại rồi chạy tiếp.' };
        var cur = null;
        try { cur = await chrome.tabs.get(tab.id); } catch (e) { cur = null; }
        if (p && p.ready && p.page === pageKey && cur && cur.status === 'complete') break;
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
      runStep: async function (stepNo, codes, opts) {
        var tab = await pickTab();
        if (!tab) return { sessionExpired: true, message: 'Không thấy tab Pack & Send đang mở. Hãy mở lại tab, đăng nhập rồi chạy tiếp.' };
        var early = await ensurePage(tab, STEP_PAGE[stepNo]);
        if (early) return early;
        var res = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: function (n, list, o) { return window.VNPXuLy30.runStep(n, list, o); },
          args: [stepNo, codes, opts || {}]
        });
        var out = res && res[0] && res[0].result;
        if (!out) throw new Error('Trang không trả về kết quả (trang vừa tải lại?)');
        // Sau bước 3 tải lại tab (F5) để bỏ popup in BĐ13, kể cả khi đây là bước cuối của lượt chạy.
        var anyOk = out.perCode && Object.keys(out.perCode).some(function (k) { return out.perCode[k] && out.perCode[k].ok; });
        if (stepNo === 3 && !out.sessionExpired && anyOk) {
          try {
            await chrome.tabs.reload(tab.id);
            await sleep(1000);
            for (var w = 0; w < 40; w++) { // chờ tải lại xong (tối đa ~12 giây) rồi mới sang bước 4
              var cur = await chrome.tabs.get(tab.id);
              if (cur && cur.status === 'complete') break;
              await sleep(300);
            }
          } catch (e) { /* bỏ qua: bước 4 tự mở lại màn hình */ }
        }
        return out;
      }
    };
  }

  g.VNPXuLy30Bridge = { check: check, createDriver: createDriver };
})(window);
