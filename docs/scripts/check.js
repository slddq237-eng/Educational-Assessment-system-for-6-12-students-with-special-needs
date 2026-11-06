/*
自動檢查（GitHub Actions 每次發 PR、改 main 都會跑；本機也可以跑：在 repo 最上層執行 node docs/scripts/check.js）
不用安裝任何套件，只要 Node.js。

檢查十五件事：
  1. 程式語法：所有 .js 檔和 HTML 裡的 <script>，有沒有打錯字、少括號（有的話網頁會整個壞掉）
  2. 教材資料（shared/lessons.js 和各本課本檔 lessons-代號.js）：BOOK_FILES、ALL_LESSON_CHARS 要是最新的（make_lessons.js）；語詞裡有沒有這個字、干擾字有沒有包含答案本身等；
     語詞、例句裡有語音替換詞（shared/bpmf.js 的 BPMF_SAY）但還沒確認過的，提醒確認讀音
  3. 版本號：每個頁面的 ?v= 要一樣（改了 js、css 卻忘了改版本號，老師的瀏覽器會用舊檔）；
     和 main 比，改了網頁的 js、css 卻沒換版本號時提醒（改版本號用 node docs/scripts/bump.js）
  4. 學生資料：repo 是公開的，不能有照片、備份檔、作答紀錄
  5. 文件長度：docs/ 裡的說明文件太長時提醒拆分（太長的文件 Claude 一次讀不完、容易讀到過時內容）；
     CLAUDE.md 每則訊息都會載入，上限另外設得比較小
  6. 程式地圖：每個 .js 檔、每個儲存名稱都要寫在 docs/code/architecture.md（沒寫只提醒）；
  7. 文件裡的指向：docs/ 和 CLAUDE.md 寫的「`檔名`」「`檔名`「某一節」」「`檔名` 第 N 節」要找得到（只提醒）
  8. 大檔案清單：超過 30KB 的程式檔、超過 20KB 的 docs 文件要寫在 CLAUDE.md 的「省 token」清單（Claude 才知道先搜尋、不要整份讀）
  9. 楷書字型缺字：畫面文字、教材裡的字要在楷書字型裡，沒有就提醒跑 make_kai.py
  10. 網頁下載量：每個頁面一打開要下載的程式和樣式（不含字型）超過上限就提醒，避免越來越慢
  11. 對外連線：程式裡新的外部網址要寫進 docs/code/architecture.md 第 7 節（也要更新 privacy.html）
  12. 變更紀錄：docs/changelog/changes/ 的小檔案要有「日期」「動到哪裡」「改了什麼」（只提醒；2026-11-02 起不再新增小檔，只檢查舊檔）
  13. 網頁打得開測試的清單：每個網頁（.html）都要寫在 docs/scripts/smoke.js 的 PAGES，漏了是錯誤
  14. 紀錄匯出欄位：records.js 的 COLS 要和 docs/scripts/records-columns.txt 一致（刪欄位、改名、換順序是錯誤；最後面新增欄位只提醒）
  15. 相容表：docs/design/goal-compat.md 的四張表要和程式的規則一致（data.js 的 GOALS、GOAL_CAPS、ANSWERS、playWhy，play.js 的 PICK_MIN），不一致是錯誤
  8～12 都只提醒（2026-10-24 維護者要求加）
     只有入口檔案可以直接存取 localStorage、indexedDB（其他檔案直接用是錯誤，見 docs/code/refactor.md 規則 1）

「錯誤」會讓檢查失敗（紅叉），要修好才合併；「提醒」只列出來，不會失敗。
已知、等維護者決定的問題放在 KNOWN，寫明原因；修好後從 KNOWN 拿掉。
已知、先不處理的「提醒」放在 KNOWN_WARN（2026-11-06 加）：只顯示一行總數，免得每次都是同樣幾個提醒、新的提醒混在裡面沒人注意。
*/
const fs = require('fs'), path = require('path'), vm = require('vm'), { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const lessonsSrc = require('./lessons-src.js');   /* 課本資料：lessons.js 加上各本課本檔 */
const errors = [], warns = [];
const err = (where, msg) => errors.push(`${where}：${msg}`);
const warn = (where, msg) => warns.push(`${where}：${msg}`);

/* 已知、等決定的教材問題：key＝「課本代號-課次字」 */
const KNOWN = {};
/* 語音替換詞（make_bpmf.py 的 SAY）會換掉語詞、例句裡「所有」出現的地方。
   比替換詞長的語詞或例句，確認裡面那個字的讀音和替換詞一樣，就把整句加進這裡，不再提醒；
   讀音不一樣（例如「不禁止」的禁是ㄐㄧㄣˋ，不能換成「今」）就要改 make_bpmf.py 的 SAY。 */
const SAY_OK = new Set([   /* 2026-10-23 確認：都是同一個意思、同一個讀音 */
  /* 2026-10-23「因為」（ㄧㄣ ㄨㄟˋ，原因）：唸的時候換成「因位」，讀音一樣 */
  '我們約好了去公園玩，卻因為突然下大雨而取消了。',
  '因為他做事情很細心，就比較不會出錯。',
  '這段路因為逆風的關係，對自行車騎士是一大挑戰。',
  '他因為受傷無法承擔家計的事件經報導後，社會各界紛紛給予援助。',
  '因為大家無法同心協力，今年大隊接力的冠軍獎座只能拱手讓人了。',
  '他原本月底要出國旅遊，因為瑣事纏身，所以暫緩計畫。',
  '我們不能因為有一點點成就便驕傲自滿，不思進取。',
  '壁球是利用反彈原理所發展出的運動。',
  '大家都熱情的參與這次活動。',
  '馬偕博士在臺灣創辦了醫院。',
  '過了一個暑假，我長高了，位子被換到最後一排。',
  '旅居國外的他吃到家鄉特有的雞絲飯時，不禁十分感動。',
  '今年暑假，他報名參加許多夏令營活動。',
  '我最期待每年暑假的家庭旅行。',
  '他看著全家的合照，不禁思念住在遠方的爺爺和奶奶。',
  '哥哥已經辦理好註冊手續，暑假過後，就是那所學校的新生。',
  '他上體育課時，不小心跌倒受傷了。',
  '年糕裹上麵粉後油炸，就成為美味可口的點心。',
  '重地街亭失守後，讓諸葛亮陣營元氣大傷。',
  '諸葛亮是三國故事中的傳奇人物，他足智多謀、忠心耿耿，受到後人的景仰。',
  /* 2026-11-06「領子」的領（ㄌㄧㄥˇ）換成「嶺」（ㄌㄧㄥˇ）、「曲項」的曲（ㄑㄩ，彎曲）換成「驅」（ㄑㄩ），讀音一樣 */
  '我的新衣服領子上，有一個可愛的兔子圖樣。',
  '白鵝曲項的姿態真優美。',
]);

/* 已知、先不處理的提醒（2026-11-06 加）：has 裡的文字都出現在提醒裡才算，一定要寫 why（為什麼先不處理）。
   數字寫進 has（字數、KB、字數）：數字變了提醒就會再出現，檔案越來越大才會被注意到；這時更新數字或處理掉。
   清單裡的提醒已經不會出現（修好了或數字變了），會另外提醒從這裡拿掉。 */
const KNOWN_WARN = [
  {has: ['shared/lessons.js：242 個字的干擾字少於 2 個'], why: '等老師在 material-review.xlsx「干擾字候選」頁挑干擾字（pending.md「老師確認」）', since: '2026-11-06'},
  {has: ['docs/history/history-2026-10-24.md：文件有 14071 字'], why: '已封存的歷史檔，新的歷史寫在 history-2026-10-31.md，平常不讀', since: '2026-11-06'},
  {has: ['shared/fonts/tw-kai.css：有 2 個字不在楷書字型裡（戳菱）'], why: '只在老師畫面，缺字時改用電腦的標楷體；重跑 make_kai.py 會讓 33 個字型檔全部重排（約 4MB，老師都要重新下載），等下次新增課本時一起跑', since: '2026-11-06'},
  {has: ['tools/literacy/index.html：打開時要下載 1031KB'], why: '要把部分程式改成用到才載入，屬整理程式（docs/code/refactor.md），還沒排時間', since: '2026-11-06'},
];

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
  /* 課本資料：shared/lessons.js 加上各本課本檔 shared/lessons-代號.js（2026-10-24 拆開，見 lessons-src.js） */
  new Function(lessonsSrc() + '\n' + read('shared/parts.js') +
    ';Object.assign(this,{BOOKS,WORDS,WORDS_ED,SENT,SENT_ED,CONF,CONF_ED,BOOK_FILES,ALL_LESSON_CHARS})').call(ctx);
  const { BOOKS, WORDS, WORDS_ED, SENT, SENT_ED, CONF, CONF_ED, BOOK_FILES, ALL_LESSON_CHARS } = ctx;
  /* 課本檔清單、所有課本的字要是最新的（新增課本後要跑 make_lessons.js） */
  const bookFiles = fs.readdirSync(path.join(ROOT, 'shared')).map(f => (f.match(/^lessons-(\w+)\.js$/) || [])[1]).filter(Boolean);
  const notListed = bookFiles.filter(x => !BOOK_FILES.includes(x));
  if (notListed.length) err('shared/lessons.js', `課本檔 ${notListed.map(x => `lessons-${x}.js`).join('、')} 沒寫在 BOOK_FILES，網頁不會載入：執行 node docs/scripts/make_lessons.js`);
  const allChars = new Set(Object.values(BOOKS).flatMap(bk => Object.values(bk.lessons).flatMap(L => [...(L.write + L.read)])));
  const listed = new Set([...ALL_LESSON_CHARS]);
  if (allChars.size !== listed.size || [...allChars].some(c => !listed.has(c))) err('shared/lessons.js', 'ALL_LESSON_CHARS（所有課本的字）和課本不一致，平板挑「其他字」的範圍會不對：執行 node docs/scripts/make_lessons.js');
  let few = 0, fewEx = [];
  const texts = new Map();   /* 所有語詞、例句 → 第一次出現的位置（給語音替換詞檢查用） */
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
        for (const t of [w, s]) if (t && !texts.has(t)) texts.set(t, where);
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
  const sctx = {};
  new Function(read('shared/bpmf.js') + ';this.SAY=BPMF_SAY').call(sctx);
  for (const [t, where] of texts) for (const [w, [from, to]] of Object.entries(sctx.SAY))
    if (t !== w && t.includes(w) && !SAY_OK.has(t))
      warn(where, `「${t}」裡有語音替換詞「${w}」，唸的時候「${from}」會換成「${to}」；讀音一樣就把這句加進 check.js 的 SAY_OK，不一樣請改 make_bpmf.py 的 SAY`);
  if (few) warn('shared/lessons.js', `${few} 個字的干擾字少於 2 個，出題時會用課文字補（例如 ${fewEx.join('、')}；候選干擾字在 docs/materials/material-review.xlsx「干擾字候選」頁；怎麼處理見規格書 A3）`);
} catch (e) {
  err('shared/lessons.js', `讀不進來：${e.message}`);
}

