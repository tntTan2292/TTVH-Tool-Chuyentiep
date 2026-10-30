(function (g) {
  'use strict';

  // 34 tỉnh/thành trong select#cbProvince. Nguồn: docs/audit/02-truong-tab-chuyen-tiep.md mục 2.
  var PROVINCES = [
    { value: '88', text: 'An Giang' }, { value: '22', text: 'Bắc Ninh' }, { value: '27', text: 'Cao Bằng' },
    { value: '97', text: 'Cà Mau' }, { value: '90', text: 'Cần Thơ' }, { value: '60', text: 'Gia Lai' },
    { value: '53', text: 'Huế' }, { value: '10', text: 'Hà Nội' }, { value: '48', text: 'Hà Tĩnh' },
    { value: '16', text: 'Hưng Yên' }, { value: '18', text: 'Hải Phòng' }, { value: '70', text: 'Hồ Chí Minh' },
    { value: '65', text: 'Khánh Hòa' }, { value: '39', text: 'Lai Châu' }, { value: '33', text: 'Lào Cai' },
    { value: '67', text: 'Lâm Đồng' }, { value: '24', text: 'Lạng Sơn' }, { value: '46', text: 'Nghệ An' },
    { value: '43', text: 'Ninh Bình' }, { value: '29', text: 'Phú Thọ' }, { value: '57', text: 'Quảng Ngãi' },
    { value: '20', text: 'Quảng Ninh' }, { value: '52', text: 'Quảng Trị' }, { value: '36', text: 'Sơn La' },
    { value: '44', text: 'Thanh Hóa' }, { value: '25', text: 'Thái Nguyên' }, { value: '30', text: 'Tuyên Quang' },
    { value: '84', text: 'Tây Ninh' }, { value: '89', text: 'Vĩnh Long' }, { value: '38', text: 'Điện Biên' },
    { value: '55', text: 'Đà Nẵng' }, { value: '63', text: 'Đắk Lắk' }, { value: '81', text: 'Đồng Nai' },
    { value: '87', text: 'Đồng Tháp' }
  ];

  var api = { PROVINCES: PROVINCES };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else { g.VNPCore = g.VNPCore || {}; g.VNPCore.provinces = api; }
})(typeof self !== 'undefined' ? self : globalThis);
