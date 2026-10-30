// Fake Executor cho WP5 (Giao diện Side Panel)
// Tuân thủ nghiêm ngặt hợp đồng dữ liệu mục 8.1 trong docs/PHUONG-AN-TRIEN-KHAI.md
(function (g) {
  'use strict';

  function createFakeExecutor(opts) {
    opts = opts || {};
    var baseLatency = opts.latency !== undefined ? opts.latency : 200;

    return {
      processOne: function (cmd) {
        return new Promise(function (resolve) {
          var latency = baseLatency + Math.floor(Math.random() * 80);
          setTimeout(function () {
            var maBG = (cmd.row && cmd.row.maBG) ? String(cmd.row.maBG).toUpperCase() : '';
            var isDry = cmd.mode === 'dry';

            // 1. Kịch bản Hết phiên đăng nhập
            if (maBG.indexOf('EXP') !== -1 || maBG.indexOf('SESSION') !== -1) {
              return resolve({
                rowId: cmd.rowId,
                status: 'SESSION_EXPIRED',
                code: 'E90_HET_PHIEN',
                message: 'Phiên đăng nhập trên tab Pack & Send đã hết hạn (HTTP 401 / Redirect Login).',
                httpStatus: 401,
                durationMs: latency
              });
            }

            // 2. Kịch bản Bưu gửi không tồn tại
            if (maBG.indexOf('E10') !== -1 || maBG.indexOf('NOTFOUND') !== -1) {
              return resolve({
                rowId: cmd.rowId,
                status: isDry ? 'DRY_FAIL' : 'FAIL',
                code: 'E10_BG_KHONG_TON_TAI',
                message: 'Mã bưu gửi ' + maBG + ' không tìm thấy trên hệ thống bưu cục hiện tại.',
                serverCode: '404',
                durationMs: latency
              });
            }

            // 3. Kịch bản Bưu gửi chưa chuyển sang C39
            if (maBG.indexOf('E11') !== -1 || maBG.indexOf('FAIL') !== -1) {
              return resolve({
                rowId: cmd.rowId,
                status: isDry ? 'DRY_FAIL' : 'FAIL',
                code: 'E11_BG_KHONG_PHAI_C39',
                message: 'Bưu gửi chưa đủ điều kiện: đang ở trạng thái C44 (Đã phát 1 phần), không có nút chuyển tiếp.',
                serverCode: 'C44',
                durationMs: latency
              });
            }

            // 4. Kịch bản Lỗi nghiệp vụ từ Server VNPost
            if (maBG.indexOf('E20') !== -1) {
              return resolve({
                rowId: cmd.rowId,
                status: isDry ? 'DRY_FAIL' : 'FAIL',
                code: 'E20_LOI_NGHIEP_VU',
                message: 'Hệ thống từ chối: Bưu cục phát nhận không thuộc phạm vi luân chuyển hỗ trợ.',
                serverCode: '02',
                durationMs: latency
              });
            }

            // 5. Kịch bản Mất kết nối mạng / Không rõ kết quả
            if (maBG.indexOf('NET') !== -1 || maBG.indexOf('TIMEOUT') !== -1) {
              return resolve({
                rowId: cmd.rowId,
                status: 'UNKNOWN',
                code: 'E98_KET_QUA_KHONG_RO',
                message: 'Mất kết nối mạng khi server đang xử lý POST. Không rõ server đã ghi hay chưa.',
                httpStatus: 0,
                durationMs: latency
              });
            }

            // 6. Mặc định thành công
            return resolve({
              rowId: cmd.rowId,
              status: isDry ? 'DRY_OK' : 'SUCCESS',
              code: 'SUCCESS',
              message: isDry ? 'Chạy thử: Đủ điều kiện và dữ liệu hợp lệ' : 'Cập nhật thông tin chuyển tiếp thành công!',
              serverCode: '00',
              durationMs: latency
            });
          }, latency);
        });
      }
    };
  }

  g.VNPFakeExecutor = {
    createFakeExecutor: createFakeExecutor
  };
})(typeof window !== 'undefined' ? window : global);
