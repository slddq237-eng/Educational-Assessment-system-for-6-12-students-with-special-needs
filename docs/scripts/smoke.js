/* =========================================================
   網頁打得開測試（docs/scripts/smoke.js，2026-10-24 加）
   用法：在 repo 最上層執行  node docs/scripts/smoke.js
     要先有 Playwright（自動操作瀏覽器的工具）：GitHub 的自動檢查會自己裝；本機沒有就執行
     npm install --no-save playwright && npx playwright install chromium
   做什麼：在自己電腦開一個小網站，用瀏覽器一頁一頁打開，畫面出現程式錯誤、或網站裡的檔案載入失敗，就算不通過。
     也會打開識字評量的「平板作答」網址（用電腦版產生 QR code 的同一個函數做出網址），確認平板模式能進到作答前的畫面。
   為什麼：check.js 只看語法和資料，不會真的打開網頁。識字評量的檔案靠共用名稱互相呼叫，
     改掉一個名稱可能一打開就是白畫面，check.js 還是通過；這支在合併前就抓得到（docs/code/architecture-notes.md「共用名稱」）。
   注意：外部網站（Google 字型等）一律擋掉不連，結果才不會因為網路不穩忽好忽壞；不檢查作答流程，只檢查打得開。
   ========================================================= */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };

/* 要打開的頁面。加了新工具或新網頁，在這裡加一行（漏加時 check.js 第 13 項會報錯） */
const PAGES = [
  'index.html', 'about.html', 'privacy.html',
  'tools/literacy/index.html',
  'tools/prep/index.html',
];

/* 部件入口 window.Parts（shared/parts-api.js）：不用瀏覽器，直接載入資料檔檢查（2026-10-31 步驟 3a）。
   只檢查規則（沒載入三層資料時回傳 null、起點層不會往回讀、遮第幾塊不超過第一層塊數…），不寫死某個字的拆法，老師改部件表不會讓它失敗 */
