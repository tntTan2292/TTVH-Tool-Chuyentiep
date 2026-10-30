(function (g) {
  'use strict';

  var T = (typeof module === 'object' && module.exports) ? require('./text-utils') : g.VNPCore.text;
  var P = (typeof module === 'object' && module.exports) ? require('./provinces') : g.VNPCore.provinces;

  var PROVINCE_PREFIX = /^(thanh pho|tinh|tp)\s+/;
  var WARD_PREFIX = /^(phuong|xa|thi tran|dac khu)\s+/;

  // Tìm 1 mục trong list [{value,text}] theo đầu vào của người dùng.
  // Thứ tự các bước: (1) đúng mã; (2) trùng tên GIỮ dấu; (3) trùng tên bỏ dấu; (4) như (3) sau khi bỏ tiền tố (Phường/Xã/Tỉnh...).
  // Bước nào có đúng 1 kết quả thì lấy; nhiều kết quả thì báo trùng, không đoán.
  // Bước (2) cần vì dữ liệu thật có cặp chỉ khác dấu (ví dụ "Hương Văn" và "Hương Vân" ở Huế).
  function resolve(input, list, prefixRe) {
    var raw = T.toStr(input);
    if (!raw) return { ok: false, reason: 'empty' };

    if (/^\d+$/.test(raw)) {
      var byCode = list.filter(function (it) { return String(it.value) === raw; });
      if (byCode.length === 1) return { ok: true, value: String(byCode[0].value), text: byCode[0].text };
    }

    var real = list.filter(function (it) { return it.value !== ''; });
    // Bỏ tiền tố nhưng giữ dấu: số từ của tiền tố lấy từ bản không dấu.
    function accentNoPrefix(s) {
      var m = T.words(s).match(prefixRe);
      var parts = T.wordsAccent(s).split(' ');
      return m ? parts.slice(m[0].trim().split(' ').length).join(' ') : parts.join(' ');
    }
    var steps = [
      [T.wordsAccent(raw), function (it) { return T.wordsAccent(it.text); }],
      [accentNoPrefix(raw), function (it) { return accentNoPrefix(it.text); }],
      [T.words(raw), function (it) { return T.words(it.text); }],
      [T.words(raw).replace(prefixRe, ''), function (it) { return T.words(it.text).replace(prefixRe, ''); }]
    ];
    for (var i = 0; i < steps.length; i++) {
      var want = steps[i][0];
      var norm = steps[i][1];
      var hits = real.filter(function (it) { return norm(it) === want; });
      if (hits.length === 1) return { ok: true, value: String(hits[0].value), text: hits[0].text };
      if (hits.length > 1) return { ok: false, reason: 'ambiguous', matches: hits.map(function (it) { return it.text; }) };
    }
    return { ok: false, reason: 'not_found' };
  }

  function resolveProvince(input) {
    return resolve(input, P.PROVINCES, PROVINCE_PREFIX);
  }

  // wards: danh sách {value,text} lấy từ GET /Order/Home/GetWard?ProvinceId=
  function resolveWard(input, wards) {
    return resolve(input, wards, WARD_PREFIX);
  }

  var api = { resolveProvince: resolveProvince, resolveWard: resolveWard };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else { g.VNPCore = g.VNPCore || {}; g.VNPCore.address = api; }
})(typeof self !== 'undefined' ? self : globalThis);
