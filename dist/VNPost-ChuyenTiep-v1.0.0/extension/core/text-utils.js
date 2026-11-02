(function (g) {
  'use strict';

  // Ô Excel có thể là số, ngày, null... luôn đưa về chuỗi đã cắt khoảng trắng.
  function toStr(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/ /g, ' ').trim();
  }

  function stripDiacritics(s) {
    return toStr(s)
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // Khóa so sánh: bỏ dấu, chữ thường, chỉ giữ chữ và số.
  function key(s) {
    return stripDiacritics(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  // Tên dùng so khớp địa danh: bỏ dấu, chữ thường, gộp khoảng trắng, giữ chữ và số.
  function words(s) {
    return stripDiacritics(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // Như words nhưng GIỮ dấu (chuẩn NFC, chữ thường): để phân biệt các tên chỉ khác nhau ở dấu, ví dụ "Hương Văn" và "Hương Vân".
  function wordsAccent(s) {
    return toStr(s).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  var api = { toStr: toStr, stripDiacritics: stripDiacritics, key: key, words: words, wordsAccent: wordsAccent };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else { g.VNPCore = g.VNPCore || {}; g.VNPCore.text = api; }
})(typeof self !== 'undefined' ? self : globalThis);
