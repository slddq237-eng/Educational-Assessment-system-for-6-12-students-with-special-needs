/* =========================================================
   識字評量：只考有教的字（wordsets.js）
   有些老師一課只教其中幾個字，或還沒教完就要考。第 3 步選好課次後，可以把還沒教的字點掉，
   每一課點好的字叫做這課的「字組」，自動記在這台電腦，下次選同一課就沿用。

   字組的規則（規格書 A6、B5）：
   - 正式評量用過一次就「鎖定」：之後正式評量不能改，前後成績考的才是同一批字，才能比較。
   - 練習隨時可以改；字組鎖定後，練習時點的字另外記（pchars），不影響正式評量。
   - 課程真的改了，按「重新開始一組」：版本加 1、解除鎖定，之後的紀錄標成新的一組。
   - 每筆作答紀錄記下這題考的是哪一組（ws、wsChars、wsAll，見 play.js 的 endItem），Excel 有「只考有教的字」欄。
   - 可以存成「字組檔」分享給同事（不含學生資料），同事用「匯入檔案」加進去。

   存法：localStorage 的 literacy-wordsets，{ "課本-課次": {chars:"考的字", ver:第幾組, locked:是否鎖定, pchars:"鎖定後練習自己點的字"} }
   沒有這一課＝整課都考。
   ========================================================= */
const WS_KEY = "literacy-wordsets";
let wordSets = load(WS_KEY, {});
const saveWordSets = () => store(WS_KEY, wordSets);
/* 這一課課本上的全部生字（和 play.js 的 charsOf 一樣） */
const lessonChars = k => { const [b, n] = splitKey(k); const L = BOOKS[b] && BOOKS[b].lessons[n]; return L ? [...(L.write + L.read)] : []; };
/* 這課這次要考的字：正式評量用字組，練習用練習自己點的（沒有就跟正式一樣）。
   只留課本裡現在還有的字（課本資料修訂過也不會出錯）；一個都不剩就整課都考。 */
function wsPick(k, kind = state.kind){
  const s = wordSets[k], all = lessonChars(k);
  if(!s) return all;
  const pick = kind === "formal" ? s.chars : s.pchars ?? s.chars;
  const keep = all.filter(c => pick.includes(c));
  return keep.length ? keep : all;
}
const wsPartial = (k, kind = state.kind) => wsPick(k, kind).length < lessonChars(k).length;
/* 沒有鎖定、又是整課的字組就不用留 */
function wsTidy(k){
  const s = wordSets[k]; if(!s) return;
  if(s.pchars !== undefined && (s.pchars === s.chars || !s.locked)) delete s.pchars;
  if(!s.locked && s.ver === 1 && s.chars === lessonChars(k).join("")) delete wordSets[k];
}
/* 點一個字：考 ↔ 不考。每課至少要留一個字。 */
function wsToggle(k, c){
  const all = lessonChars(k), cur = wsPick(k);
  const next = all.filter(x => x === c ? !cur.includes(c) : cur.includes(x));
  if(!next.length) return false;
  wsSetChars(k, next.join(""));
  return true;
}
function wsSetChars(k, str){
  const s = wordSets[k] || (wordSets[k] = {chars: lessonChars(k).join(""), ver: 1, locked: false});
  if(s.locked){ if(state.kind === "formal") return; s.pchars = str; }   /* 鎖定後只改練習用的 */
  else s.chars = str;
  wsTidy(k); saveWordSets();
}
/* 重新開始一組：版本加 1、解除鎖定；練習時點的字變成新的一組 */
function wsRestart(k){
  const s = wordSets[k]; if(!s) return;
  s.ver++; s.locked = false;
  if(s.pchars !== undefined){ s.chars = s.pchars; delete s.pchars; }
  wsTidy(k); saveWordSets();
}
/* 開始評量時：正式評量用到的字組鎖定；回傳每一課要記進作答紀錄的資料 */
function wsStart(lessons, kind){
  const out = {};
  for(const k of lessons){
    const s = wordSets[k], partial = wsPartial(k, kind), all = lessonChars(k).length;
    if(kind === "formal" && s && partial && !s.locked){ s.locked = true; saveWordSets(); }
    out[k] = !partial ? {ws: "", wsChars: "", wsAll: all}
      : {ws: kind !== "formal" && s.locked && s.pchars !== undefined ? "p" : String(s.ver), wsChars: wsPick(k, kind).join(""), wsAll: all};
  }
  return out;
}

