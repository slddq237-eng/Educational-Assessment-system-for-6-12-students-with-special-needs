/* =========================================================
   識字評量：基本資料（data.js）
   所有檔案共用的設定、小工具、存在這台電腦的資料，以及評量時機判斷。
   載入順序見 index.html 最下面；這個檔案要最先載入。
   ========================================================= */

/* =========================================================
   1. 基本設定與小工具
   ========================================================= */
/* 課本排序與名稱（BOOK_ORDER、bookName、lessonName）、語詞（wordOf、sentOf）、干擾字（confOf）、esc 都在 shared/common.js */
/* 一排可以點選的小按鈕：list＝[[值, 顯示文字]…]，cur＝目前選的值，key＝data-○○ 的名字（設定畫面、老師專區都用；2026-10-24 從 teacher.js 搬來，因為平板不載入 teacher.js） */
const chipRow = (list, cur, key, extra = () => "") => list.map(([v, t]) => `<button class="chip ${cur === v ? "on" : ""}" data-${key}="${v}" aria-pressed="${cur === v}" ${extra(v)}>${t}</button>`).join("");
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
  /* 選目標的畫面只顯示名稱、一句話描述、遊戲畫面截圖（img，在 img/ 資料夾；還沒開放的目標沒有）；建議順序和目標編號先拿掉，之後有要做再加（2026-10-25 維護者要求）；id 還是紀錄裡的 goal 值，不能改。括弧內標示的寫法統一：（音 ↔ 義）（形 ↔ 義）（形 ↔ 音） */
  {id:"1",  name:"聽音選圖",  what:"聽語詞，點出正確的圖片（音 ↔ 義）", off:"準備中"},
  {id:"2",  name:"看字選圖",  what:"看字或語詞，點出正確的圖片（形 ↔ 義）", off:"準備中"},
  {id:"3",  name:"聽音選字",  what:"聽「努力的努」，從形近字、同音字、同詞字中選出目標字（形 ↔ 音）", img:"img/goal-3.jpg"},
  {id:"4-1",name:"部件重組",  what:"看拆開的部件，選出組成的字", img:"img/goal-4-1.jpg"},
  {id:"4-2",name:"看提示書寫", what:"寫出目標字；先用紙筆作答、老師登錄", off:"準備中"}
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
/* 練習的玩法（第 4 步選）：一般、遊戲、賓果三個按鈕（2026-10-24 維護者決定）；正式評量看「評量設定」（遊戲開或關），生字賓果只在練習
   icon：第 4 步卡片上的小圖示（自己畫的 SVG，不用圖片檔）；desc：卡片上的一句話說明 */
const ICON_LINE = `stroke="#1f3d36" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const PLAYS = [
  {id:"color",   name:"一般模式", desc:"沒有遊戲。作答畫面換成主題的顏色，做完拿貼紙",
   icon:`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 7C18 7 7 17 7 31c0 13 10 24 22 24 4 0 6-2 6-5 0-2-1-3-1-5 0-3 2-5 5-5h6c8 0 13-6 13-13C58 16 47 7 32 7z" fill="#f6dfb4" ${ICON_LINE}/><circle cx="20" cy="27" r="5" fill="#d64534"/><circle cx="31" cy="17" r="5" fill="#2a78d6"/><circle cx="44" cy="21" r="5" fill="#2c7a69"/><circle cx="21" cy="41" r="5" fill="#e0a21b"/></svg>`},
  {id:"game",    name:"遊戲",     desc:"下面選一張遊戲卡片：打外星人、釣大魚、孵恐龍蛋、做蛋糕",
   icon:`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M19 22l-5-11M45 22l5-11" ${ICON_LINE}/><ellipse cx="32" cy="38" rx="23" ry="20" fill="#8fd16a" ${ICON_LINE}/><circle cx="32" cy="32" r="8" fill="#fff" ${ICON_LINE}/><circle cx="33" cy="33" r="3.5" fill="#1f3d36"/><path d="M21 45q11 9 22 0z" fill="#fff" ${ICON_LINE}/><path d="M27 47l2 4 2-4M33 47l2 4 2-4" fill="none" stroke="#1f3d36" stroke-width="2"/></svg>`},
  {id:"bingo",   name:"生字賓果", desc:"生字排成賓果卡，聽到哪個字就點哪個，連成一線有慶祝",
   icon:`<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="7" width="50" height="50" rx="8" fill="#fff" ${ICON_LINE}/><path d="M23.7 7v50M40.3 7v50M7 23.7h50M7 40.3h50" stroke="#1f3d36" stroke-width="2"/><circle cx="15.3" cy="15.3" r="5.5" fill="#d64534"/><circle cx="32" cy="32" r="5.5" fill="#d64534"/><circle cx="48.7" cy="48.7" r="5.5" fill="#d64534"/><path d="M11 11l42 42" stroke="#e0a21b" stroke-width="3" stroke-linecap="round" opacity=".85"/></svg>`}
];
/* ---------- 玩法相容表（開發路線圖 B9，2026-10-24 維護者決定） ----------
   「遊戲」在程式裡分兩類：對抗類（答對累積進度、最後擊敗目標）、建築類（答對疊一層、最後完成作品），動畫照這兩類做。
   學生看到的是遊戲卡片（主題・動作），點一張就同時選好主題和遊戲；前台不顯示分類名稱。
   之後加新的遊戲或主題：在 GAME_CARDS 加一列，能不能用的規則都寫在 playWhy。
   （現在一個主題一張卡片，卡片用主題代號辨認；之後同一個主題要有兩種遊戲時，卡片要另外給代號。） */
