/* =========================================================
   識字評量：基本資料（data.js）
   所有檔案共用的設定、小工具、存在這台電腦的資料，以及評量時機判斷。
   載入順序見 index.html 最下面；這個檔案要最先載入。
   ========================================================= */

/* =========================================================
   1. 基本設定與小工具
   ========================================================= */
/* 課本排序與名稱（BOOK_ORDER、bookName、lessonName）、語詞（wordOf、sentOf）、干擾字（confOf）、esc 都在 shared/common.js */
/* 部件（查法見 shared/common.js 的 rawParts）：拆成 2 個以上、而且不含字本身才算「拆得開」；
   拆不開（獨體字、只拆出一塊、PARTS 寫成自己）回傳 null，部件提示和部件重組會改成把字切成碎塊（見 play.js 的 cutHtml），不會直接顯示答案 */
function partsOf(c){
  const list = rawParts(c);
  return list.length >= 2 && !list.includes(c) ? list : null;
}
/* 幫每一課算好：總字數、是否每個字都有形近同音資料、拆得開的字數 */
for(const [bk, b] of Object.entries(BOOKS)) for(const L of Object.values(b.lessons)){
  const chars = [...(L.write + L.read)];
  L.total = chars.length; L.conf = chars.every(c => confOf(c, bk)); L.parts = chars.filter(c => partsOf(c)).length;
}

const GOALS = [
  {id:"1",  order:"建議第 1 步", name:"聽音選圖",  what:"聽語詞，點出正確的圖片（音 ↔ 義）", off:"第 2 版開放"},
  {id:"2",  order:"建議第 2 步", name:"看字選圖",  what:"看字或語詞，點出正確的圖片（形 ↔ 義）", off:"第 2 版開放"},
  {id:"3",  order:"建議第 3 步", name:"形音辨識",  what:"聽「努力的努」，從形近字、同音字、同詞易混字中選出目標字"},
  {id:"4-1",order:"建議第 4 步", name:"部件重組",  what:"看拆開的部件，選出組成的字"},
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
const CHOICES = [["3","3 個"],["4","4 個"],["6","6 個"]];
const choiceText = c => c === "bingo" ? "生字賓果卡" : `${c} 個選項`;
/* 練習的玩法（第 4 步選）：正式評量看「評量設定」（打怪獸開或關），生字賓果只在練習
   icon：第 4 步卡片上的小圖示（自己畫的 SVG，不用圖片檔）；desc：卡片上的一句話說明 */
const ICON_LINE = `stroke="#1f3d36" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const PLAYS = [
  {id:"color",   name:"一般模式", desc:"沒有遊戲。作答畫面換成主題的顏色，做完拿貼紙",
   icon:`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 7C18 7 7 17 7 31c0 13 10 24 22 24 4 0 6-2 6-5 0-2-1-3-1-5 0-3 2-5 5-5h6c8 0 13-6 13-13C58 16 47 7 32 7z" fill="#f6dfb4" ${ICON_LINE}/><circle cx="20" cy="27" r="5" fill="#d64534"/><circle cx="31" cy="17" r="5" fill="#2a78d6"/><circle cx="44" cy="21" r="5" fill="#2c7a69"/><circle cx="21" cy="41" r="5" fill="#e0a21b"/></svg>`},
  {id:"monster", name:"打怪獸",   desc:"每做完一題就攻擊怪獸，全部做完打敗牠（多人時大家合作）",
   icon:`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M19 22l-5-11M45 22l5-11" ${ICON_LINE}/><ellipse cx="32" cy="38" rx="23" ry="20" fill="#8fd16a" ${ICON_LINE}/><circle cx="32" cy="32" r="8" fill="#fff" ${ICON_LINE}/><circle cx="33" cy="33" r="3.5" fill="#1f3d36"/><path d="M21 45q11 9 22 0z" fill="#fff" ${ICON_LINE}/><path d="M27 47l2 4 2-4M33 47l2 4 2-4" fill="none" stroke="#1f3d36" stroke-width="2"/></svg>`},
  {id:"bingo",   name:"生字賓果", desc:"生字排成賓果卡，聽到哪個字就點哪個，連成一線有慶祝",
   icon:`<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="7" width="50" height="50" rx="8" fill="#fff" ${ICON_LINE}/><path d="M23.7 7v50M40.3 7v50M7 23.7h50M7 40.3h50" stroke="#1f3d36" stroke-width="2"/><circle cx="15.3" cy="15.3" r="5.5" fill="#d64534"/><circle cx="32" cy="32" r="5.5" fill="#d64534"/><circle cx="48.7" cy="48.7" r="5.5" fill="#d64534"/><path d="M11 11l42 42" stroke="#e0a21b" stroke-width="3" stroke-linecap="round" opacity=".85"/></svg>`}
];
/* 第 4 步其他列的小圖示：血量（紅心，和作答畫面一樣）、注音、報讀（喇叭） */
const ROW_ICONS = {
  "血量": `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" fill="#d64534"/></svg>`,
  "注音": `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#2c7a69"/><text x="12" y="17" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">ㄅ</text></svg>`,
  "報讀": `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#2a78d6" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>`
};
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
  /* 平板作答（tablet.js）：一個 QR code 可以給幾位學生，每位在自己的平板點自己的代號；目前只能用在練習 */
  {id:"qr",      name:"平板掃 QR code", desc:"學生用自己的平板掃描作答，做完傳回老師的 Google 表單（目前只能練習）", min:1, max:12}
];
const TAUGHT = [["","依學生年級自動判斷"],["dates","輸入教學日期"],["notYet","還沒教"]];
const PHASES = ["基線期","教學中","教學後","維持期"];
const GRADES = ["一","二","三","四","五","六"];

