'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRunner } = require('../extension/core/runner');

const items = (n) => Array.from({ length: n }, (_, i) => ({
  rowId: 'r' + (i + 3), excelRow: i + 3, row: { maBG: 'BG' + (i + 1) }, preError: null
}));
const ok = (cmd) => ({ rowId: cmd.rowId, status: cmd.mode === 'dry' ? 'DRY_OK' : 'SUCCESS', code: cmd.mode === 'dry' ? 'DRY_OK' : 'SUCCESS', message: 'ok', serverCode: '00', httpStatus: 200, durationMs: 5 });
const fail = (cmd, code) => ({ rowId: cmd.rowId, status: 'FAIL', code: code || 'E20_LOI_NGHIEP_VU', message: 'từ chối', serverCode: '01', httpStatus: 200, durationMs: 5 });
const unknown = (cmd) => ({ rowId: cmd.rowId, status: 'UNKNOWN', code: 'E98_KET_QUA_KHONG_RO', message: 'mất kết nối', durationMs: 5 });
const expired = (cmd) => ({ rowId: cmd.rowId, status: 'SESSION_EXPIRED', code: 'E90_HET_PHIEN', message: 'hết phiên', durationMs: 5 });

function make(processOne, extra) {
  const sleeps = [];
  const runner = createRunner(Object.assign({
    executor: { processOne: async (c) => processOne(c) },
    sleep: async (ms) => { sleeps.push(ms); },
    random: () => 0.5
  }, extra || {}));
  return { runner, sleeps };
}

const waitState = (runner, status) => new Promise((res) => {
  const off = runner.on('state', (s) => { if (s.status === status) { off(); res(s); } });
});

test('chạy hết: tổng kết đúng, delay nghỉ giữa các dòng (n-1 lần, ~1000ms)', async () => {
  const { runner, sleeps } = make(ok);
  const rowEvents = [];
  runner.on('row', (r) => rowEvents.push(r.rowId));
  const s = await runner.start(items(4), { mode: 'real', delayMs: 1000 });
  assert.equal(s.total, 4);
  assert.equal(s.ok, 4);
  assert.equal(s.failTotal, 0);
  assert.equal(s.stopped, false);
  assert.deepEqual(rowEvents, ['r3', 'r4', 'r5', 'r6']);
  assert.equal(sleeps.length, 3);
  assert.ok(sleeps.every((ms) => ms >= 800 && ms <= 1200));
  assert.equal(runner.getState().status, 'done');
});

test('delay được giới hạn trong khoảng cho phép', async () => {
  const { runner, sleeps } = make(ok, { random: () => 0.5 });
  await runner.start(items(2), { mode: 'real', delayMs: 5 });
  assert.equal(sleeps[0], 200);
});

test('dòng lỗi từ bước kiểm tra trước không gọi executor, tính vào thất bại', async () => {
  const called = [];
  const { runner } = make((c) => { called.push(c.rowId); return ok(c); });
  const list = items(3);
  list[1].preError = { code: 'E04_SAI_SO_DT', message: 'SĐT sai' };
  const s = await runner.start(list, { mode: 'real' });
  assert.deepEqual(called, ['r3', 'r5']);
  assert.equal(s.ok, 2);
  assert.equal(s.fail, 1);
  assert.equal(s.byCode.E04_SAI_SO_DT, 1);
  assert.equal(s.failures[0].excelRow, 4);
  assert.equal(s.total, s.ok + s.fail + s.unknown + s.notProcessed);
});

test('tổng kết gom thất bại theo mã, tách "không rõ"', async () => {
  const { runner } = make((c) => (c.rowId === 'r3' ? ok(c) : c.rowId === 'r4' ? fail(c, 'E11_BG_KHONG_PHAI_C39') : unknown(c)));
  const s = await runner.start(items(3), { mode: 'real' });
  assert.equal(s.ok, 1);
  assert.equal(s.fail, 1);
  assert.equal(s.unknown, 1);
  assert.equal(s.failTotal, 2);
  assert.deepEqual(s.byCode, { SUCCESS: 1, E11_BG_KHONG_PHAI_C39: 1, E98_KET_QUA_KHONG_RO: 1 });
  assert.equal(s.failures.length, 2);
});

test('tạm dừng rồi tiếp tục: dừng sau dòng đang chạy, không mất dòng nào', async () => {
  let runnerRef;
  const { runner } = make((c) => { if (c.rowId === 'r4') runnerRef.pause(); return ok(c); });
  runnerRef = runner;
  const paused = waitState(runner, 'paused');
  const p = runner.start(items(5), { mode: 'real' });
  const st = await paused;
  assert.equal(st.pauseReason, 'user');
  assert.equal(runner.getState().progress.done, 2);
  assert.equal(runner.getState().progress.pending, 3);
  runner.resume();
  const s = await p;
  assert.equal(s.ok, 5);
});

