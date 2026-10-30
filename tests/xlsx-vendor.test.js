'use strict';
// Kiểm tra thư viện SheetJS đóng gói trong extension đọc được file mẫu thật và ghi lại giữ nguyên số 0 đầu.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('../extension/vendor/xlsx.full.min.js');
const P = require('../extension/core/prepare');
const X = require('../extension/core/exporter');

const template = path.join(__dirname, '..', 'extension', 'assets', 'mau-import-chuyen-tiep.xlsx');

test('SheetJS là bản 0.20.x', () => {
  assert.match(XLSX.version, /^0\.20\./);
});

test('đọc file mẫu .xlsx thật qua đúng cách giao diện đọc, ra 4 dòng và 1 dòng lỗi E07', () => {
  const wb = XLSX.read(fs.readFileSync(template), { type: 'buffer' });
  assert.ok(wb.SheetNames.includes('ChuyenTiep'));
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets.ChuyenTiep, { header: 1, raw: false, defval: '' });
  const r = P.prepareFromAoa(aoa);
  assert.equal(r.ok, true);
  assert.equal(r.stats.total, 4);
  assert.equal(r.items[0].row.soDT, '0901234567'); // ô định dạng Text giữ số 0 đầu
  assert.equal(r.items[2].preError.code, 'E07_THIEU_TINH_XA');
});

test('xuất file kết quả rồi đọc lại: số 0 đầu và cột kết quả còn nguyên', () => {
  const wb0 = XLSX.read(fs.readFileSync(template), { type: 'buffer' });
  const aoa0 = XLSX.utils.sheet_to_json(wb0.Sheets.ChuyenTiep, { header: 1, raw: false, defval: '' });
  const prepared = P.prepareFromAoa(aoa0);
  const results = [{ rowId: prepared.items[0].rowId, status: 'SUCCESS', code: 'SUCCESS', message: 'ok', finishedAt: Date.now() }];
  const out = X.toWorkbook(XLSX, X.buildResultAoa(prepared, results));
  const buf = XLSX.write(out, { type: 'buffer', bookType: 'xlsx' });
  const back = XLSX.utils.sheet_to_json(XLSX.read(buf, { type: 'buffer' }).Sheets.KetQua, { header: 1, raw: false, defval: '' });
  assert.equal(back[1][3], '0901234567');
  assert.equal(back[1][back[0].indexOf('KET_QUA')], 'Thành công');
});
