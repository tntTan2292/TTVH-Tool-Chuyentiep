'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const X = require('../extension/core/exporter');
const P = require('../extension/core/prepare');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'mau.aoa.json'), 'utf8'));

test('file mẫu đã có 4 cột kết quả: ghi đè đúng cột, không thêm cột mới', () => {
  const prepared = P.prepareFromAoa(fixture);
  const results = [
    { rowId: 'r3', status: 'SUCCESS', code: 'SUCCESS', message: 'ok', finishedAt: Date.now() },
    { rowId: 'r4', status: 'FAIL', code: 'E12_KHONG_KHOP_DIA_CHI', message: 'Không tìm thấy xã', finishedAt: Date.now() },
    { rowId: 'r5', status: 'FAIL', code: 'E07_THIEU_TINH_XA', message: 'thiếu xã', finishedAt: Date.now() },
    { rowId: 'r6', status: 'UNKNOWN', code: 'E98_KET_QUA_KHONG_RO', message: 'mất kết nối', finishedAt: Date.now() }
  ];
  const aoa = X.buildResultAoa(prepared, results);
  assert.equal(aoa.length, 5); // tiêu đề + 4 dòng, không có dòng mô tả
  assert.equal(aoa[0].length, fixture[0].length);
  const h = aoa[0];
  const col = (n) => h.indexOf(n);
  assert.equal(aoa[1][col('KET_QUA')], 'Thành công');
  assert.equal(aoa[1][col('MA_LOI')], '');
  assert.equal(aoa[2][col('KET_QUA')], 'Thất bại');
  assert.equal(aoa[2][col('MA_LOI')], 'E12_KHONG_KHOP_DIA_CHI');
  assert.equal(aoa[2][col('NGUYEN_NHAN')], 'Không tìm thấy xã');
  assert.equal(aoa[4][col('KET_QUA')], 'Không rõ, cần kiểm tra thủ công');
  assert.match(aoa[1][col('THOI_GIAN_XU_LY')], /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
});

test('giữ nguyên dữ liệu gốc, kể cả số 0 đầu của SĐT', () => {
  const prepared = P.prepareFromAoa(fixture);
  const aoa = X.buildResultAoa(prepared, []);
  assert.equal(aoa[1][0], 'EB123456789VN');
  assert.equal(aoa[1][3], '0901234567');
});

test('file không có cột kết quả: thêm 4 cột vào cuối', () => {
  const prepared = P.prepareFromAoa([
    ['MA_BG', 'HO_TEN_NGUOI_NHAN', 'DIA_CHI_NGUOI_NHAN', 'SO_DIEN_THOAI', 'LOAI_CHUYEN_TIEP', 'BUU_CUC_CHUYEN_DEN'],
    ['CH987654321VN', 'A', 'B', '0912345678', 'BUU_CUC', '533140']
  ]);
  const aoa = X.buildResultAoa(prepared, { r2: { rowId: 'r2', status: 'DRY_OK', code: 'DRY_OK', message: 'ok', finishedAt: 0 } });
  assert.deepEqual(aoa[0].slice(6), ['KET_QUA', 'MA_LOI', 'NGUYEN_NHAN', 'THOI_GIAN_XU_LY']);
  assert.equal(aoa[1][6], 'Chạy thử: sẽ thành công');
  assert.equal(aoa[1][7], '');
});

test('dòng chưa có kết quả để trống; chưa xử lý ghi rõ', () => {
  const prepared = P.prepareFromAoa(fixture);
  const aoa = X.buildResultAoa(prepared, [{ rowId: 'r3', status: 'NOT_PROCESSED', code: 'E91_DUNG_GIUA_CHUNG', message: 'Chưa xử lý (đã dừng)', finishedAt: 1 }]);
  const col = (n) => aoa[0].indexOf(n);
  assert.equal(aoa[1][col('KET_QUA')], 'Chưa xử lý');
  assert.equal(aoa[1][col('MA_LOI')], 'E91_DUNG_GIUA_CHUNG');
  assert.equal(aoa[2][col('KET_QUA')], '');
});

test('tên file: kết quả thật và chạy thử khác nhau', () => {
  const d = new Date(2026, 9, 29, 8, 5, 3);
  assert.equal(X.makeFileName('real', d), 'KetQua_20261029_080503.xlsx');
  assert.equal(X.makeFileName('dry', d), 'KetQuaChayThu_20261029_080503.xlsx');
});

test('toWorkbook gọi đúng SheetJS và đặt tên sheet', () => {
  const calls = [];
  const XLSX = {
    utils: {
      aoa_to_sheet: (a) => { calls.push('aoa'); return { a }; },
      book_new: () => ({ sheets: [] }),
      book_append_sheet: (wb, ws, name) => { wb.sheets.push(name); }
    }
  };
  const wb = X.toWorkbook(XLSX, [['a']]);
  assert.deepEqual(wb.sheets, ['KetQua']);
  assert.deepEqual(calls, ['aoa']);
});
