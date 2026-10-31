/* =========================================================
   遮擋位置資料產生器（docs/scripts/make_mask_fix.js，2026-10-31 新增）
   用法：在 repo 最上層執行  node docs/scripts/make_mask_fix.js
   做什麼：讀 docs/materials/mask-fix.json（維護者用「遮擋位置調整工具」調好、下載的結果），
     寫出 tools/literacy/mask-fix.js（網頁真正載入的資料）。
   每個字另外存「調整當時的第一層部件」（ps，例如「口 乎」）：遊戲和 check.js 發現這個字的第一層後來變了，
     就不套用舊的調整（回到預設位置）並提醒重新調整，避免老師改了拆法後，遮擋悄悄蓋錯地方。
   JSON 格式（工具下載的結果）：{組規則:{分組:{塊號:[[左,上,右,下,旋轉角度],…]}}, 個別字:{字:{塊號:[[…],…]}}}，
     數字是占字格的比例（0～1），旋轉單位是度（順時針為正，繞色塊中心）；分組名稱的寫法見 data.js 的 maskGroup。
   ========================================================= */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/materials/mask-fix.json'), 'utf8'));
const w = {};
new Function('window', ['shared/parts.js', 'shared/parts-layers.js', 'shared/parts-api.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n'))(w);
const num = x => Math.round(x * 100) / 100;
const shapes = list => list.map(s => { const a = s.slice(0, 4).map(num); return s[4] ? [...a, Math.round(s[4])] : a; });
const fmt = o => JSON.stringify(o).replace(/"(\d)":/g, '$1:');
const fix = {}, skipped = [];
for (const [c, o] of Object.entries(src['個別字'] || {})) {
  const r = w.Parts.read(c, { from: 1 });
  if (!r || r.layer !== 1) { skipped.push(`${c}（現在沒有第一層）`); continue; }
  fix[c] = { ps: r.parts.join(' ') };
  for (const [k, list] of Object.entries(o)) fix[c][k] = shapes(list);
}
const grp = {};
for (const [g, o] of Object.entries(src['組規則'] || {})) { grp[g] = {}; for (const [k, list] of Object.entries(o)) grp[g][k] = shapes(list); }
const out = `/* 遮擋位置的人工調整（聽音補部件 R5 用；本檔由 docs/scripts/make_mask_fix.js 從 docs/materials/mask-fix.json 產生，請不要手改）。
   MASK_FIX：個別字 → {ps：調整當時的第一層部件, 塊號：[[左,上,右,下,旋轉角度], …]}；沒寫旋轉角度＝0；一個部件可以有好幾個色塊。數字是占字格的比例。
   MASK_GROUP_FIX：整組字共用的調整（分組名稱見 data.js 的 maskGroup）。優先順序：個別字（第一層沒變才用）→ 整組 → 預設位置（data.js 的 maskBox）。 */
const MASK_FIX = {
${Object.entries(fix).map(([c, o]) => `"${c}":${fmt(o)}`).join(',\n')}
};
const MASK_GROUP_FIX = ${fmt(grp)};
`;
fs.writeFileSync(path.join(ROOT, 'tools/literacy/mask-fix.js'), out);
console.log(`個別字 ${Object.keys(fix).length} 個、整組規則 ${Object.keys(grp).length} 條，寫出 tools/literacy/mask-fix.js（${Math.round(out.length / 1024)}KB）${skipped.length ? '；略過：' + skipped.join('、') : ''}`);
