/* =========================================================
   識字評量：寫字組第 1 版「螢幕出題」（tools/literacy/writing.js，2026-11-10 E3）
   規則（維護者 2026-11-07～10 決定，見 docs/plans/writing-discussion.md、docs/decisions/2026-11-07-writing-plan.md）：
   - 大螢幕一題一題出，學生寫在紙上，老師自己改；**不留成績、不存作答紀錄、不記出過哪些題目**，沒有主題和貼紙。
   - 設定只有 3 步：選目標（W1～W3）→ 選課次和題數（不選學生）→ 出題設定（這個檔案的 renderWriting）。
   - 老師按「下一題」換題（學生寫得快慢不同）；出完題出現答案頁，帶學生對答案。
   - W1 看注音寫國字：語詞裡要寫的字換成虛線方格，右邊直排注音（像國語考卷；注音用「字嗨注音而已」字型，2026-11-10 維護者決定），其他字照常加注音。
     W2 聽音寫字：唸「蜜蜂的蜂」，可以按「再唸一次」。W3 看部件寫字：顯示拆開的部件（和部件重組 R4 一樣，拆不開的字不出）。
   - 提示都是題目畫面上的按鈕，老師點了才出現（見下面 WRITE_HINT）；W2 一出題就唸，W1、W3 要按「唸題目」。
   用到 play.js 的 pickItems（抽字）、promptOf（唸的文字）、speak、regroupHtml（部件卡）、prepareThen（先下載字型）、showScreen；
   setup.js 的 quizPlan（題數、出題方式）。
   ========================================================= */
let W = null;   /* 這次出題的狀態：goal、items（每題的字、課次、語詞、部件卡）、pos（目前第幾題）、seen（出到第幾題）、answers（是不是在答案頁）、
                  這一題老師點開的提示：partN（顯示了幾個部件）、wordOn（W2 的語詞提示） */
/* 提示一律是題目畫面上的按鈕，老師點了才出現（2026-11-10 維護者決定，取代第 3 步的提示開關）：
   W1 看注音寫國字：唸題目（喇叭）、部件提示；W2 聽音寫字：一開始自動唸，另有語詞提示（挖空的語詞）、部件提示；W3 看部件寫字：唸題目（喇叭）。
   部件提示：點一下多顯示一個部件（照 partsOf 的順序），拆不開的字沒有這個按鈕。 */
const WRITE_HINT = {
  W1: "題目畫面上有「唸題目」「部件提示」按鈕，老師要用再點。",
  W2: "題目畫面上有「語詞提示」（要寫的字挖空，例如「蜜○」）「部件提示」按鈕，老師要用再點。",
  W3: "題目畫面上有「唸題目」按鈕，老師要用再點。"
};
const WRITE_HOW = {
  W1: "螢幕顯示語詞，要寫的字換成空白方格，旁邊直排注音（像國語考卷）；學生在紙上寫出國字。",
  W2: "電腦唸出「蜜蜂的蜂」，學生在紙上寫出國字；可以按「再唸一次」。",
  W3: "螢幕顯示拆開的部件，學生在紙上寫出組成的字（拆不開的字不出題）。"
};
/* 第 3 步「調整題目」拿掉的字（2026-11-10 維護者決定：預設所選的課全部出題，老師可以拿掉不考的字）：
   「課次|字」，螢幕出題和考卷都照這個；抽好題目後跟著「這份題目」存起來（下面 WS） */
