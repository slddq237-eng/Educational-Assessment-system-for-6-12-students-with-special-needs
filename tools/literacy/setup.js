/* =========================================================
   識字評量：設定畫面（setup.js）
   四個步驟（目標和評量方式 → 學生和課次 → 作答方式 → 玩法和主題，2026-10-24 維護者改的順序）、快速開始與進階設定、右邊的摘要，以及學生名單、教學日期、評量設定三個彈出面板。
   ========================================================= */

/* =========================================================
   4. 設定畫面（快速開始的三張卡片、進階設定的六個步驟、右邊的摘要）
   每個 renderXXX() 負責重畫一個步驟；任何設定改變都呼叫 render() 全部重畫。
   ========================================================= */
/* ---------- 快速開始 ----------
   給不想研究細節的老師：選一張卡片，系統自動填好進階設定。
   每一次作答都會存下來；卡片上標示這次的紀錄是否列入學習分析。 */
const PRESETS = [
  {id:"class", name:"課堂練習", desc:"答錯會出現提示幫忙，適合上課時練習。", rec:"紀錄會存下來，不列入學習分析", off:true,
   why:"練習時多一點提示，學生比較有成功經驗。這些紀錄另外統計，不會影響小考的成績分析。",
   apply:() => Object.assign(state, {kind:"practice", mode:"acc", pChoices:"4", pHints:new Set(["word","parts"]), pRule:["next","next","free"]})},
  {id:"test", name:"正式評量", desc:"條件固定、無提示，看學生真正會多少，可標示前後測", rec:"紀錄會存下來，列入學習分析",
   why:"每次評量的條件都一樣，前後成績才能比較，看得出教學有沒有效果。要做前後測（例如學習扶助、資源班轉介前介入）時，按「前測」或「後測」，紀錄會標記起來，老師專區就能比較；沒有要比較就選「不標」。",
   apply:() => Object.assign(state, {kind:"formal", mode:"acc"})},
  /* 計時挑戰是練習（2026-10-21 維護者決定）：像遊戲一樣挑戰，結果另外統計；要列入學習分析，到進階設定選「正式評量＋流暢性模式」 */
  {id:"timed", name:"計時挑戰", desc:"1 分鐘內答對越多越好，看學生熟不熟練。", rec:"紀錄會存下來，不列入學習分析", off:true,
   why:"認得字之後，還要認得快，讀起文章才會順。每分鐘答對幾個，可以看出熟練的程度。這是練習，老師專區把「性質」切到「練習」就看得到；要列入學習分析，請到進階設定選「正式評量」和「流暢性模式」。",
   apply:() => Object.assign(state, {kind:"practice", mode:"flu", limit:"60"})}
];
let ui = load(KEYS.ui, "quick");      /* 這台電腦上次用的是快速開始還是進階設定 */
/* 這台電腦上次用的卡片（2026-10-25 起「小考檢測」「學扶前後測」合併成「正式評量」，舊的代號 rti 換成 test） */
const savedPreset = load(KEYS.preset, "") === "rti" ? "test" : load(KEYS.preset, "");
state.preset = PRESETS.some(p => p.id === savedPreset) ? savedPreset : "class";
const isQuick = () => ui === "quick";
/* 設定被程式自動改掉時，在畫面上方寫一行說明，幾秒後自動收起（規則 8：不能悄悄改掉老師選好的東西） */
let flowTimer = 0;
function flowNote(msg){
  const el = $("#flowNote"); if(!el) return;
  el.textContent = msg; el.hidden = false;
  clearTimeout(flowTimer); flowTimer = setTimeout(() => { el.hidden = true; }, 8000);
}
function applyPreset(id){
  if(state.preset !== id) state.prepost = "";
  state.preset = id; store(KEYS.preset, id);
  if(state.qCount !== null || state.qMethod !== "even") flowNote("換了快速開始的卡片，題數和出題方式已回到預設。");
  Object.assign(state, {qCount:null, qMethod:"even"});   /* 評量目標沿用第 1 步選的 */
  PRESETS.find(p => p.id === id).apply();
  /* 作答方式：快速開始只有大螢幕輪流、平板掃 QR code 兩種（2026-10-25 起平板也能用在正式評量，A3-18） */
  if(state.answer !== "qr" && state.answer !== "splitturn") state.answer = "turn";
}
function setUi(mode){
  ui = mode; store(KEYS.ui, ui);
  document.body.classList.toggle("quick", isQuick());
  $("#uiQuick").setAttribute("aria-pressed", isQuick()); $("#uiAdv").setAttribute("aria-pressed", !isQuick());
  if(isQuick()) applyPreset(state.preset);
  render();
}
$("#uiQuick").onclick = () => setUi("quick");
$("#uiAdv").onclick = () => setUi("adv");
function renderPresets(){
  $("#presets").innerHTML = PRESETS.map(p => `<button class="preset ${state.preset===p.id?"on":""}" data-p="${p.id}" aria-pressed="${state.preset===p.id}">
      <b>${p.name}</b><span class="d">${p.desc}</span><span class="rec ${p.off?"off":""}">${p.rec}</span></button>`).join("")
    + `<details class="why presetwhy" style="grid-column:1/-1"><summary>這幾種有什麼不同？</summary>${PRESETS.map(p => `<p><b>${p.name}</b>：${p.why}</p>`).join("")}</details>`;
  $("#presets").querySelectorAll("[data-p]").forEach(b => b.onclick = () => { applyPreset(b.dataset.p); render(); });
}
/* ---------- 前測／後測（A8，2026-10-25）----------
   只有正式評量才能標（快速開始的「正式評量」卡片，和進階設定選正式評量時）；練習一律不標。
   前測和後測的條件完全一樣。沒有前後測代號、也不做補考（2026-10-25 維護者決定）：缺席的學生下次再做時，自己標前測或後測就好；
   同一次坐下來考的紀錄本來就有 session（作答場次）。
   教學日期不會自動記，需要時請從右上角「選單」的「教學日期管理」輸入。 */
const PP_OPTS = [["", "不標", "和一般評量一樣，不放進前後測比較"], ["前測", "前測", "教學前，看學生原本會多少"], ["後測", "後測", "教學後，看學生學會多少"]];
const ppOn = () => state.kind === "formal" && (!isQuick() || state.preset === "test");
/* 前測、後測和教學日期對不上時的提醒（維護者 2026-10-25）：只提醒、不擋，不改變紀錄；教學日期只用來算「教學後第幾天」，前測、後測還是老師按的為準。
   標「後測」但選到還沒教完的課（標「還沒教」，或結束日還沒到）、標「前測」但選到已經教完的課（結束日是今天或更早）時，把這些課合併成一句。
   沒填日期的課（依年級自動判斷）不提醒。每位選到的學生各有各的日期，任何一位對不上就列出來；還沒選學生就看全班預設 */
function ppWarnHtml(){
  if(!ppOn() || !state.prepost || !state.lessons.length) return "";
  const who = selKids().map(k => k.code); if(!who.length) who.push("");
  const state_ = t => t.type === "notYet" ? "notYet" : t.type !== "dates" ? "" : t.end ? (parse(t.end) <= today ? "taught" : "notYet") : t.start && parse(t.start) > today ? "notYet" : "";
  const bad = state.prepost === "後測" ? "notYet" : "taught";
  const hit = state.lessons.filter(k => who.some(c => state_(teachFor(k, c)) === bad)).sort(lessonOrderKey);
  if(!hit.length) return "";
  const many = new Set(hit.map(k => splitKey(k)[0])).size > 1;
  const names = hit.map(k => { const [b, n] = splitKey(k); return many ? `${bookName(b)} ${lessonName(b, n)}` : lessonName(b, n); }).join("、");
  return state.prepost === "後測"
    ? `提醒：${esc(names)}依教學日期看起來還沒教完，確定要標成「後測」嗎？（只是提醒，可以照樣開始；教學日期在「選單」的「教學日期管理」修改）`
    : `提醒：${esc(names)}依教學日期已經教完了，確定要標成「前測」嗎？（只是提醒，可以照樣開始；教學日期在「選單」的「教學日期管理」修改）`;
}
const lessonOrderKey = (a, b) => { const [ba, na] = splitKey(a), [bb, nb] = splitKey(b); return BOOK_ORDER.indexOf(ba) - BOOK_ORDER.indexOf(bb) || (+na - +nb); };
function renderPpWarn(){ const el = $("#ppWarn"), h = ppWarnHtml(); el.hidden = !h; el.innerHTML = h; }
function renderPrepost(){
  const box = $("#ppBox"); box.hidden = !ppOn();
  if(box.hidden) return;
  box.innerHTML = `<b>這次是前測還是後測？</b><div class="group">${PP_OPTS.map(([v, name, d]) =>
      `<button class="opt ${state.prepost === v ? "on" : ""}" data-pp="${v}" aria-pressed="${state.prepost === v}">${name}<small>${d}</small></button>`).join("")}</div>
    <p class="note" style="margin:0">前測和後測的條件完全一樣。</p>`;
  box.querySelectorAll("[data-pp]").forEach(b => b.onclick = () => { state.prepost = b.dataset.pp; render(); });
}

