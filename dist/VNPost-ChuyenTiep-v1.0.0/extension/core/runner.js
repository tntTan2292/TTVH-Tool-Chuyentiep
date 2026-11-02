(function (g) {
  'use strict';

  var isNode = typeof module === 'object' && module.exports;
  var E = isNode ? require('./errors') : g.VNPCore.errors;

  var DEFAULTS = {
    delayMs: 1000,
    minDelayMs: 200,
    maxDelayMs: 10000,
    rowTimeoutMs: 30000,
    circuitLimit: 5
  };

  function defaultSleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // Bộ điều phối: chạy tuần tự từng dòng qua executor, có tạm dừng / tiếp tục / dừng,
  // ngắt mạch khi lỗi hệ thống liên tiếp, dừng an toàn khi hết phiên, lưu tiến độ để tiếp tục.
  //
  // opts.executor.processOne(command) -> Promise<result>   (command/result theo hợp đồng trong docs/PROMPT-ANTIGRAVITY-WP3-WP5.md)
  // opts.store.save(snapshot)         -> tùy chọn, gọi sau mỗi dòng
  function createRunner(opts) {
    var executor = opts.executor;
    var store = opts.store || null;
    var sleep = opts.sleep || defaultSleep;
    var now = opts.now || Date.now;
    var random = opts.random || Math.random;
    var rowTimeoutMs = opts.rowTimeoutMs !== undefined ? opts.rowTimeoutMs : DEFAULTS.rowTimeoutMs;
    var circuitLimit = opts.circuitLimit || DEFAULTS.circuitLimit;

    var listeners = {};
    var st = null; // trạng thái của lượt chạy hiện tại

    function on(evt, fn) {
      (listeners[evt] = listeners[evt] || []).push(fn);
      return function () { listeners[evt] = (listeners[evt] || []).filter(function (f) { return f !== fn; }); };
    }
    function emit(evt, payload) {
      (listeners[evt] || []).slice().forEach(function (fn) { try { fn(payload); } catch (e) { /* listener lỗi không làm hỏng lượt chạy */ } });
    }

    function setStatus(s) {
      if (st.status === s) return;
      st.status = s;
      emit('state', getState());
    }

    function record(item, res, extra) {
      var rec = {
        rowId: item.rowId,
        excelRow: item.excelRow,
        maBG: item.row ? item.row.maBG : '',
        status: res.status,
        code: res.code,
        message: res.message,
        serverCode: res.serverCode === undefined ? null : res.serverCode,
        httpStatus: res.httpStatus === undefined ? null : res.httpStatus,
        durationMs: res.durationMs || 0,
        finishedAt: now()
      };
      if (extra) Object.keys(extra).forEach(function (k) { rec[k] = extra[k]; });
      st.results[item.rowId] = rec;
      return rec;
    }

    function counts() {
      var c = { total: st.items.length, done: 0, ok: 0, fail: 0, unknown: 0, notProcessed: 0, pending: 0 };
      st.items.forEach(function (it) {
        var r = st.results[it.rowId];
        if (!r) { c.pending++; return; }
        if (r.status === 'NOT_PROCESSED') { c.notProcessed++; return; }
        c.done++;
        if (r.status === 'SUCCESS' || r.status === 'DRY_OK') c.ok++;
        else if (r.status === 'UNKNOWN') c.unknown++;
        else c.fail++;
      });
      return c;
    }

    function getState() {
      if (!st) return { status: 'idle', pauseRequested: false, pauseReason: null, progress: null };
      return { status: st.status, mode: st.mode, pauseRequested: st.pauseRequested, pauseReason: st.pauseReason, progress: counts() };
    }

    function getResults() {
      if (!st) return [];
      return st.items.map(function (it) { return st.results[it.rowId] || null; });
    }

    function getSummary() {
      if (!st) return null;
      var c = counts();
      var byCode = {};
      var failures = [];
      st.items.forEach(function (it) {
        var r = st.results[it.rowId];
        if (!r) return;
        byCode[r.code] = (byCode[r.code] || 0) + 1;
        if (r.status === 'FAIL' || r.status === 'DRY_FAIL' || r.status === 'UNKNOWN') {
          failures.push({ excelRow: r.excelRow, maBG: r.maBG, status: r.status, code: r.code, message: r.message });
        }
      });
      return {
        mode: st.mode,
        stopped: st.status === 'stopped',
        total: c.total,
        ok: c.ok,
        fail: c.fail,
        unknown: c.unknown,
        failTotal: c.fail + c.unknown,
        notProcessed: c.notProcessed,
        byCode: byCode,
        failures: failures,
        startedAt: st.startedAt,
        finishedAt: st.finishedAt || null
      };
    }

    function snapshot() {
      return { version: 1, mode: st.mode, savedAt: now(), finished: st.status === 'done' || st.status === 'stopped', results: getResults().filter(Boolean) };
    }

    async function persist() {
      if (!store) return;
      try { await store.save(snapshot()); } catch (e) { /* lỗi lưu không dừng lượt chạy */ }
    }

    function withTimeout(promise) {
      if (!rowTimeoutMs) return promise;
      var timer;
      var timeout = new Promise(function (_, rej) { timer = setTimeout(function () { rej(new Error('Quá thời gian chờ ' + rowTimeoutMs + ' ms')); }, rowTimeoutMs); });
      return Promise.race([promise, timeout]).then(
        function (v) { clearTimeout(timer); return v; },
        function (e) { clearTimeout(timer); throw e; }
      );
    }

    async function runItem(item) {
      var command = { type: 'PROCESS_ONE', rowId: item.rowId, mode: st.mode, row: item.row };
      var t0 = now();
      try {
        var res = await withTimeout(Promise.resolve(executor.processOne(command)));
        if (!res || typeof res !== 'object' || !res.status) throw new Error('Bộ thực thi trả về kết quả không hợp lệ');
        return res;
      } catch (e) {
        // Lỗi ở chế độ thật có thể xảy ra sau khi đã gửi nên không biết đã lưu hay chưa.
        var real = st.mode === 'real';
        return {
          rowId: item.rowId,
          status: real ? 'UNKNOWN' : 'FAIL',
          code: real ? 'E98_KET_QUA_KHONG_RO' : 'E99_LOI_KET_NOI',
          message: (real ? 'Không rõ bưu gửi đã được lưu hay chưa, hãy kiểm tra trên hệ thống. ' : '') + 'Chi tiết: ' + String((e && e.message) || e),
          durationMs: now() - t0
        };
      }
    }

    function jitter(ms) { return Math.round(ms * (0.8 + random() * 0.4)); }

    function waitGate() { return new Promise(function (res) { st.gate = res; }); }
    function openGate() { if (st && st.gate) { var r = st.gate; st.gate = null; r(); } }

    async function loop() {
      var i = 0;
      var consecutiveSystem = 0;
      var q = st.queue;
      while (i < q.length) {
        if (st.stopRequested) break;
        if (st.pauseRequested) {
          consecutiveSystem = 0;
          var gate = waitGate(); // tạo cổng trước khi báo trạng thái, để resume() gọi ngay trong sự kiện vẫn có tác dụng
          setStatus('paused');
          await gate;
          if (st.stopRequested) break;
          setStatus('running');
          continue;
        }

        var item = q[i];
        var res = await runItem(item);

        if (res.status === 'SESSION_EXPIRED') {
          // Chưa lưu gì (bị chuyển về trang đăng nhập): giữ nguyên dòng này, dừng chờ đăng nhập lại rồi thử lại.
          st.pauseRequested = true;
          st.pauseReason = 'session';
          emit('sessionExpired', { rowId: item.rowId, excelRow: item.excelRow });
          continue;
        }

        var rec = record(item, res);
        i++;
        consecutiveSystem = E.SYSTEM_CODES[rec.code] ? consecutiveSystem + 1 : 0;
        emit('row', rec);
        emit('progress', counts());
        await persist();

        if (consecutiveSystem >= circuitLimit && i < q.length) {
          st.pauseRequested = true;
          st.pauseReason = 'circuit';
          emit('circuitOpen', { consecutive: consecutiveSystem });
          continue;
        }
        if (i < q.length && !st.pauseRequested && !st.stopRequested) await sleep(jitter(st.delayMs));
      }

      // Dòng chưa xử lý (do dừng giữa chừng) được ghi rõ để báo cáo luôn khớp tổng.
      for (var k = i; k < q.length; k++) {
        if (!st.results[q[k].rowId]) {
          record(q[k], { status: 'NOT_PROCESSED', code: 'E91_DUNG_GIUA_CHUNG', message: E.describe('E91_DUNG_GIUA_CHUNG') });
        }
      }
      st.finishedAt = now();
      st.pauseRequested = false;
      st.pauseReason = null;
      setStatus(st.stopRequested ? 'stopped' : 'done');
      emit('progress', counts());
      await persist();
      var summary = getSummary();
      emit('done', summary);
      return summary;
    }

    // items: [{ rowId, excelRow, row, preError }] (kết quả của prepare.prepareFromAoa)
    // o.mode: "dry" | "real"  (bắt buộc)
    // o.delayMs: khoảng nghỉ giữa các dòng
    // o.previous: { [rowId]: kết quả cũ } hoặc mảng kết quả cũ, để tiếp tục lượt chạy thật còn dở
    function start(items, o) {
      o = o || {};
      if (st && (st.status === 'running' || st.status === 'paused')) throw new Error('Đang có một lượt chạy chưa kết thúc');
      if (o.mode !== 'dry' && o.mode !== 'real') throw new Error('Phải chọn chế độ "dry" hoặc "real"');
      var delay = Math.min(DEFAULTS.maxDelayMs, Math.max(DEFAULTS.minDelayMs, Number(o.delayMs) || DEFAULTS.delayMs));

      var previous = {};
      if (Array.isArray(o.previous)) o.previous.forEach(function (r) { if (r) previous[r.rowId] = r; });
      else if (o.previous) previous = o.previous;

      st = {
        mode: o.mode, delayMs: delay, items: items, results: {}, queue: [],
        status: 'running', pauseRequested: false, pauseReason: null, stopRequested: false,
        gate: null, startedAt: now(), finishedAt: null
      };

      var preFails = [];
      items.forEach(function (it) {
        var prev = previous[it.rowId];
        // Chỉ tiếp tục ở chế độ thật: bỏ qua dòng đã thành công hoặc không rõ kết quả (phải kiểm tra tay, không gửi lại).
        if (o.mode === 'real' && prev && (prev.status === 'SUCCESS' || prev.code === 'E98_KET_QUA_KHONG_RO')) {
          st.results[it.rowId] = Object.assign({}, prev, { skipped: true });
        } else if (it.preError) {
          preFails.push(record(it, { status: 'FAIL', code: it.preError.code, message: it.preError.message }));
        } else {
          st.queue.push(it);
        }
      });

      emit('state', getState());
      preFails.forEach(function (rec) { emit('row', rec); }); // để giao diện hiện cả các dòng lỗi từ bước kiểm tra trước
      emit('progress', counts());
      return loop();
    }

    function pause() {
      if (!st || (st.status !== 'running')) return;
      st.pauseRequested = true;
      st.pauseReason = st.pauseReason || 'user';
    }

    function resume() {
      if (!st || (st.status !== 'paused' && !st.pauseRequested)) return;
      st.pauseRequested = false;
      st.pauseReason = null;
      openGate();
    }

    function stop() {
      if (!st || (st.status !== 'running' && st.status !== 'paused')) return;
      st.stopRequested = true;
      openGate();
    }

    return { on: on, start: start, pause: pause, resume: resume, stop: stop, getState: getState, getResults: getResults, getSummary: getSummary };
  }

  var api = { createRunner: createRunner, DEFAULTS: DEFAULTS };

  if (isNode) module.exports = api;
  else { g.VNPCore = g.VNPCore || {}; g.VNPCore.runner = api; }
})(typeof self !== 'undefined' ? self : globalThis);
