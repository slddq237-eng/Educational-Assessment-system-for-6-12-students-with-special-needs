/* =========================================================
   識字評量（第 1 版）
   這個檔案是程式本體，分成幾個段落，每段開頭都有說明：
     1. 基本設定與小工具
     2. 存在這台電腦的資料（設定、學生、教學日期）
     3. 評量時機判斷
     4. 設定畫面（六個步驟與摘要）
     5. 彈出面板（學生名單、教學日期、評量設定）
     6. 作答紀錄的存取
     7. 出題與題目內容
     8. 作答畫面
     9. 結果畫面、Excel 匯出與備份
   生字資料在平台共用的 shared/lessons.js。
   ========================================================= */

/* =========================================================
   1. 基本設定與小工具
   ========================================================= */
const BOOK_ORDER = ["h2","2","3","4"];   /* 畫面上課本的排列順序 */
/* 幫每一課算好：總字數、是否每個字都有形近同音資料、有部件資料的字數 */
for(const b of Object.values(BOOKS)) for(const L of Object.values(b.lessons)){
  const chars = [...(L.write + L.read)];
  L.total = chars.length; L.conf = chars.every(c => CONF[c]); L.parts = chars.filter(c => PARTS[c]).length;
}

const GOALS = [
  {id:"1",  order:"建議第 1 步", name:"聽音選圖",  what:"聽語詞，點出正確的圖片（音 ↔ 義）", off:"第 2 版開放"},
  {id:"2",  order:"建議第 2 步", name:"看字選圖",  what:"看字或語詞，點出正確的圖片（形 ↔ 義）", off:"第 2 版開放"},
  {id:"3",  order:"建議第 3 步", name:"形音辨識",  what:"聽「努力的努」，從形近字、同音字、同詞易混字中選出目標字"},
  {id:"4-1",order:"建議第 4 步", name:"部件重組",  what:"看拆開的部件，選出組成的字", off:"第 3 版開放"},
  {id:"4-2",order:"建議第 4 步", name:"看提示書寫", what:"寫出目標字；先用紙筆作答、老師登錄", off:"第 4 版開放"}
];
const KINDS = [
  {id:"formal",   name:"正式評量", desc:"條件固定（在「評量設定」調整），結果納入學習分析"},
  {id:"practice", name:"練習",     desc:"選項、提示、玩法都能自由調整，結果另外統計"}
];
const MODES = [
  {id:"acc", name:"正確率模式", desc:"題目答完為止，看正確率與反應時間"},
  {id:"flu", name:"流暢性模式", desc:"時間到為止，看每分鐘正確幾個"}
];
const LIMITS = [["30","30 秒"],["60","1 分鐘"],["120","2 分鐘"]];
const CHOICES = [["3","3 個"],["4","4 個"],["6","6 個"],["bingo","全課賓果卡（第 2 版）"]];
const choiceText = c => c === "bingo" ? "全課賓果卡" : `${c} 個選項`;
/* 提示層級草案：0 無提示；1–3 系統給；4–7 老師給（作答畫面上的按鈕） */
const LEVELS = [
  {n:1, who:"系統", items:[["word","語詞挖空（○瓜的○）"],["sent","句子"]]},
  {n:2, who:"系統", items:[["pic","圖片"],["sound","聲音"]]},
  {n:3, who:"系統", items:[["parts","部件"],["mask","遮擋字"],["shape","字形"]]}
];
const TEACHER = "口語提示、示範、肢體提示、完全提示";
const HINT_ORDER = LEVELS.flatMap(l => l.items.map(i => i[0]));
const hintName = id => LEVELS.flatMap(l => l.items).find(i => i[0] === id)[1];
const REACT = {remove:"選錯的選項打叉", next:"出現下一個提示", reveal:"顯示答案並唸一次，進入下一題"};
const ANSWERS = [
  {id:"turn",    name:"大螢幕・輪流",   desc:"1～4 人輪流在同一個螢幕作答", min:1, max:4},
  {id:"split",   name:"大螢幕・同時",   desc:"螢幕分成 2～4 區，各自作答（需支援多點觸控）", min:2, max:4, off:"第 2 版"},
  {id:"present", name:"呈現模式・紙筆", desc:"螢幕只出題，學生寫在紙上，老師改完再登錄", min:1, max:99, off:"第 2 版"},
  {id:"qr",      name:"平板掃 QR code", desc:"學生用自己的平板作答，結果傳回老師電腦", off:"第 4 版之後"}
];
const TAUGHT = [["","依學生年級自動判斷"],["dates","輸入教學日期"],["notYet","還沒教"]];
const PHASES = ["基線期","教學中","教學後","維持期"];
const GRADES = ["一","二","三","四","五","六"];

const DAY = 864e5;
const today = new Date(); today.setHours(0,0,0,0);
const iso = d => new Date(d.getTime() - d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
const parse = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
const md = s => { const d = parse(s); return `${d.getMonth()+1}/${d.getDate()}`; };
const load = (k, fallback) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v ?? fallback; } catch(e){ return fallback; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };

/* =========================================================
   2. 存在這台電腦的資料（設定、學生、教學日期）
   用瀏覽器的 localStorage 保存，換電腦或清除瀏覽資料就會不見，
   所以「作答紀錄」面板有備份功能。
   ========================================================= */

/* 學年與學期：8 月到隔年 1 月是上學期，2 月到 7 月是下學期 */
const M = today.getMonth() + 1;
const SCHOOL_YEAR = (M >= 8 ? today.getFullYear() : today.getFullYear() - 1) - 1911;
const TERM = (M >= 8 || M <= 1) ? "上" : "下";
const termIndex = (grade, term) => (grade - 1) * 2 + (term === "上" ? 0 : 1);

