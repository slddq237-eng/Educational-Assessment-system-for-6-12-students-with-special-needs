/* =========================================================
   識字評量：寫字組第 2 版「輸出考卷」（tools/literacy/exam.js，2026-11-10 E3／E10）
   規格（維護者 2026-11-10 決定，見 docs/design/writing-design.md）：
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
const EXAM_HOW_FIX = () => `<b class="exhowtitle">訂正方法</b><span><b>1. 看一看</b>：看正確的字。</span><span><b>2. 摺起來</b>：沿著虛線摺，蓋住題目和答案。</span><span><b>3. 訂正</b>：不看答案自己寫 ${examTimes()} 遍。</span>`;
const EXAM_METHOD = {
  W1: "看注音，在格子裡寫出國字。",
  W2: "聽老師唸，在格子裡寫出國字。",
  W3: "把部件組合起來，在格子裡寫出國字。"
};
const examOpt = {size: "m", ruler: false, vers: [{size: "m", ruler: false}], w2: "char", key: null, times: ""};   /* vers：要印的版本（格子大小＋有沒有字型尺），可以好幾個；size、ruler 是排版時「這一個版本」用的 */   /* 這次打開網頁時記得（不存起來）；key：null＝照預設（聽音寫字預設要印答案頁） */
const examKey = (g = state.goal) => examOpt.key ?? g === "W2";
let EX = null;   /* 這次的考卷：goal、items */

/* ---------- 第 3 步：考卷設定（writing.js 的 renderWriting 呼叫） ---------- */
function renderExamOpts(){
  const box = $("#wrExam");
  if(!box) return;
  const g = state.goal, ready = state.lessons.length && quizPlan().count > 0;
  box.innerHTML = `
    <p class="sub">或者印成考卷</p>
    <p class="note" style="margin:0 0 4px">格子大小和字型尺可以勾好幾種，一次印出好幾個版本（題目和順序都一樣），給不同程度的學生（2026-11-10 維護者要求）。</p>
    <table class="exvers"><tr><th>格子</th><th>十字格</th><th>字型尺提示</th></tr>
      ${EXAM_SIZES.map(([id, name, cm]) => `<tr><td>${name}（${cm} 公分）</td>${[false, true].map(r => `<td><input type="checkbox" data-exv="${id}|${r ? 1 : 0}" aria-label="${name}格${r ? "字型尺提示" : "十字格"}" ${examOpt.vers.some(v => v.size === id && v.ruler === r) ? "checked" : ""}></td>`).join("")}</tr>`).join("")}
    </table>
    <p class="note" style="margin:2px 0 8px">字型尺提示：照字的結構畫虛線分區、加淡色底。</p>
    ${g === "W2" ? `<div class="group" role="group" aria-label="學生寫什麼"><span>考</span>${[["char", "國字（1 格）"], ["word", "語詞（格子照語詞的字數）"]].map(([id, t]) => `<button class="chip ${examOpt.w2 === id ? "on" : ""}" data-exw="${id}" aria-pressed="${examOpt.w2 === id}">${t}</button>`).join("")}</div>
      <p class="note" style="margin:0 0 6px">聽音寫字的考卷只印題號，由老師唸題（考語詞時唸語詞，考國字時唸「蜜蜂的蜂」）。同一個語詞只考一次。</p>` : ""}
    <label class="wrchk">訂正寫 <input type="number" id="exTimes" min="1" max="20" inputmode="numeric" value="${esc(examOpt.times)}" placeholder="空白" style="width:5em"> 遍（不填就印「寫 ___ 遍」，老師在紙上自己寫）</label>
    <label class="wrchk"><input type="checkbox" id="exKey" ${examKey(g) ? "checked" : ""}> 另印一張答案頁（給老師${g === "W2" ? "唸題、" : ""}對答案）</label>
    <button class="go" id="exGo" ${ready && examOpt.vers.length ? "" : "disabled"}>產生考卷</button>`;
  box.querySelectorAll("[data-exv]").forEach(c => c.onchange = () => {
    const [size, r] = c.dataset.exv.split("|"), ruler = r === "1";
    examOpt.vers = examOpt.vers.filter(v => !(v.size === size && v.ruler === ruler));
    if(c.checked) examOpt.vers.push({size, ruler});
    examOpt.vers.sort((a, b) => EXAM_SIZES.findIndex(x => x[0] === a.size) - EXAM_SIZES.findIndex(x => x[0] === b.size) || a.ruler - b.ruler);
    $("#exGo").disabled = !examOpt.vers.length || !state.lessons.length;
  });
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
    return {...it, b, w, w0: w, vs: {}, cs: [it.c]};   /* w0：課本的語詞；w：這次考卷用的語詞（老師可以換）；vs：老師點選的讀音 */
  });
  if(!items.length) return;
  EX = {goal: state.goal, raw: items};
  examBuild();
  const kai = items.map(it => it.c + it.w + wrParts(it.c).join("")).join("") + "正確答案老師寫題號單元課別班級座號姓名日期答案訂正摺線看注音聽老師唸把部件組合起來在格子裡寫出國字一二三四五六七八九十";
  const ruby = items.map(it => it.w ? Bpmf.text(it.w) : "").join("");
  const only = EX.goal === "W1" ? items.map(wrTarget).join("") : "";   /* 要寫的字的注音（只有注音的字型） */
  prepareThen(() => { showScreen("#wexam"); $("#exAdj").open = false; examRender(); examAdjRender(); }, {TWKai: kai, BpmfKai: ruby, BpmfOnly: only});
}

