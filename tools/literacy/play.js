/* =========================================================
   識字評量：出題與作答（play.js）
   出題、組選項、提示、語音，作答畫面（正確率模式、流暢性模式）與結果畫面。
   ========================================================= */

/* =========================================================
   8. 出題與題目內容
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
      const rs = records.filter(r => r.kid === code && r.char === it.c && r.goal === "3" && !r.quit);
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
  const [sound = "", shape = ""] = confOf(c, b) || [];
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
/* 個資：Chrome 的「Google」語音會把要唸的文字送到雲端合成。唸學生名字時只用這台電腦內建（localService）的中文語音，
   找不到就不唸名字（speak 回傳 false，由呼叫的地方改成不含名字的說法）。題目的生字語詞照常用 pickVoice()。 */
const localVoice = () => voices.find(v => v.localService && /zh[-_]TW/i.test(v.lang)) || voices.find(v => v.localService && /^zh/i.test(v.lang)) || null;
const hasZhVoice = () => voices.some(v => /^zh/i.test(v.lang));
function speak(text, onend, rate, withName){
  const done = () => { const sp = $("#speaker"); if(sp) sp.classList.remove("talk"); if(onend) onend(); };
  if(!("speechSynthesis" in window)){ setTimeout(done, 300); return !withName; }
  const v = withName ? localVoice() : pickVoice();
  if(withName && !v) return false;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-TW"; if(v) u.voice = v; u.rate = rate || settings.rate;
    u.onend = u.onerror = done;
    const sp = $("#speaker"); if(sp) sp.classList.add("talk");
    speechSynthesis.speak(u);
  } catch(e){ setTimeout(done, 300); }
  return true;
}
/* 音效（取自生字賓果的做法，用瀏覽器直接合成，不需要音檔）：
   答對＝三個音往上的「叮叮叮」；答錯＝兩聲往下的「嗶嗶」，比較明顯；得到貼紙＝一小段歡呼音樂。
   「畫面與聲音」可以關掉音效（語音唸題不受影響）；面板裡的「試聽」按鈕不管開關都會出聲。 */
let actx = null;
function ac(){
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if(actx.state === "suspended") actx.resume(); } catch(e){ actx = null; }
  return actx;
}
function note(f, t0, dur, type, vol){
  const c = ac(); if(!c) return;
  try {
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  } catch(e){}
}
const sfx = {
  right(force){ if(settings.sfx || force) [523, 659, 784].forEach((f, i) => note(f, i * 0.08, 0.3, "triangle", 0.22)); },
  wrong(force){ if(settings.sfx || force){ note(220, 0, 0.16, "square", 0.09); note(165, 0.17, 0.26, "square", 0.09); } },
  /* 換人提示音：三個往上跳的小音「叮嚨咚」，輕快可愛 */
  turn(force){ if(settings.sfx || force){ note(988, 0, 0.12, "triangle", 0.16); note(1319, 0.1, 0.14, "triangle", 0.16); note(1568, 0.2, 0.32, "sine", 0.13); } },
  fanfare(){ if(settings.sfx){ [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.11, 0.35, "triangle", 0.2)); [523, 659, 784].forEach(f => note(f, 0.5, 1.1, "sine", 0.1)); } }
};
/* 答對時選項旁邊冒出一圈小星星（只在被點的選項上，0.6 秒，不影響計時與版面） */
const BURST = `<span class="burst" aria-hidden="true">${Array.from({length:8}, (_, i) => `<i style="--a:${i * 45}deg">✦</i>`).join("")}</span>`;


/* =========================================================
   9. 作答畫面
   G：這一次評量進行中的所有狀態。
   正確率模式：學生輪流作答，queue 是出題順序（S01 第1題、S02 第1題、S01 第2題…）。
   流暢性模式：每位學生輪流做一回合，時間到換下一位。
   G.cur：目前這一題（目標字、選項、答錯次數、出現過的提示、時間）。
   ========================================================= */
let G = null;
const SPEAKER_SVG = `<svg viewBox="0 0 24 24" width="55%" height="55%" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>`;

function showScreen(id){
  for(const s of ["#setup", "#pick", "#play", "#result", "#book", "#teacher"]) $(s).hidden = s !== id;
  window.scrollTo(0, 0);
}

