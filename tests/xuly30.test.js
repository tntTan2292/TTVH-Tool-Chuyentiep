'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../extension/core/xuly30');
const P = require('../extension/page/xuly30-page');
const E = require('../extension/core/errors');

const codes = (n) => Array.from({ length: n }, (_, i) => 'EL' + String(100000000 + i) + 'VN');
const okAll = (list) => ({ perCode: Object.fromEntries(list.map((c) => [c, { ok: true }])) });

function make(runStep, extra) {
  const calls = [];
  const events = { progress: [], error: [], success: [], row: [] };
  const ctl = X.createController(Object.assign({
    driver: { runStep: async (n, list) => { calls.push({ n, list: list.slice() }); return runStep(n, list, calls); } },
    sleep: async () => {},
    now: () => 1700000000000
  }, extra || {}));
  Object.keys(events).forEach((k) => ctl.on(k, (p) => events[k].push(p)));
  return { ctl, calls, events };
}

test('parseInput: chỉ lấy dòng Thành công, bỏ trùng, cảnh báo khi thiếu KET_QUA', () => {
  const aoa = [
    ['MA_BG', 'HO_TEN', 'KET_QUA', 'MA_LOI'],
    ['el111111111vn', 'A', 'Thành công', ''],
    ['EL222222222VN', 'B', 'Thất bại', 'E12'],
    ['EL111111111VN', 'A', 'Thành công', ''],
    ['', '', '', ''],
    ['EL333333333VN', 'C', 'Thành công', '']
  ];
  const r = X.parseInput(aoa);
  assert.equal(r.ok, true);
  assert.deepEqual(r.codes, ['EL111111111VN', 'EL333333333VN']);
  assert.equal(r.skipped.length, 1);
  assert.equal(r.duplicates.length, 1);
  assert.equal(r.stats.notSuccess, 1);


  assert.equal(X.parseInput([['A', 'B'], ['1', '2']]).ok, false);
  assert.equal(X.parseInput([['MA_BG', 'KET_QUA'], ['EL1VN', 'Thất bại']]).ok, false);
});

test('chạy đủ 4 bước: chia lô cho bước 1, 2, 4; bước 3 gọi một lần với toàn bộ BG', async () => {
  const list = codes(7);
  const { ctl, calls } = make((n, l) => okAll(l), { batchSize: 3 });
  const s = await ctl.run(list);
  assert.equal(s.total, 7);
  assert.equal(s.success, 7);
  const byStep = (n) => calls.filter((c) => c.n === n);
  assert.deepEqual(byStep(1).map((c) => c.list.length), [3, 3, 1]);
  assert.deepEqual(byStep(2).map((c) => c.list.length), [3, 3, 1]);
  assert.equal(byStep(3).length, 1);
  assert.equal(byStep(3)[0].list.length, 7);
  assert.deepEqual(byStep(4).map((c) => c.list.length), [3, 3, 1]);
  assert.deepEqual(calls.map((c) => c.n).filter((v, i, a) => a.indexOf(v) === i), [1, 2, 3, 4]);
  ctl.getResults().forEach((r) => assert.deepEqual(Object.values(r.steps), ['OK', 'OK', 'OK', 'OK']));
});

test('BG lỗi ở bước N bị loại khỏi các bước sau, các BG còn lại chạy tiếp', async () => {
  const list = codes(4);
  const bad = list[1];
  const { ctl, calls } = make((n, l) => {
    const r = okAll(l);
    if (n === 1 && l.includes(bad)) r.perCode[bad] = { ok: false, code: 'E41_VU_HOI_THAT_BAI', message: 'Hệ thống từ chối' };
    return r;
  });
  const s = await ctl.run(list);
  assert.equal(s.success, 3);
  assert.equal(s.fail, 1);
  assert.equal(s.failures[0].maBG, bad);
  assert.equal(s.failures[0].step, 1);
  assert.equal(s.failures[0].message, 'Hệ thống từ chối');
  [2, 3, 4].forEach((n) => assert.ok(!calls.find((c) => c.n === n).list.includes(bad), 'bước ' + n));
  assert.equal(s.byCode.E41_VU_HOI_THAT_BAI, 1);
});

test('BG driver không báo kết quả: không được coi là thành công (E98, UNKNOWN)', async () => {
  const list = codes(2);
  const { ctl } = make((n, l) => (n === 1 ? { perCode: { [l[0]]: { ok: true } } } : okAll(l)));
  const s = await ctl.run(list);
  assert.equal(s.success, 1);
  assert.equal(s.unknown, 1);
  assert.equal(ctl.getResults()[1].code, 'E98_KET_QUA_KHONG_RO');
});