/* 正式評量的標準條件（存在這台電腦） */
const settings = Object.assign({choices:"4", hints:["word","pic"], rule:["remove","next","next","reveal"], maintainAfter:7, rate:0.85},
  load("literacy-settings", {}));
const saveSettings = () => store("literacy-settings", settings);

/* 學生名單：年級記的是設定那一年的年級，之後每學年自動升級 */
/* 第一次打開時先放兩個範例代號，老師可以在「學生名單」修改或刪除 */
const kids = load("literacy-kids", [
  {code:"S01", name:"", grade:2, sy:SCHOOL_YEAR}, {code:"S02", name:"", grade:2, sy:SCHOOL_YEAR}
]);
const saveKids = () => store("literacy-kids", kids);
/* 本學期教學安排（選填，每學期一筆）：level＝課程調整到幾年級，其餘為每週節數 */
const PLAN_KEY = `${SCHOOL_YEAR}${TERM}`;
/* 三種課程分開記錄節數，各自可填開始日期（學期中才加入的學生） */
const SERVICES = [
  {id:"regular",  name:"原班",     parts:[["regular","每週"]]},
  {id:"resource", name:"資源班",   parts:[["pull","抽離"],["extra","外加"]]},
  {id:"support",  name:"學習扶助", parts:[["support","每週"]]}
];
const DOSE = SERVICES.flatMap(v => v.parts);
const planOf = k => (k.plans && k.plans[PLAN_KEY]) || {};
const dosage = p => DOSE.reduce((s,[id]) => s + (p[id] || 0), 0);
const adjLevel = k => planOf(k).adjust ? planOf(k).level : null;
const kidGrade = k => Math.min(6, k.grade + (SCHOOL_YEAR - (k.sy || SCHOOL_YEAR)));
const kidBy = code => kids.find(k => k.code === code);
const kidLabel = k => k.name ? `${k.code} ${k.name}` : k.code;
/* 判斷時機用的「學習年級」：有課程調整就用調整後的年級 */
const studyGrade = k => adjLevel(k) || kidGrade(k);
const gradeText = k => `${GRADES[kidGrade(k)-1]}年級${adjLevel(k) ? `・課程調整到${GRADES[adjLevel(k)-1]}年級` : ""}`;

/* 教學日期：每一課一筆，{type:"dates", start, end} 或 {type:"notYet"}；沒有紀錄就依學生年級判斷 */
const key = (b,n) => b + "-" + n;
const teach = load("literacy-teach", {});
const saveTeach = () => store("literacy-teach", teach);

const state = {
  goal:"3", kind:"formal", mode:"acc", limit:"60",
  pChoices:"6", pHints:new Set(["word","sent","pic"]), pRule:["next","next","remove","reveal"],
  ed:"翰林", book:"h2", lessons:[], qCount:null, qMethod:"even", manual:{}, answer:"turn",
  kids:new Set()
};
let dBook = "h2";

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const bookName = b => `${BOOKS[b].edition} ${BOOKS[b].grade}${BOOKS[b].term}`;

/* =========================================================
   3. 評量時機判斷（基線期／教學中／教學後／維持期）
   ========================================================= */

/* 依教學日期判斷 */
function datePhase(t){
  if(!t.start || !t.end) return {phase:null, why:"日期還沒填完整"};
  const s = parse(t.start), e = parse(t.end);
  if(e < s) return {phase:null, why:"結束日早於開始日，請檢查日期"};
  if(today < s) return {phase:"基線期", why:`教學從 ${md(t.start)} 開始`};
  if(today <= e) return {phase:"教學中", why:`教學期間 ${md(t.start)}～${md(t.end)}`};
  const n = Math.round((today - e) / DAY);
  return {phase: n < settings.maintainAfter ? "教學後" : "維持期", why:`教學結束後第 ${n} 天`, days:n};
}
/* 某位學生在某一課的評量時機：有教學日期就用日期，沒有就比較學生年級與課本年級 */
function autoFor(code, b, n){
  const t = teach[key(b,n)] || {};
  if(t.type === "dates") return datePhase(t);
  const k = kidBy(code); if(!k) return {phase:null, why:""};
  const d = termIndex(studyGrade(k), TERM) - termIndex(BOOKS[b].grade, BOOKS[b].term);
  /* 「還沒教」只套用在還沒升過這個年級的學生；高年級學生以前學過，仍依年級判斷 */
  if(t.type === "notYet" && d <= 0) return {phase:"基線期", why:"還沒教"};
  if(d < 0) return {phase:"基線期", why:`還沒學到（${GRADES[BOOKS[b].grade-1]}${BOOKS[b].term}的課）`};
  if(d === 0) return {phase:null, why:"本學期的課，請輸入教學日期"};
  if(d === 1) return {phase:"維持期", why:"上學期學過"};
  if(d <= 3) return {phase:"維持期", why:"上學年學過"};
  return {phase:"維持期", why:"更早以前學過"};
}
const phaseFor = (code, b, n) => state.manual[key(b,n)] || autoFor(code, b, n).phase;
const selKids = () => [...state.kids].filter(kidBy);
const phases = () => state.lessons.flatMap(k => { const [b,n] = k.split("-"); return selKids().map(c => phaseFor(c, b, n)); });
/* 把同一課、同一時機的學生合在一起顯示 */
function groups(b, n){
  const g = new Map();
  for(const c of selKids()){
    const a = autoFor(c, b, n), p = state.manual[key(b,n)] || a.phase;
    const label = p ? `${p}${!state.manual[key(b,n)] && a.days!=null && (p==="教學後"||p==="維持期") ? `（第 ${a.days} 天）` : ""}` : null;
    const id = (label || "") + "|" + (state.manual[key(b,n)] ? "手動指定" : a.why);
    if(!g.has(id)) g.set(id, {label, why: state.manual[key(b,n)] ? "這次手動指定" : a.why, kids:[]});
    g.get(id).kids.push(c);
  }
  return [...g.values()];
}