/* ---------- 四個步驟：一次只看一步（像生字賓果） ----------
   1 選目標和評量方式（快速開始的卡片、進階的正式或練習）→ 2 選學生和課次 → 3 選作答方式（大螢幕、平板）→ 4 選玩法和主題
   （2026-10-24 維護者改的順序：先決定「怎麼玩」，再決定「玩什麼」；右邊的摘要和「開始」只在第 4 步出現）。
   每一步要先完成才能往下；第 3 步只剩一個選項時自動跳過（例如小考：只能大螢幕）。上方的步驟標籤也可以直接點。 */
const WSTEPS = ["選目標和評量方式", "選學生和課次", "選作答方式", "選玩法和主題"];
let wstep = 1;
/* 每一步還缺什麼（空字串＝可以往下） */
const step1Miss = () => "";
const step2Miss = () => !selKids().length ? (isQuick() ? "請先點選要做的學生" : "請先點選要評量的學生") : !state.lessons.length ? "請先選課次" : "";
function step3Miss(){
  const n = selKids().length, a = ANSWERS.find(x => x.id === state.answer);
  if(n < a.min || n > a.max) return `「${a.name}」可以 ${a.min}～${a.max} 位學生，目前 ${n} 位`;
  /* 分區輪流先只開放練習的正確率模式（E14；正式評量等 A3，流暢性是一人一回合，版面不同） */
  if(a.id === "splitturn" && state.kind === "formal") return `「${a.name}」先只能用在練習，正式評量請改選「大螢幕・輪流」`;
  if(a.id === "splitturn" && state.mode === "flu") return `「${a.name}」還不能用在流暢性模式，請改選「大螢幕・輪流」`;
  return "";
}
/* 能選的作答方式（快速開始只列大螢幕輪流、分區輪流、平板掃 QR code） */
/* 只選一位學生時不列分區輪流（沒有別人的區可以分，2026-10-25 維護者要求） */
const answerList = () => ANSWERS.filter(a => (!isQuick() || a.id === "turn" || a.id === "splitturn" || a.id === "qr") && (a.id !== "splitturn" || selKids().length > 1));
const isTurnLike = id => id === "turn" || id === "splitturn";   /* 大螢幕輪流（全螢幕或分區） */
const answerOff = a => a.off || "";
/* 第 3 步可以跳過嗎：作答方式只有一個能選 */
const skip3 = () => answerList().filter(a => !answerOff(a)).length === 1 && !step3Miss();
function renderWizard(){
  const miss = [step1Miss(), step2Miss(), step3Miss()];
  /* 第 n 步能不能去：前面每一步都要完成 */
  const can = n => miss.slice(0, n - 1).every(m => !m);
  $("#wTabs").innerHTML = WSTEPS.map((t, i) => `<button class="wtab ${i + 1 < wstep ? "ok" : ""}" data-w="${i + 1}" ${i + 1 === wstep ? 'aria-current="step"' : ""} ${can(i + 1) ? "" : "disabled"}><span class="n">${i + 1}</span>${t}${i === 2 && skip3() ? "<small>（不用選）</small>" : ""}</button>`).join("");
  $("#wTabs").querySelectorAll("button:not(:disabled)").forEach(b => b.onclick = () => showStep(+b.dataset.w));
  $("#wPrev").hidden = wstep === 1;
  $("#wNext").hidden = wstep === WSTEPS.length;
  $("#wNext").disabled = !can(wstep + 1);
  $("#wNote").textContent = wstep === 4 ? "確認摘要後，按「開始」。" : miss[wstep - 1];
}
function showStep(n){
  wstep = n;
  document.querySelectorAll("#setup .wstep").forEach(d => d.hidden = +d.dataset.step !== n);
  $("#layout").dataset.step = n;
  renderWizard();
}
/* 上一步、下一步：第 3 步可以跳過時直接跳過 */
const nextStep = d => { const n = wstep + d; return n === 3 && skip3() ? n + d : n; };
$("#wPrev").onclick = () => { showStep(nextStep(-1)); $("#wTabs").scrollIntoView({block:"nearest"}); };
$("#wNext").onclick = () => { showStep(nextStep(1)); $("#wTabs").scrollIntoView({block:"nearest"}); };

/* 右上角「選單」：點了裡面的項目或點選單外面就收起來 */
$("#topMenu .menulist").addEventListener("click", e => {
  if(!e.target.closest("button,a")) return;
  $("#topMenu").open = false;
  if(e.target.closest("button")) $("#topMenu summary").focus();   /* 面板關掉後，游標回到「選單」 */
}, true);
document.addEventListener("click", e => { if($("#topMenu").open && !e.target.closest("#topMenu")) $("#topMenu").open = false; });
document.addEventListener("keydown", e => { if(e.key === "Escape" && $("#topMenu").open){ $("#topMenu").open = false; $("#topMenu summary").focus(); } });

let showOffGoals = false;   /* 「顯示準備中的功能」：預設收起來，老師好奇再點開（不存起來） */
function renderGoals(){
  const btn = g => `<button class="goal ${state.goal===g.id?"on":""}" data-g="${g.id}" ${g.off?"disabled":""} aria-pressed="${state.goal===g.id}">
      <b>${g.name}</b><span class="what">${g.what}</span>${g.img ? `<img class="shot" src="${g.img}" alt="${g.name}的作答畫面" loading="lazy">` : ""}${g.off ? `<span class="pill warn">${g.off}</span>` : ""}</button>`;
  const col = grp => {
    const list = GOALS.filter(g => g.group === grp && (showOffGoals || !g.off));
    return `<div class="gcol"><h3>${grp}</h3><div class="goals">${list.length ? list.map(btn).join("") : `<p class="note" style="margin:0">還沒有開放的目標</p>`}</div></div>`;
  };
  const offN = GOALS.filter(g => g.off).length;
  $("#goals").innerHTML = `<div class="goalcols">${col("識字")}<div class="gdiv" aria-hidden="true"></div>${col("寫字")}</div>
    <button class="linkbtn" id="goalOff" aria-expanded="${showOffGoals}">${showOffGoals ? "收起準備中的功能" : `顯示準備中的功能（${offN} 個）`}</button>`;
  $("#goals").querySelectorAll("button.goal:not(:disabled)").forEach(b => b.onclick = () => { state.goal = b.dataset.g; render(); });
  $("#goalOff").onclick = () => { showOffGoals = !showOffGoals; renderGoals(); };
}

function renderKind(){
  $("#kinds").innerHTML = KINDS.map(k => `<button class="opt ${state.kind===k.id?"on":""} ${k.id==="practice"?"prac":""}" data-k="${k.id}" aria-pressed="${state.kind===k.id}">${k.name}<small>${k.desc}</small></button>`).join("");
  $("#kinds").querySelectorAll("button").forEach(b => b.onclick = () => { state.kind = b.dataset.k; render(); });
  $("#modes").innerHTML = MODES.map(m => `<button class="opt ${state.mode===m.id?"on":""}" data-m="${m.id}" aria-pressed="${state.mode===m.id}">${m.name}<small>${m.desc}</small></button>`).join("");
  $("#modes").querySelectorAll("button").forEach(b => b.onclick = () => {
    state.mode = b.dataset.m;
    render();
  });
  $("#fluBox").hidden = state.mode !== "flu";
  $("#limits").innerHTML = LIMITS.map(([v,t]) => `<button class="chip ${state.limit===v?"on":""}" data-l="${v}">${t}</button>`).join("");
  $("#limits").querySelectorAll("button").forEach(b => b.onclick = () => { state.limit = b.dataset.l; render(); });

  const c = current();
  if(c.formal || c.flu){
    $("#choiceArea").innerHTML = `<div class="locked"><span class="lock">固定</span><span>${choiceText(settings.choices)}（${c.flu && !c.formal ? "流暢性模式使用標準條件" : "正式評量的標準條件"}）。<button class="linkbtn" data-open="set">到評量設定修改</button></span></div>`;
  } else {
    $("#choiceArea").innerHTML = `<div class="group">${CHOICES.map(([v,t]) => `<button class="chip ${state.pChoices===v?"on":""}" data-c="${v}">${t}</button>`).join("")}</div>
      ${c.choices === "bingo" ? `<p class="note">第 4 步的玩法選了「生字賓果」，這次用賓果卡作答，選項數不適用。</p>` : ""}`;
    $("#choiceArea").querySelectorAll("[data-c]").forEach(b => b.onclick = () => { state.pChoices = b.dataset.c; render(); });
  }
}

