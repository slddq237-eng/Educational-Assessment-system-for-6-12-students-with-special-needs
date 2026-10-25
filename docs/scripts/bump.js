/* =========================================================
   更新版本號（docs/scripts/bump.js，2026-10-24 加）
   用法：在 repo 最上層執行  node docs/scripts/bump.js
   做什麼：把所有網頁（.html）載入 .js、.css 時後面的 ?v= 一次改成同一個新版本號。
     新版本號＝今天的日期（台灣時間），例如 2026-10-25；今天已經改過，就依序加 b、c、d……（2026-10-25b），到 z 之後加數字 z2、z3……。
   為什麼：改了程式或樣式，網頁要換版本號，老師的瀏覽器才不會拿新網頁配舊程式（docs/design/literacy-design.md「檔案版本號」）。
     以前要手動改 7 個網頁，容易漏；現在跑這一行就好。自動檢查（check.js）會擋「各頁版本號不一樣」。
   ========================================================= */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
/* 用 git 列出 repo 裡的網頁（和 check.js 一樣，只看有被追蹤的檔案） */
const pages = execSync('git ls-files "*.html"', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);

/* 現在用的版本號（各頁應該一樣；不一樣就以最多頁用的為準） */
const count = {};
for (const f of pages) for (const m of fs.readFileSync(path.join(root, f), 'utf8').matchAll(/\?v=([\w.-]+)/g)) count[m[1]] = (count[m[1]] || 0) + 1;
const now = Object.keys(count).sort((a, b) => count[b] - count[a])[0] || '';

/* 今天（台灣時間）的日期；今天已經用過，就換下一個字母 */
const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
let next = today;
if (now.startsWith(today)) {
  const tail = now.slice(today.length);                      /* ""、"b"、"c"……"z"、"z2"、"z3"…… */
  const m = tail.match(/^z(\d*)$/);
  /* 字母用完（z）之後改加數字：z → z2 → z3……（2026-10-25 加，原本會停下來要人手動改） */
  const suffix = m ? 'z' + (m[1] ? +m[1] + 1 : 2) : tail ? String.fromCharCode(tail.charCodeAt(0) + 1) : 'b';
  next = today + suffix;
}

let changed = 0;
for (const f of pages) {
  const p = path.join(root, f), s = fs.readFileSync(p, 'utf8');
  const t = s.replace(/\?v=[\w.-]+/g, '?v=' + next);
  if (t !== s) { fs.writeFileSync(p, t); changed++; }
}
console.log(`版本號：${now || '（沒有）'} → ${next}，改了 ${changed} 個網頁`);
