'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../extension/core/prepare');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'mau.aoa.json'), 'utf8'));

test('đọc file mẫu thật: bỏ dòng mô tả, bỏ dòng trống, 4 dòng dữ liệu', () => {
  const r = P.prepareFromAoa(fixture);
  assert.equal(r.ok, true);
  assert.deepEqual(r.fatal, []);
  assert.equal(r.stats.total, 4);
  assert.equal(r.items[0].excelRow, 3);
  assert.equal(r.items[0].row.maBG, 'EB123456789VN');
});

test('file mẫu: dòng địa chỉ thiếu phường/xã bị E07, các dòng khác hợp lệ', () => {
  const r = P.prepareFromAoa(fixture);
  assert.equal(r.stats.valid, 3);
  assert.equal(r.stats.invalid, 1);
  assert.equal(r.items[2].preError.code, 'E07_THIEU_TINH_XA');
  assert.equal(r.items[1].preError, null);
  assert.equal(r.items[1].row.tinh, '53'); // cột MA_TINH của mẫu bản 1
  assert.equal(r.items[1].row.phuongXa, '53764');
});

const H = ['MA_BG', 'HO_TEN_NGUOI_NHAN', 'DIA_CHI_NGUOI_NHAN', 'SO_DIEN_THOAI', 'LOAI_CHUYEN_TIEP', 'BUU_CUC_CHUYEN_DEN', 'TINH', 'PHUONG_XA'];

test('mẫu bản 2: cột TINH/PHUONG_XA nhập tên', () => {
  const r = P.prepareFromAoa([H, ['CH987654321VN', 'A', 'B', '0912345678', 'Địa chỉ mới', '', 'Huế', 'A Lưới 1']]);
  assert.equal(r.items[0].preError, null);
  assert.equal(r.items[0].row.tinh, 'Huế');
  assert.equal(r.items[0].row.loai, 3);
});

test('thiếu cột bắt buộc là lỗi chung của file', () => {
  const r = P.prepareFromAoa([['MA_BG', 'HO_TEN_NGUOI_NHAN'], ['A', 'B']]);
  assert.equal(r.ok, false);
  assert.match(r.fatal[0], /DIA_CHI_NGUOI_NHAN/);
  assert.match(r.fatal[0], /SO_DIEN_THOAI/);
});

test('mã BG trùng: dòng đầu giữ, dòng sau E08', () => {
  const row = ['CH987654321VN', 'A', 'B', '0912345678', 'BUU_CUC', '533140', '', ''];
  const r = P.prepareFromAoa([H, row, row]);
  assert.equal(r.items[0].preError, null);
  assert.equal(r.items[1].preError.code, 'E08_TRUNG_MA_BG');
  assert.match(r.items[1].preError.message, /dòng 2/);
});

test('mã trùng khác hoa/thường và khoảng trắng vẫn bị coi là trùng', () => {
  const a = ['ch987654321vn', 'A', 'B', '0912345678', 'BUU_CUC', '533140', '', ''];
  const b = [' CH987654321VN ', 'A', 'B', '0912345678', 'BUU_CUC', '533140', '', ''];
  const r = P.prepareFromAoa([H, a, b]);
  assert.equal(r.items[1].preError.code, 'E08_TRUNG_MA_BG');
});

test('SĐT dạng số (Excel mất số 0 đầu) vẫn qua, gửi đúng như người dùng nhập', () => {
  const r = P.prepareFromAoa([H, ['CH987654321VN', 'A', 'B', 912345678, 'BUU_CUC', '533140', '', '']]);
  assert.equal(r.items[0].preError, null);
  assert.equal(r.items[0].row.soDT, '912345678');
});

test('để trống cột loại chuyển tiếp: suy ra theo cột đã điền', () => {
  const r = P.prepareFromAoa([H,
    ['CH987654321VN', 'A', 'B', '0912345678', '', '1', '', ''],
    ['CH987654322VN', 'A', 'B', '0912345678', '', '', 'Huế', 'A Lưới 1']]);
  assert.equal(r.items[0].row.loai, 2);
  assert.equal(r.items[1].row.loai, 3);
  assert.equal(r.stats.invalid, 0);
});

test('file chỉ có tiêu đề hoặc rỗng không chạy được', () => {
  assert.equal(P.prepareFromAoa([H]).ok, false);
  assert.equal(P.prepareFromAoa([]).ok, false);
});

test('vượt 500 dòng được đánh dấu để giao diện cảnh báo', () => {
  const rows = [H];
  for (let i = 0; i < 501; i++) rows.push(['AB' + String(100000000 + i) + 'VN', 'A', 'B', '0912345678', 'BUU_CUC', '533140', '', '']);
  assert.equal(P.prepareFromAoa(rows).stats.exceedsMax, true);
});

test('giữ nguyên các ô gốc để xuất kết quả', () => {
  const r = P.prepareFromAoa([H, ['CH987654321VN', 'A', 'B', '0912345678', 'BUU_CUC', '533140', '', '']]);
  assert.deepEqual(r.items[0].cells.slice(0, 4), ['CH987654321VN', 'A', 'B', '0912345678']);
});
