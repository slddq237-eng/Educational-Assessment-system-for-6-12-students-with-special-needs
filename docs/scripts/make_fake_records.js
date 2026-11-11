/* =========================================================
   假資料產生器（docs/scripts/make_fake_records.js，2026-11-11）
   用法：node docs/scripts/make_fake_records.js 輸出檔.json
     輸出的是平台「備份檔」格式（和右上角選單「下載備份檔」存出來的一樣），用「匯入檔案」就能載入。
     要先有 Playwright（自動操作瀏覽器的工具），做法同 docs/scripts/smoke.js。
   做什麼：在自己電腦開一個小網站，打開識字評量，用平台**自己的出題函式**（makeOptions、makePartsOptions、makeFillOptions、
     makePartsPickOptions）組選項，所以干擾字、干擾部件的組成和真實作答一樣；再依下面 8 位假學生的作答習慣模擬作答。
     亂數用固定種子，每次產生的資料都一樣。
   為什麼：老師專區要有夠多的紀錄才看得出分析合不合理（錯誤類型要錯十幾二十題以上才可能顯著），真實資料不夠時用這份。
   注意：全部是假的。學生名字是「假學生甲～壬」、代號 X01～X09，沒有任何真實學生資料。
         **載入到自己平常用的瀏覽器會和真實紀錄混在一起**，請用私人（無痕）視窗載入，關掉視窗資料就消失，不會動到真實紀錄。
   9 位學生的「標準答案」（寫在這裡，檔案裡沒有；用來對照老師專區的判讀對不對）：
     X01 甲：聽音選字，錯的時候多半選同詞易混字（把語詞整塊記、字沒分出來）；只做聽音選字
     X02 乙：聽音選字，錯的時候有點偏向同音字（偏向不強，用來看「差一點才顯著」）；9/15 以前的聽音選字紀錄用舊代號 3（測舊紀錄會不會算進聽音選字）
     X03 丙：聽音選字多半選形近字；部件重組多半選同部件字
     X04 丁：亂猜型：聽音選字、聽音補部件、聽音選部件全部隨機點
     X05 戊：學得好：聽音選字正確率約九成（錯的題數太少，看不出類型）；聽音選部件幾乎全對；有計時挑戰
     X06 己：聽音選字普通；聽音補部件、聽音選部件是「忘記部件」（漏選答案部件、選錯時沒有固定的干擾部件）
     X07 庚：聽音補部件、聽音選部件是「被干擾」（答案都選到，另外多選同一個最常出現的干擾部件）；聽音選字沒做
     X08 辛：只做過部件重組，同部件和形近各半（個人頁會顯示「還沒有聽音選字的作答紀錄」）
     X09 壬：剛開始用：只做了第 1 課的聽音選字前測、幾次練習和一次後測，錯的題數很少（看「題數不夠、再累積約 N 題」的提示）
   ========================================================= */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = process.argv[2];
if (!OUT) { console.error('用法：node docs/scripts/make_fake_records.js 輸出檔.json'); process.exit(1); }
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  try { res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(fs.readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});

