/* =========================================================
   識字評量：設定畫面（setup.js）
   快速開始、進階設定的六個步驟、右邊的摘要，以及學生名單、教學日期、評量設定三個彈出面板。
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
   apply:() => Object.assign(state, {kind:"practice", mode:"acc", pChoices:"4", pHints:new Set(["word","sent","pic","parts"]), pRule:["next","next","remove","reveal"]})},
  {id:"test", name:"小考檢測", desc:"條件固定、提示較少，看學生真正會多少。", rec:"紀錄會存下來，列入學習分析",
   why:"每次小考的條件都一樣，前後成績才能比較，看得出教學有沒有效果。",
   apply:() => Object.assign(state, {kind:"formal", mode:"acc"})},
  {id:"rti", name:"學扶前後測", desc:"給學扶、資源班老師：選「教學前、中、後」，條件都固定好，前後成績可以比較。", rec:"紀錄會存下來，列入學習分析",
   why:"做轉介前介入（RTI）或學習扶助時用。正式評量的條件全部固定；系統會自動記下教學開始和結束的日期，老師專區的圖就會分出前測、教學中、後測，方便寫報告。",
   apply:() => Object.assign(state, {kind:"formal", mode:"acc"})},
  {id:"timed", name:"計時挑戰", desc:"1 分鐘內答對越多越好，看學生熟不熟練。", rec:"紀錄會存下來，列入學習分析",
   why:"認得字之後，還要認得快，讀起文章才會順。每分鐘答對幾個，可以看出熟練的程度。",
   apply:() => Object.assign(state, {kind:"formal", mode:"flu", limit:"60"})}
];
let ui = load("literacy-ui", "quick");      /* 這台電腦上次用的是快速開始還是進階設定 */
/* 這台電腦上次用的卡片（學扶老師用過一次，下次打開就直接停在「學扶前後測」） */
state.preset = PRESETS.some(p => p.id === load("literacy-preset", "")) ? load("literacy-preset", "") : "class";
const isQuick = () => ui === "quick";
function applyPreset(id){
  if(state.preset !== id) state.rti = "";
  state.preset = id; store("literacy-preset", id);
  Object.assign(state, {goal:"3", answer:"turn", qCount:null, qMethod:"even"});
  PRESETS.find(p => p.id === id).apply();
}
function setUi(mode){
  ui = mode; store("literacy-ui", ui);
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
    + (state.preset === "rti" ? `<div class="rtibox" style="grid-column:1/-1"><b>現在是？</b><div class="group">${RTI_PHASES.map(([id, name, d]) =>
        `<button class="opt ${state.rti === id ? "on" : ""}" data-rti="${id}" aria-pressed="${state.rti === id}">${name}<small>${d}</small></button>`).join("")}</div>
        <p class="note" style="margin:0">開始後系統會自動記下這幾課的教學開始、結束日期；老師專區的圖就會分出前測、教學中、後測。</p></div>` : "")
    + `<details class="why presetwhy" style="grid-column:1/-1"><summary>這幾種有什麼不同？</summary>${PRESETS.map(p => `<p><b>${p.name}</b>：${p.why}</p>`).join("")}</details>`;
  $("#presets").querySelectorAll("[data-p]").forEach(b => b.onclick = () => { applyPreset(b.dataset.p); render(); });
  $("#presets").querySelectorAll("[data-rti]").forEach(b => b.onclick = () => { state.rti = b.dataset.rti; render(); });
}
/* ---------- 學扶前後測 ----------
   老師選「教學前／教學中／教學後」，這幾課這次的評量時機就照選的（教學前＝基線期，不給提示）。
   教學後的課，如果教學結束已經超過「維持期」天數，自動算維持期。 */
