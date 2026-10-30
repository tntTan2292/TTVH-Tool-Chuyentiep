(function (g) {
  'use strict';

  var isNode = typeof module === 'object' && module.exports;
  var T = isNode ? require('./text-utils') : g.VNPCore.text;
  var V = isNode ? require('./validator') : g.VNPCore.validator;

  var MAX_ROWS = 500;

  // Tiêu đề cột (đã chuẩn hóa bằng text.key) -> tên trường. Hỗ trợ cả mẫu bản 1 (MA_TINH, MA_PHUONG_XA)
  // và bản 2 (TINH, PHUONG_XA nhập tên). Một trường có thể có nhiều cột, lấy ô không rỗng đầu tiên.
  var ALIASES = {
    mabg: 'maBG',
    hotennguoinhan: 'hoTen',
    diachinguoinhan: 'diaChi',
    sodienthoai: 'soDT',
    loaichuyentiep: 'loai',
    buucucchuyenden: 'buuCuc',
    tinh: 'tinh', matinh: 'tinh',
    phuongxa: 'phuongXa', maphuongxa: 'phuongXa',
    email: 'email',
    ghichu: 'ghiChu'
  };
  var REQUIRED_FIELDS = [
    ['maBG', 'MA_BG'], ['hoTen', 'HO_TEN_NGUOI_NHAN'], ['diaChi', 'DIA_CHI_NGUOI_NHAN'],
    ['soDT', 'SO_DIEN_THOAI'], ['loai', 'LOAI_CHUYEN_TIEP']
  ];

  function isBlankRow(cells) {
    for (var i = 0; i < cells.length; i++) if (T.toStr(cells[i]) !== '') return false;
    return true;
  }

  // aoa: mảng các dòng, mỗi dòng là mảng ô (ví dụ XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })).
  // Dòng 1 là tiêu đề. Dòng 2 nếu là dòng mô tả cột của file mẫu (chứa "(*)" ở cột mã BG) thì bỏ qua.
  function prepareFromAoa(aoa) {
    var out = { ok: false, fatal: [], header: [], items: [], stats: { total: 0, valid: 0, invalid: 0, exceedsMax: false } };
    if (!Array.isArray(aoa) || aoa.length === 0) { out.fatal.push('File không có dữ liệu'); return out; }

    var header = aoa[0].map(T.toStr);
    out.header = header;
    var cols = {};
    header.forEach(function (h, i) {
      var f = ALIASES[T.key(h)];
      if (f) (cols[f] = cols[f] || []).push(i);
    });
    var missing = REQUIRED_FIELDS.filter(function (p) { return !cols[p[0]]; }).map(function (p) { return p[1]; });
    if (missing.length) { out.fatal.push('Thiếu cột bắt buộc ở dòng 1: ' + missing.join(', ')); return out; }

    function cell(cells, field) {
      var idx = cols[field] || [];
      for (var i = 0; i < idx.length; i++) { var v = T.toStr(cells[idx[i]]); if (v !== '') return v; }
      return '';
    }

    var start = 1;
    if (aoa.length > 1 && T.toStr(aoa[1][cols.maBG[0]]).indexOf('(*)') !== -1) start = 2;

    var seen = {};
    for (var r = start; r < aoa.length; r++) {
      var cells = aoa[r] || [];
      if (isBlankRow(cells)) continue;
      var raw = {};
      Object.keys(cols).forEach(function (f) { raw[f] = cell(cells, f); });
      var row = V.normalizeRow(raw);
      var errs = V.validateRow(row);
      if (row.maBG) {
        if (seen[row.maBG]) errs.push({ code: 'E08_TRUNG_MA_BG', message: 'Mã bưu gửi trùng với dòng ' + seen[row.maBG] + ' trong file' });
        else seen[row.maBG] = r + 1;
      }
      out.items.push({
        rowId: 'r' + (r + 1),
        excelRow: r + 1,
        cells: header.map(function (_, i) { return T.toStr(cells[i]); }),
        row: row,
        preError: errs.length ? { code: errs[0].code, message: errs.map(function (e) { return e.message; }).join('; ') } : null
      });
    }

    out.stats.total = out.items.length;
    out.stats.invalid = out.items.filter(function (it) { return it.preError; }).length;
    out.stats.valid = out.stats.total - out.stats.invalid;
    out.stats.exceedsMax = out.stats.total > MAX_ROWS;
    out.ok = out.stats.total > 0;
    if (!out.ok) out.fatal.push('File không có dòng dữ liệu nào');
    return out;
  }

  var api = { MAX_ROWS: MAX_ROWS, prepareFromAoa: prepareFromAoa };

  if (isNode) module.exports = api;
  else { g.VNPCore = g.VNPCore || {}; g.VNPCore.prepare = api; }
})(typeof self !== 'undefined' ? self : globalThis);
