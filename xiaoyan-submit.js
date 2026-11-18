/*
 * 三明治易起走｜小衍結果頁「保存卦象＋提交本次卦象」V1.1
 * 只讀取原程式的 lineValues、busy、autoRunning 與 #sixDigits，不呼叫、不修改任何洗牌／抽牌／分堆／爻值計算。
 *
 * V1.1 規則：
 * 1. 起卦結果綁定在「開始起卦當下」的識別碼（castRid）。中途不能換識別碼；完成後換識別碼，畫面上的卦象也不會被拿去提交。
 * 2. 同一識別碼只保存第一次完成的六爻，之後不覆寫。
 * 3. 提交一律使用「已保存」的六碼，不直接使用畫面上的即時數值。
 * 4. 「本機狀態」與「Google 確認頁回報」分開顯示；網址上的 xy_result 只記為回報，不視為已查證的寫入結果。
 * 提交協定與 V1 相同：新分頁開啟 Apps Script 確認頁 ?rid=…&code=…
 */
(function () {
  'use strict';
  var C = window.XY_CONFIG || {}, core = window.XYCore, store = window.XYStore;
  if (!core || !store) return;

  var NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
  var REPORT_TEXT = {
    OK_WRITTEN: '送出成功', OK_ALREADY: '先前已送出成功', OK_REPORTED_V1: '送出成功（舊版紀錄）',
    NOT_FOUND: '找不到表單資料', CONFLICT: '已有不同六碼', DUPLICATE_RID: '多筆資料需人工確認', INVALID_RID: '識別碼格式錯誤',
    INVALID_CODE: '六碼格式錯誤', BUSY: '系統忙碌', RATE_LIMITED: '嘗試次數過多', CONFIG_ERROR: '系統設定問題', ERROR: '系統錯誤',
  };

  function g(name) { // 讀取原程式頂層 let 變數（唯讀）
    try {
      switch (name) {
        case 'lineValues': return typeof lineValues !== 'undefined' && Array.isArray(lineValues) ? lineValues.slice() : []; // eslint-disable-line no-undef
        case 'busy': return typeof busy !== 'undefined' && !!busy; // eslint-disable-line no-undef
        case 'autoRunning': return typeof autoRunning !== 'undefined' && !!autoRunning; // eslint-disable-line no-undef
      }
    } catch (e) {}
    return null;
  }

  // ---- 介面 ----
  var css = document.createElement('style');
  css.textContent = '.xy-submit{margin-top:18px;padding:16px;background:#fffdf6;border:1px solid #d8d0bd;border-radius:13px}' +
    '.xy-submit h2{margin:0 0 8px;font-size:18px}.xy-submit h3{margin:14px 0 8px;font-size:16px}.xy-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}' +
    '.xy-rid{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;letter-spacing:1px}' +
    '.xy-submit input{font:inherit;padding:10px;border:1px solid #c7bda9;border-radius:9px;min-width:0;flex:1 1 260px;text-transform:uppercase}' +
    '.xy-msg{font-size:14px;margin:8px 0 0}.xy-msg.err{color:#812f27}.xy-msg.ok{color:#2f5f3a}.xy-note{color:#6c756d;font-size:13px;margin:6px 0 0}' +
    '.xy-env{display:inline-block;background:#9b6b24;color:#fff;border-radius:6px;padding:1px 7px;font-size:12px;margin-left:6px}' +
    '.xy-state{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:14px;margin:10px 0 0;padding:10px 12px;background:#f3eedf;border-radius:10px}.xy-state dt{color:#6c756d}.xy-state dd{margin:0;font-weight:600}' +
    '.xy-warn{background:#f5ead4;border:1px solid #c9a96a;color:#6b4a14;border-radius:10px;padding:10px 12px;font-size:14px;margin:10px 0 0}';
  document.head.appendChild(css);

  var box = document.createElement('section');
  box.className = 'xy-submit';
  box.id = 'xySubmit';
  box.setAttribute('aria-live', 'polite');
  box.innerHTML =
    '<h2>保存與提交卦象' + (C.env === 'test' ? '<span class="xy-env">測試環境</span>' : '') + '</h2>' +
    '<div class="xy-row"><span>登記識別碼：</span><span id="xyRidText" class="xy-rid">—</span>' +
    '<button id="xyChangeRid" type="button">更換</button></div>' +
    '<div class="xy-row" id="xyRidInputRow" hidden><input id="xyRidInput" autocomplete="off" spellcheck="false" placeholder="XY-XXXX-XXXX-XXXX-XXXX-X" aria-label="登記識別碼">' +
    '<button id="xyRidSave" type="button">使用這組識別碼</button></div>' +
    '<p id="xyMismatch" class="xy-warn" hidden></p>' +
    '<div id="xySaved" hidden><h3>已保存的卦象（由下往上）</h3><div id="xySavedGrid" class="line-results-grid"></div>' +
    '<p id="xySavedCode" class="six-digits"></p></div>' +
    '<dl class="xy-state"><dt>本機狀態</dt><dd id="xyLocal">—</dd><dt>Google 寫入結果</dt><dd id="xyReport">—</dd></dl>' +
    '<div class="xy-row"><button id="xySubmitBtn" type="button" disabled>提交本次卦象</button></div>' +
    '<p id="xyMsg" class="xy-msg"></p>' +
    '<p class="xy-note">按下後會開啟 Google 的確認頁面，在那裡完成送出。若網路中斷，可以回到這裡再按一次，系統不會重複寫入。「Google 寫入結果」顯示的是確認頁的回報，最終以試算表為準。</p>';
  var anchor = document.querySelector('.line-results');
  (anchor && anchor.parentNode ? anchor.parentNode : document.body).insertBefore(box, anchor ? anchor.nextSibling : null);

  var $ = function (id) { return document.getElementById(id); };
  var rid = null;          // 目前識別碼
  var castRid = null;      // 本頁這次起卦所綁定的識別碼
  var memCast = {};        // 瀏覽器無法保存時的記憶體備援（同一頁有效）
  var lastSave = null;     // 最近一次保存結果

  function msg(text, kind) { var m = $('xyMsg'); m.textContent = text; m.className = 'xy-msg' + (kind ? ' ' + kind : ''); }
  function castInProgress() { var n = g('lineValues').length; return (n > 0 && n < 6) || ((g('busy') || g('autoRunning')) && n < 6); }

  function savedFor(r) {
    if (!r) return null;
    var rec = store.get(r);
    if (rec && rec.code) return rec;
    if (memCast[r]) return { rid: r, lines: memCast[r].split('').map(Number), code: memCast[r], local: 'drawn', report: null, memoryOnly: true };
    return rec;
  }

  function setRid(r, persist) {
    if (castInProgress()) { msg('起卦進行中，完成六爻前不能更換識別碼。', 'err'); return; }
    rid = core.isValidRid(r) ? core.normalizeRid(r) : null;
    $('xyRidText').textContent = rid ? core.formatRid(rid) : '尚未設定';
    $('xyRidInputRow').hidden = !!rid;
    if (rid && persist) { store.ensure(rid); store.setCurrent(rid); }
    refresh();
  }

  function onLinesChanged() {
    var lv = g('lineValues');
    if (lv.length >= 1 && !castRid && rid) castRid = rid;          // 第一爻完成時綁定識別碼
    if (lv.length === 6) {
      if (!castRid && rid) castRid = rid;
      if (castRid) {
        var res = store.saveCast(castRid, lv);
        var code = core.sixCodeFromLineValues(lv);
        if (res.ok && !(store.get(castRid) || {}).code && code) memCast[castRid] = code; // 無法寫入瀏覽器時的備援
        lastSave = res.reason;
      }
    }
    refresh();
  }

  function refresh() {
    var lv = g('lineValues'), live = core.sixCodeFromLineValues(lv), rec = savedFor(rid);
    $('xyChangeRid').disabled = castInProgress();

    // 已保存的卦象（只顯示目前識別碼自己的）
    var has = !!(rec && rec.code);
    $('xySaved').hidden = !has;
    if (has) {
      $('xySavedGrid').innerHTML = NAMES.map(function (n, i) { return '<div class="line-result"><small>' + n + '</small><b>' + rec.lines[i] + '</b></div>'; }).join('');
      $('xySavedCode').textContent = '六碼：' + rec.code + (rec.memoryOnly ? '（此瀏覽器無法保存，請勿關閉本頁）' : '');
    } else {
      $('xySavedGrid').innerHTML = '';      // 換到沒有卦象的識別碼時，清空（不只是隱藏）上一筆內容
      $('xySavedCode').textContent = '';
    }

    // 畫面上的卦象與目前識別碼不一致時提醒
    var mm = $('xyMismatch');
    if (live && castRid && rid && castRid !== rid) {
      mm.hidden = false;
      mm.innerHTML = '畫面上這次的卦象屬於識別碼 <b class="xy-rid">' + core.formatRid(castRid) + '</b>，不會用在目前的識別碼。' +
        (has ? '' : ' <button id="xyRecast" type="button">為目前識別碼重新起卦</button>');
      var rb = $('xyRecast');
      if (rb) rb.onclick = function () { var u = new URL(location.href); u.search = ''; u.searchParams.set('rid', core.formatRid(rid)); location.href = u.toString(); };
    } else if (live && castRid === rid && lastSave === 'exists') {
      mm.hidden = false;
      mm.textContent = '這組識別碼先前已經保存過另一組卦象（' + rec.code + '），這次的結果不會覆蓋。若要問新的問題，請回登記頁產生新識別碼。';
    } else mm.hidden = true;

    // 狀態
    var localText = !rid ? '尚未設定識別碼' : !has ? (castInProgress() ? '起卦中…' : '尚未起卦') :
      rec.local === 'submit_opened' ? '已開啟確認頁，等待確認頁回報' : '已起卦並保存，尚未提交';
    $('xyLocal').textContent = localText;
    var rep = rec && rec.report;
    $('xyReport').textContent = !rep ? '尚未收到回報（本機無法直接查證，請以確認頁訊息與試算表為準）' :
      '確認頁回報：' + (REPORT_TEXT[rep.status] || rep.status) + '（' + rep.status + '）｜最終以試算表 H 欄為準';

    // 按鈕
    var btn = $('xySubmitBtn');
    if (!C.submitEndpoint) { btn.disabled = true; msg('提交服務尚未設定（管理者請見 docs/SETUP.md）。', 'err'); return; }
    if (!rid) { btn.disabled = true; msg('請輸入你在登記頁取得的識別碼。', ''); return; }
    if (store.isReportedOk(rec)) { btn.disabled = true; msg('確認頁已回報送出成功。若要問新的問題，請回登記頁產生新識別碼。', 'ok'); return; }
    if (!has) { btn.disabled = true; msg(castInProgress() ? '起卦中，六爻完成後會自動保存。' : '六爻完成後即可提交。', ''); return; }
    btn.disabled = false;
    msg(rec.local === 'submit_opened' ? '若確認頁顯示網路錯誤或已關閉，可以再按一次，會送出同一組六碼。' : '卦象已保存，可以提交。', '');
  }

  $('xyChangeRid').addEventListener('click', function () {
    if (castInProgress()) { msg('起卦進行中，完成六爻前不能更換識別碼。', 'err'); return; }
    $('xyRidInputRow').hidden = false; $('xyRidInput').focus();
  });
  $('xyRidSave').addEventListener('click', function () {
    var v = $('xyRidInput').value;
    if (!core.isValidRid(v)) { msg('識別碼格式不正確，請再核對一次（共 19 碼，XY 開頭）。', 'err'); return; }
    setRid(v, true);
  });

  $('xySubmitBtn').addEventListener('click', function () {
    var rec = savedFor(rid);
    if (!rid || !rec || !rec.code || !core.isValidSixCode(rec.code)) { refresh(); return; }
    if (store.isReportedOk(rec)) { refresh(); return; }
    store.advanceLocal(rid, 'submit_opened');
    var u = new URL(C.submitEndpoint);
    u.searchParams.set('rid', core.formatRid(rid));
    u.searchParams.set('code', rec.code);   // 一律使用已保存的六碼
    var w = window.open(u.toString(), '_blank');
    if (w) { try { w.opener = null; } catch (e) {} } else location.href = u.toString();
    refresh();
    msg('已開啟確認頁面。請在新分頁按「確認送出」，看到成功訊息即完成。', '');
  });

  // ---- 初始化 ----
  var params = new URLSearchParams(location.search);
  var urlRid = params.get('rid');
  if (urlRid && core.isValidRid(urlRid)) setRid(urlRid, true);
  else setRid(store.getCurrent(), false);

  // Apps Script 確認頁的「回到小衍」連結帶回 xy_result：只記為「確認頁回報」，且該識別碼必須已有保存的卦象
  var result = params.get('xy_result');
  if (rid && result && /^[A-Z_0-9]{2,20}$/.test(result)) { store.setReport(rid, result); refresh(); }

  var sd = document.getElementById('sixDigits');
  if (sd && window.MutationObserver) new MutationObserver(onLinesChanged).observe(sd, { childList: true, characterData: true, subtree: true });
  // 原程式的 render() 會更新按鈕狀態；跟著刷新，讓「更換」在動畫中保持停用
  if (typeof window.render === 'function') {
    var origRender = window.render;
    window.render = function () { var r = origRender.apply(this, arguments); try { refresh(); } catch (e) {} return r; };
  }
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
})();