const RTI_PHASES = [["pre","教學前","前測：還沒開始教，不給提示"],["mid","教學中","定期檢測：教學期間每 1～2 週一次"],["post","教學後","後測：教完以後；教完 7 天以上自動算維持期"]];
state.rti = ""; state.rtiKeys = [];
function rtiPhaseFor(k){
  if(state.rti === "pre") return "基線期";
  if(state.rti === "mid") return "教學中";
  const t = teach[k] || {};
  return t.type === "dates" && t.end && Math.round((today - parse(t.end)) / DAY) >= settings.maintainAfter ? "維持期" : "教學後";
}
/* 每次重畫前，把學扶前後測選的時期套到所選課次（換成別的卡片就清掉） */
function syncRti(){
  state.rtiKeys.forEach(k => delete state.manual[k]); state.rtiKeys = [];
  if(!isQuick() || state.preset !== "rti" || !state.rti) return;
  state.lessons.forEach(k => { state.manual[k] = rtiPhaseFor(k); }); state.rtiKeys = [...state.lessons];
}
/* 學扶前後測的「教學後天數」：有結束日、而且今天在結束日當天或之後，就算天數（結束當天＝第 0 天） */
function rtiDays(k){
  const t = teach[k] || {};
  if(t.type !== "dates" || !t.end || today < parse(t.end)) return "";
  return Math.round((today - parse(t.end)) / DAY);
}
/* 按開始時自動記日期：教學中＝這天是教學開始日（還沒記過才記）；教學後＝這天是教學結束日（還沒記過才記） */
function rtiDates(){
  if(!isQuick() || state.preset !== "rti") return;
  for(const k of state.lessons){
    const t = teach[k];
    const hasStart = t && t.type === "dates" && t.start;
    if(state.rti === "mid" && !hasStart) teach[k] = {type:"dates", start: iso(today), end: ""};
    if(state.rti === "post" && hasStart && !t.end && parse(t.start) <= today) t.end = iso(today);
  }
  saveTeach();
}

/* 依目前看得到的步驟，重新編號 1、2、3… */
function renumber(){
  let i = 0;
  document.querySelectorAll("#setup .steps > section").forEach(sec => { if(getComputedStyle(sec).display !== "none") sec.querySelector(".num").textContent = ++i; });
}

function renderGoals(){
  const L = BOOKS[state.book].lessons;
  const allConf = Object.values(L).every(l => l.conf);
  const partsLessons = Object.values(L).filter(l => l.parts >= l.total - 1).length;
  const status = {
    "1":["圖片：部分語詞已有","warn"], "2":["圖片：部分語詞已有","warn"],
    "3": allConf ? ["形近同音資料：全部課次","ok"] : ["形近同音資料：部分課次","warn"],
    "4-1": partsLessons ? [`部件資料：${partsLessons} 課`,"warn"] : ["部件資料：此版本尚未建置","warn"],
    "4-2":["第 4 版開放","warn"]
  };
  $("#goals").innerHTML = GOALS.map(g => `<button class="goal ${state.goal===g.id?"on":""}" data-g="${g.id}" ${g.off?"disabled":""} aria-pressed="${state.goal===g.id}">
      <span class="order">${g.order}・目標 ${g.id}</span><b>${g.name}</b><span class="what">${g.what}</span>
      <span class="pill ${status[g.id][1]==="warn"?"warn":""}">${status[g.id][0]}</span></button>`).join("");
  $("#goals").querySelectorAll("button:not(:disabled)").forEach(b => b.onclick = () => { state.goal = b.dataset.g; render(); });
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
    $("#choiceArea").innerHTML = `<div class="group">${CHOICES.map(([v,t]) => `<button class="chip ${state.pChoices===v?"on":""}" data-c="${v}" ${v==="bingo" && state.mode==="flu"?"disabled":""}>${t}</button>`).join("")}</div>
      <p class="note">全課賓果卡：把這一課的生字排成賓果卡，聽到哪個字就點哪個，答對的格子蓋章，連成一條線有慶祝。只用在練習；正式評量一律用固定的選項卡。</p>`;
    $("#choiceArea").querySelectorAll("[data-c]").forEach(b => b.onclick = () => { state.pChoices = b.dataset.c; render(); });
  }
}