const wrSkip = new Set();
let wrAdjOpen = false;
const wrAdjHtml = () => {
  const n = state.lessons.reduce((s, k) => s + wsPick(k).filter(c => !goalSkips(c) && wrSkip.has(k + "|" + c)).length, 0);
  return `<details class="wradj" id="wrAdj" ${wrAdjOpen ? "open" : ""}><summary>調整題目（拿掉不考的字${n ? `，已拿掉 ${n} 個` : ""}）</summary>
    <p class="note" style="margin:6px 0">點字可以拿掉（再點一次放回來）；螢幕出題和考卷都照這裡，抽好題目後跟著「這份題目」存起來。${n ? ` <button class="linkbtn" id="wrAdjAll">全部放回來</button>` : ""}</p>
    ${state.lessons.map(k => `<div class="wradjl"><b>${esc(lessonName(...splitKey(k)))}</b>${wsPick(k).filter(c => !goalSkips(c)).map(c => { const off = wrSkip.has(k + "|" + c);
      return `<button class="wrc ${off ? "off" : ""}" data-k="${esc(k)}" data-c="${esc(c)}" aria-pressed="${!off}" title="${off ? "不考（點一下放回來）" : "要考（點一下拿掉）"}">${esc(c)}</button>`; }).join("")}</div>`).join("")}</details>`;
};
/* ---------- 這份題目（2026-11-10 維護者決定，取代 2026-11-07「不記出過哪些題目」，見 docs/decisions/2026-11-10-writing-saved-sets.md）----------
   抽好的題目（哪些字、順序、語詞、老師換的語詞和讀音、拿掉的字）＋考卷設定存在這台電腦，大螢幕出題和考卷都用同一份，隔天打開可以接著用。
   不存學生寫得對不對（寫字還是不留成績）。只留最近 WR_MAX 份，跟著備份檔走（records.js 的 addBackupPart）。
   一份：{id, at（抽題時間）, used（最後用的時間）, goal, lessons, skip（拿掉的字）, qCount, items:[{c, k, b, w, w0, vs, drop}], exam（考卷設定）} */
