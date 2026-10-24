/* =========================================================
   更新課本清單（docs/scripts/make_lessons.js，2026-10-24 加）
   用法：在 repo 最上層執行  node docs/scripts/make_lessons.js
   什麼時候跑：新增或刪除 shared/lessons-代號.js、改了課本的生字之後（自動檢查會提醒）。
   做什麼：更新 shared/lessons.js 最後的兩行——
     BOOK_FILES：有哪些課本檔要載入（原本的順序不變，新的檔案接在後面）；
     ALL_LESSON_CHARS：所有課本的字（不重複），干擾字不夠時挑「其他字」用，平板沒載入全部課本也能用同一份。
   ========================================================= */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const file = path.join(root, 'shared', 'lessons.js');
let head = fs.readFileSync(file, 'utf8');

/* 1. BOOK_FILES：保留原本順序，加上新檔、拿掉已經不在的檔 */
const old = JSON.parse(head.match(/^const BOOK_FILES = (\[[^\]]*\]);/m)[1]);
const have = fs.readdirSync(path.join(root, 'shared')).map(f => (f.match(/^lessons-(\w+)\.js$/) || [])[1]).filter(Boolean);
const files = [...old.filter(b => have.includes(b)), ...have.filter(b => !old.includes(b)).sort()];
head = head.replace(/^const BOOK_FILES = \[[^\]]*\];/m, `const BOOK_FILES = ${JSON.stringify(files).replace(/,/g, ', ')};`);
fs.writeFileSync(file, head);

/* 2. ALL_LESSON_CHARS：照 BOOK_ORDER（shared/common.js）的順序把每課的字接起來、去掉重複 */
const src = require('./lessons-src.js')() + '\n' + fs.readFileSync(path.join(root, 'shared', 'common.js'), 'utf8');
const chars = new Function('document', src + ';return [...new Set(BOOK_ORDER.flatMap(b => Object.values(BOOKS[b].lessons).flatMap(L => [...(L.write + L.read)])))].join("");')({currentScript: null});   /* common.js 會用到 document，給一個空的 */
head = head.replace(/^const ALL_LESSON_CHARS = ".*";$/m, `const ALL_LESSON_CHARS = ${JSON.stringify(chars)};`);
fs.writeFileSync(file, head);
console.log(`課本檔 ${files.length} 個：${files.join('、')}；所有課本的字 ${[...chars].length} 個`);
