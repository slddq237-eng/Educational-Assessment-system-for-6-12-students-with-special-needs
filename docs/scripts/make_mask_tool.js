/* =========================================================
   遮擋位置調整工具產生器（docs/scripts/make_mask_tool.js，2026-10-31 新增）
   用法：在 repo 最上層執行  node docs/scripts/make_mask_tool.js [輸出檔路徑]
     （要有 Playwright：npm install --no-save playwright && npx playwright install chromium；預設輸出 ./遮擋位置調整工具.html）
   做什麼：產生一個「單機的 HTML 檔」，點兩下用瀏覽器打開（不用網路、不用安裝），直接用滑鼠調整每個字「聽音補部件」遮哪裡：
     拖色塊＝移動、拖白色小方塊＝縮放、拖黃點＝旋轉、「＋第N塊加色塊」＝一個部件用兩個以上的色塊、「套用到整組」＝同一種拆法的字都用這個位置。
     改完按「下載結果」得到 json，放到 docs/materials/mask-fix.json，再跑 node docs/scripts/make_mask_fix.js 產生遊戲用的資料。
   資料從哪來：
     - 每個字的結構、第一層部件、預設遮擋位置、分組：載入 tools/literacy/ 的真正程式（data.js 的 maskBox、maskGroup），所以和遊戲一致；
     - 字形圖：用全字庫正楷體（shared/fonts）在瀏覽器裡畫出來截圖，每字一張 160 像素的小圖嵌進檔案（檔案約 5～6MB）；
     - 起始的調整：docs/materials/mask-fix.json（repo 目前的結果），打開工具先看到它。
   注意：產生出來的檔案很大，不要放進 repo（.gitignore 已排除）。部件表（第一層拆法）改了之後要重新產生，不然工具裡的字形、分組是舊的。
   自我檢查：每張字形圖都要完整（以前曾經因為截圖視窗太矮，最後一列字的下半截被切掉），不完整就直接報錯、不產生檔案。
   ========================================================= */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || '遮擋位置調整工具.html');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const CELL = 160, COLS = 10, ROWS = 6, PER = COLS * ROWS;

const server = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split(/[?#]/)[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(r);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  /* 視窗要夠高放得下整個字形格子（PER 個字 = ROWS 列），否則截圖會切掉最後一列的下半截 */
  const page = await browser.newPage({ viewport: { width: COLS * CELL + 100, height: ROWS * CELL + 200 } });
  await page.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(base + 'tools/literacy/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);

  /* 1. 資料：課本裡每個能出聽音補部件的字，每一塊的預設位置（maskBox，不含人工調整） */
  const rows = await page.evaluate(() => {
    const seen = new Set(), out = [];
    for (const b of Object.values(BOOKS)) for (const L of Object.values(b.lessons)) for (const c of [...(L.write + L.read)]) {
      if (seen.has(c)) continue; seen.add(c);
      const idx = maskIdxs(c); if (!idx.length) continue;
      const ps = Parts.read(c, { from: 1 }).parts, st = Parts.struct(c);
      for (const i of idx) { const bx = maskBox(c, i); if (bx) out.push([maskGroup(c), c, st, ps.join(' '), i, ps[i - 1], ...bx.map(x => Math.round(x * 100) / 100)]); }
    }
    return out;
  });
  if (errs.length) throw new Error('頁面程式錯誤：' + errs[0]);   /* 之後會把頁面內容換成字形格子，網頁自己的程式會報錯，不算 */
  const chars = [...new Set(rows.map(r => r[1]))];

  /* 2. 字形圖：每 PER 個字排成一張格子截圖，再在瀏覽器裡切成每字一張 webp */
  const img = {};
  for (let k = 0; k * PER < chars.length; k++) {
    const part = chars.slice(k * PER, (k + 1) * PER), rowsN = Math.ceil(part.length / COLS);
    await page.evaluate(async ([cs, COLS, CELL]) => {
      const fam = getComputedStyle(document.body).getPropertyValue('--kai');
      document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#fff';
      const w = document.createElement('div'); w.style.cssText = `display:grid;grid-template-columns:repeat(${COLS},${CELL}px);width:${COLS * CELL}px`;
      cs.forEach(c => { const d = document.createElement('div'); d.style.cssText = `width:${CELL}px;height:${CELL}px;font:${CELL}px/1 ${fam};position:relative;overflow:hidden`; d.textContent = c; w.appendChild(d); });
      document.body.appendChild(w);
      await document.fonts.load(`${CELL}px ${fam}`, cs.join('')); await document.fonts.ready;
    }, [part, COLS, CELL]);
    await page.waitForTimeout(250);
    const png = (await page.screenshot({ clip: { x: 0, y: 0, width: COLS * CELL, height: rowsN * CELL } })).toString('base64');
    const res = await page.evaluate(async ([b64, n, COLS, CELL]) => {
      const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
      if (im.naturalHeight < Math.ceil(n / COLS) * CELL) return { err: `截圖高度只有 ${im.naturalHeight}，應該有 ${Math.ceil(n / COLS) * CELL}` };
      const cv = document.createElement('canvas'); cv.width = cv.height = CELL; const cx = cv.getContext('2d', { willReadFrequently: true });
      const out = [], bad = [];
      for (let i = 0; i < n; i++) {
        cx.clearRect(0, 0, CELL, CELL); cx.drawImage(im, (i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL, CELL, 0, 0, CELL, CELL);
        const d = cx.getImageData(0, 0, CELL, CELL).data; let top = 0, mid = 0, low = 0;
        for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) if (d[(y * CELL + x) * 4] < 128) { if (y < CELL / 3) top++; else if (y < CELL * 2 / 3) mid++; else low++; }
        if (!top || !mid || !low) bad.push(i);   /* 字的上、中、下三段都應該有筆畫；少一段代表被切掉了 */
        out.push(cv.toDataURL('image/webp', 0.6));
      }
      return { out, bad };
    }, [png, part.length, COLS, CELL]);
    if (res.err) throw new Error(res.err);
    if (res.bad.length) throw new Error(`字形圖不完整：${res.bad.map(i => part[i]).join('')}`);
    part.forEach((c, i) => { img[c] = res.out[i]; });
  }
  await browser.close(); server.close();

  /* 3. 組成 HTML */
  const init = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/materials/mask-fix.json'), 'utf8'));
  const tpl = fs.readFileSync(path.join(__dirname, 'mask-tool-template.txt'), 'utf8');
  const html = tpl.replace('__DATA__', () => JSON.stringify(rows)).replace('__IMG__', () => JSON.stringify(img)).replace('__INIT__', () => JSON.stringify(init));
  fs.writeFileSync(OUT, html);
  console.log(`完成：${chars.length} 個字、${rows.length} 個可遮的塊，${Math.round(Buffer.byteLength(html) / 1e5) / 10}MB → ${OUT}\n這個檔案不要放進 repo（已列在 .gitignore）。`);
})().catch(e => { console.error('失敗：' + e.message); process.exit(1); });