function hintChips(set, onToggle, disabled){
  return LEVELS.map(l => `<div class="lv"><span class="n">${l.n}<br><span class="who">${l.who}</span></span>
    <div class="group">${l.items.map(([id,t]) => `<button class="chip ${set.has(id)?"on":""}" data-h="${id}" ${disabled?"disabled":""} aria-pressed="${set.has(id)}">${t}</button>`).join("")}</div></div>`).join("")
    + `<div class="lv"><span class="n">4～7<br><span class="who">老師按鈕</span></span><span class="note" style="margin:0">${TEACHER}：作答畫面上隨時可按，按了就記錄</span></div>`;
}

function ruleEditor(rule, onChange){
  return rule.map((r,i) => i === rule.length - 1
    ? `<li><span class="k">錯 ${i+1} 次</span><span class="fixed">${REACT.reveal}</span></li>`
    : `<li><span class="k">錯 ${i+1} 次</span><select data-i="${i}" aria-label="答錯第 ${i+1} 次">${["remove","next"].map(v => `<option value="${v}" ${r===v?"selected":""}>${REACT[v]}</option>`).join("")}</select></li>`).join("");
}

function renderHints(){
  const c = current(), area = $("#hintArea");
  if(c.noHelp){
    $("#h3hint").textContent = c.flu ? "流暢性模式不給提示，答錯不重答。" : "這次包含基線期的課次，正式評量固定為無提示。";
    area.innerHTML = `<div class="locked"><span class="lock">固定</span><span>無提示・答錯就記錯，進入下一題</span></div>`;
    return;
  }
  if(c.formal){
    $("#h3hint").textContent = "正式評量使用「評量設定」裡的標準條件，這裡只顯示，不能修改。";
    area.innerHTML = `<div class="locked"><span class="lock">固定</span><div style="display:grid;gap:8px">${ruleFlow(c.rule, c.hints)}
      <span class="note" style="margin:0">老師提示（${TEACHER}）可隨時按按鈕記錄。<button class="linkbtn" data-open="set">到評量設定修改</button></span></div></div>`;
    return;
  }
  $("#h3hint").textContent = "練習可以自由選提示和答錯規則。提示會依層級由少到多出現。";
  area.innerHTML = `<p class="sub">提示</p><div class="levels">${hintChips(state.pHints)}</div>
    <p class="sub">答錯後的處理</p><ol class="ladder">${ruleEditor(state.pRule)}</ol>
    <p class="sub">實際順序</p>${ruleFlow(c.rule, c.hints)}`;
  area.querySelectorAll("[data-h]").forEach(b => b.onclick = () => { const id = b.dataset.h; state.pHints.has(id) ? state.pHints.delete(id) : state.pHints.add(id); render(); });
  area.querySelectorAll(".ladder select").forEach(s => s.onchange = () => { state.pRule[+s.dataset.i] = s.value; render(); });
}

