/**
 * VNPost PNS - Xử lý 3.0: các bước chạy TRONG trang Pack & Send (world: MAIN).
 * Nguồn: docs/audit-xuly30/*. Tiện ích điều khiển chính các hàm/nút của trang (DOM + jQuery),
 * đọc kết quả từ phản hồi ajax của trang, nên payload luôn đúng với bản trang đang chạy.
 *
 * Giao diện công khai: window.VNPXuLy30.runStep(stepNo, codes) -> Promise<kết quả theo hợp đồng của core/xuly30.js>
 *   1 Vu hồi (6.2) | 2 Giao lại (6.2) | 3 Lập BĐ13 (3.2) | 4 Chuyển về 3.0 (3.8.1)
 */
(function (g) {
  'use strict';

  var isNode = typeof module === 'object' && module.exports;

  var CONFIG = {
    separator: ',',        // ký tự ngăn cách nhiều mã ở ô "Mã bưu gửi" của 6.2 (CHƯA XÁC MINH, xem docs/audit-xuly30/00)
    ajaxTimeoutMs: 30000,
    uiTimeoutMs: 10000,
    settleMs: 250
  };

  var PAGES = {
    '6.2': { match: 'danh-sach-cho-nhap-kho', url: 'https://packnsend.vnpost.vn/quan-ly-kho/danh-sach-cho-nhap-kho.html' },
    '3.2': { match: 'lap-ban-ke-bd13', url: 'https://packnsend.vnpost.vn/lap-ban-ke-bd13.html' },
    '3.8.1': { match: 'thêm-mới-vu-hồi-chuyến-thư', url: 'https://packnsend.vnpost.vn/' + encodeURI('thêm-mới-vu-hồi-chuyến-thư.html') }
  };
  var STEP_PAGE = { 1: '6.2', 2: '6.2', 3: '3.2', 4: '3.8.1' };

  var wrote = false; // true khi đã bấm lệnh ghi trong lượt runStep hiện tại

  var BG_RE = /[A-Za-z]{2}\d{9}[A-Za-z]{2}/;

  // ---------- Hàm thuần (kiểm thử được bằng Node) ----------

  function norm(s) {
    return String(s === null || s === undefined ? '' : s).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function plain(s) {
    return norm(s).replace(/đ/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function extractCode(text) {
    var m = BG_RE.exec(String(text || ''));
    return m ? m[0].toUpperCase() : '';
  }
  function isLoginText(text) {
    if (!text || typeof text !== 'string') return false;
    return text.indexOf('Account/Login') !== -1 || text.indexOf('id="fLogin"') !== -1 || text.indexOf('Đăng nhập hệ thống') !== -1;
  }
  // "Cập nhập dữ liệu thành công 3/5" hoặc "Cập nhật thành công 1/1 bưu gửi." -> { ok: 3, total: 5 }
  function parseRatio(message) {
    var m = /(\d+)\s*\/\s*(\d+)/.exec(String(message || ''));
    return m ? { ok: Number(m[1]), total: Number(m[2]) } : null;
  }
  function pickRouteOption(options) {
    // options: [{ value, text }]. Tuyến chuyển tiếp nhận diện theo tên, không dùng value (mỗi bưu cục một mã).
    var hits = options.filter(function (o) { return plain(o.text).indexOf('chuyen tiep') !== -1; });
    return hits;
  }
  function findColumnIndex(headers) {
    for (var i = 0; i < headers.length; i++) {
      var h = plain(headers[i]);
      if (h.indexOf('chua lap') !== -1 && h.indexOf('bd13') !== -1) return i;
    }
    return -1;
  }
  function rowHasCode(rowData, code) {
    if (!rowData || typeof rowData !== 'object') return false;
    var keys = Object.keys(rowData);
    for (var i = 0; i < keys.length; i++) {
      var v = rowData[keys[i]];
      if (typeof v === 'string' && v.toUpperCase().indexOf(code) !== -1) return true;
    }
    return false;
  }

  if (isNode) {
    module.exports = { norm: norm, plain: plain, extractCode: extractCode, isLoginText: isLoginText, parseRatio: parseRatio, pickRouteOption: pickRouteOption, findColumnIndex: findColumnIndex, rowHasCode: rowHasCode, PAGES: PAGES, CONFIG: CONFIG };
    return;
  }

  // ---------- Phần dưới chỉ chạy trong trình duyệt ----------

  var $ = g.jQuery || g.$;

  function SessionExpired(message) { this.message = message || 'Hết phiên đăng nhập'; this.sessionExpired = true; }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function waitFor(fn, timeoutMs, what) {
    var t0 = Date.now();
    var limit = timeoutMs || CONFIG.uiTimeoutMs;
    for (;;) {
      var v = fn();
      if (v) return v;
      if (Date.now() - t0 > limit) throw new Error('Quá thời gian chờ ' + (what || 'thành phần trên trang'));
      await sleep(100);
    }
  }

  async function waitAjaxIdle() {
    await sleep(CONFIG.settleMs);
    var t0 = Date.now();
    var quiet = 0;
    while (quiet < 2) {
      if (Date.now() - t0 > CONFIG.ajaxTimeoutMs) throw new Error('Trang xử lý quá lâu (ajax chưa xong)');
      if (!$ || !$.active) quiet++; else quiet = 0;
      await sleep(120);
    }
  }

  function isLoginPage() {
    return !!document.getElementById('fLogin') || /\/Account\/Login/i.test(location.pathname);
  }
  function assertSession() { if (isLoginPage()) throw new SessionExpired('Tab Pack & Send đang ở trang đăng nhập.'); }

  function where() {
    var p;
    try { p = decodeURIComponent(location.pathname).normalize('NFC'); } catch (e) { p = location.pathname; }
    var keys = Object.keys(PAGES);
    for (var i = 0; i < keys.length; i++) if (p.indexOf(PAGES[keys[i]].match) !== -1) return keys[i];
    return '';
  }

  function visible(el) {
    return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }
  function byId(id) { return document.getElementById(id); }

  function findButton(label, scope) {
    var want = plain(label);
    var nodes = (scope || document).querySelectorAll('button, a.btn, a.dt-button, input[type="button"], input[type="submit"]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!visible(n)) continue;
      var t = plain(n.tagName === 'INPUT' ? n.value : n.textContent);
      if (t === want) return n;
    }
    return null;
  }
  function visibleModal(id) {
    var m = byId(id);
    return m && visible(m) ? m : null;
  }
  function hideModals() {
    try { $('.modal').modal('hide'); } catch (e) { /* trang không dùng bootstrap modal */ }
  }

  // Chạy trigger() rồi chờ phản hồi ajax có URL chứa urlPart. Trả về { status, text, json }.
  function captureAjax(urlPart, trigger, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var finished = false;
      var timer = setTimeout(function () {
        if (finished) return;
        finished = true;
        $(document).off('ajaxComplete', handler);
        reject(new Error('Không nhận được phản hồi của ' + urlPart));
      }, timeoutMs || CONFIG.ajaxTimeoutMs);
      function handler(ev, xhr, settings) {
        if (finished || !settings || String(settings.url || '').indexOf(urlPart) === -1) return;
        finished = true;
        clearTimeout(timer);
        $(document).off('ajaxComplete', handler);
        var text = xhr.responseText || '';
        var json = xhr.responseJSON;
        if (!json) { try { json = JSON.parse(text); } catch (e) { json = null; } }
        if (xhr.status === 401 || isLoginText(text)) { reject(new SessionExpired()); return; }
        resolve({ status: xhr.status, text: text, json: json });
      }
      $(document).on('ajaxComplete', handler);
      try { trigger(); } catch (e) { finished = true; clearTimeout(timer); $(document).off('ajaxComplete', handler); reject(e); }
    });
  }

  function setChecked(box, want) {
    if (!box) return;
    if (!!box.checked !== !!want) box.click();
  }

  function failAll(codes, code, message, unknown) {
    var per = {};
    codes.forEach(function (c) { per[c] = { ok: false, code: code, message: message, unknown: !!unknown }; });
    return { perCode: per };
  }

  // ---------- 6.2: tìm và đọc bảng #tbl_inventory ----------

  function inventoryRows() {
    var out = [];
    var trs = document.querySelectorAll('#tbl_inventory tbody tr');
    var dt = null;
    try { dt = $('#tbl_inventory').DataTable(); } catch (e) { dt = null; }
    Array.prototype.forEach.call(trs, function (tr) {
      if (tr.querySelector('td.dataTables_empty')) return;
      var data = null;
      try { data = dt ? dt.row(tr).data() : null; } catch (e) { data = null; }
      var code = (data && data.LadingCode ? String(data.LadingCode).toUpperCase() : '') || extractCode(tr.textContent);
      if (!code) return;
      out.push({ code: code, tr: tr, box: tr.querySelector('input[type="checkbox"]'), status: data && data.StatusCode !== undefined ? String(data.StatusCode) : '', data: data });
    });
    return out;
  }

  async function inventorySearch(codes) {
    var input = byId('txtLadingCode');
    if (!input) throw new Error('Không thấy ô Mã bưu gửi (#txtLadingCode): tab chưa ở màn hình 6.2');
    input.value = codes.join(CONFIG.separator);
    $(input).trigger('input').trigger('change');
    var found = await captureAjax('ListInventory_V2', function () {
      if (typeof g.SearchInventory_V2 === 'function') g.SearchInventory_V2(false);
      else byId('search_key').click();
    });
    if (found.status !== 200) throw new Error('Tìm kiếm ở 6.2 lỗi (HTTP ' + found.status + ')');
    await waitAjaxIdle();
    assertSession();
    return inventoryRows();
  }

  function selectInventoryRows(wanted, all) {
    var chkAll = byId('chkAll');
    setChecked(chkAll, false);
    if (wanted.length === all.length && chkAll) {
      setChecked(chkAll, true);
      return;
    }
    all.forEach(function (r) { setChecked(r.box, false); });
    wanted.forEach(function (r) { setChecked(r.box, true); });
  }

  function indexByCode(rows) {
    var m = {};
    rows.forEach(function (r) { m[r.code] = r; });
    return m;
  }

  // ---------- Bước 1: Vu hồi ----------

  async function step1(codes) {
    assertSession();
    var per = {};
    var rows = await inventorySearch(codes);
    var by = indexByCode(rows);
    var wanted = [];
    codes.forEach(function (c) {
      var r = by[c];
      if (!r) per[c] = { ok: false, code: 'E40_KHONG_TIM_THAY_BG', message: 'Không thấy bưu gửi trong danh sách chờ nhập kho/vu hồi (6.2).' };
      else if (r.status === 'R') per[c] = { ok: true, message: 'Đã ở trạng thái vu hồi từ trước.' };
      else wanted.push(r);
    });
    if (!wanted.length) return { perCode: per };

    selectInventoryRows(wanted, rows);
    var btn = findButton('Vu hồi');
    if (!btn) {
      wanted.forEach(function (r) { per[r.code] = { ok: false, code: 'E41_VU_HOI_THAT_BAI', message: 'Không thấy nút "Vu hồi" trên màn hình 6.2.' }; });
      return { perCode: per };
    }
    btn.click();
    var modal = await waitFor(function () { return visibleModal('confirmQuestion'); }, CONFIG.uiTimeoutMs, 'popup xác nhận vu hồi');
    var confirmBtn = modal.querySelector('.confirm');
    if (!confirmBtn) throw new Error('Popup vu hồi không có nút Đồng ý (.confirm)');
    var resp = await captureAjax('Inventory/Recovered', function () { wrote = true; confirmBtn.click(); });
    var serverMsg = resp.json && resp.json.Message ? String(resp.json.Message) : '';
    await waitAjaxIdle();
    hideModals();

    // Đối chiếu từng BG: sau khi vu hồi, BG phải có StatusCode = 'R'.
    var after = indexByCode(await inventorySearch(wanted.map(function (r) { return r.code; })));
    wanted.forEach(function (r) {
      var a = after[r.code];
      if (a && a.status === 'R') per[r.code] = { ok: true, message: serverMsg };
      else if (!a || a.status === '') per[r.code] = { ok: false, unknown: true, code: 'E98_KET_QUA_KHONG_RO', message: 'Không đọc lại được trạng thái bưu gửi sau khi vu hồi. Hãy kiểm tra thủ công.' };
      else per[r.code] = { ok: false, code: 'E41_VU_HOI_THAT_BAI', message: serverMsg || 'Hệ thống không vu hồi được bưu gửi này.' };
    });
    return { perCode: per };
  }

  // ---------- Bước 2: Giao lại bưu gửi vu hồi ----------

  async function step2(codes) {
    assertSession();
    var per = {};
    var rows = await inventorySearch(codes);
    var by = indexByCode(rows);
    var wanted = [];
    codes.forEach(function (c) {
      var r = by[c];
      if (!r) per[c] = { ok: false, code: 'E40_KHONG_TIM_THAY_BG', message: 'Không thấy bưu gửi ở 6.2 để giao lại (có thể đã được giao lại hoặc chưa vu hồi).' };
      else if (r.status !== 'R') per[c] = { ok: false, code: 'E42_CHUA_VU_HOI', message: 'Chỉ được giao lại các bưu gửi đã thực hiện vu hồi (trạng thái hiện tại: ' + (r.status || 'không rõ') + ').' };
      else wanted.push(r);
    });
    if (!wanted.length) return { perCode: per };

    selectInventoryRows(wanted, rows);
    var btn = findButton('Giao lại bưu gửi vu hồi');
    if (!btn) {
      wanted.forEach(function (r) { per[r.code] = { ok: false, code: 'E42_GIAO_LAI_THAT_BAI', message: 'Không thấy nút "Giao lại bưu gửi vu hồi" trên màn hình 6.2.' }; });
      return { perCode: per };
    }
    btn.click();
    var modal = await waitFor(function () { return visibleModal('modal_refresh_recovered'); }, CONFIG.uiTimeoutMs, 'popup giao lại bưu gửi vu hồi');
    await waitAjaxIdle();
    var keep = modal.querySelector('input[name="ckRefreshRecoveredKeepRoute"][value="1"]');
    if (!keep) throw new Error('Popup giao lại không có lựa chọn "Giữ tuyến bưu tá"');
    setChecked(keep, true);
    var go = findButton('Giao lại', modal);
    if (!go) throw new Error('Popup giao lại không có nút "Giao lại"');
    var resp = await captureAjax('Inventory/DivideRecovered', function () { wrote = true; go.click(); });
    var serverMsg = resp.json && resp.json.Message ? String(resp.json.Message) : '';
    await waitAjaxIdle();
    hideModals();

    // BG giao lại thành công sẽ biến mất khỏi bảng 6.2; BG còn lại là chưa giao được.
    var after = indexByCode(await inventorySearch(wanted.map(function (r) { return r.code; })));
    wanted.forEach(function (r) {
      if (after[r.code]) per[r.code] = { ok: false, code: 'E42_GIAO_LAI_THAT_BAI', message: serverMsg || 'Hệ thống không giao lại được bưu gửi này.' };
      else per[r.code] = { ok: true, message: serverMsg };
    });
    return { perCode: per };
  }

  // ---------- Bước 3: Lập bản kê BĐ13 (3.2) ----------

  function bd13Links() {
    // Trả về [{ a, n }] các ô "SL bưu gửi chưa lập BD13" có số > 0.
    var table = document.querySelector('#contentLading table');
    if (!table) return { col: -1, links: [] };
    var heads = Array.prototype.map.call(table.querySelectorAll('thead th, thead td'), function (th) { return th.textContent; });
    var col = findColumnIndex(heads);
    if (col === -1) return { col: -1, links: [] };
    var links = [];
    Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function (tr) {
      var cell = tr.children[col];
      var a = cell && cell.querySelector('a');
      var n = a ? parseInt(String(a.textContent).replace(/\D/g, ''), 10) : 0;
      if (a && n > 0) links.push({ a: a, n: n });
    });
    return { col: col, links: links };
  }

  async function bd13Search() {
    await captureAjax('', function () {
      if (typeof g.SearchBD13ForPostman === 'function') g.SearchBD13ForPostman();
      else byId('search_key').click();
    }).catch(function (e) { if (e && e.sessionExpired) throw e; /* trang có thể nạp bằng cơ chế khác */ });
    await waitAjaxIdle();
    assertSession();
    return bd13Links();
  }

  async function step3(codes) {
    assertSession();
    var route = byId('Route');
    if (!route) throw new Error('Không thấy ô Tuyến phát (#Route): tab chưa ở màn hình 3.2');
    var opts = Array.prototype.map.call(route.options, function (o) { return { value: o.value, text: o.text }; });
    var hits = pickRouteOption(opts);
    if (hits.length !== 1) {
      return { fatal: { code: 'E43_KHONG_THAY_TUYEN_CT', message: hits.length ? 'Có ' + hits.length + ' tuyến chứa chữ "Chuyển tiếp", cần đúng 1 tuyến.' : 'Danh sách Tuyến phát không có tuyến "Chuyển tiếp".' } };
    }
    route.value = hits[0].value;
    $(route).trigger('change');
    await waitAjaxIdle();
    var pm = byId('cbPostman');
    if (pm && pm.value !== '') { pm.value = ''; $(pm).trigger('change'); await waitAjaxIdle(); }

    var expected = {};
    codes.forEach(function (c) { expected[c] = true; });
    var created = {};
    var per = {};
    var info = await bd13Search();
    if (info.col === -1) return { fatal: { code: 'E43_SAI_LECH_SO_LUONG', message: 'Không tìm thấy cột "SL bưu gửi chưa lập BD13" ở 3.2.' } };
    var shown = info.links.reduce(function (s, l) { return s + l.n; }, 0);
    if (shown !== codes.length) {
      return { fatal: { code: 'E43_SAI_LECH_SO_LUONG', message: 'Màn 3.2 hiển thị ' + shown + ' bưu gửi chưa lập BĐ13, trong khi vừa giao lại thành công ' + codes.length + '. Đã dừng, chưa lập bản kê nào.' } };
    }

    for (var guard = 0; guard < 30 && info.links.length; guard++) {
      info.links[0].a.click();
      var modal = await waitFor(function () { return visibleModal('modal_lading_divided_detail'); }, CONFIG.uiTimeoutMs, 'danh sách bưu gửi của tuyến');
      await waitAjaxIdle();
      var modalCodes = [];
      Array.prototype.forEach.call(modal.querySelectorAll('tbody tr'), function (tr) { var c = extractCode(tr.textContent); if (c) modalCodes.push(c); });
      var foreign = modalCodes.filter(function (c) { return !expected[c]; });
      if (modalCodes.length !== info.links[0].n && !foreign.length) {
        hideModals();
        return { perCode: per, fatal: { code: 'E43_SAI_LECH_SO_LUONG', message: 'Danh sách bưu gửi ở 3.2 có ' + modalCodes.length + ' dòng nhưng ô số lượng ghi ' + info.links[0].n + '. Đã dừng, chưa lập bản kê cho nhóm này.' } };
      }
      if (foreign.length || !modalCodes.length) {
        hideModals();
        return Object.assign({ perCode: per }, { fatal: { code: 'E43_SAI_LECH_SO_LUONG', message: foreign.length ? 'Danh sách bưu gửi ở 3.2 có ' + foreign.length + ' bưu gửi ngoài danh sách đang xử lý (ví dụ ' + foreign[0] + '). Đã dừng, chưa lập bản kê cho nhóm này.' : 'Không đọc được mã bưu gửi trong danh sách ở 3.2.' } });
      }
      setChecked(byId('chkAllDetail'), true);
      var create = byId('btnCreateBD13') || modal.querySelector('[onclick*="CreateBd13"]') || findButton('Lập bản kê BD13', modal) || findButton('Lập bản kê BĐ13', modal);
      if (!create) throw new Error('Không thấy nút "Lập bản kê BĐ13" trong danh sách bưu gửi');
      create.click();
      var confirmBtn = await waitFor(function () {
        var btns = document.querySelectorAll('.modal button');
        for (var i = 0; i < btns.length; i++) if (visible(btns[i]) && plain(btns[i].textContent) === 'dong y') return btns[i];
        return null;
      }, CONFIG.uiTimeoutMs, 'popup xác nhận lập bản kê');
      var resp = await captureAjax('CreateBD13Multi', function () { wrote = true; confirmBtn.click(); });
      var okServer = resp.json && String(resp.json.Code) === '00';
      var serverMsg = resp.json && resp.json.Message ? String(resp.json.Message) : '';
      // Popup in BĐ13: bản kê đã lập, chỉ đóng popup (không in).
      await sleep(600);
      hideModals();
      await sleep(CONFIG.settleMs);
      modalCodes.forEach(function (c) {
        created[c] = true;
        per[c] = okServer ? { ok: true, message: serverMsg } : { ok: false, code: 'E43_LAP_BD13_THAT_BAI', message: serverMsg || 'Hệ thống không lập được bản kê BĐ13.' };
      });
      if (!okServer) break;
      var remaining = shown - Object.keys(created).length;
      info = await bd13Search();
      var left = info.links.reduce(function (n, l) { return n + l.n; }, 0);
      if (left !== remaining) {
        return { perCode: per, fatal: { code: 'E43_SAI_LECH_SO_LUONG', message: 'Sau khi lập BĐ13, màn 3.2 còn ' + left + ' bưu gửi chưa lập (kỳ vọng ' + remaining + '). Đã dừng, hãy kiểm tra thủ công.' } };
      }
    }

    codes.forEach(function (c) {
      if (!per[c]) per[c] = { ok: false, code: 'E43_LAP_BD13_THAT_BAI', message: 'Bưu gửi chưa được lập bản kê BĐ13.' };
    });
    return { perCode: per };
  }

  // ---------- Bước 4: Chuyển về 3.0 (3.8.1) ----------

  function globalEval(src) { return (0, eval)(src); }

  async function step4(codes) {
    assertSession();
    var per = {};
    var routeEl = byId('Route');
    var pmEl = byId('cbPostman');
    var routeText = routeEl && routeEl.selectedIndex >= 0 ? routeEl.options[routeEl.selectedIndex].text : '';
    var routeCode = routeText.split('-')[0].trim();
    var postmanCode = (pmEl && pmEl.value) || '';

    var resp;
    try {
      resp = await new Promise(function (resolve, reject) {
        $.ajax({
          url: '/Lading/Home/SearchManageMailtripByExcel',
          type: 'POST',
          data: { data: codes.map(function (c) { return { MaVanDon: c }; }), routeCode: routeCode, postmanCode: postmanCode },
          success: function (d, s, xhr) { resolve({ json: d, text: xhr.responseText || '' }); },
          error: function (xhr) {
            if (xhr.status === 401 || isLoginText(xhr.responseText)) reject(new SessionExpired());
            else reject(new Error('Lỗi khi nạp danh sách lên 3.8.1 (HTTP ' + xhr.status + ')'));
          }
        });
      });
    } catch (e) {
      if (e && e.sessionExpired) throw e;
      return failAll(codes, 'E44_IMPORT_381_THAT_BAI', String((e && e.message) || e));
    }
    if (isLoginText(resp.text)) throw new SessionExpired();
    var json = resp.json;
    if (!json || String(json.Code) !== '00' || !Array.isArray(json.Data)) {
      return failAll(codes, 'E44_IMPORT_381_THAT_BAI', (json && json.Message) || 'Hệ thống 3.8.1 từ chối danh sách bưu gửi.');
    }

    var eligible = [];
    var drawRows = [];
    codes.forEach(function (c) {
      var row = null;
      for (var i = 0; i < json.Data.length; i++) if (rowHasCode(json.Data[i], c)) { row = json.Data[i]; break; }
      if (!row) per[c] = { ok: false, code: 'E44_IMPORT_381_THAT_BAI', message: 'Hệ thống 3.8.1 không trả về bưu gửi này khi nạp danh sách.' };
      else if (row.warehouse_status === 'I' || row.warehouse_status === 'P') per[c] = { ok: false, code: 'E44_CHUYEN_30_THAT_BAI', message: 'Bưu gửi đang ở trạng thái kho "' + row.warehouse_status + '", hệ thống không cho chuyển.' };
      else { eligible.push(c); drawRows.push(row); }
    });
    if (!eligible.length) return { perCode: per };

    var tbl = globalEval('typeof table !== "undefined" ? table : null');
    if (!tbl || !tbl.rows) throw new Error('Không tìm thấy bảng dữ liệu của trang 3.8.1 (biến table)');
    globalEval('_isExcell = true;');
    tbl.clear();
    tbl.rows.add(drawRows).draw(false);
    await sleep(CONFIG.settleMs);

    var chkAll = byId('chkAll');
    setChecked(chkAll, false);
    setChecked(chkAll, true);
    var checked = document.querySelectorAll('#tblcontentSearchDeliveryMulti tbody input[type="checkbox"]:checked').length;
    if (checked !== eligible.length) {
      var mismatch = 'Số dòng được tích (' + checked + ') khác số bưu gửi cần chuyển (' + eligible.length + '), đã dừng lô này, chưa chuyển bưu gửi nào.';
      return { perCode: Object.assign(per, failAll(eligible, 'E44_CHUYEN_30_THAT_BAI', mismatch).perCode) };
    }

    var btn = findButton('Chuyển bưu gửi');
    if (!btn) throw new Error('Không thấy nút "Chuyển bưu gửi" trên màn hình 3.8.1');
    btn.click();
    var modal = await waitFor(function () { return visibleModal('add_mail_trip'); }, CONFIG.uiTimeoutMs, 'popup xác nhận chuyển bưu gửi');
    await waitAjaxIdle();
    var accept = modal.querySelector('button[onclick*="AcceptAddBackMailTripMulti"]');
    if (!accept) throw new Error('Popup chuyển bưu gửi không có nút xác nhận');
    var res = await captureAjax('AcceptAddBackMailTripMulti', function () { wrote = true; accept.click(); });
    await sleep(CONFIG.settleMs);
    hideModals();

    var j = res.json || {};
    var msg = j.Message ? String(j.Message) : '';
    var ratio = parseRatio(msg);
    if (String(j.Code) === '00' && ratio && ratio.ok === ratio.total && ratio.total === eligible.length) {
      eligible.forEach(function (c) { per[c] = { ok: true, message: msg }; });
    } else if (String(j.Code) === '00' && ratio && ratio.total !== eligible.length) {
      eligible.forEach(function (c) { per[c] = { ok: false, unknown: true, code: 'E98_KET_QUA_KHONG_RO', message: 'Hệ thống báo "' + msg + '" nhưng lô gửi đi có ' + eligible.length + ' bưu gửi. Hãy kiểm tra thủ công.' }; });
    } else if (String(j.Code) === '00' && ratio && ratio.ok === 0) {
      eligible.forEach(function (c) { per[c] = { ok: false, code: 'E44_CHUYEN_30_THAT_BAI', message: msg }; });
    } else if (String(j.Code) === '00' && !ratio) {
      eligible.forEach(function (c) { per[c] = { ok: false, unknown: true, code: 'E98_KET_QUA_KHONG_RO', message: 'Phản hồi không rõ: "' + msg + '". Hãy kiểm tra thủ công.' }; });
    } else if (String(j.Code) === '00') {
      // Thành công một phần: phản hồi không nêu bưu gửi nào lỗi.
      eligible.forEach(function (c) { per[c] = { ok: false, unknown: true, code: 'E44_CHUYEN_30_THAT_BAI', message: msg + ' (không rõ bưu gửi nào lỗi, hãy kiểm tra thủ công)' }; });
    } else {
      eligible.forEach(function (c) { per[c] = { ok: false, code: 'E44_CHUYEN_30_THAT_BAI', message: msg || 'Hệ thống từ chối chuyển bưu gửi.' }; });
    }
    return { perCode: per };
  }

  var STEP_FN = { 1: step1, 2: step2, 3: step3, 4: step4 };

  async function runStep(stepNo, codes) {
    var fn = STEP_FN[stepNo];
    if (!fn) throw new Error('Bước không hợp lệ: ' + stepNo);
    wrote = false;
    try {
      var expectPage = STEP_PAGE[stepNo];
      if (where() !== expectPage) throw new Error('Tab chưa ở đúng màn hình ' + expectPage + ' (đang ở ' + (where() || location.pathname) + ')');
      return await fn(codes);
    } catch (e) {
      if (e && e.sessionExpired) return { sessionExpired: true, message: e.message, wrote: wrote };
      throw e;
    }
  }

  g.VNPXuLy30 = { runStep: runStep, where: where, isLoginPage: isLoginPage, PAGES: PAGES, STEP_PAGE: STEP_PAGE, config: CONFIG };
})(typeof self !== 'undefined' ? self : globalThis);