const GAME_TYPES = {fight:"對抗類", build:"建築類"};
const GAME_CARDS = [
  {theme:"space",   type:"fight", act:"打外星人"},
  {theme:"ocean",   type:"fight", act:"釣大魚"},
  {theme:"dino",    type:"fight", act:"孵恐龍蛋"},
  {theme:"dessert", type:"build", act:"做蛋糕"}
];
const gameCard = theme => GAME_CARDS.find(c => c.theme === theme);
/* 個人或合作（第 3 步）：平板、正式評量（2026-10-24 決定：每位學生要獨立作答）、只有一位學生時固定個人；
   其他（練習、大螢幕輪流、2 位以上）由老師選，存在 settings.practiceTeam */
const teamFixed = () => state.answer === "qr" ? "平板作答每人一台，固定個人" : state.kind === "formal" ? "正式評量每位學生獨立作答，固定個人"
  : state.mode === "flu" ? "流暢性模式每人輪流一回合，固定個人" : selKids().length < 2 ? "只有一位學生，固定個人" : "";
const team = () => teamFixed() ? "solo" : settings.practiceTeam;
/* 某個玩法這次能不能用；不能用時回傳原因（設定畫面把卡片變灰並寫出來），能用回傳空字串 */
function playWhy(id){
  const flu = state.mode === "flu", coop = team() === "coop";
  if(id === "color") return coop ? "合作只能玩遊戲" : "";
  if(flu) return "流暢性模式不能用";
  if(id === "game") return !coop && selKids().length > 1 && (state.answer === "turn" || state.answer === "splitturn") ? "多位學生各玩各的還不能玩遊戲（之後做），要玩請選合作" : "";
  if(id === "bingo") return state.answer === "splitturn" ? "分區輪流之後再支援賓果" : coop ? "合作賓果之後再做" : "";
  return "";
}
/* 這次實際用的玩法：選的不能用時，改用第一個能用的 */
const playNow = () => !playWhy(settings.practicePlay) ? settings.practicePlay : PLAYS.map(p => p.id).find(id => !playWhy(id)) || "color";
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
const REACT = {remove:"選錯的選項打叉", next:"出現下一個提示", free:"沒有提示，也不顯示答案，讓學生自己點", reveal:"顯示答案並唸一次，進入下一題"};   /* 選錯的選項每次都會停用，remove 只是舊紀錄的說法 */
const ANSWERS = [
  {id:"turn",    name:"大螢幕・輪流",   desc:"1～4 人輪流在同一個螢幕作答", min:1, max:4},
  /* 分區輪流（E14，2026-10-25 維護者決定）：版面同時顯示所有人，輪到的人那一區亮起；一次仍只有一人作答。
     最多 3 位；先只開放練習、正確率模式（setup.js 的 step3Miss 寫原因）；作答模式記在紀錄的 answer 欄，不加新欄位 */
  {id:"splitturn", name:"大螢幕・分區輪流", desc:"2～3 人輪流，每人一區同時顯示在畫面上，輪到的人那一區亮起（目前只能練習）", min:2, max:3},
  {id:"split",   name:"大螢幕・同時",   desc:"螢幕分成 2～4 區，各自作答（需支援多點觸控）", min:2, max:4, off:"準備中"},
  {id:"present", name:"呈現模式・紙筆", desc:"螢幕只出題，學生寫在紙上，老師改完再登錄", min:1, max:99, off:"準備中"},
  /* 平板作答（tablet.js）：一個 QR code 可以給幾位學生，每位在自己的平板點自己的代號；練習和正式評量都能用（2026-10-25 起，A3-18） */
  {id:"qr",      name:"平板掃 QR code", desc:"學生用自己的平板掃描作答，做完傳回老師的 Google 表單", min:1, max:12}
];
const TAUGHT = [["","依學生年級自動判斷"],["dates","輸入教學日期"],["notYet","還沒教"]];
/* 前後測（A8，2026-10-25）：一般老師只有前測、後測；沒標的紀錄這一欄是空白。研究時期（基線期／介入期／維持期）以後由研究計畫事先設定 */
const PREPOST = ["前測","後測"];
const GRADES = ["一","二","三","四","五","六"];

