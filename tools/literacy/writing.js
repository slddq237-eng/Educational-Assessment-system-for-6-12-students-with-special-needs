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
    <p class="note">${WRITE_HOW[g.id]}</p>
    <p class="sub">提示</p>
    <p class="note" style="margin-top:0">${WRITE_HINT[g.id]}</p>
    <p class="note">老師看大家寫完，再按「下一題」。出完全部題目會出現答案頁，可以帶學生對答案。<b>系統不留成績，也不存作答紀錄。</b></p>
    <button class="go" id="wrGo" ${ready ? "" : "disabled"}>開始出題</button>
    <div id="wrExam" class="wrexam"></div>`;
  $("#wrGo").onclick = () => { unlockSpeech(); writingStart(); };
  if(typeof renderExamOpts === "function") renderExamOpts();   /* 第 2 版：印成考卷（exam.js） */
}

/* ---------- 開始出題 ---------- */
function writingStart(){
  const q = quizPlan();
  const items = pickItems("", q).map(it => {
    const b = splitKey(it.k)[0], w = BOOKS[b].lessons[splitKey(it.k)[1]].sayChar ? "" : wordOf(it.c, b);
    return {...it, b, w, tiles: state.goal === "W3" ? regroupHtml(it.c) : ""};
  });
  if(!items.length) return;
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
