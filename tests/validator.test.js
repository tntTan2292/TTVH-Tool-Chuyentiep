'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../extension/core/validator');

const base = (extra) => V.normalizeRow(Object.assign({
  maBG: 'eb123456789vn ', hoTen: '  Nguyễn   Văn A ', diaChi: 'Số 1', soDT: '0901234567',
  email: '', loai: 'BUU_CUC', buuCuc: '533140', tinh: '', phuongXa: '', ghiChu: ''
}, extra || {}));
const codes = (row) => V.validateRow(row).map((e) => e.code);

test('chuẩn hóa dòng: mã BG in hoa bỏ khoảng trắng, họ tên gộp khoảng trắng, SĐT giữ nguyên', () => {
  const r = base({ soDT: ' 090 123 4567 ' });
  assert.equal(r.maBG, 'EB123456789VN');
  assert.equal(r.hoTen, 'Nguyễn Văn A');
  assert.equal(r.soDT, '090 123 4567');
  assert.equal(r.loai, 2);
});

test('dòng hợp lệ không có lỗi', () => {
  assert.deepEqual(V.validateRow(base()), []);
});

test('không quản lý nội dung: tên, địa chỉ, bưu cục, mã BG chỉ cần 1 ký tự là qua', () => {
  assert.deepEqual(codes(base({ maBG: 'x', hoTen: 'a', diaChi: '.', buuCuc: '1', soDT: '000' })), []);
  assert.deepEqual(codes(base({ maBG: 'AB12', hoTen: 'a'.repeat(400) })), []);
});

test('SĐT: chỉ chặn đúng như trang (trống = E03; sai regex của trang = E04), không ép 10 số', () => {
  assert.deepEqual(codes(base({ soDT: '901234567' })), []); // 9 số vẫn qua, trang cũng nhận
  assert.deepEqual(codes(base({ soDT: '02343822222' })), []);
  assert.deepEqual(codes(base({ soDT: '+84 901 234 567' })), []);
  assert.deepEqual(codes(base({ soDT: '(024) 3822 2222' })), []);
  assert.deepEqual(codes(base({ soDT: '123' })), []);
  assert.deepEqual(codes(base({ soDT: '' })), ['E03_THIEU_SO_DT']);
  assert.deepEqual(codes(base({ soDT: '12' })), ['E04_SAI_SO_DT']);
  assert.deepEqual(codes(base({ soDT: '09012345ab' })), ['E04_SAI_SO_DT']);
  assert.deepEqual(codes(base({ soDT: '+84901234567' })), ['E04_SAI_SO_DT']); // trang đòi có dấu cách sau mã nước
});

test('thiếu họ tên E01, thiếu địa chỉ E02', () => {
  assert.deepEqual(codes(base({ hoTen: '' })), ['E01_THIEU_HO_TEN']);
  assert.deepEqual(codes(base({ diaChi: '   ' })), ['E02_THIEU_DIA_CHI']);
});

test('email (không bắt buộc): để trống được; có nhập thì theo đúng regex của trang', () => {
  assert.deepEqual(codes(base({ email: '' })), []);
  assert.deepEqual(codes(base({ email: 'a.b@c.vn' })), []);
  assert.deepEqual(codes(base({ email: 'a@localhost' })), []);
  assert.deepEqual(codes(base({ email: "o'neil+tag@mail.example.vn" })), []);
  for (const bad of ['abc@', 'abc', 'a b@c.vn']) assert.deepEqual(codes(base({ email: bad })), ['E05_SAI_EMAIL'], bad);
});

test('mã BG: trống hoặc chứa dấu phẩy/chấm phẩy là E09, còn lại không kiểm tra', () => {
  assert.deepEqual(codes(base({ maBG: '' })), ['E09_SAI_MA_BG']);
  assert.deepEqual(codes(base({ maBG: 'AB123,CD456' })), ['E09_SAI_MA_BG']);
  assert.deepEqual(codes(base({ maBG: 'AB123;CD456' })), ['E09_SAI_MA_BG']);
  assert.deepEqual(codes(base({ maBG: 'ab 123 cd' })), []);
});

test('loại chuyển tiếp: nhận nhiều cách viết; sai báo E14', () => {
  for (const [input, expected] of [['BUU_CUC', 2], ['Bưu cục khác', 2], ['2', 2], [2, 2], ['DIA_CHI', 3], ['Địa chỉ mới', 3], ['địa chỉ', 3], ['3', 3]]) {
    assert.equal(V.parseLoai(input), expected, String(input));
  }
  assert.deepEqual(codes(base({ loai: 'khác' })), ['E14_SAI_LOAI_CHUYEN_TIEP']);
});

test('loại chuyển tiếp để trống: tự suy ra từ cột đã điền, không suy ra được thì E14', () => {
  assert.equal(base({ loai: '', buuCuc: '1' }).loai, 2);
  assert.deepEqual(codes(base({ loai: '', buuCuc: '1' })), []);
  const dc = base({ loai: '', buuCuc: '', tinh: 'Huế', phuongXa: 'A Lưới 1' });
  assert.equal(dc.loai, 3);
  assert.deepEqual(codes(dc), []);
  assert.deepEqual(codes(base({ loai: '', buuCuc: '', tinh: '', phuongXa: '' })), ['E14_SAI_LOAI_CHUYEN_TIEP']);
  assert.deepEqual(codes(base({ loai: '', buuCuc: '1', tinh: 'Huế', phuongXa: 'A Lưới 1' })), ['E14_SAI_LOAI_CHUYEN_TIEP']);
  // người dùng gõ sai loại (không để trống) thì không đoán
  assert.equal(base({ loai: 'khác', buuCuc: '1' }).loai, null);
});

test('loại bưu cục thiếu bưu cục E06; loại địa chỉ thiếu tỉnh hoặc xã E07', () => {
  assert.deepEqual(codes(base({ buuCuc: '' })), ['E06_THIEU_BUU_CUC']);
  assert.deepEqual(codes(base({ loai: 'DIA_CHI', buuCuc: '', tinh: '53', phuongXa: '' })), ['E07_THIEU_TINH_XA']);
  assert.deepEqual(codes(base({ loai: 'DIA_CHI', buuCuc: '', tinh: '53', phuongXa: '53764' })), []);
});

test('nhiều lỗi: mã đầu là lỗi chính, đủ thông báo', () => {
  const errs = V.validateRow(V.normalizeRow({ maBG: '', hoTen: '', diaChi: '', soDT: '', loai: '' }));
  assert.equal(errs[0].code, 'E09_SAI_MA_BG');
  assert.ok(errs.length >= 5);
});