/* 作答紀錄的格式版本（開發路線圖 A4）：每筆紀錄都記下 fmt，之後改紀錄格式時新舊資料分得開。
   改格式的規則：只加新欄位、不改舊欄位的意思；真的要改意思時，版本加 1，並寫在下面和 docs/records.md。
   1＝2026-10-21 以前的紀錄（沒有 fmt 這一欄）；2＝加上 fmt 與裝置類型 device */
const RECORD_FORMAT = 2;
/* 作答的裝置類型：觸控而且螢幕短邊小於 600 像素＝手機；主要靠手指點（沒有滑鼠）＝平板；其他＝電腦 */
function deviceType(){
  const touch = navigator.maxTouchPoints > 0, coarse = matchMedia("(pointer: coarse)").matches;
  if(touch && Math.min(screen.width, screen.height) < 600) return "手機";
  return coarse ? "平板" : "電腦";
}

const DAY = 864e5;
const today = new Date(); today.setHours(0,0,0,0);
const iso = d => new Date(d.getTime() - d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
const parse = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
const md = s => { const d = parse(s); return `${d.getMonth()+1}/${d.getDate()}`; };
/* 平板作答（tablet.js）：學生掃老師電腦上的 QR code 打開網頁，網址 #t= 後面帶著這次練習的設定。
   這時設定、學生、教學日期、字組都從網址讀（TABLET.d，名稱和 localStorage 相同），也不寫回平板（平板可能也是別的老師在用的）。
   網址裡有學生名字：一打開就把設定移到這個分頁的 sessionStorage（關掉分頁就不見），網址列只留 #t，
   瀏覽紀錄比較不會留下名字；重新整理時從 sessionStorage 讀回來。
   讀不出來時 TABLET＝{bad:true}，tablet.js 會請學生重新掃描。 */
const TABLET = (() => {
  const m = location.hash.match(/^#t=([\w-]+)/);
  let raw = m && m[1];
  if(raw){ try { sessionStorage.setItem("literacy-tablet", raw); history.replaceState(null, "", location.pathname + location.search + "#t"); } catch(e){} }
  else if(location.hash === "#t"){ try { raw = sessionStorage.getItem("literacy-tablet"); } catch(e){} if(!raw) return {bad:true}; }
  else return null;
  try { const b = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0)))); } catch(e){ return {bad:true}; }
})();
if(TABLET) document.documentElement.classList.add("tablet");
const load = (k, fallback) => { if(TABLET) return (TABLET.d || {})[k] ?? fallback; try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v ?? fallback; } catch(e){ return fallback; } };
const store = (k, v) => { if(TABLET) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };

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
  /* 打怪獸（3-3）：正式評量預設不玩，在評量設定打開，從基線期起維持同一個設定。
     練習的玩法在第 4 步選（practicePlay：一般模式 color／打怪獸 monster／生字賓果 bingo，預設打怪獸） */
  formalGame:false,
  /* 練習打怪獸：每做完幾題跳一次動畫（細部設定 → 練習與遊戲；預設 3 題，2026-10-22 維護者決定） */
  sceneEvery:"3",
  /* 血量模式（3-3b，只在練習）：開始前選幾點血量，0＝不用 */
  practiceHearts:0,
  /* 練習的選項加注音（3-4）：第 4 步可以改；正式評量的選項一律不加（會變成看注音找字） */
  practiceBpmf:false,
  /* 報讀提示：語詞、句子提示旁的小喇叭，按了念出完整語詞或句子。練習在第 4 步開關（預設開）；
     正式評量看「評量設定」（預設關，從基線期起維持同一個設定）；部件重組（4-1）一律沒有 */
  practiceRead:true, formalRead:false},
  load("literacy-settings", {}));
/* 以前存的「打怪獸要不要玩」（practiceGame）換成新的玩法設定 */
if(!settings.practicePlay) settings.practicePlay = settings.practiceGame === false ? "color" : "monster";
delete settings.practiceGame;
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

/* 教學日期：每一課一筆「全班預設」，{type:"dates", start, end} 或 {type:"notYet"}；沒有紀錄就依學生年級判斷。
   同一課學生進度不同時（例如學扶、跨受試研究），個別學生可以另外設定，存在 kids：{學生代號: {type, start, end}}（2026-10-21，A8）。
   沒有個別設定的學生沿用全班預設；舊資料沒有 kids，就是全班預設，不用轉換。 */