/* 提示選項：不適合這個評量目標的提示（data.js 的 HINT_UNFIT）停用，滑鼠移上去看原因 */
function hintChips(set, onToggle, disabled, goal = state.goal){
  const why = id => unfitWhy(goal, id);   /* 評量設定（所有評量目標共用）傳 goal＝""，不停用 */
  return LEVELS.map(l => `<div class="lv"><span class="n">${l.n}<br><span class="who">${l.who}</span></span>
    <div class="group">${l.items.map(([id,t]) => `<button class="chip ${set.has(id) && !why(id)?"on":""}" data-h="${id}" ${disabled || why(id)?"disabled":""} ${why(id)?`title="${why(id)}"`:""} aria-pressed="${set.has(id) && !why(id)}">${t}</button>`).join("")}</div></div>`).join("")
    + `<div class="lv"><span class="n">4～7<br><span class="who">老師按鈕</span></span><span class="note" style="margin:0">${TEACHER}：作答畫面上隨時可按，按了就記錄</span></div>`;
}

function ruleEditor(rule, onChange){
  /* 每一步都可以選：出現下一個提示／沒有提示也不顯示答案（讓學生自己點）／顯示答案；選錯的選項每次都會停用 */
  return rule.map((r,i) => `<li><span class="k">錯 ${i+1} 次</span><select data-i="${i}" aria-label="答錯第 ${i+1} 次">${["next","free","reveal"].map(v => `<option value="${v}" ${(r === "remove" ? "free" : r)===v?"selected":""}>${REACT[v]}</option>`).join("")}</select></li>`).join("");
}

/* 第 4 步的提示：快速開始只顯示（所有學生一樣）；進階設定的練習可以改，也可以每位學生不同 */
function renderHints(){
  const c = current(), area = $("#hintArea");
  if(c.noHelp){
    $("#h3hint").textContent = c.flu ? "流暢性模式不給提示，答錯不重答。" : "正式評量不給提示、不回饋對錯，所有學生都一樣，這裡只顯示。";
    area.innerHTML = `<div class="locked"><span class="lock">固定</span><span>無提示・答錯就記錯，進入下一題</span></div>`;
    return;
  }
  /* 這個評量目標會跳過哪些提示（例如部件重組不用部件、聲音提示） */
  const skipped = LEVELS.flatMap(l => l.items).filter(([id]) => unfitWhy(state.goal, id));
  const skipNote = skipped.length ? `<p class="note" style="margin:8px 0 0">這個評量目標不用：${skipped.map(([id, t]) => `${t}（${unfitWhy(state.goal, id)}）`).join("、")}，系統會自動跳過。</p>` : "";
  if(c.formal || isQuick()){
    $("#h3hint").textContent = "所有學生都用同一組提示。要調整，或讓每位學生不同，請切換到「進階設定」。";
    area.innerHTML = `<div class="locked"><span class="lock">全部學生</span><div style="display:grid;gap:8px">${ruleFlow(c.rule, c.hints)}
      <span class="note" style="margin:0">老師提示（${TEACHER}）可隨時按按鈕記錄。</span></div></div>${skipNote}`;
    return;
  }
  /* 進階設定的練習：上方選「設定給誰」，全部學生＝共用的一組；點某位學生可以幫他個別設定 */
  const list = selKids();
  if(state.hintFor && !list.includes(state.hintFor)) state.hintFor = "";
  const who = state.hintFor, own = who && state.kidHints[who], k = who && kidBy(who);
  const set = who ? (own ? own.hints : state.pHints) : state.pHints, rule = who ? (own ? own.rule : state.pRule) : state.pRule;
  $("#h3hint").textContent = "練習可以自由選提示和答錯規則，提示會依層級由少到多出現。也可以點學生，幫某位學生個別設定。";
  area.innerHTML = `<div class="hintfor"><b>設定給：</b>${chipRow([["", "全部學生"], ...list.map(code => [code, `${esc(kidLabel(kidBy(code)))}${state.kidHints[code] ? "・個別" : ""}`])], who, "hfor")}</div>
    ${who && !own ? `<p class="note" style="margin:0 0 10px">${esc(kidLabel(k))}目前和全部學生相同：</p>${ruleFlow(current().rule, current().hints)}
      <p><button class="chip" id="hOwn">幫${esc(kidShow(k))}個別設定</button></p>` : `
    ${who ? `<p class="note" style="margin:0 0 10px">${esc(kidLabel(k))}的個別設定（只套用在這位學生）。<button class="linkbtn" id="hShared">改回和全部學生相同</button></p>` :
      list.some(code => state.kidHints[code]) ? `<p class="note" style="margin:0 0 10px">沒有個別設定的學生都用這一組。</p>` : ""}
    <p class="sub">提示</p><div class="levels">${hintChips(set)}</div>
    <p class="sub">答錯後的處理</p><ol class="ladder">${ruleEditor(rule)}</ol>
    <p class="sub">實際順序</p>${ruleFlow(rule, fitHints(state.goal, HINT_ORDER.filter(h => set.has(h))))}${skipNote}`}`;
  area.querySelectorAll("[data-hfor]").forEach(b => b.onclick = () => { state.hintFor = b.dataset.hfor; render(); });
  if($("#hOwn")) $("#hOwn").onclick = () => { state.kidHints[who] = {hints: new Set(state.pHints), rule: [...state.pRule]}; render(); };
  if($("#hShared")) $("#hShared").onclick = () => { delete state.kidHints[who]; render(); };
  area.querySelectorAll("[data-h]").forEach(b => b.onclick = () => { const id = b.dataset.h; set.has(id) ? set.delete(id) : set.add(id); render(); });
  area.querySelectorAll(".ladder select").forEach(s => s.onchange = () => { rule[+s.dataset.i] = s.value; render(); });
}

/* ---------- 第 4 步：怎麼玩（玩法、注音、報讀）與主題 ----------
   練習在這裡自由選；正式評量照「評量設定」，這裡只顯示（從基線期起每次都一樣，前後才能比較）。 */
const playName = id => (PLAYS.find(p => p.id === id) || {}).name || "";
function playText(){
  const c = current();
  if(!useRewards()) return "不用主題（評量設定）";
  const card = willFight() && state.themePick && gameCard(state.themePick);
  const base = willFight() ? `遊戲${card ? `・${card.act}` : ""}（${team() === "coop" && selKids().length > 1 ? "大家合作" : "個人"}）` : c.choices === "bingo" ? (sharedBingo() ? "生字賓果（大家共用一張卡）" : "生字賓果") : "一般";
  return base;
}
function renderPlay(){
  const c = current(), formal = c.formal, row = (t, body) => `<div class="playrow"><span class="tl">${ROW_ICONS[t] || ""}${t}</span><div>${body}</div></div>`;
  $("#playHint").textContent = formal ? "正式評量的玩法照「評量設定」，從基線期起每次都一樣，這裡只顯示。" : "練習可以自由選玩法。選「遊戲」時，請學生在下面點一張遊戲卡片；其他玩法點一個主題。";
  const rows = [];
  if(formal){
    const fid = willFight() ? "game" : "color";
    rows.push(row("玩法", `<div class="locked"><span class="lock">固定</span>${useRewards() ? `<span class="playicon">${PLAYS.find(x => x.id === fid).icon}</span>` : ""}<span>${playText()}。<button class="linkbtn" data-open="set">到評量設定修改</button></span></div>`));
    rows.push(row("報讀", `<span class="note" style="margin:0">${state.goal === "R4" ? "部件重組沒有報讀" : "不念（正式評量不提示）"}</span>`));
  } else {
    /* 不能用的玩法寫原因（data.js 的 playWhy：流暢性只能一般、分區輪流不能玩賓果） */
    const why = playWhy, cur = playNow();
    /* 三張卡片：小圖示＋名稱＋一句話；不能用的卡片寫原因 */
    rows.push(row("玩法", `<div class="playcards">${PLAYS.map(x => `<button class="opt playcard ${cur === x.id ? "on" : ""}" data-play="${x.id}" aria-pressed="${cur === x.id}" ${why(x.id) ? "disabled" : ""}>
        <span class="playicon">${x.icon}</span><span><b>${x.name}</b><small>${why(x.id) || x.desc + ((x.id === "game" || x.id === "bingo") && coopPossible() ? (x.id === "game" ? "（多位學生輪流作答、大家合作）" : "（多位學生輪流作答、共用一張卡）") : "")}</small></span></button>`).join("")}</div>`));
    rows.push(row("注音", `<div class="group">${chipRow([["0", "選項不加"], ["1", "選項加注音"]], settings.practiceBpmf ? "1" : "0", "bpmf")}</div>
      <p class="note">語詞、句子提示一律有注音。</p>`));
    rows.push(row("報讀", state.goal === "R4" ? `<span class="note" style="margin:0">部件重組沒有報讀（會念出答案的讀音）。</span>`
      : `<div class="group">${chipRow([["1", "提示可以按喇叭念出來"], ["0", "不念"]], settings.practiceRead !== false ? "1" : "0", "read")}</div>`));
  }
  $("#playArea").innerHTML = rows.join("");
  const bind = (key, f) => $("#playArea").querySelectorAll(`[data-${key}]:not(:disabled)`).forEach(b => b.onclick = () => { f(b.dataset[key]); saveSettings(); render(); });
  bind("play", v => settings.practicePlay = v);
  bind("bpmf", v => settings.practiceBpmf = v === "1");
  bind("read", v => settings.practiceRead = v === "1");
}
const themeText = () => !state.themePick ? null : state.themePick === "none" ? "不用主題" : themeName(state.themePick);
/* 摘要的提示：有學生個別設定時，分行列出 */
function hintsText(c){
  const one = h => h.length ? h.map(hintName).join(" → ") : "無提示";
  const own = selKids().filter(code => kidCfg(c, code).hints !== c.hints);
  if(!own.length) return one(c.hints);
  return [`全部學生：${one(c.hints)}`, ...own.map(code => `${esc(kidLabel(kidBy(code)))}：${one(kidCfg(c, code).hints)}`)].join("<br>");
}
/* 主題卡片：請學生直接點。玩遊戲時改成遊戲卡片（主題・動作，例如「太空任務・打外星人」，data.js 的 GAME_CARDS），
   點一張就同時選好主題和遊戲；玩遊戲一定要有主題，沒有「不用主題」 */
