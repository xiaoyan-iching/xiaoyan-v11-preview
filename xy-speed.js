/*
 * 三明治易起走｜小衍起卦速度切換 1× / 2×（V1.1）
 *
 * 做法：只替換原程式的兩個「計時」函式，不碰任何演算法：
 *   wait(ms)              → 等待時間 × 倍率
 *   animateTo(tile, opt)  → 動畫長度與延遲 × 倍率
 * 翻牌動畫（CSS .turn 0.5 秒）在 2× 時改為 0.25 秒。
 * 洗牌（shuffled）、抽牌、分堆、爻值與 lineValues 完全沒有被呼叫或修改；Math.random 的呼叫次數與順序不受速度影響。
 *
 * 速度偏好存在 localStorage 的 xy_speed_v1，與識別碼、六碼的紀錄互不相干。
 */
(function () {
  'use strict';
  var KEY = 'xy_speed_v1';
  var FACTORS = { '1x': 1, '2x': 0.5 };
  var speed = '1x';
  try { var saved = window.localStorage.getItem(KEY); if (FACTORS[saved]) speed = saved; } catch (e) {}

  function factor() { return FACTORS[speed]; }
  window.XYSpeed = { get: function () { return speed; }, factor: factor };

  // ---- 替換計時函式（原函式保留，只調整傳入的毫秒數）----
  if (typeof window.wait === 'function') {
    var origWait = window.wait;
    window.wait = function (ms) { return origWait(Math.round((Number(ms) || 0) * factor())); };
  }
  if (typeof window.animateTo === 'function') {
    var origAnimate = window.animateTo;
    window.animateTo = function (tile, opts) {
      var o = {}, k;
      opts = opts || {};
      for (k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
      o.duration = Math.round((o.duration === undefined ? 500 : o.duration) * factor()); // 500 = 原函式預設值
      o.delay = Math.round((o.delay === undefined ? 0 : o.delay) * factor());
      return origAnimate(tile, o);
    };
  }

  // ---- 介面 ----
  var css = document.createElement('style');
  css.textContent = 'body.xy-speed-2x .turn{transition-duration:.25s}' +
    '.xy-speed{display:inline-flex;border:1px solid #b9ae95;border-radius:10px;overflow:hidden}' +
    '.xy-speed button{border-radius:0;background:#e5ddca;color:#29352d;padding:11px 14px}' +
    '.xy-speed button[aria-pressed="true"]{background:#315a45;color:#fff}' +
    '.xy-speed button:disabled{opacity:.55;cursor:not-allowed}' +
    '.xy-speed-note{flex-basis:100%;font-size:12px;color:#6c756d;margin:2px 0 0}';
  document.head.appendChild(css);

  var controls = document.querySelector('header .controls');
  var group = document.createElement('div');
  group.className = 'xy-speed';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', '起卦速度');
  group.innerHTML = '<button type="button" data-speed="1x">一般 1×</button><button type="button" data-speed="2x">快速 2×</button>';
  var note = document.createElement('p');
  note.className = 'xy-speed-note';
  note.id = 'xySpeedNote';
  if (controls) { controls.insertBefore(group, controls.firstChild); controls.appendChild(note); }

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  function locked() {
    try { return !!(busy || autoRunning); } catch (e) { return false; } // eslint-disable-line no-undef
  }
  function paint() {
    document.body.classList.toggle('xy-speed-2x', speed === '2x');
    var lock = locked();
    [].forEach.call(group.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.speed === speed));
      b.disabled = lock;
    });
    var parts = ['速度：' + (speed === '2x' ? '快速 2×（動畫與等待約縮短一半）' : '一般 1×')];
    if (lock) parts.push('動畫進行中，暫時不能切換');
    if (reduced && reduced.matches) parts.push('已依系統「減少動態效果」設定簡化紙牌動畫');
    note.textContent = parts.join('｜');
  }
  group.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-speed]');
    if (!b || locked() || !FACTORS[b.dataset.speed]) return;
    speed = b.dataset.speed;
    try { window.localStorage.setItem(KEY, speed); } catch (err) {}
    paint();
  });

  // 原程式每次狀態改變都會呼叫 render()；跟著更新鎖定狀態
  if (typeof window.render === 'function') {
    var origRender = window.render;
    window.render = function () { var r = origRender.apply(this, arguments); try { paint(); } catch (e) {} return r; };
  }
  if (reduced && reduced.addEventListener) reduced.addEventListener('change', paint);
  setInterval(paint, 300); // 保險：確保動畫中一定是鎖定狀態
  paint();
})();
