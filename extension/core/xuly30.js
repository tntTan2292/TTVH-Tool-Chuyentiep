(function (g) {
  'use strict';

  var isNode = typeof module === 'object' && module.exports;
  var T = isNode ? require('./text-utils') : g.VNPCore.text;
  var E = isNode ? require('./errors') : g.VNPCore.errors;

  // Điều phối "Xử lý 3.0": Vu hồi (6.2) -> Giao lại (6.2) -> Lập BĐ13 (3.2) -> Chuyển về 3.0 (3.8.1).
  // Nguồn: docs/audit-xuly30/*. Phần chạm vào trang PNS nằm ở driver (sidepanel/xuly30-bridge.js + page/xuly30-page.js),
  // lõi này chỉ chia lô, nối kết quả từng BG qua các bước và báo cáo, nên chạy và kiểm thử được bằng Node.

  var STEPS = [
    { no: 1, key: 'vuHoi', name: 'Vu hồi (6.2)', col: 'KQ_VU_HOI' },
    { no: 2, key: 'giaoLai', name: 'Giao lại bưu gửi vu hồi (6.2)', col: 'KQ_GIAO_LAI' },
    { no: 3, key: 'bd13', name: 'Lập bản kê BĐ13 (3.2)', col: 'KQ_BD13' },
    { no: 4, key: 'chuyen30', name: 'Chuyển bưu gửi về 3.0 (3.8.1)', col: 'KQ_CHUYEN_30' }
  ];

  var DEFAULTS = { batchSize: 40, maxBatchSize: 50, stepDelayMs: 1200 };

  var REPORT_COLUMNS = ['MA_BG', 'KQ_VU_HOI', 'KQ_GIAO_LAI', 'KQ_BD13', 'KQ_CHUYEN_30', 'KET_QUA_CHUNG', 'MA_LOI', 'NGUYEN_NHAN', 'THOI_GIAN_XU_LY'];
  var STEP_LABEL = { OK: 'Thành công', FAIL: 'Thất bại', UNKNOWN: 'Không rõ', SKIP: 'Bỏ qua', '': '' };
  var FINAL_LABEL = { SUCCESS: 'Thành công', FAIL: 'Thất bại', UNKNOWN: 'Không rõ, cần kiểm tra thủ công', NOT_PROCESSED: 'Chưa xử lý' };

  function chunk(arr, size) {
    var out = [];
    for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function defaultSleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // aoa của file kết quả Chuyển tiếp (hoặc file bất kỳ có cột MA_BG). Chỉ lấy dòng KET_QUA = "Thành công".
  // File không có cột KET_QUA: lấy mọi dòng và kèm cảnh báo.
  function parseInput(aoa) {
    var out = { ok: false, fatal: [], warnings: [], codes: [], skipped: [], duplicates: [], stats: { rows: 0, success: 0, notSuccess: 0 } };
    if (!Array.isArray(aoa) || !aoa.length) { out.fatal.push('File không có dữ liệu'); return out; }
    var header = aoa[0].map(function (h) { return T.key(h); });
    var iBG = header.indexOf('mabg');
    var iKQ = header.indexOf('ketqua');
    if (iBG === -1) { out.fatal.push('Thiếu cột MA_BG ở dòng 1'); return out; }
    if (iKQ === -1) { out.fatal.push('Thiếu cột KET_QUA. Hãy nạp file kết quả của chức năng Chuyển tiếp (chỉ các dòng "Thành công" mới được xử lý).'); return out; }

    var seen = {};
    for (var r = 1; r < aoa.length; r++) {
      var cells = aoa[r] || [];
      var code = T.toStr(cells[iBG]).toUpperCase().replace(/\s+/g, '');
      if (!code) continue;
      out.stats.rows++;
      if (iKQ !== -1 && T.key(cells[iKQ]) !== 'thanhcong') {
        out.stats.notSuccess++;
        out.skipped.push({ excelRow: r + 1, maBG: code, reason: 'Kết quả chuyển tiếp: ' + (T.toStr(cells[iKQ]) || 'trống') });
        continue;
      }
      if (/[,;\s]/.test(code)) { out.skipped.push({ excelRow: r + 1, maBG: code, reason: 'Mã bưu gửi sai định dạng' }); continue; }
      if (seen[code]) { out.duplicates.push({ excelRow: r + 1, maBG: code, firstRow: seen[code] }); continue; }
      seen[code] = r + 1;
      out.stats.success++;
      out.codes.push(code);
    }
    out.ok = out.codes.length > 0;
    if (!out.ok) out.fatal.push('Không có bưu gửi nào chuyển tiếp thành công để xử lý');
    return out;
  }

  // driver.runStep(stepNo, codes) -> Promise<{
  //   sessionExpired?: true, message?,
  //   fatal?: { code, message },                                  // lỗi cả lượt (không tìm thấy tuyến, lệch số lượng...) -> dừng
  //   perCode: { [maBG]: { ok: true, message? } | { ok: false, code, message, unknown? } }
  // }>
  // Bước 3 chỉ gọi 1 lần cho toàn bộ BG còn lại; các bước 1, 2, 4 gọi theo lô.
  function createController(opts) {
    opts = opts || {};
    var driver = opts.driver;
    var sleep = opts.sleep || defaultSleep;
    var now = opts.now || Date.now;
    var stepDelayMs = opts.stepDelayMs !== undefined ? opts.stepDelayMs : DEFAULTS.stepDelayMs;
    var batchSize = Math.min(DEFAULTS.maxBatchSize, Math.max(1, Number(opts.batchSize) || DEFAULTS.batchSize));

    var listeners = {};
    var hookMap = { progress: opts.onProgressUpdate, error: opts.onError, success: opts.onSuccess };
    var st = null;

    function on(evt, fn) {
      (listeners[evt] = listeners[evt] || []).push(fn);
      return function () { listeners[evt] = (listeners[evt] || []).filter(function (f) { return f !== fn; }); };
    }
    function emit(evt, payload) {
      var fns = (listeners[evt] || []).slice();
      if (typeof hookMap[evt] === 'function') fns.push(hookMap[evt]);
      fns.forEach(function (fn) { try { fn(payload); } catch (e) { /* giao diện lỗi không làm hỏng lượt chạy */ } });
    }

    function newRec(code) {
      return { maBG: code, steps: { vuHoi: '', giaoLai: '', bd13: '', chuyen30: '' }, status: 'PENDING', code: '', message: '', failedStep: 0, finishedAt: null };
    }

    function markFail(rec, step, code, message, unknown) {
      rec.steps[step.key] = unknown ? 'UNKNOWN' : 'FAIL';
      rec.status = unknown ? 'UNKNOWN' : 'FAIL';
      rec.code = code;
      rec.message = message || E.describe(code);
      rec.failedStep = step.no;
      rec.finishedAt = now();
      emit('row', rec);
      emit('error', { fatal: false, step: step.no, stepName: step.name, code: code, message: rec.message, maBG: rec.maBG });
    }

    function counts() {
      var c = { total: st.codes.length, success: 0, fail: 0, unknown: 0, notProcessed: 0, running: 0 };
      st.codes.forEach(function (code) {
        var s = st.recs[code].status;
        if (s === 'SUCCESS') c.success++;
        else if (s === 'FAIL') c.fail++;
        else if (s === 'UNKNOWN') c.unknown++;
        else if (s === 'NOT_PROCESSED') c.notProcessed++;
        else c.running++;
      });
      return c;
    }

    function progress(step, done, total, extra) {
      emit('progress', Object.assign({
        step: step.no, stepName: step.name, stepsTotal: STEPS.length,
        done: done, total: total, counts: counts()
      }, extra || {}));
    }

    function alive(step) {
      // BG còn đi tiếp được đến bước này: chưa lỗi và đã qua bước ngay trước.
      return st.codes.filter(function (c) {
        var r = st.recs[c];
        if (r.status !== 'PENDING' || r.steps[step.key] === 'OK') return false; // đã xong bước này (lần gọi trước)
        var prev = step.no === 1 ? 'OK' : r.steps[STEPS[step.no - 2].key];
        return prev === 'OK' || prev === 'SKIP';
      });
    }

    function applyResult(step, codes, res) {
      var per = (res && res.perCode) || {};
      codes.forEach(function (code) {
        var rec = st.recs[code];
        var p = per[code];
        if (!p) {
          // Driver không báo gì về BG này: không được coi là thành công.
          markFail(rec, step, 'E98_KET_QUA_KHONG_RO', 'Không nhận được kết quả của bưu gửi này ở bước ' + step.name + ', hãy kiểm tra thủ công.', true);
        } else if (p.ok) {
          rec.steps[step.key] = 'OK';
          if (step.no === 4) { rec.status = 'SUCCESS'; rec.code = 'SUCCESS'; rec.message = p.message || ''; rec.finishedAt = now(); }
          emit('row', rec);
        } else {
          markFail(rec, step, p.code || 'E98_KET_QUA_KHONG_RO', p.message, !!p.unknown);
        }
      });
    }

    async function callDriver(step, codes) {
      try {
        return await driver.runStep(step.no, codes, { resumed: !!st.resumed });
      } catch (e) {
        return { threw: true, message: String((e && e.message) || e) };
      }
    }

    // Trả về true nếu phải dừng cả lượt.
    function handleAbort(step, codes, res) {
      if (res.sessionExpired || res.fatal) {
        // Kết quả đã chốt trước khi dừng (ví dụ BĐ13 đã lập cho nhóm trước) vẫn phải được ghi nhận.
        var per = res.perCode || {};
        var known = codes.filter(function (c) { return per[c]; });
        if (known.length) applyResult(step, known, res);
        if (res.sessionExpired && res.wrote) {
          // Hết phiên sau khi đã bấm lệnh ghi: không biết lệnh đã được thực hiện hay chưa.
          codes.filter(function (c) { return !per[c] && st.recs[c].status === 'PENDING'; }).forEach(function (c) {
            markFail(st.recs[c], step, 'E98_KET_QUA_KHONG_RO', 'Hết phiên đăng nhập sau khi đã gửi lệnh ở bước ' + step.name + ', không rõ đã thực hiện hay chưa. Hãy kiểm tra thủ công.', true);
          });
        }
      }
      if (res.sessionExpired) {
        halt(step, 'E90_HET_PHIEN', res.message || E.describe('E90_HET_PHIEN'));
        return true;
      }
      if (res.fatal) {
        halt(step, res.fatal.code, res.fatal.message || E.describe(res.fatal.code));
        return true;
      }
      if (res.threw) {
        // Có thể đã gửi lệnh ghi trước khi lỗi: không biết kết quả nên không đoán là thành công hay thất bại.
        codes.forEach(function (code) {
          markFail(st.recs[code], step, 'E98_KET_QUA_KHONG_RO', 'Lỗi khi thực hiện bước ' + step.name + ': ' + res.message + '. Hãy kiểm tra thủ công.', true);
        });
        return false;
      }
      return false;
    }

    function halt(step, code, message) {
      st.halted = { step: step.no, code: code, message: message };
      emit('error', { fatal: true, step: step.no, stepName: step.name, code: code, message: message });
    }

    async function runBatched(step) {
      var batches = chunk(alive(step), batchSize);
      var total = batches.reduce(function (n, b) { return n + b.length; }, 0);
      var done = 0;
      for (var i = 0; i < batches.length; i++) {
        if (st.stopRequested || st.halted) return;
        var codes = batches[i].filter(function (c) { return st.recs[c].status === 'PENDING'; });
        progress(step, done, total, { batch: i + 1, batches: batches.length });
        var res = await callDriver(step, codes);
        if (handleAbort(step, codes, res)) return;
        if (!res.threw) applyResult(step, codes, res);
        done += batches[i].length;
        progress(step, done, total, { batch: i + 1, batches: batches.length });
        if (i < batches.length - 1) await sleep(stepDelayMs);
      }
    }

    async function runBd13(step) {
      var total = alive(step).length;
      var guard = 0;
      for (;;) {
        var codes = alive(step);
        if (!codes.length) return;
        progress(step, total - codes.length, total);
        var res = await callDriver(step, codes);
        if (handleAbort(step, codes, res)) return;
        if (res.threw) return;
        if (res.again) {
          // Còn nhóm khác (ví dụ nhiều bưu tá): chỉ ghi nhận BG đã được nhóm này xử lý, các BG còn lại chờ lần gọi sau.
          var per = res.perCode || {};
          var known = codes.filter(function (c) { return per[c]; });
          applyResult(step, known, res);
          if (!known.length || ++guard >= 30) return;
          await sleep(stepDelayMs);
          continue;
        }
        applyResult(step, codes, res);
        progress(step, total, total);
        return;
      }
    }

    function finish() {
      st.codes.forEach(function (code) {
        var rec = st.recs[code];
        if (rec.status === 'PENDING') {
          rec.status = 'NOT_PROCESSED';
          rec.code = 'E91_DUNG_GIUA_CHUNG';
          var lastOk = '';
          STEPS.forEach(function (s) { if (rec.steps[s.key] === 'OK') lastOk = s.name; });
          rec.message = (st.halted ? 'Đã dừng: ' + st.halted.message : 'Đã dừng theo yêu cầu') + (lastOk ? '. Bưu gửi đã xong đến bước: ' + lastOk + '.' : '. Bưu gửi chưa được xử lý.');
          rec.finishedAt = now();
          emit('row', rec);
        }
      });
      var c = counts();
      var byCode = {};
      var failures = [];
      st.codes.forEach(function (code) {
        var r = st.recs[code];
        if (r.status !== 'SUCCESS') {
          byCode[r.code] = (byCode[r.code] || 0) + 1;
          failures.push({ maBG: code, status: r.status, step: r.failedStep, code: r.code, message: r.message });
        }
      });
      st.summary = {
        total: c.total, success: c.success, fail: c.fail, unknown: c.unknown, notProcessed: c.notProcessed,
        halted: st.halted, stopped: st.stopRequested, byCode: byCode, failures: failures,
        startedAt: st.startedAt, finishedAt: now()
      };
      st.running = false;
      return st.summary;
    }

    // codes: danh sách mã BG đã chuyển tiếp thành công (đã khử trùng, ví dụ từ parseInput).
    // o.startStep (1-4): làm tiếp lượt dở. Các bước trước startStep được coi là đã xong cho mọi BG trong danh sách
    // (người dùng tự chịu trách nhiệm); riêng bước 2 và 4 vẫn tự kiểm tra trạng thái BG nên BG chưa đủ điều kiện sẽ báo lỗi.
    async function run(codes, o) {
      var startStep = Math.min(4, Math.max(1, Number(o && o.startStep) || 1));
      var endStep = Math.min(4, Math.max(startStep, Number(o && o.endStep) || 4));
      if (st && st.running) throw new Error('Đang có một lượt Xử lý 3.0 chưa kết thúc');
      var uniq = [];
      var seen = {};
      (codes || []).forEach(function (c) { var k = T.toStr(c).toUpperCase(); if (k && !seen[k]) { seen[k] = 1; uniq.push(k); } });
      st = { codes: uniq, recs: {}, running: true, halted: null, stopRequested: false, startedAt: now(), summary: null };
      uniq.forEach(function (c) { st.recs[c] = newRec(c); });
      if (!uniq.length) { return finish(); }
      st.resumed = startStep >= 3; // làm tiếp từ bước 3 trở đi: một số BG có thể đã lập BĐ13 từ lượt trước
      uniq.forEach(function (c) { for (var k = 0; k < startStep - 1; k++) st.recs[c].steps[STEPS[k].key] = 'SKIP'; });

      var plan = [
        function () { return runBatched(STEPS[0]); },
        function () { return runBatched(STEPS[1]); },
        function () { return runBd13(STEPS[2]); },
        function () { return runBatched(STEPS[3]); }
      ];
      for (var n = startStep; n <= endStep; n++) {
        if (st.stopRequested || st.halted) break;
        if (n > startStep) await sleep(stepDelayMs);
        await plan[n - 1]();
      }
      if (endStep < 4 && !st.stopRequested && !st.halted) {
        // Chạy từng phần: BG qua trọn các bước đã chọn được tính là thành công của lượt này.
        st.codes.forEach(function (c) {
          var r = st.recs[c];
          if (r.status === 'PENDING' && r.steps[STEPS[endStep - 1].key] === 'OK') {
            r.status = 'SUCCESS'; r.code = 'SUCCESS'; r.message = 'Đã xong đến bước ' + endStep + ' (' + STEPS[endStep - 1].name + '), chạy từng phần.'; r.finishedAt = now();
            emit('row', r);
          }
        });
      }

      var summary = finish();
      emit('progress', { step: endStep, stepName: STEPS[endStep - 1].name, stepsTotal: STEPS.length, done: summary.total, total: summary.total, counts: counts(), finished: true });
      emit('success', summary);
      return summary;
    }

    function stop() { if (st && st.running) st.stopRequested = true; }
    function getResults() { return st ? st.codes.map(function (c) { return st.recs[c]; }) : []; }
    function getSummary() { return st ? st.summary : null; }

    return { on: on, run: run, stop: stop, getResults: getResults, getSummary: getSummary };
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function formatTime(ms) {
    if (!ms) return '';
    var d = new Date(ms);
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  // Báo cáo kết quả theo docs/audit-xuly30/07-file-excel.md. Nhận mảng bản ghi từ controller.getResults().
  function buildReportAoa(results) {
    var rows = (results || []).map(function (r) {
      return [
        r.maBG,
        STEP_LABEL[r.steps.vuHoi], STEP_LABEL[r.steps.giaoLai], STEP_LABEL[r.steps.bd13], STEP_LABEL[r.steps.chuyen30],
        FINAL_LABEL[r.status] || r.status,
        r.status === 'SUCCESS' ? '' : r.code,
        r.status === 'SUCCESS' ? '' : r.message,
        formatTime(r.finishedAt)
      ];
    });
    return [REPORT_COLUMNS.slice()].concat(rows);
  }

  function makeReportFileName(date) {
    var d = date || new Date();
    return 'KetQuaXuLy30_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '.xlsx';
  }

  var api = {
    STEPS: STEPS, DEFAULTS: DEFAULTS, REPORT_COLUMNS: REPORT_COLUMNS,
    chunk: chunk, parseInput: parseInput, createController: createController,
    buildReportAoa: buildReportAoa, makeReportFileName: makeReportFileName
  };

  if (isNode) module.exports = api;
  else { g.VNPCore = g.VNPCore || {}; g.VNPCore.xuly30 = api; }
})(typeof self !== 'undefined' ? self : globalThis);
