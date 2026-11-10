/* =========================================================
   識字評量：寫字組第 2 版「輸出考卷」（tools/literacy/exam.js，2026-11-10 E3／E10）
   規格（維護者 2026-11-10 決定，見 docs/design/literacy-design.md「寫字組」）：
   - A4 直式。第一排：單元、課別、班級、座號、姓名、日期（單元、課別先帶入所選的課本和課次，印之前可以直接改）。
   - 接著是考試方法（依題型預設一句，印之前可以改），再來是考題。
   - 每一題由左到右：題目 → 答案格 → 一條直的虛線（摺線，可以摺起來蓋住答案） → 訂正格 4 格（2026-11-10 維護者從 3 格改成 4 格）。
   - 考試方法下面有一段訂正方法：1. 看一看 2. 摺起來 3. 訂正（看過正確的字以後摺起來蓋住，自己寫出來，主動書寫才記得住）。
   - 格子三種大小：小 1.5、中 1.8（預設）、大 2.2 公分；格線預設十字格。
   - 「字型尺提示」可勾選：照這個字的結構（shared/parts-api.js 的 Parts.struct：左右、上下、包圍…）畫虛線分區，
     左右、上下、左中右、上中下的分線照字的比例（shared/ruler.js，2026-11-10 維護者要求；表裡沒有的字從正中間分），
     每一塊一種淡色底（第一塊淡藍、第二塊淡黃、第三塊淡綠，2026-10-21 E9 定的樣式）；訂正格的提示跟著答案格。
     沒有分區的字（獨體字、交疊）照樣用十字格。黑白印表機印不出底色，虛線還在。
   - 題目欄：W1 語詞，題目的空格就是答案格（右邊直排注音），同一個語詞的字合併成一題；W2 只有題號（老師唸題），
     老師選考國字（1 格）或語詞（格子照字數）；
     W3 拆開的部件。可以另印一張答案頁給老師（W2 唸題用）。
   - 不留成績、不存紀錄（同第 1 版）。題目和螢幕出題用同一套抽字（play.js 的 pickItems、setup.js 的 quizPlan）。
   用到 writing.js 的 wrZhuyinHtml、wrTarget、wrParts、WRITE_HOW；play.js 的 prepareThen、showScreen。
   ========================================================= */
const EXAM_SIZES = [["s", "小", 1.5], ["m", "中", 1.8], ["l", "大", 2.2]];   /* 格子邊長（公分） */
const EXAM_FIX = 4;   /* 訂正格幾格 */
/* 訂正方法：寫幾遍由老師在第 3 步填（2026-11-10 維護者要求）；沒填就印「寫 ___ 遍」，老師在紙上自己寫 */
const examTimes = () => examOpt.times ? `<b class="extimes">${esc(examOpt.times)}</b>` : `<span class="exblank"></span>`;
const EXAM_HOW_FIX = () => `<b>訂正方法</b><span><b>1. 看一看</b>：看清楚正確的字。</span><span><b>2. 摺起來</b>：沿著虛線往後摺，蓋住左邊的題目和答案。</span><span><b>3. 訂正</b>：不看答案自己寫 ${examTimes()} 遍。<mark class="exmark">主動寫出來，才能真正記住！</mark></span>`;   /* 最後一句黃色底（2026-11-10 維護者要求） */
const EXAM_METHOD = {
  W1: "看注音，在格子裡寫出國字。",
  W2: "聽老師唸，在格子裡寫出國字。",
  W3: "把部件組合起來，在格子裡寫出國字。"
};
const examOpt = {size: "m", ruler: false, w2: "char", key: null, times: ""};   /* 這次打開網頁時記得（不存起來）；key：null＝照預設（聽音寫字預設要印答案頁） */
const examKey = (g = state.goal) => examOpt.key ?? g === "W2";
let EX = null;   /* 這次的考卷：goal、items */

