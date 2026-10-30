'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { processOne } = require('../extension/core/process-one');
const { makeApi, validRow, noSleep } = require('./_fake-api');

const cmd = (row, mode) => ({ rowId: 'r3', mode: mode || 'real', row });
const ctx = () => ({ sleep: noSleep });
const posted = (api) => api.calls.filter((c) => c[0] === 'post');

test('thành công theo bưu cục khác: gán đúng trường, giữ nguyên khóa khác của model', async () => {
  const api = makeApi();
  const res = await processOne(api, cmd(validRow({ email: 'a@b.vn', ghiChu: 'Gấp' })), ctx());
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.code, 'SUCCESS');
  assert.equal(res.serverCode, '00');
  assert.equal(res.rowId, 'r3');
  const m = posted(api)[0][1];
  assert.equal(m.Id, 123);
  assert.equal(m.PosName, 'BCVH Test');
  assert.equal(m.ReceiverNameReturn, 'Nguyễn Văn Mẫu');
  assert.equal(m.ReceiverAddressReturn, 'Số 1 Đường Giả Định');
  assert.equal(m.NextPhone, '0901234567');
  assert.equal(m.NextEmail, 'a@b.vn');
  assert.equal(m.AddressReturnType, '2');
  assert.equal(m.AddressReturn, '533140');
  assert.equal(m.NoteReturn, 'Gấp');
});

test('truyền receiverName/receiverAddress lấy từ GetLading sang GetByLadingCode', async () => {
  const api = makeApi();
  await processOne(api, cmd(validRow()), ctx());
  const f = api.calls.find((c) => c[0] === 'getForm');
  assert.deepEqual(f, ['getForm', 'EB123456789VN', 'Nguyen A', 'Dia chi cu']);
});

test('thành công theo địa chỉ: AddressReturn = "tỉnh;xã", tên đổi thành mã', async () => {
  const api = makeApi();
  const res = await processOne(api, cmd(validRow({ loai: 'Địa chỉ mới', buuCuc: '', tinh: 'Huế', phuongXa: 'A Lưới 1' })), ctx());
  assert.equal(res.status, 'SUCCESS');
  const m = posted(api)[0][1];
  assert.equal(m.AddressReturnType, '3');
  assert.equal(m.AddressReturn, '53;53764');
  assert.deepEqual(api.calls.find((c) => c[0] === 'getWard'), ['getWard', '53']);
});

test('danh sách xã được dùng lại giữa các dòng cùng tỉnh (cache theo ctx)', async () => {
  const api = makeApi();
  const c = ctx();
  const row = validRow({ loai: 'DIA_CHI', buuCuc: '', tinh: '53', phuongXa: 'A Lưới 2' });
  await processOne(api, cmd(row), c);
  await processOne(api, cmd({ ...row, maBG: 'EB123456790VN' }), c);
  assert.equal(api.calls.filter((x) => x[0] === 'getWard').length, 1);
});

test('chạy thử: không bao giờ gọi post, trả DRY_OK', async () => {
  const api = makeApi();
  const res = await processOne(api, cmd(validRow(), 'dry'), ctx());
  assert.equal(res.status, 'DRY_OK');
  assert.equal(posted(api).length, 0);
});

test('chạy thử: lỗi nghiệp vụ trả DRY_FAIL và vẫn không gọi post', async () => {
  const api = makeApi({ getLading: async () => ({ ok: true, data: { found: false } }) });
  const res = await processOne(api, cmd(validRow(), 'dry'), ctx());
  assert.equal(res.status, 'DRY_FAIL');
  assert.equal(res.code, 'E10_BG_KHONG_TON_TAI');
  assert.equal(posted(api).length, 0);
});

test('dòng không hợp lệ: báo lỗi ngay, không gọi server', async () => {
  const api = makeApi();
  const res = await processOne(api, cmd(validRow({ hoTen: '' })), ctx());
  assert.equal(res.status, 'FAIL');
  assert.equal(res.code, 'E01_THIEU_HO_TEN');
  assert.equal(api.calls.length, 0);
});

test('không tìm thấy bưu gửi: E10', async () => {
  const api = makeApi({ getLading: async () => ({ ok: true, data: { found: false } }) });
  const res = await processOne(api, cmd(validRow()), ctx());
  assert.equal(res.code, 'E10_BG_KHONG_TON_TAI');
  assert.equal(api.calls.some((c) => c[0] === 'getForm'), false);
});

test('không có nút chuyển tiếp hoặc trạng thái khác C39: E11, không mở form', async () => {
  for (const data of [
    { found: true, statusCode: 'C39', hasForwardButton: false },
    { found: true, statusCode: 'C44', hasForwardButton: true },
    { found: true, statusCode: null, hasForwardButton: false }
  ]) {
    const api = makeApi({ getLading: async () => ({ ok: true, data }) });
    const res = await processOne(api, cmd(validRow()), ctx());
    assert.equal(res.code, 'E11_BG_KHONG_PHAI_C39', JSON.stringify(data));
    assert.equal(api.calls.some((c) => c[0] === 'getForm'), false);
    assert.equal(posted(api).length, 0);
  }
});

test('model từ server mang trạng thái khác C39: E11, không gửi', async () => {
  const api = makeApi({ getForm: async () => ({ ok: true, data: { model: { Id: 1, StatusCode: 'C44' } } }) });
  const res = await processOne(api, cmd(validRow()), ctx());
  assert.equal(res.code, 'E11_BG_KHONG_PHAI_C39');
  assert.equal(posted(api).length, 0);
});