const splitKey = k => k.split("-");
const EDITIONS = [...new Set(BOOK_ORDER.map(b => BOOKS[b].edition))];
const lessonSize = k => { const [b,n] = splitKey(k); return BOOKS[b].lessons[n].total; };
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
  $("#books").innerHTML = books.map(b => `<button class="chip ${state.book===b?"on":""}" data-b="${b}" aria-pressed="${state.book===b}">${GRADES[BOOKS[b].grade-1]}年級${BOOKS[b].term}學期</button>`).join("");
  $("#books").querySelectorAll("button").forEach(btn => btn.onclick = () => { state.book = btn.dataset.b; render(); });
  const L = BOOKS[state.book].lessons;
  $("#lessons").innerHTML = Object.entries(L).map(([n,l]) => {
    const k = key(state.book,n), on = state.lessons.includes(k), gs = groups(state.book, n);
    const pill = !gs.length ? "" : gs.some(g => !g.label) ? `<span class="pill warn">需要日期</span>`
      : new Set(gs.map(g => g.label.replace(/（.*/, ""))).size > 1 ? `<span class="pill">依學生不同</span>` : `<span class="pill">${gs[0].label.replace(/（.*/, "")}</span>`;
    return `<button class="lesson ${on?"on":""}" data-n="${n}" aria-pressed="${on}"><span class="t"><b>${esc(lessonName(state.book, n))}</b>${pill}</span>${l.title && n !== "0" ? `<span class="ltitle">${esc(l.title)}</span>` : ""}
      <span class="chars">${esc(l.write)}${l.read?`<span style="opacity:.6">・${esc(l.read)}</span>`:""}</span></button>`;
  }).join("");
  $("#lessons").querySelectorAll("button").forEach(b => b.onclick = () => {
    const k = key(state.book, b.dataset.n);
    state.lessons = state.lessons.includes(k) ? state.lessons.filter(x => x !== k) : [...state.lessons, k];
    render();
  });
  $("#picked").innerHTML = state.lessons.length ? `已選：${esc(lessonsText())}　<button class="linkbtn" id="clearLessons">全部清除</button>` : "還沒選課次，可以選好幾課，也可以跨版本。";
  if($("#clearLessons")) $("#clearLessons").onclick = () => { state.lessons = []; render(); };
  if(!selKids().length){ $("#status").innerHTML = `<p class="note">請先在第 4 步選學生，才能判斷評量時機。</p>`; return; }
  $("#status").innerHTML = state.lessons.map(k => {
    const [b,n] = splitKey(k), gs = groups(b, n), need = gs.some(g => !g.label);
    const lines = gs.map(g => `<span>${g.kids.map(c => esc(kidLabel(kidBy(c)))).join("、")}：<b>${g.label || "未判斷"}</b> <span class="why">${esc(g.why)}</span></span>`).join("<br>");
    return `<div class="st ${need?"need":""}" data-k="${k}"><b>${bookName(b)} ${esc(lessonName(b, n))}</b><span style="flex:1 1 260px">${lines}</span>
      ${need ? `<span class="group"><button class="chip" data-q="notYet">還沒教</button><button class="chip" data-q="dates">輸入教學日期…</button></span>`
      : `<select data-m aria-label="第 ${n} 課這次的評量時機"><option value="">這次照自動判斷</option>${PHASES.map(p => `<option value="${p}" ${state.manual[k]===p?"selected":""}>這次全部改為：${p}</option>`).join("")}</select>
      <button class="linkbtn" data-edit>修改教學日期</button>`}</div>`;
  }).join("");
  $("#status").querySelectorAll(".st").forEach(r => {
    const k = r.dataset.k, b = splitKey(k)[0];
    r.querySelectorAll("[data-q]").forEach(btn => btn.onclick = () => {
      teach[k] = {type:btn.dataset.q}; saveTeach();
      if(btn.dataset.q === "dates") openDates(b); else render();
    });
    const m = r.querySelector("[data-m]"); if(m) m.onchange = () => { if(m.value) state.manual[k] = m.value; else delete state.manual[k]; render(); };
    const e = r.querySelector("[data-edit]"); if(e) e.onclick = () => openDates(b);
  });
}

