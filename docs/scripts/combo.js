/* =========================================================
   識字評量「組合測試」（docs/scripts/combo.js，2026-10-31 B12 加；smoke.js 會呼叫）
   做什麼：評量目標 × 練習／正式 × 正確率／流暢性 × 玩法（一般、遊戲、賓果）× 作答方式（輪流、分區輪流、接力），
     每一種組合真的開始作答、答第一題（練習先故意答錯一次再答對；複選的部件題選對再送出），
     確認畫面不出程式錯誤、沒有卡住（答完那題學生的作答數有增加）。
   哪些組合算「本來就不能選」：照設定畫面自己的判斷（step1Miss、step2Miss、step3Miss、playWhy），不能選的略過並計數，
     所以新增評量目標或限制時，只要改 data.js 的目標能力表，這裡自動跟著變。
   正式評量另外檢查 A3 已定案的條件（2026-11-06 維護者要求加；條件見 docs/plans/a3-conditions.md）：
     不玩遊戲、用選項卡（A3-16）、不提示且答錯就結束這題（A3-6）、不回饋對錯（不變色、不搖動、沒有星星、沒有對錯音效，A3-7、A3-8）、
     新題出現 0.7 秒內不收點選（A3-7）、老師提示紀錄按鈕照常顯示（A3-9）、不報讀（A3-10）、正確率模式預設不顯示計時（A3-11；流暢性有時限，一律顯示）、
     分區輪流不能選正式評量（A3-19）。正式評量選了遊戲或賓果也照樣開始，確認程式自己改回一般選項卡。
   寫字組（W1～W3，E3 第 1、2 版）不走上面的組合，另外用 WRITING_PAGE 測：3 步設定、不選學生、每題有題目、答案頁、考卷（每題 1 格答案＋3 格訂正、不超出 A4）、不留紀錄。
   用瀏覽器開頁，所以要有 Playwright（同 smoke.js）。
   ========================================================= */