function startSession(){
  const c = current(), q = quizPlan(), list = selKids();
  G = {
    session: Date.now(), cfg: c, q, kids: list,
    goal: state.goal, kind: state.kind, mode: state.mode, answer: state.answer,
    limit: +state.limit, aim: +$("#aim").value || 30, lessons: [...state.lessons],
    noHelp: c.noHelp, rule: c.rule || [], hints: c.hints,
    /* 版面：選項卡，或全課賓果卡（只在練習；正式評量、流暢性一律是選項卡，選項版面不能變） */
    choices: bingoOK(c) ? 0 : +c.choices, layout: bingoOK(c) ? "bingo" : "cards", boards: {},
    /* 主題（在選主題畫面選的，""＝不用主題）、要不要給貼紙；遊戲玩法（3-3 打怪獸：solo 自己打、coop 合作，""＝不玩） */
    theme: state.theme || "", rewards: useRewards(), game: "",
    tally: Object.fromEntries(list.map(k => [k, {n:0, first:0, passed:0, secs:[], wrong:0}])),
    quitArm: false
  };
  G.game = gameFor(G);
  setupHearts(G);
  /* 打怪獸的戰利品（大魚、恐龍等）開始前就決定好，打敗怪獸後就是這次的貼紙 */
  if(G.game) G.prize = Themes.drawSticker(G.theme, (Rewards.get(list[0]).stickers || {})[G.theme] || []);
  applySkin(G.theme);
  $("#pScene").hidden = true; $("#pScene").innerHTML = ""; $("#pBody").hidden = false;
  startClockShow();
  if(G.mode === "flu"){ G.turn = 0; showScreen("#play"); showReady(); return; }
  /* 正確率模式：每位學生各抽一份題目，再交錯排成輪流順序 */
  const lists = list.map(code => pickItems(code, q).map(it => ({...it, kid:code})));
  G.queue = [];
  for(let i = 0; i < Math.max(...lists.map(l => l.length)); i++) lists.forEach(l => { if(l[i]) G.queue.push(l[i]); });
  G.pos = 0;
  showScreen("#play");
  if(G.game) return sceneStart(nextItem);
  nextItem();
}

/* ---------- 右上角計時 ----------
   正確率模式：顯示這次評量已經用了多久（分:秒）；流暢性模式：顯示這一回合還剩幾秒。
   練習看「畫面與聲音」的設定（預設顯示），正式評量看「評量設定」（預設不顯示）。每筆紀錄記下有沒有顯示（clock）。 */
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function startClockShow(){
  const g = G;
  g.clock = g.mode === "flu" || (g.kind === "formal" ? !!settings.clockFormal : settings.clockPractice !== false);
  g.started = performance.now();
  const el = $("#pClock"); el.hidden = !g.clock; el.textContent = "";
  if(!g.clock) return;
  const tick = () => {
    if(G !== g || g.over){ el.hidden = true; return; }
    if(g.mode === "flu") el.textContent = g.round && !g.round.over ? `⏱ 剩 ${Math.max(0, Math.ceil((g.round.end - performance.now()) / 1000))} 秒` : "";
    else el.textContent = `⏱ ${mmss((performance.now() - g.started) / 1000)}`;
    setTimeout(tick, 250);
  };
  tick();
}

/* 畫上方的學生名字與進度 */
function drawBar(it){
  const k = kidBy(it.kid);
  $("#pWho").innerHTML = `${Rewards.avatarHtml(it.kid)}輪到 ${esc(k ? kidShow(k) : it.kid)}`;
  if(G.mode === "flu") $("#pProg").textContent = `答對 ${G.round.correct} 個`;
  else { const mine = G.queue.filter(x => x.kid === it.kid), idx = mine.indexOf(it) + 1; $("#pProg").textContent = `第 ${idx} / ${mine.length} 題`; }
  drawHearts(it.kid);
}

function nextItem(){
  if(G.over) return;   /* 已經按「結束」了，不要再出題（避免結果畫面還在唸題目） */
  if(G.pos >= G.queue.length) return G.game && !G.hpOver ? sceneWin() : finish();
  const it = G.queue[G.pos], prev = G.queue[G.pos - 1];
  /* 多人輪流時，換到另一位學生先出現換人畫面 */
  if(G.kids.length > 1 && (!prev || prev.kid !== it.kid)) return turnCard(it.kid, !prev, () => newItem(it));
  newItem(it);
}

