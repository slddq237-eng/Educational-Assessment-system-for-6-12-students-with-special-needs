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
  'tools/tts-test/index.html',   /* 暫時的語音測試頁，用完連同這一行一起移掉 */
];

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
