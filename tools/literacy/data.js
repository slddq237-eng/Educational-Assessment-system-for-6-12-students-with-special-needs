/* =========================================================
   識字評量：基本資料（data.js）
   所有檔案共用的設定、小工具、存在這台電腦的資料，以及評量時機判斷。
   載入順序見 index.html 最下面；這個檔案要最先載入。
   ========================================================= */

/* =========================================================
   1. 基本設定與小工具
   ========================================================= */
/* 畫面上課本的排列順序：依版本、年級、學期自動排序，新增課本時不用改程式 */
const EDITION_ORDER = ["翰林", "南一", "康軒"];
const edRank = e => { const i = EDITION_ORDER.indexOf(e); return i < 0 ? 99 : i; };
const BOOK_ORDER = Object.keys(BOOKS).sort((a, b) => edRank(BOOKS[a].edition) - edRank(BOOKS[b].edition)
  || BOOKS[a].grade - BOOKS[b].grade || (BOOKS[a].term === "下") - (BOOKS[b].term === "下"));
/* 干擾字：各版本自己的資料（CONF_ED）優先，沒有再用共用的 CONF */
const confOf = (c, b) => ((typeof CONF_ED !== "undefined" && CONF_ED[b]) || {})[c] || CONF[c];
/* 課次名稱：第 0 課是課前單元（例如康軒一上的「真簡單」），直接顯示單元名稱 */
const lessonName = (b, n) => n === "0" ? (BOOKS[b].lessons[n].title || "課前單元") : `第 ${n} 課`;
/* 幫每一課算好：總字數、是否每個字都有形近同音資料、有部件資料的字數 */
for(const [bk, b] of Object.entries(BOOKS)) for(const L of Object.values(b.lessons)){
  const chars = [...(L.write + L.read)];
  L.total = chars.length; L.conf = chars.every(c => confOf(c, bk)); L.parts = chars.filter(c => PARTS[c]).length;
}

const GOALS = [
  {id:"1",  order:"建議第 1 步", name:"聽音選圖",  what:"聽語詞，點出正確的圖片（音 ↔ 義）", off:"第 2 版開放"},
  {id:"2",  order:"建議第 2 步", name:"看字選圖",  what:"看字或語詞，點出正確的圖片（形 ↔ 義）", off:"第 2 版開放"},
  {id:"3",  order:"建議第 3 步", name:"形音辨識",  what:"聽「努力的努」，從形近字、同音字、同詞易混字中選出目標字"},
  {id:"4-1",order:"建議第 4 步", name:"部件拼圖",  what:"看拆開的部件，選出拼起來的字"},
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
/* 畫面與聲音：作答畫面字的大小、設定畫面的大小（數字是放大倍數） */
const FONT_SIZES = [["0.8","小"],["1","標準"],["1.2","大"],["1.4","特大"]];
const UI_SIZES = [["0.85","小"],["1","標準"],["1.15","大"]];
/* 多人輪流換人時的提醒方式（畫面一定會顯示「換 ○○」）；預設是畫面＋提示音，要唸名字再到「畫面與聲音」改 */
const TURN_STYLES = [["chime","畫面＋提示音（預設）"],["voice","畫面＋唸出名字"],["both","畫面＋提示音＋唸出名字"],["silent","只有畫面"]];
const LIMITS = [["30","30 秒"],["60","1 分鐘"],["120","2 分鐘"]];
const CHOICES = [["3","3 個"],["4","4 個"],["6","6 個"],["bingo","全課賓果卡（只在練習）"]];
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
/* formalTheme：正式評量也用主題和貼紙（預設要用；從基線期起每次都一樣，前後才能比較）
   畫面與聲音（每台電腦自己的設定）：fontScale 作答畫面字的大小、uiScale 設定畫面大小、rate 唸讀速度、sfx 音效開關 */
const settings = Object.assign({choices:"4", hints:["word","pic"], rule:["remove","next","next","reveal"], maintainAfter:7, rate:0.85, formalTheme:true,
  fontScale:"1", uiScale:"1", sfx:true, turnStyle:"chime",
  /* 作答時右上角顯示計時：練習預設顯示；正式評量預設不顯示（可能讓學生緊張、影響反應時間），在評量設定打開 */
  clockPractice:true, clockFormal:false,
  /* 打怪獸（3-3）：練習預設要玩（選主題畫面可以改）；正式評量預設不玩，在評量設定打開，從基線期起維持同一個設定 */
  practiceGame:true, formalGame:false,
  /* 血量模式（3-3b，只在練習）：開始前選幾顆愛心，0＝不用 */
  practiceHearts:0},
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
/* 老師看的畫面：「姓名（代號）」；學生看的畫面（輪到誰、結果）：只顯示姓名，沒填姓名才顯示代號 */
const kidLabel = k => k.name ? `${k.name}（${k.code}）` : k.code;
const kidShow = k => k.name || k.code;
/* 判斷時機用的「學習年級」：有課程調整就用調整後的年級 */
const studyGrade = k => adjLevel(k) || kidGrade(k);
const gradeText = k => `${GRADES[kidGrade(k)-1]}年級${adjLevel(k) ? `・課程調整到${GRADES[adjLevel(k)-1]}年級` : ""}`;

/* 教學日期：每一課一筆，{type:"dates", start, end} 或 {type:"notYet"}；沒有紀錄就依學生年級判斷 */
const key = (b,n) => b + "-" + n;
const teach = load("literacy-teach", {});
const saveTeach = () => store("literacy-teach", teach);

const state = {
  theme:"",   /* 這次選的主題（作答前在選主題畫面選） */
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
  if(!t.start) return {phase:null, why:"日期還沒填完整"};
  /* 只有開始日、還沒填結束日：開始前是基線期，開始後是教學中（學扶前後測會自動記開始日） */
  if(!t.end) return today < parse(t.start) ? {phase:"基線期", why:`教學從 ${md(t.start)} 開始`} : {phase:"教學中", why:`教學從 ${md(t.start)} 開始，還沒填結束日`};
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