test('dừng hẳn: các dòng còn lại ghi E91, tổng luôn khớp', async () => {
  let runnerRef;
  const { runner } = make((c) => { if (c.rowId === 'r4') runnerRef.stop(); return ok(c); });
  runnerRef = runner;
  const s = await runner.start(items(5), { mode: 'real' });
  assert.equal(s.stopped, true);
  assert.equal(s.ok, 2);
  assert.equal(s.notProcessed, 3);
  assert.equal(s.byCode.E91_DUNG_GIUA_CHUNG, 3);
  assert.equal(s.total, 5);
  assert.equal(runner.getState().status, 'stopped');
  assert.equal(runner.getResults()[4].status, 'NOT_PROCESSED');
});

test('dừng khi đang tạm dừng cũng kết thúc đúng', async () => {
  let runnerRef;
  const { runner } = make((c) => { if (c.rowId === 'r3') runnerRef.pause(); return ok(c); });
  runnerRef = runner;
  const paused = waitState(runner, 'paused');
  const p = runner.start(items(3), { mode: 'real' });
  await paused;
  runner.stop();
  const s = await p;
  assert.equal(s.ok, 1);
  assert.equal(s.notProcessed, 2);
});

test('hết phiên: dừng, giữ dòng đó chưa xử lý, đăng nhập lại rồi thử lại đúng dòng đó', async () => {
  const calls = [];
  let firstExpiry = true;
  const { runner } = make((c) => {
    calls.push(c.rowId);
    if (c.rowId === 'r4' && firstExpiry) { firstExpiry = false; return expired(c); }
    return ok(c);
  });
  let expiredEvent = null;
  runner.on('sessionExpired', (e) => { expiredEvent = e; });
  const paused = waitState(runner, 'paused');
  const p = runner.start(items(4), { mode: 'real' });
  const st = await paused;
  assert.equal(st.pauseReason, 'session');
  assert.equal(expiredEvent.rowId, 'r4');
  assert.equal(runner.getState().progress.done, 1); // chỉ r3 xong; r4 chưa tính
  assert.equal(runner.getResults()[1], null);
  runner.resume();
  const s = await p;
  assert.equal(s.ok, 4);
  assert.deepEqual(calls, ['r3', 'r4', 'r4', 'r5', 'r6']);
});

test('hết phiên rồi người dùng dừng: dòng đó và các dòng sau ghi E91', async () => {
  const { runner } = make((c) => (c.rowId === 'r4' ? expired(c) : ok(c)));
  const paused = waitState(runner, 'paused');
  const p = runner.start(items(4), { mode: 'real' });
  await paused;
  runner.stop();
  const s = await p;
  assert.equal(s.ok, 1);
  assert.equal(s.notProcessed, 3);
});

test('ngắt mạch: 3 lỗi hệ thống liên tiếp thì tự dừng, tiếp tục được', async () => {
  const { runner } = make((c) => (['r4', 'r5', 'r6'].includes(c.rowId) ? unknown(c) : ok(c)), { circuitLimit: 3 });
  let circuit = null;
  runner.on('circuitOpen', (e) => { circuit = e; });
  const paused = waitState(runner, 'paused');
  const p = runner.start(items(7), { mode: 'real' });
  const st = await paused;
  assert.equal(st.pauseReason, 'circuit');
  assert.equal(circuit.consecutive, 3);
  assert.equal(runner.getState().progress.done, 4);
  runner.resume();
  const s = await p;
  assert.equal(s.unknown, 3);
  assert.equal(s.ok, 4);
});

test('lỗi hệ thống không liên tiếp thì không ngắt mạch', async () => {
  const { runner } = make((c) => (['r4', 'r6', 'r8'].includes(c.rowId) ? unknown(c) : ok(c)), { circuitLimit: 3 });
  let opened = false;
  runner.on('circuitOpen', () => { opened = true; });
  await runner.start(items(8), { mode: 'real' });
  assert.equal(opened, false);
});

test('tiếp tục lượt chạy thật: bỏ qua dòng đã thành công và dòng không rõ kết quả, thử lại dòng lỗi khác', async () => {
  const called = [];
  const { runner } = make((c) => { called.push(c.rowId); return ok(c); });
  const previous = [
    { rowId: 'r3', status: 'SUCCESS', code: 'SUCCESS' },
    { rowId: 'r4', status: 'UNKNOWN', code: 'E98_KET_QUA_KHONG_RO', message: 'cũ' },
    { rowId: 'r5', status: 'FAIL', code: 'E20_LOI_NGHIEP_VU' }
  ];
  const s = await runner.start(items(4), { mode: 'real', previous });
  assert.deepEqual(called, ['r5', 'r6']);
  assert.equal(s.ok, 3); // r3 (giữ) + r5 + r6
  assert.equal(s.unknown, 1); // r4 giữ nguyên để người dùng kiểm tra tay
  assert.equal(runner.getResults()[0].skipped, true);
});

test('chạy thử bỏ qua kết quả cũ', async () => {
  const called = [];
  const { runner } = make((c) => { called.push(c.rowId); return ok(c); });
  await runner.start(items(2), { mode: 'dry', previous: [{ rowId: 'r3', status: 'SUCCESS', code: 'SUCCESS' }] });
  assert.deepEqual(called, ['r3', 'r4']);
});

