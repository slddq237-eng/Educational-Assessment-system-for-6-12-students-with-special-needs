/* =========================================================
   產生注音文字表 shared/zhuyin.js（docs/scripts/make_zhuyin.js，2026-11-10 加，寫字評量 W1 看注音寫國字用）
   為什麼要另外一張表：shared/bpmf.js 的注音是靠注音字型「畫」在字旁邊，畫面上字和注音一定一起出現；
     看注音寫國字要「只顯示注音、不顯示字」，所以需要注音的文字（例如「ㄈㄥ」）。
   資料來源：ButTaiwan/bpmfvs 的讀音順序表 phonetic/phonic_table_Z.txt（Apache 2.0，和注音字型同一份，
     見 docs/materials/data-sources.md）。讀音的順序和注音字型一樣：第 0 個是預設讀音，第 n 個對應字型的異體字選擇子 n，
     所以 bpmf.js 判斷出的讀音（Bpmf.text、BPMF_CH）可以直接拿來查這張表。
   只收錄課本生字（shared/lessons*.js 每課的 write、read），新增課本後要重新執行。
   用法（在 repo 最上層）：
     1. 下載讀音表（不放進 repo）：https://raw.githubusercontent.com/ButTaiwan/bpmfvs/master/phonetic/phonic_table_Z.txt
     2. node docs/scripts/make_zhuyin.js <phonic_table_Z.txt>
   ========================================================= */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const table = process.argv[2];
if (!table) { console.error('用法：node docs/scripts/make_zhuyin.js <phonic_table_Z.txt>'); process.exit(1); }

/* 讀音順序表：字 → [讀音1, 讀音2, ...]（每行：字、碼位、類別、讀音1、讀音2…，用 tab 分開） */
const Z = {};
for (const line of fs.readFileSync(table, 'utf8').split('\n')) {
  const f = line.replace(/\r$/, '').split('\t');
  if (f.length >= 4) Z[f[0]] = f.slice(3).filter(Boolean);
}

/* 課本生字 */
const src = require('./lessons-src.js')();
const o = {}; new Function(src + ';Object.assign(this,{BOOKS});').call(o);
const chars = new Set();
for (const b of Object.values(o.BOOKS)) for (const L of Object.values(b.lessons)) for (const c of (L.write || '') + (L.read || '')) chars.add(c);

const out = {}, miss = [];
for (const c of [...chars].sort()) { if (Z[c] && Z[c].length) out[c] = Z[c].join('|'); else miss.push(c); }

const head = `/* =========================================================
   注音文字表（自動產生，不要手改；新增課本後請 Claude 重新執行 docs/scripts/make_zhuyin.js）
   寫字評量 W1「看注音寫國字」用：只顯示注音、不顯示字。
   資料來源：ButTaiwan/bpmfvs 讀音順序表 phonic_table_Z.txt（Apache 2.0）；讀音順序和注音字型（shared/fonts/bpmf-kai）一樣，
   第 0 個是預設讀音。多個讀音用「|」分開。這個字在這次題目裡念哪一個音，用 shared/bpmf.js 判斷（見 Zhuyin.of）。
   ========================================================= */
`;
const body = `const ZHUYIN = ${JSON.stringify(out)};
/* 這個字在這個語詞（沒有語詞就用這本課本的讀音）裡的注音文字 */
const Zhuyin = {
  of(c, word, book){
    const rs = (ZHUYIN[c] || "").split("|").filter(Boolean);
    if(!rs.length) return "";
    let n = 0;
    if(word && word.includes(c)){ const m = Bpmf.text(word).match(new RegExp(c + "([\\\\u{E01E0}-\\\\u{E01EF}])?", "u")); n = m && m[1] ? m[1].codePointAt(0) - 0xE01E0 : 0; }
    else n = (BPMF_CH[book] || {})[c] || 0;
    return rs[n] || rs[0];
  }
};
`;
fs.writeFileSync(path.join(root, 'shared', 'zhuyin.js'), head + body);
console.log(`shared/zhuyin.js：${Object.keys(out).length} 個字${miss.length ? `；讀音表裡沒有的 ${miss.length} 個：${miss.join('')}` : ''}`);
