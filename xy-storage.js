/*
 * 三明治易起走｜瀏覽器端登記紀錄 V1.1（localStorage）
 *
 * 每一筆紀錄只屬於一個登記識別碼：
 *   rid        登記識別碼（正規化）
 *   lines      六爻數值陣列 [初爻…上爻]，只會在第一次完成時寫入，之後不覆寫
 *   code       六碼字串（= lines.join('')）
 *   castAt     起卦完成時間
 *   local      本機狀態：registered（已登記）→ form_opened（已開表單）→ drawn（已起卦）→ submit_opened（已開確認頁）
 *   report     Google 確認頁「回報」的結果（經由回到小衍連結帶回）。這只是回報，不是本機查證過的伺服器結果；
 *              最終以試算表 H 欄為準。格式 { status, at }
 *
 * 無痕模式或儲存被封鎖時不會報錯，只是不保存；頁面一律另外提供手動輸入識別碼的補救方式。
 */
(function (root) {
  'use strict';
  var KEY = 'xy_registrations_v2';
  var OLD_KEY = 'xy_registrations_v1';
  var CUR = 'xy_current_rid_v1';
  var LOCAL_ORDER = ['registered', 'form_opened', 'drawn', 'submit_opened'];
  var OK_REPORTS = ['OK_WRITTEN', 'OK_ALREADY'];

  function safeGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function core() { return root.XYCore; }

  function linesFromCode(code) { return core().isValidSixCode(code) ? code.split('').map(Number) : null; }

  // V1 → V1.1 遷移（只做一次；V1 的 'submitted' 是由網址參數判定的，遷移後標為「V1 回報」而非已查證）
  function migrate() {
    if (safeGet(KEY) !== null) return;
    var old = [];
    try { old = JSON.parse(safeGet(OLD_KEY) || '[]'); } catch (e) { old = []; }
    if (!Array.isArray(old)) old = [];
    var list = old.filter(function (x) { return x && core().isValidRid(x.rid); }).map(function (x) {
      var lines = linesFromCode(x.code);
      var local = x.status === 'pending' ? 'submit_opened' : lines ? 'drawn' : (x.status === 'form_opened' ? 'form_opened' : 'registered');
      return {
        rid: core().normalizeRid(x.rid), createdAt: x.createdAt || null, updatedAt: x.updatedAt || null,
        lines: lines, code: lines ? x.code : null, castAt: lines ? (x.updatedAt || null) : null,
        local: local, report: x.status === 'submitted' ? { status: 'OK_REPORTED_V1', at: x.updatedAt || null } : null,
      };
    });
    safeSet(KEY, JSON.stringify(list));
  }

  function all() {
    migrate();
    try { var a = JSON.parse(safeGet(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function saveAll(list) { return safeSet(KEY, JSON.stringify(list.slice(-30))); }

  function get(rid) {
    var r = core().normalizeRid(rid || '');
    return all().filter(function (x) { return x.rid === r; })[0] || null;
  }

  function mutate(rid, fn) {
    var r = core().normalizeRid(rid || '');
    if (!core().isValidRid(r)) return { record: null, persisted: false };
    var list = all(), rec = null;
    list.forEach(function (x) { if (x.rid === r) rec = x; });
    if (!rec) { rec = { rid: r, createdAt: new Date().toISOString(), updatedAt: null, lines: null, code: null, castAt: null, local: 'registered', report: null }; list.push(rec); }
    var changed = fn(rec);
    if (changed !== false) rec.updatedAt = new Date().toISOString();
    return { record: rec, persisted: saveAll(list), changed: changed !== false };
  }

  function ensure(rid) { return mutate(rid, function () { return true; }); }

  // 本機狀態只能往前推進，不會倒退（例如已起卦的紀錄不會被改回「已開表單」）
  function advanceLocal(rid, state) {
    return mutate(rid, function (rec) {
      if (LOCAL_ORDER.indexOf(state) <= LOCAL_ORDER.indexOf(rec.local)) return false;
      rec.local = state; return true;
    });
  }

  // 保存起卦結果：同一識別碼只保存第一次完成的六爻，之後一律拒絕覆寫
  function saveCast(rid, lines) {
    var code = core().sixCodeFromLineValues(lines);
    if (!code) return { ok: false, reason: 'invalid' };
    var out = { ok: false, reason: 'exists' };
    mutate(rid, function (rec) {
      if (rec.code) { out = { ok: rec.code === code, reason: rec.code === code ? 'same' : 'exists', record: rec }; return false; }
      rec.lines = lines.slice(); rec.code = code; rec.castAt = new Date().toISOString();
      if (LOCAL_ORDER.indexOf(rec.local) < LOCAL_ORDER.indexOf('drawn')) rec.local = 'drawn';
      out = { ok: true, reason: 'saved', record: rec };
      return true;
    });
    return out;
  }

  // 記錄確認頁回報；回報的六碼必須與本機保存的一致才採用
  function setReport(rid, status, code) {
    return mutate(rid, function (rec) {
      if (!rec.code || (code && code !== rec.code)) return false;
      if (rec.report && OK_REPORTS.indexOf(rec.report.status) >= 0) return false; // 已有成功回報，不再改動
      rec.report = { status: String(status).slice(0, 20), at: new Date().toISOString() };
      return true;
    });
  }

  function isReportedOk(rec) { return !!(rec && rec.report && (OK_REPORTS.indexOf(rec.report.status) >= 0 || rec.report.status === 'OK_REPORTED_V1')); }

  function setCurrent(rid) { return safeSet(CUR, core().normalizeRid(rid)); }
  function getCurrent() { var r = safeGet(CUR); return r && core().isValidRid(r) ? r : null; }
  function storageWorks() {
    var t = '__xy_test__';
    if (!safeSet(t, '1')) return false;
    try { root.localStorage.removeItem(t); } catch (e) {}
    return true;
  }

  root.XYStore = {
    all: all, get: get, ensure: ensure, advanceLocal: advanceLocal, saveCast: saveCast, setReport: setReport,
    isReportedOk: isReportedOk, setCurrent: setCurrent, getCurrent: getCurrent, storageWorks: storageWorks,
  };
})(window);
