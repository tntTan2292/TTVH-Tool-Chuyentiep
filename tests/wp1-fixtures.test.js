'use strict';
// Test dựa trên kết quả xác minh WP1 (docs/audit/06-xac-minh-bo-sung.md) và dữ liệu mẫu đã làm sạch.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../extension/core/address-resolver');
const V = require('../extension/core/validator');
const B = require('../extension/core/model-builder');
const { processOne } = require('../extension/core/process-one');
const { makeApi, validRow, noSleep } = require('./_fake-api');

const load = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8'));
const wardsRaw = load('getward_53.json');
const wards = wardsRaw.map((w) => ({ value: w.Value, text: w.Text })); // đúng cách executor đổi Value/Text
const model = load('newmodel_full.json');

test('mọi phường/xã mẫu của Huế tìm lại đúng mã: tên gốc, không dấu, chữ thường, thêm tiền tố', () => {
  const real = wards.filter((w) => w.value !== '');
  assert.ok(real.length >= 40);
  for (const w of real) {
    assert.equal(A.resolveWard(w.text, wards).value, w.value, w.text);
    assert.equal(A.resolveWard(w.text.toLowerCase(), wards).value, w.value, w.text);
    if (!/^Phường /.test(w.text)) assert.equal(A.resolveWard('Phường ' + w.text, wards).value, w.value, 'Phường ' + w.text);
  }
  assert.equal(A.resolveWard('thuan hoa', wards).value, wards.find((w) => w.text === 'Thuận Hòa').value);
  assert.equal(A.resolveWard('Thuận Hoà', wards).value, wards.find((w) => w.text === 'Thuận Hòa').value); // khác kiểu đặt dấu
  assert.equal(A.resolveWard('Đúc', wards).value, wards.find((w) => w.text === 'Phường Đúc').value);
});

test('dựng model từ _newModel thật: giữ đủ 93 khóa, chỉ đổi đúng 7 trường người dùng nhập', () => {
  const row = V.normalizeRow(validRow({ email: 'a@b.vn', ghiChu: 'Gấp' }));
  const out = B.buildModel(model, row, '533140');
  assert.equal(Object.keys(out).length, Object.keys(model).length);
  assert.equal(Object.keys(model).length, 93);
  const changed = Object.keys(out).filter((k) => JSON.stringify(out[k]) !== JSON.stringify(model[k])).sort();
  // AddressReturnType của mẫu đã là "2" nên không đổi; các trường còn lại đổi theo dòng Excel.
  assert.deepEqual(changed, ['AddressReturn', 'NextEmail', 'NextPhone', 'NoteReturn', 'ReceiverAddressReturn', 'ReceiverNameReturn'].sort());
  assert.equal(out.AddressReturnType, '2');
  assert.equal(out.Id, model.Id);
  assert.equal(out.ReturnDate, model.ReturnDate); // ngày giờ do server sinh (G6), client không đụng
  assert.equal(out.StatusDate, model.StatusDate);
  assert.equal(model.AddressReturnType, '2'); // không làm thay đổi bản gốc
  assert.equal(model.AddressReturn, '');
});

test('chạy thử cả quy trình bằng model thật: ra AddressReturn "53;mã xã" và không gửi', async () => {
  const api = makeApi({
    getForm: async () => ({ ok: true, data: { model } }),
    getWard: async () => ({ ok: true, data: wards })
  });
  const cmd = { rowId: 'r3', mode: 'dry', row: validRow({ loai: 'DIA_CHI', buuCuc: '', tinh: 'Thành phố Huế', phuongXa: 'Thủy Xuân' }) };
  const res = await processOne(api, cmd, { sleep: noSleep });
  assert.equal(res.status, 'DRY_OK');
  assert.equal(api.calls.filter((c) => c[0] === 'post').length, 0);

  const real = await processOne(api, { ...cmd, mode: 'real' }, { sleep: noSleep });
  assert.equal(real.status, 'SUCCESS');
  const sent = api.calls.find((c) => c[0] === 'post')[1];
  assert.equal(sent.AddressReturnType, '3');
  assert.equal(sent.AddressReturn, '53;' + wards.find((w) => w.text === 'Thủy Xuân').value);
});

test('form không có model (null): E11, không gửi', async () => {
  const api = makeApi({ getForm: async () => ({ ok: true, data: { model: null } }) });
  const res = await processOne(api, { rowId: 'r3', mode: 'real', row: validRow() }, { sleep: noSleep });
  assert.equal(res.code, 'E11_BG_KHONG_PHAI_C39');
  assert.equal(api.calls.filter((c) => c[0] === 'post').length, 0);
});

test('E11 nêu tên trạng thái hiện tại lấy từ kết quả tra cứu', async () => {
  const api = makeApi({ getLading: async () => ({ ok: true, data: { found: true, statusCode: null, statusText: 'Phát thành công', hasForwardButton: false } }) });
  const res = await processOne(api, { rowId: 'r3', mode: 'real', row: validRow() }, { sleep: noSleep });
  assert.equal(res.code, 'E11_BG_KHONG_PHAI_C39');
  assert.match(res.message, /Phát thành công/);
});

test('getForm vẫn chạy khi GetLading không đọc được người nhận cũ (tùy chọn, G2)', async () => {
  const api = makeApi({ getLading: async () => ({ ok: true, data: { found: true, statusCode: 'C39', hasForwardButton: true } }) });
  const res = await processOne(api, { rowId: 'r3', mode: 'dry', row: validRow() }, { sleep: noSleep });
  assert.equal(res.status, 'DRY_OK');
  assert.deepEqual(api.calls.find((c) => c[0] === 'getForm').slice(2), ['', '']);
});

test('email theo đúng regex của trang: không bắt buộc có phần mở rộng tên miền', () => {
  const rowWith = (e) => V.validateRow(V.normalizeRow(validRow({ email: e })));
  assert.deepEqual(rowWith('a@localhost'), []);
  assert.deepEqual(rowWith("o'neil+tag@mail.example.vn"), []);
  assert.equal(rowWith('abc@')[0].code, 'E05_SAI_EMAIL');
  assert.equal(rowWith('abc')[0].code, 'E05_SAI_EMAIL');
  assert.equal(rowWith('a b@c.vn')[0].code, 'E05_SAI_EMAIL');
});

test('hai xã chỉ khác dấu (Hương Văn / Hương Vân): gõ đúng dấu thì chọn đúng, gõ không dấu thì báo trùng', () => {
  const van = wards.find((w) => w.text === 'Hương Văn');
  const vanh = wards.find((w) => w.text === 'Hương Vân');
  assert.ok(van && vanh && van.value !== vanh.value);
  assert.equal(A.resolveWard('Hương Văn', wards).value, van.value);
  assert.equal(A.resolveWard('hương vân', wards).value, vanh.value);
  const r = A.resolveWard('huong van', wards);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'ambiguous');
  assert.equal(r.matches.length, 2);
});