/* ---------- 太長的語詞不出題、調整題目（2026-11-10 維護者決定） ----------
   5 個字以上的語詞（例如「放之四海而皆準」）排不進一行，看注音寫國字、聽寫考語詞時這個字先不出題，預覽上方提醒老師；
   老師可以在「調整題目」換成課本裡其他有這個字的語詞，或自己輸入（4 個字以內）。只用在這一份考卷，不存起來。
   自己輸入的語詞，系統判斷不了破音字的讀音，看注音寫國字要讓老師點選（shared/bpmf-read.js）。 */
const EXAM_LONG = 5;
const hanLen = w => [...(w || "")].filter(ch => /\p{Script=Han}/u.test(ch)).length;
const examLongOut = () => EX.goal === "W1" || (EX.goal === "W2" && examOpt.w2 === "word");
function examBuild(){
  EX.excluded = examLongOut() ? EX.raw.filter(it => hanLen(it.w) >= EXAM_LONG) : [];
  EX.items = examGroup(EX.raw.filter(it => !EX.excluded.includes(it)).map(it => ({...it, cs: [it.c]})), EX.goal);
  EX.picked = EX.raw.length - EX.excluded.length;
}
let examWords = null;   /* 課本裡所有的語詞（找替換的語詞用） */
function examCands(it){
  if(!examWords) examWords = [...new Set([...Object.values(WORDS), ...(typeof WORDS_ED !== "undefined" ? Object.values(WORDS_ED).flatMap(m => Object.values(m)) : [])])];
  return [...new Set([it.w0, ...examWords.filter(w => w.includes(it.c) && hanLen(w) < EXAM_LONG)])].filter(Boolean);
}
/* 語詞裡的字有沒有注音字型（自己輸入的字可能不在網站的注音字型裡，就不會有注音） */
const hasBpmf = ch => document.fonts && [...document.fonts].some(f => f.family.replace(/["']/g, "") === "BpmfKai" && rangeHits(f.unicodeRange, new Set([ch.codePointAt(0)])));
function examAdjRender(){
  const box = $("#exAdjBody"), sum = $("#exAdj summary");
  if(!box || !EX) return;
  const g = EX.goal, showRead = g === "W1";
  const long = EX.excluded.map(it => `${it.c}（${it.w}）`).join("、");
  $("#exLong").hidden = !long;
  $("#exLong").innerHTML = long ? `⚠️ 這些字的語詞太長（${EXAM_LONG} 個字以上），排不進一行，<b>這次沒有出題</b>：${esc(long)}。可以打開下面的「調整題目」換一個語詞。` : "";
  sum.textContent = `調整題目（換語詞或自己輸入，只用在這一份考卷）${EX.excluded.length ? `：${EX.excluded.length} 個字沒有出題` : ""}`;
  box.innerHTML = `<table class="exadjtab"><tr><th>字</th><th>語詞</th>${showRead ? "<th>讀音（自己輸入的語詞，破音字請點選）</th>" : ""}<th></th></tr>
    ${EX.raw.map((it, i) => {
      const cands = examCands(it), custom = !cands.includes(it.w);
      const polys = showRead && custom && it.w ? [...new Set([...it.w])]   /* 只有自己輸入的語詞要點選讀音（課本語詞的讀音系統判斷好了） */.filter(ch => typeof BPMF_READ !== "undefined" && BPMF_READ[ch]) : [];
      const reads = polys.map(ch => { const rs = BPMF_READ[ch].split("|"), m = Bpmf.text(it.w).match(new RegExp(ch + "([\\u{E01E0}-\\u{E01EF}])?", "u")), cur = ch in it.vs ? it.vs[ch] : m && m[1] ? m[1].codePointAt(0) - 0xE01E0 : 0;
        return `<span class="exread"><b>${esc(ch)}</b>${rs.map((r, n) => `<button class="chip ${n === cur ? "on" : ""}" data-i="${i}" data-ch="${esc(ch)}" data-n="${n}">${esc(r)}</button>`).join("")}</span>`; }).join("");
      const noFont = showRead && it.w ? [...it.w].filter(ch => /\p{Script=Han}/u.test(ch) && ch !== it.c && !hasBpmf(ch)) : [];
      const out = EX.excluded.includes(it);
      return `<tr class="${out ? "out" : ""}"><td class="c">${esc(it.c)}<small>${esc(lessonName(...splitKey(it.k)))}</small></td>
        <td><select data-i="${i}">${cands.map(w => `<option ${w === it.w ? "selected" : ""} value="${esc(w)}">${esc(w)}${w === it.w0 ? "（課本）" : ""}${hanLen(w) >= EXAM_LONG ? "（太長，不出題）" : ""}</option>`).join("")}<option value="" ${custom ? "selected" : ""}>自己輸入…</option></select>
          ${custom ? `<input type="text" data-i="${i}" value="${esc(it.w)}" maxlength="8" placeholder="輸入有「${esc(it.c)}」的語詞" style="width:9em">` : ""}
          ${noFont.length ? `<small class="warn">「${esc(noFont.join(""))}」不在注音字型裡，沒有注音</small>` : ""}</td>
        ${showRead ? `<td>${reads || (it.w ? "—" : "")}</td>` : ""}
        <td>${out ? `<small class="warn">沒有出題</small>` : ""}</td></tr>`;
    }).join("")}</table>
    <p class="note" id="exAdjMsg" style="margin:6px 0 0"></p>`;
  const apply = (it, w) => {
    if(w && !w.includes(it.c)) return $("#exAdjMsg").textContent = `語詞裡要有「${it.c}」。`;
    if(hanLen(w) >= EXAM_LONG) return $("#exAdjMsg").textContent = `語詞要 ${EXAM_LONG - 1} 個字以內，才排得進一行。`;
    it.w = w; it.vs = {}; examBuild();
    const texts = {TWKai: w, BpmfKai: w ? Bpmf.text(w) : "", BpmfOnly: g === "W1" ? wrTarget(it) : ""};
    loadFonts(fontsToLoad(texts), () => {}, 4000).then(() => { examRender(); examAdjRender(); });
  };
  box.querySelectorAll("select[data-i]").forEach(s => s.onchange = () => { const it = EX.raw[+s.dataset.i]; if(s.value) apply(it, s.value); else { it.w = ""; it.vs = {}; examAdjRender(); } });
  box.querySelectorAll("input[data-i]").forEach(inp => inp.onchange = () => apply(EX.raw[+inp.dataset.i], inp.value.trim()));
  box.querySelectorAll("button[data-ch]").forEach(bt => bt.onclick = () => { const it = EX.raw[+bt.dataset.i]; it.vs[bt.dataset.ch] = +bt.dataset.n; examBuild(); examRender(); examAdjRender(); });
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
  /* 淡色底不畫框；分線只畫在格子裡面（每條畫一次），外框和十字格一樣是黑色實線（2026-11-10 修正：原本每塊都有虛線框，貼在外框內側，外框看起來像不見了） */
  const lines = new Map(), e = 1e-6;
  for(const [l, t, w, h] of blocks){
    if(l > e) lines.set(`v${l.toFixed(3)}${t}`, `<b class="ln v" style="left:${pct(l)};top:${pct(t)};height:${pct(h)}"></b>`);
    if(l + w < 1 - e) lines.set(`v${(l + w).toFixed(3)}${t}`, `<b class="ln v" style="left:${pct(l + w)};top:${pct(t)};height:${pct(h)}"></b>`);
    if(t > e) lines.set(`h${t.toFixed(3)}${l}`, `<b class="ln h" style="top:${pct(t)};left:${pct(l)};width:${pct(w)}"></b>`);
    if(t + h < 1 - e) lines.set(`h${(t + h).toFixed(3)}${l}`, `<b class="ln h" style="top:${pct(t + h)};left:${pct(l)};width:${pct(w)}"></b>`);
  }
  return `<span class="excell ruler">${blocks.map(([l, t, w, h], i) => `<i style="left:${pct(l)};top:${pct(t)};width:${pct(w)};height:${pct(h)};background:${RULER_TINT[i]}"></i>`).join("")}${[...lines.values()].join("")}</span>`;
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
      const g = {...it, cs: it.w ? [...it.w].filter(ch => /\p{Script=Han}/u.test(ch)) : [it.c]}; out.push(g); if(key) byWord.set(key, g); continue;   /* 「海倫‧凱勒」的「‧」不給格子 */
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
  const vsOf = (ch, vs) => it.vs && ch in it.vs ? wrVs(it.vs[ch]) : vs;   /* 老師點選的讀音優先 */
  return [...Bpmf.text(it.w).matchAll(/(.)([\u{E01E0}-\u{E01EF}]?)/gu)].map(([, ch, vs]) => it.cs.includes(ch) ? hole(ch + vsOf(ch, vs)) : `<span class="bpmf">${esc(ch + vsOf(ch, vs))}</span>`).join("");
}
function examAsk(it){
  if(EX.goal === "W1") return `<span class="exq exw1">${examAskW1(it)}</span>`;
  if(EX.goal === "W3") return `<span class="pieces exq">${wrParts(it.c).map(p => `<span class="ptile">${esc(p)}</span>`).join("")}</span>`;
  return "";   /* 聽音寫字只印題號（2026-11-10 維護者決定） */
}
const nb = t => t.replace(/ /g, "\u00a0");   /* 表頭太長要換行時，只在「、」後面換，「第 1 課」「康軒 五上」不拆開 */
const w2Word = () => EX.goal === "W2" && examOpt.w2 === "word";

function examRenderOne(){
  const [b0] = splitKey(state.lessons[0]), manyBooks = new Set(state.lessons.map(k => splitKey(k)[0])).size > 1;
  const unit = manyBooks ? [...new Set(state.lessons.map(k => bookName(splitKey(k)[0])))].join("、") : bookName(b0);
  /* 課別：連續的課寫成「第 1～3 課」（表頭一格寫得下，不要換行，2026-11-10 維護者要求） */
  const lessons = [...new Set(state.lessons.map(k => splitKey(k)[0]))].map(b => {
    const ns = state.lessons.filter(k => splitKey(k)[0] === b).map(k => splitKey(k)[1]).sort((x, y) => x - y), parts = [];
    for(let i = 0; i < ns.length; i++){
      let j = i; while(j + 1 < ns.length && +ns[j + 1] === +ns[j] + 1 && ns[j] !== "0") j++;
      parts.push(ns[i] === "0" ? lessonName(b, "0") : j > i ? `第 ${ns[i]}～${ns[j]} 課` : lessonName(b, ns[i])); i = j;
    }
    return (manyBooks ? bookName(b) + " " : "") + parts.join("、");
  }).join("、");
  const cm = EXAM_SIZES.find(s => s[0] === examOpt.size)[2];
  /* 表頭兩排（2026-11-10 維護者要求）：上排單元、課別、考試方法（題型名稱）、日期；下排班級、座號、姓名（姓名格比較寬） */
  const goalName = GOALS.find(x => x.id === EX.goal).name;
  const head = first => `<table class="exhead"><tr>
      <th>單元</th><td contenteditable="true">${esc(nb(unit))}</td><th>課別</th><td contenteditable="true">${esc(nb(lessons))}</td>
      <th>考試方法</th><td contenteditable="true">${esc(goalName)}</td><th>日期</th><td class="blank d"></td></tr></table>
    <table class="exhead exhead2"><tr><th>班級</th><td class="blank c"><span class="excls"><i></i>年<i></i>班</span></td><th>座號</th><td class="blank s"></td><th>姓名</th><td class="blank n"></td></tr></table>
    ${first ? `<p class="exmethod" contenteditable="true">${esc(EXAM_METHOD[EX.goal])}</p><p class="exhowfix" contenteditable="true">${EXAM_HOW_FIX()}</p>` : ""}`;
  const g = EX.goal, mm = cm * 10, P = $("#exPages");
  /* 大格改成 A4 橫印（2026-11-10 維護者決定）：一列寬 27.3 公分，一題有好幾個空格也放得下，空格不用縮小；小格、中格直印 */
  const land = examOpt.size === "l", pageW = land ? 297 : 210, pageH = land ? 210 : 297, sheetCls = land ? "exsheet land" : "exsheet";
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
  const colN = maxN, tw = colN * mm + (colN - 1) * 2;   /* W2 答案欄的寬度（照最長的語詞） */
  const cells = cs => cs.map(cellHtml).join("");
  /* 訂正區（2026-11-10 維護者決定）：每個要訂正的字都要有地方寫，一題考好幾個字時訂正區就好幾排
     W1 一題有好幾個字：每個字自己一排（「蜜蜜蜜蜜」「蜂蜂蜂蜂」）；同一個字出現兩次（「冷冷」）只要一排
     W2 考語詞：照語詞重複寫兩遍（「蜜蜂蜜蜂」）；一排放不下兩遍（3、4 個字的語詞）就兩排，每排一遍
     其他（一題一個字）：一排 n 格。訂正格數不看「寫 ___ 遍」（那只是說明文字） */
  const line = cs => `<span class="exfixln">${cs.map(cellHtml).join("")}</span>`;
  const fixCells = (it, n) => {
    if(g === "W2" && examOpt.w2 === "word" && it.cs.length > 1){
      const per = Math.max(1, Math.floor(n / it.cs.length)), reps = 2, lines = [];
      for(let r = 0; r < reps; r += per) lines.push(line(Array.from({length: Math.min(per, reps - r)}, () => it.cs).flat()));
      return lines.join("");
    }
    const chars = [...new Set(it.cs)];
    return chars.map(ch => line(Array.from({length: n}, () => ch))).join("");
  };
  const row = (it, no, fixN) => g === "W2" ? `<div class="exrow w2" style="--ans:${it.ansScale || 1}">
      <span class="exn">${no}</span><span class="exans">${cells(it.slots)}</span>
      <span class="exfold" aria-hidden="true"></span><span class="exfix">${fixCells(it, fixN)}</span></div>`
    : g === "W1" ? `<div class="exrow w1" style="--hint:${it.hint || 1};--hole:${it.hole || 1}">
      <span class="exn">${no}</span><span class="exask">${examAsk(it)}</span>
      <span class="exfold" aria-hidden="true"></span><span class="exfix">${fixCells(it, fixN)}</span></div>`
    : `<div class="exrow">
      <span class="exn">${no}</span><span class="exask">${examAsk(it)}</span><span class="exans">${cellHtml(it.c)}</span>
      <span class="exfold" aria-hidden="true"></span><span class="exfix">${fixCells(it, fixN)}</span></div>`;
  const fixHead = `<span class="exfix">訂正（看一看 → 摺起來 → 再訂正）</span>`;   /* 2026-11-10 維護者要求的寫法 */
  const colHead = g === "W2" ? `<div class="exrow w2 exlabels"><span class="exn"></span><span class="exans">答案</span><span class="exfold">摺線</span>${fixHead}</div>`
    : g === "W1" ? `<div class="exrow w1 exlabels"><span class="exn"></span><span class="exask">題目（寫在格子裡）</span><span class="exfold">摺線</span>${fixHead}</div>`
    : `<div class="exrow exlabels"><span class="exn"></span><span class="exask">題目</span><span class="exans">答案</span><span class="exfold">摺線</span>${fixHead}</div>`;
  /* 分頁照實際高度（2026-11-10）：先把全部題目排在一張量每一題多高，再一頁一頁放滿；空格多、題目換行的題目比較高 */
  /* 答案頁（給老師）：題目多時分成好幾頁（2026-11-10 發布前測試：原本只有一張，超過一頁的題目印不出來）；每頁都有表格標題 */
  const keyHtml = () => {
    if(!examKey(g)) return "";
    const trs = EX.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(g === "W2" && examOpt.w2 === "word" ? it.w || it.c : it.w ? `${it.w}的${it.cs.join("、")}` : it.c)}</td><td class="a">${esc(g === "W2" && examOpt.w2 === "word" ? it.cs.join("") : it.cs.join("、"))}</td></tr>`);
    const th = `<tr><th>題號</th><th>題目</th><th>答案</th></tr>`;
    const sheet = (list, p) => `<section class="exsheet exkey"><h2>答案（給老師）${p ? `<small>（第 ${p + 1} 頁）</small>` : ""}</h2><table class="exkeytab">${th}${list.join("")}</table></section>`;
    const m = document.createElement("div"); m.innerHTML = `<section class="exsheet exkey exmeasure">${sheet(trs, 0).replace(/^<section[^>]*>|<\/section>$/g, "")}</section>`;
    P.appendChild(m);
    const s1 = m.firstElementChild, cs1 = getComputedStyle(s1), k = s1.getBoundingClientRect().width / 210;
    const inner = 297 * k - parseFloat(cs1.paddingTop) - parseFloat(cs1.paddingBottom) - 4;
    const trEls = [...s1.querySelectorAll("tr")], head0 = trEls[0].getBoundingClientRect().top - s1.getBoundingClientRect().top - parseFloat(cs1.paddingTop) + trEls[0].getBoundingClientRect().height;
    const pages = []; let cur = [], h = head0;
    trs.forEach((t, i) => { const rh = trEls[i + 1].getBoundingClientRect().height; if(cur.length && h + rh > inner){ pages.push(cur); cur = []; h = head0; } cur.push(t); h += rh; });
    if(cur.length) pages.push(cur);
    m.remove();
    return pages.map(sheet).join("");
  };
  const pagesHtml = fixN => {
    const rows = EX.items.map((it, i) => row(it, i + 1, fixN));
    P.innerHTML = `<section class="${sheetCls} exmeasure">${head(true)}${colHead}${rows.join("")}</section><section class="${sheetCls} exmeasure">${head(false)}${colHead}</section>`;
    const [s1, s2] = P.querySelectorAll(".exsheet"), cs1 = getComputedStyle(s1);
    const inner = s1.getBoundingClientRect().width / pageW * pageH - parseFloat(cs1.paddingTop) - parseFloat(cs1.paddingBottom) - 4;   /* A4 一頁能放的高度（留一點餘裕） */
    const rh = [...s1.querySelectorAll(".exrow:not(.exlabels)")].map(r => r.getBoundingClientRect().height);
    const top = sh => [...sh.children].filter(e => !e.matches(".exrow:not(.exlabels)")).reduce((h, e) => h + e.getBoundingClientRect().height + parseFloat(getComputedStyle(e).marginTop) + parseFloat(getComputedStyle(e).marginBottom), 0);
    const pages = []; let cur = [], h = top(s1);
    rows.forEach((r, i) => { if(cur.length && h + rh[i] > inner){ pages.push(cur); cur = []; h = top(s2); } cur.push(r); h += rh[i]; });
    if(cur.length) pages.push(cur);
    EX.pageN = pages.length;
    const tag = examOpt.vers.length > 1 ? `<span class="exvtag">${esc(examVerName(examOpt))}</span>` : "";   /* 好幾個版本時，每一頁右上角標版本 */
    return pages.map((list, p) => `<section class="${sheetCls}">${tag}${head(p === 0)}${colHead}${list.join("")}</section>`).join("");
  };
  EX.keyHtml = keyHtml;
  P.style.setProperty("--cell", cm + "cm");
  /* 先排一次量出題目最寬的那一題（W1），再決定訂正格幾格 */
  /* 每一題都排成一行（2026-11-10 維護者要求，不要有字變成兩行）：
     W1：訂正格固定 4 格；題目太長時只縮小題目裡不用寫的字（和注音），空格不變；連空格都放不下的少數題目（例如大格的「烏雲密布」四個字都考）整題一起縮小。
     W2 考語詞：答案格照字數排一行，放不下就整份少幾格訂正（最少 2 格）；還放不下的語詞（例如「放之四海而皆準」）那一題的答案格縮小。
     W1 的提示字最多縮到原本的一半（再小小朋友看不清楚），還放不下就連空格一起縮。 */
  const room = pageW - 24 - 7 - 9 - 9 + 2;   /* 題目或答案欄＋訂正欄能用的寬度（mm；紙寬扣掉左右邊界 12mm、題號、摺線、間距） */
  const fixW = n => n * mm + (n - 1) * 2;
  let fixN = EXAM_FIX;
  const pxPerMm = () => P.querySelector(".exsheet").getBoundingClientRect().width / pageW;
  if(g === "W2"){
    fixN = Math.max(2, Math.min(EXAM_FIX, Math.floor((room - tw) / (mm + 2))));   /* 訂正格最少 2 格；更長的語詞那一題的答案格縮小 */
    const aw = Math.min(tw, room - fixW(fixN) - 2);
    for(const it of EX.items){ const w = it.slots.length * mm + (it.slots.length - 1) * 2; it.ansScale = w > aw ? aw / w : 1; }
    P.style.setProperty("--aw", aw + "mm");
  }
  if(g === "W1"){
    /* 空格永遠不縮小（2026-11-10 維護者決定）：題目太長時先縮小不用寫的字（最多到一半）；還放不下（中格的「吱吱喳喳」考兩個字、
       「烏雲密布」四個字都考）就這份考卷的訂正格少一格（3 格）；大格已經改成橫印，放得下。真的還放不下才把提示字再縮小一點 */
    P.style.setProperty("--qw", "max-content"); P.style.setProperty("--fixn", 1);
    for(const it of EX.items){ it.hint = 1; it.hole = 1; }
    const measure = () => {
      P.innerHTML = `<section class="${sheetCls}">${EX.items.map((it, i) => row(it, i + 1, 1)).join("")}</section>`;
      const k = pxPerMm();
      return [...P.querySelectorAll(".exrow.w1:not(.exlabels) .exq")].map(q => ({W: q.getBoundingClientRect().width / k, H: [...q.querySelectorAll(".exhole")].reduce((h, e) => h + e.getBoundingClientRect().width / k, 0)}));
    };
    const capFor = n => room - fixW(n) - 2;
    let m = measure(), cap = capFor(EXAM_FIX);
    if(m.some(({W, H}) => W > cap && (cap - H) / (W - H) < .5)){ fixN = EXAM_FIX - 1; cap = capFor(fixN); }   /* 提示字縮到一半還放不下：少一格訂正 */
    for(let pass = 0; pass < 3; pass++){
      let ok = true;
      m.forEach(({W, H}, i) => {
        if(W <= cap) return;
        ok = false;
        const it = EX.items[i], need = (cap - H) / (W - H);
        if(need > 0) it.hint *= Math.max(.35, need * .98);   /* 只縮提示字（一般最多到一半；極少數才到 0.35） */
        else it.hole *= cap / W * .98;   /* 連空格都放不下（照現在的課本不會發生）才縮空格 */
      });
      if(ok) break;
      m = measure();
    }
    const qw = Math.ceil(Math.max(...m.map(x => x.W))) + 1;
    P.style.setProperty("--qw", Math.min(qw, cap) + "mm");
  }
  P.style.setProperty("--fixn", fixN);
  const html = pagesHtml(fixN);
  const vars = ["--cell", "--aw", "--qw", "--fixn"].map(k => [k, P.style.getPropertyValue(k)]).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(";");
  ["--cell", "--aw", "--qw", "--fixn"].forEach(k => P.style.removeProperty(k));
  return {html, vars, pageN: EX.pageN, fixN, shrunk: EX.items.some(it => (it.hint || 1) < 1 || (it.hole || 1) < 1 || (it.ansScale || 1) < 1)};
}
const examVerName = v => `${EXAM_SIZES.find(s => s[0] === v.size)[1]}格（${EXAM_SIZES.find(s => s[0] === v.size)[2]} 公分${v.size === "l" ? "，橫印" : ""}）・${v.ruler ? "字型尺提示" : "十字格"}`;
/* 每一個版本各排一次（格子大小不同，訂正格數、縮小的題目也不同），依序接在一起，最後放一張答案頁 */
function examRender(){
  const g = EX.goal, P = $("#exPages"), done = [];
  for(const v of examOpt.vers){
    Object.assign(examOpt, v);
    done.push({v, ...examRenderOne()});
  }
  const key = EX.keyHtml(), keyN = (key.match(/class="exsheet exkey"/g) || []).length;
  P.innerHTML = done.map(d => `<div class="exver" style="${d.vars}">${d.html}</div>`).join("") + key;
  const merged = EX.picked - EX.items.length;
  const mixed = new Set(examOpt.vers.map(v => v.size === "l")).size > 1;
  $("#exInfo").textContent = `${mixed ? "⚠️ 有直印也有橫印（大格橫印）；印表機如果沒有自動轉向，請分開列印。" : ""}${EX.items.length} 題；${done.map(d => `${examVerName(d.v)} ${d.pageN} 頁${d.fixN < EXAM_FIX ? `（訂正格 ${d.fixN} 格）` : ""}`).join("、")}${keyN ? `，另有答案 ${keyN} 頁` : ""}${g === "W2" ? `；考${examOpt.w2 === "word" ? "語詞" : "國字"}` : ""}${merged > 0 ? `；同一個語詞的字合併成一題（${EX.picked} 個字）` : ""}${done.some(d => d.shrunk) ? "；比較長的題目字縮小了一點，才排得下一行" : ""}。單元、課別、考試方法可以直接點文字修改。`;
}
$("#exPrint").onclick = () => window.print();
$("#exBack").onclick = () => { EX = null; showScreen("#setup"); render(); };
$("#exAgain").onclick = () => { if(EX) examStart(); };   /* 重新抽題、重新排順序 */