/* 這次實際套用的條件 */
function current(){
  const formal = state.kind === "formal", flu = state.mode === "flu";
  const base = formal && phases().includes("基線期");
  const noHelp = flu || base;
  return {
    formal, flu, base, noHelp,
    choices: formal || flu ? settings.choices : state.pChoices,
    hints: noHelp ? [] : (formal ? settings.hints : HINT_ORDER.filter(h => state.pHints.has(h))),
    rule: noHelp ? null : (formal ? settings.rule : state.pRule)
  };
}
function ruleFlow(rule, hints){
  if(!rule) return `<div class="flow"><span class="s">答錯就記錯，進入下一題</span></div>`;
  let h = 0;
  return `<div class="flow">${rule.map((r,i) => {
    let t = REACT[r];
    if(r === "next") t = hints[h] ? `出現提示：${hintName(hints[h++])}` : "（沒有更多提示）";
    return `${i?"<i>→</i>":""}<span class="s">錯 ${i+1} 次：${t}</span>`;
  }).join("")}</div>`;
}

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
  {id:"timed", name:"計時挑戰", desc:"1 分鐘內答對越多越好，看學生熟不熟練。", rec:"紀錄會存下來，列入學習分析",
   why:"認得字之後，還要認得快，讀起文章才會順。每分鐘答對幾個，可以看出熟練的程度。",
   apply:() => Object.assign(state, {kind:"formal", mode:"flu", limit:"60"})}
];
let ui = load("literacy-ui", "quick");      /* 這台電腦上次用的是快速開始還是進階設定 */
state.preset = "class";
const isQuick = () => ui === "quick";
function applyPreset(id){
  state.preset = id;
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
    + `<details class="why presetwhy" style="grid-column:1/-1"><summary>這三種有什麼不同？</summary>${PRESETS.map(p => `<p><b>${p.name}</b>：${p.why}</p>`).join("")}</details>`;
  $("#presets").querySelectorAll("[data-p]").forEach(b => b.onclick = () => { applyPreset(b.dataset.p); render(); });
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
    $("#choiceArea").innerHTML = `<div class="group">${CHOICES.map(([v,t]) => `<button class="chip ${state.pChoices===v?"on":""}" data-c="${v}" ${v==="bingo"?"disabled":""}>${t}</button>`).join("")}</div>
      <p class="note">全課賓果卡：把這一課的生字排成賓果卡，聽到哪個字就點哪個，連成一條線過關。</p>`;
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
  return [...by].map(([b,ns]) => `${bookName(b)} 第 ${ns.sort((x,y) => x-y).join("、")} 課`).join("；");
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
    return `<button class="lesson ${on?"on":""}" data-n="${n}" aria-pressed="${on}"><span class="t"><b>第 ${n} 課</b>${pill}</span>
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
    return `<div class="st ${need?"need":""}" data-k="${k}"><b>${bookName(b)} 第 ${n} 課</b><span style="flex:1 1 260px">${lines}</span>
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
  const perText = [...q.per].filter(([,v]) => v).map(([k,v]) => `${manyBooks ? bookName(splitKey(k)[0]) + " " : ""}第 ${splitKey(k)[1]} 課 ${v}`).join("、");
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
  $("#kids").innerHTML = kids.map(k => `<button class="chip kidchip ${state.kids.has(k.code)?"on":""}" data-k="${esc(k.code)}" aria-pressed="${state.kids.has(k.code)}">${esc(kidLabel(k))}<small>${gradeText(k)}</small></button>`).join("");
  $("#kids").querySelectorAll("button").forEach(b => b.onclick = () => { const k = b.dataset.k; state.kids.has(k) ? state.kids.delete(k) : state.kids.add(k); render(); });
}
/* =========================================================
   5. 彈出面板（學生名單、教學日期、評量設定）
   ========================================================= */

