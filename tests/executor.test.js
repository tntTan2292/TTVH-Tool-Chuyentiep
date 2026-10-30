'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseGetLadingHtml, parseGetByLadingCodeHtml, isSessionExpired } = require('../extension/page/executor');

test('parseGetLadingHtml: trích xuất đúng bưu gửi C39 từ fixture thật đã làm sạch', () => {
  const fixturePath = path.join(__dirname, '../docs/audit/fixtures/getlading_response.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const res = parseGetLadingHtml(html, 'BG_TEST_01');
  assert.equal(res.found, true);
  assert.equal(res.statusCode, 'C39');
  assert.equal(res.statusText, 'Bưu gửi chuyển tiếp');
  assert.equal(res.hasForwardButton, true);
  assert.equal(res.receiverName, 'NGUOI_NHAN_TEST');
  assert.ok(res.receiverAddress.includes('Huế'));
});

test('parseGetLadingHtml: bưu gửi không có trong bảng trả về found=false', () => {
  const fixturePath = path.join(__dirname, '../docs/audit/fixtures/getlading_response.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const res = parseGetLadingHtml(html, 'BG_KHONG_TON_TAI');
  assert.equal(res.found, false);
  assert.equal(res.hasForwardButton, false);
  assert.equal(res.statusCode, null);
});

test('parseGetByLadingCodeHtml: trích xuất trọn vẹn _newModel từ fixture HTML', () => {
  const fixturePath = path.join(__dirname, '../docs/audit/fixtures/getbyladingcode_response.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const model = parseGetByLadingCodeHtml(html);
  assert.ok(model, 'Model phải tồn tại');
  assert.equal(model.Id, 2286326613);
  assert.equal(model.LadingCode, 'BG_TEST_01');
  assert.equal(model.StatusCode, 'C39');
  assert.equal(model.PosName, 'BCVH Thuận Hóa');
  assert.equal(Object.keys(model).length, 93);
});

test('parseGetByLadingCodeHtml: HTML không có form hoặc rỗng trả về null', () => {
  assert.equal(parseGetByLadingCodeHtml('<div>Không tìm thấy bưu gửi</div>'), null);
  assert.equal(parseGetByLadingCodeHtml(''), null);
  assert.equal(parseGetByLadingCodeHtml(null), null);
});

test('isSessionExpired: phát hiện chính xác khi hết phiên đăng nhập', () => {
  assert.equal(isSessionExpired(401, ''), true);
  assert.equal(isSessionExpired(200, '<html><form action="/Account/Login" id="fLogin"></form></html>'), true);
  assert.equal(isSessionExpired(200, '<div>Đăng nhập hệ thống Pack & Send</div>'), true);
  assert.equal(isSessionExpired(200, '<div>Bưu gửi chuyển tiếp</div>'), false);
  assert.equal(isSessionExpired(200, null), false);
});

// ---- Bổ sung sau rà soát ----
const execMod = require('../extension/page/executor');

test('parseGetByLadingCodeHtml: giá trị chứa "};" và ngoặc nhọn trong chuỗi vẫn đọc đủ', () => {
  const html = '<script>var _newModel = {"Id":1,"Note":"abc};def {x}","Esc":"a\\"};b","Last":2};</script><p>sau</p>';
  const m = execMod.parseGetByLadingCodeHtml(html);
  assert.equal(m.Id, 1);
  assert.equal(m.Note, 'abc};def {x}');
  assert.equal(m.Esc, 'a"};b');
  assert.equal(m.Last, 2);
});

test('parseGetByLadingCodeHtml: có _newModel nhưng hỏng thì ném lỗi, không trả null', () => {
  assert.throws(() => execMod.parseGetByLadingCodeHtml('<script>var _newModel = {"Id":1,</script>'));
  assert.throws(() => execMod.parseGetByLadingCodeHtml('<script>var _newModel = {Id:1};</script>'));
  assert.equal(execMod.parseGetByLadingCodeHtml('<html>không có form</html>'), null);
});

function withFakeAjax(handler, fn) {
  global.window = { $: { ajax: (opts) => handler(opts) } };
  return Promise.resolve(fn()).finally(() => { delete global.window; });
}

test('post: giữ nguyên Code/Message của server, không tự gán "00" khi thiếu Code', async () => {
  const r = await withFakeAjax((o) => o.success({ Message: 'lỗi gì đó' }, 'success', { status: 200, responseText: '{}' }), () => execMod.api.post({ Id: 1 }));
  assert.equal(r.ok, true);
  assert.equal(r.data.Code, undefined);
  assert.equal(r.data.Message, 'lỗi gì đó');
  const ok = await withFakeAjax((o) => o.success({ Code: '00', Message: 'xong' }, 'success', { status: 200, responseText: '' }), () => execMod.api.post({ Id: 1 }));
  assert.equal(ok.data.Code, '00');
});

test('post: lỗi mạng -> NETWORK; trang đăng nhập -> SESSION_EXPIRED', async () => {
  const net = await withFakeAjax((o) => o.error({ status: 0, responseText: '' }), () => execMod.api.post({}));
  assert.equal(net.ok, false);
  assert.equal(net.kind, 'NETWORK');
  const out = await withFakeAjax((o) => o.error({ status: 200, responseText: '<form id="fLogin">' }), () => execMod.api.post({}));
  assert.equal(out.kind, 'SESSION_EXPIRED');
});

test('getForm: có _newModel hỏng -> lỗi HTTP (không phải E11); không có form -> model null', async () => {
  const bad = await withFakeAjax((o) => o.success('<script>var _newModel = {"Id":</script>', 'success', { status: 200 }), () => execMod.api.getForm('X', '', ''));
  assert.equal(bad.ok, false);
  const none = await withFakeAjax((o) => o.success('<div>Không tìm thấy</div>', 'success', { status: 200 }), () => execMod.api.getForm('X', '', ''));
  assert.deepEqual(none, { ok: true, data: { model: null } });
});

// ---- Tra cứu qua chính hàm tìm kiếm của trang ----
function fakeLadingPage(onSearch, opts) {
  opts = opts || {};
  const handlers = {};
  const state = { lastVal: null, searches: 0 };
  const $ = function () {
    return {
      length: opts.noBox ? 0 : 1,
      val(v) { if (v !== undefined) state.lastVal = v; return this; },
      on(ev, fn) { handlers.complete = fn; return this; },
      off() { return this; }
    };
  };
  $.ajax = () => {};
  global.document = {};
  global.window = { $, Lading: opts.noLading ? undefined : { GetLading: () => { state.searches++; setImmediate(() => onSearch(handlers.complete)); } } };
  return state;
}
const cleanupPage = () => { delete global.window; delete global.document; };
const ladingHtml = fs.readFileSync(path.join(__dirname, '..', 'docs', 'audit', 'fixtures', 'getlading_response.html'), 'utf8');

test('getLading: gọi Lading.GetLading của trang với mã BG, đọc kết quả trả về', async () => {
  const st = fakeLadingPage((cb) => cb({}, { status: 200, responseText: ladingHtml }, { url: '/Lading/Home/GetLading' }));
  try {
    const r = await execMod.api.getLading('BG_TEST_01');
    assert.equal(st.lastVal, 'BG_TEST_01');
    assert.equal(st.searches, 1);
    assert.equal(r.ok, true);
    assert.equal(r.data.found, true);
    assert.equal(r.data.hasForwardButton, true);
    assert.equal(r.data.statusCode, 'C39');
    assert.equal(global.window.__vnpLastLading.maBG, 'BG_TEST_01');
  } finally { cleanupPage(); }
});

test('getLading: bỏ qua các yêu cầu ajax khác (không phải GetLading)', async () => {
  fakeLadingPage((cb) => {
    cb({}, { status: 200, responseText: '{"unread":5}' }, { url: '/Notification/Count' });
    cb({}, { status: 200, responseText: ladingHtml }, { url: '/Lading/Home/GetLading' });
  });
  try {
    const r = await execMod.api.getLading('BG_TEST_01');
    assert.equal(r.ok, true);
    assert.equal(r.data.found, true);
  } finally { cleanupPage(); }
});

test('getLading: bảng trống -> found=false (vẫn ok)', async () => {
  fakeLadingPage((cb) => cb({}, { status: 200, responseText: '<div class="table-responsive"><table id="table_lading"><tbody></tbody></table></div>' }, { url: '/Lading/Home/GetLading' }));
  try {
    const r = await execMod.api.getLading('KHONGCO');
    assert.deepEqual([r.ok, r.data.found, r.data.hasForwardButton], [true, false, false]);
  } finally { cleanupPage(); }
});

test('getLading: HTTP 500 -> lỗi HTTP; trang đăng nhập -> hết phiên', async () => {
  fakeLadingPage((cb) => cb({}, { status: 500, responseText: '' }, { url: '/Lading/Home/GetLading' }));
  try {
    const r = await execMod.api.getLading('X');
    assert.equal(r.ok, false);
    assert.equal(r.kind, 'HTTP');
  } finally { cleanupPage(); }
  fakeLadingPage((cb) => cb({}, { status: 200, responseText: '<form id="fLogin"></form>' }, { url: '/Lading/Home/GetLading' }));
  try {
    assert.equal((await execMod.api.getLading('X')).kind, 'SESSION_EXPIRED');
  } finally { cleanupPage(); }
});

test('getLading: không ở trang 3.9 (thiếu Lading hoặc ô Mã vận đơn) -> báo rõ, không gọi gì', async () => {
  for (const opts of [{ noLading: true }, { noBox: true }]) {
    fakeLadingPage(() => { throw new Error('không được gọi'); }, opts);
    try {
      const r = await execMod.api.getLading('X');
      assert.equal(r.ok, false);
      assert.match(r.message, /3\.9/);
    } finally { cleanupPage(); }
  }
});