const IN_PAGE = async ({goal, kind, mode, play, answer}) => {
  /* 在頁面裡執行：設定這個組合，不能選就回 skip，能選就開始作答、答第一題 */
  const wait = ms => new Promise(r => setTimeout(r, ms));
  if(goalCaps(goal).writing) return {skip: "寫字組另外測（WRITING_PAGE）"};
  const bk = state.book, ls = BOOKS[bk].lessons;
  kids.length = 0; ["T1", "T2"].forEach(c => kids.push({code: c, name: "", grade: 4}));
  Object.assign(state, {goal, kind, mode, answer, book: bk, lessons: [], limit: "60"});
  state.kids = new Set(answer === "splitturn" || answer === "oneround" ? ["T1", "T2"] : ["T1"]);
  state.lessons = Object.keys(ls).map(n => `${bk}-${n}`).filter(k => lessonSize(k) >= 3).slice(0, 1);
  settings.practicePlay = play; state.themePick = play === "game" ? "ocean" : "none"; state.theme = state.themePick === "none" ? "" : state.themePick;
  const miss = step1Miss() || step2Miss() || step3Miss();
  const formal = kind === "formal", bad = [];   /* bad：正式評量違反 A3 條件的地方 */
  /* 正式評量選了遊戲、賓果不略過：照樣開始，確認程式自己改回一般選項卡（A3-16） */
  if(miss || (!formal && playWhy(play)) || (play === "game" && !window.Scenes)) return {skip: miss || playWhy(play)};
  const snd = {right:0, wrong:0};   /* 數對錯音效被叫了幾次（A3-8）；音效關著時 sfx 也會被呼叫，所以設定怎麼開都數得到 */
  if(formal) for (const k of ["right", "wrong"]){ const f = sfx[k]; sfx[k] = (...a) => { snd[k]++; return f(...a); }; }
  try { startSession(); } catch(e) { return {err: `startSession 出錯：${e.stack.split('\n').slice(0,3).join(' | ')}`}; }
  await wait(play === "game" ? SCENE_MS + 500 : answer === "oneround" ? TURN_MS + 700 : 700);   /* 接力有兩位學生，開頭先出現 1.6 秒的「先從 ○○ 開始」 */
  if(G.mode === "flu"){ const go = document.querySelector("#roundGo"); if(!go) return {err: "流暢性沒有「開始」按鈕"}; go.click(); await wait(300); }
  const cur = () => G && G.cur;
  if(!cur()) return {err: "開始後沒有出題（G.cur 不見）"};
  const btns = () => [...document.querySelectorAll("#pBody .opt-big")];
  const before = () => Object.values(G.tally).reduce((a, t) => a + t.n, 0);
  const n0 = before();
  const fbOf = b => [..."right wrong shake fx".split(" ").filter(x => b.classList.contains(x)), ...(b.querySelector(".burst") ? ["burst"] : [])];
  if(formal){
    if(G.game) bad.push("A3-16 正式評量不玩遊戲，卻開了遊戲");
    if(G.layout !== "cards") bad.push("正式評量要用選項卡，卻是賓果卡");
    if(!G.noHelp || Object.values(G.per).some(p => p.hints.length)) bad.push("A3-6 正式評量不提示，提示設定卻不是空的");
    if(G.read || document.querySelector("#pBody .hspk")) bad.push("A3-10 正式評量不報讀，卻開了報讀");
    if(G.mode === "acc" && G.clock) bad.push("A3-11 正式評量（正確率）預設不顯示計時，卻顯示了");   /* 流暢性有時限，一律顯示倒數（play.js 的 startClockShow） */
    if(G.mode === "acc" && !TABLET && !document.querySelector("#pBody .tbar")) bad.push("A3-9 正式評量要照常顯示老師提示紀錄按鈕，卻沒有");
  }
  if(formal && G.goal !== "R6"){
    /* 正式評量：先試 0.7 秒內點（不該收），再答錯一次（不回饋、不提示、直接結束這題），下一題答對（不回饋） */
    const c = cur(), b = btns(), w = c.opts.findIndex(o => o.type !== "答案");
    if(w < 0 || !b[w]) return {err: "找不到答錯的選項"};
    if(G.mode === "acc"){
      c.tShown = performance.now(); b[w].click();
      if(c.firstPick !== null) bad.push("A3-7 新題出現 0.7 秒內不收點選，點了卻有記錄");
      c.tShown = performance.now() - 1000;
    }
    if(c.firstPick === null) b[w].click();
    await wait(80);
    const fb = fbOf(b[w]);
    if(fb.length) bad.push(`A3-7 正式評量答錯不回饋，選項卻有「${fb.join("、")}」`);
    if(!b[w].classList.contains("picked")) bad.push("A3-7 正式評量選了的選項要淡淡標示（picked），卻沒有");
    if(snd.wrong) bad.push("A3-8 正式評量沒有答錯音效，卻播了");
    const hb = document.querySelector("#hintbox");
    if(hb && hb.innerHTML.trim()) bad.push("A3-6 正式評量答錯不給提示，卻出現了提示");
    if(!c.done) bad.push("A3-6 正式評量答錯就結束這題（不提示、不重答），這題卻沒有結束");
    await wait(1300);
    const c2 = cur();
    if(c2 && c2 !== c && !c2.done && !G.over){
      if(G.mode === "acc") c2.tShown = performance.now() - 1000;
      const r = c2.opts.findIndex(o => o.type === "答案"), b2 = btns()[r];
      if(b2){ b2.click(); await wait(80);
        const fb2 = fbOf(b2);
        if(fb2.length) bad.push(`A3-7 正式評量答對不回饋，選項卻有「${fb2.join("、")}」`);
        if(snd.right) bad.push("A3-8 正式評量沒有答對音效，卻播了");
      }
    }
  } else if(G.goal === "R6"){
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
  return {n: before() - n0, over: !!G.over, bad};
};

/* 寫字組（E3 第 1 版，writing.js）：螢幕出題、不留紀錄。每個寫字目標：設定只有 3 步、不用選學生，
   開始出題後每一題都有題目，一路按「下一題」到答案頁，答案頁的題數對、而且沒有存任何作答紀錄 */
const WRITING_PAGE = async goal => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const bad = [];
  state.kids = new Set();
  const btn = [...document.querySelectorAll("#goals button.goal")].find(x => x.dataset.g === goal);
  if(!btn) return {bad: ["第 1 步找不到這個目標的按鈕"]};
  btn.click();
  const bk = state.book, ls = BOOKS[bk].lessons;
  state.lessons = Object.keys(ls).map(n => `${bk}-${n}`).filter(k => lessonSize(k) >= 3).slice(0, 1);
  render();
  if(document.querySelectorAll("#wTabs button").length !== 3) bad.push("寫字的設定應該只有 3 步");
  if(step2Miss()) bad.push(`不選學生也應該可以往下，卻寫「${step2Miss()}」`);
  showStep(3);
  const go = document.querySelector("#wrGo");
  if(!go || go.disabled) return {bad: [...bad, "第 3 步沒有可以按的「開始出題」"]};
  const n0 = records.length;
  go.click(); await wait(1500);
  if(document.querySelector("#wplay").hidden) return {bad: [...bad, "按了「開始出題」沒有出現出題畫面"]};
  const total = W.items.length;
  for(let i = 0; i < total; i++){
    if(!document.querySelector("#wStage").textContent.trim() && !document.querySelector("#wStage .ptile")) bad.push(`第 ${i + 1} 題沒有題目`);
    if(goal === "W1" && !document.querySelector("#wStage .zyonly")) bad.push(`第 ${i + 1} 題「${W.items[i].c}」沒有注音`);
    document.querySelector("#wNextQ").click(); await wait(30);
  }
  if(!W.answers) bad.push("出完全部題目沒有出現答案頁");
  const rows = document.querySelectorAll("#wAns tbody tr").length;
  if(rows !== total) bad.push(`答案頁有 ${rows} 題，應該是 ${total} 題`);
  await wait(300);
  if(records.length !== n0) bad.push(`寫字不留紀錄，卻多了 ${records.length - n0} 筆作答紀錄`);
  document.querySelector("#wHome").click();
  /* 第 2 版考卷（exam.js）：每一題一列（題目、答案格、摺線、3 格訂正格），一頁不超出 A4，不留紀錄 */
  showStep(3); examOpt.ruler = true; renderExamOpts();
  document.querySelector("#exGo").click(); await wait(1500);
  if(document.querySelector("#wexam").hidden) bad.push("按了「產生考卷」沒有出現考卷預覽");
  else {
    const rows = document.querySelectorAll("#exPages .exrow:not(.exlabels)");
    if(rows.length !== EX.items.length) bad.push(`考卷有 ${rows.length} 題，應該是 ${EX.items.length} 題`);
    if([...rows].some(r => !r.querySelectorAll(".exfix .excell").length)) bad.push("考卷每一題應該有訂正格");
    /* W1：題目裡有空格（答案格）；W2：每題有答案格；W3：1 格答案；不再有老師寫正確答案的格子（2026-11-10 拿掉） */
    if(goal === "W1" && [...rows].some(r => !r.querySelectorAll(".exhole").length)) bad.push("看注音寫國字：題目裡沒有空格");
    if(goal === "W2" && [...rows].some(r => !r.querySelectorAll(".exans .excell").length)) bad.push("聽音寫字：沒有答案格");
    if(goal === "W3" && [...rows].some(r => r.querySelectorAll(".exans .excell").length !== 1)) bad.push("看部件寫字：每題應該有 1 格答案");
    if(document.querySelector("#exPages .teach")) bad.push("考卷不應該有老師寫正確答案的格子");
    if(records.length !== n0) bad.push("考卷不留紀錄，卻多了作答紀錄");
    document.querySelector("#exBack").click();
  }
  return {bad, total};
};

