/* =========================================================
   產生破音字讀音表 shared/bpmf-read.js（docs/scripts/make_bpmf_read.js，2026-11-10 加）
   寫字考卷「調整題目」讓老師自己輸入語詞時，破音字要讓老師點選讀音（系統只判斷得出課本裡出現過的語詞）。
   資料來源：ButTaiwan/bpmfvs 的讀音順序表 phonetic/phonic_table_Z.txt（Apache 2.0）；讀音的順序和注音字型一樣，
     第 0 個是預設讀音，第 n 個對應字型的異體字選擇子 n（shared/bpmf.js、shared/fonts/bpmf-*）。
   只收課本生字裡有兩個以上讀音的字，新增課本後要重新執行。
   用法（在 repo 最上層）：
     1. 下載讀音表（不放進 repo）：https://raw.githubusercontent.com/ButTaiwan/bpmfvs/master/phonetic/phonic_table_Z.txt
     2. node docs/scripts/make_bpmf_read.js <phonic_table_Z.txt>
   ========================================================= */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const table = process.argv[2];
if (!table) { console.error('用法：node docs/scripts/make_bpmf_read.js <phonic_table_Z.txt>'); process.exit(1); }
const Z = {};
for (const line of fs.readFileSync(table, 'utf8').split('\n')) {
  const f = line.replace(/\r$/, '').split('\t');
  if (f.length >= 4) Z[f[0]] = f.slice(3).filter(Boolean);
}
const src = require('./lessons-src.js')();
const o = {}; new Function(src + ';Object.assign(this,{BOOKS});').call(o);
const chars = new Set();
for (const b of Object.values(o.BOOKS)) for (const L of Object.values(b.lessons)) for (const c of (L.write || '') + (L.read || '')) chars.add(c);
const out = {};
for (const c of [...chars].sort()) if (Z[c] && Z[c].length > 1) out[c] = Z[c].join('|');
fs.writeFileSync(path.join(root, 'shared', 'bpmf-read.js'), `/* =========================================================
   破音字讀音表（自動產生，不要手改；新增課本後請 Claude 重新執行 docs/scripts/make_bpmf_read.js）
   課本生字裡有兩個以上讀音的字 → 讀音（用「|」分開，第 0 個是預設讀音，順序和注音字型的異體字選擇子一樣）。
   寫字考卷「調整題目」讓老師自己輸入語詞時點選讀音用（tools/literacy/exam.js）。
   資料來源：ButTaiwan/bpmfvs 讀音順序表 phonic_table_Z.txt（Apache 2.0）。
   ========================================================= */
const BPMF_READ = ${JSON.stringify(out)};
`);
console.log(`shared/bpmf-read.js：${Object.keys(out).length} 個破音字`);
