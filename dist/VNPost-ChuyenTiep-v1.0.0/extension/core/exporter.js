(function (g) {
  'use strict';

  var isNode = typeof module === 'object' && module.exports;
  var T = isNode ? require('./text-utils') : g.VNPCore.text;

  var RESULT_COLUMNS = ['KET_QUA', 'MA_LOI', 'NGUYEN_NHAN', 'THOI_GIAN_XU_LY'];

  var STATUS_LABEL = {
    SUCCESS: 'Thành công',
    DRY_OK: 'Chạy thử: sẽ thành công',
    FAIL: 'Thất bại',
    DRY_FAIL: 'Chạy thử: sẽ thất bại',
    UNKNOWN: 'Không rõ, cần kiểm tra thủ công',
    NOT_PROCESSED: 'Chưa xử lý'
  };

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function formatTime(ms) {
    if (!ms) return '';
    var d = new Date(ms);
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  // prepared: kết quả prepare.prepareFromAoa. results: mảng hoặc đối tượng { rowId: kết quả } từ runner.
  // Trả về mảng các dòng: tiêu đề + dữ liệu gốc + 4 cột kết quả (ghi đè nếu file gốc đã có cột đó, ngược lại thêm vào cuối).
  function buildResultAoa(prepared, results) {
    var byId = {};
    if (Array.isArray(results)) results.forEach(function (r) { if (r) byId[r.rowId] = r; });
    else if (results) byId = results;

    var header = prepared.header.slice();
    var idx = {};
    RESULT_COLUMNS.forEach(function (c) {
      var at = -1;
      header.forEach(function (h, i) { if (at === -1 && T.key(h) === T.key(c)) at = i; });
      if (at === -1) { header.push(c); at = header.length - 1; }
      idx[c] = at;
    });

    var rows = prepared.items.map(function (it) {
      var cells = header.map(function (_, i) { return i < it.cells.length ? it.cells[i] : ''; });
      var r = byId[it.rowId];
      cells[idx.KET_QUA] = r ? (STATUS_LABEL[r.status] || r.status) : '';
      cells[idx.MA_LOI] = r ? (r.status === 'SUCCESS' || r.status === 'DRY_OK' ? '' : r.code) : '';
      cells[idx.NGUYEN_NHAN] = r ? (r.status === 'SUCCESS' ? '' : r.message || '') : '';
      cells[idx.THOI_GIAN_XU_LY] = r ? formatTime(r.finishedAt) : '';
      return cells;
    });
    return [header].concat(rows);
  }

  function makeFileName(mode, date) {
    var d = date || new Date();
    var stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    return (mode === 'dry' ? 'KetQuaChayThu_' : 'KetQua_') + stamp + '.xlsx';
  }

  // Dùng SheetJS (XLSX) đã đóng gói trong extension. Mọi ô là chuỗi nên giữ nguyên số 0 đầu.
  function toWorkbook(XLSX, aoa) {
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'KetQua');
    return wb;
  }

  var api = {
    RESULT_COLUMNS: RESULT_COLUMNS,
    STATUS_LABEL: STATUS_LABEL,
    formatTime: formatTime,
    buildResultAoa: buildResultAoa,
    makeFileName: makeFileName,
    toWorkbook: toWorkbook
  };

  if (isNode) module.exports = api;
  else { g.VNPCore = g.VNPCore || {}; g.VNPCore.exporter = api; }
})(typeof self !== 'undefined' ? self : globalThis);