function renderThemePick(){
  $("#themeSec").hidden = !useRewards();
  if(!useRewards()) return;
  const fight = willFight(), list = selKids().map(kidBy);
  if(fight && !gameCard(state.themePick)){ if(state.themePick) flowNote("這次玩遊戲，原本選的主題沒有遊戲，請重新選一個遊戲。"); state.themePick = ""; }
  $("#h8").textContent = fight ? "選一個喜歡的遊戲！" : "選一個喜歡的主題！";
  const ids = fight ? GAME_CARDS.map(c => c.theme) : Themes.ids;
  const NAME = id => fight ? `${Themes.THEMES[id].name}・${gameCard(id).act}` : Themes.THEMES[id].name;
  const LINE = id => fight ? Themes.THEMES[id].line : `可以得到${Themes.THEMES[id].name}的貼紙`;
  $("#pickWho").innerHTML = list.map(k => `<span class="pk">${Rewards.avatarHtml(k.code)}${esc(kidShow(k))}</span>`).join("");
  $("#themes").innerHTML = ids.map(id => { const t = Themes.THEMES[id];
    return `<button class="theme ${state.themePick === id ? "on" : ""}" data-skin="${id}" data-t="${id}" aria-pressed="${state.themePick === id}">${Themes.icon(id, t.stickers[0][0])}${esc(NAME(id))}<small>${esc(LINE(id))}</small></button>`; }).join("")
    + (fight ? "" : `<button class="theme none ${state.themePick === "none" ? "on" : ""}" data-t="none" aria-pressed="${state.themePick === "none"}"><span style="font-size:72px;line-height:110px">☆</span>不用主題<small>一樣可以得到貼紙</small></button>`);
  $("#themes").querySelectorAll("button").forEach(b => b.onclick = () => { state.themePick = b.dataset.t; render(); });
}

const splitKey = k => k.split("-");
const EDITIONS = [...new Set(BOOK_ORDER.map(b => BOOKS[b].edition))];
/* 這課這次要考幾個字（有「只考有教的字」就只算點選的字，見 wordsets.js） */
const lessonSize = k => wsPick(k).length;
/* 依版本分組顯示已選課次，例如「翰林 2上 第 1、2 課」 */
function lessonsText(){
  const by = new Map();
  for(const k of state.lessons){ const [b,n] = splitKey(k); if(!by.has(b)) by.set(b, []); by.get(b).push(n); }
  return [...by].map(([b,ns]) => { ns.sort((x,y) => x-y);
    const pre = ns.filter(n => n === "0").map(n => lessonName(b, n)), rest = ns.filter(n => n !== "0");
    return `${bookName(b)} ${[...pre, rest.length ? `第 ${rest.join("、")} 課` : ""].filter(Boolean).join("、")}`; }).join("；");
}
function renderLessons(){
  $("#eds").innerHTML = EDITIONS.map(e => `<button class="opt ${state.ed===e?"on":""}" data-e="${e}" aria-pressed="${state.ed===e}">${e}</button>`).join("");
  $("#eds").querySelectorAll("button").forEach(btn => btn.onclick = () => { state.ed = btn.dataset.e; state.book = BOOK_ORDER.find(b => BOOKS[b].edition === state.ed); render(); });
  const books = BOOK_ORDER.filter(b => BOOKS[b].edition === state.ed);
  $("#books").innerHTML = books.map(b => `<button class="chip ${state.book===b?"on":""}" data-b="${b}" aria-pressed="${state.book===b}">${gradeTerm(b)}</button>`).join("");
  $("#books").querySelectorAll("button").forEach(btn => btn.onclick = () => { state.book = btn.dataset.b; render(); });
  const L = BOOKS[state.book].lessons;
  $("#lessons").innerHTML = Object.entries(L).map(([n,l]) => {
    const k = key(state.book,n), on = state.lessons.includes(k);
    return `<button class="lesson ${on?"on":""}" data-n="${n}" aria-pressed="${on}"><span class="t"><b>${esc(lessonName(state.book, n))}</b></span>${l.title && n !== "0" ? `<span class="ltitle">${esc(l.title)}</span>` : ""}
      <span class="chars">${esc(l.write)}${l.read?`<span style="opacity:.6">・${esc(l.read)}</span>`:""}</span>${on && wsPartial(k) ? `<span class="wsp">只考 ${lessonSize(k)}／${l.total} 字</span>` : ""}</button>`;
  }).join("");
  $("#lessons").querySelectorAll("button").forEach(b => b.onclick = () => {
    const k = key(state.book, b.dataset.n);
    state.lessons = state.lessons.includes(k) ? state.lessons.filter(x => x !== k) : [...state.lessons, k];
    render();
  });
  $("#picked").innerHTML = state.lessons.length ? `已選：${esc(lessonsText())}　<button class="linkbtn" id="clearLessons">全部清除</button>` : "還沒選課次，可以選好幾課，也可以跨版本。";
  if($("#clearLessons")) $("#clearLessons").onclick = () => { state.lessons = []; render(); };
  renderTaught();
  renderPpWarn();
  $("#status").innerHTML = "";   /* 2026-10-25 A8：不再判斷每課的評量時機；教學日期到「選單 → 教學日期」輸入 */
}

/* 出題設定：題數、出題方式、預估時間 */
const METHODS = [
  {id:"even",  name:"平均隨機", desc:"各課平均隨機；練習時加入 20% 常用字"},
  {id:"weak",  name:"常錯優先", desc:"先出常答錯、反應慢的字", need:"需要累積作答紀錄（第 1 版開始記錄）"},
  {id:"freq",  name:"字頻優先", desc:"先出常用字", need:"需要匯入字頻資料", ok:() => typeof FREQ !== "undefined",
   okText:"所選課次中，依教育部字頻總表排名最常用的字先出，出題順序打散"}
];
const SEC_PER_ITEM = {turn:8, splitturn:8, split:8, present:15};
const FREQ_SHARE = 0.2; /* 平均隨機中先出常用字的比例 */
/* 練習的預設題數：一課的字數每課不同，多位學生輪流時會玩很久，所以練習預設一次 10 個字（2026-10-21 維護者決定）。
   正式評量仍是一課的量，成績才能代表整課的程度。 */
const PRACTICE_COUNT = 10;
/* 一課的量：所選版本每課生字數的平均 */
function oneLesson(){
  const books = [...new Set(state.lessons.map(k => splitKey(k)[0]))];
  const sizes = books.flatMap(b => Object.values(BOOKS[b].lessons).map(l => l.total));
  return sizes.length ? Math.round(sizes.reduce((a,b) => a+b, 0) / sizes.length) : 0;
}
function quizPlan(){
  /* 生字賓果：整次一張卡，最多 36 格、同一個字只問一次，所以每人最多 36 題（play.js 的 startSession） */
  const bingo = bingoOK(current());
  const nKids = Math.max(1, selKids().length), shared = bingo && sharedBingo();
  const pool = bingo ? Math.min(shared ? Math.floor(36 / nKids) : 36, new Set(state.lessons.flatMap(k => wsPick(k))).size) : state.lessons.reduce((s,k) => s + lessonSize(k), 0);
  const one = Math.min(oneLesson(), pool);
  const def = state.kind === "formal" ? one : Math.min(PRACTICE_COUNT, pool);   /* 預設題數 */
  /* state.qCount：null＝預設、"all"＝全部（換課次後仍是全部）、數字＝老師自己輸入的題數 */
  const count = state.qCount === "all" ? pool : Math.min(pool, state.qCount ?? def);
  const isAll = count === pool, isDefault = count === def;
  /* 題數等於預設（練習 10 個字、正式評量一課的量）或全部出題時，不需要選出題方式；正式評量固定平均隨機 */
  const canChoose = state.kind !== "formal" && !isAll && !isDefault;
  const method = isAll ? "all" : canChoose ? state.qMethod : "even";
  /* 平均隨機：練習時 20% 先取所選課次中字頻最高的字，其餘 80% 平均分到各課隨機抽。
     正式評量不加常用字，每個字被抽到的機會相同，成績才能代表整課的程度。 */
  const freqN = method === "even" && state.kind !== "formal" ? Math.round(count * FREQ_SHARE) : 0;
  const order = [...state.lessons].sort((a,b) => lessonSize(b) - lessonSize(a));
  const per = new Map(state.lessons.map(k => [k, 0]));
  let left = method === "all" || method === "even" ? count - freqN : 0;
  while(left > 0){ let moved = false;
    for(const k of order){ if(left && per.get(k) < lessonSize(k)){ per.set(k, per.get(k)+1); left--; moved = true; } }
    if(!moved) break; }
  const n = Math.max(1, selKids().length);
  const sec = count * (SEC_PER_ITEM[state.answer] || 8) * (isTurnLike(state.answer) ? n : 1);
  return {pool, one, def, count, isAll, isDefault, canChoose, method, freqN, per, sec, n, bingo, shared};
}
/* 題數旁的補充說明：賓果卡的上限、只考部分字（練習和正式評量各自點選的字組，題數以點選的字為準） */
const extraNote = q => (q.shared ? `大家共用一張賓果卡，最多 36 格，全隊合計最多 36 題（每人最多 ${Math.floor(36 / q.n)} 題），同一個字只考一次。` : q.bingo ? "生字賓果卡最多 36 格，每人最多 36 題，同一個字只考一次。" : "")
  + (state.lessons.some(k => wsPartial(k)) ? "有課只考部分的字（第 2 步「只考有教的字」），題數以點選的字為準。" : "");