/* ---------- 3-1 換人過場 ----------
   畫面中間放大頭像和大字「換 ○○」，播提示音（或依設定唸名字），停約 1.6 秒再出題，讓學生有時間換位置。
   計時從題目唸完才開始，這段停頓不會算進反應時間。正式評量、練習都一樣。 */
const TURN_MS = 1600;
function turnCard(code, first, then){
  const k = kidBy(code), name = k ? kidShow(k) : code, g = G;
  $("#pWho").innerHTML = `${Rewards.avatarHtml(code)}輪到 ${esc(name)}`;
  $("#pProg").textContent = "";
  drawHearts(code);
  $("#pBody").innerHTML = `<div class="turncard" role="status"><div class="turnav">${Rewards.avatarHtml(code)}</div>
    <h2>${first ? `先從 ${esc(name)} 開始` : `換 ${esc(name)}`}！</h2><p class="note" style="margin:0">請 ${esc(name)} 準備好</p></div>`;
  /* 提醒方式看「畫面與聲音」的設定：預設只有提示音，選了才唸名字 */
  const style = settings.turnStyle || "chime";
  if(style === "chime" || style === "both") sfx.turn();
  /* 唸名字只用本機語音；這台電腦沒有本機中文語音時改成提示音（「唸出名字」那一種原本沒有提示音） */
  if(style === "voice" || style === "both") setTimeout(() => { if(G === g && !g.over && !speak(`${first ? "先從" : "換"}${name}`, null, null, true) && style === "voice") sfx.turn(); }, style === "both" ? 450 : 0);
  setTimeout(() => { if(G === g && !g.over) then(); }, TURN_MS);
}

/* ---------- 3-2 全課賓果卡（只在練習） ----------
   一課的字排成賓果卡（不夠排滿就用別課的字補），聽到哪個字就點哪個。
   答對的格子蓋上學生的頭像，連成一條線（橫、直、斜）會跳出「連線！」。每位學生每一課各有自己的卡。 */
const bingoOK = c => c.choices === "bingo" && !c.formal && !c.flu;
const gridFor = n => n <= 9 ? [3,3] : n <= 16 ? [4,4] : n <= 20 ? [5,4] : n <= 25 ? [5,5] : n <= 30 ? [6,5] : [6,6];
function bingoBoard(kid, k){
  const id = kid + "|" + k;
  if(!G.boards[id]){
    const own = [...new Set(charsOf(k))].slice(0, 36), [cols, rows] = gridFor(own.length);
    const fill = shuffle(ALL_CHARS.filter(c => !own.includes(c))).slice(0, cols * rows - own.length);
    const lines = [];
    for(let r = 0; r < rows; r++) lines.push(Array.from({length:cols}, (_, c) => r * cols + c));
    for(let c = 0; c < cols; c++) lines.push(Array.from({length:rows}, (_, r) => r * cols + c));
    if(rows === cols){ lines.push(Array.from({length:rows}, (_, i) => i * cols + i)); lines.push(Array.from({length:rows}, (_, i) => i * cols + cols - 1 - i)); }
    G.boards[id] = {cells: shuffle([...own, ...fill]), cols, rows, lines, marks:new Set(), done:new Set()};
  }
  return G.boards[id];
}
/* 賓果卡上每個字和目標字的關係，用來記錄「錯誤類型」 */
function optType(c, x, k){
  const b = splitKey(k)[0], [sound = "", shape = ""] = confOf(c, b) || [];
  if(x === c) return "答案";
  if(wordOf(c, b).includes(x)) return "同詞易混";
  if(sound.includes(x)) return "同音";
  if(shape.includes(x)) return "形近";
  return charsOf(k).includes(x) ? "課文字" : "其他字";
}

