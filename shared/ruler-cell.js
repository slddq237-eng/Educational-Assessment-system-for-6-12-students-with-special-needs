/* =========================================================
   字形尺格子（2026-11-12 從 tools/literacy/exam.js 搬來，寫字考卷和之後的練習簿共用）
   RulerCell.html(字, {ruler})：回傳一個格子的 HTML。ruler 為真且字是左右、上下、左中右、上中下或包圍結構時，
     畫虛線分區加淡色底（字形尺）；否則畫十字格。樣式在 shared/ruler-cell.css，格子邊長由頁面設定 --cell。
   RulerCell.blocks(字, ruler)：只回傳分區，每塊是 [left, top, width, height]（0～1，格子的比例）；沒有分區回傳 null。
   分線位置照 shared/ruler.js 的 RULER（主要用教育部筆畫資料算，2026-11-14）；左右、上下、左中右、上中下的字表裡沒有（不確定、不收）就不畫字型尺，畫十字格。
   需要先載入 shared/parts-api.js（Parts.struct 判斷結構）和 shared/ruler.js；沒載入時一律畫十字格。
   ========================================================= */
const RulerCell = (() => {
  const TINT = ["#eef5fc", "#fdf8e6", "#eef8f0"];   /* 淡藍、淡黃、淡綠（2026-11-10 維護者要求再淺一點；用很淡的不透明色，包圍字裡面那一塊才不會和外框疊成別的顏色） */

  function blocks(c, ruler){
    /* 每一塊是 [left, top, width, height]（0～1，格子的比例）；線畫在塊和塊的交界 */
    const s = ruler && typeof Parts !== "undefined" ? Parts.struct(c) : "";
    const inner = (l, t) => [[0, 0, 1, 1], [l, t, .62, .62]];   /* 包圍：外框一塊、裡面一塊 */
    /* 分線照字的比例（shared/ruler.js，主要用教育部筆畫資料算，2026-11-14）；左右、上下、左中右、上中下的字表裡沒有就不畫字型尺 */
    const r = typeof RULER !== "undefined" && RULER[c];
    /* 左右、上下、左中右、上中下：表裡沒有這個字的分線（不確定、不收）就不畫字型尺，用十字格（寧可不分，也不要分錯；2026-11-14 維護者決定） */
    const need = {"左右": 1, "上下": 1, "左中右": 2, "上中下": 2}[s];
    if(need && !(r && r.length === need)) return null;
    const cut = (n, def) => r && r.length === n ? r : def;
    const cols = ([a, b]) => b === undefined ? [[0, 0, a, 1], [a, 0, 1 - a, 1]] : [[0, 0, a, 1], [a, 0, b - a, 1], [b, 0, 1 - b, 1]];
    const rows = ([a, b]) => b === undefined ? [[0, 0, 1, a], [0, a, 1, 1 - a]] : [[0, 0, 1, a], [0, a, 1, b - a], [0, b, 1, 1 - b]];
    return ({
      "左右": cols(cut(1, [.5])),
      "上下": rows(cut(1, [.5])),
      "左中右": cols(cut(2, [1 / 3, 2 / 3])),
      "上中下": rows(cut(2, [1 / 3, 2 / 3])),
      "全包圍": inner(.19, .19),
      "上方包圍": inner(.19, .38),
      "下方包圍": inner(.19, 0),
      "左方包圍": inner(.38, .19),
      "左上包圍": inner(.38, .38),
      "左下包圍": inner(.38, 0),
      "右上包圍": inner(0, .38)
    })[s] || null;
  }

  function html(c, opt){
    const bl = blocks(c, !!(opt && opt.ruler));
    if(!bl) return `<span class="excell cross"></span>`;
    const pct = x => (x * 100).toFixed(2) + "%";
    /* 淡色底不畫框；分線只畫在格子裡面（每條畫一次），外框和十字格一樣是黑色實線（2026-11-10 修正：原本每塊都有虛線框，貼在外框內側，外框看起來像不見了） */
    const lines = new Map(), e = 1e-6;
    for(const [l, t, w, h] of bl){
      if(l > e) lines.set(`v${l.toFixed(3)}${t}`, `<b class="ln v" style="left:${pct(l)};top:${pct(t)};height:${pct(h)}"></b>`);
      if(l + w < 1 - e) lines.set(`v${(l + w).toFixed(3)}${t}`, `<b class="ln v" style="left:${pct(l + w)};top:${pct(t)};height:${pct(h)}"></b>`);
      if(t > e) lines.set(`h${t.toFixed(3)}${l}`, `<b class="ln h" style="top:${pct(t)};left:${pct(l)};width:${pct(w)}"></b>`);
      if(t + h < 1 - e) lines.set(`h${(t + h).toFixed(3)}${l}`, `<b class="ln h" style="top:${pct(t + h)};left:${pct(l)};width:${pct(w)}"></b>`);
    }
    return `<span class="excell ruler">${bl.map(([l, t, w, h], i) => `<i style="left:${pct(l)};top:${pct(t)};width:${pct(w)};height:${pct(h)};background:${TINT[i]}"></i>`).join("")}${[...lines.values()].join("")}</span>`;
  }

  return { blocks, html };
})();
