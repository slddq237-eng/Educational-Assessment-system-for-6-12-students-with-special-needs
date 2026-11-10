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
   - 題目欄：W1 語詞（要寫的字換成方格＋直排注音，同螢幕出題）；W2 只有題號（老師唸題），答案格旁邊多一樣多的格子給老師寫正確答案，
     老師選學生寫國字（各 1 格）或語詞（各 2 格）；
     W3 拆開的部件。可以另印一張答案頁給老師（W2 唸題用）。
   - 不留成績、不存紀錄（同第 1 版）。題目和螢幕出題用同一套抽字（play.js 的 pickItems、setup.js 的 quizPlan）。
   用到 writing.js 的 wrZhuyinHtml、wrTarget、wrParts、WRITE_HOW；play.js 的 prepareThen、showScreen。
   ========================================================= */
const EXAM_SIZES = [["s", "小", 1.5], ["m", "中", 1.8], ["l", "大", 2.2]];   /* 格子邊長（公分） */
const EXAM_ROWS = {s: 12, m: 10, l: 8};   /* 一頁幾題（A4 直式，扣掉表頭和考試方法） */
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
    ${g === "W2" ? `<div class="group" role="group" aria-label="學生寫什麼"><span>學生寫</span>${[["char", "國字（學生 1 格＋老師 1 格）"], ["word", "語詞（學生 2 格＋老師 2 格）"]].map(([id, t]) => `<button class="chip ${examOpt.w2 === id ? "on" : ""}" data-exw="${id}" aria-pressed="${examOpt.w2 === id}">${t}</button>`).join("")}</div>
      <p class="note" style="margin:0 0 6px">聽音寫字的考卷只印題號，由老師唸題；學生的答案旁邊有一樣多的格子，老師改完錯了可以幫學生寫正確答案。</p>` : ""}
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
    return {...it, b, w};
  });
  if(!items.length) return;
  EX = {goal: state.goal, items};
  const kai = items.map(it => it.c + it.w + wrParts(it.c).join("")).join("") + "單元課別班級座號姓名日期答案訂正摺線看注音聽老師唸把部件組合起來在格子裡寫出國字一二三四五六七八九十";
  const ruby = items.map(it => it.w ? Bpmf.text(it.w) : "").join("");
  const only = EX.goal === "W1" ? items.map(wrTarget).join("") : "";
  prepareThen(() => { showScreen("#wexam"); examRender(); }, {TWKai: kai, BpmfKai: ruby, BpmfOnly: only});
}

/* 一個格子：十字格，或字型尺（結構虛線＋淡色底） */
const RULER_TINT = ["#dcebfa", "#fbf1c7", "#dcf2df"];   /* 淡藍、淡黃、淡綠 */
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

function examAsk(it){
  if(EX.goal === "W1") return `<span class="wword zy exq">${wrZhuyinHtml(it)}</span>`;
  if(EX.goal === "W3") return `<span class="pieces exq">${wrParts(it.c).map(p => `<span class="ptile">${esc(p)}</span>`).join("")}</span>`;
  return "";   /* 聽音寫字只印題號（2026-11-10 維護者決定） */
}
/* 聽音寫字（2026-11-10 維護者決定）：題號 → 學生答案 → 正確答案（老師改完錯了幫學生寫）→ 摺線 → 訂正。
   老師選學生寫國字（各 1 格）或寫語詞（各 2 格；兩個字的語詞照每個字畫字型尺，其他語詞用十字格） */
const w2Word = () => EX.goal === "W2" && examOpt.w2 === "word";
const w2Chars = it => !w2Word() ? [it.c] : it.w && [...it.w].length === 2 ? [...it.w] : ["", ""];

