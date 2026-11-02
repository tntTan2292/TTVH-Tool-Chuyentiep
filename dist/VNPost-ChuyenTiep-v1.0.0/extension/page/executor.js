/**
 * VNPost PNS - Chuyển Tiếp Hàng Loạt
 * Bộ thực thi trong trang (Page Executor) - Chạy trong ngữ cảnh world: MAIN
 * Tuân thủ hợp đồng kỹ thuật Mục 2 & 3 trong docs/PROMPT-ANTIGRAVITY-WP3-WP5.md
 */

(function (g) {
  'use strict';

  var isNode = typeof module === 'object' && module.exports;

  // Kiểm tra phản hồi có phải là trang đăng nhập (hết phiên) không
  function isSessionExpired(status, text) {
    if (status === 401) return true;
    if (!text || typeof text !== 'string') return false;
    return (
      text.indexOf('Account/Login') !== -1 ||
      text.indexOf('Đăng nhập hệ thống') !== -1 ||
      text.indexOf('id="fLogin"') !== -1 ||
      text.indexOf('/Account/Login') !== -1
    );
  }

  // Phân tích HTML trả về từ POST /Lading/Home/GetLading
  function parseGetLadingHtml(html, maBG) {
    var res = {
      found: false,
      statusCode: null,
      statusText: '',
      hasForwardButton: false,
      receiverName: '',
      receiverAddress: ''
    };

    if (!html || typeof html !== 'string') return res;

    // Trong trình duyệt dùng DOMParser
    if (typeof DOMParser !== 'undefined') {
      try {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        
        // Tìm dòng chứa bưu gửi: ưu tiên id tr_[maBG], hoặc tìm dòng tr có chứa maBG
        var tr = doc.getElementById('tr_' + maBG);
        if (!tr) {
          var allRows = doc.querySelectorAll('table#table_lading tbody tr, table tbody tr');
          for (var i = 0; i < allRows.length; i++) {
            if (allRows[i].textContent.indexOf(maBG) !== -1) {
              tr = allRows[i];
              break;
            }
          }
        }

        if (!tr) return res;
        res.found = true;

        // Trích xuất nhãn trạng thái (ví dụ "Bưu gửi chuyển tiếp")
        var labelEl = tr.querySelector('.label, .badge, span[class*="label"]');
        if (labelEl) {
          res.statusText = labelEl.textContent.trim();
        }

        // Tìm nút "Thêm thông tin chuyển tiếp" hoặc GetUpdateItemForward
        var forwardBtn = tr.querySelector('a[onclick*="GetUpdateItemForward"], button[onclick*="GetUpdateItemForward"]');
        if (forwardBtn) {
          res.hasForwardButton = true;
          var onclick = forwardBtn.getAttribute('onclick') || '';
          var match = onclick.match(/GetUpdateItemForward\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/);
          if (match) {
            res.statusCode = match[2];
            res.receiverName = match[3] || '';
            res.receiverAddress = match[4] || '';
          }
        }
        return res;
      } catch (e) {
        // Fallback sang regex nếu DOMParser lỗi
      }
    }

    // Fallback bằng Regex (chạy được cả trong Node test)
    if (html.indexOf(maBG) === -1) return res;
    res.found = true;

    var btnMatch = html.match(/GetUpdateItemForward\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/);
    if (btnMatch) {
      res.hasForwardButton = true;
      res.statusCode = btnMatch[2];
      res.receiverName = btnMatch[3] || '';
      res.receiverAddress = btnMatch[4] || '';
    }

    var labelMatch = html.match(/class="(?:label[^"]*|badge[^"]*)"[^>]*>([^<]+)<\/span>/);
    if (labelMatch) {
      res.statusText = labelMatch[1].trim();
    }

    return res;
  }

  // Phân tích HTML trả về từ GET /Lading/LadingJourney/GetByLadingCode
  // Trả về null nếu HTML không có `var _newModel` (không có form chuyển tiếp).
  // Có `_newModel` nhưng không đọc được thì NÉM LỖI (không được nhầm với "không có form").
  // Cắt đối tượng bằng cách đếm ngoặc nhọn, bỏ qua nội dung trong chuỗi, để giá trị chứa "};" không làm cụt dữ liệu.
  function parseGetByLadingCodeHtml(html) {
    if (!html || typeof html !== 'string') return null;
    var marker = html.match(/var\s+_newModel\s*=\s*\{/);
    if (!marker) return null;
    var start = marker.index + marker[0].length - 1;
    var depth = 0, inStr = false, esc = false, end = -1;
    for (var i = start; i < html.length; i++) {
      var ch = html.charAt(i);
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) throw new Error('Không tìm thấy phần cuối của _newModel');
    return JSON.parse(html.slice(start, end + 1));
  }

  function parseModelSafe(html) {
    try { return { ok: true, model: parseGetByLadingCodeHtml(html) }; }
    catch (e) { return { ok: false, message: 'Không đọc được dữ liệu form chuyển tiếp: ' + e.message }; }
  }

  // 1. Tra cứu bưu gửi bằng CHÍNH hàm tìm kiếm của trang (Lading.GetLading) rồi đọc phản hồi của nó.
  // Không tự dựng yêu cầu POST: dữ liệu gửi đi (khoảng ngày, bộ lọc...) do trang quyết định nên luôn khớp với
  // nút "Tìm kiếm". Cần đang ở trang 3.9 Quản lý vận đơn. Bảng kết quả trên màn hình sẽ nhảy theo từng bưu gửi.
  var LADING_TIMEOUT_MS = 20000;

  function getLading(maBG) {
    return new Promise(function (resolve) {
      var $ = typeof window !== 'undefined' ? window.$ : null;
      if (!$ || !$.ajax || !window.Lading || typeof window.Lading.GetLading !== 'function' || !$('#LadingCode').length) {
        return resolve({ ok: false, kind: 'HTTP', message: 'Tab Pack & Send chưa ở trang 3.9 Quản lý vận đơn. Hãy mở đúng trang 3.9 rồi chạy lại.' });
      }
      var done = false;
      var timer = null;
      function finish(result) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        $(document).off('ajaxComplete.vnpfwd');
        resolve(result);
      }
      $(document).off('ajaxComplete.vnpfwd').on('ajaxComplete.vnpfwd', function (ev, xhr, opts) {
        if (!opts || !/GetLading/i.test(String(opts.url || ''))) return;
        var text = xhr && typeof xhr.responseText === 'string' ? xhr.responseText : '';
        // Lưu mẫu phản hồi gần nhất để chẩn đoán khi cần (đọc trong Console: window.__vnpLastLading).
        window.__vnpLastLading = { maBG: maBG, status: xhr && xhr.status, length: text.length, sample: text.replace(/\s+/g, ' ').slice(0, 300) };
        if (isSessionExpired(xhr && xhr.status, text)) {
          return finish({ ok: false, kind: 'SESSION_EXPIRED', httpStatus: xhr && xhr.status, message: 'Hết phiên đăng nhập' });
        }
        if (!xhr || (xhr.status && xhr.status !== 200)) {
          return finish({ ok: false, kind: 'HTTP', httpStatus: xhr && xhr.status, message: 'Lỗi tải danh sách vận đơn (' + (xhr && xhr.status) + ')' });
        }
        finish({ ok: true, data: parseGetLadingHtml(text, maBG) });
      });
      timer = setTimeout(function () {
        finish({ ok: false, kind: 'NETWORK', message: 'Quá thời gian chờ kết quả tra cứu' });
      }, LADING_TIMEOUT_MS);
      try {
        $('#LadingCode').val(maBG);
        window.Lading.GetLading(1);
      } catch (e) {
        finish({ ok: false, kind: 'HTTP', message: 'Không gọi được hàm tìm kiếm của trang: ' + e.message });
      }
    });
  }

  // 2. Mở form chuyển tiếp qua GET /Lading/LadingJourney/GetByLadingCode
  function getForm(maBG, receiverName, receiverAddress) {
    return new Promise(function (resolve) {
      var query = 'ladingCode=' + encodeURIComponent(maBG) +
                  '&statusCode=C39' +
                  '&receiverName=' + encodeURIComponent(receiverName || '') +
                  '&receiverAddress=' + encodeURIComponent(receiverAddress || '');
      var url = '/Lading/LadingJourney/GetByLadingCode?' + query;

      if (typeof window !== 'undefined' && window.$ && window.$.ajax) {
        window.$.ajax({
          url: url,
          type: 'GET',
          dataType: 'html',
          success: function (data, textStatus, xhr) {
            if (isSessionExpired(xhr.status, data)) {
              return resolve({ ok: false, kind: 'SESSION_EXPIRED', httpStatus: xhr.status, message: 'Hết phiên đăng nhập' });
            }
            var parsedForm = parseModelSafe(data);
            if (!parsedForm.ok) return resolve({ ok: false, kind: 'HTTP', httpStatus: xhr.status, message: parsedForm.message });
            resolve({ ok: true, data: { model: parsedForm.model } });
          },
          error: function (xhr) {
            if (isSessionExpired(xhr.status, xhr.responseText)) {
              return resolve({ ok: false, kind: 'SESSION_EXPIRED', httpStatus: xhr.status, message: 'Hết phiên đăng nhập' });
            }
            resolve({ ok: false, kind: 'HTTP', httpStatus: xhr.status, message: 'Lỗi tải form chuyển tiếp (' + xhr.status + ')' });
          }
        });
      } else if (typeof fetch !== 'undefined') {
        fetch(url, {
          method: 'GET',
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).then(function (res) {
          if (res.status === 401 || res.redirected) {
            return resolve({ ok: false, kind: 'SESSION_EXPIRED', httpStatus: res.status, message: 'Hết phiên đăng nhập' });
          }
          return res.text().then(function (text) {
            if (isSessionExpired(res.status, text)) {
              return resolve({ ok: false, kind: 'SESSION_EXPIRED', httpStatus: res.status, message: 'Hết phiên đăng nhập' });
            }
            var parsedForm = parseModelSafe(text);
            if (!parsedForm.ok) return resolve({ ok: false, kind: 'HTTP', httpStatus: res.status, message: parsedForm.message });
            resolve({ ok: true, data: { model: parsedForm.model } });
          });
        }).catch(function (err) {
          resolve({ ok: false, kind: 'NETWORK', message: err.message });
        });
      } else {
        resolve({ ok: false, kind: 'NETWORK', message: 'Môi trường không hỗ trợ gọi mạng' });
      }
    });
  }

  // 3. Nạp danh mục phường/xã qua GET /Order/Home/GetWard
  function getWard(provinceId) {
    return new Promise(function (resolve) {
      var url = '/Order/Home/GetWard?ProvinceId=' + encodeURIComponent(provinceId);

      if (typeof window !== 'undefined' && window.$ && window.$.ajax) {
        window.$.ajax({
          url: url,
          type: 'GET',
          dataType: 'json',
          success: function (data, textStatus, xhr) {
            if (isSessionExpired(xhr.status, xhr.responseText)) {
              return resolve({ ok: false, kind: 'SESSION_EXPIRED', httpStatus: xhr.status, message: 'Hết phiên đăng nhập' });
            }
            if (!Array.isArray(data)) {
              return resolve({ ok: true, data: [] });
            }
            var wards = data.map(function (w) {
              return {
                value: w.Value !== undefined ? String(w.Value) : (w.value !== undefined ? String(w.value) : ''),
                text: w.Text !== undefined ? String(w.Text) : (w.text !== undefined ? String(w.text) : '')
              };
            });
            resolve({ ok: true, data: wards });
          },
          error: function (xhr) {
            if (isSessionExpired(xhr.status, xhr.responseText)) {
              return resolve({ ok: false, kind: 'SESSION_EXPIRED', httpStatus: xhr.status, message: 'Hết phiên đăng nhập' });
            }
            resolve({ ok: false, kind: 'HTTP', httpStatus: xhr.status, message: 'Lỗi tải danh mục xã (' + xhr.status + ')' });
          }
        });
      } else if (typeof fetch !== 'undefined') {
        fetch(url, {
          method: 'GET',
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).then(function (res) {
          if (res.status === 401 || res.redirected) {
            return resolve({ ok: false, kind: 'SESSION_EXPIRED', httpStatus: res.status, message: 'Hết phiên đăng nhập' });
          }
          return res.json().then(function (data) {
            if (!Array.isArray(data)) return resolve({ ok: true, data: [] });
            var wards = data.map(function (w) {
              return {
                value: w.Value !== undefined ? String(w.Value) : (w.value !== undefined ? String(w.value) : ''),
                text: w.Text !== undefined ? String(w.Text) : (w.text !== undefined ? String(w.text) : '')
              };
            });
            resolve({ ok: true, data: wards });
          });
        }).catch(function (err) {
          resolve({ ok: false, kind: 'NETWORK', message: err.message });
        });
      } else {
        resolve({ ok: false, kind: 'NETWORK', message: 'Môi trường không hỗ trợ gọi mạng' });
      }
    });
  }

  // 4. Gửi dữ liệu chuyển tiếp qua POST /Lading/LadingJourney/UpdateItemForward
  // TUÂN THỦ: Chỉ gọi khi người dùng cho phép bằng văn bản trong chế độ chạy thật
  function post(model) {
    return new Promise(function (resolve) {
      if (typeof window !== 'undefined' && window.$ && window.$.ajax) {
        window.$.ajax({
          url: '/Lading/LadingJourney/UpdateItemForward',
          type: 'POST',
          dataType: 'json',
          data: { value: model },
          success: function (data, textStatus, xhr) {
            if (isSessionExpired(xhr.status, xhr.responseText)) {
              return resolve({ ok: false, kind: 'SESSION_EXPIRED', httpStatus: xhr.status, message: 'Hết phiên đăng nhập' });
            }
            if (data && typeof data === 'object') {
              // Giữ nguyên phản hồi của server. Tuyệt đối không tự gán Code "00": thiếu Code thì core coi là không rõ kết quả.
              resolve({ ok: true, data: { Code: data.Code, Message: data.Message } });
            } else {
              resolve({ ok: false, kind: 'HTTP', httpStatus: 200, message: 'Phản hồi server không đúng định dạng JSON' });
            }
          },
          error: function (xhr) {
            if (isSessionExpired(xhr.status, xhr.responseText)) {
              return resolve({ ok: false, kind: 'SESSION_EXPIRED', httpStatus: xhr.status, message: 'Hết phiên đăng nhập' });
            }
            // Lỗi mạng hoặc timeout POST -> kind: "NETWORK" (core sẽ đánh E98: không rõ đã lưu hay chưa)
            resolve({ ok: false, kind: 'NETWORK', httpStatus: xhr.status, message: 'Lỗi mạng khi lưu chuyển tiếp (' + xhr.status + ')' });
          }
        });
      } else {
        resolve({ ok: false, kind: 'NETWORK', message: 'Cần môi trường trang PNS với $.ajax để thực thi POST an toàn' });
      }
    });
  }

  var api = {
    getLading: getLading,
    getForm: getForm,
    getWard: getWard,
    post: post
  };

  // Ngữ cảnh dùng chung cả lượt chạy (cache danh mục xã)
  var defaultCtx = { wardCache: {} };

  // Khai báo đối tượng VNPExecutor ra window theo đúng chuẩn Mục 2
  if (typeof window !== 'undefined') {
    window.VNPExecutor = {
      api: api,
      createContext: function () { return { wardCache: {} }; },
      processOne: function (command, ctx) {
        var c = ctx || defaultCtx;
        if (!window.VNPCore || !window.VNPCore.processOne) {
          return Promise.reject(new Error('VNPCore.processOne chưa được nạp'));
        }
        return window.VNPCore.processOne.processOne(api, command, c);
      }
    };
  }

  // Export cho Node test
  if (isNode) {
    module.exports = {
      api: api,
      parseGetLadingHtml: parseGetLadingHtml,
      parseGetByLadingCodeHtml: parseGetByLadingCodeHtml,
      isSessionExpired: isSessionExpired
    };
  }
})(typeof window !== 'undefined' ? window : global);