/* 準備一題：組選項、畫畫面、唸題目；唸完才開始計時 */
function newItem(it){
  const b = splitKey(it.k)[0], board = G.layout === "bingo" ? bingoBoard(it.kid, it.k) : null;
  G.cur = {it, b, board, opts: board ? board.cells.map(ch => ({ch, type: optType(it.c, ch, it.k)})) : makeOptions(it.c, it.k, G.choices),
           wrong:0, firstPick:null, firstSec:null, shown:[], hintPos:0, teacher:0, t0:null, tShown:performance.now(), done:false};
  drawBar(it);
  const cols = board ? board.cols : G.choices === 4 ? 2 : 3, rows = board ? board.rows : Math.ceil(G.choices / cols);
  const stamp = board ? `<span class="stamp2" aria-hidden="true">${Rewards.avatarHtml(it.kid)}</span>` : "";
  const cellClass = i => !board ? "" : board.marks.has(i) ? ` marked${[...board.done].some(L => board.lines[L].includes(i)) ? " win" : ""}` : "";
  $("#pBody").innerHTML = `<div class="stage">
      <div class="prompt">
        <button class="speaker" id="speaker" aria-label="再聽一次">${SPEAKER_SVG}</button>
        <span class="note" style="margin:0">聽聽看，是哪一個字？</span>
        <div class="hintbox" id="hintbox" aria-live="polite"></div>
      </div>
      <div class="optsbox"><div class="opts ${board ? "bingo" : ""}" style="--cols:${cols};--rows:${rows}">
        ${G.cur.opts.map((o, i) => `<button class="opt-big${cellClass(i)}" data-i="${i}" ${board && board.marks.has(i) ? "disabled" : ""}>${esc(o.ch)}${board && board.marks.has(i) ? stamp : ""}</button>`).join("")}
      </div></div>
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
    btn.classList.add("right"); btn.insertAdjacentHTML("beforeend", BURST); sfx.right();
    if(cur.wrong === 0) heartStreak(cur.it.kid);
    if(cur.board) bingoMark(i);
    return endItem(true, sec);
  }
  cur.wrong++;
  btn.classList.add("wrong", "shake"); btn.disabled = true; sfx.wrong();
  if(cur.wrong === 1 && loseHeart(cur.it.kid)){ cur.hpOut = true; return endItem(false, null); }   /* 愛心用完：這題記成沒通過，直接結束 */
  if(G.mode === "flu" || G.noHelp) return endItem(false, null);
  const act = G.rule[cur.wrong - 1] || "reveal";
  if(act === "next") showNextHint();
  if(act === "reveal") reveal();
}

/* 賓果卡蓋章、檢查有沒有新的連線 */
function bingoMark(i){
  const B = G.cur.board;
  B.marks.add(i);
  const fresh = B.lines.map((L, n) => n).filter(n => !B.done.has(n) && B.lines[n].every(x => B.marks.has(x)));
  if(!fresh.length) return;
  fresh.forEach(n => { B.done.add(n); B.lines[n].forEach(x => { const el = $(`#pBody .opt-big[data-i="${x}"]`); if(el) el.classList.add("win"); }); });
  G.cur.line = true;
  const ban = document.createElement("div"); ban.className = "bbanner"; ban.textContent = fresh.length > 1 ? `連成 ${fresh.length} 條線！` : "連線！";
  $("#play").appendChild(ban); setTimeout(() => ban.remove(), 1700);
  setTimeout(() => sfx.fanfare(), 250);
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
    phase: phaseFor(it.kid, b, n) || "", daysAfter: state.rtiKeys.includes(key(b,n)) ? rtiDays(key(b,n)) : state.manual[key(b,n)] ? "" : (a.days ?? ""),
    /* 當時的條件（研究用的進階分析會用到）：提示設定、答錯規則用代碼存，Excel 再翻成中文 */
    hintSet: G.hints.join(","), rule: G.noHelp ? "none" : G.rule.join(","), layout: G.layout,
    theme: G.theme, game: G.game, reward: "",
    fontScale: settings.fontScale, rate: settings.rate, sfx: settings.sfx,
    aim: G.mode === "flu" ? G.aim : "",   /* 流暢性的目標（每分鐘幾個），老師專區畫目標線用 */
    clock: !!G.clock,                      /* 作答時右上角有沒有顯示計時 */
    hpMax: G.hpMax || "", hp: G.hpMax ? heartPool(it.kid).hp : ""   /* 血量模式：開始時幾顆、這題做完剩幾顆 */
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
  const g = G;
  if(cur.hpOut) return heartsOut(it.kid);
  setTimeout(() => { if(G !== g || g.over) return; if(g.game && g.pos < g.queue.length) sceneBeat(it.kid, nextItem); else nextItem(); },
    passed ? (cur.line ? 1800 : 900) : revealed ? 2200 : 1000);
}

