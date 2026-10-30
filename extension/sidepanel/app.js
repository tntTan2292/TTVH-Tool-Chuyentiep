// ==========================================================================
// VNPost PNS - Chuyển Tiếp Hàng Loạt (Side Panel Application Logic)
// Tích hợp: VNPCore (prepare, runner, exporter) + VNPFakeExecutor (Dev)
// ==========================================================================

(function () {
  'use strict';

  // --- 1. DOM Elements ---
  var dropZone = document.getElementById('dropZone');
  var fileInput = document.getElementById('fileInput');
  var fileInfoBar = document.getElementById('fileInfoBar');
  var fileNameDisplay = document.getElementById('fileNameDisplay');
  var fileCountDisplay = document.getElementById('fileCountDisplay');

  var precheckCard = document.getElementById('precheckCard');
  var precheckTotal = document.getElementById('precheckTotal');
  var precheckValid = document.getElementById('precheckValid');
  var precheckInvalid = document.getElementById('precheckInvalid');
  var precheckErrorList = document.getElementById('precheckErrorList');

  var delaySelect = document.getElementById('delaySelect');
  var btnDryRun = document.getElementById('btnDryRun');
  var btnRealRun = document.getElementById('btnRealRun');

  var progressCard = document.getElementById('progressCard');
  var progressTitle = document.getElementById('progressTitle');
  var progressPercent = document.getElementById('progressPercent');
  var progressBarFill = document.getElementById('progressBarFill');

  var cntTotal = document.getElementById('cntTotal');
  var cntDone = document.getElementById('cntDone');
  var cntOk = document.getElementById('cntOk');
  var cntFail = document.getElementById('cntFail');
  var cntPending = document.getElementById('cntPending');

  var btnPause = document.getElementById('btnPause');
  var btnResume = document.getElementById('btnResume');
  var btnStop = document.getElementById('btnStop');

  var logTableScroll = document.getElementById('logTableScroll');
  var logTableBody = document.getElementById('logTableBody');
  var emptyLogRow = document.getElementById('emptyLogRow');
  var filterAll = document.getElementById('filterAll');
  var filterFailOnly = document.getElementById('filterFailOnly');

  var confirmModal = document.getElementById('confirmModal');
  var confirmCount = document.getElementById('confirmCount');
  var btnCancelConfirm = document.getElementById('btnCancelConfirm');
  var btnAcceptConfirm = document.getElementById('btnAcceptConfirm');

  var summaryModal = document.getElementById('summaryModal');
  var summaryBanner = document.getElementById('summaryBanner');
  var summaryHeadline = document.getElementById('summaryHeadline');
  var summarySubline = document.getElementById('summarySubline');
  var failureSectionTitle = document.getElementById('failureSectionTitle');
  var failureListBox = document.getElementById('failureListBox');
  var summaryStatsByCode = document.getElementById('summaryStatsByCode');
  var btnCloseSummary = document.getElementById('btnCloseSummary');
  var btnExportResult = document.getElementById('btnExportResult');

  var circuitModal = document.getElementById('circuitModal');
  var btnCircuitStop = document.getElementById('btnCircuitStop');
  var btnCircuitResume = document.getElementById('btnCircuitResume');
  var alertSession = document.getElementById('alertSession');
  var devModeBadge = document.getElementById('devModeBadge');

  // --- 2. Application State ---
  var currentPrepared = null;
  var currentRunner = null;
  var currentMode = 'dry'; // 'dry' | 'real'
  var currentFilter = 'all'; // 'all' | 'fail'
  var startTimeMs = 0;
  var rowElements = {}; // rowId -> <tr> element

  // Chế độ phát triển chỉ bật khi mở side panel với ?dev=1. Bình thường (người dùng thật) luôn dùng executor thật
  // và KHÔNG hiện nhãn giả lập, để không ai nhầm kết quả giả là kết quả thật.
  var devMode = location.search.indexOf('dev=1') !== -1;
  if (devModeBadge) {
    if (devMode) {
      devModeBadge.style.cursor = 'pointer';
      devModeBadge.title = 'Click để nạp ngay bộ dữ liệu mẫu kiểm thử giao diện (dữ liệu giả, KHÔNG gửi lên hệ thống)';
      devModeBadge.addEventListener('click', function () {
        loadSampleDataset();
      });
    } else {
      devModeBadge.classList.add('hidden');
    }
  }
  var devHint = document.getElementById('devHint');
  if (devHint && !devMode) devHint.classList.add('hidden');

  function escapeHtml(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function loadSampleDataset() {
    var sampleAoa = [
      ["MA_BG", "HO_TEN_NGUOI_NHAN", "DIA_CHI_NGUOI_NHAN", "SO_DIEN_THOAI", "LOAI_CHUYEN_TIEP", "BUU_CUC_CHUYEN_DEN", "TINH", "PHUONG_XA", "EMAIL", "GHI_CHU"],
      ["Mã bưu gửi (*)", "Họ tên (*)", "Địa chỉ (*)", "Số ĐT (*)", "Loại (*)", "Bưu cục nhận", "Tỉnh", "Phường xã", "Email", "Ghi chú"],
      ["EB123456789VN", "Nguyễn Văn Test A", "123 Đường Mẫu, Phường 1", "0901234567", "BUU_CUC", "533140", "", "", "testa@vnpost.vn", "Chuyển nhanh trong ngày"],
      ["CH987654321VN", "Trần Thị Test B", "Thôn 2, Đường Lê Lợi", "0912345678", "DIA_CHI", "", "Huế", "Thủy Xuân", "", "Khách hẹn chiều nhận"],
      ["EM555666777VN", "Lê Hoàng Test C", "Số 45 Ngõ Demo", "0988776655", "DIA_CHI", "", "Huế", "An Cựu", "", ""],
      ["FAIL_E11_01", "Phạm Văn Test D", "Bưu cục Trung Tâm", "0933221100", "BUU_CUC", "100000", "", "", "", "Mô phỏng lỗi C44"],
      ["FAIL_E10_02", "Hoàng Thị Test E", "Địa chỉ giả định", "0944556677", "BUU_CUC", "100000", "", "", "", "Mô phỏng lỗi không tìm thấy"],
      ["", "Lỗi Thiếu Mã", "Địa chỉ thiếu mã", "0911223344", "BUU_CUC", "533140", "", "", "", "Dòng cố tình lỗi cú pháp"],
      ["SAI_SDT_01", "Lỗi Sai Số ĐT", "Địa chỉ sai sđt", "123", "BUU_CUC", "533140", "", "", "", "Dòng sai định dạng phone"]
    ];
    fileNameDisplay.textContent = 'mau-kiem-thu-gia-lap.xlsx';
    fileInfoBar.classList.remove('hidden');
    processAoaData(sampleAoa);
  }

  // Executor: thật (gửi sang tab Pack & Send) hoặc giả (chỉ khi ?dev=1).
  function pickExecutor() {
    if (devMode && window.VNPFakeExecutor) return window.VNPFakeExecutor.createFakeExecutor({ latency: 200 });
    return window.VNPPageBridge.createRealExecutor();
  }

  function showEnvAlert(message) {
    alertSession.querySelector('div').innerHTML = '<strong>Chưa chạy được.</strong> ' + escapeHtml(message);
    alertSession.classList.remove('hidden');
  }

  // --- 3. File Handling & Pre-check ---
  dropZone.addEventListener('click', function () { fileInput.click(); });
  dropZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('dragover'); });
  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files.length > 0) {
      handleFile(fileInput.files[0]);
    }
  });

  function handleFile(file) {
    if (!file) return;
    fileNameDisplay.textContent = file.name;
    fileInfoBar.classList.remove('hidden');

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, { type: 'array' });

        // Ưu tiên sheet ChuyenTiep nếu có
        var sheetName = wb.SheetNames.indexOf('ChuyenTiep') !== -1 ? 'ChuyenTiep' : wb.SheetNames[0];
        var ws = wb.Sheets[sheetName];
        var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

        processAoaData(aoa);
      } catch (err) {
        alert('Lỗi đọc file Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function processAoaData(aoa) {
    if (!window.VNPCore || !window.VNPCore.prepare) {
      alert('Lỗi: Thư viện VNPCore chưa được nạp.');
      return;
    }

    var prep = window.VNPCore.prepare.prepareFromAoa(aoa);
    currentPrepared = prep;

    if (!prep.ok) {
      precheckCard.classList.remove('hidden');
      precheckTotal.textContent = aoa.length;
      precheckValid.textContent = '0';
      precheckInvalid.textContent = aoa.length;
      precheckErrorList.classList.remove('hidden');
      precheckErrorList.innerHTML = '<div class="error-item">❌ ' + prep.fatal.map(escapeHtml).join('<br>') + '</div>';
      btnDryRun.disabled = true;
      btnRealRun.disabled = true;
      return;
    }

    // Hiển thị thống kê kiểm tra trước
    precheckCard.classList.remove('hidden');
    precheckTotal.textContent = prep.stats.total;
    precheckValid.textContent = prep.stats.valid;
    precheckInvalid.textContent = prep.stats.invalid;
    fileCountDisplay.textContent = prep.stats.total + ' dòng';

    // Hiển thị danh sách dòng lỗi nếu có
    var invalidItems = prep.items.filter(function (it) { return it.preError; });
    if (invalidItems.length > 0) {
      precheckErrorList.classList.remove('hidden');
      precheckErrorList.innerHTML = invalidItems.map(function (it) {
        return '<div class="error-item">⚠️ Dòng ' + it.excelRow + ' [' + escapeHtml(it.row.maBG || 'Trống mã') + '] ' +
               escapeHtml(it.preError.code) + ': ' + escapeHtml(it.preError.message) + '</div>';
      }).join('');
    } else {
      precheckErrorList.classList.add('hidden');
      precheckErrorList.innerHTML = '';
    }

    // Kích hoạt nút chạy nếu có dòng hợp lệ
    var hasValid = prep.stats.valid > 0;
    btnDryRun.disabled = !hasValid;
    btnRealRun.disabled = !hasValid;
  }

  // --- 4. Execution Controls (Dry / Real Run) ---
  btnDryRun.addEventListener('click', function () {
    startRun('dry');
  });

  btnRealRun.addEventListener('click', function () {
    if (!currentPrepared) return;
    confirmCount.textContent = currentPrepared.stats.valid;
    confirmModal.classList.add('active');
  });

  btnCancelConfirm.addEventListener('click', function () {
    confirmModal.classList.remove('active');
  });

  btnAcceptConfirm.addEventListener('click', function () {
    confirmModal.classList.remove('active');
    startRun('real');
  });

  async function startRun(mode) {
    if (!currentPrepared || !window.VNPCore.runner) return;
    alertSession.classList.add('hidden');
    if (!devMode) {
      var env;
      try { env = await window.VNPPageBridge.check(); } catch (e) { env = { ok: false, message: String((e && e.message) || e) }; }
      if (!env.ok) { showEnvAlert(env.message); return; }
    }
    currentMode = mode;
    startTimeMs = Date.now();
    alertSession.classList.add('hidden');

    // UI Updates
    progressCard.classList.remove('hidden');
    progressTitle.textContent = mode === 'dry' ? 'Tiến độ: Chạy thử (không lưu)' : 'Tiến độ: Chạy thật';
    btnDryRun.disabled = true;
    btnRealRun.disabled = true;
    btnPause.classList.remove('hidden');
    btnResume.classList.add('hidden');
    btnStop.disabled = false;

    // Reset Table
    logTableBody.innerHTML = '';
    rowElements = {};

    var delayMs = parseInt(delaySelect.value, 10) || 1000;

    // Khởi tạo runner theo chuẩn VNPCore.runner
    currentRunner = window.VNPCore.runner.createRunner({
      executor: pickExecutor()
    });

    // Lắng nghe sự kiện
    currentRunner.on('state', handleRunnerState);
    currentRunner.on('progress', handleRunnerProgress);
    currentRunner.on('row', handleRunnerRow);
    currentRunner.on('sessionExpired', function () {
      alertSession.querySelector('div').innerHTML = '<strong>Tạm dừng:</strong> hết phiên đăng nhập hoặc không thấy tab Pack & Send. Hãy mở tab, đăng nhập lại (nếu cần), rồi bấm <b>Tiếp tục</b>. Bưu gửi đang xử lý sẽ được thử lại.';
      alertSession.classList.remove('hidden');
    });
    currentRunner.on('circuitOpen', function () {
      circuitModal.classList.add('active');
    });
    currentRunner.on('done', handleRunnerDone);

    // Đưa TẤT CẢ dòng vào runner: dòng lỗi từ bước kiểm tra trước không được gửi nhưng vẫn nằm trong nhật ký, tổng kết và file kết quả.
    currentRunner.start(currentPrepared.items, {
      mode: mode,
      delayMs: delayMs
    });
  }

  // --- 5. Runner Event Handlers ---
  function handleRunnerState(state) {
    if (state.status === 'paused') {
      btnPause.classList.add('hidden');
      btnResume.classList.remove('hidden');
    } else if (state.status === 'running') {
      btnPause.classList.remove('hidden');
      btnResume.classList.add('hidden');
      alertSession.classList.add('hidden');
    }
  }

  function handleRunnerProgress(counts) {
    cntTotal.textContent = counts.total;
    cntDone.textContent = counts.done;
    cntOk.textContent = counts.ok;
    cntFail.textContent = counts.fail;
    cntPending.textContent = counts.pending;

    var pct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
    progressPercent.textContent = pct + '%';
    progressBarFill.style.width = pct + '%';
  }

  function handleRunnerRow(data) {
    var res = data; // bản ghi kết quả: { rowId, excelRow, maBG, status, code, message, ... }

    var tr = document.createElement('tr');
    var isSuccess = res.status === 'SUCCESS' || res.status === 'DRY_OK';
    var badgeClass = isSuccess ? (currentMode === 'dry' ? 'badge-dry' : 'badge-success') :
                     (res.status === 'UNKNOWN' ? 'badge-unknown' : 'badge-fail');
    var badgeText = isSuccess ? (currentMode === 'dry' ? 'Hợp lệ' : 'Thành công') :
                    (res.status === 'UNKNOWN' ? 'Không rõ' : 'Thất bại');

    tr.dataset.status = isSuccess ? 'success' : 'fail';
    tr.innerHTML =
      '<td>' + escapeHtml(res.excelRow) + '</td>' +
      '<td><strong>' + escapeHtml(res.maBG) + '</strong></td>' +
      '<td><span class="badge ' + badgeClass + '">' + badgeText + '</span></td>' +
      '<td class="text-truncate" title="' + escapeHtml(res.message || res.code || '') + '">' +
        (res.code && res.code !== 'SUCCESS' ? '<b>[' + escapeHtml(res.code) + ']</b> ' : '') +
        escapeHtml(res.message || '') +
      '</td>';

    if (currentFilter === 'fail' && isSuccess) {
      tr.classList.add('hidden');
    }

    logTableBody.appendChild(tr);
    rowElements[res.rowId] = tr;

    // Tự động cuộn xuống dòng mới
    logTableScroll.scrollTop = logTableScroll.scrollHeight;
  }

  function handleRunnerDone() {
    btnDryRun.disabled = false;
    btnRealRun.disabled = false;
    btnPause.classList.add('hidden');
    btnResume.classList.add('hidden');
    btnStop.disabled = true;

    showSummaryModal();
  }

  // --- 6. PO Mandated Final Summary Modal ---
  function showSummaryModal() {
    if (!currentRunner) return;
    var summary = currentRunner.getSummary();
    if (!summary) return;

    var counts = summary;
    var isAllOk = counts.fail === 0 && counts.unknown === 0 && counts.notProcessed === 0;

    // 1. Tiêu đề và Banner lớn: "Thành công X / Tổng N — Thất bại Y"
    summaryBanner.className = 'summary-banner ' + (isAllOk ? 'success-mode' : 'fail-mode');
    summaryHeadline.textContent = 'Thành công ' + counts.ok + ' / Tổng ' + counts.total + ' — Thất bại ' + counts.failTotal +
      (counts.notProcessed ? ' — Chưa xử lý ' + counts.notProcessed : '');

    var elapsedSec = Math.round((Date.now() - startTimeMs) / 1000);
    summarySubline.textContent = 'Chế độ: ' + (currentMode === 'dry' ? 'Chạy thử' : 'Chạy thật') + ' • Thời gian: ' + elapsedSec + 's' +
      (counts.unknown ? ' • ' + counts.unknown + ' bưu gửi không rõ kết quả, cần kiểm tra thủ công trên hệ thống' : '') +
      (devMode ? ' • DỮ LIỆU GIẢ LẬP' : '') +
      (counts.ok === 0 && (counts.byCode.E10_BG_KHONG_TON_TAI || 0) >= 3
        ? ' • CẢNH BÁO: toàn bộ bưu gửi đều "không tìm thấy". Hãy kiểm tra đang ở trang 3.9 và thử tìm tay một mã; nếu tìm tay thấy thì báo lại để chỉnh công cụ.'
        : '');

    // 2. Danh sách từng bưu gửi thất bại
    if (summary.failures.length > 0) {
      failureSectionTitle.classList.remove('hidden');
      failureListBox.classList.remove('hidden');
      failureListBox.innerHTML = summary.failures.map(function (f) {
        return '<div class="failure-item">' +
                 '<div><span class="failure-bg">Dòng ' + escapeHtml(f.excelRow) + ' (' + escapeHtml(f.maBG) + ')</span>: <span style="font-weight:600; color:#B91C1C;">[' + escapeHtml(f.code) + ']</span></div>' +
                 '<div class="failure-reason">' + escapeHtml(f.message || 'Không có mô tả chi tiết') + '</div>' +
               '</div>';
      }).join('');
    } else {
      failureSectionTitle.classList.add('hidden');
      failureListBox.classList.remove('hidden');
      failureListBox.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--success); font-weight: 700;">' +
                                   '🎉 Tuyệt vời! 100% bưu gửi đều hợp lệ và thành công.' +
                                 '</div>';
    }

    // 3. Thống kê theo mã lỗi
    var codeStats = Object.keys(summary.byCode).map(function (code) {
      return '<span style="display:inline-block; margin-right:8px; margin-bottom:4px; padding:2px 6px; background:#F1F5F9; border-radius:4px;">' +
             '<b>' + escapeHtml(code) + '</b>: ' + escapeHtml(summary.byCode[code]) + '</span>';
    }).join('');
    summaryStatsByCode.innerHTML = '<b>Phân bổ mã kết quả:</b><br>' + codeStats;

    summaryModal.classList.add('active');
  }

  btnCloseSummary.addEventListener('click', function () {
    summaryModal.classList.remove('active');
  });

  // --- 7. Export Result Excel ---
  btnExportResult.addEventListener('click', function () {
    if (!currentPrepared || !currentRunner || !window.VNPCore.exporter) return;

    try {
      var results = currentRunner.getResults();
      var resultAoa = window.VNPCore.exporter.buildResultAoa(currentPrepared, results);
      var fileName = window.VNPCore.exporter.makeFileName(currentMode);

      XLSX.writeFile(window.VNPCore.exporter.toWorkbook(XLSX, resultAoa), fileName);
    } catch (e) {
      alert('Lỗi xuất file Excel: ' + e.message);
    }
  });

  // --- 8. Running Actions & Filters ---
  btnPause.addEventListener('click', function () {
    if (currentRunner) currentRunner.pause('Người dùng tạm dừng');
  });
  btnResume.addEventListener('click', function () {
    if (currentRunner) currentRunner.resume();
  });
  btnStop.addEventListener('click', function () {
    if (currentRunner && confirm('Bạn có chắc chắn muốn dừng hẳn tiến trình? Các bưu gửi còn lại sẽ được đánh dấu là Chưa xử lý.')) {
      currentRunner.stop();
    }
  });

  btnCircuitStop.addEventListener('click', function () {
    circuitModal.classList.remove('active');
    if (currentRunner) currentRunner.stop();
  });
  btnCircuitResume.addEventListener('click', function () {
    circuitModal.classList.remove('active');
    if (currentRunner) currentRunner.resume();
  });

  // Bộ lọc bảng nhật ký
  filterAll.addEventListener('click', function () {
    currentFilter = 'all';
    filterAll.classList.add('active');
    filterFailOnly.classList.remove('active');
    Object.values(rowElements).forEach(function (tr) { tr.classList.remove('hidden'); });
  });

  filterFailOnly.addEventListener('click', function () {
    currentFilter = 'fail';
    filterFailOnly.classList.add('active');
    filterAll.classList.remove('active');
    Object.values(rowElements).forEach(function (tr) {
      if (tr.dataset.status === 'success') tr.classList.add('hidden');
      else tr.classList.remove('hidden');
    });
  });

})();