const methodName = m => m === "all" ? "全部出題" : METHODS.find(x => x.id === m).name;
const minutes = s => s < 60 ? "不到 1 分鐘" : `約 ${Math.ceil(s / 30) / 2} 分鐘`;
function renderQuiz(){
  const box = $("#quiz");
  if(!state.lessons.length){ box.innerHTML = `<p class="note" style="margin:0">選好課次後，這裡會設定題數。</p>`; return; }
  if(state.mode === "flu"){ box.innerHTML = `<div class="locked"><span class="lock">流暢性</span><span>在 ${LIMITS.find(l => l[0]===state.limit)[1]} 內，從所選課次的 ${quizPlan().pool} 個字隨機連續出題，題數不固定。</span></div>`; return; }
  const q = quizPlan();
  /* 快速開始只顯示題數和時間；要改題數請到進階設定 */
  /* 練習：「快速隨選」＝預設隨機 10 個字，「全課生字」＝所選課次的字全部考；不到 10 個字就直接全課生字。
     正式評量的題數固定，要改請到進階設定 */
  if(isQuick()){
    const practice = state.kind !== "formal", short = q.pool <= q.def;
    const pick = !practice || short ? "" : `<div class="group" role="group" aria-label="題數">
      <button class="chip ${q.isAll ? "" : "on"}" data-qq="def" aria-pressed="${!q.isAll}">快速隨選</button>
      <button class="chip ${q.isAll ? "on" : ""}" data-qq="all" aria-pressed="${q.isAll}">全課生字</button></div>`;
    /* 剛好 10 個字：兩個按鈕一樣，不顯示也不說明；真的不到 10 個字才寫明 */
    const note = (practice ? (q.pool < PRACTICE_COUNT ? "不到 10 個字，全課生字都考。" : "") : "要改題數，請切換到「進階設定」。") + extraNote(q);
    box.innerHTML = `${pick}<p class="time"><b>${q.count} 題，${minutes(q.sec)}</b><span class="note" style="margin:0">${selKids().length > 1 ? "（學生輪流作答）" : ""}${note}</span></p>`;
    box.querySelectorAll("[data-qq]").forEach(b => b.onclick = () => { state.qCount = b.dataset.qq === "all" ? "all" : null; render(); });
    return;
  }
  const manyBooks = new Set(state.lessons.map(k => splitKey(k)[0])).size > 1;
  const perText = [...q.per].filter(([,v]) => v).map(([k,v]) => `${manyBooks ? bookName(splitKey(k)[0]) + " " : ""}${lessonName(...splitKey(k))} ${v}`).join("、");
  let how;
  if(q.isAll) how = `<p class="note" style="margin:0">所選課次的 ${q.pool} 個字全部出題，順序隨機，不需要選出題方式。</p>`;
  else {
    const head = q.canChoose
      ? `<div class="group"><span>出題方式</span>${METHODS.map(m => `<button class="chip ${q.method===m.id?"on":""}" data-qm="${m.id}">${m.name}</button>`).join("")}</div>`
      : `<div class="locked"><span class="lock">${q.isDefault ? "預設" : "固定"}</span><span>平均隨機${q.isDefault ? "。改變題數後，練習可以選其他出題方式" : "（正式評量固定，避免只挑難字讓正確率偏低）"}</span></div>`;
    const m = METHODS.find(x => x.id === q.method);
    const detail = q.method === "even" && !q.freqN
      ? `<p class="note" style="margin:0">每個字被抽到的機會相同${perText ? `（${perText}）` : ""}。正式評量不額外加常用字，成績才能代表整課的程度。</p>`
      : q.method === "even"
      ? `<p class="note" style="margin:0">常用字 ${q.freqN} 題（所選課次中字頻最高的字，多複習、先有成功經驗）＋ 平均隨機 ${q.count - q.freqN} 題${perText ? `（${perText}）` : ""}。${typeof FREQ === "undefined" ? `<br><span class="warn">字頻資料匯入前，常用字的部分暫時也用隨機。</span>` : ""}</p>`
      : m.ok && m.ok()
      ? `<p class="note" style="margin:0">${m.okText}。</p>`
      : `<p class="note warn" style="margin:0">${m.desc}。${m.need}，目前會先用平均隨機。</p>`;
    how = head + detail;
  }
  box.innerHTML = `
    <label class="group" for="qCount">題數 <input id="qCount" type="number" min="1" max="${q.pool}" value="${q.count}"> 題
      ${state.kind === "formal" ? "" : `<button class="chip ${q.isDefault?"on":""}" data-qc="def">快速隨選（${q.def} 字）</button>`}
      <button class="chip ${q.count === q.one && (state.kind === "formal" || state.qCount != null) ?"on":""}" data-qc="one">一課的量（${q.one} 字）</button>
      <button class="chip ${q.isAll?"on":""}" data-qc="all">全課生字（${q.pool} 字）</button></label>
    ${how}
    <p class="time"><b>${minutes(q.sec)}</b>　<span class="note" style="margin:0">${isTurnLike(state.answer) && q.n > 1 ? `${q.n} 位學生輪流，每人 ${q.count} 題，` : ""}每題約 ${SEC_PER_ITEM[state.answer] || 8} 秒估算${extraNote(q)}</span></p>`;
  $("#qCount").onchange = e => { const v = Math.max(1, Math.min(q.pool, +e.target.value || 1)); state.qCount = v; render(); };
  box.querySelectorAll("[data-qc]").forEach(b => b.onclick = () => {
    const qc = b.dataset.qc;
    state.qCount = qc === "all" ? "all" : qc === "one" && state.kind !== "formal" ? q.one : null;
    render();
  });
  box.querySelectorAll("[data-qm]").forEach(b => b.onclick = () => { state.qMethod = b.dataset.qm; render(); });
}

/* 平板作答（tablet.js）：快速開始和進階設定都有（2026-10-23 維護者要求放進快速開始）；
   練習和正式評量都能用（2026-10-25 起，A3-18） */
const qrOn = () => state.answer === "qr";
function renderAnswers(){
  const n = selKids().length;
  $("#answerHint").textContent = `同一份題目可以用不同方式作答。這次有 ${n} 位學生。`;
  /* 人數不合的作答方式不停用（老師可能要回第 2 步改學生），下方提醒會寫原因 */
  $("#answers").innerHTML = answerList().map(a => `<button class="opt ${state.answer===a.id?"on":""}" data-a="${a.id}" ${answerOff(a)?"disabled":""} aria-pressed="${state.answer===a.id}">${a.name}<small>${answerOff(a) && !a.desc.includes(answerOff(a))?`${a.desc}（${answerOff(a)}）`:a.desc}</small></button>`).join("");
  $("#answers").querySelectorAll("button:not(:disabled)").forEach(b => b.onclick = () => { state.answer = b.dataset.a; render(); });
}
function renderKids(){
  /* 人數上限不在這裡寫，第 3 步選作答方式時，人數不合的選項會寫原因 */
  $("#kidsHintQ").textContent = "點選要做的學生，可以選好幾位。";
  /* 選學生的按鈕只顯示頭像和名字（2026-10-25 維護者要求）；沒填名字顯示代號、同名的才加代號分辨 */
  $("#kids").innerHTML = kids.map(k => `<button class="chip kidchip ${state.kids.has(k.code)?"on":""}" data-k="${esc(k.code)}" aria-pressed="${state.kids.has(k.code)}">${Rewards.avatarHtml(k.code)}${esc(k.name && kids.filter(o => o.name === k.name).length === 1 ? k.name : kidLabel(k))}</button>`).join("");
  $("#kids").querySelectorAll("button").forEach(b => b.onclick = () => { const k = b.dataset.k; state.kids.has(k) ? state.kids.delete(k) : state.kids.add(k); render(); });
}
/* =========================================================
   5. 彈出面板（學生名單、教學日期、評量設定）
   ========================================================= */