/* ---------- 3-3b 血量模式（只在練習） ----------
   開始前在選主題畫面選幾顆愛心（3、5、7）。一題第一次選錯就少一顆（同一題再錯不會再扣），連續 3 題第一次就答對補一顆（不超過開始的顆數）。
   愛心用完就直接結束、看成績：這次算「做完」（不是中途結束），一樣抽一張貼紙。
   合作打怪獸時全組共用一份愛心，用完全組一起結束；其他時候每人各自，某人用完只結束他的部分，其他人繼續。 */
const HEART_CHOICES = [3, 5, 7];
const heartsAllowed = () => state.kind !== "formal" && state.mode === "acc";
function setupHearts(g){
  g.hpMax = g.kind !== "formal" && g.mode === "acc" ? +settings.practiceHearts || 0 : 0;
  g.pools = {};
  if(!g.hpMax) return;
  const mk = () => ({hp: g.hpMax, streak: 0, out: false});
  if(g.game === "coop"){ const shared = mk(); g.kids.forEach(k => g.pools[k] = shared); }
  else g.kids.forEach(k => g.pools[k] = mk());
}
const heartPool = code => G.pools[code];
/* 上方的愛心：fx＝"lose"（剛少一顆）或 "gain"（剛補一顆） */
function drawHearts(code, fx){
  const el = $("#pHearts");
  if(!G.hpMax){ el.hidden = true; return; }
  const p = heartPool(code);
  el.hidden = false;
  el.setAttribute("aria-label", `愛心剩 ${p.hp} 顆，共 ${G.hpMax} 顆`);
  el.innerHTML = Array.from({length: G.hpMax}, (_, i) => `<i class="${i < p.hp ? "" : "empty"}${fx === "lose" && i === p.hp ? " lose" : fx === "gain" && i === p.hp - 1 ? " gain" : ""}">${i < p.hp ? "❤" : "♡"}</i>`).join("");
}
/* 第一次就答錯：少一顆；回傳 true＝用完了 */
function loseHeart(code){
  if(!G.hpMax) return false;
  const p = heartPool(code);
  p.hp = Math.max(0, p.hp - 1); p.streak = 0;
  drawHearts(code, "lose");
  return p.hp === 0;
}
/* 第一次就答對：連續 3 題補一顆 */
function heartStreak(code){
  if(!G.hpMax) return;
  const p = heartPool(code);
  if(++p.streak < 3) return;
  p.streak = 0;
  if(p.hp < G.hpMax){ p.hp++; drawHearts(code, "gain"); }
}
/* 愛心用完：拿掉這份愛心的人還沒做的題目，顯示「愛心用完了」1.6 秒，再接著出題或到結果畫面 */
function heartsOut(code){
  const g = G, p = heartPool(code), who = g.kids.filter(k => heartPool(k) === p);
  p.out = true;
  g.queue = g.queue.filter((x, i) => i < g.pos || !who.includes(x.kid));
  g.hpOver = g.kids.every(k => heartPool(k).out);
  const k = kidBy(code), name = who.length > 1 ? "大家" : k ? kidShow(k) : code;
  $("#pBody").innerHTML = `<div class="hpout" role="status"><div class="big" aria-hidden="true">💔</div><h2>${esc(name)}的愛心用完了！</h2>
    <p class="note" style="margin:0">${g.hpOver ? "這次就到這裡，來看看成績吧！" : "換下一位繼續。"}</p></div>`;
  setTimeout(() => { if(G === g && !g.over) nextItem(); }, 1600);
}

/* ---------- 3-3 打怪獸 ----------
   正確率模式、選項卡、有選主題才可以玩；練習看選主題畫面的選擇（預設要玩），正式評量看評量設定（預設不玩）。
   一位學生＝自己打（solo），多位學生輪流＝大家合作打同一隻（coop）。
   場景只在「題目之間」出現：開始前一段、每題做完一段（固定 1.8 秒，不論對錯），最後一題做完是打敗怪獸。
   作答時看不到場景，選項的版面和沒玩時完全一樣；怪獸依「做完幾題」受傷，不論對錯（和貼紙規則一致）。 */
