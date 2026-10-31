/* =========================================================
   部件資料入口 window.Parts（2026-10-31 新增，設計見 docs/design/parts-layers.md、parts-layers-impl.md）
   平台上任何地方要用「字的部件拆法」，都只呼叫這裡，不要直接讀 PARTS、PARTS_A、PARTS_B、PARTS_AUTO、PARTS_LAYERS
   （自動檢查會報錯；docs/code/refactor.md 規則 1、2）。以後換資料來源或規則，只要改這個檔。
   載入順序：lessons.js（PARTS、PARTS_A、PARTS_B）、parts.js（PARTS_AUTO）之後；parts-layers.js（PARTS_LAYERS）步驟 3b 才開始載入，
   沒載入時新讀法回傳 null。
   兩套讀法：
   1. 過渡讀法 Parts.compat、Parts.compatManual：和步驟 3a 以前完全一樣（老師的人工手動拆法 → 人工 PARTS → 電腦自動 PARTS_AUTO），
      識字評量的部件提示、部件重組、備課分析現在用這個；步驟 3b 改用新讀法後這一組拿掉。
   2. 新讀法 Parts.read、layer、struct、mask：讀 parts-layers.js 的三層資料。每層「人工手動 → 電腦」，從起點層開始、沒有就往下一層。
   ========================================================= */
window.Parts = (() => {
  const words = s => (s || "").split(/\s+/).filter(Boolean);

  /* ---------- 1. 過渡讀法（行為和以前一樣） ---------- */
  /* 老師的人工手動拆法：kind＝"first"（備課分析「第一層」）讀 PARTS_A，"teach"（部件提示、部件重組、備課分析「拆到最細」）讀 PARTS_B */
  const manualOf = (c, kind) => (kind === "first" ? (typeof PARTS_A !== "undefined" && PARTS_A[c])
    : kind === "teach" ? (typeof PARTS_B !== "undefined" && PARTS_B[c]) : "") || "";
  /* 不再往下拆的部件（2026-10-29 維護者決定）：足、酋一律當成一整塊。電腦把足字旁拆成「口 止」的，讀的時候合回「足」
     （parts.js 原始資料不改；make_parts_columns.py 的 KEEP_WHOLE 要和這裡一致） */
  const KEEP_WHOLE = new Set(["足", "酋"]);
  const keepWhole = v => v.replace(/^口 止(?= |$)/, "足");
  /* 讀取順序：人工手動 → 足、酋 → 人工 PARTS → 電腦自動 PARTS_AUTO；回傳 {parts：部件清單, source：manual 人工／auto 電腦自動（不一定適合教學，要人工檢查）／"" 沒有拆法} */
  function compat(c, kind){
    const m = manualOf(c, kind);
    if(m) return {parts: words(m), source: "manual"};
    if(KEEP_WHOLE.has(c)) return {parts: [c], source: "manual"};
    if(typeof PARTS !== "undefined" && PARTS[c]) return {parts: words(PARTS[c]), source: "manual"};
    if(typeof PARTS_AUTO !== "undefined" && PARTS_AUTO[c]) return {parts: words(keepWhole(PARTS_AUTO[c])), source: "auto"};
    return {parts: [], source: ""};
  }
  const compatManual = (c, kind) => words(manualOf(c, kind));

  /* ---------- 2. 新讀法（讀 parts-layers.js） ---------- */
  const data = () => (typeof PARTS_LAYERS !== "undefined" ? PARTS_LAYERS : null);   /* 資料檔用 const 宣告，不能從 window 讀，要直接用名稱 */
  /* 某一層：有人工手動（狀態已確認或待確認）就用人工，沒有再用電腦；都沒有回傳 null。回傳 {parts, source：manual／auto, status：人工的狀態，電腦的是空字串} */
  function layer(c, n){
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

  return {compat, compatManual, layer, read, struct, mask};
})();
