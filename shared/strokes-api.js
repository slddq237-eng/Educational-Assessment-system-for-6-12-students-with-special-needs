/* =========================================================
   教育部筆畫入口 window.Strokes（2026-11-21 從識字評量 data.js、play.js 和練習簿 index.html 合併出來，兩邊原本各寫一份）
   筆畫資料是 shared/stroke-parts.js 的 STROKE_PARTS（約 5 MB、GitHub Pages 壓縮後傳輸約 1.8 MB，make_ruler.py 產生）：
   字 → b 全部筆畫外框 [x0,y0,x1,y1]、p 每個部件的筆畫外形 SVG 路徑（座標 0～512，y 往下；每一筆以 M 開頭）、o 包圍字的書寫順位、l 部件分組和部件表第一層對得上。
   來源與授權見 docs/materials/stroke-data.md（教育部回信同意：筆畫原樣、只縮放不變形、要標出處、免費無廣告）。
   載入順序：放在用到它的程式之前；網址帶版本號（?v=），筆畫檔用同一個版本號，跟著 docs/scripts/bump.js 一起換。

   Strokes.load(waitMs)：下載筆畫檔（只載一次；載不到不會壞，之後可以再試）；有 waitMs 時最多等這麼久就先往下走
   Strokes.ready()：筆畫檔已經載好了沒
   Strokes.tried：試過了沒（載好、載不到、或等超過 waitMs 都算）；還沒試過時，呼叫的程式可以先當作「載得到」
   Strokes.of(c)：這個字的筆畫資料，沒有就 null
   Strokes.box(d)：一段 SVG 路徑的外框 [x0,y0,x1,y1]
   Strokes.fit(box, ratio, minSide)：把外框等比例縮放到長邊占 ratio、放在 0～1 的格子正中間的 transform（只縮放、不變形）；
     minSide：外框太小時至少當作這麼大（例如單一個點不要被放到滿格）
   Strokes.svg(d, {cls, tf, fill, style, label})：畫一段筆畫（viewBox 0～1）；tf 沒給就用這段筆畫自己的外框、長邊 86%、至少 160
   Strokes.SOURCE：出處文字（教育部《國字標準字體筆順學習網》），用到筆畫的畫面都要標
   ========================================================= */
window.Strokes = (() => {
  const me = document.currentScript;
  const SRC = me && me.src ? new URL("stroke-parts.js" + (me.src.match(/\?v=[^&]*/) || [""])[0], me.src).href : "../../shared/stroke-parts.js";
  const SOURCE = "教育部《國字標準字體筆順學習網》";
  let loading = null, tried = false;
  const ready = () => typeof STROKE_PARTS !== "undefined";   /* 資料檔用 const 宣告，不能從 window 讀，要直接用名稱 */

  function load(waitMs){
    if(ready()) return Promise.resolve();
    loading = loading || new Promise(res => {
      const s = document.createElement("script");
      s.src = SRC;
      s.onload = () => { tried = true; res(); };
      s.onerror = () => { tried = true; loading = null; s.remove(); res(); };   /* 載不到：清掉，下次可以再試 */
      document.head.appendChild(s);
    });
    return waitMs ? Promise.race([loading, new Promise(res => setTimeout(() => { tried = true; res(); }, waitMs))]) : loading;
  }
  const of = c => ready() && STROKE_PARTS[c] || null;

  /* 外框：M 是絕對座標，l、q 是相對座標（q 的控制點也算進去，比實際曲線略大一點，夠用） */
  function box(d){
    let x = 0, y = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (a, b) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b); };
    for(const m of d.matchAll(/([MlqLQz])([^MlqLQz]*)/g)){
      const n = (m[2].match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      if(m[1] === "M"){ x = n[0]; y = n[1]; add(x, y); }
      else if(m[1] === "l"){ x += n[0]; y += n[1]; add(x, y); }
      else if(m[1] === "q"){ add(x + n[0], y + n[1]); x += n[2]; y += n[3]; add(x, y); }
    }
    return [x0, y0, x1, y1];
  }
  function fit([x0, y0, x1, y1], ratio = .88, minSide = 0){
    const k = ratio / Math.max(x1 - x0, y1 - y0, minSide);
    return `matrix(${k} 0 0 ${k} ${.5 - (x0 + x1) / 2 * k} ${.5 - (y0 + y1) / 2 * k})`;
  }
  const attr = s => String(s).replace(/[&<>"]/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[ch]);
  function svg(d, {cls = "", tf = fit(box(d), .86, 160), fill = "", style = "", label = ""} = {}){
    return `<svg class="${cls}" viewBox="0 0 1 1"${style ? ` style="${attr(style)}"` : ""}${label ? ` role="img" aria-label="${attr(label)}"` : ""}><path d="${d}" transform="${tf}"${fill ? ` fill="${fill}"` : ""}/></svg>`;
  }

  return {load, ready, get tried(){ return tried; }, of, box, fit, svg, SOURCE};
})();
