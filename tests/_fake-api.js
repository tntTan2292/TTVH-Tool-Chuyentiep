'use strict';

// Bộ api giả cho test: ghi lại các lần gọi, cho phép ghi đè từng hàm.
function makeApi(over) {
  over = over || {};
  var calls = [];
  var api = {
    calls: calls,
    getLading: async function (maBG) {
      calls.push(['getLading', maBG]);
      if (over.getLading) return over.getLading(maBG, calls);
      return { ok: true, data: { found: true, statusCode: 'C39', hasForwardButton: true, receiverName: 'Nguyen A', receiverAddress: 'Dia chi cu' } };
    },
    getForm: async function (maBG, name, addr) {
      calls.push(['getForm', maBG, name, addr]);
      if (over.getForm) return over.getForm(maBG, name, addr, calls);
      return { ok: true, data: { model: { Id: 123, LadingCode: maBG, StatusCode: 'C39', PosName: 'BCVH Test' } } };
    },
    getWard: async function (provinceId) {
      calls.push(['getWard', provinceId]);
      if (over.getWard) return over.getWard(provinceId, calls);
      return {
        ok: true,
        data: [
          { value: '', text: '--- Phường, xã ---' },
          { value: '53764', text: 'A Lưới 1' },
          { value: '53766', text: 'A Lưới 2' },
          { value: '53111', text: 'Phường Thuận Hóa' }
        ]
      };
    },
    post: async function (model) {
      calls.push(['post', model]);
      if (over.post) return over.post(model, calls);
      return { ok: true, data: { Code: '00', Message: 'Cập nhật thông tin chuyển tiếp thành công!' } };
    }
  };
  return api;
}

function validRow(extra) {
  return Object.assign({
    maBG: 'EB123456789VN', hoTen: 'Nguyễn Văn Mẫu', diaChi: 'Số 1 Đường Giả Định', soDT: '0901234567',
    email: '', loai: 'BUU_CUC', buuCuc: '533140', tinh: '', phuongXa: '', ghiChu: ''
  }, extra || {});
}

var noSleep = async function () {};

module.exports = { makeApi: makeApi, validRow: validRow, noSleep: noSleep };
