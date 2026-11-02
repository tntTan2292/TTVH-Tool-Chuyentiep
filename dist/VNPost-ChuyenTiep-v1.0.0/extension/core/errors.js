(function (g) {
  'use strict';

  // Bảng mã lỗi chuẩn hóa. Nguồn: docs/audit/04-thong-bao-loi-va-ma-loi.md + docs/PHUONG-AN-TRIEN-KHAI.md mục 6.
  var CODES = {
    SUCCESS: 'Thành công',
    DRY_OK: 'Chạy thử: sẽ thành công',
    E01_THIEU_HO_TEN: 'Thiếu họ tên người nhận',
    E02_THIEU_DIA_CHI: 'Thiếu địa chỉ người nhận',
    E03_THIEU_SO_DT: 'Thiếu số điện thoại',
    E04_SAI_SO_DT: 'Sai định dạng số điện thoại',
    E05_SAI_EMAIL: 'Sai định dạng email',
    E06_THIEU_BUU_CUC: 'Thiếu bưu cục chuyển đến',
    E07_THIEU_TINH_XA: 'Thiếu Tỉnh hoặc Phường/Xã',
    E08_TRUNG_MA_BG: 'Mã bưu gửi trùng trong file',
    E09_SAI_MA_BG: 'Mã bưu gửi trống hoặc sai định dạng',
    E10_BG_KHONG_TON_TAI: 'Không tìm thấy bưu gửi',
    E11_BG_KHONG_PHAI_C39: 'Bưu gửi chưa ở trạng thái chuyển tiếp (C39)',
    E12_KHONG_KHOP_DIA_CHI: 'Không tìm thấy hoặc khớp nhiều Tỉnh/Phường-Xã',
    E13_DA_CHUYEN_TIEP: 'Bưu gửi đã có thông tin chuyển tiếp',
    E14_SAI_LOAI_CHUYEN_TIEP: 'Loại chuyển tiếp không hợp lệ',
    E20_LOI_NGHIEP_VU: 'Hệ thống VNPost từ chối',
    E40_KHONG_TIM_THAY_BG: 'Không tìm thấy bưu gửi trên màn hình 6.2',
    E41_VU_HOI_THAT_BAI: 'Vu hồi thất bại',
    E42_CHUA_VU_HOI: 'Bưu gửi chưa ở trạng thái đã vu hồi',
    E42_GIAO_LAI_THAT_BAI: 'Giao lại bưu gửi vu hồi thất bại',
    E43_KHONG_THAY_TUYEN_CT: 'Không tìm thấy (hoặc có nhiều hơn 1) tuyến "Chuyển tiếp" ở 3.2',
    E43_SAI_LECH_SO_LUONG: 'Số bưu gửi chưa lập BĐ13 không khớp, đã dừng an toàn',
    E43_LAP_BD13_THAT_BAI: 'Lập bản kê BĐ13 thất bại',
    E44_IMPORT_381_THAT_BAI: 'Nạp bưu gửi lên 3.8.1 thất bại',
    E44_CHUYEN_30_THAT_BAI: 'Chuyển bưu gửi về 3.0 thất bại',
    E90_HET_PHIEN: 'Hết phiên đăng nhập',
    E91_DUNG_GIUA_CHUNG: 'Chưa xử lý (đã dừng)',
    E98_KET_QUA_KHONG_RO: 'Không rõ đã lưu hay chưa, cần kiểm tra thủ công',
    E99_LOI_KET_NOI: 'Lỗi đường truyền hoặc máy chủ'
  };

  // Các mã tính vào "lỗi hệ thống" cho bộ ngắt mạch.
  var SYSTEM_CODES = { E98_KET_QUA_KHONG_RO: true, E99_LOI_KET_NOI: true };

  function describe(code) {
    return CODES[code] || code;
  }

  var api = { CODES: CODES, SYSTEM_CODES: SYSTEM_CODES, describe: describe };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else { g.VNPCore = g.VNPCore || {}; g.VNPCore.errors = api; }
})(typeof self !== 'undefined' ? self : globalThis);