test('lỗi cả lượt ở bước 3 (lệch số lượng): dừng, không chạy bước 4, BG ghi rõ đã xong đến đâu', async () => {
  const list = codes(3);
  const { ctl, calls, events } = make((n, l) => (n === 3 ? { fatal: { code: 'E43_SAI_LECH_SO_LUONG', message: 'Màn 3.2 hiển thị 5, kỳ vọng 3' } } : okAll(l)));
  const s = await ctl.run(list);
  assert.equal(s.success, 0);
  assert.equal(s.notProcessed, 3);
  assert.equal(s.halted.code, 'E43_SAI_LECH_SO_LUONG');
  assert.ok(!calls.find((c) => c.n === 4));
  const r = ctl.getResults()[0];
  assert.equal(r.status, 'NOT_PROCESSED');
  assert.match(r.message, /Màn 3.2 hiển thị 5/);
  assert.match(r.message, /Giao lại/);
  assert.equal(events.error.filter((e) => e.fatal).length, 1);
});

test('hết phiên: dừng ngay với E90_HET_PHIEN', async () => {
  const list = codes(2);
  const { ctl, calls } = make((n, l) => (n === 2 ? { sessionExpired: true, message: 'Hết phiên' } : okAll(l)));
  const s = await ctl.run(list);
  assert.equal(s.halted.code, 'E90_HET_PHIEN');
  assert.ok(!calls.find((c) => c.n === 3));
});

test('driver ném lỗi ở bước ghi: BG thành "không rõ", các bước sau bỏ qua BG đó', async () => {
  const list = codes(4);
  const { ctl, calls } = make((n, l) => {
    if (n === 1 && l.includes(list[0])) throw new Error('mất kết nối');
    return okAll(l);
  }, { batchSize: 2 });
  const s = await ctl.run(list);
  assert.equal(s.unknown, 2);
  assert.equal(s.success, 2);
  assert.match(ctl.getResults()[0].message, /mất kết nối/);
  assert.ok(!calls.find((c) => c.n === 2).list.includes(list[0]));
});

test('stop() giữa chừng: các BG chưa xử lý được ghi NOT_PROCESSED, báo cáo luôn khớp tổng', async () => {
  const list = codes(4);
  let ctlRef;
  const { ctl } = make((n, l) => { if (n === 1) ctlRef.stop(); return okAll(l); }, { batchSize: 2 });
  ctlRef = ctl;
  const s = await ctl.run(list);
  assert.equal(s.stopped, true);
  assert.equal(s.success + s.fail + s.unknown + s.notProcessed, 4);
  assert.ok(s.notProcessed >= 2);
});

test('hook onProgressUpdate / onError / onSuccess và sự kiện on(...) đều được gọi', async () => {
  const seen = { p: 0, e: 0, s: 0 };
  const list = codes(2);
  const ctl = X.createController({
    driver: { runStep: async (n, l) => { const r = okAll(l); if (n === 1) r.perCode[l[0]] = { ok: false, code: 'E41_VU_HOI_THAT_BAI', message: 'x' }; return r; } },
    sleep: async () => {},
    onProgressUpdate: () => { seen.p++; }, onError: () => { seen.e++; }, onSuccess: (s) => { seen.s++; assert.equal(s.total, 2); }
  });
  await ctl.run(list);
  assert.ok(seen.p > 0);
  assert.equal(seen.e, 1);
  assert.equal(seen.s, 1);
});

test('không cho chạy hai lượt đồng thời; mã trùng được khử', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const { ctl, calls } = make(async (n, l) => { await gate; return okAll(l); });
  const p = ctl.run(['EL1VN', 'el1vn', 'EL2VN']);
  await assert.rejects(() => ctl.run(['EL3VN']), /chưa kết thúc/);
  release();
  const s = await p;
  assert.equal(s.total, 2);
  assert.equal(calls[0].list.length, 2);
});

test('batchSize bị chặn ở mức tối đa 50', async () => {
  const { ctl, calls } = make((n, l) => okAll(l), { batchSize: 500 });
  await ctl.run(codes(60));
  assert.equal(calls.filter((c) => c.n === 1)[0].list.length, 50);
});