/* ---------- 第 3 步：考卷設定（writing.js 的 renderWriting 呼叫） ---------- */
function renderExamOpts(){
  const box = $("#wrExam");
  if(!box) return;
  const g = state.goal, ready = state.lessons.length && quizPlan().count > 0;
  box.innerHTML = `
    <p class="sub">或者印成考卷</p>
    <div class="group" role="group" aria-label="格子大小"><span>格子大小</span>${EXAM_SIZES.map(([id, name, cm]) => `<button class="chip ${examOpt.size === id ? "on" : ""}" data-exs="${id}" aria-pressed="${examOpt.size === id}">${name}（${cm} 公分）</button>`).join("")}</div>
    <label class="wrchk"><input type="checkbox" id="exRuler" ${examOpt.ruler ? "checked" : ""}> 字型尺提示（照字的結構畫虛線分區、加淡色底；不勾就是十字格）</label>
    ${g === "W2" ? `<div class="group" role="group" aria-label="學生寫什麼"><span>考</span>${[["char", "國字（1 格）"], ["word", "語詞（格子照語詞的字數）"]].map(([id, t]) => `<button class="chip ${examOpt.w2 === id ? "on" : ""}" data-exw="${id}" aria-pressed="${examOpt.w2 === id}">${t}</button>`).join("")}</div>
      <p class="note" style="margin:0 0 6px">聽音寫字的考卷只印題號，由老師唸題（考語詞時唸語詞，考國字時唸「蜜蜂的蜂」）。同一個語詞只考一次。</p>` : ""}
    <label class="wrchk">訂正寫 <input type="number" id="exTimes" min="1" max="20" inputmode="numeric" value="${esc(examOpt.times)}" placeholder="空白" style="width:5em"> 遍（不填就印「寫 ___ 遍」，老師在紙上自己寫）</label>
    <label class="wrchk"><input type="checkbox" id="exKey" ${examKey(g) ? "checked" : ""}> 另印一張答案頁（給老師${g === "W2" ? "唸題、" : ""}對答案）</label>
    <button class="go" id="exGo" ${ready ? "" : "disabled"}>產生考卷</button>`;
  box.querySelectorAll("[data-exs]").forEach(b => b.onclick = () => { examOpt.size = b.dataset.exs; renderExamOpts(); });
  $("#exRuler").onchange = e => { examOpt.ruler = e.target.checked; };
  box.querySelectorAll("[data-exw]").forEach(b => b.onclick = () => { examOpt.w2 = b.dataset.exw; renderExamOpts(); });
  $("#exKey").onchange = e => { examOpt.key = e.target.checked; };
  $("#exTimes").oninput = e => { const v = Math.round(+e.target.value); examOpt.times = v >= 1 && v <= 20 ? String(v) : ""; };
  $("#exGo").onclick = examStart;
}

/* ---------- 產生考卷 ---------- */
function examStart(){
  const q = quizPlan();
  const items = pickItems("", q).map(it => {
    const b = splitKey(it.k)[0], w = BOOKS[b].lessons[splitKey(it.k)[1]].sayChar ? "" : wordOf(it.c, b);
    return {...it, b, w, cs: [it.c]};
  });
  if(!items.length) return;
  EX = {goal: state.goal, items: examGroup(items, state.goal), picked: items.length};
  const kai = items.map(it => it.c + it.w + wrParts(it.c).join("")).join("") + "正確答案老師寫題號單元課別班級座號姓名日期答案訂正摺線看注音聽老師唸把部件組合起來在格子裡寫出國字一二三四五六七八九十";
  const ruby = items.map(it => it.w ? Bpmf.text(it.w) : "").join("");
  const only = EX.goal === "W1" ? items.map(wrTarget).join("") : "";   /* 要寫的字的注音（只有注音的字型） */
  prepareThen(() => { showScreen("#wexam"); examRender(); }, {TWKai: kai, BpmfKai: ruby, BpmfOnly: only});
}