test('tỉnh không tìm thấy / xã không tìm thấy / xã trùng: E12, không gửi', async () => {
  let api = makeApi();
  let res = await processOne(api, cmd(validRow({ loai: 'DIA_CHI', buuCuc: '', tinh: 'Atlantis', phuongXa: 'X' })), ctx());
  assert.equal(res.code, 'E12_KHONG_KHOP_DIA_CHI');
  assert.match(res.message, /Atlantis/);

  api = makeApi();
  res = await processOne(api, cmd(validRow({ loai: 'DIA_CHI', buuCuc: '', tinh: 'Huế', phuongXa: 'Không có' })), ctx());
  assert.equal(res.code, 'E12_KHONG_KHOP_DIA_CHI');
  assert.equal(posted(api).length, 0);

  api = makeApi({
    getWard: async () => ({ ok: true, data: [{ value: '53201', text: 'Phường 1' }, { value: '53202', text: 'Xã 1' }] })
  });
  res = await processOne(api, cmd(validRow({ loai: 'DIA_CHI', buuCuc: '', tinh: 'Huế', phuongXa: '1' })), ctx());
  assert.equal(res.code, 'E12_KHONG_KHOP_DIA_CHI');
  assert.match(res.message, /nhiều kết quả/);
});

test('server từ chối (Code khác 00): E20 kèm mã và thông báo nguyên văn', async () => {
  const api = makeApi({ post: async () => ({ ok: true, data: { Code: '01', Message: 'Bưu cục không tồn tại' } }) });
  const res = await processOne(api, cmd(validRow()), ctx());
  assert.equal(res.status, 'FAIL');
  assert.equal(res.code, 'E20_LOI_NGHIEP_VU');
  assert.equal(res.serverCode, '01');
  assert.match(res.message, /Bưu cục không tồn tại/);
});

test('mất kết nối khi gửi: UNKNOWN/E98 và post chỉ được gọi 1 lần', async () => {
  const api = makeApi({ post: async () => ({ ok: false, kind: 'NETWORK', message: 'timeout' }) });
  const res = await processOne(api, cmd(validRow()), ctx());
  assert.equal(res.status, 'UNKNOWN');
  assert.equal(res.code, 'E98_KET_QUA_KHONG_RO');
  assert.equal(posted(api).length, 1);
});

test('phản hồi POST không đúng định dạng: UNKNOWN/E98', async () => {
  for (const data of ['<html>Login</html>', null, {}, { Message: 'x' }]) {
    const api = makeApi({ post: async () => ({ ok: true, data }) });
    const res = await processOne(api, cmd(validRow()), ctx());
    assert.equal(res.status, 'UNKNOWN', JSON.stringify(data));
    assert.equal(res.code, 'E98_KET_QUA_KHONG_RO');
  }
});

test('hết phiên ở bất kỳ bước nào: SESSION_EXPIRED/E90, và không gửi nếu hết phiên trước POST', async () => {
  let api = makeApi({ getLading: async () => ({ ok: false, kind: 'SESSION_EXPIRED', httpStatus: 401 }) });
  let res = await processOne(api, cmd(validRow()), ctx());
  assert.equal(res.status, 'SESSION_EXPIRED');
  assert.equal(res.code, 'E90_HET_PHIEN');
  assert.equal(api.calls.length, 1); // không thử lại khi hết phiên

  api = makeApi({ getForm: async () => ({ ok: false, kind: 'SESSION_EXPIRED' }) });
  res = await processOne(api, cmd(validRow()), ctx());
  assert.equal(res.status, 'SESSION_EXPIRED');

  api = makeApi({ post: async () => ({ ok: false, kind: 'SESSION_EXPIRED' }) });
  res = await processOne(api, cmd(validRow()), ctx());
  assert.equal(res.status, 'SESSION_EXPIRED');
});

test('GET lỗi mạng được thử lại tối đa 2 lần rồi thành công', async () => {
  let n = 0;
  const api = makeApi({
    getLading: async () => (++n < 3
      ? { ok: false, kind: 'NETWORK', message: 'lỗi' }
      : { ok: true, data: { found: true, statusCode: 'C39', hasForwardButton: true } })
  });
  const res = await processOne(api, cmd(validRow()), ctx());
  assert.equal(res.status, 'SUCCESS');
  assert.equal(api.calls.filter((c) => c[0] === 'getLading').length, 3);
});

test('GET lỗi mạng cả 3 lần: E99, không gửi', async () => {
  const api = makeApi({ getLading: async () => ({ ok: false, kind: 'HTTP', httpStatus: 500, message: 'lỗi máy chủ' }) });
  const res = await processOne(api, cmd(validRow()), ctx());
  assert.equal(res.status, 'FAIL');
  assert.equal(res.code, 'E99_LOI_KET_NOI');
  assert.equal(res.httpStatus, 500);
  assert.equal(api.calls.filter((c) => c[0] === 'getLading').length, 3);
  assert.equal(posted(api).length, 0);
});

test('hàm api ném lỗi được coi là lỗi mạng, không làm hỏng tiến trình', async () => {
  const api = makeApi({ getLading: async () => { throw new Error('boom'); } });
  const res = await processOne(api, cmd(validRow()), ctx());
  assert.equal(res.code, 'E99_LOI_KET_NOI');
});

test('thiếu model trong phản hồi form: E99', async () => {
  const api = makeApi({ getForm: async () => ({ ok: true, data: {} }) });
  const res = await processOne(api, cmd(validRow()), ctx());
  assert.equal(res.code, 'E99_LOI_KET_NOI');
  assert.equal(posted(api).length, 0);
});

test('kết quả luôn có đủ trường theo hợp đồng', async () => {
  const res = await processOne(makeApi(), cmd(validRow()), ctx());
  for (const k of ['rowId', 'status', 'code', 'message', 'serverCode', 'httpStatus', 'durationMs']) assert.ok(k in res, k);
});