test('báo cáo: đủ cột, dòng thành công và thất bại', async () => {
  const list = codes(2);
  const { ctl } = make((n, l) => {
    const r = okAll(l);
    if (n === 2) r.perCode[l[1]] = { ok: false, code: 'E42_GIAO_LAI_THAT_BAI', message: 'Từ chối' };
    return r;
  });
  await ctl.run(list);
  const aoa = X.buildReportAoa(ctl.getResults());
  assert.deepEqual(aoa[0], X.REPORT_COLUMNS);
  assert.deepEqual(aoa[1].slice(0, 6), [list[0], 'Thành công', 'Thành công', 'Thành công', 'Thành công', 'Thành công']);
  assert.equal(aoa[1][6], '');
  assert.deepEqual(aoa[2].slice(0, 6), [list[1], 'Thành công', 'Thất bại', '', '', 'Thất bại']);
  assert.equal(aoa[2][6], 'E42_GIAO_LAI_THAT_BAI');
  assert.equal(aoa[2][7], 'Từ chối');
  assert.match(aoa[2][8], /^\d{2}\/\d{2}\/\d{4} /);
  assert.match(X.makeReportFileName(new Date(2026, 9, 30, 8, 5, 9)), /^KetQuaXuLy30_20261030_080509\.xlsx$/);
});

test('mọi mã lỗi trong danh mục audit đều có trong errors.js', () => {
  ['E40_KHONG_TIM_THAY_BG', 'E41_VU_HOI_THAT_BAI', 'E42_CHUA_VU_HOI', 'E42_GIAO_LAI_THAT_BAI', 'E43_KHONG_THAY_TUYEN_CT',
    'E43_SAI_LECH_SO_LUONG', 'E43_LAP_BD13_THAT_BAI', 'E44_IMPORT_381_THAT_BAI', 'E44_CHUYEN_30_THAT_BAI', 'E90_HET_PHIEN']
    .forEach((c) => assert.ok(E.CODES[c], c));
});

// ---- Hàm thuần của phần chạy trong trang ----

test('trang: nhận diện tuyến Chuyển tiếp theo tên, không theo value', () => {
  const opts = [{ value: '', text: '--- Chọn ---' }, { value: '1', text: '53547001 - 535470 - Tuyến A' }, { value: '29807', text: '53547017 - 535470 - Chuyển tiếp' }];
  assert.deepEqual(P.pickRouteOption(opts).map((o) => o.value), ['29807']);
  assert.equal(P.pickRouteOption([{ value: '1', text: 'CHUYEN TIEP' }, { value: '2', text: 'Chuyển tiếp 2' }]).length, 2);
  assert.equal(P.pickRouteOption(opts.slice(0, 2)).length, 0);
});

test('trang: tìm cột "SL bưu gửi chưa lập BD13" theo tiêu đề, không theo vị trí', () => {
  assert.equal(P.findColumnIndex(['STT', 'Tuyến', 'SL bưu gửi đã lập BD13', 'SL bưu gửi chưa lập BD13']), 3);
  assert.equal(P.findColumnIndex(['STT', 'SL bưu gửi chưa lập BĐ13']), 1);
  assert.equal(P.findColumnIndex(['A', 'B']), -1);
});

test('trang: đọc tỷ lệ thành công, mã BG, nhận diện trang đăng nhập', () => {
  assert.deepEqual(P.parseRatio('Cập nhật thành công 3/5 bưu gửi.'), { ok: 3, total: 5 });
  assert.deepEqual(P.parseRatio('Cập nhập dữ liệu thành công 1/1'), { ok: 1, total: 1 });
  assert.equal(P.parseRatio('Cập nhập dữ liệu thành công.'), null);
  assert.equal(P.extractCode('<td>el533085492vn</td>'), 'EL533085492VN');
  assert.equal(P.extractCode('khong co ma'), '');
  assert.equal(P.isLoginText('<form id="fLogin">'), true);
  assert.equal(P.isLoginText('{"Code":"00"}'), false);
  assert.equal(P.rowHasCode({ a: 1, LadingCode: 'EL533085492VN' }, 'EL533085492VN'), true);
  assert.equal(P.rowHasCode({ a: 'x' }, 'EL533085492VN'), false);
});

test('bước 3 dừng giữa chừng: BG đã lập BĐ13 trước đó vẫn được ghi nhận OK', async () => {
  const list = codes(3);
  const { ctl } = make((n, l) => {
    if (n !== 3) return okAll(l);
    return { perCode: { [list[0]]: { ok: true } }, fatal: { code: 'E43_SAI_LECH_SO_LUONG', message: 'có BG lạ' } };
  });
  const s = await ctl.run(list);
  const r = ctl.getResults();
  assert.equal(r[0].steps.bd13, 'OK');
  assert.equal(r[0].status, 'NOT_PROCESSED');
  assert.match(r[0].message, /Lập bản kê/);
  assert.equal(r[1].steps.bd13, '');
  assert.equal(s.halted.code, 'E43_SAI_LECH_SO_LUONG');
});