/* 一個格子：十字格，或字型尺（結構虛線＋淡色底） */
const RULER_TINT = ["#eef5fc", "#fdf8e6", "#eef8f0"];   /* 淡藍、淡黃、淡綠（2026-11-10 維護者要求再淺一點；用很淡的不透明色，包圍字裡面那一塊才不會和外框疊成別的顏色） */
function rulerBlocks(c){
  /* 每一塊是 [left, top, width, height]（0～1，格子的比例）；線畫在塊和塊的交界 */
  const s = examOpt.ruler && typeof Parts !== "undefined" ? Parts.struct(c) : "";
  const inner = (l, t) => [[0, 0, 1, 1], [l, t, .62, .62]];   /* 包圍：外框一塊、裡面一塊 */
  /* 分線照字的比例（shared/ruler.js，從楷書字型量出來，2026-11-10 維護者要求）；表裡沒有的字從正中間分 */
  const cut = (n, def) => { const r = typeof RULER !== "undefined" && RULER[c]; return r && r.length === n ? r : def; };
  const cols = ([a, b]) => b === undefined ? [[0, 0, a, 1], [a, 0, 1 - a, 1]] : [[0, 0, a, 1], [a, 0, b - a, 1], [b, 0, 1 - b, 1]];
  const rows = ([a, b]) => b === undefined ? [[0, 0, 1, a], [0, a, 1, 1 - a]] : [[0, 0, 1, a], [0, a, 1, b - a], [0, b, 1, 1 - b]];
  return ({
    "左右": cols(cut(1, [.5])),
    "上下": rows(cut(1, [.5])),
    "左中右": cols(cut(2, [1 / 3, 2 / 3])),
    "上中下": rows(cut(2, [1 / 3, 2 / 3])),
    "全包圍": inner(.19, .19),
    "上方包圍": inner(.19, .38),
    "下方包圍": inner(.19, 0),
    "左方包圍": inner(.38, .19),
    "左上包圍": inner(.38, .38),
    "左下包圍": inner(.38, 0),
    "右上包圍": inner(0, .38)
  })[s] || null;
}
function cellHtml(c){
  const blocks = rulerBlocks(c);
  if(!blocks) return `<span class="excell cross"></span>`;
  const pct = x => (x * 100).toFixed(2) + "%";
  return `<span class="excell ruler">${blocks.map(([l, t, w, h], i) => `<i style="left:${pct(l)};top:${pct(t)};width:${pct(w)};height:${pct(h)};background:${RULER_TINT[i]}"></i>`).join("")}</span>`;
}

/* 同一個語詞的字合併成一題（2026-11-10 維護者決定）：
   W1 看注音寫國字：「雨天的雨」「雨天的天」分開出，一題的題目會露出另一題的答案，所以同一個語詞裡這次要考的字放在同一題，一題有好幾個空格；
   W2 聽寫考語詞：同一個語詞只考一次，格子數照語詞的字數。W2 考國字、W3 看部件不合併。 */
function examGroup(items, goal){
  const word = goal === "W2" && examOpt.w2 === "word";
  if(goal !== "W1" && !word) return items;
  const out = [], byWord = new Map();
  for(const it of items){
    const key = it.w && it.w.includes(it.c) ? it.b + "|" + it.w : "";
    if(word){
      if(key && byWord.has(key)) continue;
      const g = {...it, cs: it.w ? [...it.w] : [it.c]}; out.push(g); if(key) byWord.set(key, g); continue;
    }
    if(key && byWord.has(key)){ const g = byWord.get(key); if(!g.cs.includes(it.c)) g.cs.push(it.c); continue; }
    const g = {...it, cs: [it.c]}; out.push(g); if(key) byWord.set(key, g);
  }
  /* 合併的題目：空格照語詞裡的順序 */
  for(const g of out) if(g.w && g.cs.length > 1 && !word) g.cs.sort((x, y) => g.w.indexOf(x) - g.w.indexOf(y));
  return out;
}

/* W1：題目裡的空格就是答案格（2026-11-10 維護者決定）：格子照選的大小、有十字格或字型尺，右邊是直排注音；其他字照常加注音 */
function examAskW1(it){
  const hole = ch => `<span class="exhole">${cellHtml(ch[0])}<span class="zyonly">${esc(ch)}</span></span>`;
  if(!it.w) return hole(wrTarget(it));
  return [...Bpmf.text(it.w).matchAll(/(.)([\u{E01E0}-\u{E01EF}]?)/gu)].map(([, ch, vs]) => it.cs.includes(ch) ? hole(ch + vs) : `<span class="bpmf">${esc(ch + vs)}</span>`).join("");
}
function examAsk(it){
  if(EX.goal === "W1") return `<span class="exq exw1">${examAskW1(it)}</span>`;
  if(EX.goal === "W3") return `<span class="pieces exq">${wrParts(it.c).map(p => `<span class="ptile">${esc(p)}</span>`).join("")}</span>`;
  return "";   /* 聽音寫字只印題號（2026-11-10 維護者決定） */
}
const w2Word = () => EX.goal === "W2" && examOpt.w2 === "word";