/* 在網頁裡執行：用平台的函式出題、模擬作答，回傳 {kids, teach, records} */
function generate(seed) {
  let s = seed >>> 0;
  const rng = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const normal = () => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());
  const pick = a => a[Math.floor(rng() * a.length)];
  const wpick = (items, w) => { const tot = w.reduce((a, b) => a + b, 0); let r = rng() * tot; for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; };
  const hash = str => { let h = 7; for (const ch of str) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
  const savedRandom = Math.random; Math.random = rng;   /* 平台出題用 Math.random，換成固定種子的 */
  const BOOK = '2';
  const LESSONS = { 1: { teach: ['2026-09-08', '2026-09-18'], pre: '2026-09-07', practice: ['2026-09-09', '2026-09-11', '2026-09-14', '2026-09-16'], post: ['2026-09-21', '2026-10-05', '2026-11-02'] },
    2: { teach: ['2026-09-22', '2026-10-02'], pre: '2026-09-21', practice: ['2026-09-23', '2026-09-25', '2026-09-28', '2026-09-30'], post: ['2026-10-05', '2026-11-02'] },
    3: { teach: ['2026-10-06', '2026-10-16'], pre: '2026-10-05', practice: ['2026-10-07', '2026-10-09', '2026-10-12', '2026-10-14'], post: ['2026-10-19', '2026-11-02'] } };
  const kids = [], teach = {}, records = [];
  const NAMES = '甲乙丙丁戊己庚辛壬';
  const diffDays = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
  for (const [n, L] of Object.entries(LESSONS)) teach[key(BOOK, n)] = { type: 'dates', start: L.teach[0], end: L.teach[1] };

  /* 8 位學生的作答習慣。acc＝[教學前, 教學後]的聽音選字正確率；pref＝答錯時各類干擾字的相對被選到機會；goals＝做哪些目標 */
  const P = [
    { acc: [0.50, 0.78], pref: { 同詞易混: 7, 同音: 1, 形近: 1, 課文字: 1, 其他字: 1 }, goals: ['R3'] },
    { acc: [0.55, 0.80], pref: { 同詞易混: 1, 同音: 3, 形近: 1, 課文字: 1, 其他字: 1 }, goals: ['R3'], legacyFirst: true },
    { acc: [0.55, 0.78], pref: { 同詞易混: 1, 同音: 1, 形近: 7, 課文字: 1, 其他字: 1 }, goals: ['R3', 'R4'], r4: { 形近: 1, 同部件: 6, 課文字: 1, 其他字: 1 }, r4acc: [0.45, 0.72] },
    { acc: [0.25, 0.30], pref: {}, goals: ['R3', 'R5', 'R6'], r4: {}, r5: 'guess', r6: 'guess' },
    { acc: [0.88, 0.95], pref: { 同詞易混: 1, 同音: 1, 形近: 1, 課文字: 1, 其他字: 1 }, goals: ['R3', 'R6'], r6: 'good', flu: true },
    { acc: [0.62, 0.78], pref: { 同詞易混: 1, 同音: 1, 形近: 1, 課文字: 1, 其他字: 1 }, goals: ['R3', 'R5', 'R6'], r5: 'forget', r6: 'forget' },
    { acc: [0.5, 0.5], pref: {}, goals: ['R5', 'R6'], r5: 'disturb', r6: 'disturb' },
    { acc: [0.5, 0.5], pref: {}, goals: ['R4'], r4: { 形近: 3, 同部件: 3, 課文字: 1, 其他字: 1 }, r4acc: [0.40, 0.65] },
    { acc: [0.45, 0.62], pref: { 同詞易混: 2, 同音: 2, 形近: 2, 課文字: 1, 其他字: 1 }, goals: ['R3'], light: true },
  ];
  /* 「被干擾」的學生固定被同一個部件吸走：先數所有題目的選項，找出最常出現的干擾部件（聽音補部件、聽音選部件各一個） */
  const topDistractor = make => { const cnt = {}; for (const n of Object.keys(LESSONS)) for (const c of charsOf(key(BOOK, n))) { const r = make(c, key(BOOK, n)); if (!r) continue; r.filter(o => o.type !== '答案').forEach(o => cnt[o.ch] = (cnt[o.ch] || 0) + 1); } return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0]; };
  const R5FAV = topDistractor((c, k) => { const ix = maskIdxs(c); return ix.length && !goalSkips(c, 'R5') ? makeFillOptions(c, k, ix[0]) : null; });
  const R6FAV = topDistractor((c, k) => goalSkips(c, 'R6') ? null : makePartsPickOptions(c, k));
  const charDiff = {};   /* 每個字固定的難度（有的字特別容易錯） */
  const diffOf = c => charDiff[c] = charDiff[c] ?? normal() * 0.12;
  const pet = {};         /* 每位學生對某些字固定搞混成同一個干擾字（同一個字重複錯成同一個，測「題目不獨立」） */

  const base = (kid, g, n, day, idx, kind, extra) => ({
    fmt: RECORD_FORMAT, device: '電腦', kid: kid.code, kidName: kid.name, grade: kidGrade(kid), studyGrade: kidGrade(kid), kind, goal: g, mode: 'acc', answer: 'turn', method: 'even', timeLimit: '',
    book: BOOK, bookName: bookName(BOOK), lesson: n, boost: false, passed: true, revealed: false, hintLevel: 0, hints: '', teacherPrompt: '',
    planId: '', planVer: '', rphase: '', hintSet: kind === 'formal' ? '' : 'word,parts', rule: kind === 'formal' ? 'none' : 'next,next,free', layout: 'cards', theme: '', game: false, gameType: '', reward: '', rewardCode: '',
    bpmf: false, read: false, readUsed: '', fontScale: '1', rate: 0.85, sfx: true, clock: false, ...extra });

  function runSession(kid, prof, g, n, day, kind, prepost, count, mode) {
    const k = key(BOOK, n), chars = charsOf(k).filter(c => !goalSkips(c, g));
    if (!chars.length) return;
    const prog = prepost === '前測' ? 0 : prepost === '後測' ? 1 : 0.3 + rng() * 0.5;
    const accR = g === 'R4' ? (prof.r4acc || [0.45, 0.7]) : prof.acc;
    let pc = accR[0] + (accR[1] - accR[0]) * prog + (kind === 'practice' ? 0.08 : 0);
    const items = []; const pool = [...chars];
    for (let i = 0; i < count; i++) { if (!pool.length) pool.push(...chars); items.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]); }
    const sid = `${kid.code}-${day}-${g}-${prepost || kind}-${mode}`;
    let t0 = new Date(`${day}T${prepost ? '09' : '13'}:00:00+08:00`).getTime() + Math.floor(rng() * 900) * 1000;
    const dAfter = (() => { const d = diffDays(LESSONS[n].teach[1], day); return d < 0 ? '' : d; })();
    const word = c => wordOf(c, BOOK);
    items.forEach((c, i) => {
      const nOpts = g === 'R3' && kind === 'practice' && rng() < 0.2 ? 6 : 4;
      const speed = Math.exp(Math.log(g === 'R3' ? 2.2 : g === 'R4' ? 3.6 : g === 'R5' ? 3.4 : 6.5) + 0.35 * normal()) * (1 - 0.15 * prog) * Math.exp(diffOf(c) * 1.2);
      const firstSec = Math.round(Math.max(0.8, speed) * 10) / 10;
      let rec;
      if (g === 'R3' || g === 'R4') {
        const opts = g === 'R3' ? makeOptions(c, k, nOpts) : makePartsOptions(c, k, nOpts);
        const ans = opts.find(o => o.type === '答案'), dis = opts.filter(o => o.type !== '答案');
        const ok = rng() < Math.min(0.98, Math.max(0.02, pc - diffOf(c)));
        const pref = g === 'R3' ? prof.pref : prof.r4;
        const pk = kid.code + c; if (pet[pk] === undefined) pet[pk] = rng() < 0.4 ? hash(pk) % 3 : -1;
        let pickO = ans;
        if (!ok && dis.length) {
          const petO = pet[pk] >= 0 ? [...dis].sort((a, b) => a.ch.codePointAt(0) - b.ch.codePointAt(0))[pet[pk] % dis.length] : null;
          pickO = petO && rng() < 0.45 ? petO : wpick(dis, dis.map(o => (pref && pref[o.type]) || 1));
        }
        const wrong = ok ? 0 : 1 + (kind === 'practice' && rng() < 0.3 ? 1 : 0);
        rec = base(kid, g, n, day, i, kind, { char: c, word: word(c), choices: opts.length, options: opts.map(o => o.ch).join(''), firstPick: pickO.ch, firstCorrect: ok, errorType: ok ? '' : pickO.type,
          wrongCount: wrong, crossed: wrong, firstSec, correctSec: Math.round((firstSec + wrong * (1 + rng() * 2)) * 10) / 10 });
      } else if (g === 'R5') {
        const idxs = maskIdxs(c); if (!idxs.length) return;
        const idx = pick(idxs), opts = makeFillOptions(c, k, idx), ans = opts.find(o => o.type === '答案'), dis = opts.filter(o => o.type !== '答案');
        const beh = prof.r5; let ok, pickO = ans;
        if (beh === 'guess') { pickO = pick(opts); ok = pickO === ans; }
        else { ok = rng() < (beh === 'disturb' ? 0.55 : 0.45); if (!ok) { const fav = dis.find(o => o.ch === R5FAV); pickO = beh === 'disturb' && fav && rng() < 0.85 ? fav : pick(dis); } }
        const wrong = ok ? 0 : 1 + (rng() < 0.3 ? 1 : 0);
        rec = base(kid, g, n, day, i, kind, { char: c, word: word(c), choices: opts.length, options: opts.map(o => o.ch).join(''), firstPick: pickO.ch, firstCorrect: ok, errorType: ok ? '' : '選到干擾部件',
          wrongCount: wrong, crossed: wrong, hintSet: 'word', firstSec, correctSec: Math.round((firstSec + wrong * 1.5) * 10) / 10, answerSet: ans.ch, partsLayer: 1, maskIdx: idx, maskStruct: Parts.struct(c) });
      } else if (g === 'R6') {
        const opts = makePartsPickOptions(c, k), ansIdx = opts.map((o, j) => o.type === '答案' ? j : -1).filter(j => j >= 0), disIdx = opts.map((o, j) => o.type === '答案' ? -1 : j).filter(j => j >= 0);
        const beh = prof.r6; let sel = [];
        if (beh === 'guess') sel = [...opts.keys()].sort(() => rng() - 0.5).slice(0, ansIdx.length);
        else {
          sel = ansIdx.filter(() => rng() < (beh === 'forget' ? 0.55 : beh === 'good' ? 0.96 : 0.95));
          if (!sel.length) sel = [pick(ansIdx)];
          const favIdx = disIdx.find(j => opts[j].ch === R6FAV);
          if (beh === 'disturb' && rng() < 0.8) sel.push(favIdx !== undefined ? favIdx : pick(disIdx));
          else if (beh === 'forget' && rng() < 0.1) sel.push(pick(disIdx));
          else if (beh === 'good' && rng() < 0.05) sel.push(pick(disIdx));
        }
        const bad = sel.filter(j => !ansIdx.includes(j)), miss = ansIdx.filter(j => !sel.includes(j)), ok = !bad.length && !miss.length;
        const wrong = ok ? 0 : 1 + (rng() < 0.3 ? 1 : 0), answers = ansIdx.map(j => opts[j].ch);
        rec = base(kid, g, n, day, i, kind, { char: c, word: word(c), choices: opts.length, options: opts.map(o => o.ch).join(''), firstPick: sel.map(j => opts[j].ch).join(''), firstCorrect: ok,
          errorType: ok ? '' : bad.length ? '選到干擾部件' : '少選', wrongCount: wrong, crossed: wrong, hintSet: 'word', firstSec, correctSec: Math.round((firstSec + wrong * 2) * 10) / 10,
          answerSet: answers.join(' '), pickSet: answers.join(' '), partsLayer: (Parts.read(c, { from: 2 }) || {}).layer || '' });
      }
      if (!rec) return;
      t0 += Math.round((firstSec + 3 + rng() * 4) * 1000);
      Object.assign(rec, { session: sid, at: new Date(t0).toISOString(), mode, timeLimit: mode === 'flu' ? 60 : '', prepost: prepost || '', daysAfter: dAfter });
      if (kid.legacyGoal && g === 'R3' && day < '2026-09-15') rec.goal = '3';   /* 舊代號：聽音選字＝3 */
      records.push(rec);
    });
  }

  P.forEach((prof, pi) => {
    const kid = { code: 'X0' + (pi + 1), name: '假學生' + NAMES[pi], grade: 2, sy: SCHOOL_YEAR, since: '2026-09-01' };
    if (prof.legacyFirst) kid.legacyGoal = true;
    kids.push(kid);
    for (const [n, L] of Object.entries(LESSONS)) {
      if (prof.light && n !== '1') continue;   /* 剛開始用的學生：只做第 1 課 */
      /* 聽音選字、部件重組：有前測、練習、後測（正式評量）；聽音補部件、聽音選部件只開放練習 */
      for (const g of ['R3', 'R4']) if (prof.goals.includes(g)) {
        runSession(kid, prof, g, n, L.pre, 'formal', '前測', 18, 'acc');
        (prof.light ? L.practice.slice(0, 2) : L.practice).forEach((d, i) => { if (rng() < 0.9) runSession(kid, prof, g, n, d, 'practice', '', 14 + Math.floor(rng() * 5), 'acc'); });
        if (prof.flu && g === 'R3') L.practice.slice(0, 2).forEach(d => runSession(kid, prof, g, n, d, 'practice', '', 16 + Math.floor(rng() * 6), 'flu'));
        (prof.light ? L.post.slice(0, 1) : L.post).forEach((d, i) => runSession(kid, prof, g, n, d, 'formal', '後測', 18, 'acc'));
      }
      for (const g of ['R5', 'R6']) if (prof.goals.includes(g)) L.practice.forEach(d => { if (rng() < 0.85) runSession(kid, prof, g, n, d, 'practice', '', 10 + Math.floor(rng() * 5), 'acc'); });
    }
  });
  Math.random = savedRandom;
  kids.forEach(k => delete k.legacyGoal);
  records.sort((a, b) => a.at < b.at ? -1 : 1);
  return { kids, teach, records };
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/tools/literacy/index.html`;
  const browser = await chromium.launch(), page = await browser.newPage();
  page.on('pageerror', e => { console.error('網頁錯誤：', e.message); process.exitCode = 1; });
  await page.goto(url); await page.waitForTimeout(1500);
  const data = await page.evaluate(`(${generate.toString()})(20261111)`);
  const backup = { app: 'literacy', kind: 'backup', version: 2, savedAt: '2026-11-11T12:00:00.000Z', settings: { choices: '4', formalTheme: true, clockFormal: false }, kids: data.kids, kidsArchived: [], teach: data.teach, records: data.records };
  fs.writeFileSync(OUT, JSON.stringify(backup));
  const by = {}; data.records.forEach(r => { const k = r.kid + ' ' + r.goal; by[k] = (by[k] || 0) + 1; });
  console.log(`已產生 ${data.records.length} 筆紀錄、${data.kids.length} 位學生 → ${OUT}`);
  console.log(Object.entries(by).map(([k, v]) => `${k}:${v}`).join('  '));
  await browser.close(); server.close();
})();
