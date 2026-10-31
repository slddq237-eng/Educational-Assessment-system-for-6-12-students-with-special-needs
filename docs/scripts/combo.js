/* =========================================================
   識字評量「組合測試」（docs/scripts/combo.js，2026-10-31 B12 加；smoke.js 會呼叫）
   做什麼：評量目標 × 練習／正式 × 正確率／流暢性 × 玩法（一般、遊戲、賓果）× 作答方式（輪流、分區輪流），
     每一種組合真的開始作答、答第一題（練習先故意答錯一次再答對；複選的部件題選對再送出），
     確認畫面不出程式錯誤、沒有卡住（答完那題學生的作答數有增加）。
   哪些組合算「本來就不能選」：照設定畫面自己的判斷（step1Miss、step2Miss、step3Miss、playWhy），不能選的略過並計數，
     所以新增評量目標或限制時，只要改 data.js 的目標能力表，這裡自動跟著變。
   用瀏覽器開頁，所以要有 Playwright（同 smoke.js）。
   ========================================================= */
const IN_PAGE = async ({goal, kind, mode, play, answer}) => {
  /* 在頁面裡執行：設定這個組合，不能選就回 skip，能選就開始作答、答第一題 */
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const bk = state.book, ls = BOOKS[bk].lessons;
  kids.length = 0; ["T1", "T2"].forEach(c => kids.push({code: c, name: "", grade: 4}));
  Object.assign(state, {goal, kind, mode, answer, book: bk, lessons: [], limit: "60"});
  state.kids = new Set(answer === "splitturn" ? ["T1", "T2"] : ["T1"]);
  state.lessons = Object.keys(ls).map(n => `${bk}-${n}`).filter(k => lessonSize(k) >= 3).slice(0, 1);
  settings.practicePlay = play; state.themePick = play === "game" ? "ocean" : "none"; state.theme = state.themePick === "none" ? "" : state.themePick;
  const miss = step1Miss() || step2Miss() || step3Miss();
  if(miss || playWhy(play) || (play !== "color" && kind === "formal") || (play === "game" && !window.Scenes)) return {skip: miss || playWhy(play) || "正式評量不玩遊戲"};
  try { startSession(); } catch(e) { return {err: `startSession 出錯：${e.stack.split('\n').slice(0,3).join(' | ')}`}; }
  await wait(play === "game" ? SCENE_MS + 500 : 700);
  if(G.mode === "flu"){ const go = document.querySelector("#roundGo"); if(!go) return {err: "流暢性沒有「開始」按鈕"}; go.click(); await wait(300); }
  const cur = () => G && G.cur;
  if(!cur()) return {err: "開始後沒有出題（G.cur 不見）"};
  const btns = () => [...document.querySelectorAll("#pBody .opt-big")];
  const before = () => Object.values(G.tally).reduce((a, t) => a + t.n, 0);
  const n0 = before();
  if(G.goal === "R6"){
    const need = {}; answerParts().forEach(p => need[p] = (need[p] || 0) + 1);
    const c = cur();
    c.opts.forEach((o, i) => { if(need[o.ch] > 0){ need[o.ch]--; btns()[i].click(); } });
    await wait(100); document.querySelector("#submitParts").click();
  } else {
    const c = cur(), b = btns();
    if(kind === "practice" && G.mode !== "flu"){ const w = c.opts.findIndex(o => o.type !== "答案"); if(w >= 0 && b[w]) b[w].click(); await wait(150); }
    if(cur() === c && !c.done) { const r = c.opts.findIndex(o => o.type === "答案"); if(r < 0 || !btns()[r]) return {err: "找不到答案選項"}; btns()[r].click(); }
  }
  await wait(900);
  return {n: before() - n0, over: !!G.over};
};

module.exports = async function comboErrors(browser, base) {
  const goals = await (async () => {
    const page = await browser.newPage();
    await page.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
    await page.goto(base + 'tools/literacy/index.html', {waitUntil: 'load'});
    const ids = await page.evaluate(() => GOALS.filter(g => !g.off).map(g => g.id));
    await page.close(); return ids;
  })();
  const errs = []; let ran = 0, skipped = 0;
  for (const goal of goals) for (const kind of ['practice', 'formal']) for (const mode of ['acc', 'flu'])
    for (const play of ['color', 'game', 'bingo']) for (const answer of ['turn', 'splitturn']) {
      const name = `${goal}／${kind}／${mode}／${play}／${answer}`;
      const page = await browser.newPage(), pe = [];
      await page.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
      page.on('pageerror', e => pe.push(e.message));
      try {
        await page.goto(base + 'tools/literacy/index.html', {waitUntil: 'load', timeout: 20000});
        const r = await page.evaluate(IN_PAGE, {goal, kind, mode, play, answer});
        if (r.skip) skipped++;
        else { ran++;
          if (r.err) errs.push(`${name}：${r.err}`);
          else if (!r.n && !r.over) errs.push(`${name}：答了第一題但作答數沒增加（可能卡住）`);
        }
      } catch (e) { errs.push(`${name}：${e.message.split('\n')[0]}`); }
      if (pe.length) errs.push(`${name}：程式錯誤 ${pe[0]}`);
      await page.close();
      if (errs.length > 10) return errs;
    }
  console.log(`　　　組合測試：實際跑 ${ran} 種、依設定畫面的限制略過 ${skipped} 種`);
  if (ran < 20) errs.push(`只跑了 ${ran} 種組合，太少了（略過 ${skipped}）`);
  return errs;
};