test('executor ném lỗi: chế độ thật -> không rõ (E98), chế độ thử -> E99', async () => {
  const boom = () => { throw new Error('boom'); };
  let r = make(boom);
  let s = await r.runner.start(items(1), { mode: 'real' });
  assert.equal(s.unknown, 1);
  assert.equal(s.byCode.E98_KET_QUA_KHONG_RO, 1);

  r = make(boom);
  s = await r.runner.start(items(1), { mode: 'dry' });
  assert.equal(s.fail, 1);
  assert.equal(s.byCode.E99_LOI_KET_NOI, 1);
});

test('executor treo quá thời gian: coi là không rõ kết quả', async () => {
  const { runner } = make(() => new Promise(() => {}), { rowTimeoutMs: 20 });
  const s = await runner.start(items(1), { mode: 'real' });
  assert.equal(s.unknown, 1);
  assert.match(runner.getResults()[0].message, /Quá thời gian/);
});

test('kết quả executor sai định dạng bị coi là lỗi, không làm hỏng tiến trình', async () => {
  const { runner } = make(() => ({ foo: 1 }));
  const s = await runner.start(items(2), { mode: 'real' });
  assert.equal(s.unknown, 2);
});

test('bắt buộc chọn chế độ; không chạy chồng hai lượt', async () => {
  const { runner } = make(ok);
  assert.throws(() => runner.start(items(1), {}), /dry|real/);
  assert.throws(() => runner.start(items(1)), /dry|real/);
  let release;
  const slow = make(() => new Promise((res) => { release = () => res({ rowId: 'r3', status: 'SUCCESS', code: 'SUCCESS', message: 'ok' }); }));
  const p = slow.runner.start(items(1), { mode: 'real' });
  assert.throws(() => slow.runner.start(items(1), { mode: 'real' }), /chưa kết thúc/);
  release();
  await p;
});

test('lưu tiến độ sau mỗi dòng; bản lưu dùng lại được làm previous', async () => {
  const snaps = [];
  const store = { save: async (s) => { snaps.push(JSON.parse(JSON.stringify(s))); } };
  const { runner } = make((c) => (c.rowId === 'r4' ? fail(c) : ok(c)), { store });
  await runner.start(items(3), { mode: 'real' });
  assert.ok(snaps.length >= 3);
  assert.equal(snaps[0].results.length, 1);
  const last = snaps[snaps.length - 1];
  assert.equal(last.finished, true);
  assert.equal(last.results.length, 3);

  const called = [];
  const again = make((c) => { called.push(c.rowId); return ok(c); });
  await again.runner.start(items(3), { mode: 'real', previous: last.results });
  assert.deepEqual(called, ['r4']); // chỉ thử lại dòng lỗi nghiệp vụ
});

test('lỗi khi lưu tiến độ không làm dừng lượt chạy', async () => {
  const store = { save: async () => { throw new Error('đầy bộ nhớ'); } };
  const { runner } = make(ok, { store });
  const s = await runner.start(items(2), { mode: 'real' });
  assert.equal(s.ok, 2);
});

test('sự kiện tiến độ có đủ bộ đếm và khớp tổng', async () => {
  const { runner } = make((c) => (c.rowId === 'r4' ? fail(c) : ok(c)));
  const progress = [];
  runner.on('progress', (p) => progress.push(p));
  await runner.start(items(3), { mode: 'real' });
  const last = progress[progress.length - 1];
  assert.deepEqual(last, { total: 3, done: 3, ok: 2, fail: 1, unknown: 0, notProcessed: 0, pending: 0 });
  assert.equal(progress[0].pending, 3);
});

test('nhận lệnh đúng hợp đồng: type, rowId, mode, row', async () => {
  const seen = [];
  const { runner } = make((c) => { seen.push(c); return ok(c); });
  await runner.start(items(1), { mode: 'dry' });
  assert.deepEqual(seen[0], { type: 'PROCESS_ONE', rowId: 'r3', mode: 'dry', row: { maBG: 'BG1' } });
});

test('lượt chạy rỗng kết thúc ngay', async () => {
  const { runner } = make(ok);
  const s = await runner.start([], { mode: 'real' });
  assert.equal(s.total, 0);
  assert.equal(runner.getState().status, 'done');
});

test('dòng lỗi từ bước kiểm tra trước cũng phát sự kiện "row" để hiện trong nhật ký', async () => {
  const { runner } = make(ok);
  const list = items(3);
  list[0].preError = { code: 'E01_THIEU_HO_TEN', message: 'thiếu tên' };
  const seen = [];
  runner.on('row', (r) => seen.push(r.rowId + ':' + r.code));
  await runner.start(list, { mode: 'real' });
  assert.deepEqual(seen, ['r3:E01_THIEU_HO_TEN', 'r4:SUCCESS', 'r5:SUCCESS']);
});
