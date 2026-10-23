/*
自動檢查（GitHub Actions 每次發 PR、改 main 都會跑；本機也可以跑：在 repo 最上層執行 node docs/scripts/check.js）
不用安裝任何套件，只要 Node.js。

檢查六件事：
  1. 程式語法：所有 .js 檔和 HTML 裡的 <script>，有沒有打錯字、少括號（有的話網頁會整個壞掉）
  2. 教材資料（shared/lessons.js）：語詞裡有沒有這個字、干擾字有沒有包含答案本身等
  3. 版本號：每個頁面的 ?v= 要一樣（改了 js、css 卻忘了改版本號，老師的瀏覽器會用舊檔）
  4. 學生資料：repo 是公開的，不能有照片、備份檔、作答紀錄
  5. 文件長度：docs/ 裡的說明文件太長時提醒拆分（太長的文件 Claude 一次讀不完、容易讀到過時內容）
  6. 程式地圖：每個 .js 檔都要寫在 docs/architecture.md（沒寫只提醒，不會失敗）

「錯誤」會讓檢查失敗（紅叉），要修好才合併；「提醒」只列出來，不會失敗。
已知、等維護者決定的問題放在 KNOWN，寫明原因；修好後從 KNOWN 拿掉。
*/
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const errors = [], warns = [];
const err = (where, msg) => errors.push(`${where}：${msg}`);
const warn = (where, msg) => warns.push(`${where}：${msg}`);

/* 已知、等決定的教材問題：key＝「課本代號-課次字」 */
const KNOWN = {};

/* repo 裡所有檔案（略過 .git） */
function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name === '.git' || f.name === 'node_modules') continue;
    const p = path.join(dir, f.name);
    f.isDirectory() ? walk(p, out) : out.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
  return out;
}
const files = walk(ROOT);
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- 1. 程式語法 ---------- */
for (const f of files.filter(f => f.endsWith('.js'))) {
  try { new vm.Script(read(f), { filename: f }); } catch (e) { err(f, `程式語法錯誤：${e.message}`); }
}
for (const f of files.filter(f => f.endsWith('.html'))) {
  const html = read(f);
  const re = /<script(?![^>]*\bsrc=)(?![^>]*type="(?!text\/javascript)[^"]*")[^>]*>([\s\S]*?)<\/script>/g;
  let m, n = 0;
  while ((m = re.exec(html))) {
    n++;
    try { new vm.Script(m[1], { filename: `${f}（第 ${n} 段 script）` }); } catch (e) { err(f, `第 ${n} 段 <script> 語法錯誤：${e.message}`); }
  }
}

/* ---------- 2. 教材資料 ---------- */
const han = x => /\p{Script=Han}/u.test(x);
try {
  const ctx = {};
  new Function(['shared/lessons.js', 'shared/parts.js'].map(read).join('\n') +
    ';Object.assign(this,{BOOKS,WORDS,WORDS_ED,SENT,SENT_ED,CONF,CONF_ED})').call(ctx);
  const { BOOKS, WORDS, WORDS_ED, SENT, SENT_ED, CONF, CONF_ED } = ctx;
  let few = 0, fewEx = [];
  for (const b in BOOKS) {
    if (b.includes('-')) err('shared/lessons.js', `課本代號「${b}」不能有「-」（程式用「-」分開課本和課次）`);
    const seen = {};
    for (const n in BOOKS[b].lessons) {
      const L = BOOKS[b].lessons[n];
      const chars = [...[...(L.write || '')].map(c => [c, '習寫']), ...[...(L.read || '')].map(c => [c, '認讀'])].filter(([c]) => han(c));
      for (const [c, kind] of chars) {
        const id = `${b}-${n}${c}`, where = `shared/lessons.js 課本 ${b} 第 ${n} 課「${c}」`;
        if (KNOWN[id]) { warn(where, `已知問題：${KNOWN[id]}`); continue; }
        /* 同一本課本兩課都有：先認讀、後習寫是課本常見安排，不提醒；其他情況（兩次習寫、先習寫後認讀）請對照課本 */
        const prev = seen[c];
        if (prev && prev.n !== n && !(prev.kind === '認讀' && kind === '習寫'))
          warn(where, `第 ${prev.n} 課（${prev.kind}）也有這個字，這課是${kind}，請對照課本確認`);
        if (!prev) seen[c] = { n, kind };
        const w = ((WORDS_ED[b] || {})[c]) || WORDS[c] || '';
        if (!w) err(where, '沒有語詞');
        else if (!w.includes(c)) err(where, `語詞「${w}」裡沒有這個字`);
        else if ([...w].length < 2) err(where, `語詞「${w}」只有一個字（唸題目會變成「${c}的${c}」）`);
        const s = ((SENT_ED[b] || {})[c]) || SENT[c] || '';
        if (s && !s.includes(c)) err(where, `例句裡沒有這個字：${s}`);
        const cf = ((CONF_ED[b] || {})[c]) || CONF[c];
        if (!cf) { err(where, '沒有干擾字資料（同音字、形近字）'); continue; }
        const all = [...(cf[0] || '') + (cf[1] || '')];
        if (all.includes(c)) err(where, '干擾字裡有答案本身');
        const bad = all.filter(x => !han(x) && x.trim());
        if (bad.length) err(where, `干擾字裡有不是國字的符號：${bad.join('')}`);
        if (all.filter(han).length < 2) { few++; if (fewEx.length < 5) fewEx.push(`${b}-${n}${c}`); }
      }
    }
  }
  if (few) warn('shared/lessons.js', `${few} 個字的干擾字少於 2 個，出題時會用課文字補（例如 ${fewEx.join('、')}；候選干擾字在 docs/material-review.xlsx「干擾字候選」頁；怎麼處理見規格書 A3）`);
} catch (e) {
  err('shared/lessons.js', `讀不進來：${e.message}`);
}