/* 出題設定：題數、出題方式、預估時間 */
const METHODS = [
  {id:"even",  name:"平均隨機", desc:"各課平均隨機；練習時加入 20% 常用字"},
  {id:"weak",  name:"常錯優先", desc:"先出常答錯、反應慢的字", need:"需要累積作答紀錄（第 1 版開始記錄）"},
  {id:"freq",  name:"字頻優先", desc:"先出常用字", need:"需要匯入字頻資料"}
];
const SEC_PER_ITEM = {turn:8, split:8, present:15};
const FREQ_SHARE = 0.2; /* 平均隨機中先出常用字的比例 */
/* 一課的量：所選版本每課生字數的平均 */
function oneLesson(){
  const books = [...new Set(state.lessons.map(k => splitKey(k)[0]))];
  const sizes = books.flatMap(b => Object.values(BOOKS[b].lessons).map(l => l.total));
  return sizes.length ? Math.round(sizes.reduce((a,b) => a+b, 0) / sizes.length) : 0;
}
function quizPlan(){
  const pool = state.lessons.reduce((s,k) => s + lessonSize(k), 0);
  const one = Math.min(oneLesson(), pool);
  const count = Math.min(pool, state.qCount ?? one);
  const isAll = count === pool, isDefault = count === one;
  /* 題數等於一課的量（預設）或全部出題時，不需要選出題方式；正式評量固定平均隨機 */
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
  const sec = count * (SEC_PER_ITEM[state.answer] || 8) * (state.answer === "turn" ? n : 1);
  return {pool, one, count, isAll, isDefault, canChoose, method, freqN, per, sec, n};
}
const methodName = m => m === "all" ? "全部出題" : METHODS.find(x => x.id === m).name;
const minutes = s => s < 60 ? "不到 1 分鐘" : `約 ${Math.ceil(s / 30) / 2} 分鐘`;
function renderQuiz(){
  const box = $("#quiz");
  if(!state.lessons.length){ box.innerHTML = `<p class="note" style="margin:0">選好課次後，這裡會設定題數。</p>`; return; }
  if(state.mode === "flu"){ box.innerHTML = `<div class="locked"><span class="lock">流暢性</span><span>在 ${LIMITS.find(l => l[0]===state.limit)[1]} 內，從所選課次的 ${quizPlan().pool} 個字隨機連續出題，題數不固定。</span></div>`; return; }
  const q = quizPlan();
  /* 快速開始只顯示題數和時間；要改題數請到進階設定 */
  if(isQuick()){ box.innerHTML = `<p class="time"><b>${q.count} 題，${minutes(q.sec)}</b><span class="note" style="margin:0">${selKids().length > 1 ? "（學生輪流作答）" : ""}要改題數，請切換到「進階設定」。</span></p>`; return; }
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
      ? `<p class="note" style="margin:0">常用字 ${q.freqN} 題（所選課次中字頻最高的字，多複習、先有成功經驗）＋ 平均隨機 ${q.count - q.freqN} 題${perText ? `（${perText}）` : ""}。<br><span class="warn">字頻資料匯入前，常用字的部分暫時也用隨機。</span></p>`
      : `<p class="note warn" style="margin:0">${m.desc}。${m.need}，目前會先用平均隨機。</p>`;
    how = head + detail;
  }
  box.innerHTML = `
    <label class="group" for="qCount">題數 <input id="qCount" type="number" min="1" max="${q.pool}" value="${q.count}"> 題
      <button class="chip ${q.isDefault?"on":""}" data-qc="one">一課的量（${q.one} 字）</button>
      <button class="chip ${q.isAll?"on":""}" data-qc="all">全部 ${q.pool} 字</button></label>
    ${how}
    <p class="time"><b>${minutes(q.sec)}</b>　<span class="note" style="margin:0">${state.answer === "turn" && q.n > 1 ? `${q.n} 位學生輪流，每人 ${q.count} 題，` : ""}每題約 ${SEC_PER_ITEM[state.answer] || 8} 秒估算</span></p>`;
  $("#qCount").onchange = e => { const v = Math.max(1, Math.min(q.pool, +e.target.value || 1)); state.qCount = v; render(); };
  box.querySelectorAll("[data-qc]").forEach(b => b.onclick = () => { state.qCount = b.dataset.qc === "all" ? q.pool : null; render(); });
  box.querySelectorAll("[data-qm]").forEach(b => b.onclick = () => { state.qMethod = b.dataset.qm; render(); });
}

function renderAnswers(){
  $("#answers").innerHTML = ANSWERS.map(a => `<button class="opt ${state.answer===a.id?"on":""}" data-a="${a.id}" ${a.off?"disabled":""} aria-pressed="${state.answer===a.id}">${a.name}<small>${a.off?`${a.desc}（${a.off}）`:a.desc}</small></button>`).join("");
  $("#answers").querySelectorAll("button:not(:disabled)").forEach(b => b.onclick = () => { state.answer = b.dataset.a; render(); });
}

