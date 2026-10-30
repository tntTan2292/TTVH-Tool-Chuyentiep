(function (g) {
  'use strict';

  var isNode = typeof module === 'object' && module.exports;
  var V = isNode ? require('./validator') : g.VNPCore.validator;
  var A = isNode ? require('./address-resolver') : g.VNPCore.address;
  var B = isNode ? require('./model-builder') : g.VNPCore.modelBuilder;
  var E = isNode ? require('./errors') : g.VNPCore.errors;

  var GET_RETRIES = 2;
  var RETRY_DELAY_MS = 500;

  function defaultSleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // api là 4 hàm nguyên thủy do bộ thực thi trong trang (page/executor.js) cung cấp.
  // Mỗi hàm trả { ok:true, data } hoặc { ok:false, kind, httpStatus, message } với
  // kind = "SESSION_EXPIRED" | "NETWORK" | "HTTP". Hàm nào ném lỗi cũng bị coi là NETWORK.
  //   getLading(maBG)                              -> data { found, statusCode, hasForwardButton, receiverName, receiverAddress }
  //   getForm(maBG, receiverName, receiverAddress) -> data { model }   (đối tượng _newModel)
  //   getWard(provinceId)                          -> data [ { value, text } ]
  //   post(model)                                  -> data { Code, Message }  (phản hồi JSON của UpdateItemForward)
  async function safe(fn, args) {
    try {
      var r = await fn.apply(null, args);
      if (r && typeof r === 'object' && 'ok' in r) return r;
      return { ok: false, kind: 'NETWORK', message: 'Phản hồi không đúng định dạng từ bộ thực thi' };
    } catch (e) {
      return { ok: false, kind: 'NETWORK', message: String((e && e.message) || e) };
    }
  }

  // Chỉ GET mới được thử lại; hết phiên không thử lại.
  async function getWithRetry(fn, args, ctx) {
    var r = await safe(fn, args);
    for (var i = 0; i < GET_RETRIES && !r.ok && r.kind !== 'SESSION_EXPIRED'; i++) {
      await ctx.sleep(RETRY_DELAY_MS);
      r = await safe(fn, args);
    }
    return r;
  }

  function finish(command, ctx, started, status, code, message, extra) {
    var dry = command.mode === 'dry';
    if (dry && status === 'FAIL') status = 'DRY_FAIL';
    var res = {
      rowId: command.rowId,
      status: status,
      code: code,
      message: message || E.describe(code),
      serverCode: null,
      httpStatus: null,
      durationMs: ctx.now() - started
    };
    if (extra) { if (extra.serverCode !== undefined) res.serverCode = extra.serverCode; if (extra.httpStatus !== undefined) res.httpStatus = extra.httpStatus; }
    return res;
  }

  // Xử lý 1 dòng. command = { rowId, mode: "dry" | "real", row }.
  // Chế độ "dry" tuyệt đối không gọi api.post.
  async function processOne(api, command, ctx) {
    ctx = ctx || {};
    ctx.now = ctx.now || Date.now;
    ctx.sleep = ctx.sleep || defaultSleep;
    ctx.wardCache = ctx.wardCache || {};
    var started = ctx.now();
    var fail = function (code, msg, extra) { return finish(command, ctx, started, 'FAIL', code, msg, extra); };
    var sessionOut = function (r) { return finish(command, ctx, started, 'SESSION_EXPIRED', 'E90_HET_PHIEN', undefined, { httpStatus: r.httpStatus }); };
    var sysFail = function (r) { return fail('E99_LOI_KET_NOI', r.message || 'Lỗi đường truyền hoặc máy chủ', { httpStatus: r.httpStatus }); };

    // (a) Kiểm tra dòng (phòng thủ, dù giao diện đã kiểm tra trước).
    var row = V.normalizeRow(command.row);
    var errs = V.validateRow(row);
    if (errs.length) return fail(errs[0].code, errs.map(function (e) { return e.message; }).join('; '));

    // (b) Tra bưu gửi và kiểm tra trạng thái.
    var lad = await getWithRetry(api.getLading, [row.maBG], ctx);
    if (!lad.ok) return lad.kind === 'SESSION_EXPIRED' ? sessionOut(lad) : sysFail(lad);
    if (!lad.data || !lad.data.found) return fail('E10_BG_KHONG_TON_TAI', 'Không tìm thấy bưu gửi ' + row.maBG + ' trên hệ thống');
    // Trạng thái hiện tại chỉ có ở kết quả tra cứu (nút "Thêm thông tin chuyển tiếp" chỉ hiện khi BG đang ở C39).
    // Không dựa vào GetByLadingCode để kiểm tra: nó tra theo (mã BG, statusCode) trong lịch sử hành trình,
    // nên BG từng qua C39 rồi sang trạng thái khác vẫn có thể trả về form.
    if (!lad.data.hasForwardButton || (lad.data.statusCode && lad.data.statusCode !== 'C39')) {
      var shown = lad.data.statusText || lad.data.statusCode || 'không xác định';
      return fail('E11_BG_KHONG_PHAI_C39', 'Bưu gửi đang ở trạng thái "' + shown + '", chưa phải "Bưu gửi chuyển tiếp" (C39)');
    }

    // (c) Mở form để lấy _newModel. receiverName/receiverAddress là tùy chọn với server (đã xác minh G2).
    var form = await getWithRetry(api.getForm, [row.maBG, lad.data.receiverName || '', lad.data.receiverAddress || ''], ctx);
    if (!form.ok) return form.kind === 'SESSION_EXPIRED' ? sessionOut(form) : sysFail(form);
    var serverModel = form.data && form.data.model;
    // model === null: server trả về trang không có form chuyển tiếp (không có _newModel) và không phải trang đăng nhập.
    if (form.data && form.data.model === null) {
      return fail('E11_BG_KHONG_PHAI_C39', 'Hệ thống không trả về form chuyển tiếp cho bưu gửi này (có thể không còn ở trạng thái C39)');
    }
    if (!serverModel || typeof serverModel !== 'object') return fail('E99_LOI_KET_NOI', 'Không đọc được dữ liệu form chuyển tiếp từ hệ thống');
    if (serverModel.StatusCode && serverModel.StatusCode !== 'C39') {
      return fail('E11_BG_KHONG_PHAI_C39', 'Bưu gửi đang ở trạng thái ' + serverModel.StatusCode + ', chưa phải chuyển tiếp (C39)');
    }

    // (d) Dựng địa chỉ chuyển đến.
    var addressReturn;
    if (row.loai === 2) {
      addressReturn = row.buuCuc;
    } else {
      var prov = A.resolveProvince(row.tinh);
      if (!prov.ok) {
        return fail('E12_KHONG_KHOP_DIA_CHI', prov.reason === 'ambiguous'
          ? 'Tỉnh/Thành "' + row.tinh + '" khớp nhiều kết quả: ' + prov.matches.join(', ')
          : 'Không tìm thấy Tỉnh/Thành "' + row.tinh + '"');
      }
      var wards = ctx.wardCache[prov.value];
      if (!wards) {
        var w = await getWithRetry(api.getWard, [prov.value], ctx);
        if (!w.ok) return w.kind === 'SESSION_EXPIRED' ? sessionOut(w) : sysFail(w);
        wards = Array.isArray(w.data) ? w.data : [];
        ctx.wardCache[prov.value] = wards;
      }
      var ward = A.resolveWard(row.phuongXa, wards);
      if (!ward.ok) {
        return fail('E12_KHONG_KHOP_DIA_CHI', ward.reason === 'ambiguous'
          ? 'Phường/Xã "' + row.phuongXa + '" khớp nhiều kết quả trong ' + prov.text + ': ' + ward.matches.join(', ')
          : 'Không tìm thấy Phường/Xã "' + row.phuongXa + '" trong ' + prov.text);
      }
      addressReturn = prov.value + ';' + ward.value;
    }
    var model = B.buildModel(serverModel, row, addressReturn);

    // (e) Chạy thử dừng ở đây, không gửi.
    if (command.mode === 'dry') return finish(command, ctx, started, 'DRY_OK', 'DRY_OK', 'Dữ liệu hợp lệ, sẽ gửi chuyển tiếp khi chạy thật');

    // (f) Gửi. Không thử lại: không biết server đã lưu hay chưa nếu mất kết nối.
    var posted = await safe(api.post, [model]);
    if (!posted.ok) {
      if (posted.kind === 'SESSION_EXPIRED') return sessionOut(posted);
      return finish(command, ctx, started, 'UNKNOWN', 'E98_KET_QUA_KHONG_RO',
        'Mất kết nối khi gửi, không rõ bưu gửi đã được lưu hay chưa. Hãy kiểm tra trên hệ thống' + (posted.message ? ' (' + posted.message + ')' : ''),
        { httpStatus: posted.httpStatus });
    }
    var body = posted.data;
    if (!body || typeof body !== 'object' || body.Code === undefined || body.Code === null) {
      return finish(command, ctx, started, 'UNKNOWN', 'E98_KET_QUA_KHONG_RO',
        'Hệ thống trả về dữ liệu không đúng định dạng, không rõ đã lưu hay chưa. Hãy kiểm tra trên hệ thống');
    }
    if (String(body.Code) === '00') {
      return finish(command, ctx, started, 'SUCCESS', 'SUCCESS', body.Message || 'Cập nhật thông tin chuyển tiếp thành công', { serverCode: '00' });
    }
    return fail('E20_LOI_NGHIEP_VU', 'Hệ thống từ chối [' + body.Code + ']: ' + (body.Message || 'không có thông báo'), { serverCode: String(body.Code) });
  }

  var api = { processOne: processOne };

  if (isNode) module.exports = api;
  else { g.VNPCore = g.VNPCore || {}; g.VNPCore.processOne = api; }
})(typeof self !== 'undefined' ? self : globalThis);
