'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../extension/core/address-resolver');
const { PROVINCES } = require('../extension/core/provinces');

test('có đủ 34 tỉnh/thành, mã không trùng', () => {
  assert.equal(PROVINCES.length, 34);
  assert.equal(new Set(PROVINCES.map((p) => p.value)).size, 34);
});

test('tỉnh: khớp theo tên, bỏ dấu, tiền tố, mã số', () => {
  for (const input of ['Huế', 'hue', 'HUẾ', 'Thành phố Huế', 'TP Huế', 'tp. hue', '53']) {
    const r = A.resolveProvince(input);
    assert.equal(r.ok, true, input);
    assert.equal(r.value, '53', input);
  }
  assert.equal(A.resolveProvince('Hà Nội').value, '10');
  assert.equal(A.resolveProvince('ha noi').value, '10');
  assert.equal(A.resolveProvince('Hồ Chí Minh').value, '70');
  assert.equal(A.resolveProvince('Đà Nẵng').value, '55');
  assert.equal(A.resolveProvince('da nang').value, '55');
});

test('tỉnh: không tìm thấy / trống', () => {
  assert.deepEqual(A.resolveProvince('Atlantis'), { ok: false, reason: 'not_found' });
  assert.equal(A.resolveProvince('').reason, 'empty');
  assert.equal(A.resolveProvince('99').reason, 'not_found');
});

const wards = [
  { value: '', text: '--- Phường, xã ---' },
  { value: '53764', text: 'A Lưới 1' },
  { value: '53766', text: 'A Lưới 2' },
  { value: '53111', text: 'Phường Thuận Hóa' },
  { value: '53201', text: 'Phường 1' },
  { value: '53202', text: 'Xã 1' }
];

test('phường/xã: khớp tên đầy đủ, bỏ dấu, theo mã, bỏ tiền tố', () => {
  assert.equal(A.resolveWard('A Lưới 1', wards).value, '53764');
  assert.equal(A.resolveWard('a luoi 2', wards).value, '53766');
  assert.equal(A.resolveWard('53766', wards).value, '53766');
  assert.equal(A.resolveWard('Thuận Hóa', wards).value, '53111');
  assert.equal(A.resolveWard('Phường Thuận Hóa', wards).value, '53111');
  assert.equal(A.resolveWard('Xã Thuận Hóa', wards).value, '53111'); // chấp nhận bỏ tiền tố khi duy nhất
});

test('phường/xã: tên đầy đủ phân biệt được, tên rút gọn trùng thì báo nhiều kết quả', () => {
  assert.equal(A.resolveWard('Phường 1', wards).value, '53201');
  assert.equal(A.resolveWard('Xã 1', wards).value, '53202');
  const r = A.resolveWard('1', wards);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'ambiguous');
  assert.equal(r.matches.length, 2);
});

test('phường/xã: không tìm thấy, mục "--- Phường, xã ---" không bị chọn', () => {
  assert.equal(A.resolveWard('Không có', wards).reason, 'not_found');
  assert.equal(A.resolveWard('--- Phường, xã ---', wards).ok, false);
});