/* 學生名單面板 */
let openPlan = null, openAv = null;   /* 目前展開的「本學期安排」「選頭像」是哪位學生 */
function renderKidSheet(){
  $("#kTable").innerHTML = kids.map((k,i) => {
    const p = planOf(k), open = openPlan === k.code;
    return `<div class="krow" data-i="${i}">
    <button class="avedit" data-avopen aria-expanded="${openAv === k.code}" aria-label="更換${esc(kidShow(k))}的頭像">${Rewards.avatarHtml(k.code)}</button>
    <input aria-label="代號" data-f="code" value="${esc(k.code)}" maxlength="8">
    <input aria-label="名字" data-f="name" value="${esc(k.name||"")}" maxlength="10" placeholder="學生看到的名字">
    <select aria-label="年級" data-f="grade">${GRADES.map((g,j) => `<option value="${j+1}" ${kidGrade(k)===j+1?"selected":""}>${g}年級</option>`).join("")}</select>
    <button class="chip ${adjLevel(k) || dosage(p) ? "on" : ""}" data-plan aria-expanded="${open}">本學期安排${adjLevel(k) || dosage(p) ? " ✓" : ""}</button>
    <button class="chip" data-del>刪除</button></div>
    ${open ? `<div class="plan" data-i="${i}">
      <p class="note" style="margin:0">${SCHOOL_YEAR} 學年${TERM}學期・選填。每學期分開記錄，換學期時舊資料會保留，分析時用來比較不同安排的效果。</p>
      <label><input type="checkbox" data-adj ${p.adjust?"checked":""}> 課程有調整（重整）到其他年級${p.adjust ? `：<select data-p="level" aria-label="調整到幾年級">${GRADES.map((g,j) => `<option value="${j+1}" ${(p.level||kidGrade(k))===j+1?"selected":""}>${g}年級</option>`).join("")}</select>` : ""}</label>
      ${SERVICES.map(v => `<div class="svc"><b>${v.name}</b>
        <span class="n">${v.parts.map(([id,t]) => `<label>${t} <input type="number" min="0" max="40" data-p="${id}" value="${p[id] ?? ""}" placeholder="0" aria-label="${v.name}${t}節數"> 節</label>`).join("")}</span>
        <label class="start">開始日期（選填）<input type="date" data-d="${v.id}Start" value="${p[v.id+"Start"] || ""}" aria-label="${v.name}開始日期"></label></div>`).join("")}
      <p class="note" style="margin:0">開始日期留空，代表本學期一開始就有上。學期中才加入的課程請填日期，分析時可以比較加入前後的差異。</p>
    </div>` : ""}
    ${openAv === k.code ? avatarPanel(k) : ""}`;
  }).join("");
  $("#kTable").querySelectorAll(".krow").forEach(r => {
    const k = kids[+r.dataset.i];
    r.querySelectorAll("[data-f]").forEach(f => f.onchange = () => {
      if(f.dataset.f === "grade"){ k.grade = +f.value; k.sy = SCHOOL_YEAR; }
      else if(f.dataset.f === "code"){ const v = f.value.trim(); if(!v || kids.some(x => x !== k && x.code === v)){ f.value = k.code; return; }
        if(state.kids.delete(k.code)) state.kids.add(v); if(openPlan === k.code) openPlan = v; if(openAv === k.code) openAv = v;
        Rewards.rename(k.code, v); saveGroups(getGroups().map(g => ({...g, kids: g.kids.map(c => c === k.code ? v : c)}))); k.code = v; }
      else k.name = f.value.trim();
      saveKids(); render();
    });
    r.querySelector("[data-plan]").onclick = () => { openPlan = openPlan === k.code ? null : k.code; renderKidSheet(); };
    r.querySelector("[data-avopen]").onclick = () => { openAv = openAv === k.code ? null : k.code; renderKidSheet(); };
    r.querySelector("[data-del]").onclick = () => { state.kids.delete(k.code); kids.splice(+r.dataset.i, 1); saveKids(); renderKidSheet(); render(); };
  });
  bindAvatarPanel($("#kTable .avpick"), () => { renderKidSheet(); render(); });
  renderKidGroupSheet();
  $("#kTable").querySelectorAll(".plan").forEach(r => {
    const k = kids[+r.dataset.i];
    const plan = () => ((k.plans ||= {})[PLAN_KEY] ||= {});
    r.querySelector("[data-adj]").onchange = e => { const p = plan(); p.adjust = e.target.checked; if(p.adjust && !p.level) p.level = kidGrade(k); saveKids(); renderKidSheet(); render(); };
    r.querySelectorAll("[data-d]").forEach(f => f.onchange = () => { const p = plan(); if(f.value) p[f.dataset.d] = f.value; else delete p[f.dataset.d]; saveKids(); render(); });
    r.querySelectorAll("[data-p]").forEach(f => f.onchange = () => {
      const p = plan();
      const v = f.value === "" ? undefined : Math.max(0, +f.value);
      if(v === undefined || (f.dataset.p === "level" && !v)) delete p[f.dataset.p]; else p[f.dataset.p] = v;
      saveKids(); renderKidSheet(); render();
    });
  });
}
/* 學生名單的「分組」：每組一列（組名、刪除、全部學生的加入開關） */
function renderKidGroupSheet(){
  const gs = getGroups(), box = $("#kGroups");
  box.innerHTML = gs.map((g, i) => `<div class="plan" data-gi="${i}">
    <div class="group"><input aria-label="組名" data-gname value="${esc(g.name)}" maxlength="12"><button class="chip" data-gdel>刪除這組</button></div>
    <div class="group">${kids.map(k => { const on = g.kids.includes(k.code), other = on ? null : gs.find(x => x !== g && x.kids.includes(k.code));   /* 一位學生只能在一組 */
      return `<button class="chip ${on ? "on" : ""}" data-gk="${esc(k.code)}" aria-pressed="${on}" ${other ? `disabled title="已在「${esc(other.name)}」"` : ""}>${esc(kidShow(k))}${other ? `<small>（${esc(other.name)}）</small>` : ""}</button>`; }).join("")}</div></div>`).join("")
    || `<p class="note" style="margin:0">還沒有組別。</p>`;
  const save = fn => { const all = getGroups(); fn(all); saveGroups(all); renderKidGroupSheet(); render(); };
  box.querySelectorAll("[data-gi]").forEach(r => {
    const i = +r.dataset.gi;
    r.querySelector("[data-gname]").onchange = e => { const v = e.target.value.trim(); if(!v || getGroups().some((g, j) => j !== i && g.name === v)){ e.target.value = getGroups()[i].name; return; } save(all => { all[i].name = v; }); };
    r.querySelector("[data-gdel]").onclick = () => save(all => { all.splice(i, 1); });
    r.querySelectorAll("[data-gk]").forEach(b => b.onclick = () => save(all => { const c = b.dataset.gk, ks = all[i].kids; all[i].kids = ks.includes(c) ? ks.filter(x => x !== c) : [...ks, c]; }));
  });
}
$("#addGrp").onclick = () => {
  const v = $("#newGrp").value.trim(); $("#newGrp").value = "";
  if(!v || getGroups().some(g => g.name === v)) return;
  saveGroups([...getGroups(), {name: v, kids: []}]); renderKidGroupSheet(); render();
};
$("#newGrp").addEventListener("keydown", e => { if(e.key === "Enter") $("#addGrp").click(); });
$("#addKid").onclick = () => {
  const v = $("#newKid").value.trim();
  if(!v || kids.some(k => k.code === v)) return;
  kids.push({code:v, name:"", grade:2, sy:SCHOOL_YEAR}); state.kids.add(v);
  $("#newKid").value = ""; saveKids(); renderKidSheet(); render();
};
$("#newKid").addEventListener("keydown", e => { if(e.key === "Enter") $("#addKid").click(); });