/* 作答紀錄的格式版本（開發路線圖 A4）：每筆紀錄都記下 fmt，之後改紀錄格式時新舊資料分得開。
   改格式的規則：只加新欄位、不改舊欄位的意思；真的要改意思時，版本加 1，並寫在下面和 docs/design/records.md。
   1＝2026-10-21 以前的紀錄（沒有 fmt 這一欄）；2＝加上 fmt 與裝置類型 device；
   3＝2026-10-25 A8（見 docs/design/a8-terms.md）：刪掉 phase（評量時機），加上 prepost（前後測）、planId／planVer／rphase（研究計畫與研究時期，研究計畫做出來前都是空白）。
   第 3 版直接改格式、不處理舊紀錄的對應（維護者決定：現在幾乎無人使用） */
const RECORD_FORMAT = 3;
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
/* 儲存名稱表：識字評量存在這台電腦的資料（localStorage、sessionStorage），名稱只寫在這裡。
   其他檔案用 KEYS.settings 這樣拿，不要自己打完整的名稱（打錯一個字，老師存的資料就讀不到）；
   用了表裡沒有的名稱，自動檢查會報錯。新增名稱時也寫進 docs/code/architecture.md 第 6 節。
   作答紀錄的 IndexedDB 名稱在 records.js 的 REC_DB（只有它用）。 */
const KEYS = Object.freeze({
  settings:"literacy-settings", kids:"literacy-kids", teach:"literacy-teach", wordsets:"literacy-wordsets",
  ui:"literacy-ui", preset:"literacy-preset", teacher:"literacy-teacher", pivot:"literacy-pivot", pivots:"literacy-pivots",
  lastBackup:"literacy-lastBackup",
  tablet:"literacy-tablet"   /* sessionStorage：平板作答這個分頁的練習設定 */
});
/* 平板作答（tablet.js）：學生掃老師電腦上的 QR code 打開網頁，網址 #t= 後面帶著這次練習的設定。
   這時設定、學生、教學日期、字組都從網址讀（TABLET.d，名稱和 localStorage 相同），也不寫回平板（平板可能也是別的老師在用的）。
   網址裡有學生名字：一打開就把設定移到這個分頁的 sessionStorage（關掉分頁就不見），網址列只留 #t，
   瀏覽紀錄比較不會留下名字；重新整理時從 sessionStorage 讀回來。
   讀不出來時 TABLET＝{bad:true}，tablet.js 會請學生重新掃描。 */