test('hết phiên sau khi đã gửi lệnh ghi: lô thành "không rõ", không phải "chưa xử lý"', async () => {
  const list = codes(2);
  const { ctl } = make((n, l) => (n === 1 ? { sessionExpired: true, wrote: true, message: 'hết phiên' } : okAll(l)));
  const s = await ctl.run(list);
  assert.equal(s.unknown, 2);
  assert.equal(s.halted.code, 'E90_HET_PHIEN');
  assert.equal(ctl.getResults()[0].code, 'E98_KET_QUA_KHONG_RO');
});

test('hết phiên trước khi ghi: BG vẫn "chưa xử lý"', async () => {
  const { ctl } = make((n, l) => ({ sessionExpired: true, message: 'hết phiên' }));
  const s = await ctl.run(codes(2));
  assert.equal(s.notProcessed, 2);
});

test('parseInput: file thiếu cột KET_QUA bị chặn', () => {
  const r = X.parseInput([['MA_BG'], ['EL1VN']]);
  assert.equal(r.ok, false);
  assert.match(r.fatal[0], /KET_QUA/);
});

test('sự kiện row phát cho cả BG dừng giữa chừng', async () => {
  const { ctl, events } = make((n, l) => (n === 2 ? { fatal: { code: 'E43_KHONG_THAY_TUYEN_CT', message: 'x' } } : okAll(l)));
  await ctl.run(codes(2));
  assert.ok(events.row.some((r) => r.status === 'NOT_PROCESSED'));
});

test('làm tiếp từ bước 3: bước 1 và 2 không được gọi, BG ghi "Bỏ qua"', async () => {
  const list = codes(3);
  const { ctl, calls } = make((n, l) => okAll(l));
  const s = await ctl.run(list, { startStep: 3 });
  assert.deepEqual(calls.map((c) => c.n), [3, 4]);
  assert.equal(s.success, 3);
  const r = ctl.getResults()[0];
  assert.deepEqual(Object.values(r.steps), ['SKIP', 'SKIP', 'OK', 'OK']);
  const aoa = X.buildReportAoa(ctl.getResults());
  assert.equal(aoa[1][1], 'Bỏ qua');
});

test('làm tiếp từ bước 2: bước 1 không gọi, bước 2 gọi theo lô', async () => {
  const { ctl, calls } = make((n, l) => okAll(l), { batchSize: 2 });
  await ctl.run(codes(3), { startStep: 2 });
  assert.deepEqual(calls.map((c) => c.n), [2, 2, 3, 4, 4]);
});

test('chạy riêng một bước: chỉ gọi đúng bước đó, BG xong bước được tính thành công', async () => {
  const { ctl, calls } = make((n, l) => okAll(l));
  const s = await ctl.run(codes(3), { startStep: 2, endStep: 2 });
  assert.deepEqual(calls.map((c) => c.n), [2]);
  assert.equal(s.success, 3);
  assert.match(ctl.getResults()[0].message, /bước 2/);
});

test('chạy riêng bước 1: BG lỗi vẫn ghi lỗi, BG tốt tính thành công', async () => {
  const list = codes(2);
  const { ctl, calls } = make((n, l) => {
    const r = okAll(l);
    r.perCode[l[1]] = { ok: false, code: 'E41_VU_HOI_THAT_BAI', message: 'x' };
    return r;
  });
  const s = await ctl.run(list, { startStep: 1, endStep: 1 });
  assert.deepEqual(calls.map((c) => c.n), [1]);
  assert.equal(s.success, 1);
  assert.equal(s.fail, 1);
});

test('làm tiếp từ bước 3 trở đi: driver nhận cờ resumed; chạy mới thì không', async () => {
  const seen = [];
  const mk = () => X.createController({ driver: { runStep: async (n, l, o) => { seen.push([n, !!(o && o.resumed)]); return okAll(l); } }, sleep: async () => {} });
  await mk().run(codes(1), { startStep: 3 });
  assert.deepEqual(seen, [[3, true], [4, true]]);
  seen.length = 0;
  await mk().run(codes(1));
  assert.ok(seen.every((x) => x[1] === false));
});

test('bước 3 nhiều nhóm: driver trả again, bộ điều phối gọi lại cho phần còn lại', async () => {
  const list = codes(4);
  const calls3 = [];
  const { ctl } = make((n, l) => {
    if (n !== 3) return okAll(l);
    calls3.push(l.slice());
    if (calls3.length === 1) return { again: true, perCode: Object.fromEntries(l.slice(0, 3).map((c) => [c, { ok: true }])) };
    return okAll(l);
  });
  const s = await ctl.run(list);
  assert.equal(calls3.length, 2);
  assert.deepEqual(calls3[1], [list[3]]);
  assert.equal(s.success, 4);
});
