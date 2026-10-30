// ==========================================================================
// VNPost PNS - Xử Lý 3.0 UI Controller (Side Panel Module)
// Tích hợp: VNPCore.xuly30, VNPXuLy30Bridge, VNPCore.exporter
// ==========================================================================

(function () {
  'use strict';

  // --- 1. Tab Navigation Elements ---
  var tabBtnChuyenTiep = document.getElementById('tabBtnChuyenTiep');
  var tabBtnXuLy30 = document.getElementById('tabBtnXuLy30');
  var panelChuyenTiep = document.getElementById('panelChuyenTiep');
  var panelXuLy30 = document.getElementById('panelXuLy30');

  // --- 2. Xử Lý 3.0 DOM Elements ---
  var x30DropZone = document.getElementById('x30DropZone');
  var x30FileInput = document.getElementById('x30FileInput');
  var x30FileInfoBar = document.getElementById('x30FileInfoBar');
  var x30FileNameDisplay = document.getElementById('x30FileNameDisplay');
  var x30FileCountDisplay = document.getElementById('x30FileCountDisplay');
  var x30InputStats = document.getElementById('x30InputStats');
  var x30StatTotal = document.getElementById('x30StatTotal');
  var x30StatReady = document.getElementById('x30StatReady');
  var x30StatSkipped = document.getElementById('x30StatSkipped');
  var x30WarningBox = document.getElementById('x30WarningBox');
  var x30WarningText = document.getElementById('x30WarningText');

  var x30BatchSize = document.getElementById('x30BatchSize');
  var x30DelayMs = document.getElementById('x30DelayMs');
  var btnX30CheckPNS = document.getElementById('btnX30CheckPNS');
  var btnX30Start = document.getElementById('btnX30Start');

  var x30ProgressCard = document.getElementById('x30ProgressCard');
  var x30ProgressPercent = document.getElementById('x30ProgressPercent');
  var x30ProgressBarFill = document.getElementById('x30ProgressBarFill');
  var x30StepItems = [
    document.getElementById('x30StepItem1'),
    document.getElementById('x30StepItem2'),
    document.getElementById('x30StepItem3'),
    document.getElementById('x30StepItem4')
  ];

  var x30CntTotal = document.getElementById('x30CntTotal');
  var x30CntDone = document.getElementById('x30CntDone');
  var x30CntOk = document.getElementById('x30CntOk');
  var x30CntFail = document.getElementById('x30CntFail');
  var x30CntUnknown = document.getElementById('x30CntUnknown');
  var btnX30Stop = document.getElementById('btnX30Stop');

  var x30LogTable = document.getElementById('x30LogTable');
  var x30LogTableBody = document.getElementById('x30LogTableBody');
  var x30EmptyLogRow = document.getElementById('x30EmptyLogRow');
  var x30FilterAll = document.getElementById('x30FilterAll');
  var x30FilterFailOnly = document.getElementById('x30FilterFailOnly');

  var x30ConfirmModal = document.getElementById('x30ConfirmModal');
  var x30ConfirmCount = document.getElementById('x30ConfirmCount');
  var btnX30CancelConfirm = document.getElementById('btnX30CancelConfirm');
  var btnX30AcceptConfirm = document.getElementById('btnX30AcceptConfirm');

  var x30SummaryModal = document.getElementById('x30SummaryModal');
  var x30SummaryHeadline = document.getElementById('x30SummaryHeadline');
  var x30SummarySubline = document.getElementById('x30SummarySubline');
  var x30FailureListBox = document.getElementById('x30FailureListBox');
  var x30SummaryStatsByCode = document.getElementById('x30SummaryStatsByCode');
  var btnX30CloseSummary = document.getElementById('btnX30CloseSummary');
  var btnX30ExportResult = document.getElementById('btnX30ExportResult');

  // --- 3. Module State ---
  var currentInput = null;
  var currentController = null;
  var currentFilter = 'all'; // 'all' | 'fail'
  var rowElements = {}; // maBG -> <tr>
  var startTimeMs = 0;

  function escapeHtml(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // --- 4. Tab Switching Logic ---
  function switchTab(targetId) {
    if (targetId === 'panelXuLy30') {
      tabBtnChuyenTiep.classList.remove('active');
      tabBtnXuLy30.classList.add('active');
      panelChuyenTiep.classList.add('hidden');
      panelXuLy30.classList.remove('hidden');
    } else {
      tabBtnXuLy30.classList.remove('active');
      tabBtnChuyenTiep.classList.add('active');
      panelXuLy30.classList.add('hidden');
      panelChuyenTiep.classList.remove('hidden');
    }
  }

  if (tabBtnChuyenTiep && tabBtnXuLy30) {
    tabBtnChuyenTiep.addEventListener('click', function () { switchTab('panelChuyenTiep'); });
    tabBtnXuLy30.addEventListener('click', function () { switchTab('panelXuLy30'); });
  }

  // --- 5. File Upload & Pre-check ---
  if (x30DropZone && x30FileInput) {
    x30DropZone.addEventListener('click', function () {
      x30FileInput.click();
    });

    x30DropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      x30DropZone.classList.add('drag-over');
    });

    x30DropZone.addEventListener('dragleave', function () {
      x30DropZone.classList.remove('drag-over');
    });

    x30DropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      x30DropZone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    x30FileInput.addEventListener('change', function () {
      if (x30FileInput.files && x30FileInput.files[0]) {
        handleFile(x30FileInput.files[0]);
      }
    });
  }

  function handleFile(file) {
    if (!file) return;
    if (window.VNPBusy) { alert('Đang có một lượt xử lý chạy. Hãy chờ xong hoặc dừng trước khi nạp file mới.'); return; }
    x30FileNameDisplay.textContent = file.name;
    x30FileCountDisplay.textContent = 'Đang đọc...';
    x30FileInfoBar.classList.remove('hidden');

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, { type: 'array' });
        var firstSheetName = wb.SheetNames[0];
        var ws = wb.Sheets[firstSheetName];
        var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

        processParsedAoa(aoa);
      } catch (err) {
        alert('Lỗi đọc file Excel: ' + (err.message || err));
        btnX30Start.disabled = true;
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function processParsedAoa(aoa) {
    var X = VNPCore.xuly30;
    var parsed = X.parseInput(aoa);
    currentInput = parsed;

    x30InputStats.classList.remove('hidden');
    x30StatTotal.textContent = parsed.stats.rows;
    x30StatReady.textContent = parsed.codes.length;
    x30StatSkipped.textContent = (parsed.skipped.length + parsed.duplicates.length);

    x30FileCountDisplay.textContent = parsed.codes.length + ' bưu gửi sẵn sàng';

    // Xử lý Cảnh báo / Lỗi nghiêm trọng
    if (!parsed.ok) {
      x30WarningBox.classList.remove('hidden');
      x30WarningText.innerHTML = '<strong>Không thể xử lý:</strong> ' + parsed.fatal.map(escapeHtml).join('<br>');
      btnX30Start.disabled = true;
      return;
    }

    if (parsed.warnings.length > 0) {
      x30WarningBox.classList.remove('hidden');
      x30WarningText.innerHTML = parsed.warnings.map(escapeHtml).join('<br>');
    } else {
      x30WarningBox.classList.add('hidden');
    }

    btnX30Start.disabled = false;
    btnX30Start.focus();
  }

  // --- 6. PNS Connection Check ---
  if (btnX30CheckPNS) {
    btnX30CheckPNS.addEventListener('click', async function () {
      btnX30CheckPNS.disabled = true;
      btnX30CheckPNS.textContent = 'Đang kiểm tra...';
      try {
        var chk = await VNPXuLy30Bridge.check();
        if (chk.ok) {
          alert('✅ Kết nối tốt! Tab Pack & Send đã sẵn sàng và đang đăng nhập.');
        } else {
          alert('⚠️ ' + chk.message);
        }
      } catch (e) {
        alert('Lỗi kiểm tra PNS: ' + (e.message || e));
      } finally {
        btnX30CheckPNS.disabled = false;
        btnX30CheckPNS.textContent = '🔍 Kiểm tra PNS';
      }
    });
  }

  // --- 7. Confirm Modal & Execution Flow ---
  if (btnX30Start) {
    btnX30Start.addEventListener('click', function () {
      if (!currentInput || !currentInput.codes || !currentInput.codes.length) return;
      if (window.VNPBusy) { alert('Đang có một lượt xử lý chạy (Chuyển tiếp hoặc Xử lý 3.0). Hãy chờ xong rồi thử lại.'); return; }
      x30ConfirmCount.textContent = currentInput.codes.length;
      x30ConfirmModal.classList.add('active');
    });
  }

  if (btnX30CancelConfirm) {
    btnX30CancelConfirm.addEventListener('click', function () {
      x30ConfirmModal.classList.remove('active');
    });
  }

  if (btnX30AcceptConfirm) {
    btnX30AcceptConfirm.addEventListener('click', function () {
      x30ConfirmModal.classList.remove('active');
      startExecution();
    });
  }

  function setStepVisual(stepNo, state, statusText) {
    // state: 'wait' | 'active' | 'done' | 'error'
    var item = x30StepItems[stepNo - 1];
    if (!item) return;
    item.classList.remove('active', 'done', 'error');
    if (state !== 'wait') item.classList.add(state);
    var statusEl = item.querySelector('.step-status');
    if (statusEl) statusEl.textContent = statusText || (state === 'done' ? 'Xong' : (state === 'active' ? 'Đang chạy...' : (state === 'error' ? 'Lỗi' : 'Chờ')));
  }

  function renderStepBadge(val) {
    if (val === 'OK') return '<span class="step-badge ok" title="Thành công">OK</span>';
    if (val === 'FAIL') return '<span class="step-badge fail" title="Thất bại">FAIL</span>';
    if (val === 'UNKNOWN') return '<span class="step-badge unknown" title="Không rõ">?</span>';
    if (val === 'SKIP') return '<span class="step-badge skip" title="Bỏ qua">-</span>';
    return '<span class="step-badge pending">-</span>';
  }

  function renderStatusBadge(status) {
    if (status === 'SUCCESS') return '<span class="badge-success">Thành công</span>';
    if (status === 'FAIL') return '<span class="badge-danger">Thất bại</span>';
    if (status === 'UNKNOWN') return '<span class="badge-warning">Không rõ</span>';
    if (status === 'NOT_PROCESSED') return '<span class="badge-secondary">Chưa xử lý</span>';
    return '<span class="badge-secondary">Đang xử lý</span>';
  }

  function updateLogRow(rec, index) {
    var tr = rowElements[rec.maBG];
    if (!tr) {
      if (x30EmptyLogRow) x30EmptyLogRow.style.display = 'none';
      tr = document.createElement('tr');
      tr.dataset.status = rec.status;
      tr.dataset.code = rec.maBG;
      x30LogTableBody.appendChild(tr);
      rowElements[rec.maBG] = tr;
    }

    tr.dataset.status = rec.status;

    tr.innerHTML =
      '<td>' + (index || Object.keys(rowElements).length) + '</td>' +
      '<td><strong>' + escapeHtml(rec.maBG) + '</strong></td>' +
      '<td style="text-align: center;">' + renderStepBadge(rec.steps.vuHoi) + '</td>' +
      '<td style="text-align: center;">' + renderStepBadge(rec.steps.giaoLai) + '</td>' +
      '<td style="text-align: center;">' + renderStepBadge(rec.steps.bd13) + '</td>' +
      '<td style="text-align: center;">' + renderStepBadge(rec.steps.chuyen30) + '</td>' +
      '<td>' + renderStatusBadge(rec.status) + '</td>' +
      '<td style="font-size: 11px; color: var(--text-muted);">' + escapeHtml(rec.message || '') + '</td>';

    applyFilter();
  }

  function applyFilter() {
    var rows = x30LogTableBody.querySelectorAll('tr');
    rows.forEach(function (tr) {
      if (tr.id === 'x30EmptyLogRow') return;
      var status = tr.dataset.status;
      if (currentFilter === 'fail') {
        if (status === 'SUCCESS') tr.style.display = 'none';
        else tr.style.display = '';
      } else {
        tr.style.display = '';
      }
    });
  }

  if (x30FilterAll && x30FilterFailOnly) {
    x30FilterAll.addEventListener('click', function () {
      currentFilter = 'all';
      x30FilterAll.classList.add('active');
      x30FilterFailOnly.classList.remove('active');
      applyFilter();
    });
    x30FilterFailOnly.addEventListener('click', function () {
      currentFilter = 'fail';
      x30FilterFailOnly.classList.add('active');
      x30FilterAll.classList.remove('active');
      applyFilter();
    });
  }

  async function startExecution() {
    if (window.VNPBusy) return;
    window.VNPBusy = 'xuly30';
    var X = VNPCore.xuly30;
    var batchSize = Number(x30BatchSize.value) || 40;
    var delayMs = Number(x30DelayMs.value) || 1200;

    // Reset UI
    x30ProgressCard.classList.remove('hidden');
    x30ProgressBarFill.style.width = '0%';
    x30ProgressPercent.textContent = '0%';
    btnX30Start.disabled = true;
    btnX30Stop.disabled = false;
    x30LogTableBody.innerHTML = '';
    rowElements = {};
    startTimeMs = Date.now();

    // Khởi tạo bảng với danh sách chờ
    currentInput.codes.forEach(function (code, i) {
      var initialRec = {
        maBG: code,
        steps: { vuHoi: '', giaoLai: '', bd13: '', chuyen30: '' },
        status: 'PENDING',
        message: 'Đang xếp hàng...'
      };
      updateLogRow(initialRec, i + 1);
    });

    for (var s = 1; s <= 4; s++) setStepVisual(s, 'wait');

    // Khởi tạo Controller
    var ctl = X.createController({
      driver: VNPXuLy30Bridge.createDriver(),
      batchSize: batchSize,
      stepDelayMs: delayMs,
      onProgressUpdate: function (p) {
        // Cập nhật Stepper 4 bước
        for (var step = 1; step <= 4; step++) {
          if (step < p.step) {
            setStepVisual(step, 'done', 'Xong');
          } else if (step === p.step) {
            var sm = p.finished && ctl.getSummary();
            if (sm && (sm.halted || sm.stopped)) {
              // Lượt chạy kết thúc sớm: bước dừng hiển thị lỗi, các bước sau để "Chờ", không báo "Xong".
              var at = sm.halted ? sm.halted.step : p.step;
              for (var k = 1; k <= 4; k++) {
                if (k < at) setStepVisual(k, 'done', 'Xong');
                else if (k === at) setStepVisual(k, 'error', sm.halted ? 'Dừng' : 'Đã dừng');
                else setStepVisual(k, 'wait', 'Chờ');
              }
              break;
            } else if (p.finished) {
              setStepVisual(step, 'done', 'Xong');
            } else {
              var txt = p.batches ? (p.batch + '/' + p.batches) : 'Đang chạy';
              setStepVisual(step, 'active', txt);
            }
          } else {
            setStepVisual(step, 'wait', 'Chờ');
          }
        }

        // Cập nhật Counters
        if (p.counts) {
          x30CntTotal.textContent = p.counts.total;
          x30CntDone.textContent = p.counts.success + p.counts.fail + p.counts.unknown + p.counts.notProcessed;
          x30CntOk.textContent = p.counts.success;
          x30CntFail.textContent = p.counts.fail;
          x30CntUnknown.textContent = p.counts.unknown;

          var pct = p.counts.total ? Math.round(((p.counts.success + p.counts.fail + p.counts.unknown + p.counts.notProcessed) / p.counts.total) * 100) : 0;
          x30ProgressPercent.textContent = pct + '%';
          x30ProgressBarFill.style.width = pct + '%';
        }
      },
      onError: function (err) {
        if (err.fatal) {
          setStepVisual(err.step, 'error', 'Dừng');
          alert('🛑 TIẾN TRÌNH ĐÃ DỪNG: [' + err.code + '] ' + err.message);
        }
      },
      onSuccess: function (summary) {
        showSummary(summary);
      }
    });

    ctl.on('row', function (rec) {
      updateLogRow(rec);
    });

    currentController = ctl;

    if (btnX30Stop) {
      btnX30Stop.onclick = function () {
        if (confirm('Bạn có chắc chắn muốn DỪNG quy trình Xử lý 3.0 giữa chừng?')) {
          ctl.stop();
          btnX30Stop.disabled = true;
          btnX30Stop.textContent = 'Đang dừng...';
        }
      };
    }

    try {
      await ctl.run(currentInput.codes);
    } catch (err) {
      alert('Lỗi ngoài dự kiến: ' + (err.message || err));
    } finally {
      window.VNPBusy = null;
      btnX30Start.disabled = false;
      btnX30Stop.disabled = true;
      btnX30Stop.textContent = '⏹ Dừng hẳn';
    }
  }

  // --- 8. Summary Modal & Export ---
  function showSummary(summary) {
    var elapsedSec = Math.round((Date.now() - startTimeMs) / 1000);
    x30SummaryHeadline.textContent = 'Thành công ' + summary.success + ' / Tổng ' + summary.total + ' — Thất bại ' + summary.fail + (summary.unknown ? (' — Không rõ ' + summary.unknown) : '');
    x30SummarySubline.textContent = 'Thời gian xử lý: ' + elapsedSec + 's • ' + (summary.halted ? 'Tiến trình dừng sớm tại bước ' + summary.halted.step : (summary.stopped ? 'Dừng theo yêu cầu người dùng' : 'Hoàn tất trọn vẹn 4 bước'));

    x30FailureListBox.innerHTML = '';
    if (summary.failures && summary.failures.length > 0) {
      summary.failures.forEach(function (f) {
        var div = document.createElement('div');
        div.className = 'failure-item';
        div.innerHTML = '<strong>' + escapeHtml(f.maBG) + '</strong> (' + renderStatusBadge(f.status) + '): ' + escapeHtml(f.message);
        x30FailureListBox.appendChild(div);
      });
      x30FailureListBox.style.display = 'block';
    } else {
      x30FailureListBox.innerHTML = '<div style="color: var(--success); font-weight: 700; padding: 8px;">🎉 Tuyệt vời! 100% bưu gửi đều được chuyển về 3.0 thành công.</div>';
    }

    x30SummaryModal.classList.add('active');
  }

  if (btnX30CloseSummary) {
    btnX30CloseSummary.addEventListener('click', function () {
      x30SummaryModal.classList.remove('active');
    });
  }

  if (btnX30ExportResult) {
    btnX30ExportResult.addEventListener('click', function () {
      if (!currentController) return;
      var X = VNPCore.xuly30;
      var results = currentController.getResults();
      var aoa = X.buildReportAoa(results);
      var wb = VNPCore.exporter.toWorkbook(XLSX, aoa);
      var fileName = X.makeReportFileName();
      XLSX.writeFile(wb, fileName);
    });
  }

})();