function examRender(){
  const [b0] = splitKey(state.lessons[0]), manyBooks = new Set(state.lessons.map(k => splitKey(k)[0])).size > 1;
  const unit = manyBooks ? [...new Set(state.lessons.map(k => bookName(splitKey(k)[0])))].join("、") : bookName(b0);
  const lessons = state.lessons.map(k => { const [b, n] = splitKey(k); return manyBooks ? `${bookName(b)} ${lessonName(b, n)}` : lessonName(b, n); }).join("、");
  const per = EXAM_ROWS[examOpt.size], cm = EXAM_SIZES.find(s => s[0] === examOpt.size)[2];
  const pages = [];
  for(let i = 0; i < EX.items.length; i += per) pages.push(EX.items.slice(i, i + per));
  const head = first => `<table class="exhead"><tr>
      <th>單元</th><td contenteditable="true">${esc(unit)}</td><th>課別</th><td contenteditable="true">${esc(lessons)}</td>
      <th>班級</th><td class="blank"></td><th>座號</th><td class="blank s"></td><th>姓名</th><td class="blank"></td><th>日期</th><td class="blank"></td></tr></table>
    ${first ? `<p class="exmethod" contenteditable="true">${esc(EXAM_METHOD[EX.goal])}</p><p class="exhowfix" contenteditable="true">${EXAM_HOW_FIX()}</p>` : ""}`;
  const w2 = EX.goal === "W2", k = w2Word() ? 2 : 1;
  /* 訂正格：一般 4 格；聽音寫字寫語詞時一列比較寬，放不下就少幾格（A4 內容寬 186mm，扣掉題號、答案、摺線和間距） */
  const fixN = w2 ? Math.max(1, Math.min(EXAM_FIX, Math.floor((186 - 7 - 9 - 15 - 2 * (k * cm * 10 + (k - 1) * 2) + 2) / (cm * 10 + 2)))) : EXAM_FIX;
  const fix = it => { const cs = w2Chars(it); return Array.from({length: fixN}, (_, i) => cellHtml(cs[i % cs.length])).join(""); };
  const row = (it, n) => w2 ? `<div class="exrow w2">
      <span class="exn">${n}</span>
      <span class="exans">${w2Chars(it).map(cellHtml).join("")}</span>
      <span class="exans teach">${w2Chars(it).map(cellHtml).join("")}</span>
      <span class="exfold" aria-hidden="true"></span>
      <span class="exfix">${fix(it)}</span></div>` : `<div class="exrow">
      <span class="exn">${n}</span><span class="exask">${examAsk(it)}</span>
      <span class="exans">${cellHtml(it.c)}</span>
      <span class="exfold" aria-hidden="true"></span>
      <span class="exfix">${fix(it)}</span></div>`;
  const fixHead = `<span class="exfix">訂正（看一看 → 摺起來 → 寫 ${examTimes()} 遍）</span>`;
  const colHead = w2 ? `<div class="exrow w2 exlabels"><span class="exn"></span><span class="exans">答案</span><span class="exans teach">正確答案（老師寫）</span><span class="exfold">摺線</span>${fixHead}</div>`
    : `<div class="exrow exlabels"><span class="exn"></span><span class="exask">題目</span><span class="exans">答案</span><span class="exfold">摺線</span>${fixHead}</div>`;
  let n = 0;
  const sheets = pages.map((list, p) => `<section class="exsheet">${head(p === 0)}${colHead}${list.map(it => row(it, ++n)).join("")}</section>`);
  if(examKey(EX.goal)) sheets.push(`<section class="exsheet exkey"><h2>答案（給老師）</h2><table class="exkeytab"><tr><th>題號</th><th>題目</th><th>答案</th></tr>
      ${EX.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.w ? `${it.w}的${it.c}` : it.c)}</td><td class="a">${esc(w2Word() && it.w ? it.w : it.c)}</td></tr>`).join("")}</table></section>`);
  $("#exPages").style.setProperty("--cell", cm + "cm");
  $("#exPages").style.setProperty("--k", k); $("#exPages").style.setProperty("--fixn", fixN);
  $("#exPages").innerHTML = sheets.join("");
  $("#exInfo").textContent = `${EX.items.length} 題，${pages.length} 頁${examKey(EX.goal) ? "＋答案 1 頁" : ""}；格子 ${cm} 公分${examOpt.ruler ? "，字型尺提示" : "，十字格"}${w2 ? `，學生寫${k === 2 ? "語詞" : "國字"}` : ""}${fixN < EXAM_FIX ? `；一列放不下，訂正格改成 ${fixN} 格` : ""}。單元、課別、考試方法可以直接點文字修改。`;
}
$("#exPrint").onclick = () => window.print();
$("#exBack").onclick = () => { EX = null; showScreen("#setup"); render(); };
$("#exAgain").onclick = () => { if(EX) examStart(); };   /* 重新抽題、重新排順序 */