const TABLET = (() => {
  const m = location.hash.match(/^#t=([\w-]+)/);
  let raw = m && m[1];
  if(raw){ try { sessionStorage.setItem(KEYS.tablet, raw); history.replaceState(null, "", location.pathname + location.search + "#t"); } catch(e){} }
  else if(location.hash === "#t"){ try { raw = sessionStorage.getItem(KEYS.tablet); } catch(e){} if(!raw) return {bad:true}; }
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
const settings = Object.assign({choices:"4", rate:0.85, formalTheme:true,
  fontScale:"1", uiScale:"1", sfx:true, turnStyle:"chime",
  /* 作答時右上角顯示計時：練習預設顯示；正式評量預設不顯示（可能讓學生緊張、影響反應時間），在評量設定打開 */
  clockPractice:true, clockFormal:false,
  /* 打怪獸（3-3）：正式評量預設不玩，在評量設定打開，從基線期起維持同一個設定。
     練習的玩法在第 4 步選（practicePlay：一般 color／遊戲 game／生字賓果 bingo，預設遊戲）；
     多位學生在大螢幕輪流時個人或合作（practiceTeam：solo／coop，預設合作） */
  formalGame:false, practiceTeam:"coop",
  /* 練習打怪獸：每做完幾題跳一次動畫（細部設定 → 練習與遊戲；預設 3 題，2026-10-22 維護者決定） */
  sceneEvery:"3",
  /* 血量模式（3-3b，只在練習）：開始前選幾點血量，0＝不用 */
  practiceHearts:0,
  /* 練習的選項加注音（3-4）：第 4 步可以改；正式評量的選項一律不加（會變成看注音找字） */
  practiceBpmf:false,
  /* 報讀提示：語詞、句子提示旁的小喇叭，按了念出完整語詞或句子。練習在第 4 步開關（預設開）；
     正式評量看「評量設定」（預設關，從基線期起維持同一個設定）；部件重組（4-1）一律沒有 */
  practiceRead:true},
  load(KEYS.settings, {}));
/* 以前存的「打怪獸要不要玩」（practiceGame）換成新的玩法設定 */
if(!settings.practicePlay) settings.practicePlay = settings.practiceGame === false ? "color" : "game";
if(settings.practicePlay === "monster") settings.practicePlay = "game";   /* 2026-10-24 以前叫「打怪獸」 */
delete settings.practiceGame;
const saveSettings = () => store(KEYS.settings, settings);

/* 學生名單：年級記的是設定那一年的年級，之後每學年自動升級 */
/* 第一次打開時先放兩個範例代號，老師可以在「學生名單」修改或刪除 */
const kids = load(KEYS.kids, [
  {code:"S01", name:"", grade:2, sy:SCHOOL_YEAR}, {code:"S02", name:"", grade:2, sy:SCHOOL_YEAR}
]);
const saveKids = () => store(KEYS.kids, kids);
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
const teach = load(KEYS.teach, {});
const saveTeach = () => store(KEYS.teach, teach);
/* 某位學生在某一課實際用的教學日期：有個別設定就用個別的，沒有就用全班預設 */
const teachFor = (k, code) => { const t = teach[k] || {}; return (code && t.kids && t.kids[code]) || t; };

const state = {
  theme:"",   /* 這次實際用的主題（""＝不用主題） */
  themePick:"",   /* 第 4 步學生點的主題：""＝還沒點、none＝不用主題、或主題代號；選好才能開始，再玩一次沿用 */
  /* 每位學生不同的提示（只在進階設定的練習）：學生代號 → {hints:Set, rule:[]}；沒有的學生用大家共用的 pHints、pRule */
  kidHints:{}, hintFor:"",
  goal:"3", kind:"formal", mode:"acc", limit:"60",
  pChoices:"6", pHints:new Set(["word","parts"]), pRule:["next","next","free"],   /* 練習提示預設（A3-6，2026-10-25 改）：錯 1 次語詞挖空、錯 2 次部件拆解、錯 3 次沒有提示也不顯示答案，讓學生自己點 */
  ed:"翰林", book:"h2", lessons:[], qCount:null, qMethod:"even", answer:"turn",
  prepost:"",   /* 這次是前測還是後測（只有正式評量；""＝不標）。沒有前後測代號、不做補考（2026-10-25） */
  kids:new Set()
};
let dBook = "h2";

const $ = s => document.querySelector(s);

/* =========================================================
   3. 教學日期與前後測（A8，2026-10-25）
   不再用教學日期自動判斷「基線期／教學中／教學後／維持期」；前測、後測由老師作答前按的按鈕決定。
   教學日期只用來算圖的橫軸和「教學後天數」。
   ========================================================= */

/* 教學後天數：有結束日、而且今天在結束日當天或之後才算（結束當天＝第 0 天）；其他情況是空白 */
function daysAfterEnd(k, code){
  const t = teachFor(k, code);
  if(t.type !== "dates" || !t.end || today < parse(t.end)) return "";
  return Math.round((today - parse(t.end)) / DAY);
}
const selKids = () => [...state.kids].filter(kidBy);

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
  /* 前測、後測的條件完全一樣（A8 第 13 點）。A3-6（2026-10-25）：正式評量的所有模式、所有目標都完全不提示、不回饋對錯，
     答錯就記錯、進下一題（部件重組也一樣，沒有例外） */
  const noHelp = flu || formal;
  return {
    formal, flu, noHelp,
    choices: formal || flu ? settings.choices : playNow() === "bingo" ? "bingo" : state.pChoices,
    hints: noHelp ? [] : fitHints(state.goal, HINT_ORDER.filter(h => state.pHints.has(h))),
    rule: noHelp ? null : state.pRule
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