/* ---------- 3. 版本號 ---------- */
const vers = {};
for (const f of files.filter(f => f.endsWith('.html'))) {
  for (const m of read(f).matchAll(/\?v=([\w.-]+)/g)) (vers[m[1]] = vers[m[1]] || new Set()).add(f);
}
const vs = Object.keys(vers);
if (vs.length > 1) err('版本號', `頁面的 ?v= 不一樣：${vs.map(v => `${v}（${[...vers[v]].join('、')}）`).join('；')}。改了 js、css 時，執行 node docs/scripts/bump.js 一次改好所有頁面`);
/* 和 main 比（2026-10-24 加）：這個分支改了網頁會載入的 js、css，網頁的 ?v= 卻沒換，就提醒。
   要有 main 的紀錄才比得了（GitHub 的自動檢查有抓完整紀錄；本機沒有 origin/main 就跳過） */
try {
  const git = c => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const changed = git('git diff --name-only origin/main...HEAD').split('\n').filter(Boolean);
  const code = changed.filter(f => /\.(js|css)$/.test(f) && /^(shared|tools)\//.test(f) && !f.startsWith('shared/vendor/'));
  if (code.length && !/^\+.*\?v=/m.test(git('git diff origin/main...HEAD -- "*.html"')))
    warn('版本號', `改了 ${code.slice(0, 3).join('、')}${code.length > 3 ? ` 等 ${code.length} 個檔案` : ''}，網頁的 ?v= 還沒換：執行 node docs/scripts/bump.js`);
} catch (e) { /* 沒有 git 或沒有 origin/main：不比 */ }

/* ---------- 4. 學生資料 ---------- */
const ALLOW_DATA = ['docs/materials/material-review.xlsx', 'docs/materials/parts-table.xlsx', 'docs/materials/custom-parts-draft.xlsx', 'docs/materials/mask-fix.json',
  'package.json', 'package-lock.json'];   /* 教材資料，沒有學生資料 */
const ALLOW_IMAGES = ['tools/literacy/img/goal-3.jpg', 'tools/literacy/img/goal-4-1.jpg',
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14].map(n => `tools/literacy/img/guide/g${n}.png`)];   /* 平板教學的 Google 表單操作截圖（2026-11-01 維護者決定放真截圖）；已遮掉帳號頭像、沒有學生資料，逐檔放行 */   /* 選評量目標畫面的遊戲截圖（2026-10-25 維護者要求）；用假資料截的、不套主題背景，已裁掉學生代號和頭像 */
for (const f of files) {
  const ext = path.extname(f).toLowerCase();
  if (ALLOW_IMAGES.includes(f)) continue;
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
const DOC_MAX = 10000;   /* 字數；超過就提醒拆成小檔案，並更新 docs/INDEX.md 的索引 */
const CLAUDE_MAX = 2000;   /* CLAUDE.md 每則訊息都會載入，越短越省（2026-10-24 維護者決定） */
for (const f of files.filter(f => /^(docs\/.+|CLAUDE)\.md$/.test(f))) {
  const n = [...read(f)].length;
  if (f === 'CLAUDE.md' && n > CLAUDE_MAX) warn(f, `CLAUDE.md 有 ${n} 字，超過 ${CLAUDE_MAX} 字（每則訊息都會載入）；詳細規則請寫在 docs/，這裡只留一定要做的事`);
  else if (n > DOC_MAX) warn(f, `文件有 ${n} 字，超過 ${DOC_MAX} 字，建議拆成小檔案（見 docs/INDEX.md「寫文件的規則」）`);
}

/* ---------- 6. 程式地圖 ---------- */
/* 新增或改名的 .js 檔要寫進 docs/code/architecture.md，之後改程式的人才找得到它和誰有關係 */
if (files.includes('docs/code/architecture.md')) {
  /* 程式地圖拆成兩份（2026-10-31）：architecture.md、architecture-literacy.md（識字評量的檔案），一起讀 */
  const map = ['docs/code/architecture.md', 'docs/code/architecture-literacy.md'].filter(f => files.includes(f)).map(read).join('\n');
  for (const f of files.filter(f => f.endsWith('.js') && !f.startsWith('shared/vendor/'))) {
    const name = /^shared\/lessons-\w+\.js$/.test(f) ? 'lessons-代號.js' : path.basename(f);   /* 各本課本檔合寫成一列 */
    if (!map.includes(name)) warn(f, '這個 .js 檔沒有寫在程式地圖 docs/code/architecture.md，請補上它做什麼、誰會用到');
  }
  /* 儲存名稱（literacy-xxx 等）要寫在地圖第 6 節，之後換線上資料庫、做備份時才不會漏 */
  for (const f of files.filter(f => /\.(js|html)$/.test(f) && !f.startsWith('docs/') && !f.startsWith('shared/vendor/'))) {
    for (const m of read(f).matchAll(/["'`]((?:literacy|prep|platform)-[A-Za-z]+)["'`]/g))
      if (!map.includes('`' + m[1] + '`')) warn(f, `儲存名稱「${m[1]}」沒有寫在 docs/code/architecture.md 第 6 節，請補上存什麼、要不要放進備份檔`);
  }
}
/* 存資料一律走入口（docs/code/refactor.md 規則 1）：只有這些檔案可以直接用 localStorage、indexedDB */
const STORAGE_ENTRY = ['tools/literacy/data.js', 'tools/literacy/records.js', 'shared/rewards.js', 'tools/prep/prep.js'];
for (const f of files.filter(f => /\.(js|html)$/.test(f) && !f.startsWith('docs/') && !f.startsWith('shared/vendor/') && !STORAGE_ENTRY.includes(f))) {
  if (/\b(localStorage|sessionStorage|indexedDB)\s*\./.test(read(f)))
    err(f, `直接存取瀏覽器儲存空間。請改用入口（識字評量用 data.js 的 load、store；作答紀錄用 records.js；貼紙頭像用 Rewards），見 docs/code/refactor.md 規則 1`);
}

/* 部件資料一律走入口 window.Parts（shared/parts-api.js；docs/code/refactor.md 規則 1、2，2026-10-31 步驟 3a）：
   其他網頁程式不能直接讀 PARTS、PARTS_A、PARTS_B、PARTS_AUTO、PARTS_LAYERS（資料檔本身、parts-api.js、docs/ 不算；先去掉註解再檢查） */
const PARTS_ENTRY = ['shared/parts-api.js'];
for (const f of files.filter(f => /\.js$/.test(f) && !f.startsWith('docs/') && !f.startsWith('shared/vendor/') && !PARTS_ENTRY.includes(f)
    && !/^shared\/(lessons(-\w+)?|parts|parts-layers)\.js$/.test(f))) {
  const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
  const m = code.match(/\b(PARTS_LAYERS|PARTS_AUTO|PARTS_A|PARTS_B|PARTS)\b/);
  if (m) err(f, `直接讀了部件資料 ${m[1]}。請改用入口 window.Parts（shared/parts-api.js），見 docs/code/refactor.md 規則 1`);
}

/* 識字評量的儲存名稱只寫在 data.js 的 KEYS（docs/code/refactor.md「儲存名稱集中」）：
   用了表裡沒有的 KEYS.xxx（多半是打錯字，老師存的資料會讀不到）報錯；其他檔案自己打 "literacy-xxx" 提醒 */
if (files.includes('tools/literacy/data.js')) {
  const tbl = (read('tools/literacy/data.js').match(/const KEYS = Object\.freeze\(\{([\s\S]*?)\}\);/) || [])[1] || '';
  const keyNames = new Set([...tbl.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(\w+)\s*:/g)].map(m => m[1]));
  for (const f of files.filter(f => /^tools\/literacy\/.*\.(js|html)$/.test(f))) {
    const src = read(f);
    for (const m of src.matchAll(/\bKEYS\.(\w+)/g))
      if (!keyNames.has(m[1])) err(f, `KEYS.${m[1]} 不在 data.js 的儲存名稱表 KEYS 裡（打錯字？）`);
    if (f !== 'tools/literacy/data.js')
      for (const m of src.matchAll(/["'`](literacy-[A-Za-z]+)["'`]/g))
        warn(f, `直接寫了儲存名稱「${m[1]}」，請改用 data.js 的 KEYS（見 docs/code/refactor.md 規則 1）`);
  }
}

/* ---------- 7. 文件裡的指向 ----------
   文件寫「見 `records.md`「某一節」」「`refactor.md` 第 3 節」時，檔案和那一節都要找得到，Claude 照著找才不會撲空
   （2026-10-24 維護者要求：路線圖和文件改了很多次，確定讀的時候不會漏掉）。
   檔名沒寫資料夾時，先找同一個資料夾，再找 docs/、repo 最上層。寫「原列」（已刪掉的舊位置）或「例如」（還沒做的計畫）的那一行不檢查。 */
const findDoc = (from, p) => {
  /* 寫了資料夾但沒寫 docs/（例如 history/history-2026-10-24.md、design/records.md）也算找得到（2026-11-02 加：之前會誤報） */
  if (p.includes('/')) return [p, path.posix.join(path.posix.dirname(from), p), 'docs/' + p].find(x => files.includes(x));
  return [path.posix.join(path.posix.dirname(from), p), 'docs/' + p, p].find(x => files.includes(x)) || files.find(x => x.endsWith('/' + p));
};
/* docs/history/ 是舊說法的存檔，裡面寫到已刪掉的檔案（tour.js、guide.html…）和已刪掉的小節是正常的，不檢查（2026-11-02 加）；
   還在用的文件指向 history 的連結照常檢查 */
for (const f of files.filter(f => /^(docs\/.+|CLAUDE)\.md$/.test(f) && !f.startsWith('docs/history/'))) {
  read(f).split('\n').forEach((line, i) => {
    if (/原列|例如|刪除/.test(line)) return;   /* 「刪除 ○○」說的就是已經不存在的檔案，不用報（2026-11-02 加） */
    const at = `${f} 第 ${i + 1} 行`;
    for (const m of line.matchAll(/`((?:[\w.-]+\/)*[\w.-]+\.(?:md|js|html|py|xlsx|yml|css))`/g))
      if (!/○|\*/.test(m[1]) && !findDoc(f, m[1])) warn(at, `寫到的檔案「${m[1]}」找不到（改名或刪掉了？）`);
    for (const m of line.matchAll(/`((?:[\w.-]+\/)*[\w.-]+\.md)`\s*「([^」]{2,40})」/g)) {
      const t = findDoc(f, m[1]);
      if (t && !read(t).includes(m[2])) warn(at, `「${m[1]}「${m[2]}」」那一節找不到（節名改了或搬走了？）`);
    }
    for (const m of line.matchAll(/`((?:[\w.-]+\/)*[\w.-]+\.md)`\s*第\s*(\d+)\s*節/g)) {
      const t = findDoc(f, m[1]);
      if (t && !new RegExp(`^##\\s*${m[2]}[.、 ]`, 'm').test(read(t))) warn(at, `「${m[1]} 第 ${m[2]} 節」找不到`);
    }
  });
}

/* 程式碼裡的註解拿掉（畫面上不會出現；和 make_kai.py 的 strip_comments 一樣） */
const stripComments = t => t.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
const own = f => !f.startsWith('shared/vendor/') && !f.startsWith('docs/') && !f.startsWith('.github/');

/* ---------- 8. 大檔案清單 ----------
   CLAUDE.md「省 token」要列出超過約 30KB 的檔案，Claude 讀到才會先搜尋、只讀需要的那段 */
const BIG = 30 * 1024;
for (const f of files.filter(f => own(f) && /\.(js|html|css)$/.test(f) && !f.startsWith('shared/fonts/')))
  if (fs.statSync(path.join(ROOT, f)).size > BIG && !read('CLAUDE.md').includes(path.posix.basename(f)))
    warn(f, `超過 30KB（${Math.round(fs.statSync(path.join(ROOT, f)).size / 1024)}KB），請加進 CLAUDE.md「省 token」的大檔案清單`);
/* docs/ 的文件超過約 20KB 也要列出（2026-10-24 維護者決定）；history、changelog 平常不讀，不用列 */
const BIG_DOC = 20 * 1024;
for (const f of files.filter(f => /^docs\/.+\.md$/.test(f) && !/^docs\/(history|changelog)\//.test(f)))
  if (fs.statSync(path.join(ROOT, f)).size > BIG_DOC && !read('CLAUDE.md').includes(path.posix.basename(f)))
    warn(f, `超過 20KB（${Math.round(fs.statSync(path.join(ROOT, f)).size / 1024)}KB），請加進 CLAUDE.md「省 token」的 docs 大檔案清單`);

/* ---------- 遮擋位置的人工調整（tools/literacy/mask-fix.js，2026-10-31） ----------
   MASK_FIX 每個字存「調整當時的第一層部件」；第一層後來被老師改了，遊戲不再套用舊調整（回到預設位置），這裡提醒重新調整。
   格式不對（塊號、數字範圍）是錯誤。資料由 docs/scripts/make_mask_fix.js 產生，來源是 docs/materials/mask-fix.json */
if (files.includes('tools/literacy/mask-fix.js')) {
  try {
    const w = {};
    new Function('window', ['shared/parts.js', 'shared/parts-layers.js', 'shared/parts-api.js'].map(f => read(f)).join('\n') + '\n' + read('tools/literacy/mask-fix.js')
      + ';window.__fix = [MASK_FIX, MASK_GROUP_FIX];')(w);
    const [fix, grp] = w.__fix;
    const okShape = s => Array.isArray(s) && (s.length === 4 || s.length === 5) && s.every(Number.isFinite) && s[2] > s[0] && s[3] > s[1] && s.slice(0, 4).every(v => v > -0.05 && v < 1.05) || (s.length === 5 && s[4] !== 0 && s.slice(0, 4).every(Number.isFinite) && s[2] > s[0] && s[3] > s[1]);
    const stale = [];
    for (const [c, o] of Object.entries(fix)) {
      const r = w.Parts.read(c, { from: 1 });
      if (!r || r.layer !== 1 || r.parts.join(' ') !== o.ps) stale.push(c);
      for (const [k, list] of Object.entries(o)) {
        if (k === 'ps') continue;
        if (!/^[1-9]$/.test(k) || +k > (r ? r.parts.length : 0) || !Array.isArray(list) || !list.length || !list.every(okShape)) err('tools/literacy/mask-fix.js', `「${c}」第 ${k} 塊的資料格式不對`);
      }
    }
    for (const [g, o] of Object.entries(grp)) for (const [k, list] of Object.entries(o)) if (!/^[1-9]$/.test(k) || !list.every(okShape)) err('tools/literacy/mask-fix.js', `整組「${g}」第 ${k} 塊的資料格式不對`);
    if (stale.length) warn('tools/literacy/mask-fix.js', `${stale.length} 個字的第一層部件已經和調整當時不同（${stale.slice(0, 12).join('')}${stale.length > 12 ? '…' : ''}），遊戲會改用預設位置；請用遮擋位置調整工具重新調整後，跑 node docs/scripts/make_mask_fix.js`);
  } catch (e) { err('tools/literacy/mask-fix.js', `載入失敗：${e.message.split('\n')[0]}`); }
}

/* mask-fix.js 要和 mask-fix.json 對得上（2026-10-31）：改了 json（維護者從調整工具下載的結果）卻忘了跑 make_mask_fix.js，遊戲不會更新，這裡擋下來 */
if (files.includes('docs/materials/mask-fix.json') || files.includes('tools/literacy/mask-fix.js')) {
  try {
    if (!files.includes('tools/literacy/mask-fix.js') || !files.includes('docs/materials/mask-fix.json')) err('tools/literacy/mask-fix.js', 'mask-fix.js 和 docs/materials/mask-fix.json 要一起存在（跑 node docs/scripts/make_mask_fix.js 產生）');
    else if (require('./make_mask_fix.js').build().out !== read('tools/literacy/mask-fix.js'))
      err('tools/literacy/mask-fix.js', '和 docs/materials/mask-fix.json 對不上（改了 json 或第一層部件的寫法？），請跑 node docs/scripts/make_mask_fix.js 重新產生，再把 mask-fix.js 一起放進這次的修改');
  } catch (e) { err('tools/literacy/mask-fix.js', `檢查對得上時出錯：${e.message.split('\n')[0]}`); }
}

/* ---------- 9. 楷書字型缺字 ----------
   畫面文字（.html、tools/ 的 .js，不含註解）和教材（lessons.js、parts.js、parts-layers.js）的中文字，要在 shared/fonts/tw-kai.css 的範圍裡；
   沒有的字會變成電腦裡的別種字型。新增頁面文字、課本、部件後跑 make_kai.py 就好 */
const KAI_NOT_IN_FONT = '龶冫勹龰亠龴龵龸龷龹';   /* 全字庫正楷體本來就沒有的部件符號，make_kai.py 會略過（2026-10-24 確認） */
{
  const have = new Set();
  for (const m of read('shared/fonts/tw-kai.css').matchAll(/U\+([0-9A-F]+)(?:-([0-9A-F]+))?/gi)) {
    const a = parseInt(m[1], 16), b = m[2] ? parseInt(m[2], 16) : a;
    for (let c = a; c <= b; c++) have.add(c);
  }
  const text = files.filter(f => own(f) && (/\.html$/.test(f) || /^tools\/.*\.js$/.test(f))).map(f => stripComments(read(f))).join('')
    + lessonsSrc() + read('shared/parts.js') + read('shared/parts-layers.js');
  const miss = [...new Set([...text].filter(c => { const p = c.codePointAt(0); return (p >= 0x3400 && p <= 0x9FFF) && !have.has(p) && !KAI_NOT_IN_FONT.includes(c); }))];
  if (miss.length) warn('shared/fonts/tw-kai.css', `有 ${miss.length} 個字不在楷書字型裡（${miss.slice(0, 20).join('')}${miss.length > 20 ? '…' : ''}），請跑 docs/scripts/make_kai.py`);
}

/* ---------- 10. 網頁下載量 ----------
   每個頁面打開時要下載的 HTML＋程式＋樣式（不壓縮的大小，不含字型、按了才載入的 Excel／QR code 元件）。
   2026-10-24 識字評量約 821KB，上限 1MB；超過時先想想能不能用到才載入 */
const PAGE_MAX = 1024 * 1024;
for (const f of files.filter(f => own(f) && f.endsWith('.html'))) {
  const t = read(f);
  let size = Buffer.byteLength(t);
  for (const m of t.matchAll(/<script[^>]*src="([^"]+)"|<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)) {
    const r = (m[1] || m[2]).split('?')[0];
    if (/^https?:/.test(r)) continue;
    const p = path.posix.normalize(path.posix.join(path.posix.dirname(f), r));
    if (files.includes(p)) size += fs.statSync(path.join(ROOT, p)).size;
  }
  if (size > PAGE_MAX) warn(f, `打開時要下載 ${Math.round(size / 1024)}KB 的程式和樣式，超過 ${PAGE_MAX / 1024}KB；能不能改成用到才載入？`);
}

/* ---------- 11. 對外連線 ----------
   程式（不含註解）和頁面的 script、stylesheet、預先連線裡的外部網址，主機名稱要寫在 docs/code/architecture.md（第 7 節「對外連線」），
   並同步更新 privacy.html；一般的 <a> 連結只是讓人點的，不算。www.w3.org 是 SVG 的固定寫法，不是連線 */
{
  const arch = read('docs/code/architecture.md'), hosts = new Map();
  for (const f of files.filter(f => own(f) && /\.(js|html|css)$/.test(f))) {
    let t = stripComments(read(f));
    if (f.endsWith('.html')) t = t.replace(/<a\b[^>]*>/g, '');
    for (const m of t.matchAll(/https?:\/\/([\w.-]+)/g))
      if (m[1] !== 'www.w3.org' && !arch.includes(m[1])) hosts.set(m[1], f);
  }
  for (const [h, f] of hosts) warn(f, `連到外部網站「${h}」，請寫進 docs/code/architecture.md 第 7 節「對外連線」，並更新 privacy.html`);
}

/* ---------- 12. 變更紀錄 ----------
   2026-10-24～2026-11-02 每個 PR 在 docs/changelog/changes/ 加一個小檔案；2026-11-02 起不再新增（PR 標題就是紀錄，見 docs/changelog/changelog.md「怎麼寫」），這裡只檢查舊檔有沒有該有的欄位 */
for (const f of files.filter(f => /^docs\/changelog\/changes\/\d{4}-\d{2}-\d{2}.*\.md$/.test(f))) {
  const s = read(f), miss = ['日期', '動到哪裡', '改了什麼'].filter(k => !new RegExp(`^- ${k}：\\S`, 'm').test(s));
  if (miss.length) warn(f, `變更紀錄少了「${miss.join('」「')}」：照 docs/changelog/changelog.md「怎麼寫」的格式，每一欄一行，例如「- 日期：2026-10-25」`);
}

/* ---------- 12-2. 決策紀錄 ----------
   2026-11-02 起每個決定一則 docs/decisions/日期-英文短名.md（見 docs/decisions/README.md）；只提醒，不擋 PR */
{
  const DEC_FIELDS = ['日期', '狀態', '決定', '為什麼', '以前怎麼想', '影響範圍', '來源'];
  const DEC_STATUS = /^- 狀態：(有效|已被 .+ 取代|AI 整理，待確認)\s*$/m;
  const idx = files.includes('docs/decisions/README.md') ? read('docs/decisions/README.md') : '';
  for (const f of files.filter(f => /^docs\/decisions\/.+\.md$/.test(f) && f !== 'docs/decisions/README.md')) {
    const s = read(f), name = path.basename(f);
    if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(name)) warn(f, '決策紀錄檔名要是「日期-英文短名.md」，例如 2026-11-02-example-name.md');
    const miss = DEC_FIELDS.filter(k => !new RegExp(`^- ${k}：\\S`, 'm').test(s));
    if (miss.length) warn(f, `決策紀錄少了「${miss.join('」「')}」：照 docs/decisions/README.md 的模板，每一欄一行`);
    else if (!DEC_STATUS.test(s)) warn(f, '決策紀錄的「狀態」只能寫「有效」「已被 ○○ 取代」「AI 整理，待確認」');
    if (!idx.includes(name)) warn(f, '這則決策紀錄沒列進 docs/decisions/README.md 的索引，請加一行（最新的放最上面）');
  }
}

/* ---------- 14. 紀錄匯出欄位 ----------
   匯出 Excel 的欄位（records.js 的 COLS）一旦給老師用，欄位名稱和順序就不能偷偷變（新欄位一律加最後面）。
   docs/scripts/records-columns.txt 是已定案的清單：刪掉、改名、換順序是錯誤；最後面多出新欄位只提醒（2026-11-02 維護者決定加） */
{
  const src = read('tools/literacy/records.js'), a = src.indexOf('const COLS = ['), b = a < 0 ? -1 : src.indexOf('\n];', a);
  if (b < 0) err('tools/literacy/records.js', '找不到 const COLS = [...]，檢查不了匯出欄位（改了 COLS 的寫法？請一起改 docs/scripts/check.js 第 14 項）');
  else {
    const cur = [...src.slice(a, b).matchAll(/\[\s*"([^"]+)"\s*,\s*r\s*=>/g)].map(m => m[1]);
    const saved = read('docs/scripts/records-columns.txt').split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const rec = 'docs/scripts/records-columns.txt', fix = '真的要改，先討論（docs/design/records.md），同一個 PR 一起改 ' + rec;
    const i = saved.findIndex((n, k) => cur[k] !== n);
    if (cur.length < saved.length && i < 0) err('tools/literacy/records.js', `匯出欄位少了「${saved.slice(cur.length).join('」「')}」：舊的欄位不能刪（老師手上的 Excel 會對不上）。${fix}`);
    else if (i >= 0) err('tools/literacy/records.js', `匯出欄位第 ${i + 1} 欄應該是「${saved[i]}」，現在是「${cur[i] || '（沒有）'}」：欄位不能改名或換順序，新欄位只能加在最後面。${fix}`);
    else if (cur.length > saved.length) warn('tools/literacy/records.js', `匯出欄位多了 ${cur.length - saved.length} 個新欄位（${cur.slice(saved.length).join('、')}）：把名稱依序加到 ${rec} 最後面`);
  }
}

/* ---------- 13. 網頁打得開測試的清單 ----------
   smoke.js 只打開 PAGES 裡的頁面；加了新網頁忘了加，那一頁壞掉也不會被抓到（2026-10-24 維護者要求改成自動擋） */
{
  const m = read('docs/scripts/smoke.js').match(/const PAGES = \[([\s\S]*?)\]/);
  const pages = m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : [];
  if (!m) err('docs/scripts/smoke.js', '找不到 const PAGES = [...]，檢查不了網頁清單');
  for (const f of files.filter(f => own(f) && f.endsWith('.html') && !pages.includes(f)))
    err(f, '沒寫在 docs/scripts/smoke.js 的 PAGES，網頁打得開測試不會打開它；請在 PAGES 加一行');
  for (const p of pages.filter(p => !files.includes(p)))
    err('docs/scripts/smoke.js', `PAGES 裡的「${p}」找不到這個檔案，改名或刪掉了請一起改`);
}

/* ---------- 15. 評量目標相容表和程式一致 ----------
   docs/design/goal-compat.md 是給人看的表，規則真正生效的地方是程式（2026-11-06 維護者要求加，免得兩邊各改各的）。
   從程式讀出規則，和表格逐格比對：改了程式忘了改表，或改了表忘了改程式，都會在這裡抓到。 */
{
  const DOC = 'docs/design/goal-compat.md', data = read('tools/literacy/data.js');
  const fix = `請把 ${DOC} 和程式改成一致（想改規則先在 ${DOC} 討論，見該檔第 5 節）`;
  const grab = (src, re, what) => { const m = src.match(re); if (!m) err('tools/literacy/data.js', `找不到 ${what}，檢查不了相容表`); return m; };
  const run = (code, ctx = {}) => vm.runInNewContext(code, ctx);
  try {
    const mG = grab(data, /const GOALS = (\[[\s\S]*?\n\]);/, 'const GOALS = [...]');
    const mC = grab(data, /const GOAL_CAPS = (\{[\s\S]*?\n\});/, 'const GOAL_CAPS = {...}');
    const mA = grab(data, /const ANSWERS = (\[[\s\S]*?\n\]);/, 'const ANSWERS = [...]');
    const mMax = grab(data, /const R6_MAX_PARTS = (\d+)/, 'R6_MAX_PARTS');
    const mFlu = grab(data, /function playWhy[\s\S]*?state\.mode === "flu"\) return "([^"]+)"/, 'playWhy 的流暢性原因');
    const mPick = read('tools/literacy/play.js').match(/const PICK_MIN = (\d+)/);
    if (!mPick) err('tools/literacy/play.js', '找不到 PICK_MIN，檢查不了相容表');
    if (mG && mC && mA && mMax && mFlu && mPick) {
      const GOALS = run(mG[1]), CAPS = run(`(${mC[1]})`, {partsOf: () => null, maskIdxs: () => [], R6_MAX_PARTS: +mMax[1]}), ANS = run(mA[1]);
      const cap = id => CAPS[id] || {};
      /* 表格：依「## N.」分節，每節取第一張表（略過標題列和 |---| 那一列） */
      const sec = n => {
        const m = read(DOC).match(new RegExp(`\\n## ${n}\\.[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`));
        if (!m) { err(DOC, `找不到「## ${n}.」這一節`); return []; }
        return m[1].split('\n').filter(l => l.startsWith('|')).slice(2).map(l => l.split('|').slice(1, -1).map(x => x.trim()));
      };
      const bad = (where, msg) => err(DOC, `第 ${where} 張表：${msg}。${fix}`);
      const no = cell => cell.startsWith('❌');
      const why = cell => (cell.match(/（(.+)）/) || [])[1] || '';
      const idsOf = cell => { const r = cell.match(/^([RW])(\d+)～[RW](\d+)/); if (r) { const out = []; for (let i = +r[2]; i <= +r[3]; i++) out.push(r[1] + i); return out; } return cell.match(/[RW]\d+/g) || []; };
      const one = cell => { const ids = idsOf(cell); return ids.length === 1 ? GOALS.find(g => g.id === ids[0]) : null; };

      /* 第 1 張：目標 × 練習／正式／流暢性 */
      const t1 = sec(1), listed = new Set(t1.flatMap(r => idsOf(r[0])));
      for (const g of GOALS) if (!listed.has(g.id)) bad(1, `沒有 ${g.id}「${g.name}」這個評量目標`);
      for (const r of t1) {
        const g = one(r[0]); if (!g) continue;
        const c = cap(g.id), off = !!g.off;
        if ((r[1] === '🔜') !== off) bad(1, `${g.id} 的狀態寫「${r[1]}」，程式裡是${off ? `還沒開放（${g.off}）` : '已開放'}`);
        if (off) continue;
        const want = [true, c.flu !== false, c.formal !== false, c.formal !== false && c.flu !== false];
        ['練習・正確率', '練習・流暢性', '正式・正確率', '正式・流暢性'].forEach((name, i) => {
          if (no(r[i + 2]) === want[i]) bad(1, `${g.id} 的「${name}」寫「${r[i + 2]}」，程式裡是${want[i] ? '可以' : '不行'}`);
        });
        if (r[6].includes('部件') !== !!c.partsAnswer) bad(1, `${g.id} 的「答案是」寫「${r[6]}」，程式裡答案${c.partsAnswer ? '是部件' : '不是部件'}（partsAnswer）`);
      }

      /* 第 2 張：不適用的提示、聽音選部件的數字 */
      const HINT = {parts: '部件', mask: '遮字', pic: '圖片', word: '語詞', sent: '句子'};
      for (const r of sec(2)) {
        const g = one(r[0]); if (!g || g.off) continue;
        const doc = r[3] === '無' ? [] : r[3].split('、').map(x => x.replace(/（.*$/, '').trim());
        const code = Object.keys(cap(g.id).hintUnfit || {}).map(k => HINT[k] || k);
        if (doc.slice().sort().join() !== code.slice().sort().join()) bad(2, `${g.id} 不適用的提示寫「${doc.join('、') || '無'}」，程式裡（GOAL_CAPS 的 hintUnfit）是「${code.join('、') || '無'}」`);
        if (g.id === 'R6') {
          const mx = r[1].match(/超過 (\d+) 個/), mn = r[2].match(/至少 (\d+) 個/);
          if (!mx || +mx[1] !== +mMax[1]) bad(2, `R6 不出題的部件數寫「${r[1]}」，程式裡是超過 ${mMax[1]} 個（data.js 的 R6_MAX_PARTS）`);
          if (!mn || +mn[1] !== +mPick[1]) bad(2, `R6 的選項寫「${r[2]}」，程式裡是至少 ${mPick[1]} 個（play.js 的 PICK_MIN）`);
        }
      }

      /* 第 3 張：目標 × 玩法（賓果的限制、流暢性的原因） */
      for (const r of sec(3)) {
        const g = one(r[0]);
        if (g && !g.off) {
          const nb = cap(g.id).noBingo || '';
          if (no(r[3]) !== !!nb) bad(3, `${g.id} 的賓果寫「${r[3]}」，程式裡${nb ? `不行（${nb}）` : '可以'}`);
          else if (nb && why(r[3]) !== nb) bad(3, `${g.id} 不能玩賓果的原因寫「${why(r[3])}」，畫面上寫的是「${nb}」`);
        }
        if (r[0].includes('流暢性')) for (const i of [2, 3])
          if (!no(r[i]) || why(r[i]) !== mFlu[1]) bad(3, `流暢性那一列寫「${r[i]}」，程式裡是不行（${mFlu[1]}）`);
      }

      /* 第 4 張：作答方式的人數、有沒有開放 */
      const t4 = sec(4);
      for (const a of ANS) {
        const r = t4.find(x => x[0] === a.name);
        if (!r) { bad(4, `沒有「${a.name}」這個作答方式`); continue; }
        const range = r[1].match(/(\d+)～(\d+) 位/), atLeast = r[1].match(/(\d+) 位以上/);
        const okN = range ? +range[1] === a.min && +range[2] === a.max : atLeast ? +atLeast[1] === a.min : false;
        if (!okN) bad(4, `「${a.name}」的人數寫「${r[1]}」，程式裡是 ${a.min}～${a.max} 位`);
        if (r.slice(2).every(x => x === '🔜') !== !!a.off) bad(4, `「${a.name}」寫${a.off ? '已開放' : '還沒開放'}，程式裡是${a.off ? `還沒開放（${a.off}）` : '已開放'}`);
      }
      for (const r of t4) if (!ANS.some(a => a.name === r[0])) bad(4, `「${r[0]}」在程式的 ANSWERS 裡找不到（改名或拿掉了嗎？）`);
    }
  } catch (e) { err(DOC, `比對相容表時程式出錯：${e.message}`); }
}

/* ---------- 結果 ---------- */
const gh = !!process.env.GITHUB_ACTIONS;   /* 在 GitHub 上跑時，用 GitHub 看得懂的格式標出來 */
const knownOf = w => KNOWN_WARN.find(k => k.has.every(t => w.includes(t)));
const quiet = warns.filter(knownOf), shown = warns.filter(w => !knownOf(w));
/* 清單本身的檢查放在分類之後：這些提醒裡引用了清單的文字，不能被清單自己藏起來 */
for (const k of KNOWN_WARN) {
  if (!k.why) err('docs/scripts/check.js', `KNOWN_WARN 的「${k.has[0]}」沒寫 why（為什麼先不處理）`);
  if (!quiet.some(w => k.has.every(t => w.includes(t)))) shown.push(`docs/scripts/check.js：KNOWN_WARN 的「${k.has[0]}」已經不會出現了（修好了或數字變了），從 KNOWN_WARN 拿掉，或更新數字`);
}
for (const w of shown) console.log(gh ? `::warning::${w}` : `提醒　${w}`);
for (const e of errors) console.log(gh ? `::error::${e}` : `錯誤　${e}`);
console.log(`\n檢查完成：錯誤 ${errors.length} 個、提醒 ${shown.length} 個（檢查了 ${files.length} 個檔案）`);
if (quiet.length) console.log(`另有 ${quiet.length} 個已知、先不處理的提醒沒有列出（原因寫在 docs/scripts/check.js 的 KNOWN_WARN）`);
process.exit(errors.length ? 1 : 0);