/* ---------- 第 3 步的畫面 ---------- */
state.wsOpen = false; state.wsMsg = "";
function renderTaught(){
  const box = $("#taught");
  if(!state.lessons.length){ box.innerHTML = ""; return; }
  const formal = state.kind === "formal";
  const partN = state.lessons.filter(k => wsPartial(k)).length;
  const rows = state.lessons.map(k => {
    const [b, n] = splitKey(k), s = wordSets[k], all = lessonChars(k), pick = wsPick(k);
    const lockedNow = formal && s && s.locked;
    let note = "";
    if(s && s.locked && formal) note = `這組字（第 ${s.ver} 組）已經用在正式評量，為了前後成績能比較，正式評量時不能改。課程真的改了，請按「重新開始一組」，之後的成績會標成第 ${s.ver + 1} 組。`;
    else if(s && s.locked) note = `正式評量用的第 ${s.ver} 組已鎖定；這裡點的字只用在練習。`;
    else if(s && s.ver > 1) note = `第 ${s.ver} 組，還沒用在正式評量，可以改。`;
    return `<div class="tl" data-k="${k}"><div class="row" style="gap:6px 10px"><b>${bookName(b)} ${esc(lessonName(b, n))}</b>
        <span class="${pick.length < all.length ? "warn" : "note"}" style="margin:0">考 ${pick.length}／${all.length} 字</span>
        ${!lockedNow && pick.length < all.length ? `<button class="linkbtn" data-wall>全部選回來</button>` : ""}
        ${s && s.locked && !formal && s.pchars !== undefined ? `<button class="linkbtn" data-wsame>跟正式評量一樣</button>` : ""}
        ${s && s.locked ? `<button class="linkbtn" data-wnew>重新開始一組</button>` : ""}</div>
      <div class="tchars">${all.map((c, i) => `<button class="tc ${pick.includes(c) ? "on" : ""}" data-i="${i}" aria-pressed="${pick.includes(c)}" ${lockedNow ? "disabled" : ""} aria-label="${c}${pick.includes(c) ? "，要考" : "，不考"}">${esc(c)}</button>`).join("")}</div>
      ${note ? `<p class="note" style="margin:0">${note}</p>` : ""}</div>`;
  }).join("");
  box.innerHTML = `<details class="taught" ${state.wsOpen ? "open" : ""}><summary>只考有教的字${partN ? `<span class="pill">${partN} 課只考部分的字</span>` : `<span class="note" style="margin:0">（目前整課都考）</span>`}</summary>
    <p class="note" style="margin:0">還沒教的字點掉就不會考（綠色＝要考）。每一課點好的字會記在這台電腦，下次選同一課自動沿用。</p>
    ${rows}
    <div class="row"><button class="ghost" id="wsShare">分享字組給同事</button><button class="ghost" id="wsImport">匯入同事的字組</button></div>
    <p class="note" style="margin:0" id="wsMsg" role="status">${esc(state.wsMsg)}</p></details>`;
  box.querySelector("details").ontoggle = e => { state.wsOpen = e.target.open; };
  box.querySelectorAll(".tl").forEach(r => {
    const k = r.dataset.k, all = lessonChars(k);
    r.querySelectorAll(".tc").forEach(btn => btn.onclick = () => {
      state.wsMsg = wsToggle(k, all[+btn.dataset.i]) ? "" : "每一課至少要考一個字。"; render();
    });
    const a = r.querySelector("[data-wall]"); if(a) a.onclick = () => { wsSetChars(k, all.join("")); state.wsMsg = ""; render(); };
    const same = r.querySelector("[data-wsame]"); if(same) same.onclick = () => { delete wordSets[k].pchars; saveWordSets(); render(); };
    const nw = r.querySelector("[data-wnew]"); if(nw) nw.onclick = () => {
      if(!nw.classList.contains("armed")){ nw.classList.add("armed"); nw.textContent = "確定要重新開始？再按一次"; return; }
      wsRestart(k); state.wsMsg = "已經開始新的一組，可以重新點選要考的字。"; render();
    };
  });
  $("#wsShare").onclick = () => {
    const ks = Object.keys(wordSets).filter(k => lessonChars(k).length && wsPartial(k));
    if(!ks.length){ state.wsMsg = "這台電腦還沒有只考部分字的課，沒有字組可以分享。"; render(); return; }
    const sets = Object.fromEntries(ks.map(k => [k, {chars: wsPick(k).join(""), name: wsName(k)}]));
    if(downloadJson({app: "literacy", kind: "wordsets", format: 1, savedAt: new Date().toISOString(), sets}, `識字評量_字組_${fileDate(Date.now())}.json`, "#wsMsg"))
      state.wsMsg = `已下載字組檔（${ks.length} 課）。字組檔沒有學生資料，可以寄給同事，請同事從右上角「選單 → 匯入檔案」加進去。`;
    render();
  };
  $("#wsImport").onclick = () => { renderRecSheet(); openSheet("#recSheet"); $("#recRestore").click(); };
}
const wsName = k => { const [b, n] = splitKey(k); return `${bookName(b)} ${lessonName(b, n)}`; };

/* ---------- 匯入同事的字組（從「匯入檔案」來，見 records.js） ----------
   這台電腦的字組已經用在正式評量（鎖定）就不覆蓋；課本上沒有的課、沒有的字略過。 */
function wsImportPlan(sets){
  const ok = [], skip = [], none = [];
  for(const [k, v] of Object.entries(sets || {})){
    const all = lessonChars(k), keep = all.filter(c => (v.chars || "").includes(c));
    if(!all.length || !keep.length){ none.push(v.name || k); continue; }
    const s = wordSets[k];
    if(s && s.locked && s.chars !== keep.join("")) skip.push(wsName(k)); else ok.push([k, keep.join("")]);
  }
  return {ok, skip, none};
}
function wsImport(plan){
  for(const [k, str] of plan.ok){
    const s = wordSets[k];
    if(s && s.locked) continue;   /* 鎖定而且一樣，不用動 */
    wordSets[k] = {chars: str, ver: s ? s.ver : 1, locked: false};
    wsTidy(k);
  }
  saveWordSets();
}
/* 備份檔也帶著字組（換電腦時跟著走）。還原時，這台電腦鎖定的字組不動，其他用備份檔的。 */
addBackupPart("wordsets", () => wordSets, data => {
  for(const [k, v] of Object.entries(data)){
    if(!v || typeof v.chars !== "string" || !lessonChars(k).length) continue;
    const s = wordSets[k];
    if(!s || (!s.locked && (v.locked || v.ver >= s.ver))) wordSets[k] = {...v};
  }
  saveWordSets();
});
