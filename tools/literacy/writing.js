/* =========================================================
   識字評量：寫字組第 1 版「螢幕出題」（tools/literacy/writing.js，2026-11-10 E3）
   規則（維護者 2026-11-07～10 決定，見 docs/plans/writing-discussion.md、docs/decisions/2026-11-07-writing-plan.md）：
   - 大螢幕一題一題出，學生寫在紙上，老師自己改；**不留成績、不存作答紀錄、不記出過哪些題目**，沒有主題和貼紙。
   - 設定只有 3 步：選目標（W1～W3）→ 選課次和題數（不選學生）→ 出題設定（這個檔案的 renderWriting）。
   - 老師按「下一題」換題（學生寫得快慢不同）；出完題出現答案頁，帶學生對答案。
   - W1 看注音寫國字：語詞裡要寫的字換成括號裡的注音，其他字照常加注音，例如「蜜（ㄈㄥ）」；注音文字查 shared/zhuyin.js。
     W2 聽音寫字：唸「蜜蜂的蜂」，可以按「再唸一次」。W3 看部件寫字：顯示拆開的部件（和部件重組 R4 一樣，拆不開的字不出）。
   - 出題設定只有一個提示開關（每個目標各一個，不存起來）：W1、W3 同時唸出題目；W2 畫面同時顯示語詞（要寫的字挖空）。
   用到 play.js 的 pickItems（抽字）、promptOf（唸的文字）、speak、regroupHtml（部件卡）、prepareThen（先下載字型）、showScreen；
   setup.js 的 quizPlan（題數、出題方式）。
   ========================================================= */
let W = null;   /* 這次出題的狀態：goal、items（每題的字、課次、語詞、部件卡）、pos（目前第幾題）、seen（出到第幾題）、hint、answers（是不是在答案頁） */
const WRITE_HINT = {
  W1: "同時唸出題目（例如「蜜蜂的蜂」）",
  W2: "畫面同時顯示語詞（要寫的字挖空，例如「蜜○」）",
  W3: "同時唸出題目（例如「蜜蜂的蜂」）"
};
const WRITE_HOW = {
  W1: "螢幕顯示語詞，要寫的字換成注音，例如「蜜（ㄈㄥ）」；學生在紙上寫出國字。",
  W2: "電腦唸出「蜜蜂的蜂」，學生在紙上寫出國字；可以按「再唸一次」。",
  W3: "螢幕顯示拆開的部件，學生在紙上寫出組成的字（拆不開的字不出題）。"
};
const wrHints = {};   /* 出題設定的提示開關，每個目標各一個；只在這次打開網頁時記得 */
const wrSays = () => W.goal === "W2" || (W.hint && W.goal !== "W2");   /* 這一題要不要唸 */

/* ---------- 第 3 步：出題設定（setup.js 的 render 呼叫） ---------- */
function renderWriting(){
  const box = $("#wrSet");
  if(!box || !isWriting()) return;
  const g = GOALS.find(x => x.id === state.goal), q = quizPlan(), ready = state.lessons.length && q.count > 0;
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
    <label class="wrchk"><input type="checkbox" id="wrHint" ${wrHints[g.id] ? "checked" : ""}> ${WRITE_HINT[g.id]}</label>
    <p class="note">老師看大家寫完，再按「下一題」。出完全部題目會出現答案頁，可以帶學生對答案。<b>系統不留成績，也不存作答紀錄。</b></p>
    <button class="go" id="wrGo" ${ready ? "" : "disabled"}>開始出題</button>`;
  $("#wrHint").onchange = e => { wrHints[g.id] = e.target.checked; };
  $("#wrGo").onclick = () => { unlockSpeech(); writingStart(); };
}

/* ---------- 開始出題 ---------- */
function writingStart(){
  const q = quizPlan();
  const items = pickItems("", q).map(it => {
    const b = splitKey(it.k)[0], w = BOOKS[b].lessons[splitKey(it.k)[1]].sayChar ? "" : wordOf(it.c, b);
    return {...it, b, w, tiles: state.goal === "W3" ? regroupHtml(it.c) : ""};
  });
  if(!items.length) return;
  W = {goal: state.goal, items, pos: 0, seen: 0, hint: !!wrHints[state.goal], answers: false};
  /* 先下載這次要用的字型：部件、答案頁的字用楷書，語詞（W1、W2 的提示）用注音字型 */
  const kai = items.map(it => it.c + it.w + (state.goal === "W3" ? (partsOf(it.c) || []).join("") : "")).join("");
  const ruby = items.map(it => it.w ? Bpmf.text(it.w) : "").join("");
  prepareThen(() => { showScreen("#wplay"); wrShow(); }, {TWKai: kai, BpmfKai: ruby});
}

/* W1：語詞裡要寫的字換成括號裡的注音，其他字照常加注音（注音字型）；沒有語詞就只顯示注音 */
function wrZhuyinHtml(it, big){
  const zy = Zhuyin.of(it.c, it.w, it.b) || "？";
  const hole = `<span class="zyhole">（${esc(zy)}）</span>`;
  if(!it.w) return hole;
  return [...Bpmf.text(it.w).matchAll(/(.)([\u{E01E0}-\u{E01EF}]?)/gu)].map(([, ch, vs]) => ch === it.c ? hole : `<span class="bpmf">${esc(ch + vs)}</span>`).join("");
}

function wrShow(){
  if(!W || W.answers) return;
  const it = W.items[W.pos], n = W.items.length, last = W.pos === n - 1;
  W.seen = Math.max(W.seen, W.pos + 1);
  $("#wProg").textContent = `第 ${W.pos + 1} / ${n} 題`;
  $("#wGoal").textContent = GOALS.find(x => x.id === W.goal).name;
  let body = "";
  if(W.goal === "W1") body = `<div class="wword zy">${wrZhuyinHtml(it)}</div>`;
  if(W.goal === "W2") body = `<button class="wspk" id="wSpk" aria-label="再唸一次">${SPEAKER_SVG}</button>
    ${W.hint && it.w ? `<div class="wword bpmf">${esc(Bpmf.blank(it.w, it.c, "○"))}</div>` : ""}`;
  if(W.goal === "W3") body = `<div class="pieces big" aria-label="拆開的部件">${it.tiles}</div>`;
  $("#wStage").innerHTML = `<div class="wnum">${W.pos + 1}</div>${body}`;
  $("#wStage").hidden = false; $("#wAns").hidden = true; $("#wNavQ").hidden = false;
  $("#wSay").hidden = !wrSays();
  $("#wPrevQ").disabled = W.pos === 0;
  $("#wNextQ").textContent = last ? "看答案" : "下一題";
  $("#wEnd").hidden = last;
  const spk = $("#wSpk"); if(spk) spk.onclick = wrSay;
  if(wrSays()) wrSay();
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