function renderSummary(){
  const c = current(), g = GOALS.find(x => x.id === state.goal), a = ANSWERS.find(x => x.id === state.answer);
  /* 快速開始：只列老師需要知道的四件事，不需要評量時機也能開始 */
  if(isQuick()){
    const p = PRESETS.find(x => x.id === state.preset), q = quizPlan(), n = selKids().length;
    $("#kindBadge").innerHTML = `<span class="badge ${p.off?"prac":""}">${p.rec}</span>`;
    const rows = [
      ["今天做什麼", `${p.name}（${g.name}）`],
      ...(p.id === "test" ? [["前後測", state.prepost || "不標"]] : []),
      ["學生", n && n <= a.max ? selKids().map(c => esc(kidLabel(kidBy(c)))).join("、") : null, n ? `一次最多 ${a.max} 位學生` : "還沒選"],
      ...(qrOn() ? [["作答方式", "平板掃 QR code"], ["回傳表單", settings.tabletForm ? "你自己的 Google 表單" : null, "請到「⚙ 細部設定 → 練習與遊戲」貼上 Google 表單網址"]] : []),
      ["課次", state.lessons.length ? esc(lessonsText()) : null],
      ["時間", !state.lessons.length ? null : c.flu ? `每位學生 ${LIMITS.find(l => l[0]===state.limit)[1]}` : `${q.count} 題，${minutes(q.sec)}`],
      ["玩法", playText()],
      ...(useRewards() ? [["主題", themeText(), "請學生點一個主題"]] : [])
    ];
    $("#sum").innerHTML = rows.map(([t,v,miss]) => `<div><dt>${t}</dt><dd class="${v?"":"miss"}">${v || miss || "還沒選"}</dd></div>`).join("");
    $("#go").disabled = rows.some(r => !r[1]);
    $("#go").textContent = qrOn() ? "產生 QR code" : "開始";
    return;
  }
  $("#go").textContent = "開始評量";
  $("#kindBadge").innerHTML = c.formal ? `<span class="badge">正式評量・納入學習分析</span>` : `<span class="badge prac">練習・另外統計</span>`;
  const lessonText = state.lessons.length ? esc(lessonsText()) : null;
  const q = quizPlan();
  const quizText = !state.lessons.length ? null : c.flu ? `時限內隨機出題（${q.pool} 字）` : `${q.count} 題・${methodName(q.method)}・${minutes(q.sec)}`;
  const multi = selKids().length > 1;
  const n = selKids().length, kidsOk = n >= a.min && n <= a.max;
  const rows = [
    ["評量目標", g.name],
    ["評量方式", c.flu ? `流暢性・${LIMITS.find(l => l[0]===state.limit)[1]}` : "正確率模式"],
    ["選項", choiceText(c.choices)],
    ["提示", hintsText(c)],
    ["玩法", playText()],
    ...(useRewards() ? [["主題", themeText(), "請學生點一個主題"]] : []),
    ["課次", lessonText],
    ["題目", quizText],
    ...(c.formal ? [["前後測", state.prepost || "不標"]] : []),
    ["作答模式", a.name],
    ...(qrOn() ? [["回傳表單", settings.tabletForm ? "你自己的 Google 表單" : null, "請到「⚙ 細部設定 → 練習與遊戲」貼上 Google 表單網址"]] : []),
    ["學生", n ? (kidsOk ? `${selKids().map(c => esc(kidLabel(kidBy(c)))).join("、")}（${n} 位）` : null) : null, n ? `「${a.name}」需要 ${a.min}～${a.max} 位，目前 ${n} 位` : "還沒選"]
  ];
  $("#sum").innerHTML = rows.map(([t,v,miss]) => `<div><dt>${t}</dt><dd class="${v?"":"miss"}">${v || miss || "還沒選"}</dd></div>`).join("");
  $("#go").disabled = rows.some(r => !r[1]);
  if(qrOn()) $("#go").textContent = "產生 QR code";
}
/* 先選主題（見 collect.js），再開始；平板作答改成顯示 QR code（見 tablet.js） */
$("#go").onclick = () => { if(qrOn()) return tabletQr(); unlockSpeech(); chooseTheme(); };

/* 教學日期管理面板：每一課一列「全班」，下面可以加「個別學生不同」的列（A8：同一課學生進度不同） */
/* 教學狀態選單＋日期欄＋目前判斷結果（全班列和個別學生列共用） */
/* 這一列的教學日期狀態說明（不再判斷評量時機） */
function dateNote(t){
  if(t.type === "notYet") return "還沒教";
  if(t.type !== "dates") return "還沒設定";
  if(!t.start) return "日期還沒填完整";
  if(!t.end) return `教學從 ${md(t.start)} 開始，還沒填結束日`;
  if(parse(t.end) < parse(t.start)) return "結束日早於開始日，請檢查日期";
  return `教學期間 ${md(t.start)}～${md(t.end)}`;
}
function dateCtl(t, label){
  return `<select data-type aria-label="${esc(label)}教學狀態">${TAUGHT.map(([v,x]) => `<option value="${v}" ${(t.type||"")===v?"selected":""}>${x}</option>`).join("")}</select>
    <div class="ds">${t.type === "dates" ? `<input type="date" aria-label="${esc(label)}開始日" data-s value="${t.start||""}"><span>到</span><input type="date" aria-label="${esc(label)}結束日" data-e value="${t.end||""}">` : ""}
    <span class="ph">${esc(dateNote(t))}</span></div>`;
}
/* 這位學生在這一課的個別設定如果是用「一組」加的，記著組名（entry.grp）；組別已刪掉就當個別學生顯示 */
const grpOf = (t, c) => { const g = (t.kids[c] || {}).grp; return g && getGroups().some(x => x.name === g) ? g : ""; };
function renderDates(){
  /* 先選版本、再選年級（和第 2 步一樣）；換版本時，選同一個年級學期的那一本，沒有就選那個版本的第一本 */
  const dEd = BOOKS[dBook].edition;
  $("#dEds").innerHTML = EDITIONS.map(e => `<button class="opt ${dEd===e?"on":""}" data-e="${e}" aria-pressed="${dEd===e}">${e}</button>`).join("");
  $("#dEds").querySelectorAll("button").forEach(btn => btn.onclick = () => {
    const inEd = BOOK_ORDER.filter(b => BOOKS[b].edition === btn.dataset.e), cur = BOOKS[dBook];
    dBook = inEd.find(b => BOOKS[b].grade === cur.grade && BOOKS[b].term === cur.term) || inEd[0]; renderDates(); });
  $("#dBooks").innerHTML = BOOK_ORDER.filter(b => BOOKS[b].edition === dEd).map(b => `<button class="chip ${dBook===b?"on":""}" data-b="${b}" aria-pressed="${dBook===b}">${gradeTerm(b)}</button>`).join("");
  $("#dBooks").querySelectorAll("button").forEach(btn => btn.onclick = () => { dBook = btn.dataset.b; renderDates(); });
  $("#dTable").innerHTML = Object.keys(BOOKS[dBook].lessons).map(n => {
    const k = key(dBook,n), t = teach[k] || {};
    const own = Object.keys(t.kids || {}).filter(kidBy), free = kids.filter(x => !own.includes(x.code));
    const grps = getGroups().map((g, gi) => ({...g, gi})).filter(g => g.kids.some(c => kidBy(c) && !own.includes(c)));   /* gi＝在完整組別清單的位置 */   /* 學生名單的組別（只有學生代號） */
    return `<div class="drow" data-k="${k}"><b>${esc(lessonName(dBook, n))}</b>${dateCtl(t, `第 ${n} 課`)}</div>
      ${own.filter(c => !grpOf(t, c)).map(c => `<div class="drow dkid" data-k="${k}" data-kid="${esc(c)}"><span class="dk">個別</span><div class="kc"><b>${esc(kidLabel(kidBy(c)))}</b>
        ${dateCtl(t.kids[c], `${kidLabel(kidBy(c))} 第 ${n} 課`)}<button class="linkbtn" data-del>改回全班</button></div></div>`).join("")}
      ${[...new Set(own.map(c => grpOf(t, c)).filter(Boolean))].map(name => { const cs = own.filter(c => grpOf(t, c) === name);
        return `<div class="drow dkid" data-k="${k}" data-grp="${esc(name)}"><span class="dk">一組</span><div class="kc"><b>${esc(name)}（${cs.length} 位）</b>
        ${dateCtl(t.kids[cs[0]], `${name} 第 ${n} 課`)}<button class="linkbtn" data-del>改回全班</button></div></div>`; }).join("")}
      ${free.length ? `<div class="dadd"><select data-add data-k="${k}" aria-label="第 ${n} 課：個別學生不同"><option value="">＋個別…</option>${free.map(x => `<option value="${esc(x.code)}">${esc(kidLabel(x))}</option>`).join("")}</select>${grps.length ? `<select data-addgrp data-k="${k}" aria-label="第 ${n} 課：一組學生不同"><option value="">＋一組…</option>${grps.map(g => `<option value="${g.gi}">${esc(g.name)}（${g.kids.filter(kidBy).length} 位）</option>`).join("")}</select>` : ""}</div>` : ""}`;
  }).join("");
  const done = () => { saveTeach(); renderDates(); render(); };
  $("#dTable").querySelectorAll(".drow").forEach(r => {
    const k = r.dataset.k, c = r.dataset.kid, gname = r.dataset.grp;
    /* 這一列改的是全班預設、某位學生的個別設定，還是一組學生（組內每位一起改） */
    const codes = () => gname ? Object.keys(teach[k].kids).filter(x => grpOf(teach[k], x) === gname) : c ? [c] : [];
    const each = fn => codes().forEach(x => fn(teach[k].kids[x]));
    const target = () => teach[k];
    r.querySelector("[data-type]").onchange = e => {
      const v = e.target.value;
      if(c || gname) codes().forEach(x => { teach[k].kids[x] = {...teach[k].kids[x], type:v}; });   /* 個別學生選「依年級」＝這位學生不用全班的日期 */
      else { const keep = (teach[k] || {}).kids; teach[k] = v ? {...(teach[k] || {}), type:v} : (keep ? {kids:keep} : {}); }
      done();
    };
    const s = r.querySelector("[data-s]"), en = r.querySelector("[data-e]");
    if(s) s.onchange = () => { (c || gname ? each : f => f(target()))(t => { t.start = s.value; }); done(); };
    if(en) en.onchange = () => { (c || gname ? each : f => f(target()))(t => { t.end = en.value; }); done(); };
    const del = r.querySelector("[data-del]");
    if(del) del.onclick = () => { codes().forEach(x => delete teach[k].kids[x]); if(!Object.keys(teach[k].kids).length) delete teach[k].kids; done(); };
  });
  /* 加一位個別學生：先複製全班的日期，老師再改 */
  $("#dTable").querySelectorAll("[data-add]").forEach(sel => sel.onchange = () => {
    const k = sel.dataset.k, code = sel.value; if(!code) return;
    const t = teach[k] = teach[k] || {};
    t.kids = t.kids || {};
    t.kids[code] = t.type === "dates" ? {type:"dates", start:t.start || "", end:t.end || ""} : {type:"dates", start:"", end:""};
    done();
  });
  /* 加一組學生（學生名單的組別）：每位都複製全班的日期，已經有個別設定的不動 */
  $("#dTable").querySelectorAll("[data-addgrp]").forEach(sel => sel.onchange = () => {
    const k = sel.dataset.k, g = getGroups()[+sel.value]; if(!g) return;
    const t = teach[k] = teach[k] || {};
    t.kids = t.kids || {};
    g.kids.filter(c => kidBy(c) && !t.kids[c]).forEach(c => { t.kids[c] = {...(t.type === "dates" ? {type:"dates", start:t.start || "", end:t.end || ""} : {type:"dates", start:"", end:""}), grp:g.name}; });
    done();
  });
}