module.exports = async function comboErrors(browser, base) {
  const goals = await (async () => {
    const page = await browser.newPage();
    await page.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
    await page.goto(base + 'tools/literacy/index.html', {waitUntil: 'load'});
    const ids = await page.evaluate(() => GOALS.filter(g => !g.off).map(g => g.id));
    await page.close(); return ids;
  })();
  const errs = []; let ran = 0, skipped = 0, formalRan = 0;
  for (const goal of goals) for (const kind of ['practice', 'formal']) for (const mode of ['acc', 'flu'])
    for (const play of ['color', 'game', 'bingo']) for (const answer of ['turn', 'splitturn', 'oneround']) {
      const name = `${goal}／${kind}／${mode}／${play}／${answer}`;
      const page = await browser.newPage(), pe = [];
      await page.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
      page.on('pageerror', e => pe.push(e.message));
      try {
        await page.goto(base + 'tools/literacy/index.html', {waitUntil: 'load', timeout: 20000});
        const r = await page.evaluate(IN_PAGE, {goal, kind, mode, play, answer});
        if (r.skip) skipped++;
        else { ran++; if (kind === 'formal') formalRan++;
          if (kind === 'formal' && answer === 'splitturn') errs.push(`${name}：A3-19 分區輪流不能選正式評量，卻可以開始`);
          if (answer === 'oneround' && (kind === 'formal' || mode === 'flu' || play !== 'color')) errs.push(`${name}：E19 接力只開放練習・正確率・一般，卻可以開始`);
          for (const b of r.bad || []) errs.push(`${name}：${b}`);
          if (r.err) errs.push(`${name}：${r.err}`);
          else if (!r.n && !r.over) errs.push(`${name}：答了第一題但作答數沒增加（可能卡住）`);
        }
      } catch (e) { errs.push(`${name}：${e.message.split('\n')[0]}`); }
      if (pe.length) errs.push(`${name}：程式錯誤 ${pe[0]}`);
      await page.close();
      if (errs.length > 10) return errs;
    }
  /* 寫字組 */
  for (const goal of goals.filter(g => /^W/.test(g))) {
    const page = await browser.newPage(), pe = [];
    await page.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
    page.on('pageerror', e => pe.push(e.message));
    try {
      await page.goto(base + 'tools/literacy/index.html', {waitUntil: 'load', timeout: 20000});
      const r = await page.evaluate(WRITING_PAGE, goal);
      for (const b of r.bad) errs.push(`寫字 ${goal}：${b}`);
      if (!r.bad.length) ran++;
    } catch (e) { errs.push(`寫字 ${goal}：${e.message.split('\n')[0]}`); }
    if (pe.length) errs.push(`寫字 ${goal}：程式錯誤 ${pe[0]}`);
    await page.close();
  }
  console.log(`　　　組合測試：實際跑 ${ran} 種（其中正式評量 ${formalRan} 種，檢查 A3 條件）、依設定畫面的限制略過 ${skipped} 種`);
  if (!formalRan) errs.push('一種正式評量的組合都沒跑到，A3 條件沒有檢查到');
  if (ran < 20) errs.push(`只跑了 ${ran} 種組合，太少了（略過 ${skipped}）`);
  return errs;
};