const SCENE_MS = 1800;
const GAMES = {solo:"打怪獸（個人）", coop:"打怪獸（合作）"};
const gameName = g => GAMES[g] || "無";
const gameAllowed = () => state.mode === "acc" && !bingoOK(current());
function gameFor(g){
  if(g.mode !== "acc" || g.layout !== "cards" || !g.theme || !window.Scenes || !Scenes[g.theme]) return "";
  if(g.kind === "formal" ? !(settings.formalTheme && settings.formalGame) : settings.practiceGame === false) return "";
  return g.kids.length > 1 ? "coop" : "solo";
}
const SCENE_ACT = {ocean:"用力拉", space:"出擊", dino:"敲一下", dessert:"疊蛋糕"};
/* 切換作答畫面與場景；cap＝場景上方的一行字（可以帶頭像） */
function showScene(on, cap = "", code = ""){
  $("#pBody").hidden = on; $("#pScene").hidden = !on;
  if(on) $("#sceneCap").innerHTML = `${code ? Rewards.avatarHtml(code) : ""}<span>${esc(cap)}</span>`;
}
/* 開始前：看看要打的怪獸，停 1.8 秒 */
function sceneStart(then){
  const g = G, box = $("#pScene"), t = Themes.THEMES[g.theme];
  box.innerHTML = `<div class="scenecap" id="sceneCap"></div><div class="scenehold"></div>`;
  g.scene = Scenes[g.theme](box.querySelector(".scenehold"), g.queue.length, g.prize);
  g.hits = 0;
  g.scene.setPlayer(g.queue[0].kid);
  showScene(true, `${g.game === "coop" ? "大家一起：" : ""}${t.line}`);
  $("#pProg").textContent = `做完 ${g.queue.length} 題就成功！`;
  setTimeout(() => { if(G === g && !g.over){ showScene(false); then(); } }, SCENE_MS);
}
/* 每做完一題（不論對錯）：主角換成剛剛作答的學生，怪獸受傷一次，停 1.8 秒 */
function sceneBeat(code, then){
  const g = G, k = kidBy(code);
  g.hits++;
  g.scene.setPlayer(code);
  showScene(true, `${k ? kidShow(k) : code} ${SCENE_ACT[g.theme] || "出擊"}！`, code);
  g.scene.hit(g.hits);
  setTimeout(() => { if(G === g && !g.over){ showScene(false); then(); } }, SCENE_MS);
}
/* 最後一題做完：打敗怪獸，播完才到結果畫面（結果畫面再揭曉貼紙） */
function sceneWin(){
  const g = G; if(g.winning) return; g.winning = true;
  const t = Themes.THEMES[g.theme], last = g.queue[g.queue.length - 1].kid, k = kidBy(last);
  g.hits = g.queue.length;
  g.scene.setPlayer(last);
  showScene(true, g.game === "coop" ? t.coopWin : `${k ? kidShow(k) : last} ${t.winBanner}`, g.game === "coop" ? "" : last);
  const r = g.scene.win();
  setTimeout(() => { if(G === g && !g.over) sfx.fanfare(); }, r.bannerAt);   /* 上方的字已經寫了結果，不另外跳大字，免得蓋住怪獸 */
  setTimeout(() => { if(G === g && !g.over) finish(); }, r.delay);
}