function examRender(){
  const [b0] = splitKey(state.lessons[0]), manyBooks = new Set(state.lessons.map(k => splitKey(k)[0])).size > 1;
  const unit = manyBooks ? [...new Set(state.lessons.map(k => bookName(splitKey(k)[0])))].join("、") : bookName(b0);
  const lessons = state.lessons.map(k => { const [b, n] = splitKey(k); return manyBooks ? `${bookName(b)} ${lessonName(b, n)}` : lessonName(b, n); }).join("、");
  const cm = EXAM_SIZES.find(s => s[0] === examOpt.size)[2];
  const head = first => `<table class="exhead"><tr>
      <th>單元</th><td contenteditable="true">${esc(unit)}</td><th>課別</th><td contenteditable="true">${esc(lessons)}</td>
      <th>班級</th><td class="blank"></td><th>座號</th><td class="blank s"></td><th>姓名</th><td class="blank"></td><th>日期</th><td class="blank"></td></tr></table>
    ${first ? `<p class="exmethod" contenteditable="true">${esc(EXAM_METHOD[EX.goal])}</p><p class="exhowfix" contenteditable="true">${EXAM_HOW_FIX()}</p>` : ""}`;
  const g = EX.goal, mm = cm * 10, P = $("#exPages");
  /* 每一題由左到右（2026-11-10 維護者決定）：
     W1：題號 → 題目（空格就是答案格）→ 摺線 → 訂正
     W2：題號 → 答案（國字 1 格；語詞照字數）→ 摺線 → 訂正
     （原本有「正確答案（老師寫）」的格子，2026-11-10 維護者決定拿掉，留給訂正格更多位置）
     W3：題號 → 題目（部件）→ 答案 → 摺線 → 訂正
     摺線每一列都要對齊才摺得起來，所以欄寬照最寬的那一題；訂正格一般 4 格，放不下就整份一起少一兩格（至少 1 格） */
  /* 每一題要寫的格子：W1 是語詞裡每一個空格（「冷冷」兩格），W2 考語詞是每一個字，其他 1 格 */
  for(const it of EX.items) it.slots = g === "W1" && it.w ? [...it.w].filter(ch => it.cs.includes(ch)) : it.cs;
  const maxN = Math.max(...EX.items.map(it => it.slots.length));
  /* W2 答案欄：放得下 4 格訂正就排成一行，放不下（大格）才排成兩行 */
  const colN = Math.max(1, Math.min(maxN, Math.floor((186 - 7 - 9 - 9 - (EXAM_FIX * mm + (EXAM_FIX - 1) * 2) + 2) / (mm + 2)))), tw = colN * mm + (colN - 1) * 2;   /* W2 答案欄的寬度 */
  const cells = cs => cs.map(cellHtml).join("");
  const fixCells = (it, n) => Array.from({length: n}, (_, i) => cellHtml(it.cs[i % it.cs.length])).join("");
  const row = (it, no, fixN) => g === "W2" ? `<div class="exrow w2">
      <span class="exn">${no}</span><span class="exans">${cells(it.slots)}</span>
      <span class="exfold" aria-hidden="true"></span><span class="exfix">${fixCells(it, fixN)}</span></div>`
    : g === "W1" ? `<div class="exrow w1">
      <span class="exn">${no}</span><span class="exask">${examAsk(it)}</span>
      <span class="exfold" aria-hidden="true"></span><span class="exfix">${fixCells(it, fixN)}</span></div>`
    : `<div class="exrow">
      <span class="exn">${no}</span><span class="exask">${examAsk(it)}</span><span class="exans">${cellHtml(it.c)}</span>
      <span class="exfold" aria-hidden="true"></span><span class="exfix">${fixCells(it, fixN)}</span></div>`;
  const fixHead = `<span class="exfix">訂正（看一看、摺起來，再訂正）</span>`;   /* 2026-11-10 維護者要求的寫法 */
  const colHead = g === "W2" ? `<div class="exrow w2 exlabels"><span class="exn"></span><span class="exans">答案</span><span class="exfold">摺線</span>${fixHead}</div>`
    : g === "W1" ? `<div class="exrow w1 exlabels"><span class="exn"></span><span class="exask">題目（寫在格子裡）</span><span class="exfold">摺線</span>${fixHead}</div>`
    : `<div class="exrow exlabels"><span class="exn"></span><span class="exask">題目</span><span class="exans">答案</span><span class="exfold">摺線</span>${fixHead}</div>`;
  /* 分頁照實際高度（2026-11-10）：先把全部題目排在一張量每一題多高，再一頁一頁放滿；空格多、題目換行的題目比較高 */
  const keyHtml = () => !examKey(g) ? "" : `<section class="exsheet exkey"><h2>答案（給老師）</h2><table class="exkeytab"><tr><th>題號</th><th>題目</th><th>答案</th></tr>
      ${EX.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(g === "W2" && examOpt.w2 === "word" ? it.w || it.c : it.w ? `${it.w}的${it.cs.join("、")}` : it.c)}</td><td class="a">${esc(g === "W2" && examOpt.w2 === "word" ? it.cs.join("") : it.cs.join("、"))}</td></tr>`).join("")}</table></section>`;
  const pagesHtml = fixN => {
    const rows = EX.items.map((it, i) => row(it, i + 1, fixN));
    P.innerHTML = `<section class="exsheet exmeasure">${head(true)}${colHead}${rows.join("")}</section><section class="exsheet exmeasure">${head(false)}${colHead}</section>`;
    const [s1, s2] = P.querySelectorAll(".exsheet"), cs1 = getComputedStyle(s1);
    const inner = s1.getBoundingClientRect().width / 210 * 297 - parseFloat(cs1.paddingTop) - parseFloat(cs1.paddingBottom) - 4;   /* A4 一頁能放的高度（留一點餘裕） */
    const rh = [...s1.querySelectorAll(".exrow:not(.exlabels)")].map(r => r.getBoundingClientRect().height);
    const top = sh => [...sh.children].filter(e => !e.matches(".exrow:not(.exlabels)")).reduce((h, e) => h + e.getBoundingClientRect().height + parseFloat(getComputedStyle(e).marginTop) + parseFloat(getComputedStyle(e).marginBottom), 0);
    const pages = []; let cur = [], h = top(s1);
    rows.forEach((r, i) => { if(cur.length && h + rh[i] > inner){ pages.push(cur); cur = []; h = top(s2); } cur.push(r); h += rh[i]; });
    if(cur.length) pages.push(cur);
    EX.pageN = pages.length;
    return pages.map((list, p) => `<section class="exsheet">${head(p === 0)}${colHead}${list.join("")}</section>`).join("") + keyHtml();
  };
  P.style.setProperty("--cell", cm + "cm");
  /* 先排一次量出題目最寬的那一題（W1），再決定訂正格幾格 */
  const fixFit = qw => Math.max(1, Math.min(EXAM_FIX, Math.floor((186 - 7 - 9 - 9 - qw + 2) / (mm + 2))));
  let fixN = EXAM_FIX, qw = 0;
  if(g === "W2"){ P.style.setProperty("--aw", tw + "mm"); fixN = Math.max(1, Math.min(EXAM_FIX, Math.floor((186 - 7 - 9 - 9 - tw + 2) / (mm + 2)))); }
  if(g === "W1"){
    P.style.setProperty("--qw", "max-content"); P.style.setProperty("--fixn", 1);
    P.innerHTML = `<section class="exsheet">${EX.items.map((it, i) => row(it, i + 1, 1)).join("")}</section>`;
    const px = Math.max(...[...P.querySelectorAll(".exrow.w1:not(.exlabels) .exq")].map(e => e.getBoundingClientRect().width));
    const pxPerMm = P.querySelector(".exsheet").getBoundingClientRect().width / 210;
    qw = Math.ceil(px / pxPerMm) + 2;
    fixN = Math.min(EXAM_FIX, Math.max(3, fixFit(qw)));   /* 至少留 3 格訂正，題目太長就換行 */
    qw = Math.min(qw, 186 - 7 - 9 - 9 - (fixN * mm + (fixN - 1) * 2));
    P.style.setProperty("--qw", qw + "mm");
  }
  P.style.setProperty("--fixn", fixN);
  P.innerHTML = pagesHtml(fixN);
  const merged = EX.picked - EX.items.length;
  $("#exInfo").textContent = `${EX.items.length} 題，${EX.pageN} 頁${examKey(g) ? "＋答案 1 頁" : ""}；格子 ${cm} 公分${examOpt.ruler ? "，字型尺提示" : "，十字格"}${g === "W2" ? `，考${examOpt.w2 === "word" ? "語詞" : "國字"}` : ""}${merged > 0 ? `；同一個語詞的字合併成一題（${EX.picked} 個字）` : ""}${fixN < EXAM_FIX ? `；一列放不下，訂正格 ${fixN} 格` : ""}。單元、課別、考試方法可以直接點文字修改。`;
}
$("#exPrint").onclick = () => window.print();
$("#exBack").onclick = () => { EX = null; showScreen("#setup"); render(); };
$("#exAgain").onclick = () => { if(EX) examStart(); };   /* 重新抽題、重新排順序 */
