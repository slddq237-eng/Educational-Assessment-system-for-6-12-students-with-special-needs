/* =========================================================
   讀全部課本資料的原始碼（docs/scripts/lessons-src.js，2026-10-24 加）
   shared/lessons.js 拆成「共用部分＋每本課本一個 shared/lessons-代號.js」之後，
   產生字型、部件、檢查用的小程式要把它們接起來一起讀：require("./docs/scripts/lessons-src.js")() 回傳接好的原始碼。
   順序照 lessons.js 的 BOOK_FILES，和網頁載入的順序一樣。
   ========================================================= */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
module.exports = function lessonsSource(){
  const head = fs.readFileSync(path.join(root, 'shared', 'lessons.js'), 'utf8');
  const m = head.match(/^const BOOK_FILES = (\[[^\]]*\]);/m);
  const files = m ? JSON.parse(m[1]) : [];
  return [head, ...files.map(b => fs.readFileSync(path.join(root, 'shared', `lessons-${b}.js`), 'utf8'))].join('\n');
};