/* 學生名單面板 */
let openPlan = null;
function renderKidSheet(){
  $("#kTable").innerHTML = kids.map((k,i) => {
    const p = planOf(k), open = openPlan === k.code;
    return `<div class="krow" data-i="${i}">
    <input aria-label="代號" data-f="code" value="${esc(k.code)}" maxlength="8">
    <input aria-label="名字（選填）" data-f="name" value="${esc(k.name||"")}" maxlength="10" placeholder="可不填">
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
    </div>` : ""}`;
  }).join("");
  $("#kTable").querySelectorAll(".krow").forEach(r => {
    const k = kids[+r.dataset.i];
    r.querySelectorAll("[data-f]").forEach(f => f.onchange = () => {
      if(f.dataset.f === "grade"){ k.grade = +f.value; k.sy = SCHOOL_YEAR; }
      else if(f.dataset.f === "code"){ const v = f.value.trim(); if(!v || kids.some(x => x !== k && x.code === v)){ f.value = k.code; return; }
        if(state.kids.delete(k.code)) state.kids.add(v); if(openPlan === k.code) openPlan = v; k.code = v; }
      else k.name = f.value.trim();
      saveKids(); render();
    });
    r.querySelector("[data-plan]").onclick = () => { openPlan = openPlan === k.code ? null : k.code; renderKidSheet(); };
    r.querySelector("[data-del]").onclick = () => { state.kids.delete(k.code); kids.splice(+r.dataset.i, 1); saveKids(); renderKidSheet(); render(); };
  });
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
    ? `${state.lessons.length > 1 ? `${bookName(b)} ` : ""}第 ${n} 課${multi ? `・${g.kids.map(c => esc(kidLabel(kidBy(c)))).join("、")}` : ""}：${g.label}` : null); });
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
$("#go").onclick = () => startSession();
$("#aim").addEventListener("input", renderSummary);

/* 教學日期管理面板 */
function renderDates(){
  $("#dBooks").innerHTML = BOOK_ORDER.map(b => `<button class="chip ${dBook===b?"on":""}" data-b="${b}">${bookName(b)}</button>`).join("");
  $("#dBooks").querySelectorAll("button").forEach(btn => btn.onclick = () => { dBook = btn.dataset.b; renderDates(); });
  $("#dTable").innerHTML = Object.keys(BOOKS[dBook].lessons).map(n => {
    const k = key(dBook,n), t = teach[k] || {}, a = t.type === "dates" ? datePhase(t) : t.type === "notYet" ? {phase:"基線期", why:"還沒教"} : {phase:null, why:"依每位學生的年級判斷"};
    return `<div class="drow" data-k="${k}"><b>第 ${n} 課</b>
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
  $("#sRate").value = settings.rate; $("#sRateV").textContent = `${settings.rate} 倍`;
}
$("#sRate").oninput = e => { settings.rate = +e.target.value; $("#sRateV").textContent = `${settings.rate} 倍`; saveSettings(); };
$("#sTest").onclick = () => speak("努力的努");
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

function render(){ renderPresets(); renderGoals(); renderKind(); renderHints(); renderLessons(); renderQuiz(); renderAnswers(); renderKids(); renderSummary(); renumber(); }

/* =========================================================
   6. 作答紀錄的存取
   每答完一題就存一筆紀錄到這台電腦的瀏覽器（IndexedDB，容量比 localStorage 大）。
   打開網頁時先把全部紀錄讀進 records，供「常錯優先」與紀錄面板使用。
   ========================================================= */
const REC_DB = "literacy", REC_STORE = "records";
let recDb = null, records = [];
function openRecDb(){
  return new Promise(res => {
    try {
      const r = indexedDB.open(REC_DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(REC_STORE, {keyPath:"id", autoIncrement:true});
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch(e){ res(null); }
  });
}
function loadRecords(){
  return new Promise(res => {
    if(!recDb) return res([]);
    try {
      const q = recDb.transaction(REC_STORE).objectStore(REC_STORE).getAll();
      q.onsuccess = () => res(q.result || []);
      q.onerror = () => res([]);
    } catch(e){ res([]); }
  });
}
function saveRecord(r){
  records.push(r);
  if(!recDb) return;
  try { const q = recDb.transaction(REC_STORE, "readwrite").objectStore(REC_STORE).add(r); q.onsuccess = () => { r.id = q.result; }; } catch(e){}
}
function clearRecords(){
  records = [];
  if(!recDb) return;
  try { recDb.transaction(REC_STORE, "readwrite").objectStore(REC_STORE).clear(); } catch(e){}
}
(async () => { recDb = await openRecDb(); records = await loadRecords(); $("#dbWarn").hidden = !!recDb; })();


/* =========================================================
   7. 出題與題目內容
   pickItems()：依出題設定，替一位學生抽出這次要考的字
   makeOptions()：替一個目標字組出選項（同詞易混字、同音字、形近字、課文字）
   hintHtml()：產生各種提示的畫面
   ========================================================= */
const shuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const charsOf = k => { const [b,n] = splitKey(k); const L = BOOKS[b].lessons[n]; return [...(L.write + L.read)]; };
const ALL_CHARS = [...new Set(BOOK_ORDER.flatMap(b => Object.keys(BOOKS[b].lessons).flatMap(n => charsOf(key(b,n)))))];
const wordOf = (c, b) => (WORDS_ED[b] || {})[c] || WORDS[c] || "";
const sentOf = (c, b) => (SENT_ED[b] || {})[c] || SENT[c] || "";
const sayOf = (c, b) => wordOf(c, b) ? `${wordOf(c, b)}的${c}` : c;
const isHan = ch => /\p{Script=Han}/u.test(ch);

function pickItems(code, q){
  const pool = state.lessons.flatMap(k => charsOf(k).map(c => ({c, k})));
  if(q.method === "all") return shuffle(pool);
  if(q.method === "weak"){
    /* 常錯優先：依這位學生過去的紀錄，錯得多、反應慢的字先出；沒考過的字排中間 */
    const score = it => {
      const rs = records.filter(r => r.kid === code && r.char === it.c && r.goal === "3");
      if(!rs.length) return 0.5;
      const wrong = rs.filter(r => !r.firstCorrect).length / rs.length;
      const sec = rs.reduce((s, r) => s + Math.min(r.correctSec ?? 10, 10), 0) / rs.length;
      return wrong + sec / 20;
    };
    return shuffle(shuffle(pool).sort((a, b) => score(b) - score(a)).slice(0, q.count));
  }
  const rest = shuffle([...pool]);
  if(q.method === "freq") return rest.slice(0, q.count);   /* 字頻資料匯入前先隨機 */
  /* 平均隨機：先取常用字（練習才有，字頻資料匯入前先隨機），再依每課分配的題數抽 */
  const take = rest.splice(0, q.freqN).map(it => ({...it, boost:true}));
  for(const [k, n] of q.per){
    const fromK = rest.filter(it => it.k === k).slice(0, n);
    take.push(...fromK);
    fromK.forEach(it => rest.splice(rest.indexOf(it), 1));
  }
  while(take.length < q.count && rest.length) take.push(rest.shift());
  return shuffle(take).slice(0, q.count);
}

/* 組選項：先放 1 個同詞易混字（例如「新聞」的「聞」），再輪流放同音字、形近字，不夠用課文字補 */
function makeOptions(c, k, n){
  const b = splitKey(k)[0];
  const [sound = "", shape = ""] = CONF[c] || [];
  const used = new Set([c]), out = [];
  const add = (x, type) => { if(x && isHan(x) && !used.has(x) && out.length < n - 1){ used.add(x); out.push({ch:x, type}); } };
  add(shuffle([...wordOf(c, b)].filter(x => x !== c))[0], "同詞易混");
  const s = shuffle([...sound]), h = shuffle([...shape]);
  while(out.length < n - 1 && (s.length || h.length)){ add(s.shift(), "同音"); add(h.shift(), "形近"); }
  shuffle(charsOf(k)).forEach(x => add(x, "課文字"));
  shuffle([...ALL_CHARS]).forEach(x => add(x, "其他字"));
  return shuffle([{ch:c, type:"答案"}, ...out]);
}

/* 提示畫面；沒有資料的提示回傳空字串，系統會自動跳到下一個提示 */
const HINT_LEVEL = {word:1, sent:1, pic:2, sound:2, parts:3, mask:3, shape:3};
const TEACHER_BTNS = [[4,"口語提示"],[5,"示範"],[6,"肢體提示"],[7,"完全提示"]];
function hintHtml(id, c, b){
  if(id === "word"){ const w = wordOf(c, b); return w ? `<div class="h">${esc(w.replaceAll(c, "○"))}的○</div>` : ""; }
  if(id === "sent"){ const t = sentOf(c, b); return t ? `<div class="h sent">${esc(t.replaceAll(c, "（　）"))}</div>` : ""; }
  if(id === "pic") return PICS[c] ? `<div class="pic" role="img" aria-label="圖片提示">${PICS[c]}</div>` : "";
  if(id === "sound") return `<div class="h">再慢慢唸一次</div>`;
  if(id === "parts") return PARTS[c] ? `<div class="h">${esc(PARTS[c].split(/\s+/).join(" ＋ "))}</div>` : "";
  if(id === "mask") return `<div class="maskch" aria-label="遮住一半的字">${esc(c)}</div>`;
  if(id === "shape") return `<div class="ghostch" aria-label="淡淡的字形">${esc(c)}</div>`;
  return "";
}

/* 語音：沿用生字賓果的做法，優先找台灣中文的聲音 */
let voices = [];
const loadVoices = () => { try { voices = speechSynthesis.getVoices(); } catch(e){} };
if("speechSynthesis" in window){ loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
const pickVoice = () => voices.find(v => v.lang === "zh-TW" && /Google/i.test(v.name)) || voices.find(v => v.lang === "zh-TW")
  || voices.find(v => /zh[-_]TW/i.test(v.lang)) || voices.find(v => /^zh/i.test(v.lang)) || null;
function speak(text, onend, rate){
  const done = () => { const sp = $("#speaker"); if(sp) sp.classList.remove("talk"); if(onend) onend(); };
  if(!("speechSynthesis" in window)){ setTimeout(done, 300); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-TW"; const v = pickVoice(); if(v) u.voice = v; u.rate = rate || settings.rate;
    u.onend = u.onerror = done;
    const sp = $("#speaker"); if(sp) sp.classList.add("talk");
    speechSynthesis.speak(u);
  } catch(e){ setTimeout(done, 300); }
}
/* 答對、答錯的短音效 */
let actx = null;
function tone(ok){
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.frequency.value = ok ? 880 : 220;
    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.3);
  } catch(e){}
}


/* =========================================================
   8. 作答畫面
   G：這一次評量進行中的所有狀態。
   正確率模式：學生輪流作答，queue 是出題順序（S01 第1題、S02 第1題、S01 第2題…）。
   流暢性模式：每位學生輪流做一回合，時間到換下一位。
   G.cur：目前這一題（目標字、選項、答錯次數、出現過的提示、時間）。
   ========================================================= */
let G = null;
const SPEAKER_SVG = `<svg viewBox="0 0 24 24" width="55%" height="55%" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>`;

function showScreen(id){
  for(const s of ["#setup", "#play", "#result"]) $(s).hidden = s !== id;
  window.scrollTo(0, 0);
}

function startSession(){
  const c = current(), q = quizPlan(), list = selKids();
  G = {
    session: Date.now(), cfg: c, q, kids: list,
    goal: state.goal, kind: state.kind, mode: state.mode, answer: state.answer,
    limit: +state.limit, aim: +$("#aim").value || 30, lessons: [...state.lessons],
    noHelp: c.noHelp, rule: c.rule || [], hints: c.hints, choices: +c.choices,
    tally: Object.fromEntries(list.map(k => [k, {n:0, first:0, passed:0, secs:[], wrong:0}])),
    quitArm: false
  };
  if(G.mode === "flu"){ G.turn = 0; showScreen("#play"); showReady(); return; }
  /* 正確率模式：每位學生各抽一份題目，再交錯排成輪流順序 */
  const lists = list.map(code => pickItems(code, q).map(it => ({...it, kid:code})));
  G.queue = [];
  for(let i = 0; i < Math.max(...lists.map(l => l.length)); i++) lists.forEach(l => { if(l[i]) G.queue.push(l[i]); });
  G.pos = 0;
  showScreen("#play");
  nextItem();
}

/* 畫上方的學生名字與進度 */
function drawBar(it){
  const k = kidBy(it.kid);
  $("#pWho").textContent = `輪到 ${k ? kidLabel(k) : it.kid}`;
  if(G.mode === "flu") $("#pProg").textContent = `答對 ${G.round.correct} 個`;
  else { const mine = G.queue.filter(x => x.kid === it.kid), idx = mine.indexOf(it) + 1; $("#pProg").textContent = `第 ${idx} / ${mine.length} 題`; }
}

function nextItem(){
  if(G.pos >= G.queue.length) return finish();
  newItem(G.queue[G.pos]);
}

/* 準備一題：組選項、畫畫面、唸題目；唸完才開始計時 */
function newItem(it){
  const b = splitKey(it.k)[0];
  G.cur = {it, b, opts: makeOptions(it.c, it.k, G.choices), wrong:0, firstPick:null, firstSec:null,
           shown:[], hintPos:0, teacher:0, t0:null, tShown:performance.now(), done:false};
  drawBar(it);
  const cols = G.choices === 4 ? 2 : 3;
  $("#pBody").innerHTML = `<div class="stage">
      <div class="prompt">
        <button class="speaker" id="speaker" aria-label="再聽一次">${SPEAKER_SVG}</button>
        <span class="note" style="margin:0">聽聽看，是哪一個字？</span>
        <div class="hintbox" id="hintbox" aria-live="polite"></div>
      </div>
      <div class="opts" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">
        ${G.cur.opts.map((o, i) => `<button class="opt-big" data-i="${i}">${esc(o.ch)}</button>`).join("")}
      </div>
    </div>
    ${G.noHelp ? "" : `<div class="tbar"><span>老師提示紀錄：</span>${TEACHER_BTNS.map(([lv, t]) => `<button class="chip" data-t="${lv}">${t}</button>`).join("")}</div>`}`;
  $("#pBody").querySelectorAll(".opt-big").forEach(btn => btn.onclick = () => pick(+btn.dataset.i, btn));
  $("#speaker").onclick = () => speak(sayOf(it.c, b));
  $("#pBody").querySelectorAll("[data-t]").forEach(btn => btn.onclick = () => {
    G.cur.teacher = Math.max(G.cur.teacher, +btn.dataset.t); btn.classList.add("on");
  });
  const startClock = () => { if(G && G.cur && G.cur.it === it && !G.cur.t0) G.cur.t0 = performance.now(); };
  speak(sayOf(it.c, b), startClock);
  setTimeout(startClock, 6000);   /* 萬一這台電腦沒有語音，6 秒後也開始計時 */
}

/* 學生點了一個選項 */
function pick(i, btn){
  const cur = G.cur;
  if(!cur || cur.done || btn.disabled) return;
  const o = cur.opts[i], sec = Math.round((performance.now() - (cur.t0 || cur.tShown)) / 100) / 10;
  if(cur.firstPick === null){ cur.firstPick = o; cur.firstSec = sec; }
  if(o.type === "答案"){
    btn.classList.add("right"); tone(true);
    return endItem(true, sec);
  }
  cur.wrong++;
  btn.classList.add("wrong", "shake"); btn.disabled = true; tone(false);
  if(G.mode === "flu" || G.noHelp) return endItem(false, null);
  const act = G.rule[cur.wrong - 1] || "reveal";
  if(act === "next") showNextHint();
  if(act === "reveal") reveal();
}

/* 依提示順序顯示下一個「有資料」的提示 */
function showNextHint(){
  const cur = G.cur;
  while(cur.hintPos < G.hints.length){
    const id = G.hints[cur.hintPos++], html = hintHtml(id, cur.it.c, cur.b);
    if(!html) continue;
    cur.shown.push(id);
    $("#hintbox").insertAdjacentHTML("beforeend", html);
    if(id === "sound") speak(sayOf(cur.it.c, cur.b), null, Math.max(0.5, settings.rate - 0.25));
    return;
  }
}

/* 顯示答案並唸一次，這題記為沒通過 */
function reveal(){
  const cur = G.cur;
  const i = cur.opts.findIndex(o => o.type === "答案");
  const btn = $(`#pBody .opt-big[data-i="${i}"]`); if(btn) btn.classList.add("show");
  speak(sayOf(cur.it.c, cur.b));
  endItem(false, null, true);
}

/* 一題結束：存紀錄，然後進下一題 */
function endItem(passed, correctSec, revealed){
  const cur = G.cur; cur.done = true;
  $("#pBody").querySelectorAll(".opt-big").forEach(b => b.disabled = true);
  const it = cur.it, [b, n] = splitKey(it.k), k = kidBy(it.kid) || {}, a = autoFor(it.kid, b, n);
  const sysLevel = Math.max(0, ...cur.shown.map(id => HINT_LEVEL[id]));
  const rec = {
    session: G.session, at: new Date().toISOString(), kid: it.kid, kidName: k.name || "",
    grade: k.code ? kidGrade(k) : "", studyGrade: k.code ? studyGrade(k) : "",
    kind: G.kind, goal: G.goal, mode: G.mode, answer: G.answer, method: G.q.method,
    timeLimit: G.mode === "flu" ? G.limit : "", book: b, bookName: bookName(b), lesson: n,
    char: it.c, word: wordOf(it.c, b), boost: !!it.boost,
    choices: cur.opts.length, options: cur.opts.map(o => o.ch).join(""),
    firstPick: cur.firstPick ? cur.firstPick.ch : "", firstCorrect: !!cur.firstPick && cur.firstPick.type === "答案",
    errorType: cur.firstPick && cur.firstPick.type !== "答案" ? cur.firstPick.type : "",
    passed, revealed: !!revealed, wrongCount: cur.wrong, crossed: cur.wrong,
    hintLevel: Math.max(sysLevel, cur.teacher), hints: cur.shown.map(hintName).join("、"),
    teacherPrompt: cur.teacher ? TEACHER_BTNS.find(t => t[0] === cur.teacher)[1] : "",
    firstSec: cur.firstSec, correctSec: passed ? correctSec : null,
    phase: phaseFor(it.kid, b, n) || "", daysAfter: state.manual[key(b,n)] ? "" : (a.days ?? "")
  };
  saveRecord(rec);
  const t = G.tally[it.kid];
  t.n++; if(rec.firstCorrect) t.first++; if(passed){ t.passed++; t.secs.push(correctSec); } else t.wrong++;
  if(G.mode === "flu"){
    if(rec.firstCorrect) G.round.correct++; else G.round.wrong++;
    $("#pProg").textContent = `答對 ${G.round.correct} 個`;
    setTimeout(() => { if(G && !G.round.over) newItem(nextFluItem()); }, rec.firstCorrect ? 300 : 600);
    return;
  }
  G.pos++;
  setTimeout(() => { if(G) nextItem(); }, passed ? 900 : revealed ? 2200 : 1000);
}

/* ---------- 流暢性模式：一位學生一回合 ---------- */
function showReady(){
  const code = G.kids[G.turn], k = kidBy(code);
  $("#pWho").textContent = `輪到 ${k ? kidLabel(k) : code}`;
  $("#pProg").textContent = "";
  $("#pTimer").hidden = true;
  $("#pBody").innerHTML = `<div class="ready"><h2>${esc(k ? kidLabel(k) : code)}，準備好了嗎？</h2>
    <p class="note" style="margin:0">${LIMITS.find(l => +l[0] === G.limit)[1]}內，聽到哪個字就點哪個，越多越好！</p>
    <button class="go" id="roundGo">開始</button></div>`;
  $("#roundGo").onclick = startRound;
}
function startRound(){
  const code = G.kids[G.turn];
  G.round = {kid: code, correct: 0, wrong: 0, over: false, end: performance.now() + G.limit * 1000, last: null};
  $("#pTimer").hidden = false;
  const bar = $("#pTimer i");
  const tick = () => {
    if(!G || !G.round || G.round.over) return;
    const left = G.round.end - performance.now();
    bar.style.width = `${Math.max(0, left / (G.limit * 10))}%`;
    if(left <= 0) return endRound();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  newItem(nextFluItem());
}
/* 流暢性模式的下一題：從所選課次隨機抽，不連續出同一個字 */
function nextFluItem(){
  const pool = G.lessons.flatMap(k => charsOf(k).map(c => ({c, k})));
  let it;
  do { it = pool[Math.floor(Math.random() * pool.length)]; } while(pool.length > 1 && G.round.last && it.c === G.round.last);
  G.round.last = it.c;
  return {...it, kid: G.round.kid};
}
function endRound(){
  G.round.over = true;
  try { speechSynthesis.cancel(); } catch(e){}
  const t = G.tally[G.round.kid];
  t.roundCorrect = G.round.correct; t.roundWrong = G.round.wrong;
  G.turn++;
  if(G.turn >= G.kids.length) return finish();
  showReady();
}

/* 結束按鈕：按兩次才結束，避免學生誤觸 */
$("#pQuit").onclick = () => {
  if(!G) return;
  if(!G.quitArm){ G.quitArm = true; $("#pQuit").textContent = "再按一次結束"; setTimeout(() => { if(G){ G.quitArm = false; $("#pQuit").textContent = "結束"; } }, 3000); return; }
  if(G.round) G.round.over = true;
  finish();
};


/* =========================================================
   9. 結果畫面、Excel 匯出與備份
   ========================================================= */
function finish(){
  try { speechSynthesis.cancel(); } catch(e){}
  $("#pTimer").hidden = true; $("#pQuit").textContent = "結束";
  const g = G;
  $("#rTitle").textContent = "完成了！";
  $("#rList").innerHTML = g.kids.map(code => {
    const t = g.tally[code], k = kidBy(code), name = esc(k ? kidLabel(k) : code);
    if(g.mode === "flu"){
      const perMin = Math.round((t.roundCorrect || 0) * 60 / g.limit);
      return `<div class="rcard"><b>${name}</b><span class="big">每分鐘 ${perMin} 個</span>
        <span class="sm">答對 ${t.roundCorrect || 0} 個、答錯 ${t.roundWrong || 0} 個（${LIMITS.find(l => +l[0] === g.limit)[1]}），目標每分鐘 ${g.aim} 個${perMin >= g.aim ? "，達到目標！" : ""}</span></div>`;
    }
    const avg = t.secs.length ? (t.secs.reduce((a, b) => a + b, 0) / t.secs.length).toFixed(1) : "—";
    return `<div class="rcard"><b>${name}</b><span class="big">${t.first} / ${t.n}</span>
      <span class="sm">第一次就答對 ${t.first} 題${t.n ? `（${Math.round(t.first / t.n * 100)}%）` : ""}，最後答對 ${t.passed} 題，答對平均 ${avg} 秒</span></div>`;
  }).join("") || `<p class="note">這次沒有作答紀錄。</p>`;
  $("#rNote").textContent = g.kind === "formal" ? "這次是正式評量，結果會納入學習分析。" : "這次是練習，結果另外統計。";
  showScreen("#result");
}
$("#rAgain").onclick = () => { if(G) startSession(); };
$("#rHome").onclick = () => { G = null; showScreen("#setup"); render(); };
$("#rExport").onclick = () => { if(G) exportXlsx(records.filter(r => r.session === G.session), `識字評量_${fileDate(G.session)}.xlsx`, "#rMsg"); };

/* Excel 欄位：標題 → 怎麼從紀錄取值 */
const yesNo = v => v ? "是" : "否";
const COLS = [
  ["日期時間", r => new Date(r.at).toLocaleString("zh-TW", {hour12:false})],
  ["學生代號", r => r.kid], ["名字", r => r.kidName], ["年級", r => r.grade], ["學習年級", r => r.studyGrade],
  ["正式或練習", r => r.kind === "formal" ? "正式評量" : "練習"],
  ["評量目標", r => `目標 ${r.goal}`], ["評量方式", r => r.mode === "flu" ? "流暢性" : "正確率"],
  ["時限（秒）", r => r.timeLimit], ["作答模式", r => (ANSWERS.find(a => a.id === r.answer) || {}).name || r.answer],
  ["出題方式", r => r.method === "all" ? "全部出題" : (METHODS.find(m => m.id === r.method) || {}).name || r.method],
  ["課本", r => r.bookName], ["課次", r => r.lesson], ["目標字", r => r.char], ["語詞", r => r.word],
  ["常用字加題", r => yesNo(r.boost)], ["選項數", r => r.choices], ["全部選項", r => r.options],
  ["第一次選的字", r => r.firstPick], ["第一次就答對", r => yesNo(r.firstCorrect)], ["錯誤類型", r => r.errorType],
  ["最後答對", r => yesNo(r.passed)], ["顯示答案", r => yesNo(r.revealed)], ["答錯次數", r => r.wrongCount],
  ["提示層級", r => r.hintLevel], ["用到的提示", r => r.hints], ["老師提示", r => r.teacherPrompt],
  ["第一次作答秒數", r => r.firstSec], ["答對秒數", r => r.correctSec ?? ""],
  ["評量時機", r => r.phase], ["教學後天數", r => r.daysAfter]
];
const fileDate = t => { const d = new Date(t); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}_${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}`; };
function exportXlsx(list, filename, msgSel){
  if(!list.length){ $(msgSel).textContent = "沒有可以匯出的紀錄。"; return; }
  if(!window.XLSX){ $(msgSel).textContent = "Excel 元件沒有載入，請確認電腦有連上網路後重新整理。"; return; }
  const rows = list.map(r => Object.fromEntries(COLS.map(([h, f]) => [h, f(r)])));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "作答紀錄");
  try { XLSX.writeFile(wb, filename); $(msgSel).textContent = `已匯出 ${list.length} 筆紀錄。`; }
  catch(e){ $(msgSel).textContent = "這個環境不允許下載檔案，請用一般瀏覽器開啟網站再匯出。"; }
}

/* 作答紀錄面板：每一次評量一列 */
function renderRecSheet(){
  const by = new Map();
  for(const r of records){ if(!by.has(r.session)) by.set(r.session, []); by.get(r.session).push(r); }
  const sessions = [...by].sort((a, b) => b[0] - a[0]);
  $("#recInfo").textContent = recDb ? `這台電腦共有 ${records.length} 筆作答紀錄、${sessions.length} 次評量。` : "這台電腦的瀏覽器不允許存檔，只看得到這次打開網頁後的紀錄。";
  $("#recTable").innerHTML = sessions.length ? `<thead><tr><th>日期</th><th>學生</th><th>性質</th><th>方式</th><th>題數</th><th>第一次就答對</th></tr></thead><tbody>${
    sessions.slice(0, 50).map(([sid, rs]) => {
      const first = rs.filter(r => r.firstCorrect).length;
      return `<tr><td>${new Date(sid).toLocaleString("zh-TW", {hour12:false, month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit"})}</td>
        <td>${esc([...new Set(rs.map(r => r.kid))].join("、"))}</td><td>${rs[0].kind === "formal" ? "正式" : "練習"}</td>
        <td>${rs[0].mode === "flu" ? "流暢性" : "正確率"}</td><td>${rs.length}</td><td>${Math.round(first / rs.length * 100)}%</td></tr>`;
    }).join("")}</tbody>` : `<tbody><tr><td>還沒有作答紀錄。</td></tr></tbody>`;
  $("#recMsg").textContent = "";
  $("#recClear").classList.remove("armed"); $("#recClear").textContent = "清除全部紀錄";
}
$("#recXlsx").onclick = () => exportXlsx(records, `識字評量_全部紀錄_${fileDate(Date.now())}.xlsx`, "#recMsg");
/* 備份檔：把作答紀錄、學生名單、教學日期、設定存成一個檔案，換電腦時可以還原 */
$("#recBackup").onclick = () => {
  const data = {app:"literacy", version:1, savedAt:new Date().toISOString(), settings, kids, teach, records: records.map(({id, ...r}) => r)};
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:"application/json"}));
    a.download = `識字評量_備份_${fileDate(Date.now())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    $("#recMsg").textContent = "已下載備份檔，請存到隨身碟或雲端硬碟。";
  } catch(e){ $("#recMsg").textContent = "這個環境不允許下載檔案，請用一般瀏覽器開啟網站再備份。"; }
};
$("#recRestore").onchange = async e => {
  const f = e.target.files[0]; e.target.value = "";
  if(!f) return;
  try {
    const data = JSON.parse(await f.text());
    if(data.app !== "literacy") throw new Error("不是識字評量的備份檔");
    const have = new Set(records.map(r => `${r.session}|${r.at}|${r.kid}|${r.char}`));
    const add = (data.records || []).filter(r => !have.has(`${r.session}|${r.at}|${r.kid}|${r.char}`));
    add.forEach(saveRecord);
    for(const k of data.kids || []) if(!kidBy(k.code)) kids.push(k);
    for(const [k, v] of Object.entries(data.teach || {})) if(!teach[k]) teach[k] = v;
    saveKids(); saveTeach();
    $("#recMsg").textContent = `已還原 ${add.length} 筆新的作答紀錄（重複的紀錄不會再加一次）。`;
    renderRecSheet(); $("#recMsg").textContent = `已還原 ${add.length} 筆新的作答紀錄（重複的紀錄不會再加一次）。`; render();
  } catch(err){ $("#recMsg").textContent = `沒辦法讀取這個檔案：${err.message}`; }
};
$("#recClear").onclick = e => {
  const b = e.currentTarget;
  if(!b.classList.contains("armed")){ b.classList.add("armed"); b.textContent = "確定要刪除？再按一次"; return; }
  clearRecords(); renderRecSheet(); $("#recMsg").textContent = "已清除全部作答紀錄。";
};

/* 全部準備好後，畫出設定畫面（依上次用的模式） */
setUi(ui);
