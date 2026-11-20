/* =========================================================
   字形尺格子（2026-11-12 從 tools/literacy/exam.js 搬來，寫字考卷和之後的練習簿共用）
   RulerCell.html(字, {ruler})：回傳一個格子的 HTML。ruler 為真且字是左右、上下、左中右、上中下或包圍結構時，
     畫虛線分區加淡色底（字形尺）；否則畫十字格。樣式在 shared/ruler-cell.css，格子邊長由頁面設定 --cell。
   RulerCell.blocks(字, ruler)：只回傳分區，每塊是 [left, top, width, height]（0～1，格子的比例）；沒有分區回傳 null。
   分線位置照 shared/ruler.js 的 RULER（主要用教育部筆畫資料算，2026-11-14）；左右、上下、左中右、上中下的字表裡沒有（不確定、不收）就不畫字型尺，畫十字格。
   需要先載入 shared/parts-api.js（Parts.struct 判斷結構）和 shared/ruler.js；沒載入時一律畫十字格。
   ========================================================= */
const RulerCell = (() => {
  const TINT = ["#eef5fc", "#fdf8e6", "#eef8f0"];
  const TINTA = ["rgba(120,170,230,.16)", "rgba(240,200,60,.2)", "rgba(100,190,120,.18)"];   /* 交疊字：每個部件一個方框、會重疊，用半透明的淡色，重疊的地方顏色會混合（2026-11-18） */   /* 淡藍、淡黃、淡綠（2026-11-10 維護者要求再淺一點；用很淡的不透明色，包圍字裡面那一塊才不會和外框疊成別的顏色） */

  function blocks(c, ruler){
    /* 每一塊是 [left, top, width, height]（0～1，格子的比例）；線畫在塊和塊的交界 */
    const s = ruler && typeof Parts !== "undefined" ? Parts.struct(c) : "";
    const inner = (l, t, w = .62, h = .62) => [[0, 0, 1, 1], [l, t, w, h]];   /* 包圍：外框一塊、裡面一塊 */
    /* 分線照字的比例（shared/ruler.js，主要用教育部筆畫資料算，2026-11-14）；左右、上下、左中右、上中下的字表裡沒有就不畫字型尺 */
    const r = typeof RULER !== "undefined" && RULER[c];
    /* 左右、上下、左中右、上中下：表裡沒有這個字的分線（不確定、不收）就不畫字型尺，用十字格（寧可不分，也不要分錯；2026-11-14 維護者決定） */
    const need = {"左右": 1, "上下": 1, "左中右": 2, "上中下": 2}[s];
    /* 包圍字：表裡有 [左, 上, 寬, 高]（裡面那一塊的方框，教育部筆畫算的，2026-11-17）就用，沒有就用固定的預設比例 */
    /* 多邊形（維護者 2026-11-18 的例外，目前只有「包」）：r 是 [[x,y],…]；blocks 回傳它的外框方框，畫的時候 html() 另外畫多邊形 */
    const poly = s.includes("包圍") && Array.isArray(r) && r.length >= 3 && Array.isArray(r[0]) && r[0].length === 2 ? r : null;
    const pb = poly ? (xs => (ys => [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)])(poly.map(p => p[1])))(poly.map(p => p[0])) : null;
    /* 交疊字：表裡是每個部件一個方框 [[左,上,寬,高], …]（2～3 個，方框會重疊） */
    const ovl = s === "交疊" && Array.isArray(r) && r.length >= 2 && Array.isArray(r[0]) && r[0].length === 4 ? r : null;
    if(ovl) return ovl;
    const sq = pb || (s.includes("包圍") && r && r.length === 4 && typeof r[0] === "number" ? r : null);
    if(need && !(r && r.length === need)) return null;
    const cut = (n, def) => r && r.length === n ? r : def;
    const cols = ([a, b]) => b === undefined ? [[0, 0, a, 1], [a, 0, 1 - a, 1]] : [[0, 0, a, 1], [a, 0, b - a, 1], [b, 0, 1 - b, 1]];
    const rows = ([a, b]) => b === undefined ? [[0, 0, 1, a], [0, a, 1, 1 - a]] : [[0, 0, 1, a], [0, a, 1, b - a], [0, b, 1, 1 - b]];
    return ({
      "左右": cols(cut(1, [.5])),
      "上下": rows(cut(1, [.5])),
      "左中右": cols(cut(2, [1 / 3, 2 / 3])),
      "上中下": rows(cut(2, [1 / 3, 2 / 3])),
      "全包圍": sq ? inner(...sq) : inner(.19, .19),
      "上方包圍": sq ? inner(...sq) : inner(.19, .38),
      "下方包圍": sq ? inner(...sq) : inner(.19, 0),
      "左方包圍": sq ? inner(...sq) : inner(.38, .19),
      "左上包圍": sq ? inner(...sq) : inner(.38, .38),
      "左下包圍": sq ? inner(...sq) : inner(.38, 0),
      "右上包圍": sq ? inner(...sq) : inner(0, .38)
    })[s] || null;
  }

  function html(c, opt){
    const bl = blocks(c, !!(opt && opt.ruler));
    if(!bl) return `<span class="excell cross"></span>`;
    const overlap = typeof Parts !== "undefined" && Parts.struct(c) === "交疊";
    const pg = typeof RULER !== "undefined" && RULER[c];
    if(opt && opt.ruler && Array.isArray(pg) && pg.length >= 3 && Array.isArray(pg[0]) && pg[0].length === 2) return polyHtml(pg);
    const pct = x => (x * 100).toFixed(2) + "%";
    /* 淡色底不畫框；分線只畫在格子裡面（每條畫一次），外框和十字格一樣是黑色實線（2026-11-10 修正：原本每塊都有虛線框，貼在外框內側，外框看起來像不見了） */
    const lines = new Map(), e = 1e-6;
    for(const [l, t, w, h] of bl){
      if(l > e) lines.set(`v${l.toFixed(3)}${t}`, `<b class="ln v" style="left:${pct(l)};top:${pct(t)};height:${pct(h)}"></b>`);
      if(l + w < 1 - e) lines.set(`v${(l + w).toFixed(3)}${t}`, `<b class="ln v" style="left:${pct(l + w)};top:${pct(t)};height:${pct(h)}"></b>`);
      if(t > e) lines.set(`h${t.toFixed(3)}${l}`, `<b class="ln h" style="top:${pct(t)};left:${pct(l)};width:${pct(w)}"></b>`);
      if(t + h < 1 - e) lines.set(`h${(t + h).toFixed(3)}${l}`, `<b class="ln h" style="top:${pct(t + h)};left:${pct(l)};width:${pct(w)}"></b>`);
    }
    return `<span class="excell ruler">${bl.map(([l, t, w, h], i) => `<i style="left:${pct(l)};top:${pct(t)};width:${pct(w)};height:${pct(h)};background:${(overlap ? TINTA : TINT)[i]}"></i>`).join("")}${[...lines.values()].join("")}</span>`;
  }

  /* 多邊形的格子：整格淡藍（外層）、多邊形淡黃（裡面），多邊形的邊畫虛線（貼著格子邊的不畫） */
  function polyHtml(poly){
    const onEdge = (a, b) => [0, 1].some(v => (a[0] === v && b[0] === v) || (a[1] === v && b[1] === v));
    let d = "";
    for(let i = 0; i < poly.length; i++){ const a = poly[i], b = poly[(i + 1) % poly.length]; if(!onEdge(a, b)) d += `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`; }
    return `<span class="excell ruler"><i style="left:0;top:0;width:100%;height:100%;background:${TINT[0]}"></i><svg class="rpoly" viewBox="0 0 1 1" preserveAspectRatio="none"><polygon points="${poly.map(p => p.join(",")).join(" ")}" fill="${TINT[1]}"/><path d="${d}"/></svg></span>`;
  }

  return { blocks, html };
})();
