/*
 * 三明治易起走｜登記識別碼＋六碼 共用核心
 * 同一份程式碼用在：小衍網頁（瀏覽器）、Google Apps Script（複製為 RidCore.gs）、Node 測試。
 * 不使用 import/export，掛在 globalThis.XYCore。
 *
 * 登記識別碼格式：XY + 16 碼 Crockford Base32（80 位元亂數）+ 1 碼檢查碼 = 19 字元
 * 顯示時分組：XY-ABCD-EFGH-JKMN-PQRS-T
 */
(function (root) {
  'use strict';
  var ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford，排除 I L O U
  var PREFIX = 'XY';
  var BODY_LEN = 16;

  function checkChar(body) {
    var sum = 0;
    for (var i = 0; i < body.length; i++) {
      var v = ALPHA.indexOf(body.charAt(i));
      if (v < 0) return null;
      sum = (sum + v * (i + 1)) % 32;
    }
    return ALPHA.charAt(sum);
  }

  // 正規化：去掉空白與連字號、轉大寫、易混字元轉換
  function normalizeRid(input) {
    if (typeof input !== 'string') return '';
    return input
      .toUpperCase()
      .replace(/[\s\-_.]/g, '')
      .replace(/O/g, '0')
      .replace(/[IL]/g, '1')
      .replace(/U/g, 'V');
  }

  function isValidRid(input) {
    var r = normalizeRid(input);
    // 前綴 XY 正規化時不會被改動（X、Y 不在轉換表內）
    if (r.length !== PREFIX.length + BODY_LEN + 1) return false;
    if (r.slice(0, 2) !== PREFIX) return false;
    var body = r.slice(2, 2 + BODY_LEN);
    for (var i = 0; i < body.length; i++) if (ALPHA.indexOf(body.charAt(i)) < 0) return false;
    return checkChar(body) === r.charAt(r.length - 1);
  }

  // randomBytes(n) 需回傳長度 n 的整數陣列（0–255）；瀏覽器用 crypto.getRandomValues
  function generateRid(randomBytes) {
    var bytes = randomBytes(10); // 80 bits
    var bits = '';
    for (var i = 0; i < bytes.length; i++) bits += ('00000000' + bytes[i].toString(2)).slice(-8);
    var body = '';
    for (var j = 0; j < BODY_LEN; j++) body += ALPHA.charAt(parseInt(bits.substr(j * 5, 5), 2));
    return PREFIX + body + checkChar(body);
  }

  function formatRid(input) {
    var r = normalizeRid(input);
    if (r.length !== 19) return r;
    return [r.slice(0, 2), r.slice(2, 6), r.slice(6, 10), r.slice(10, 14), r.slice(14, 18), r.slice(18)].join('-');
  }

  // 六碼：六位、每位只能是 6/7/8/9，順序初爻→上爻
  function isValidSixCode(code) {
    return typeof code === 'string' && /^[6-9]{6}$/.test(code);
  }

  function sixCodeFromLineValues(lineValues) {
    if (!Array.isArray(lineValues) || lineValues.length !== 6) return null;
    for (var i = 0; i < 6; i++) {
      var v = lineValues[i];
      if (v !== 6 && v !== 7 && v !== 8 && v !== 9) return null;
    }
    return lineValues.join('');
  }

  // 預填連結：template 必須是管理者從 Google 表單「取得預先填入的連結」複製來的網址，
  // 並把識別碼欄位的值填成 __RID__。不猜 entry ID。
  function buildPrefillUrl(template, rid) {
    if (typeof template !== 'string' || !/[?&]entry\.\d+=__RID__(&|$)/.test(template)) return null;
    if (!isValidRid(rid)) return null;
    return template.replace('__RID__', encodeURIComponent(formatRid(rid)));
  }

  root.XYCore = {
    normalizeRid: normalizeRid,
    isValidRid: isValidRid,
    generateRid: generateRid,
    formatRid: formatRid,
    isValidSixCode: isValidSixCode,
    sixCodeFromLineValues: sixCodeFromLineValues,
    buildPrefillUrl: buildPrefillUrl,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
