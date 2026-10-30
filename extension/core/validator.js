(function (g) {
  'use strict';

  var T = (typeof module === 'object' && module.exports) ? require('./text-utils') : g.VNPCore.text;

  // Nguyên tắc (PO quyết): công cụ KHÔNG quản lý nội dung người dùng nhập. Chỉ chặn đúng những gì chính form
  // trên web cũng chặn (trường bắt buộc để trống, SĐT/email sai theo regex của trang, thiếu thông tin theo loại
  // chuyển tiếp). Không kiểm tra thêm độ dài, số chữ số, định dạng mã bưu gửi hay đúng/sai địa bàn.
  // Regex lấy nguyên văn từ $.validationEngineLanguage.allRules của trang (docs/audit/06 mục G7).
  var PHONE_PATTERN = /^([\+][0-9]{1,3}[\ \.\-])?([\(]{1}[0-9]{2,6}[\)])?([0-9\ \.\-\/]{3,20})((x|ext|extension)[\ ]?[0-9]{1,4})?$/;
  var EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

  // Mã BG: bỏ khoảng trắng, in hoa. Chỉ cần không trống và không chứa dấu phẩy/chấm phẩy
  // (ô tìm kiếm của trang coi dấu phẩy là ngăn cách nhiều mã).
  function normalizeBgCode(v) {
    return T.toStr(v).replace(/\s+/g, '').toUpperCase();
  }

  // Giữ nguyên SĐT người dùng nhập (chỉ cắt khoảng trắng đầu/cuối).
  function normalizePhone(v) {
    return T.toStr(v);
  }

  // 2 = chuyển tới bưu cục khác, 3 = chuyển theo địa chỉ (giá trị radio ckAddressReturnType trên web).
  function parseLoai(v) {
    var k = T.key(v);
    if (k === '2' || k === 'buucuc' || k === 'buucuckhac') return 2;
    if (k === '3' || k === 'diachi' || k === 'diachimoi') return 3;
    return null;
  }

  // Chuẩn hóa một dòng thô (các trường chuỗi) thành dòng sạch dùng cho kiểm tra và gửi.
  function normalizeRow(raw) {
    var loaiRaw = T.toStr(raw.loai);
    var loai = parseLoai(loaiRaw);
    // Để trống loại chuyển tiếp: suy ra từ cột đã điền (có bưu cục thì loại 2; có tỉnh/xã mà không có bưu cục thì loại 3).
    if (loai === null && loaiRaw === '') {
      var hasPo = T.toStr(raw.buuCuc) !== '';
      var hasAddr = T.toStr(raw.tinh) !== '' || T.toStr(raw.phuongXa) !== '';
      if (hasPo && !hasAddr) loai = 2;
      else if (!hasPo && hasAddr) loai = 3;
    }
    return {
      maBG: normalizeBgCode(raw.maBG),
      hoTen: T.toStr(raw.hoTen).replace(/\s+/g, ' '),
      diaChi: T.toStr(raw.diaChi).replace(/\s+/g, ' '),
      soDT: normalizePhone(raw.soDT),
      email: T.toStr(raw.email),
      loai: loai,
      loaiRaw: loaiRaw,
      buuCuc: T.toStr(raw.buuCuc),
      tinh: T.toStr(raw.tinh),
      phuongXa: T.toStr(raw.phuongXa),
      ghiChu: T.toStr(raw.ghiChu)
    };
  }

  // Trả về danh sách lỗi theo thứ tự: [{ code, message }]. Rỗng = hợp lệ.
  // Mã đầu tiên là mã lỗi chính; message của mọi lỗi được gộp để báo cho người dùng.
  function validateRow(row) {
    var errs = [];
    function add(code, message) { errs.push({ code: code, message: message }); }

    if (!row.maBG) add('E09_SAI_MA_BG', 'Chưa nhập mã bưu gửi');
    else if (/[,;]/.test(row.maBG)) add('E09_SAI_MA_BG', 'Mã bưu gửi "' + row.maBG + '" chứa dấu phẩy hoặc chấm phẩy');
    if (!row.hoTen) add('E01_THIEU_HO_TEN', 'Chưa nhập họ tên người nhận');
    if (!row.diaChi) add('E02_THIEU_DIA_CHI', 'Chưa nhập địa chỉ người nhận');

    if (!row.soDT) add('E03_THIEU_SO_DT', 'Chưa nhập số điện thoại');
    else if (!PHONE_PATTERN.test(row.soDT)) add('E04_SAI_SO_DT', 'Số điện thoại "' + row.soDT + '" sai theo quy tắc của trang (cần ít nhất 3 ký tự số)');
    if (row.email && !EMAIL_PATTERN.test(row.email)) add('E05_SAI_EMAIL', 'Email "' + row.email + '" sai định dạng');

    if (row.loai === null) {
      add('E14_SAI_LOAI_CHUYEN_TIEP', row.loaiRaw
        ? 'Loại chuyển tiếp "' + row.loaiRaw + '" không hợp lệ (dùng "Bưu cục khác" hoặc "Địa chỉ mới")'
        : 'Chưa chọn loại chuyển tiếp và không suy ra được từ các cột đã điền');
    } else if (row.loai === 2) {
      if (!row.buuCuc) add('E06_THIEU_BUU_CUC', 'Chọn chuyển tiếp bưu cục khác nhưng chưa nhập bưu cục chuyển đến');
    } else if (row.loai === 3) {
      if (!row.tinh || !row.phuongXa) add('E07_THIEU_TINH_XA', 'Chọn chuyển tiếp theo địa chỉ nhưng thiếu Tỉnh hoặc Phường/Xã');
    }
    return errs;
  }

  var api = {
    PHONE_PATTERN: PHONE_PATTERN,
    EMAIL_PATTERN: EMAIL_PATTERN,
    normalizeBgCode: normalizeBgCode,
    normalizePhone: normalizePhone,
    parseLoai: parseLoai,
    normalizeRow: normalizeRow,
    validateRow: validateRow
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else { g.VNPCore = g.VNPCore || {}; g.VNPCore.validator = api; }
})(typeof self !== 'undefined' ? self : globalThis);