function renderKids(){
  const a = ANSWERS.find(x => x.id === state.answer);
  $("#answerHint").textContent = a.max < 99 ? `同一份題目可以用不同方式作答。「${a.name}」可選 ${a.min}～${a.max} 位學生。` : "同一份題目可以用不同方式作答。呈現模式可以全班一起，人數不限。";
  $("#kids").innerHTML = kids.map(k => `<button class="chip kidchip ${state.kids.has(k.code)?"on":""}" data-k="${esc(k.code)}" aria-pressed="${state.kids.has(k.code)}">${Rewards.avatarHtml(k.code)}${esc(kidLabel(k))}<small>${gradeText(k)}</small></button>`).join("");
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
        Rewards.rename(k.code, v); k.code = v; }
      else k.name = f.value.trim();
      saveKids(); render();
    });
    r.querySelector("[data-plan]").onclick = () => { openPlan = openPlan === k.code ? null : k.code; renderKidSheet(); };
    r.querySelector("[data-avopen]").onclick = () => { openAv = openAv === k.code ? null : k.code; renderKidSheet(); };
    r.querySelector("[data-del]").onclick = () => { state.kids.delete(k.code); kids.splice(+r.dataset.i, 1); saveKids(); renderKidSheet(); render(); };
  });
  bindAvatarPanel($("#kTable .avpick"), () => { renderKidSheet(); render(); });
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
      ["今天做什麼", `${p.name}（聽音找字）`],
      ...(p.id === "rti" ? [["現在是", state.rti ? RTI_PHASES.find(x => x[0] === state.rti)[1] : null, "還沒選教學前、中、後"]] : []),
      ["學生", n && n <= 4 ? selKids().map(c => esc(kidLabel(kidBy(c)))).join("、") : null, n ? "一次最多 4 位學生" : "還沒選"],
      ["課次", state.lessons.length ? esc(lessonsText()) : null],
      ["時間", !state.lessons.length ? null : c.flu ? `每位學生 ${LIMITS.find(l => l[0]===state.limit)[1]}` : `${q.count} 題，${minutes(q.sec)}`]
    ];
    $("#sum").innerHTML = rows.map(([t,v,miss]) => `<div><dt>${t}</dt><dd class="${v?"":"miss"}">${v || miss || "還沒選"}</dd></div>`).join("");
    $("#go").disabled = rows.some(r => !r[1]);
    $("#go").textContent = "開始";
    return;
  }
  $("#go").textContent = "開始評量";
  $("#kindBadge").innerHTML = c.formal ? `<span class="badge">正式評量・納入學習分析</span>` : `<span class="badge prac">練習・另外統計</span>`;
  const lessonText = state.lessons.length ? esc(lessonsText()) : null;
  const q = quizPlan();
  const quizText = !state.lessons.length ? null : c.flu ? `時限內隨機出題（${q.pool} 字）` : `${q.count} 題・${methodName(q.method)}・${minutes(q.sec)}`;
  const multi = selKids().length > 1;
  const ph = state.lessons.flatMap(k => { const [b,n] = splitKey(k); return groups(b, n).map(g => g.label
    ? `${state.lessons.length > 1 ? `${bookName(b)} ` : ""}${lessonName(b, n)}${multi ? `・${g.kids.map(c => esc(kidLabel(kidBy(c)))).join("、")}` : ""}：${g.label}` : null); });
  const n = selKids().length, kidsOk = n >= a.min && n <= a.max;
  const rows = [
    ["評量目標", `目標 ${g.id}　${g.name}`],
    ["評量方式", c.flu ? `流暢性・${LIMITS.find(l => l[0]===state.limit)[1]}・目標每分鐘 ${esc($("#aim").value)} 個` : "正確率模式"],
    ["選項", choiceText(c.choices)],
    ["提示", c.hints.length ? c.hints.map(hintName).join(" → ") : "無提示"],
    ["課次", lessonText],
    ["題目", quizText],
    ["評量時機", state.lessons.length && n && !ph.includes(null) ? ph.join("<br>") : null, n ? "請到第 5 步設定教學日期" : "先選學生才能判斷"],
    ["作答模式", a.name],
    ["學生", n ? (kidsOk ? `${selKids().map(c => esc(kidLabel(kidBy(c)))).join("、")}（${n} 位）` : null) : null, n ? `「${a.name}」需要 ${a.min}～${a.max} 位，目前 ${n} 位` : "還沒選"]
  ];
  $("#sum").innerHTML = rows.map(([t,v,miss]) => `<div><dt>${t}</dt><dd class="${v?"":"miss"}">${v || miss || "還沒選"}</dd></div>`).join("");
  $("#go").disabled = rows.some(r => !r[1]);
}
$("#go").onclick = () => { rtiDates(); chooseTheme(); };   /* 先選主題（見 collect.js），再開始 */
$("#aim").addEventListener("input", renderSummary);

