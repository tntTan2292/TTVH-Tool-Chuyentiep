// Cầu nối từ Side Panel sang bộ thực thi trong tab Pack & Send (world: MAIN).
// Side Panel chạy vòng lặp; mỗi dòng được gửi sang trang bằng chrome.scripting.executeScript để dùng
// đúng jQuery và cookie của trang (xem docs/PHUONG-AN-TRIEN-KHAI.md mục 4).
(function (g) {
  'use strict';

  var SITE_PATTERN = 'https://packnsend.vnpost.vn/*';
  var cachedTabId = null;

  function expiredResult(cmd, message) {
    // Dùng chung đường "hết phiên": bộ điều phối tạm dừng, giữ nguyên dòng, người dùng khắc phục rồi bấm Tiếp tục.
    return { rowId: cmd.rowId, status: 'SESSION_EXPIRED', code: 'E90_HET_PHIEN', message: message, serverCode: null, httpStatus: null, durationMs: 0 };
  }

  async function findTab() {
    if (cachedTabId !== null) {
      try {
        var t = await chrome.tabs.get(cachedTabId);
        if (t && t.url && t.url.indexOf('https://packnsend.vnpost.vn/') === 0) return t;
      } catch (e) { /* tab đã đóng */ }
      cachedTabId = null;
    }
    var tabs = await chrome.tabs.query({ url: SITE_PATTERN });
    if (!tabs.length) return null;
    var active = tabs.filter(function (t) { return t.active; })[0];
    var pick = active || tabs[0];
    cachedTabId = pick.id;
    return pick;
  }

  function probe() {
    // Chạy trong trang: chỉ đọc trạng thái.
    return {
      hasExecutor: !!(window.VNPExecutor && window.VNPExecutor.processOne),
      hasCore: !!(window.VNPCore && window.VNPCore.processOne),
      hasJquery: !!(window.$ && window.$.ajax),
      hasSearch: !!(window.Lading && typeof window.Lading.GetLading === 'function' && document.getElementById('LadingCode')),
      onLoginPage: !!document.getElementById('fLogin') || /\/Account\/Login/i.test(location.pathname),
      path: location.pathname
    };
  }

  // Kiểm tra trước khi chạy: có tab, đã đăng nhập, bộ thực thi đã nạp.
  async function check() {
    var tab = await findTab();
    if (!tab) return { ok: false, message: 'Không thấy tab Pack & Send đang mở. Hãy mở https://packnsend.vnpost.vn/, đăng nhập và vào 3.9 Quản lý vận đơn, rồi thử lại.' };
    var res;
    try {
      res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: probe });
    } catch (e) {
      return { ok: false, message: 'Không truy cập được tab Pack & Send: ' + e.message };
    }
    var p = res && res[0] && res[0].result;
    if (!p) return { ok: false, message: 'Không đọc được trạng thái trang Pack & Send. Hãy tải lại tab (F5) rồi thử lại.' };
    if (p.onLoginPage) return { ok: false, message: 'Tab Pack & Send đang ở trang đăng nhập. Hãy đăng nhập rồi thử lại.' };
    if (!p.hasJquery) return { ok: false, message: 'Trang Pack & Send chưa tải xong. Hãy chờ trang tải xong hoặc tải lại (F5).' };
    if (!p.hasSearch) return { ok: false, message: 'Tab Pack & Send chưa ở trang 3.9 Quản lý vận đơn. Hãy vào 3.9 (màn có ô Mã vận đơn) rồi thử lại.' };
    if (!p.hasExecutor || !p.hasCore) return { ok: false, message: 'Tiện ích chưa nạp vào trang. Hãy tải lại tab Pack & Send (F5) rồi thử lại.' };
    return { ok: true, tabId: tab.id };
  }

  function createRealExecutor() {
    return {
      processOne: async function (cmd) {
        var tab = await findTab();
        if (!tab) return expiredResult(cmd, 'Không thấy tab Pack & Send đang mở. Hãy mở lại tab, đăng nhập, rồi bấm Tiếp tục.');
        var res = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: function (command) {
            if (!window.VNPExecutor) return { __missing: true };
            return window.VNPExecutor.processOne(command);
          },
          args: [cmd]
        });
        var out = res && res[0] && res[0].result;
        if (!out) throw new Error('Trang không trả về kết quả');
        if (out.__missing) return expiredResult(cmd, 'Tiện ích chưa nạp vào trang (trang vừa được tải lại?). Hãy chờ trang tải xong rồi bấm Tiếp tục.');
        return out;
      }
    };
  }

  g.VNPPageBridge = { check: check, createRealExecutor: createRealExecutor };
})(window);