/* ---------- 3. 版本號 ---------- */
const vers = {};
for (const f of files.filter(f => f.endsWith('.html'))) {
  for (const m of read(f).matchAll(/\?v=([\w.-]+)/g)) (vers[m[1]] = vers[m[1]] || new Set()).add(f);
}
const vs = Object.keys(vers);
if (vs.length > 1) err('版本號', `頁面的 ?v= 不一樣：${vs.map(v => `${v}（${[...vers[v]].join('、')}）`).join('；')}。改了 js、css 時，所有頁面要改成同一個新版本號`);

/* ---------- 4. 學生資料 ---------- */
const ALLOW_DATA = ['docs/material-review.xlsx', 'docs/parts-table.xlsx'];   /* 教材資料，沒有學生資料 */
for (const f of files) {
  const ext = path.extname(f).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.heic', '.webp', '.bmp', '.mp4', '.mov', '.m4a', '.mp3', '.wav'].includes(ext))
    err(f, '照片、影片、錄音不能放進 repo（可能是學生的）。網站要用的圖片請畫成 SVG，或先告訴維護者');
  else if (['.xlsx', '.xls', '.csv', '.json'].includes(ext) && !ALLOW_DATA.includes(f))
    err(f, '這種檔案可能是作答紀錄、學生名單或備份檔，不能放進 repo。確定是教材資料的話，請加進 docs/scripts/check.js 的 ALLOW_DATA');
  else if (['.js', '.html', '.css', '.md', '.txt', '.py', '.yml', '.svg'].includes(ext)) {
    const t = read(f);
    if (/"kidName"\s*:\s*"[^"]+"/.test(t) || /"app"\s*:\s*"literacy"\s*,\s*"kind"\s*:\s*"(backup|archive)"/.test(t))
      err(f, '看起來有作答紀錄或備份檔的內容（學生資料），不能放進 repo');
  }
}

/* ---------- 5. 文件長度 ---------- */
const DOC_MAX = 10000;   /* 字數；超過就提醒拆成小檔案，並更新 docs/README.md 的索引 */
for (const f of files.filter(f => /^(docs\/[^/]+|CLAUDE)\.md$/.test(f))) {
  const n = [...read(f)].length;
  if (n > DOC_MAX) warn(f, `文件有 ${n} 字，超過 ${DOC_MAX} 字，建議拆成小檔案（見 docs/README.md「寫文件的規則」）`);
}

/* ---------- 6. 程式地圖 ---------- */
/* 新增或改名的 .js 檔要寫進 docs/architecture.md，之後改程式的人才找得到它和誰有關係 */
if (files.includes('docs/architecture.md')) {
  const map = read('docs/architecture.md');
  for (const f of files.filter(f => f.endsWith('.js') && !f.startsWith('shared/vendor/'))) {
    if (!map.includes(path.basename(f))) warn(f, '這個 .js 檔沒有寫在程式地圖 docs/architecture.md，請補上它做什麼、誰會用到');
  }
}

/* ---------- 結果 ---------- */
const gh = !!process.env.GITHUB_ACTIONS;   /* 在 GitHub 上跑時，用 GitHub 看得懂的格式標出來 */
for (const w of warns) console.log(gh ? `::warning::${w}` : `提醒　${w}`);
for (const e of errors) console.log(gh ? `::error::${e}` : `錯誤　${e}`);
console.log(`\n檢查完成：錯誤 ${errors.length} 個、提醒 ${warns.length} 個（檢查了 ${files.length} 個檔案）`);
process.exit(errors.length ? 1 : 0);