/* 教學日期管理面板 */
function renderDates(){
  $("#dBooks").innerHTML = BOOK_ORDER.map(b => `<button class="chip ${dBook===b?"on":""}" data-b="${b}">${bookName(b)}</button>`).join("");
  $("#dBooks").querySelectorAll("button").forEach(btn => btn.onclick = () => { dBook = btn.dataset.b; renderDates(); });
  $("#dTable").innerHTML = Object.keys(BOOKS[dBook].lessons).map(n => {
    const k = key(dBook,n), t = teach[k] || {}, a = t.type === "dates" ? datePhase(t) : t.type === "notYet" ? {phase:"基線期", why:"還沒教"} : {phase:null, why:"依每位學生的年級判斷"};
    return `<div class="drow" data-k="${k}"><b>${esc(lessonName(dBook, n))}</b>
      <select aria-label="第 ${n} 課教學狀態">${TAUGHT.map(([v,x]) => `<option value="${v}" ${(t.type||"")===v?"selected":""}>${x}</option>`).join("")}</select>
      <div class="ds">${t.type === "dates" ? `<input type="date" aria-label="第 ${n} 課開始日" data-s value="${t.start||""}"><span>到</span><input type="date" aria-label="第 ${n} 課結束日" data-e value="${t.end||""}">` : ""}
      <span class="ph">${a.phase ? `目前：${a.phase}・${esc(a.why)}` : esc(a.why)}</span></div></div>`;
  }).join("");
  $("#dTable").querySelectorAll(".drow").forEach(r => {
    const k = r.dataset.k;
    r.querySelector("select").onchange = e => { teach[k] = e.target.value ? {...(teach[k]||{}), type:e.target.value} : {}; saveTeach(); renderDates(); render(); };
    const s = r.querySelector("[data-s]"), en = r.querySelector("[data-e]");
    if(s) s.onchange = () => { teach[k].start = s.value; saveTeach(); renderDates(); render(); };
    if(en) en.onchange = () => { teach[k].end = en.value; saveTeach(); renderDates(); render(); };
  });
}