/* ---------- 流暢性模式：一位學生一回合 ---------- */
function showReady(){
  const code = G.kids[G.turn], k = kidBy(code);
  $("#pWho").innerHTML = `${Rewards.avatarHtml(code)}輪到 ${esc(k ? kidShow(k) : code)}`;
  $("#pProg").textContent = "";
  $("#pTimer").hidden = true;
  $("#pBody").innerHTML = `<div class="ready"><div class="turnav">${Rewards.avatarHtml(code)}</div><h2>${G.turn ? "換 " : ""}${esc(k ? kidShow(k) : code)}，準備好了嗎？</h2>
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
  /* 3 秒內沒按第二次就取消；只取消「這一次」評量的，避免上一次的計時器把新的一次也取消 */
  const g = G;
  if(!g.quitArm){ g.quitArm = true; $("#pQuit").textContent = "再按一次結束"; setTimeout(() => { if(G === g && !g.over){ g.quitArm = false; $("#pQuit").textContent = "結束"; } }, 3000); return; }
  if(G.round) G.round.over = true;
  G.quit = true;
  finish();
};


/* =========================================================
   10. 結果畫面
   ========================================================= */
function finish(){
  if(G.over) return;
  G.over = true;   /* 之後還在排隊的出題、換人畫面都會停下來 */
  try { speechSynthesis.cancel(); } catch(e){}
  $("#pTimer").hidden = true; $("#pHearts").hidden = true; $("#pQuit").textContent = "結束";
  const g = G;
  if(g.scene){ g.scene.stop(); $("#pScene").hidden = true; $("#pBody").hidden = false; }
  /* 哪些學生做完了：正確率模式＝自己的題目都答完；流暢性模式＝自己那一回合時間到。
     按「結束」提早離開時，沒做完的學生這次的紀錄標成「中途結束」（不列入分析），也不抽貼紙。 */
  g.done = new Set(g.kids.filter(code => g.mode === "flu" ? g.tally[code].roundCorrect !== undefined
    : g.queue.filter(x => x.kid === code).length === g.tally[code].n));
  const left = g.kids.filter(code => !g.done.has(code));
  if(left.length) records.filter(r => r.session === g.session && left.includes(r.kid)).forEach(r => { r.quit = true; updateRecord(r); });
  $("#rTitle").textContent = left.length ? "這次先到這裡" : "完成了！";
  $("#rList").innerHTML = g.kids.map(code => {
    const t = g.tally[code], k = kidBy(code), name = esc(k ? kidShow(k) : code);
    if(!g.done.has(code)) return `<div class="rcard" data-kid="${esc(code)}"><b class="rname2">${Rewards.avatarHtml(code)}${name}</b><span class="big">沒有做完</span>
      <span class="sm">這次中途結束，紀錄不列入分析，也沒有貼紙。下次做完就可以抽貼紙喔！</span></div>`;
    if(g.mode === "flu"){
      const perMin = Math.round((t.roundCorrect || 0) * 60 / g.limit);
      return `<div class="rcard" data-kid="${esc(code)}"><b class="rname2">${Rewards.avatarHtml(code)}${name}</b><span class="big">每分鐘 ${perMin} 個</span>
        <span class="sm">答對 ${t.roundCorrect || 0} 個、答錯 ${t.roundWrong || 0} 個（${LIMITS.find(l => +l[0] === g.limit)[1]}），目標每分鐘 ${g.aim} 個${perMin >= g.aim ? "，達到目標！" : ""}</span></div>`;
    }
    const avg = t.secs.length ? (t.secs.reduce((a, b) => a + b, 0) / t.secs.length).toFixed(1) : "—";
    const hp = g.hpMax ? g.pools[code] : null;
    return `<div class="rcard" data-kid="${esc(code)}"><b class="rname2">${Rewards.avatarHtml(code)}${name}</b><span class="big">${t.first} / ${t.n}</span>
      <span class="sm">第一次就答對 ${t.first} 題${t.n ? `（${Math.round(t.first / t.n * 100)}%）` : ""}，最後答對 ${t.passed} 題，答對平均 ${avg} 秒</span>
      ${hp ? `<span class="sm">${hp.out ? "💔 愛心用完了" : `剩下 ${"❤".repeat(hp.hp)}（${hp.hp} / ${g.hpMax} 顆）`}</span>` : ""}</div>`;
  }).join("") || `<p class="note">這次沒有作答紀錄。</p>`;
  $("#rNote").textContent = (g.kind === "formal" ? "這次是正式評量，做完的結果會納入學習分析。" : "這次是練習，結果另外統計。")
    + (left.length ? "沒有做完的紀錄會保留，但標成「中途結束」，不列入分析。" : "");
  showScreen("#result");
  giveStickers(g);   /* 每位有作答的學生抽一張貼紙（見 collect.js） */
}
$("#rAgain").onclick = () => { if(G) chooseTheme(); };
$("#rHome").onclick = () => { G = null; showScreen("#setup"); render(); };
$("#rExport").onclick = () => { if(G) exportXlsx(records.filter(r => r.session === G.session), `識字評量_${fileDate(G.session)}.xlsx`, "#rMsg"); };
