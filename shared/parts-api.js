/* =========================================================
   部件資料入口 window.Parts（2026-10-31 新增，設計見 docs/design/parts-layers.md、parts-layers-impl.md）
   平台上任何地方要用「字的部件拆法」，都只呼叫這裡，不要直接讀 PARTS_AUTO、PARTS_LAYERS
   （自動檢查會報錯；docs/code/refactor.md 規則 1、2）。以後換資料來源或規則，只要改這個檔。
   載入順序：parts.js（PARTS_AUTO）、parts-layers.js（PARTS_LAYERS）之後。
   三層（2026-10-31 維護者決定）：第一層＝按結構拆 2～3 塊、第二層＝可教學角度拆到最細、第三層＝開源部件最底層
   （第一、二層存在 parts-layers.js；第三層不存，這裡從 parts.js 一路往下拆算出來，省約 66KB，和 make_parts_columns.py 的算法一樣，產生資料時會檢查兩邊一致）；
   每層讀取時「老師的人工手動拆法（狀態已確認或待確認）→ 電腦自動」，從起點層開始、沒有就往下一層。各功能的起點層：
   部件提示、部件重組、聽音選部件＝第 2 層；聽音補部件、看部件寫字＝第 1 層；備課分析讓老師選。
   ========================================================= */
window.Parts = (() => {
  const words = s => (s || "").split(/\s+/).filter(Boolean);
  const data = () => (typeof PARTS_LAYERS !== "undefined" ? PARTS_LAYERS : null);   /* 資料檔用 const 宣告，不能從 window 讀，要直接用名稱 */
  /* 電腦自動往下拆一層（parts.js 的 PARTS_AUTO，足、酋不再往下拆：2026-10-29 維護者決定，電腦把足字旁拆成「口 止」的合回「足」；
     make_parts_columns.py 的 KEEP_WHOLE 要和這裡一致）：備課分析「拆到最細」一路往下拆、收集途中所有部件時用，任何字或部件都能查，沒有拆法回傳空陣列 */
  const KEEP_WHOLE = new Set(["足", "酋"]);
  const keepWhole = v => v.replace(/^口 止(?= |$)/, "足");
  const sub = p => KEEP_WHOLE.has(p) ? [] : words(typeof PARTS_AUTO !== "undefined" && PARTS_AUTO[p] ? keepWhole(PARTS_AUTO[p]) : "").filter(x => x !== p);
  /* 第三層：一路往下拆到最底層（拼起來剛好是字，不含中間層；同一部件出現幾次寫幾次） */
  const leaves = (p, depth) => { const s = sub(p); return depth < 8 && s.length ? s.flatMap(x => leaves(x, depth + 1)) : [p]; };
  const third = c => { const first = sub(c); return first.length ? first.flatMap(p => leaves(p, 1)) : null; };
  /* 某一層：第一、二層有人工手動（狀態已確認或待確認）就用人工，沒有再用電腦；第三層只有電腦；都沒有回傳 null。回傳 {parts, source：manual／auto, status：人工的狀態，電腦的是空字串} */
  function layer(c, n){
    if(n === 3){ const t = third(c); return t ? {parts: t, source: "auto", status: ""} : null; }
    const d = data(), x = d && d[c] && d[c][n];
    if(!x) return null;
    if(x.m) return {parts: words(x.m), source: "manual", status: x.t || "待確認"};
    if(x.a) return {parts: words(x.a), source: "auto", status: ""};
    return null;
  }
  /* 從起點層開始讀，該層沒有就往下一層：Parts.read("清", {from: 2}) → {layer: 2, parts: [...], source, status}；三層都沒有回傳 null（獨體字） */
  function read(c, opt){
    for(let n = (opt && opt.from) || 1; n <= 3; n++){ const r = layer(c, n); if(r) return {layer: n, ...r}; }
    return null;
  }
  /* 結構（左右、上下、包圍…，老師修正優先；沒資料是空字串） */
  const struct = c => ((data() || {})[c] || {}).s || "";
  /* 正式評量遮第幾塊（1 起算，按第一層的順序數）；沒有規則的字回傳 0 */
  const mask = c => ((data() || {})[c] || {}).k || 0;

  return {layer, read, struct, mask, sub};
})();