/* 評量設定面板 */
function renderSettings(){
  $("#sChoices").innerHTML = CHOICES.filter(c => c[0] !== "bingo").map(([v,t]) => `<button class="chip ${settings.choices===v?"on":""}" data-c="${v}">${t}</button>`).join("");
  $("#sChoices").querySelectorAll("button").forEach(b => b.onclick = () => { settings.choices = b.dataset.c; saveSettings(); renderSettings(); render(); });
  const set = new Set(settings.hints);
  $("#sHints").innerHTML = hintChips(set);
  $("#sHints").querySelectorAll("[data-h]").forEach(b => b.onclick = () => {
    const id = b.dataset.h; set.has(id) ? set.delete(id) : set.add(id);
    settings.hints = HINT_ORDER.filter(h => set.has(h)); saveSettings(); renderSettings(); render();
  });
  $("#sRule").innerHTML = ruleEditor(settings.rule);
  $("#sRule").querySelectorAll("select").forEach(s => s.onchange = () => { settings.rule[+s.dataset.i] = s.value; saveSettings(); render(); });
  $("#sMaintain").value = settings.maintainAfter;
  $("#sTheme").checked = settings.formalTheme;
  $("#sClock").checked = !!settings.clockFormal;
  $("#sGame").checked = !!settings.formalGame; $("#sGame").disabled = !settings.formalTheme;
}
/* 畫面與聲音面板 */
function renderView(){
  const chips = (list, cur, key) => list.map(([v, t]) => `<button class="chip ${cur === v ? "on" : ""}" data-${key}="${v}" aria-pressed="${cur === v}">${t}</button>`).join("");
  $("#vFont").innerHTML = chips(FONT_SIZES, settings.fontScale, "fs");
  $("#vUi").innerHTML = chips(UI_SIZES, settings.uiScale, "ui");
  $("#vFont").querySelectorAll("[data-fs]").forEach(b => b.onclick = () => { settings.fontScale = b.dataset.fs; saveSettings(); applyDisplay(); renderView(); });
  $("#vUi").querySelectorAll("[data-ui]").forEach(b => b.onclick = () => { settings.uiScale = b.dataset.ui; saveSettings(); applyDisplay(); renderView(); });
  $("#sRate").value = settings.rate; $("#sRateV").textContent = `${settings.rate} 倍`;
  $("#vSfx").checked = settings.sfx;
  $("#vClock").checked = settings.clockPractice !== false;
  $("#vTurn").innerHTML = chips(TURN_STYLES, settings.turnStyle || "chime", "turn");
  $("#vTurn").querySelectorAll("[data-turn]").forEach(b => b.onclick = () => { settings.turnStyle = b.dataset.turn; saveSettings(); renderView(); });
}
/* 把字的大小、畫面大小套到整個網頁（CSS 變數 --fs、--uiz） */
function applyDisplay(){
  document.documentElement.style.setProperty("--fs", settings.fontScale);
  document.documentElement.style.setProperty("--uiz", settings.uiScale);
}
$("#vSfx").onchange = e => { settings.sfx = e.target.checked; saveSettings(); };
$("#vClock").onchange = e => { settings.clockPractice = e.target.checked; saveSettings(); };
$("#vTryRight").onclick = () => sfx.right(true);
$("#vTryWrong").onclick = () => sfx.wrong(true);
/* 試聽換人：照目前選的方式播一次 */
$("#vTryTurn").onclick = () => { const s = settings.turnStyle || "chime"; if(s === "chime" || s === "both") sfx.turn(true); if(s === "voice" || s === "both") setTimeout(() => speak("換小明"), s === "both" ? 450 : 0); };
$("#openView").onclick = () => { renderView(); openSheet("#viewSheet"); };
applyDisplay();
$("#sRate").oninput = e => { settings.rate = +e.target.value; $("#sRateV").textContent = `${settings.rate} 倍`; saveSettings(); };
$("#sTest").onclick = () => speak("努力的努");
$("#sTheme").onchange = e => { settings.formalTheme = e.target.checked; saveSettings(); $("#sGame").disabled = !settings.formalTheme; };
$("#sGame").onchange = e => { settings.formalGame = e.target.checked; saveSettings(); };
$("#sClock").onchange = e => { settings.clockFormal = e.target.checked; saveSettings(); };
$("#sMaintain").onchange = e => { const v = Math.max(1, Math.min(60, +e.target.value || 7)); settings.maintainAfter = v; saveSettings(); renderSettings(); render(); };

let lastFocus = null;
function openSheet(id){ lastFocus = document.activeElement; $(id).hidden = false; $(id).querySelector("[data-close]").focus(); }
function closeSheets(){ document.querySelectorAll(".overlay").forEach(o => o.hidden = true); if(lastFocus) lastFocus.focus(); }
function openDates(b){ dBook = b || dBook; renderDates(); openSheet("#datesSheet"); }
function openSettings(){ renderSettings(); openSheet("#setSheet"); }
$("#openDates").onclick = () => openDates(state.book);
$("#openKids").onclick = () => { renderKidSheet(); openSheet("#kidsSheet"); };
$("#openSettings").onclick = openSettings;
document.querySelectorAll("[data-close]").forEach(b => b.onclick = closeSheets);
document.querySelectorAll(".overlay").forEach(o => o.addEventListener("click", e => { if(e.target === o) closeSheets(); }));
document.addEventListener("keydown", e => { if(e.key === "Escape") closeSheets(); });
document.addEventListener("click", e => { const t = e.target.closest("[data-open]"); if(t && t.dataset.open === "set") openSettings(); if(t && t.dataset.open === "kids"){ renderKidSheet(); openSheet("#kidsSheet"); } });
$("#openRecords").onclick = () => { renderRecSheet(); openSheet("#recSheet"); };

function render(){ syncRti(); renderPresets(); renderGoals(); renderKind(); renderHints(); renderLessons(); renderQuiz(); renderAnswers(); renderKids(); renderSummary(); renumber(); }