const WR_MAX = 10;
let WS = null;   /* 現在這份題目；第 3 步的目標、課次、拿掉的字、題數換了就不算（下次開始時重新抽） */
const wrSets = () => { const v = load(KEYS.writingSets, []); return Array.isArray(v) ? v.filter(s => s && Array.isArray(s.items)) : []; };
const wrSig = () => JSON.stringify([state.goal, [...state.lessons].sort(), [...wrSkip].sort(), state.qCount]);
const setSig = s => JSON.stringify([s.goal, [...s.lessons].sort(), [...(s.skip || [])].sort(), s.qCount ?? null]);
const wrCur = () => WS && setSig(WS) === wrSig() ? WS : null;
function wrSave(){
  if(!WS) return;
  WS.used = new Date().toISOString();
  if(typeof EX !== "undefined" && EX && EX.raw === WS.items) WS.exam = {vers: examOpt.vers.map(v => ({...v})), w2: examOpt.w2, key: examOpt.key, times: examOpt.times};
  store(KEYS.writingSets, [WS, ...wrSets().filter(s => s.id !== WS.id)].slice(0, WR_MAX));
}
function wrDraw(){
  const items = pickItems("", quizPlan()).map(it => {
    const b = splitKey(it.k)[0], w = BOOKS[b].lessons[splitKey(it.k)[1]].sayChar ? "" : wordOf(it.c, b);
    return {c: it.c, k: it.k, b, w, w0: w, vs: {}};   /* w0：課本的語詞；w：這份題目用的語詞（老師可以在考卷的「調整題目」換）；vs：老師點選的讀音 */
  });
  if(!items.length) return null;
  WS = {id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(), goal: state.goal, lessons: [...state.lessons], skip: [...wrSkip], qCount: state.qCount, items};
  wrSave();
  return WS;
}
const wrEnsure = () => wrCur() || wrDraw();
const wrSetName = s => `${goalName(s.goal)}・${bookName(splitKey(s.lessons[0])[0])} ${s.lessons.map(k => lessonName(...splitKey(k))).join("、")}`;
const wrWhen = iso => { const d = new Date(iso); return isNaN(d) ? "" : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
/* 打開存過的題目：目標、課次、拿掉的字、題數、考卷設定都換回那一份 */
function wrOpen(id){
  const s = wrSets().find(x => x.id === id);
  if(!s || !s.lessons.every(k => { const [b, n] = splitKey(k); return BOOKS[b] && BOOKS[b].lessons[n]; })) return flowNote("這份題目的課次在這個版本的網頁找不到，沒辦法打開。");
  Object.assign(state, {goal: s.goal, lessons: [...s.lessons], qCount: s.qCount ?? null, book: splitKey(s.lessons[0])[0]});
  state.ed = BOOKS[state.book].edition;
  wrSkip.clear(); (s.skip || []).forEach(x => wrSkip.add(x));
  if(s.exam && typeof examOpt !== "undefined") Object.assign(examOpt, {vers: s.exam.vers && s.exam.vers.length ? s.exam.vers.map(v => ({...v})) : examOpt.vers, w2: s.exam.w2 || examOpt.w2, key: s.exam.key ?? null, times: s.exam.times || ""});
  WS = s; wrSave(); render(); showStep(3);
}
/* 換電腦：存過的題目跟著備份檔走；還原時和這台電腦的合在一起（同一份不重複），留最近用的 WR_MAX 份 */
addBackupPart("writingSets", () => wrSets(), list => {
  if(!Array.isArray(list)) return;
  const ok = list.filter(s => s && typeof s.id === "string" && Array.isArray(s.items) && Array.isArray(s.lessons) && s.lessons.length && typeof s.goal === "string");
  const all = [...wrSets(), ...ok.filter(s => !wrSets().some(x => x.id === s.id))];
  store(KEYS.writingSets, all.sort((a, b) => String(b.used || b.at).localeCompare(String(a.used || a.at))).slice(0, WR_MAX));
});
let wrListOpen = false;
/* 最近的題目清單：第 1 步（隔天打開網頁還沒選課次，就看得到）和第 3 步都有 */
const wrListHtml = (cur, list) => `<details class="wrsetlist" ${wrListOpen ? "open" : ""}><summary>最近的題目（${list.length} 份，最多留 ${WR_MAX} 份）</summary>
      <table class="wrsets">${list.map(s => `<tr class="${cur && cur.id === s.id ? "on" : ""}"><td>${esc(wrSetName(s))}<small>${esc(wrWhen(s.at))} 抽的・${s.items.filter(it => !it.drop).length} 題${s.exam ? "・印過考卷" : ""}</small></td>
        <td>${cur && cur.id === s.id ? "<small>現在這份</small>" : `<button class="ghost" data-wso="${esc(s.id)}">打開</button>`}</td><td><button class="linkbtn" data-wsd="${esc(s.id)}">刪除</button></td></tr>`).join("")}</table>
      <p class="note" style="margin:4px 0 0">打開就接著用那一份（同樣的字、順序、語詞和考卷設定）。不存學生寫得對不對；存超過 ${WR_MAX} 份時，最久沒用的會自動刪掉；換電腦時跟著備份檔走。</p></details>`;
function renderWrRecent(){   /* setup.js 的 renderGoals 呼叫：寫字評量第 1 步 */
  const box = $("#wrRecent"), list = wrSets();
  if(!box) return;
  box.hidden = !list.length;
  box.innerHTML = list.length ? `<div class="wrset">${wrListHtml(wrCur(), list)}</div>` : "";
  bindWrSet(box);
}
function wrSetHtml(){
  const cur = wrCur(), list = wrSets();
  const n = cur ? cur.items.filter(it => !it.drop).length : 0;
  return `<div class="wrset">
    <p class="sub" style="margin-top:0">這份題目</p>
    <p class="note" style="margin:0 0 6px">${cur ? `<b>${n} 題</b>（${esc(wrWhen(cur.at))} 抽的，已經存在這台電腦）。大螢幕出題和考卷都用這一份，順序一樣。 <button class="linkbtn" id="wrRedraw">重新抽題</button>`
      : "按「開始出題」或「產生考卷」時抽題；抽好的題目會存在這台電腦，大螢幕出題和考卷都用同一份，隔天打開也可以接著用。"}</p>
    ${list.length ? wrListHtml(cur, list) : ""}
  </div>`;
}
function bindWrSet(box){
  const r = box.querySelector("#wrRedraw"), d = box.querySelector(".wrsetlist");
  if(r) r.onclick = () => { wrDraw(); render(); };
  if(d) d.ontoggle = e => { wrListOpen = e.target.open; };
  box.querySelectorAll("[data-wso]").forEach(b => b.onclick = () => wrOpen(b.dataset.wso));
  box.querySelectorAll("[data-wsd]").forEach(b => b.onclick = () => {
    if(!b.classList.contains("armed")){ b.classList.add("armed"); b.textContent = "確定刪除？再按一次"; return; }
    store(KEYS.writingSets, wrSets().filter(s => s.id !== b.dataset.wsd)); if(WS && WS.id === b.dataset.wsd) WS = null; render();
  });
}
const wrParts = c => { const p = partsOf(c); return p && p.length > 1 ? p : []; };   /* 部件提示用的部件（拆不開就沒有） */

/* ---------- 第 3 步：出題設定（setup.js 的 render 呼叫） ---------- */
function renderWriting(){
  const box = $("#wrSet");
  if(!box || !isWriting()) return;
  const g = GOALS.find(x => x.id === state.goal), q = quizPlan(), ready = state.lessons.length && q.count > 0 && !step2Miss();
  const manyBooks = new Set(state.lessons.map(k => splitKey(k)[0])).size > 1;
  const lessons = state.lessons.map(k => { const [b, n] = splitKey(k); return manyBooks ? `${bookName(b)} ${lessonName(b, n)}` : lessonName(b, n); }).join("、");
  box.innerHTML = `
    <dl class="wrsum">
      <dt>目標</dt><dd>${esc(g.name)}</dd>
      <dt>課次</dt><dd>${ready ? `${manyBooks ? "" : esc(bookName(splitKey(state.lessons[0])[0])) + " "}${esc(lessons)}` : "還沒選（請回第 2 步）"}</dd>
      <dt>題數</dt><dd>${ready ? `${q.count} 題，${minutes(q.sec)}` : "—"}</dd>
    </dl>
    ${state.lessons.length ? wrAdjHtml() : ""}
    <p class="note">${WRITE_HOW[g.id]}</p>
    <p class="sub">提示</p>
    <p class="note" style="margin-top:0">${WRITE_HINT[g.id]}</p>
    <p class="note">老師看大家寫完，再按「下一題」。出完全部題目會出現答案頁，可以帶學生對答案。<b>系統不留成績，也不存作答紀錄。</b></p>
    ${ready ? wrSetHtml() : ""}
    <button class="go" id="wrGo" ${ready ? "" : "disabled"}>開始出題</button>
    <div id="wrExam" class="wrexam"></div>`;
  $("#wrGo").onclick = () => { unlockSpeech(); writingStart(); };
  bindWrSet(box);
  if($("#wrAdj")){
    $("#wrAdj").ontoggle = e => { wrAdjOpen = e.target.open; };
    box.querySelectorAll(".wrc").forEach(b => b.onclick = () => { const id = b.dataset.k + "|" + b.dataset.c; wrSkip.has(id) ? wrSkip.delete(id) : wrSkip.add(id); render(); });
    if($("#wrAdjAll")) $("#wrAdjAll").onclick = () => { wrSkip.clear(); render(); };
  }
  if(typeof renderExamOpts === "function") renderExamOpts();   /* 第 2 版：印成考卷（exam.js） */
}

/* ---------- 開始出題 ---------- */
function writingStart(){
  /* 用「這份題目」（和考卷同一份、同樣順序；考卷「調整題目」勾了不考的不出，換過的語詞照換過的） */
  const set = wrEnsure();
  if(!set) return;
  const items = set.items.filter(it => !it.drop).map(it => ({...it, tiles: state.goal === "W3" ? regroupHtml(it.c) : ""}));
  if(!items.length) return;
  wrSave();
  W = {goal: state.goal, items, pos: 0, seen: 0, answers: false, partN: 0, wordOn: false};
  /* 先下載這次要用的字型：部件、答案頁的字用楷書，語詞（W1、W2 的提示）用注音字型 */
  const kai = items.map(it => it.c + it.w + wrParts(it.c).join("")).join("");   /* 部件提示、W3 的部件也要楷書 */
  const ruby = items.map(it => it.w ? Bpmf.text(it.w) : "").join("");
  const only = state.goal === "W1" ? items.map(wrTarget).join("") : "";   /* W1 要寫的字（只有注音的字型） */
  prepareThen(() => { showScreen("#wplay"); wrShow(); }, {TWKai: kai, BpmfKai: ruby, BpmfOnly: only});
}

/* W1：語詞裡要寫的字換成預設的虛線方格＋右邊直排注音（像國語考卷），其他字照常加注音（注音字型）；沒有語詞就只顯示方格和注音。
   注音用「字嗨注音而已」字型（shared/fonts/bpmf-only.woff2）顯示這個字本身：字型只畫注音，聲調、輕聲的位置都排好；
   破音字照 bpmf.js 判斷的讀音（語詞裡的異體字選擇子；沒有語詞用這本課本的讀音 BPMF_CH）。2026-11-10 維護者決定 */
const wrVs = n => n ? String.fromCodePoint(0xE01E0 + n) : "";
function wrTarget(it){   /* 要寫的字＋讀音記號 */
  if(it.w && it.w.includes(it.c)){ const m = Bpmf.text(it.w).match(new RegExp(it.c + "[\u{E01E0}-\u{E01EF}]?", "u")); if(m) return m[0]; }
  return it.c + wrVs((BPMF_CH[it.b] || {})[it.c] || 0);
}
function wrZhuyinHtml(it){
  const hole = ch => `<span class="zyhole"><span class="zybox" aria-hidden="true"></span><span class="zyonly">${esc(ch)}</span></span>`;
  if(!it.w) return hole(wrTarget(it));
  return [...Bpmf.text(it.w).matchAll(/(.)([\u{E01E0}-\u{E01EF}]?)/gu)].map(([, ch, vs]) => ch === it.c ? hole(ch + vs) : `<span class="bpmf">${esc(ch + vs)}</span>`).join("");
}

function wrShow(fresh = true){
  if(!W || W.answers) return;
  const it = W.items[W.pos], n = W.items.length, last = W.pos === n - 1;
  if(fresh) Object.assign(W, {partN: 0, wordOn: false});   /* 換題時提示都收起來 */
  W.seen = Math.max(W.seen, W.pos + 1);
  $("#wProg").textContent = `第 ${W.pos + 1} / ${n} 題`;
  $("#wGoal").textContent = GOALS.find(x => x.id === W.goal).name;
  let body = "";
  if(W.goal === "W1") body = `<div class="wword zy">${wrZhuyinHtml(it)}</div>`;
  if(W.goal === "W2") body = `<button class="wspk" id="wSpk" aria-label="再唸一次">${SPEAKER_SVG}</button>`;
  if(W.goal === "W3") body = `<div class="pieces big" aria-label="拆開的部件">${it.tiles}</div>`;
  /* 提示按鈕（老師點了才出現提示） */
  const ps = W.goal === "W3" ? [] : wrParts(it.c);
  const shown = ps.slice(0, W.partN);
  /* 提示分成左、中、右三格（2026-11-10 維護者要求）：左＝聲音（唸題目／再唸一次）、中＝語詞提示、右＝部件提示；
     每格上面是按鈕、下面是點開的內容；這個題型沒有的那一格空著，位置固定 */
  const cell = (cls, inner) => `<div class="whcell ${cls}">${inner}</div>`;
  const left = cell("say", `<button class="ghost whint" data-wh="say">${SPEAKER_SVG}<span>${W.goal === "W2" ? "再唸一次" : "唸題目"}</span></button>`);
  const mid = cell("word", W.goal === "W2" && it.w ? `<button class="ghost whint" data-wh="word" ${W.wordOn ? "disabled" : ""}>語詞提示</button>
      ${W.wordOn ? `<div class="wword bpmf whword">${esc(Bpmf.blank(it.w, it.c, "○"))}</div>` : ""}` : "");
  const right = cell("part", ps.length ? `<button class="ghost whint" data-wh="part" ${W.partN >= ps.length ? "disabled" : ""}>${W.partN ? `再多一個部件（${W.partN}/${ps.length}）` : "部件提示"}</button>
      ${shown.length ? `<div class="pieces wparts" aria-label="部件提示">${shown.map(p => `<span class="ptile">${esc(p)}</span>`).join("")}</div>` : ""}` : "");
  $("#wStage").innerHTML = `<div class="wnum">${W.pos + 1}</div>${body}<div class="whints">${left}${mid}${right}</div>`;
  $("#wStage").hidden = false; $("#wAns").hidden = true; $("#wNavQ").hidden = false;
  $("#wSay").hidden = true;   /* 「再唸一次」改放在提示的左格 */
  $("#wPrevQ").disabled = W.pos === 0;
  $("#wNextQ").textContent = last ? "看答案" : "下一題";
  $("#wEnd").hidden = last;
  const spk = $("#wSpk"); if(spk) spk.onclick = wrSay;
  $("#wStage").querySelectorAll("[data-wh]").forEach(bt => bt.onclick = () => {
    const h = bt.dataset.wh;
    if(h === "say") return wrSay();
    if(h === "word") W.wordOn = true;
    if(h === "part") W.partN = Math.min(ps.length, W.partN + 1);
    wrShow(false);
  });
  if(fresh && W.goal === "W2") wrSay();   /* 聽音寫字一出題就唸；看注音、看部件要老師按「唸題目」 */
}
const wrSay = () => { if(W && !W.answers) speak(promptOf(W.items[W.pos])); };

/* ---------- 答案頁：出過的題目（中途按「結束」只列出過的） ---------- */
function wrAnswers(){
  if(!W) return;
  W.answers = true;
  if("speechSynthesis" in window) speechSynthesis.cancel();
  const list = W.items.slice(0, W.seen);
  const ask = it => W.goal === "W1" ? `<span class="wword zy small">${wrZhuyinHtml(it)}</span>`
    : W.goal === "W3" ? `<span class="pieces">${(partsOf(it.c) || []).map(p => `<span class="ptile">${esc(p)}</span>`).join("")}</span>`
    : esc(it.w ? `${it.w}的${it.c}` : it.c);
  $("#wProg").textContent = `答案（${list.length} 題）`;
  $("#wStage").hidden = true; $("#wNavQ").hidden = true; $("#wEnd").hidden = true;
  $("#wAns").hidden = false;
  $("#wAns").innerHTML = `<table class="wanstab"><thead><tr><th>題號</th><th>題目</th><th>答案</th></tr></thead><tbody>
      ${list.map((it, i) => `<tr><td class="n">${i + 1}</td><td class="q">${ask(it)}</td><td class="a">${esc(it.c)}${it.w ? `<small>${esc(it.w)}</small>` : ""}</td></tr>`).join("")}
    </tbody></table>
    <p class="note">系統不留成績。要再練一次，可以按「同樣的字再出一次」（順序重新打亂）。</p>
    <div class="row" style="justify-content:center"><button class="go" id="wAgain">同樣的字再出一次</button><button class="ghost" id="wHome">回到設定</button></div>`;
  $("#wAgain").onclick = () => {
    W.items = shuffle(W.items.slice(0, W.seen)).map(it => ({...it, tiles: W.goal === "W3" ? regroupHtml(it.c) : ""}));
    Object.assign(W, {pos: 0, seen: 0, answers: false}); unlockSpeech(); wrShow();
  };
  $("#wHome").onclick = wrQuit;
}
function wrQuit(){
  if("speechSynthesis" in window) speechSynthesis.cancel();
  W = null; showScreen("#setup"); render();
}
const wrStep = d => {
  if(!W || W.answers) return;
  if(d > 0 && W.pos === W.items.length - 1) return wrAnswers();
  W.pos = Math.max(0, Math.min(W.items.length - 1, W.pos + d)); wrShow();
};
$("#wNextQ").onclick = () => wrStep(1);
$("#wPrevQ").onclick = () => wrStep(-1);
$("#wSay").onclick = wrSay;
$("#wEnd").onclick = () => wrAnswers();
$("#wQuit").onclick = wrQuit;
/* 鍵盤：→、空白鍵、Enter 下一題，← 上一題（老師用簡報筆也能換題） */
document.addEventListener("keydown", e => {
  if(!W || W.answers || $("#wplay").hidden || e.target.closest("input,textarea,select")) return;
  if(e.target.closest("button") && (e.key === " " || e.key === "Enter")) return;   /* 按鈕自己會處理空白鍵和 Enter，不要多換一題 */
  if(e.key === "ArrowRight" || e.key === " " || e.key === "PageDown"){ e.preventDefault(); wrStep(1); }
  if(e.key === "ArrowLeft" || e.key === "PageUp"){ e.preventDefault(); wrStep(-1); }
});
