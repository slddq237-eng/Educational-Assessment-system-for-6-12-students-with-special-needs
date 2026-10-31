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
/* 所有課本的字：shared/lessons.js 先算好的 ALL_LESSON_CHARS（平板只載入這次用到的課本，用算好的才和電腦一樣） */
const ALL_CHARS = [...ALL_LESSON_CHARS];
/* 唸題目「語詞的字」；電腦語音會唸錯的破音字，唸的時候換成同音字（見 shared/bpmf.js 的 BPMF_SAY，畫面不變） */
const sayOf = (c, b) => wordOf(c, b) ? Bpmf.say(wordOf(c, b), c) : c;
/* 題目唸法：課次設了 sayChar（例如康軒一上「真簡單」的數字）只唸字本身，其他唸「語詞的字」；「詞帶字」提示的報讀仍唸語詞 */
const promptOf = it => { const [b, n] = splitKey(it.k); return BOOKS[b].lessons[n].sayChar ? it.c : sayOf(it.c, b); };
const isHan = ch => /\p{Script=Han}/u.test(ch);
/* 這次要考的字（只考有教的字，見 wordsets.js）；選項裡的「課文字」干擾字仍然用整課的字 */
const testChars = k => wsPick(k).filter(c => !goalSkips(c));   /* 部件重組不出拆不開的字（data.js 的 goalSkips） */

function pickItems(code, q){
  const pool = state.lessons.flatMap(k => testChars(k).map(c => ({c, k})));
  if(q.method === "all") return shuffle(pool);
  if(q.method === "weak"){
    /* 常錯優先：依這位學生過去的紀錄，錯得多、反應慢的字先出；沒考過的字排中間 */
    const score = it => {
      const rs = records.filter(r => r.kid === code && r.char === it.c && r.goal === state.goal && !r.quit);
      if(!rs.length) return 0.5;
      const wrong = rs.filter(r => !r.firstCorrect).length / rs.length;
      const sec = rs.reduce((s, r) => s + Math.min(r.correctSec ?? 10, 10), 0) / rs.length;
      return wrong + sec / 20;
    };
    return shuffle(shuffle(pool).sort((a, b) => score(b) - score(a)).slice(0, q.count));
  }
  /* 依字頻排名排序（shared/freq.js）：常用的在前；查不到排名的字放最後，維持原本的隨機順序 */
  const rank = it => (typeof FREQ !== "undefined" && FREQ[it.c]) || Infinity;
  const byFreq = list => [...list].sort((a, b) => rank(a) - rank(b));
  const rest = shuffle([...pool]);
  if(q.method === "freq") return shuffle(byFreq(rest).slice(0, q.count));
  /* 平均隨機：先取所選課次中字頻最高的字（練習才有），再依每課分配的題數抽 */
  const take = byFreq(rest).slice(0, q.freqN).map(it => ({...it, boost:true}));
  take.forEach(t => rest.splice(rest.findIndex(it => it.c === t.c && it.k === t.k), 1));
  for(const [k, n] of q.per){
    const fromK = rest.filter(it => it.k === k).slice(0, n);
    take.push(...fromK);
    fromK.forEach(it => rest.splice(rest.indexOf(it), 1));
  }
  while(take.length < q.count && rest.length) take.push(rest.shift());
  return shuffle(take).slice(0, q.count);
}

/* 多位學生輪流：每人一份題目交錯排成佇列（S01 第1題、S02 第1題、S01 第2題…）。
   前一位剛做過的字，下一位不要馬上又出現（看到上一題答案會互相影響）：輪到某位學生時，
   從他剩下的題目挑第一個「字和前一題不同」的；只剩相同的字時才不得已照出（例如大家只考同一個字）。
   每位學生題目的數量和內容不變，只是順序調整；單人時等於原本順序。 */