const key = (b,n) => b + "-" + n;
const teach = load("literacy-teach", {});
const saveTeach = () => store("literacy-teach", teach);
/* 某位學生在某一課實際用的教學日期：有個別設定就用個別的，沒有就用全班預設 */
const teachFor = (k, code) => { const t = teach[k] || {}; return (code && t.kids && t.kids[code]) || t; };
/* 這次手動指定的評量時機（學扶前後測卡片、或第 3 步「這次全部改為」）；學扶的「教學後」要看每位學生自己的結束日 */
const manualFor = (code, k) => state.rtiKeys && state.rtiKeys.includes(k) ? rtiPhaseFor(k, code) : state.manual[k];

const state = {
  theme:"",   /* 這次實際用的主題（""＝不用主題） */
  themePick:"",   /* 第 4 步學生點的主題：""＝還沒點、none＝不用主題、或主題代號；選好才能開始，再玩一次沿用 */
  /* 每位學生不同的提示（只在進階設定的練習）：學生代號 → {hints:Set, rule:[]}；沒有的學生用大家共用的 pHints、pRule */
  kidHints:{}, hintFor:"",
  goal:"3", kind:"formal", mode:"acc", limit:"60",
  pChoices:"6", pHints:new Set(["word","sent","pic"]), pRule:["next","next","remove","reveal"],
  ed:"翰林", book:"h2", lessons:[], qCount:null, qMethod:"even", manual:{}, answer:"turn",
  kids:new Set()
};
let dBook = "h2";

const $ = s => document.querySelector(s);

/* =========================================================
   3. 評量時機判斷（基線期／教學中／教學後／維持期）
   ========================================================= */

/* 依教學日期判斷 */
function datePhase(t){
  if(!t.start) return {phase:null, why:"日期還沒填完整"};
  /* 只有開始日、還沒填結束日：開始前是基線期，開始後是教學中 */
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
  const t = teachFor(key(b,n), code);
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
const phaseFor = (code, b, n) => manualFor(code, key(b,n)) || autoFor(code, b, n).phase;
const selKids = () => [...state.kids].filter(kidBy);
const phases = () => state.lessons.flatMap(k => { const [b,n] = k.split("-"); return selKids().map(c => phaseFor(c, b, n)); });
/* 把同一課、同一時機的學生合在一起顯示 */
function groups(b, n){
  const g = new Map();
  for(const c of selKids()){
    const m = manualFor(c, key(b,n)), a = autoFor(c, b, n), p = m || a.phase;
    const label = p ? `${p}${!m && a.days!=null && (p==="教學後"||p==="維持期") ? `（第 ${a.days} 天）` : ""}` : null;
    const id = (label || "") + "|" + (m ? "手動指定" : a.why);
    if(!g.has(id)) g.set(id, {label, why: m ? "這次手動指定" : a.why, kids:[]});
    g.get(id).kids.push(c);
  }
  return [...g.values()];
}

/* 這次實際套用的條件 */
/* 不適合某些評量目標的提示（開發路線圖 A2，規格書「提示和題目的適配性」表裡的 ✗）：會直接給出答案，程式自動跳過。
   △（提示很強）的還是可以用，等維護者討論決定。之後新增評量目標時，在這裡加一列。 */
const HINT_UNFIT = {
  "1":   {pic:"答案就是圖片", mask:"會直接看到字", shape:"會直接看到字"},
  "2":   {pic:"答案就是圖片", mask:"會直接看到字", shape:"會直接看到字"},
  "4-1": {parts:"題目本身就是部件", sound:"會唸出答案的讀音，部件重組不唸題目"}
};
const unfitWhy = (goal, h) => (HINT_UNFIT[goal] || {})[h] || "";
const fitHints = (goal, list) => list.filter(h => !unfitWhy(goal, h));
function current(){
  const formal = state.kind === "formal", flu = state.mode === "flu";
  const base = formal && phases().includes("基線期");
  const noHelp = flu || base;
  return {
    formal, flu, base, noHelp,
    choices: formal || flu ? settings.choices : settings.practicePlay === "bingo" ? "bingo" : state.pChoices,
    hints: noHelp ? [] : fitHints(state.goal, formal ? settings.hints : HINT_ORDER.filter(h => state.pHints.has(h))),
    rule: noHelp ? null : (formal ? settings.rule : state.pRule)
  };
}
/* 某位學生這次的提示與答錯規則：進階設定的練習可以每人不同，其他情況大家都一樣 */
function kidCfg(c, code){
  const own = !c.noHelp && !c.formal && !isQuick() && state.kidHints[code];
  return own ? {hints: fitHints(state.goal, HINT_ORDER.filter(h => own.hints.has(h))), rule: own.rule} : {hints: c.hints, rule: c.rule};
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
