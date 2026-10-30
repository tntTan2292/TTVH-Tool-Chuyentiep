(function (g) {
  'use strict';

  // Dựng model gửi lên UpdateItemForward: lấy _newModel server trả về rồi gán đúng các trường
  // mà hàm UpdateItemForward() của trang gán (xem docs/audit/evidence/evidence_summary.md mục 3).
  // Không đụng tới các khóa khác của model.
  // addressReturn: loại 2 = chuỗi bưu cục; loại 3 = "<mã tỉnh>;<mã phường/xã>".
  function buildModel(serverModel, row, addressReturn) {
    var m = {};
    Object.keys(serverModel).forEach(function (k) { m[k] = serverModel[k]; });
    m.ReceiverNameReturn = row.hoTen;
    m.ReceiverAddressReturn = row.diaChi;
    m.NextPhone = row.soDT;
    m.NextEmail = row.email || '';
    m.AddressReturnType = String(row.loai);
    m.AddressReturn = addressReturn;
    m.NoteReturn = row.ghiChu || '';
    return m;
  }

  var api = { buildModel: buildModel };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else { g.VNPCore = g.VNPCore || {}; g.VNPCore.modelBuilder = api; }
})(typeof self !== 'undefined' ? self : globalThis);