function interleaveLists(lists){
  const left = lists.map(l => [...l]), out = [];
  const total = left.reduce((s, l) => s + l.length, 0);
  for(let i = 0; out.length < total; i++){
    const j = i % left.length;
    if(!left[j].length) continue;
    const last = out[out.length - 1];
    let at = left[j].findIndex(it => !last || last.kid === it.kid || last.c !== it.c);
    if(at < 0) at = 0;
    out.push(left[j].splice(at, 1)[0]);
  }
  /* 最後幾題可能只剩相同的字排不開：和同一位學生較前面的題目對調位置來修補（只調同一人的順序） */
  const clash = p => p > 0 && out[p].c === out[p - 1].c && out[p].kid !== out[p - 1].kid;
  const bad = p => clash(p) || (p + 1 < out.length && clash(p + 1));
  for(let p = out.length - 1; p > 0; p--){
    if(!clash(p)) continue;
    for(let r = 0; r < out.length; r++){
      if(r === p || out[r].kid !== out[p].kid) continue;
      [out[p], out[r]] = [out[r], out[p]];
      if(!bad(p) && !bad(r)) break;
      [out[p], out[r]] = [out[r], out[p]];
    }
  }
  return out;
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

/* 部件重組（目標 4-1）的選項：先放形近字，再放有相同部件的字，不夠用課文字補（題目不唸出來，所以不放同音字） */
function makePartsOptions(c, k, n){
  const b = splitKey(k)[0], [, shape = ""] = confOf(c, b) || [], mine = partsOf(c) || [];
  const used = new Set([c]), out = [];
  const add = (x, type) => { if(x && isHan(x) && !used.has(x) && out.length < n - 1){ used.add(x); out.push({ch:x, type}); } };
  shuffle([...shape]).slice(0, Math.ceil((n - 1) / 2)).forEach(x => add(x, "形近"));
  shuffle(ALL_CHARS.filter(x => (partsOf(x) || []).some(p => mine.includes(p)))).forEach(x => add(x, "同部件"));
  shuffle([...shape]).forEach(x => add(x, "形近"));
  shuffle(charsOf(k)).forEach(x => add(x, "課文字"));
  shuffle([...ALL_CHARS]).forEach(x => add(x, "其他字"));
  return shuffle([{ch:c, type:"答案"}, ...out]);
}

/* 聽音選部件（R6，2026-10-31）的選項：答案＝這個字的部件（第二層，沒有再用第三層；重複照寫，例如森＝木 木 木，選項裡就放 3 張木），
   再加干擾部件，總數至少 6 張（部件多時＝部件數＋2）。干擾部件（不重複）依序用：形近字的部件、這課其他字的部件、所有課本字的部件。
   不放：答案裡已有的部件、這個字第一層的部件（例如清的「青」，選了也說得通，會讓學生疑惑）、完全由答案部件組成的部件（答案有龶、月時不放青）、
   單一筆畫、字型裡沒有的罕用字（超過 U+20000） */
const PICK_MIN = 6, STROKE_PARTS = new Set([..."一丨丿丶乀乙乚乛亅"]);
/* 干擾部件（聽音選部件、聽音補部件共用）：回傳 need 個不重複的部件。ans＝答案部件，visible＝畫面上看得到的部件（聽音補部件沒被遮的那幾塊，也不能當干擾） */
function partDistractors(c, k, ans, need, visible = []){
  const b = splitKey(k)[0], [, shape = ""] = confOf(c, b) || [];
  const bad = new Set([...ans, ...visible, ...((Parts.read(c, {from: 1}) || {parts: []}).parts)]);
  const ok = p => isHan(p) && p.codePointAt(0) < 0x20000 && !STROKE_PARTS.has(p) && !bad.has(p) && !((partsOf(p) || []).length && partsOf(p).every(q => ans.includes(q)));
  const pool = [], seen = new Set();
  const fill = chars => { for(const x of chars){ for(const p of shuffle([...(partsOf(x) || [])])) if(pool.length < need && ok(p) && !seen.has(p)){ seen.add(p); pool.push(p); } if(pool.length >= need) return; } };
  fill(shuffle([...shape]));
  fill(shuffle(charsOf(k).filter(x => x !== c)));
  fill(shuffle(ALL_CHARS.filter(x => x !== c)));
  return pool;
}
function makePartsPickOptions(c, k){
  const ans = partsOf(c) || [], pool = partDistractors(c, k, ans, Math.max(PICK_MIN, ans.length + 2) - ans.length);
  return shuffle([...ans.map(ch => ({ch, type:"答案"})), ...pool.map(ch => ({ch, type:"干擾部件"}))]);
}
/* 聽音補部件（R5，2026-10-31）：畫面上的字被遮住第一層的一塊部件（idx 第幾塊，1 起算），選出被遮的部件，4 選 1（1 個答案、3 個干擾部件）。
   練習每題隨機遮一塊（非包圍的字每一塊都可能被遮，包圍的字只遮裡面）；正式評量固定遮哪一塊的規則見 Parts.mask（先只開放練習）。
   錯誤類型記「選到干擾部件」 */
function makeFillOptions(c, k, idx){
  const ps = Parts.read(c, {from: 1}).parts, ans = ps[idx - 1];
  const pool = partDistractors(c, k, [ans], 3, ps.filter((_, i) => i !== idx - 1));
  return shuffle([{ch: ans, type:"答案"}, ...pool.map(ch => ({ch, type:"選到干擾部件"}))]);
}
const maskedCharHtml = (c, idx) => { const bx = maskBox(c, idx);
  return `<div class="maskedchar" role="img" aria-label="有一塊部件被遮住的字"><span class="mcg">${esc(c)}</span><span class="mhole" style="left:${bx[0] * 100}%;top:${bx[1] * 100}%;width:${(bx[2] - bx[0]) * 100}%;height:${(bx[3] - bx[1]) * 100}%"><i>？</i></span></div>`; };

/* 部件重組的題目：部件打亂成一塊一塊（拆不開的字這個目標不出，見 data.js 的 goalSkips） */
const regroupHtml = c => shuffle([...(partsOf(c) || [])]).map(x => `<span class="ptile">${esc(x)}</span>`).join("");

/* 提示畫面；沒有資料的提示回傳空字串，系統會自動跳到下一個提示 */
const HINT_LEVEL = {word:1, sent:1, pic:2, sound:2, parts:3, mask:3, shape:3};
const TEACHER_BTNS = [[4,"口語提示"],[5,"示範"],[6,"肢體提示"],[7,"完全提示"]];
function hintHtml(id, c, b){
  /* 語詞、句子提示加注音（3-4）：目標字挖空，不會看到它的注音；破音字依 shared/bpmf.js 的讀音 */
  /* 報讀提示：這次有開（G.read）就在語詞、句子提示旁加小喇叭，按了念出完整語詞或句子（見 showNextHint） */
  const read = G && G.read ? `<button class="hspk" data-read="${id}" aria-label="念給我聽">${SPEAKER_SVG}</button>` : "";
  const spk = read ? " withspk" : "";   /* 有喇叭的提示框右邊留位置（舊的 Safari 不支援 :has，所以用 class） */
  if(id === "word"){ const w = wordOf(c, b); return w ? `<div class="h bpmf${spk}">${esc(Bpmf.blank(w, c, "○"))}的○${read}</div>` : ""; }
  if(id === "sent"){ const t = sentOf(c, b); return t ? `<div class="h sent bpmf${spk}">${esc(Bpmf.blank(t, c, "（　）"))}${read}</div>` : ""; }
  if(id === "pic") return PICS[c] ? `<div class="pic" role="img" aria-label="圖片提示">${PICS[c]}</div>` : "";
  if(id === "sound") return `<div class="h">再慢慢唸一次</div>`;
  if(id === "parts"){
    /* 部件（來源與規則見 data.js 的 partsOf）；拆不開的字用黑圓圈遮住字的中心（筆畫太少的字不給，見 HOLE_SKIP），不直接顯示答案。部件重組的題目本身就是部件，不再重複提示 */
    if(G && G.goal === "R4") return "";
    const p = partsOf(c);
    if(p) return `<div class="h">${esc(p.join(" ＋ "))}</div>`;
    return HOLE_SKIP.has(c) ? "" : `<div class="holech" aria-label="遮住中心的字">${esc(c)}</div>`;
  }
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
/* Android 的 Chrome（2026-10-23 維護者用 Samsung A52 測到喇叭沒聲音）：
   cancel() 後馬上 speak() 有時整句被吃掉，所以只有正在唸的時候才 cancel，而且稍等一下再唸；
   唸的句子要留著（lastUtter），不然可能被瀏覽器提早清掉，唸完的通知（onend）不會來 */
let lastUtter = null;
function speak(text, onend, rate, withName){
  const done = () => { const sp = $("#speaker"); if(sp) sp.classList.remove("talk"); if(onend) onend(); };
  if(!("speechSynthesis" in window)){ setTimeout(done, 300); return !withName; }
  const v = withName ? localVoice() : pickVoice();
  if(withName && !v) return false;
  try {
    const busy = speechSynthesis.speaking || speechSynthesis.pending;
    if(busy) speechSynthesis.cancel();
    const u = lastUtter = new SpeechSynthesisUtterance(text);
    u.lang = "zh-TW"; if(v) u.voice = v; u.rate = rate || settings.rate;
    u.onend = u.onerror = done;
    const sp = $("#speaker"); if(sp) sp.classList.add("talk");
    if(busy) setTimeout(() => { if(lastUtter === u) speechSynthesis.speak(u); }, 80); else speechSynthesis.speak(u);
  } catch(e){ setTimeout(done, 300); }
  return true;
}
/* 解鎖聲音（2026-10-24 維護者實測平板一開始沒聲音）：手機、平板（尤其 iPad）要「使用者點下去的那一刻」先發過一次聲音，
   之後隔一段時間才唸（例如等字型下載、播開場動畫）才不會被擋掉。在「開始」按鈕的點擊裡呼叫；一次就好 */
let speechUnlocked = false;
function unlockSpeech(){
  if(speechUnlocked || !("speechSynthesis" in window)) return;
  speechUnlocked = true;
  try { speechSynthesis.resume(); const u = new SpeechSynthesisUtterance(" "); u.volume = 0; u.lang = "zh-TW"; speechSynthesis.speak(u); } catch(e){}
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
  /* 聽音選部件（2026-10-31）：點選卡片的小「啵」聲（選取較高、取消較低）和按「送出」的「滴」聲；跟著「音效」開關，關掉就安靜。不震動（維護者 2026-10-31 決定） */
  tap(on){ if(settings.sfx) note(on ? 700 : 480, 0, 0.07, "triangle", 0.12); },
  send(){ if(settings.sfx) note(880, 0, 0.09, "triangle", 0.14); },
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
  for(const s of ["#setup", "#play", "#result", "#book", "#teacher", "#tabPick"]) $(s).hidden = s !== id;
  window.scrollTo(0, 0);
}

/* ---------- 開始前先下載這次要用的字型（2026-10-23 維護者要求：讀取畫面＋讀取條，平板和電腦都要） ----------
   楷書（TWKai）、注音字型（BpmfKai）切成很多小檔，畫面出現那個字才下載（見 docs/scripts/make_kai.py）。
   第一次打開時，選項會先用別的字型、下載完才換（舊的 Safari 還會排錯位置），所以開始前先把選項會出現的字
   （課次的生字、干擾字；部件重組再加部件）所在的檔下載好；選項加注音時用注音字型。
   語詞、例句只在提示出現，用到才下載：干擾字分散在各本課本，一課的選項就會用到一半以上的字型檔（約 1.5～2.5 MB），
   不要再加上提示，讓第一次的等待太久。 */
function sessionText(lessons, bpmf){
  let kai = "", ruby = "";
  for(const k of lessons){
    const b = splitKey(k)[0];
    for(const c of charsOf(k)){
      const [sound = "", shape = ""] = confOf(c, b) || [], opts = c + sound + shape + (state.goal === "R4" ? (partsOf(c) || []).join("") : state.goal === "R6" ? [c, ...shape].flatMap(x => partsOf(x) || []).join("") : state.goal === "R5" ? [c, ...shape].flatMap(x => (Parts.read(x, {from: 1}) || {parts: []}).parts).join("") : "");
      if(bpmf) ruby += [...opts].map(x => Bpmf.char(x, b)).join(""); else kai += opts;   /* 加注音時選項只用注音字型 */
    }
  }
  return {TWKai:kai, BpmfKai:ruby};
}
/* 字型檔的 unicode-range（例如「U+4E00, U+4E09-4E0B」）有沒有包含要用的字 */
function rangeHits(range, need){
  for(const part of (range || "").split(",")){
    const m = part.trim().match(/^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i);
    if(!m) return true;   /* 看不懂的寫法：當作要下載，比較保險 */
    const lo = parseInt(m[1], 16), hi = m[2] ? parseInt(m[2], 16) : lo;
    if(lo === hi){ if(need.has(lo)) return true; }
    else for(const c of need) if(c >= lo && c <= hi) return true;
  }
  return false;
}
/* 還沒下載、又會用到的字型檔（瀏覽器不支援 document.fonts 就當作不用等） */
function fontsToLoad(texts){
  const list = [];
  if(!document.fonts || !document.fonts.forEach) return list;
  const need = Object.fromEntries(Object.entries(texts).map(([f, s]) => [f, new Set([...s].map(c => c.codePointAt(0)))]));
  document.fonts.forEach(face => {
    const n = need[face.family.replace(/["']/g, "")];
    if(n && face.status !== "loaded" && rangeHits(face.unicodeRange, n)) list.push(face);
  });
  return list;
}
/* 下載這些字型檔，每下載完一個呼叫 onStep(已完成, 全部)；最多等 wait 毫秒（網路很慢時不要卡住，沒下載完的會在背景繼續） */
function loadFonts(faces, onStep, wait = 10000){
  let n = 0;
  onStep(0, faces.length);
  const all = Promise.all(faces.map(f => f.load().catch(() => {}).then(() => onStep(++n, faces.length))));
  return Promise.race([all.then(() => true), new Promise(res => setTimeout(() => res(false), wait))]);
}
/* 讀取畫面的圖片：這次主題的貼紙隨機一張；沒有主題就隨機一個主題 */
function loadPic(theme){
  const ids = Object.keys(Themes.THEMES), id = Themes.THEMES[theme] ? theme : ids[Math.floor(Math.random() * ids.length)];
  const st = Themes.THEMES[id].stickers;
  return Themes.icon(id, st[Math.floor(Math.random() * st.length)][0]);
}
const setBar = (sel, n, all) => { const p = all ? Math.round(n / all * 100) : 100; $(sel + " i").style.width = p + "%"; $(sel).setAttribute("aria-valuenow", p); };
/* 電腦：按「開始」後先下載；都下載過就直接開始。等超過 3 秒的，讀完要再按一次「開始」
   （瀏覽器要「使用者剛點過」才肯唸題目，等太久就不算剛點過） */
function prepareThen(go){
  const faces = fontsToLoad(sessionText(state.lessons, state.kind !== "formal" && !!settings.practiceBpmf));
  if(!faces.length) return go();
  const box = $("#loadSheet"), t0 = performance.now();
  $("#ldGo").hidden = true; $("#ldPic").innerHTML = loadPic(state.theme); setBar("#ldBar", 0, 1); box.hidden = false;
  loadFonts(faces, (n, all) => setBar("#ldBar", n, all)).then(() => {
    const start = () => { box.hidden = true; go(); };
    if(performance.now() - t0 < 3000) return start();
    setBar("#ldBar", 1, 1);   /* 沒下載完（網路很慢）也先讓老師開始，字會慢慢出現 */
    $("#ldGo").hidden = false; $("#ldGo").onclick = start; $("#ldGo").focus();
  });
}

function startSession(){
  const c = current(), q = quizPlan(), list = selKids();
  G = {
    session: Date.now(), cfg: c, q, kids: list,
    goal: state.goal, kind: state.kind, mode: state.mode, answer: state.answer,
    /* 前後測（A8）：只有正式評量才標；練習一律不標 */
    prepost: state.kind === "formal" ? state.prepost : "",
    limit: +state.limit, lessons: [...state.lessons],
    /* 每課考的是哪一組字（只考有教的字）；正式評量用到的字組這時鎖定 */
    ws: wsStart(state.lessons, state.kind),
    noHelp: c.noHelp, rule: c.rule || [], hints: c.hints,
    /* 每位學生這次的提示與答錯規則（進階設定的練習可以每人不同，見 data.js 的 kidCfg） */
    per: Object.fromEntries(list.map(k => { const p = kidCfg(c, k); return [k, {hints: p.hints, rule: p.rule || []}]; })),
    /* 版面：選項卡，或全課賓果卡（只在練習；正式評量、流暢性一律是選項卡，選項版面不能變） */
    choices: bingoOK(c) ? 0 : c.choices === "parts" ? PICK_MIN : +c.choices, layout: bingoOK(c) ? "bingo" : "cards", boards: {}, shared: bingoOK(c) && list.length > 1 && state.answer !== "qr",
    /* 主題（設定第 4 步學生點的，""＝不用主題）、要不要給貼紙；遊戲玩法（3-3 打怪獸：solo 自己打、coop 合作，""＝不玩） */
    theme: state.theme || "", rewards: useRewards(), game: "",
    /* 選項加注音（3-4）：只在練習，第 4 步決定；正式評量一律不加 */
    bpmf: state.kind !== "formal" && !!settings.practiceBpmf && state.goal !== "R6" && state.goal !== "R5",   /* 聽音選部件、聽音補部件的選項是部件，不加注音 */
    /* 報讀提示：練習看第 4 步，正式評量看評量設定；部件重組（4-1）沒有題目讀音，報讀會念出答案，所以一律不開 */
    read: state.goal !== "R4" && state.kind !== "formal" && settings.practiceRead !== false,   /* 正式評量不報讀（A3-10） */
    tally: Object.fromEntries(list.map(k => [k, {n:0, first:0, passed:0, secs:[], wrong:0}])),
    quitArm: false
  };
  G.game = gameFor(G); G.gameType = G.game ? (gameCard(G.theme) || {}).type || "" : "";
  /* 打怪獸的戰利品（大魚、恐龍等）開始前就決定好，打敗怪獸後就是這次的貼紙 */
  if(G.game) G.prize = Themes.drawSticker(G.theme);
  $("#play").dataset.multi = list.length > 1 ? "1" : "";   /* 多位學生：「輪到誰」放大放中間（CSS 的 data-multi） */
  G.coopSame = settings.coopSame !== false;   /* 合作時全組同一張貼紙（細部設定，預設是）；開始時記下來，玩到一半改設定不影響這一次 */
  applySkin(G.theme, G.kind !== "formal");
  $("#pScene").hidden = true; $("#pScene").innerHTML = ""; $("#pBody").hidden = false;
  startClockShow();
  if(G.mode === "flu"){ G.turn = 0; showScreen("#play"); showReady(); return; }
  /* 正確率模式：每位學生各抽一份題目，再交錯排成輪流順序 */
  /* 賓果卡整次只有一張、最多 36 格、一個字只有一格：同一個字出現在好幾課時只問一次（否則第二次那一格已蓋章點不了），
     每位學生最多出 36 題（否則多出來的字不在卡上） */
  const lists = list.map(code => {
    const items = pickItems(code, q), seen = new Set();
    return (G.layout === "bingo" ? items.filter(it => !seen.has(it.c) && seen.add(it.c)).slice(0, 36) : items).map(it => ({...it, kid:code}));
  });
  G.queue = G.shared ? (q.method === "weak" ? sharedBingoQueue(lists) : sharedBingoDraw(list, q)) : interleaveLists(lists);
  G.pos = 0;
  showScreen("#play");
  if(G.game) return partnerOn(G) ? pickPartners(() => { G.started = performance.now(); sceneStart(nextItem); })   /* 選夥伴的時間不算進右上角的計時 */ : sceneStart(nextItem);
  nextItem();
}

/* 賓果共用一張卡（E15）：卡最多 36 格、一個字只有一格，所以全隊合計最多 36 題。
   大家選的課本和生字一樣，所以全隊統一抽一次（題數是每人題數×人數，不超過 36），同一個字只留一次，再輪流分給每位學生；
   只有「常錯優先」要看每位學生自己的紀錄，改成各抽一份再合併（sharedBingoQueue：輪流各拿自己名單裡下一個還沒出現過的字） */
function sharedBingoDraw(kidCodes, q){
  const n = kidCodes.length, seen = new Set();
  const team = {...q, count: Math.min(36, q.count * n), freqN: q.freqN * n, per: new Map([...q.per].map(([k, v]) => [k, v * n]))};
  return pickItems(kidCodes[0], team).filter(it => !seen.has(it.c) && seen.add(it.c)).slice(0, 36).map((it, i) => ({...it, kid: kidCodes[i % n]}));
}
function sharedBingoQueue(lists){
  const seen = new Set(), out = [], at = lists.map(() => 0);
  for(let moved = true; moved && out.length < 36;){
    moved = false;
    lists.forEach((l, n) => {
      while(at[n] < l.length && out.length < 36){
        const it = l[at[n]++];
        if(seen.has(it.c)) continue;
        seen.add(it.c); out.push(it); moved = true; break;
      }
    });
  }
  return out;
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
const whoHtml = code => { const k = kidBy(code); return `${Rewards.avatarHtml(code)}輪到 ${esc(k ? kidShow(k) : code)}`; };
function drawBar(it){
  /* 大家共用一張賓果卡：輪到誰改放在卡片正上方中間（newItem 畫），上方列不重複顯示 */
  const w = $("#pWho"); w.innerHTML = whoHtml(it.kid); w.hidden = sharedTurns() || (G.answer === "splitturn" && G.kids.length > 1);   /* 分區輪流：輪到的那一區自己有黃色大名字，上方不重複 */
  if(G.mode === "flu") $("#pProg").textContent = `答對 ${G.round.correct} 個`;
  else { const mine = G.queue.filter(x => x.kid === it.kid), idx = mine.indexOf(it) + 1; $("#pProg").textContent = `第 ${idx} / ${mine.length} 題`; }
}

const sharedTurns = () => G.shared && G.kids.length > 1;
function nextItem(){
  if(G.over) return;   /* 已經按「結束」了，不要再出題（避免結果畫面還在唸題目） */
  if(G.pos >= G.queue.length) return G.game ? sceneWin() : finish();
  const it = G.queue[G.pos], prev = G.queue[G.pos - 1];
  /* 多人輪流時，換到另一位學生先出現換人畫面 */
  if(G.kids.length > 1 && (!prev || prev.kid !== it.kid)){
    /* 分區輪流（E14）：不跳換人過場，直接亮起下一位的區；換人時只播一聲提示音（維護者 2026-10-25） */
    if(G.answer === "splitturn"){ if(prev) sfx.turn(); return newItem(it); }
    /* 大家共用一張賓果卡：不跳換人過場（卡片不會消失），只換卡片上方的名字、播換人提醒（維護者 2026-10-26） */
    if(sharedTurns()){ if(prev) turnAlert(it.kid, false); return newItem(it); }
    return turnCard(it.kid, !prev, () => newItem(it));
  }
  newItem(it);
}

/* ---------- 3-1 換人過場 ----------
   畫面中間放大頭像和大字「換 ○○」，播提示音（或依設定唸名字），停約 1.6 秒再出題，讓學生有時間換位置。
   計時從題目唸完才開始，這段停頓不會算進反應時間。正式評量、練習都一樣。 */
const TURN_MS = 1600;
function turnCard(code, first, then){
  const k = kidBy(code), name = k ? kidShow(k) : code, g = G;
  const w = $("#pWho"); w.hidden = false; w.innerHTML = whoHtml(code);
  $("#pProg").textContent = "";
  $("#pBody").innerHTML = `<div class="turncard" role="status"><div class="turnav">${Rewards.avatarHtml(code)}</div>
    <h2>${first ? `先從 ${esc(name)} 開始` : `換 ${esc(name)}`}！</h2><p class="note" style="margin:0">請 ${esc(name)} 準備好</p></div>`;
  turnAlert(code, first);
  setTimeout(() => { if(G === g && !g.over) then(); }, TURN_MS);
}
/* 換人提醒：提醒方式看「畫面與聲音」的設定，預設只有提示音，選了才唸名字 */
function turnAlert(code, first){
  const k = kidBy(code), name = k ? kidShow(k) : code, g = G;
  const style = settings.turnStyle || "chime";
  if(style === "chime" || style === "both") sfx.turn();
  /* 唸名字只用本機語音；這台電腦沒有本機中文語音時改成提示音（「唸出名字」那一種原本沒有提示音） */
  if(style === "voice" || style === "both") setTimeout(() => { if(G === g && !g.over && !speak(`${first ? "先從" : "換"}${name}`, null, null, true) && style === "voice") sfx.turn(); }, style === "both" ? 450 : 0);
}

/* ---------- 3-2 全課賓果卡（只在練習） ----------
   選的所有課要考的字一起排成賓果卡（不夠排滿就用別課的字補），聽到哪個字就點哪個。
   答對的格子蓋上學生的頭像，連成一條線（橫、直、斜）會跳出「連線！」。每位學生整次作答只有一張固定的卡，換課不會換卡。 */
const bingoOK = c => c.choices === "bingo" && !c.formal && !c.flu;
const gridFor = n => n <= 9 ? [3,3] : n <= 16 ? [4,4] : n <= 20 ? [5,4] : n <= 25 ? [5,5] : n <= 30 ? [6,5] : [6,6];
function bingoBoard(kid){
  const id = G.shared ? "shared" : kid;
  if(!G.boards[id]){
    /* 這位學生要考的字（題目最多 36 題，見 startSession）加上每一課要考的所有字 */
    const mine = G.shared ? G.queue : G.queue.filter(x => x.kid === kid);
    const own = [...new Set([...mine.map(x => x.c), ...mine.flatMap(x => testChars(x.k))])].slice(0, 36), [cols, rows] = gridFor(own.length);
    const fill = shuffle(ALL_CHARS.filter(c => !own.includes(c))).slice(0, cols * rows - own.length);
    const lines = [];
    for(let r = 0; r < rows; r++) lines.push(Array.from({length:cols}, (_, c) => r * cols + c));
    for(let c = 0; c < cols; c++) lines.push(Array.from({length:rows}, (_, r) => r * cols + c));
    if(rows === cols){ lines.push(Array.from({length:rows}, (_, i) => i * cols + i)); lines.push(Array.from({length:rows}, (_, i) => i * cols + cols - 1 - i)); }
    G.boards[id] = {cells: shuffle([...own, ...fill]), cols, rows, lines, marks:new Set(), done:new Set(), by:{}};
  }
  return G.boards[id];
}
/* 賓果卡上每個字和目標字的關係，用來記錄「錯誤類型」。
   老師專區錯誤類型的「亂猜會佔」也用它替舊紀錄的每個選項重新分類，那時用 goal 傳入紀錄當時的評量目標 */
function optType(c, x, k, goal = G && G.goal){
  if(goal === "R6") return (partsOf(c) || []).includes(x) ? "答案" : "干擾部件";   /* 聽音選部件：選項是部件，只分答案和干擾部件 */
  if(goal === "R5") return ((Parts.read(c, {from: 1}) || {parts: []}).parts).includes(x) ? "答案" : "選到干擾部件";   /* 聽音補部件：同上（紀錄實際用 makeFillOptions 的 type） */
  const b = splitKey(k)[0], [sound = "", shape = ""] = confOf(c, b) || [];
  if(x === c) return "答案";
  if(goal === "R4"){   /* 部件重組：沒有唸題目，只分形近、同部件 */
    if(shape.includes(x)) return "形近";
    if((partsOf(x) || []).some(p => (partsOf(c) || []).includes(p))) return "同部件";
    return charsOf(k).includes(x) ? "課文字" : "其他字";
  }
  if(wordOf(c, b).includes(x)) return "同詞易混";
  if(sound.includes(x)) return "同音";
  if(shape.includes(x)) return "形近";
  return charsOf(k).includes(x) ? "課文字" : "其他字";
}

/* 準備一題：組選項、畫畫面、唸題目；唸完才開始計時 */
/* 舊的 Safari（iOS 15 以前，例如 iPad Air 2，2026-10-23 維護者實測選項變很小）不支援 CSS 的 cqw、cqh：
   量出選項區的寬高交給 CSS（index.html 的 @supports not (width:1cqw)），畫面大小改變時重新量 */
const NO_CQ = !(window.CSS && CSS.supports && CSS.supports("width", "1cqw"));
const optsRO = NO_CQ && window.ResizeObserver ? new ResizeObserver(() => fitOpts()) : null;
function fitOpts(){
  const box = NO_CQ && $("#pBody .optsbox:not(.ghostbox)"), o = box && box.querySelector(".opts");
  if(!o) return;
  o.style.setProperty("--bw", box.clientWidth + "px"); o.style.setProperty("--bh", box.clientHeight + "px");
  if(optsRO){ optsRO.disconnect(); optsRO.observe(box); }
}
if(NO_CQ && !optsRO) addEventListener("resize", fitOpts);
/* 舊的 Safari：字型（例如注音字型）下載完以後沒有重新排版，選項的字會偏右、注音被切掉（2026-10-23 iPad Air 2 實測）。
   字型下載完就讓選項重新排一次 */
if(document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", () => {
  const o = $("#pBody .opts"); if(!o) return;
  o.style.display = "none"; void o.offsetHeight; o.style.display = "";
});
function newItem(it){
  const b = splitKey(it.k)[0], board = G.layout === "bingo" ? bingoBoard(it.kid) : null;
  const regroup = G.goal === "R4";   /* 目標 4-1 部件重組：看部件選字，不唸題目 */
  const pickParts = G.goal === "R6";   /* 聽音選部件：聽音，選出全部部件（複選），按「送出」才算作答 */
  const fillPart = G.goal === "R5";    /* 聽音補部件：聽音，畫面上的字被遮住一塊部件，4 選 1 */
  const maskAt = fillPart ? (() => { const l = maskIdxs(it.c); return l[Math.floor(Math.random() * l.length)]; })() : 0;
  G.cur = {it, b, board, opts: board ? board.cells.map(ch => ({ch, type: optType(it.c, ch, it.k)})) : pickParts ? makePartsPickOptions(it.c, it.k) : fillPart ? makeFillOptions(it.c, it.k, maskAt) : (regroup ? makePartsOptions : makeOptions)(it.c, it.k, G.choices),
           maskAt,
           wrong:0, firstPick:null, firstSec:null, shown:[], hintPos:0, teacher:0, reads:new Set(), t0:null, tShown:performance.now(), done:false,
           sel:[], locked:new Set()};   /* 聽音選部件：sel＝正在選的卡（第幾張）、locked＝已經確定對的卡 */
  drawBar(it);
  const split = G.answer === "splitturn" && G.kids.length > 1;   /* 分區輪流：每區只有螢幕的 1/2～1/3 寬，選項一律 2 欄 */
  const nOpts = G.cur.opts.length;
  const cols = board ? board.cols : split || (!pickParts && G.choices === 4) ? 2 : 3, rows = board ? board.rows : Math.ceil(nOpts / cols);
  const stampOf = i => `<span class="stamp2" aria-hidden="true">${Rewards.avatarHtml(board.by[i] || it.kid)}</span>`;   /* 共用一張卡時，每一格蓋答對那位學生的頭像 */
  const cellClass = i => !board ? "" : board.marks.has(i) ? ` marked${[...board.done].some(L => board.lines[L].includes(i)) ? " win" : ""}` : "";
  const stageHtml = `<div class="stage">
      <div class="prompt${pickParts ? " pick" : ""}${fillPart ? " fill" : ""}">
        ${fillPart ? maskedCharHtml(it.c, maskAt) : ""}
        ${regroup ? `<div class="pieces big" aria-label="拆開的部件">${regroupHtml(it.c)}</div>
        <span class="note" style="margin:0">這些部件組成哪一個字？</span>`
        : `<button class="speaker" id="speaker" aria-label="再聽一次">${SPEAKER_SVG}</button>
        <span class="note" style="margin:0">${pickParts ? "聽聽看，這個字有哪些部件？全部選出來，再按「送出」" : fillPart ? "聽聽看，被遮住的是哪一個部件？" : "聽聽看，是哪一個字？"}</span>
        ${pickParts ? `<div class="submitrow"><button class="submit" id="submitParts" disabled>送出</button><span class="note" id="pickNote" style="margin:0" aria-live="polite"></span></div>` : ""}`}
        <div class="hintbox" id="hintbox" aria-live="polite"></div>
      </div>
      <div class="optsbox"><div class="opts ${board ? "bingo" : ""}" style="--cols:${cols};--rows:${rows}">
        ${G.cur.opts.map((o, i) => `<button class="opt-big${cellClass(i)}${G.bpmf ? " bpmf" : ""}" data-i="${i}" ${board && board.marks.has(i) ? "disabled" : ""}><span class="och">${esc(G.bpmf ? Bpmf.char(o.ch, b) : o.ch)}</span>${board && board.marks.has(i) ? stampOf(i) : ""}</button>`).join("")}
      </div></div>
    </div>`;
  /* 分區輪流（E14）：每位學生一區並排，輪到的那一區亮起、有題目和選項，其他區變暗、選項只剩空框。
     每區大小固定，換人時學生不用換位置看；其他區只留名字和進度，讓等待的人知道自己還要做幾題 */
  const zoneHtml = code => {
    const k = kidBy(code), mine = G.queue.filter(x => x.kid === code), on = code === it.kid;
    const idx = on ? mine.indexOf(it) + 1 : mine.filter(x => G.queue.indexOf(x) < G.pos).length;
    const head = `<div class="zhead">${Rewards.avatarHtml(code)}<b>${esc(k ? kidShow(k) : code)}</b><span>${on ? `第 ${idx} / ${mine.length} 題` : `已做 ${idx} / ${mine.length} 題`}</span></div>`;
    if(on) return `<section class="zone on" aria-current="true">${head}${stageHtml}</section>`;
    return `<section class="zone wait">${head}<div class="stage"><div class="prompt"><span class="zwait">等一下</span></div>
      <div class="optsbox ghostbox"><div class="opts" style="--cols:${cols};--rows:${rows}">${Array.from({length:nOpts}, () => `<span class="opt-ghost"></span>`).join("")}</div></div></div></section>`;
  };
  const banner = sharedTurns() ? `<div class="turnbanner" role="status"><div class="who">${whoHtml(it.kid)}</div></div>` : "";
  $("#pBody").innerHTML = `${banner}${split ? `<div class="zones" style="--n:${G.kids.length}">${G.kids.map(zoneHtml).join("")}</div>` : stageHtml}
    ${G.mode === "flu" || TABLET ? "" : `<div class="tbar" data-side="${settings.hintSide === "left" ? "left" : "right"}"><span>老師提示紀錄</span>${TEACHER_BTNS.map(([lv, t]) => `<button class="chip" data-t="${lv}">${t}</button>`).join("")}</div>`}`;
  fitOpts();
  if(pickParts){ fitPickGrid(); requestAnimationFrame(fitPickGrid); }
  $("#pBody").querySelectorAll(".opt-big").forEach(btn => btn.onclick = () => pickParts ? togglePart(+btn.dataset.i, btn) : pick(+btn.dataset.i, btn));
  if(pickParts) $("#submitParts").onclick = submitParts;
  if(!regroup) $("#speaker").onclick = () => speak(promptOf(it));
  $("#pBody").querySelectorAll("[data-t]").forEach(btn => btn.onclick = () => {
    G.cur.teacher = Math.max(G.cur.teacher, +btn.dataset.t); btn.classList.add("on");
  });
  if(regroup){ G.cur.t0 = performance.now(); return; }   /* 部件重組沒有唸題目：畫面出現就開始計時 */
  const startClock = () => { if(G && G.cur && G.cur.it === it && !G.cur.t0) G.cur.t0 = performance.now(); };
  speak(promptOf(it), startClock);
  setTimeout(startClock, 6000);   /* 萬一這台電腦沒有語音，6 秒後也開始計時 */
}

/* 學生點了一個選項 */
function pick(i, btn){
  const cur = G.cur;
  if(!cur || cur.done || btn.disabled) return;
  /* 正式評量（正確率模式）：新的一題出現後 0.7 秒內不收點選，免得學生連點太快，把下一題的答案也點到（維護者 2026-10-25） */
  if(G.kind === "formal" && G.mode !== "flu" && performance.now() - cur.tShown < 700) return;   /* 流暢性要連續快點，不鎖 */
  const o = cur.opts[i], sec = Math.round((performance.now() - (cur.t0 || cur.tShown)) / 100) / 10;
  if(cur.firstPick === null){ cur.firstPick = o; cur.firstSec = sec; }
  /* 練習的選項卡：答對、答錯在選項右上角跳出大大的綠勾、紅叉。
     正式評量不回饋對錯（A3-7、A3-8，2026-10-25）：不變色、不搖動、沒有動畫、沒有對錯音效，選了的選項只是淡淡標示 */
  const fb = G.kind !== "formal";
  if(fb && G.layout === "cards") btn.classList.add("fx");
  if(o.type === "答案"){
    if(fb){ btn.classList.add("right"); btn.insertAdjacentHTML("beforeend", BURST); sfx.right(); } else btn.classList.add("picked");
    if(cur.board) bingoMark(i);
    return endItem(true, sec);
  }
  cur.wrong++;
  if(fb){ btn.classList.add("wrong", "shake"); sfx.wrong(); } else btn.classList.add("picked");
  btn.disabled = true;
  if(G.mode === "flu" || G.noHelp) return endItem(false, null);
  const act = G.per[cur.it.kid].rule[cur.wrong - 1] || "free";   /* 規則沒寫到的次數：不處理，讓學生自己點（答案選項一直都在） */
  if(act === "next") showNextHint();
  if(act === "reveal") reveal();
}

/* 聽音選部件：把選項排成「卡片最大」的行列數（2026-10-31 維護者反映分區作答時選項太小、下方版面沒填滿）。
   選項 6～7 張，區的寬高每次不一樣（學生人數、螢幕大小），所以畫好之後量選項區，從 1 欄到全部一欄一欄試，取每張卡邊長最大的行列數 */
function fitPickGrid(){
  if(!G || G.goal !== "R6" || !G.cur) return;
  const box = $("#pBody .optsbox:not(.ghostbox)"); if(!box) return;
  const n = G.cur.opts.length, w = box.clientWidth, h = box.clientHeight, gap = 16;
  if(!w || !h) return;
  let best = null;
  for(let c = 1; c <= n; c++){
    const r = Math.ceil(n / c), cell = Math.min((w - (c - 1) * gap) / c, (h - (r - 1) * gap - 10) / r);
    if(!best || cell > best.cell + 0.5) best = {c, r, cell};
  }
  $("#pBody").querySelectorAll(".opts").forEach(o => { o.style.setProperty("--cols", best.c); o.style.setProperty("--rows", best.r); });
}
window.addEventListener("resize", () => { if(G && G.goal === "R6") fitPickGrid(); });

/* 聽音選部件（R6，2026-10-31）：點一下選取、再點一下取消；按「送出」才算作答；全部選對才算對（維護者 2026-10-31 決定）。
   送出後：選對的卡鎖住（綠色）、選錯的卡（干擾部件，或同一個部件選太多張）打叉不能再選，學生繼續選剩下的再送出；答錯規則照現有的（提示、顯示答案）。
   紀錄：第一次送出的結果記在 firstPick、firstCorrect、errorType（少選、選到干擾部件）；最後送出的選擇記在 pickSet，這題的答案記在 answerSet（見 endItem）。
   聽音選部件先只開放練習（設定第 1 步擋住正式評量），所以一律有對錯回饋。 */
const answerParts = () => G.cur.opts.filter(o => o.type === "答案").map(o => o.ch);
function togglePart(i, btn){
  const cur = G.cur;
  if(!cur || cur.done || btn.disabled || cur.locked.has(i)) return;
  const at = cur.sel.indexOf(i);
  if(at >= 0){ cur.sel.splice(at, 1); btn.classList.remove("sel", "pop"); btn.setAttribute("aria-pressed", "false"); sfx.tap(false); }
  else { cur.sel.push(i); btn.classList.add("sel"); btn.setAttribute("aria-pressed", "true"); sfx.tap(true); btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop"); }   /* 選取時彈一下 */
  const go = $("#submitParts"); if(go) go.disabled = !cur.sel.length;
}
function submitParts(){
  const cur = G.cur;
  if(!cur || cur.done || !cur.sel.length) return;
  sfx.send();
  const sec = Math.round((performance.now() - (cur.t0 || cur.tShown)) / 100) / 10;
  const left = {};
  answerParts().forEach(p => left[p] = (left[p] || 0) + 1);
  cur.locked.forEach(i => left[cur.opts[i].ch]--);
  const good = [], bad = [];
  for(const i of cur.sel){ const p = cur.opts[i].ch; if(left[p] > 0){ left[p]--; good.push(i); } else bad.push(i); }
  const miss = Object.values(left).reduce((a, n) => a + n, 0), ok = !bad.length && !miss;
  const card = i => $(`#pBody .opt-big[data-i="${i}"]`);
  cur.final = [...cur.locked, ...cur.sel];   /* 這次送出後，畫面上選的全部（記進 pickSet） */
  if(cur.firstPick === null){ cur.firstPick = {ch: cur.sel.map(i => cur.opts[i].ch).join(""), type: ok ? "答案" : bad.length ? "選到干擾部件" : "少選"}; cur.firstSec = sec; }
  good.forEach(i => { const b = card(i); b.classList.remove("sel"); b.classList.add("right", "fx"); b.disabled = true; cur.locked.add(i); });
  cur.sel = [];
  if(ok){ card(good[good.length - 1]).insertAdjacentHTML("beforeend", BURST); sfx.right(); return endItem(true, sec); }
  cur.wrong++;
  bad.forEach(i => { const b = card(i); b.classList.remove("sel"); b.classList.add("wrong", "fx", "shake"); b.disabled = true; });
  sfx.wrong();
  const go = $("#submitParts"); if(go) go.disabled = true;
  const note = $("#pickNote"); if(note) note.textContent = bad.length ? (miss ? "打叉的不是這個字的部件，再選選看" : "多選了不是這個字的部件（打叉的）") : `還有 ${miss} 個部件沒選到`;
  /* 答案部件都選到了、但多選了干擾部件：沒有東西可以再選，這題算錯，直接進下一題（不然「送出」按不了，會卡住；維護者 2026-10-31） */
  if(!miss) return endItem(false, null);
  if(G.mode === "flu" || G.noHelp) return endItem(false, null);
  const act = G.per[cur.it.kid].rule[cur.wrong - 1] || "free";
  if(act === "next") showNextHint();
  if(act === "reveal") reveal();
}

/* 賓果卡蓋章、檢查有沒有新的連線 */
function bingoMark(i){
  const B = G.cur.board;
  B.marks.add(i); B.by[i] = G.cur.it.kid;
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
  const cur = G.cur, hints = G.per[cur.it.kid].hints;
  while(cur.hintPos < hints.length){
    const id = hints[cur.hintPos++], html = hintHtml(id, cur.it.c, cur.b);
    if(!html) continue;
    cur.shown.push(id);
    $("#hintbox").insertAdjacentHTML("beforeend", html);
    /* 報讀：按小喇叭念出完整語詞（例如「努力的努」）或整句，並記下按過哪一種 */
    $("#hintbox").querySelectorAll(`[data-read="${id}"]`).forEach(btn => btn.onclick = () => {
      if(cur.done) return;
      cur.reads.add(id); speak(id === "word" ? sayOf(cur.it.c, cur.b) : Bpmf.sayText(sentOf(cur.it.c, cur.b)));
    });
    if(id === "sound") speak(promptOf(cur.it), null, Math.max(0.5, settings.rate - 0.25));
    return;
  }
}

/* 顯示答案並唸一次，這題記為沒通過 */
function reveal(){
  const cur = G.cur;
  if(G.goal === "R6"){   /* 聽音選部件：全部答案部件都框起來 */
    cur.final = cur.final || [...cur.locked, ...cur.sel];
    cur.opts.forEach((o, i) => { if(o.type === "答案"){ const b = $(`#pBody .opt-big[data-i="${i}"]`); if(b) b.classList.add("show"); } });
    speak(promptOf(cur.it));
    return endItem(false, null, true);
  }
  const i = cur.opts.findIndex(o => o.type === "答案");
  const btn = $(`#pBody .opt-big[data-i="${i}"]`); if(btn) btn.classList.add("show");
  speak(promptOf(cur.it));
  endItem(false, null, true);
}

/* 一題結束：存紀錄，然後進下一題 */
function endItem(passed, correctSec, revealed){
  const cur = G.cur; cur.done = true;
  $("#pBody").querySelectorAll(".opt-big").forEach(b => b.disabled = true);
  const it = cur.it, [b, n] = splitKey(it.k), k = kidBy(it.kid) || {};
  const sysLevel = Math.max(0, ...cur.shown.map(id => HINT_LEVEL[id]));
  const rec = {
    fmt: RECORD_FORMAT, device: deviceType(),   /* 紀錄格式版本、作答的裝置類型（見 data.js） */
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
    prepost: G.prepost, daysAfter: daysAfterEnd(key(b,n), it.kid),   /* 前後測；教學後天數（教學結束當天＝0） */
    planId: "", planVer: "", rphase: "",   /* 研究計畫代號、版本、研究時期（研究計畫做出來前都是空白，A8 第 6、17 點） */
    /* 當時的條件（研究用的進階分析會用到）：提示設定、答錯規則用代碼存，Excel 再翻成中文 */
    hintSet: G.per[it.kid].hints.join(","), rule: G.noHelp ? "none" : G.per[it.kid].rule.join(","), layout: G.layout,
    theme: G.theme, game: G.game, gameType: G.gameType, reward: "", rewardCode: "", bpmf: !!G.bpmf,   /* 抽到的貼紙：文字和代號（做完時由 collect.js 的 drawStickers 填）*/
    read: !!G.read, readUsed: [...cur.reads].map(id => ({word:"語詞", sent:"句子"})[id]).join("、"),   /* 報讀：這次有沒有開、這題按了哪幾種提示的喇叭 */
    fontScale: settings.fontScale, rate: settings.rate, sfx: settings.sfx,
    clock: !!G.clock,                      /* 作答時右上角有沒有顯示計時 */
    /* 聽音選部件（R6，2026-10-31）：這題的答案部件、最後送出的選擇（部件，空格分開，重複照寫）、答案部件取自第幾層（部件資料之後會改，所以記當時的） */
    /* 聽音補部件（R5，2026-10-31）：被遮的部件記在 answerSet、取自第 1 層，另記被遮的是第幾塊、字的結構（結構之後老師會改，所以記當時的） */
    ...(G.goal === "R5" ? {answerSet: cur.opts.find(o => o.type === "答案").ch, partsLayer: 1, maskIdx: cur.maskAt, maskStruct: Parts.struct(it.c)} : {}),
    ...(G.goal === "R6" ? {answerSet: answerParts().join(" "), pickSet: (cur.final || [...cur.locked, ...cur.sel]).map(i => cur.opts[i].ch).join(" "), partsLayer: (Parts.read(it.c, {from: 2}) || {}).layer || ""} : {}),
    ...G.ws[it.k]   /* 只考有教的字：ws＝第幾組（""＝整課，"p"＝練習自己點的）、wsChars＝這課考的字、wsAll＝整課幾個字 */
  };
  saveRecord(rec);
  /* 打怪獸：做完幾題、前進幾格（練習＝第一次就答對的題數；正式評量維持原本「每題都前進」，等 A3 討論） */
  if(G.game){ G.doneN++; if(rec.firstCorrect || G.kind === "formal"){ G.hits++; G.blockHits++; } }
  const t = G.tally[it.kid];
  t.n++; if(rec.firstCorrect) t.first++; if(passed){ t.passed++; t.secs.push(correctSec); } else t.wrong++;
  if(G.mode === "flu"){
    if(rec.firstCorrect) G.round.correct++; else G.round.wrong++;
    $("#pProg").textContent = `答對 ${G.round.correct} 個`;
    /* 只接著出「這一回合」的下一題：回合結束後換下一位很快按開始時，不會多出一題到別人的回合 */
    const g = G, rd = G.round;
    setTimeout(() => { if(G === g && g.round === rd && !rd.over) newItem(nextFluItem()); }, rec.firstCorrect ? 300 : 600);
    return;
  }
  G.pos++;
  const g = G;
  setTimeout(() => { if(G !== g || g.over) return; if(g.game && g.pos < g.queue.length && g.doneN % sceneEvery() === 0) sceneBeat(it.kid, nextItem); else nextItem(); },
    passed ? (cur.line ? 1800 : 900) : revealed ? 2200 : 1000);
}

/* ---------- 3-3 打怪獸 ----------
   正確率模式、選項卡、有選主題才可以玩；練習看第 4 步的玩法（預設打怪獸），正式評量看評量設定（預設不玩）。
   一位學生＝自己打（solo）；多位學生輪流、第 3 步選合作＝大家合作打同一隻（coop）；多位學生各玩各的還不能玩。
   遊戲分對抗類、建築類（data.js 的 GAME_CARDS），紀錄的 gameType 記是哪一類。
   場景只在「題目之間」出現：開始前一段、每做完幾題一段（固定 1.8 秒），最後一題做完是打敗怪獸。
   幾題一段看細部設定的 sceneEvery（預設 3 題，2026-10-22 維護者決定：每題都跳會打斷注意力）；合作時算全隊輪流的題數。
   以下只改練習；正式評量不玩遊戲（A3-16，2026-10-25 維護者決定：各玩各的做出來前先停用）。
   前進多少＝這幾題「第一次就答對」的題數（答對 3 題疊 3 層蛋糕）；都沒答對就播各主題的「再加油」動畫、不前進。
   最後一律打敗怪獸、拿到貼紙（鼓勵參與），但蛋糕高度、外星人剩的血，照答對的題數呈現。
   作答時看不到場景，選項的版面和沒玩時完全一樣。 */
const SCENE_MS = 1800;
/* Excel 的「遊戲玩法」：game＝個人 solo／合作 coop，gameType＝對抗類 fight／建築類 build（2026-10-24 起才有，以前都叫打怪獸） */
const TEAM_NAME = {solo:"個人", coop:"合作"};
const gameName = r => !r.game ? "無" : `${r.gameType ? `遊戲・${GAME_TYPES[r.gameType] || r.gameType}` : "打怪獸"}（${TEAM_NAME[r.game] || r.game}）`;
const gameAllowed = () => state.mode === "acc" && !bingoOK(current());
function gameFor(g){
  if(g.mode !== "acc" || g.layout !== "cards" || !g.theme || !window.Scenes || !Scenes[g.theme]) return "";
  if(g.kind === "formal" || playNow() !== "game") return "";   /* 正式評量不玩遊戲（A3-16） */
  return g.kids.length < 2 ? "solo" : "coop";   /* 多位學生玩遊戲就是大家合作（各玩各的的遊戲還沒做） */
}
const sceneEvery = () => +settings.sceneEvery || 3;
/* 場景上方的一行字：答對 k 題時做了什麼；都沒答對時的「再加油」 */
const SCENE_ACT = {ocean: k => `把大魚拉近 ${k} 格`, space: k => `命中外星人 ${k} 次`, dino: k => `敲了恐龍蛋 ${k} 下`, dessert: k => `疊了 ${k} 層蛋糕`};
const SCENE_MISS = {ocean:"大魚掙扎了一下，再加油！", space:"外星人反擊了，再加油！", dino:"恐龍蛋還沒動靜，再加油！", dessert:"哎呀，蛋糕歪了，再加油！"};
/* 切換作答畫面與場景；cap＝場景上方的一行字（可以帶頭像） */
function showScene(on, cap = "", code = "", team = ""){
  $("#pBody").hidden = on; $("#pScene").hidden = !on;
  if(on) $("#sceneCap").innerHTML = `${team || (code ? Rewards.avatarHtml(code) : "")}<span>${esc(cap)}</span>`;
}
/* ---------- 貼紙夥伴（練習的打怪獸加強，2026-10-26 維護者決定；第一版沒有按鈕互動） ----------
   細部設定打開「貼紙夥伴出場」才有；只有太空、恐龍（GAME_CARDS 的 partner）：海洋是釣魚、甜點是做蛋糕，不用夥伴攻擊（2026-10-26 維護者決定）；平板沒有貼紙收藏（D3），不出場。
   開始前輪流請有貼紙的學生點自己貼紙簿裡的貼紙當夥伴，沒有貼紙的用預設那張；過場時夥伴出現在怪獸下方。
   攻擊特效依星等不同，只是外觀：打到幾格還是看第一次就答對幾題（g.blockHits），夥伴不影響分數和紀錄。 */
const partnerOn = g => !!(g.game && settings.partner && !TABLET && (gameCard(g.theme) || {}).partner);
const defaultPartner = theme => Math.max(0, (Themes.LISTS[theme] || []).findIndex(d => d.stars === 1 && !d.evo));
const FX_COUNT = {1:3, 2:6, 3:10, 4:16};   /* 星等越高，火花越多；光環、光暈、光柱在 CSS（.pt.t2～t4） */
const FX_RINGS = {1:0, 2:1, 3:2, 4:3};
function pickPartners(then){
  const g = G;
  g.partner = Object.fromEntries(g.kids.map(c => [c, defaultPartner(g.theme)]));
  const todo = g.kids.filter(c => Rewards.owned(c, g.theme).length);
  const next = () => {
    if(G !== g || g.over) return;
    const code = todo.shift(); if(code === undefined) return then();
    const k = kidBy(code), th = g.theme;
    const own = [...new Set(Rewards.owned(code, th))].sort((a, b) => Themes.stars(th, b) - Themes.stars(th, a) || a - b);
    const w = $("#pWho"); w.hidden = false; w.innerHTML = whoHtml(code);   /* 上方和下面都標出輪到誰，不然不知道換誰選 */
    $("#pProg").textContent = "";
    $("#pBody").innerHTML = `<div class="ready"><div class="turnav">${Rewards.avatarHtml(code)}</div><h2>${esc(k ? kidShow(k) : code)}，選一個夥伴一起打怪獸！</h2>
      <div class="pickrow">${own.map(i => `<button class="pickp" data-i="${i}">${Themes.stickerSvg(th, i)}<span>${esc(Themes.THEMES[th].stickers[i][1])}</span><b>${"★".repeat(Themes.stars(th, i))}</b></button>`).join("")}</div></div>`;
    $("#pBody").querySelectorAll(".pickp").forEach(b => b.onclick = () => { g.partner[code] = +b.dataset.i; next(); });
  };
  next();
}
/* 怪獸下方的夥伴列：stand＝站著等、hit＝出擊（依星等放特效）、miss＝沒打中、休息一下 */
function showPartners(kids, mode){
  const g = G, box = $("#pScene"); if(!g.partner) return;
  const old = box.querySelector(".partners"); if(old) old.remove();
  box.insertAdjacentHTML("beforeend", `<div class="partners ${mode}">${kids.map(c => {
    const i = g.partner[c], st = Themes.stars(g.theme, i) || 1;
    const fx = mode === "hit" ? `<span class="beam"></span><span class="fx"><u></u>${"<b></b>".repeat(FX_RINGS[st])}${Array.from({length:FX_COUNT[st]}, (_, n) => `<i style="--a:${-80 + 160 * (n + .5) / FX_COUNT[st]}deg;--w:${st === 4 && n % 2 ? .2 : 0}s"></i>`).join("")}</span>` : "";
    return `<div class="pt t${st}"><div class="mv">${fx}<div class="pimg">${Themes.stickerSvg(g.theme, i)}</div></div><span>${mode === "miss" ? "休息一下…" : esc(Themes.THEMES[g.theme].stickers[i][1])}</span></div>`;
  }).join("")}</div>`);
  const home = PARTNER_HOME[g.theme], row = box.querySelector(".partners");
  if(home){
    const sv = box.querySelector(".scenehold svg").getBoundingClientRect(), bx = box.getBoundingClientRect();
    row.classList.add("inscene");
    row.style.cssText = `--pu:${sv.height * [.27, .27, .22, .18][Math.min(kids.length, 3)]}px;left:${sv.left - bx.left + sv.width * home[0]}px;top:${sv.top - bx.top + sv.height * home[1]}px`;
    const hero = box.querySelector(".hero"); if(hero) hero.style.display = "none";
  }
  box.querySelector(".scenehold").classList.remove("bonk");   /* 場景再顯示時，沒撞怪獸的那次不要又晃一次 */
  if(mode !== "hit") return;
  /* 衝過去撞怪獸：算出從夥伴現在的位置到怪獸（場景中央偏上）要走多遠；全隊一起出場時錯開一點，才不會疊在一起 */
  const holdEl = box.querySelector(".scenehold"), hold = (holdEl.querySelector("svg") || holdEl).getBoundingClientRect(), pts = [...box.querySelectorAll(".pt")];
  let top = 0;
  pts.forEach((el, n) => {
    const m = el.querySelector(".mv"), r = el.querySelector(".pimg").getBoundingClientRect();
    const [hx, hy] = PARTNER_HIT[g.theme] || [.5, .5];
    m.style.setProperty("--dx", `${hold.left + hold.width * hx + (n - (pts.length - 1) / 2) * 90 - (r.left + r.width / 2)}px`);
    m.style.setProperty("--dy", `${hold.top + hold.height * hy - (r.top + r.height / 2)}px`);
    top = Math.max(top, +(el.className.match(/t(\d)/) || [0, 1])[1]);
  });
  const sh = box.querySelector(".scenehold");   /* 撞到的瞬間怪獸那一塊晃一下，星等越高晃越大 */
  sh.style.setProperty("--sh", `${[0, 3, 5, 8, 12][top]}px`); sh.classList.remove("bonk"); void sh.offsetWidth; sh.classList.add("bonk");
}
/* 夥伴撞的位置：場景（.scenehold）裡怪獸的中心，左上角為 0、右下角為 1（算在場景的圖上，不是整個欄位，欄位比圖寬）；太空的外星人在右邊，恐龍蛋在中間 */
const PARTNER_HIT = {space:[.72, .58], dino:[.5, .5]};
/* 夥伴站的位置（場景圖上的比例，腳的位置）：太空站在原本太空人的位置（太空人藏起來）；沒有寫的主題站在怪獸下方一排 */
const PARTNER_HOME = {space:[.26, .95]};
/* 海洋（釣魚）合作：場景上方一排全隊頭像，輪到（剛作答）的那位亮起來（2026-10-26 維護者決定；多根釣竿不做） */
const teamHtml = (g, active) => g.game === "coop" && g.theme === "ocean" ? `<span class="team">${g.kids.map(c => `<span class="tm ${c === active ? "on" : ""}">${Rewards.avatarHtml(c)}</span>`).join("")}</span>` : "";
const partnerKids = (g, code) => g.game === "coop" ? g.kids : [code];

/* 開始前：看看要打的怪獸，停 1.8 秒。
   平板（2026-10-24 維護者決定）：「是你嗎？」那一頁已經是遊戲開始畫面，按「開始」後直接出第一題、馬上唸，不再停 1.8 秒 */
function sceneStart(then){
  const g = G, box = $("#pScene"), t = Themes.THEMES[g.theme];
  box.innerHTML = `<div class="scenecap" id="sceneCap"></div><div class="scenehold"></div>`;
  g.scene = Scenes[g.theme](box.querySelector(".scenehold"), g.queue.length, g.prize);
  g.hits = 0; g.doneN = 0; g.blockHits = 0;
  g.scene.setPlayer(g.queue[0].kid);
  if(TABLET){ $("#pProg").textContent = `做完 ${g.queue.length} 題就成功！`; return then(); }
  showScene(true, `${g.game === "coop" ? "大家一起：" : ""}${t.line}`, "", teamHtml(g, g.queue[0].kid));
  showPartners(partnerKids(g, g.queue[0].kid), "stand");
  $("#pProg").textContent = `做完 ${g.queue.length} 題就成功！`;
  setTimeout(() => { if(G === g && !g.over){ showScene(false); then(); } }, SCENE_MS);
}
/* 每做完幾題：主角換成剛剛作答的學生；這幾題答對幾題就前進幾格，都沒答對就播「再加油」，停 1.8 秒 */
function sceneBeat(code, then){
  const g = G, k = kidBy(code), n = g.blockHits, who = g.game === "coop" ? "大家" : k ? kidShow(k) : code;
  g.blockHits = 0;
  g.scene.setPlayer(code);
  if(n){ showScene(true, `${who}${g.game === "coop" ? "" : " "}${SCENE_ACT[g.theme](n)}！`, g.game === "coop" ? "" : code, teamHtml(g, code)); g.scene.hit(g.hits, g.queue.length - g.pos); }
  else { showScene(true, SCENE_MISS[g.theme], g.game === "coop" ? "" : code, teamHtml(g, code)); g.scene.miss(g.queue.length - g.pos); }
  showPartners(partnerKids(g, code), n ? "hit" : "miss");
  setTimeout(() => { if(G === g && !g.over){ showScene(false); then(); } }, SCENE_MS);
}
/* 最後一題做完：打敗怪獸，播完才到結果畫面（結果畫面再揭曉貼紙） */
function sceneWin(){
  const g = G; if(g.winning) return; g.winning = true;
  const t = Themes.THEMES[g.theme], last = g.queue[g.queue.length - 1].kid, k = kidBy(last);
  g.scene.setPlayer(last);
  showScene(true, g.game === "coop" ? t.coopWin : `${k ? kidShow(k) : last} ${t.winBanner}`, g.game === "coop" ? "" : last, teamHtml(g, last));
  showPartners(partnerKids(g, last), "hit");
  const r = g.scene.win(g.hits);   /* 一律完成；蛋糕高度、外星人剩的血照答對題數 */
  setTimeout(() => { if(G === g && !g.over) sfx.fanfare(); }, r.bannerAt);   /* 上方的字已經寫了結果，不另外跳大字，免得蓋住怪獸 */
  setTimeout(() => { if(G === g && !g.over) finish(); }, r.delay);
}

/* ---------- 流暢性模式：一位學生一回合 ---------- */
function showReady(){
  const code = G.kids[G.turn], k = kidBy(code);
  const w = $("#pWho"); w.hidden = false; w.innerHTML = whoHtml(code);
  $("#pProg").textContent = "";
  $("#pTimer").hidden = true;
  $("#pBody").innerHTML = `<div class="ready"><div class="turnav">${Rewards.avatarHtml(code)}</div><h2>${G.turn ? "換 " : ""}${esc(k ? kidShow(k) : code)}，準備好了嗎？</h2>
    <p class="note" style="margin:0">${LIMITS.find(l => +l[0] === G.limit)[1]}內，聽到哪個字就點哪個，越多越好！</p>
    <button class="go" id="roundGo">開始</button></div>`;
  $("#roundGo").onclick = startRound;
}
function startRound(){
  const code = G.kids[G.turn];
  G.round = {kid: code, correct: 0, wrong: 0, over: false, end: performance.now() + G.limit * 1000, last: G.lastFluChar || null};
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
  const pool = G.lessons.flatMap(k => testChars(k).map(c => ({c, k})));
  let it;
  do { it = pool[Math.floor(Math.random() * pool.length)]; } while(pool.length > 1 && G.round.last && it.c === G.round.last);
  G.round.last = G.lastFluChar = it.c;   /* 換人時，下一位的第一題也不重複上一位最後一題 */
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
  $("#pTimer").hidden = true; $("#pQuit").textContent = "結束";
  const g = G;
  if(g.scene){ g.scene.stop(); $("#pScene").hidden = true; $("#pBody").hidden = false; }
  /* 哪些學生做完了：正確率模式＝自己的題目都答完；流暢性模式＝自己那一回合時間到。
     按「結束」提早離開時，沒做完的學生這次的紀錄標成「中途結束」（不列入分析），也不抽貼紙。 */
  g.done = new Set(g.kids.filter(code => g.mode === "flu" ? g.tally[code].roundCorrect !== undefined
    : g.queue.filter(x => x.kid === code).length === g.tally[code].n));
  const left = g.kids.filter(code => !g.done.has(code));
  if(left.length) records.filter(r => r.session === g.session && left.includes(r.kid)).forEach(r => { r.quit = true; updateRecord(r); });
  $("#rTitle").textContent = left.length ? "這次先到這裡" : "完成了！";
  /* 練習才有鼓勵的話和卡片彈出；獎盃動畫正式評量也有（A3-14，只看有沒有做完）；進步鼓勵語正式評量不加（A3-15） */
  const lively = g.kind !== "formal";
  $("#rList").classList.remove("lively", "wait");
  $("#rList").innerHTML = g.kids.map((code, i) => {
    const t = g.tally[code], k = kidBy(code), name = esc(k ? kidShow(k) : code);
    const head = `<div class="rcard" data-kid="${esc(code)}" style="--i:${i}"><b class="rname2">${Rewards.avatarHtml(code)}${name}</b>`;
    if(!g.done.has(code)) return `${head}<span class="big">沒有做完</span>
      <span class="sm">這次中途結束，紀錄不列入分析，也沒有貼紙。下次做完就可以抽貼紙喔！</span></div>`;
    const cheer = lively ? `<div class="cheer2">${esc(cheerLine(g, code))}</div>` : "";
    if(g.mode === "flu"){
      const perMin = Math.round((t.roundCorrect || 0) * 60 / g.limit);
      return `${head}<span class="rlabel">每分鐘認出</span><span class="big">${perMin} 個</span>
        <div class="rstats"><span>答對 ${t.roundCorrect || 0} 個</span><span>答錯 ${t.roundWrong || 0} 個</span><span>${LIMITS.find(l => +l[0] === g.limit)[1]}</span></div>
        ${cheer}</div>`;
    }
    const avg = t.secs.length ? (t.secs.reduce((a, b) => a + b, 0) / t.secs.length).toFixed(1) : "—";
    return `${head}<span class="rlabel">答對率</span><span class="big">${t.n ? Math.round(t.first / t.n * 100) : 0}%</span>
      <div class="rstats"><span>第一次就答對 ${t.first} / ${t.n} 題</span><span>答對平均 ${avg} 秒</span></div>
      ${t.passed > t.first ? `<span class="sm">再試一次後，最後答對 ${t.passed} 題</span>` : ""}
      ${cheer}</div>`;
  }).join("") || `<p class="note">這次沒有作答紀錄。</p>`;
  $("#rNote").textContent = (g.kind === "formal" ? "這次是正式評量，做完的結果會納入學習分析。" : "這次是練習，結果另外統計。")
    + (left.length ? "沒有做完的紀錄會保留，但標成「中途結束」，不列入分析。" : "");
  showScreen("#result");
  drawStickers(g);             /* 先抽好貼紙、寫進紀錄（見 collect.js），平板送出的紀錄才有抽到什麼 */
  $("#rBook").hidden = !g.rewards || !g.done.size;   /* 有抽貼紙才有「看貼紙簿」 */
  if(TABLET) tabletSend(g);   /* 平板作答：把這次的紀錄送到老師的 Google 表單（見 tablet.js） */
  /* 每位有作答的學生抽一張貼紙（見 collect.js）；練習先播完獎盃、卡片彈出後再抽 */
  if(!lively) return g.done.size ? showTrophy(g, () => { if(G === g) giveStickers(g); }) : giveStickers(g);
  /* 卡片先藏著，獎盃消失後才一張張彈出 */
  const list = $("#rList"), go = () => { list.classList.replace("wait", "lively"); setTimeout(() => { if(G === g) giveStickers(g); }, g.kids.length * 180 + 400); };
  list.classList.add("wait");
  if(g.done.size) showTrophy(g, go); else go();
}

/* 一次作答（同一位學生、同一個 session）的成績：第一次就答對幾題、答對平均秒數、每分鐘幾個 */
function sessionStats(rs){
  const secs = rs.filter(r => r.passed && r.correctSec != null).map(r => r.correctSec);
  const first = rs.filter(r => r.firstCorrect).length;
  return {n: rs.length, first, avg: secs.length ? secs.reduce((a, b) => a + b, 0) / secs.length : null,
    perMin: rs[0] && rs[0].timeLimit ? first * 60 / rs[0].timeLimit : null};
}
/* 練習結果的鼓勵語：跟「同一位學生、同一個目標和模式、考同一批字的上一次練習」比，
   只說進步的地方，沒進步或第一次做就說努力的話（不說退步）。只從舊紀錄算，不新增紀錄欄位。 */
function cheerLine(g, code){
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const charsOf = rs => [...new Set(rs.map(r => r.char))].sort().join("");
  const mine = records.filter(r => r.session === g.session && r.kid === code);
  const now = sessionStats(mine), chars = charsOf(mine);
  const past = {};
  for(const r of records) if(r.kid === code && r.session !== g.session && !r.quit && r.kind === "practice" && r.goal === g.goal && r.mode === g.mode) (past[r.session] = past[r.session] || []).push(r);
  const prev = Object.values(past).filter(rs => charsOf(rs) === chars).sort((a, b) => a[0].at < b[0].at ? 1 : -1)[0];
  if(prev){
    const p = sessionStats(prev);
    if(g.mode === "flu"){
      const d = Math.round(now.perMin) - Math.round(p.perMin);
      if(d > 0) return pick([`每分鐘比上次多認出 ${d} 個字，進步好多！`, `比上次多認出 ${d} 個字，你越來越快了！`]);
    } else {
      const more = now.first - p.first, faster = now.avg != null && p.avg != null ? Math.round((p.avg - now.avg) * 10) / 10 : 0;
      if(more > 0) return pick([`你比上次多答對 ${more} 個字，好厲害！`, `這次多答對了 ${more} 個字，越來越會了！`]);
      if(more >= 0 && faster >= 0.1) return pick([`你比上次快了 ${faster} 秒，超棒！`, `反應比上次快 ${faster} 秒，好厲害！`]);
    }
  }
  if(g.mode !== "flu" && now.n && now.first === now.n) return pick(["全部第一次就答對，太強了！", "一題都沒錯，真厲害！"]);
  return pick([`今天完成了 ${now.n} 題，很認真！`, "你很努力，繼續加油！", "每練習一次，就更熟一點喔！", "認真做完了，給自己拍拍手！"]);
}
/* 練習做完先跳出獎盃與彩帶，約 2.5 秒自己消失，點一下或按任意鍵就跳過；
   電腦設定「減少動態效果」時不播，直接看結果 */
function showTrophy(g, then){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return then();
  const n = g.done.size, box = document.createElement("div");
  box.className = "trophy"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "完成了");
  const colors = ["#d64534", "#f5b400", "#2c7a69", "#2a78d6", "#e87ba4"];
  const conf = Array.from({length: 36}, (_, i) => `<i class="conf" style="left:${Math.random() * 100}%;background:${colors[i % 5]};--x:${Math.round(Math.random() * 160 - 80)}px;--d:${(Math.random() * .8).toFixed(2)}s"></i>`).join("");
  box.innerHTML = `${conf}<div class="tbox">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <path d="M30 22h60v18c0 22-13 36-30 36S30 62 30 40z" fill="#f5b400" stroke="#1f3d36" stroke-width="4" stroke-linejoin="round"/>
      <path d="M30 30H16c0 16 8 24 18 25M90 30h14c0 16-8 24-18 25" fill="none" stroke="#1f3d36" stroke-width="4" stroke-linecap="round"/>
      <path d="M53 75h14v14H53z" fill="#e0a300" stroke="#1f3d36" stroke-width="4"/>
      <rect x="38" y="89" width="44" height="14" rx="4" fill="#2c7a69" stroke="#1f3d36" stroke-width="4"/>
      <circle cx="51" cy="44" r="3.5" fill="#1f3d36"/><circle cx="69" cy="44" r="3.5" fill="#1f3d36"/>
      <path d="M52 53q8 7 16 0" fill="none" stroke="#1f3d36" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="45" cy="51" r="3" fill="#ff9d8a"/><circle cx="75" cy="51" r="3" fill="#ff9d8a"/>
      <path class="tstar" d="M14 10l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z" fill="#f5b400"/>
      <path class="tstar" d="M104 6l2 4 4.4.6-3.2 3.1.8 4.4-4-2.1-4 2.1.8-4.4-3.2-3.1 4.4-.6z" fill="#e87ba4" style="animation-delay:.5s"/>
    </svg>
    <div class="tmsg">${n > 1 && n === g.kids.length ? "大家都完成了！" : "完成了！"}</div><div class="tskip">點一下繼續</div></div>`;
  document.body.appendChild(box);
  sfx.fanfare();
  let gone = false;
  const close = () => { if(gone) return; gone = true; box.remove(); removeEventListener("keydown", close); then(); };
  box.onclick = close; addEventListener("keydown", close);
  setTimeout(close, 2600);
}
$("#rAgain").onclick = () => { if(G) chooseTheme(); };
$("#rHome").onclick = () => { G = null; showScreen("#setup"); render(); };
$("#rExport").onclick = () => { if(G) exportXlsx(records.filter(r => r.session === G.session), `識字評量_${fileDate(G.session)}.xlsx`, "#rMsg"); };