function partsApiErrors(){
  const errs = [];
  const load = files => { const w = {}; new Function('window', files.map(f => f === 'lessons' ? require('./lessons-src.js')() : fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')
    + ';window.__layers = typeof PARTS_LAYERS !== "undefined" ? PARTS_LAYERS : null;')(w); return w; };
  try {
    const bare = load(['lessons', 'shared/parts.js', 'shared/parts-api.js']);
    const r0 = bare.Parts.read('清');
    if (bare.Parts.layer('清', 1) !== null || bare.Parts.layer('清', 2) !== null || !r0 || r0.layer !== 3 || bare.Parts.struct('清') !== '' || bare.Parts.mask('清') !== 0)
      errs.push('沒載入 parts-layers.js 時，第一、二層應該回傳 null（第三層從 parts.js 算，所以 Parts.read 會讀到第三層）、struct 回傳空字串、mask 回傳 0');
    const w = load(['lessons', 'shared/parts.js', 'shared/parts-layers.js', 'shared/parts-api.js']), P = w.Parts, L = w.__layers;
    for (const k of ['layer', 'read', 'struct', 'mask', 'sub']) if (typeof P[k] !== 'function') errs.push(`Parts.${k} 不見了`);
    if (P.sub('足').length || P.sub('酋').length) errs.push('Parts.sub：足、酋應該不再往下拆');
    let n = 0;
    for (const [c, d] of Object.entries(L)) {
      n++;
      for (const k of [1, 2]) if (!!P.layer(c, k) !== !!(d[k] && (d[k].m || d[k].a))) errs.push(`${c} 第 ${k} 層：Parts.layer 和資料檔不一致`);
      if (!!P.layer(c, 3) !== !!P.sub(c).length) errs.push(`${c} 第 3 層：Parts.layer 和 Parts.sub 不一致`);   /* 第三層不存檔，從 parts.js 算 */
      const r1 = P.read(c, { from: 1 }), r2 = P.read(c, { from: 2 }), r3 = P.read(c, { from: 3 });
      if (r2 && r2.layer < 2) errs.push(`${c}：從第 2 層開始讀卻回傳第 ${r2.layer} 層`);
      if (r3 && r3.layer !== 3) errs.push(`${c}：從第 3 層開始讀卻回傳第 ${r3.layer} 層`);
      if (r1 && (!r1.parts.length || !['manual', 'auto'].includes(r1.source))) errs.push(`${c}：Parts.read 的結果不完整`);
      if (P.mask(c) && P.mask(c) > (P.layer(c, 1) ? P.layer(c, 1).parts.length : 0)) errs.push(`${c}：遮第 ${P.mask(c)} 塊，超過第一層的塊數`);
      if (errs.length > 8) break;
    }
    if (n < 2000) errs.push(`parts-layers.js 只有 ${n} 個字，太少了`);
  } catch (e) { errs.push(`載入失敗：${e.message.split('\n')[0]}`); }
  return errs;
}

/* 1. 小網站：照路徑把 repo 裡的檔案送出去 */
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

/* 2. 打開一頁，收集錯誤：程式錯誤、console.error、網站裡的檔案 404 */
async function visit(browser, base, url, after){
  const page = await browser.newPage(), errs = [];
  await page.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
  page.on('pageerror', e => errs.push(`程式錯誤：${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errs.push(`console.error：${m.text()}`); });
  page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) errs.push(`載入失敗 ${r.status()}：${r.url().slice(base.length)}`); });
  try {
    await page.goto(base + url, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(800);   /* 等網頁載入後才跑的程式也跑完 */
    if (after) await after(page, errs);
  } catch (e) { errs.push(`打不開：${e.message.split('\n')[0]}`); }
  await page.close();
  return errs;
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  let fail = 0;
  const report = (name, errs) => {
    if (errs.length) { fail++; console.log(`錯誤　${name}`); errs.forEach(e => console.log(`　　　${e}`)); }
    else console.log(`通過　${name}`);
  };

  for (const p of PAGES) report(p, await visit(browser, base, p));
  report('shared/parts-api.js 部件入口（不用瀏覽器）', partsApiErrors());
  report('識字評量 組合測試（目標×練習／正式×模式×玩法×作答方式）', await require('./combo.js')(browser, base));

  /* 3. 平板作答：在電腦版用產生 QR code 的同一個函數做出網址，再用新分頁打開 */
  let tabUrl = '';
  report('tools/literacy/index.html 產生平板網址', await visit(browser, base, 'tools/literacy/index.html', async (page, errs) => {
    tabUrl = await page.evaluate(() => { settings.tabletForm = settings.tabletForm || {id:'smoke-test', entry:'1'};   /* 平板要有表單網址；測試用假的，不會真的送出 */
      /* 選一課：用拆出去的課本檔（BOOK_FILES 第一本），順便測平板只下載用到的課本（R4b） */
      const b = BOOK_FILES.find(x => BOOKS[x]); state.lessons = [b + '-' + Object.keys(BOOKS[b].lessons)[0]];
      return location.href.split('#')[0] + '#t=' + b64url(JSON.stringify(tabletPack())); }).catch(e => { errs.push(`做不出平板網址：${e.message.split('\n')[0]}`); return ''; });
  }));
  if (tabUrl) report('tools/literacy/index.html 平板作答（#t=）', await visit(browser, base, tabUrl.slice(base.length), async (page, errs) => {
    await page.waitForTimeout(1500);   /* 平板模式會再下載用到的課本 */
    const text = await page.evaluate(() => document.body.innerText);
    if (!text.trim()) errs.push('畫面是空白的');
    else if (/找不到，請重新|重新掃描/.test(text)) errs.push('平板顯示「請重新掃描」：讀不到 QR code 的設定或課本');
    else if (!await page.evaluate(() => document.documentElement.classList.contains('tablet'))) errs.push('沒有進到平板模式');
  }));

  await browser.close();
  server.close();
  console.log(`\n網頁打得開測試完成：${fail ? `${fail} 項有錯誤` : '全部通過'}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