/* 評量設定面板 */
function renderSettings(){
  $("#sChoices").innerHTML = CHOICES.filter(c => c[0] !== "bingo").map(([v,t]) => `<button class="chip ${settings.choices===v?"on":""}" data-c="${v}">${t}</button>`).join("");
  $("#sChoices").querySelectorAll("button").forEach(b => b.onclick = () => { settings.choices = b.dataset.c; saveSettings(); renderSettings(); render(); });
  $("#sTheme").checked = settings.formalTheme;
  $("#sClock").checked = !!settings.clockFormal;
}
/* 畫面與聲音面板 */
function renderView(){
  const chips = (list, cur, key) => list.map(([v, t]) => `<button class="chip ${cur === v ? "on" : ""}" data-${key}="${v}" aria-pressed="${cur === v}">${t}</button>`).join("");
  $("#vFont").innerHTML = chips(FONT_SIZES, settings.fontScale, "fs");
  $("#vUi").innerHTML = chips(UI_SIZES, settings.uiScale, "ui");
  $("#vHint").innerHTML = chips(HINT_SIDES, settings.hintSide || "right", "hs");
  $("#vHint").querySelectorAll("[data-hs]").forEach(b => b.onclick = () => { settings.hintSide = b.dataset.hs; saveSettings(); renderView(); });
  $("#vFont").querySelectorAll("[data-fs]").forEach(b => b.onclick = () => { settings.fontScale = b.dataset.fs; saveSettings(); applyDisplay(); renderView(); });
  $("#vUi").querySelectorAll("[data-ui]").forEach(b => b.onclick = () => { settings.uiScale = b.dataset.ui; saveSettings(); applyDisplay(); renderView(); });
  $("#sRate").value = settings.rate; $("#sRateV").textContent = `${settings.rate} 倍`;
  $("#vSfx").checked = settings.sfx;
  $("#vTurn").innerHTML = chips(TURN_STYLES, settings.turnStyle || "chime", "turn");
  $("#vTurn").querySelectorAll("[data-turn]").forEach(b => b.onclick = () => { settings.turnStyle = b.dataset.turn; saveSettings(); renderView(); });
}
/* 練習與遊戲分頁：打怪獸每做完幾題跳一次動畫（正式評量不受影響） */
const SCENE_EVERY = [["1","每題"],["3","每 3 題（預設）"],["5","每 5 題"]];
function renderPractice(){
  const cur = String(settings.sceneEvery || "3");
  $("#pEvery").innerHTML = SCENE_EVERY.map(([v, t]) => `<button class="chip ${cur === v ? "on" : ""}" data-every="${v}" aria-pressed="${cur === v}">${t}</button>`).join("");
  $("#pEvery").querySelectorAll("[data-every]").forEach(b => b.onclick = () => { settings.sceneEvery = b.dataset.every; saveSettings(); renderPractice(); });
  $("#vClock").checked = settings.clockPractice !== false;
  $("#vPartner").checked = !!settings.partner;
}
/* 把字的大小、畫面大小套到整個網頁（CSS 變數 --fs、--uiz） */
function applyDisplay(){
  document.documentElement.style.setProperty("--fs", settings.fontScale);
  document.documentElement.style.setProperty("--uiz", settings.uiScale);
}
$("#vSfx").onchange = e => { settings.sfx = e.target.checked; saveSettings(); };
$("#vPartner").onchange = e => { settings.partner = e.target.checked; saveSettings(); };
$("#vClock").onchange = e => { settings.clockPractice = e.target.checked; saveSettings(); };
$("#vTryRight").onclick = () => sfx.right(true);
$("#vTryWrong").onclick = () => sfx.wrong(true);
/* 試聽換人：照目前選的方式播一次 */
$("#vTryTurn").onclick = () => { const s = settings.turnStyle || "chime"; if(s === "chime" || s === "both") sfx.turn(true); if(s === "voice" || s === "both") setTimeout(() => { if(!speak("換小明", null, null, true)){ if(s === "voice") sfx.turn(true); $("#vTurnMsg").textContent = "這台電腦找不到內建的中文語音，為了保護學生個資不唸名字，改成只播提示音。"; } }, s === "both" ? 450 : 0); };

/* 找不到中文語音時，在設定畫面上方提醒（語音清單是慢慢載入的，等一下再檢查） */
function checkVoice(){ $("#voiceWarn").hidden = "speechSynthesis" in window && hasZhVoice(); }
setTimeout(checkVoice, 1500);
if("speechSynthesis" in window) speechSynthesis.addEventListener && speechSynthesis.addEventListener("voiceschanged", () => setTimeout(checkVoice, 0));
applyDisplay();
$("#sRate").oninput = e => { settings.rate = +e.target.value; $("#sRateV").textContent = `${settings.rate} 倍`; saveSettings(); };
$("#sTest").onclick = () => speak("努力的努");
$("#sTheme").onchange = e => { settings.formalTheme = e.target.checked; saveSettings(); };
$("#sClock").onchange = e => { settings.clockFormal = e.target.checked; saveSettings(); };

let lastFocus = null;
function openSheet(id){ lastFocus = document.activeElement; $(id).hidden = false; $(id).querySelector("[data-close]").focus(); }
function closeSheets(){ document.querySelectorAll(".overlay").forEach(o => o.hidden = true); if(lastFocus) lastFocus.focus(); }
function openDates(b){ dBook = b || dBook; renderDates(); openSheet("#datesSheet"); }
/* ⚙ 細部設定：三個分頁（評量設定、練習與遊戲、畫面與聲音）；從「到評量設定修改」打開時直接到評量設定 */
let detailTab = "view";
function showDetailTab(tab){
  detailTab = tab;
  document.querySelectorAll("#setSheet [data-tab]").forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
  document.querySelectorAll("#setSheet [data-pane]").forEach(p => p.hidden = p.dataset.pane !== tab);
}
document.querySelectorAll("#setSheet [data-tab]").forEach(b => b.onclick = () => showDetailTab(b.dataset.tab));
function openDetail(tab){ renderSettings(); renderPractice(); renderView(); showDetailTab(tab || detailTab); openSheet("#setSheet"); }
function openSettings(){ openDetail("formal"); }
$("#openDatesTop").onclick = () => openDates(state.book);
$("#openKids").onclick = () => { renderKidSheet(); openSheet("#kidsSheet"); };
$("#openSettings").onclick = () => openDetail();
$("#openGear").onclick = () => openDetail();
document.querySelectorAll("[data-close]").forEach(b => b.onclick = closeSheets);
document.querySelectorAll(".overlay").forEach(o => o.addEventListener("click", e => { if(e.target === o) closeSheets(); }));
document.addEventListener("keydown", e => { if(e.key === "Escape") closeSheets(); });
document.addEventListener("click", e => { const t = e.target.closest("[data-open]"); if(t && t.dataset.open === "set") openSettings(); if(t && t.dataset.open === "kids"){ renderKidSheet(); openSheet("#kidsSheet"); } });
$("#openRecords").onclick = () => { renderRecSheet(); openSheet("#recSheet"); };

function render(){ if(state.answer === "splitturn" && selKids().length < 2){ state.answer = "turn"; flowNote("只剩 1 位學生，沒有別人的區可以分，作答方式已改回「大螢幕・輪流」。"); } renderPresets(); renderPrepost(); renderGoals(); renderKind(); renderHints(); renderLessons(); renderQuiz(); renderAnswers(); renderKids(); renderPlay(); renderThemePick(); renderSummary(); renderWizard(); }
