/* =========================================================
   識字評量：作答紀錄（records.js）
   每題一筆的作答紀錄：存取、匯出 Excel、紀錄面板、備份與還原。
   ========================================================= */

/* =========================================================
   6. 作答紀錄的存取
   每答完一題就存一筆紀錄到這台電腦的瀏覽器（IndexedDB，容量比 localStorage 大）。
   打開網頁時先把全部紀錄讀進 records，供「常錯優先」與紀錄面板使用。
   ========================================================= */
const REC_DB = "literacy", REC_STORE = "records";
let recDb = null, records = [];
function openRecDb(){
  return new Promise(res => {
    try {
      const r = indexedDB.open(REC_DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(REC_STORE, {keyPath:"id", autoIncrement:true});
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch(e){ res(null); }
  });
}
function loadRecords(){
  return new Promise(res => {
    if(!recDb) return res([]);
    try {
      const q = recDb.transaction(REC_STORE).objectStore(REC_STORE).getAll();
      q.onsuccess = () => res(q.result || []);
      q.onerror = () => res([]);
    } catch(e){ res([]); }
  });
}
/* 寫入失敗（例如電腦空間不足、瀏覽器限制容量）：以前會默默失敗，老師以為有存到。
   改成在畫面上方提醒（2026-11-06）；這次打開網頁後的紀錄還在記憶體裡，下載備份檔或匯出 Excel 就救得回來。 */
function recWriteFailed(){
  const w = $("#dbWarn"); if(!w) return;
  w.textContent = "⚠ 作答紀錄沒有成功存進這台電腦（可能是電腦或瀏覽器的空間不足）。請不要關掉網頁，先到右上角選單「下載備份檔」或匯出 Excel，再清出空間。";
  w.hidden = false;
}
/* 開一個寫入用的交易（transaction），失敗或中斷時提醒 */
function recWriteTx(){
  const tx = recDb.transaction(REC_STORE, "readwrite");
  tx.onerror = tx.onabort = recWriteFailed;
  return tx.objectStore(REC_STORE);
}
function saveRecord(r){
  records.push(r);
  if(!recDb) return;
  try { const q = recWriteTx().add(r); q.onsuccess = () => { r.id = q.result; if(r.dirty) updateRecord(r); }; } catch(e){ recWriteFailed(); }
}
/* 改一筆已經存好的紀錄（例如寫進抽到的貼紙、標成中途結束）。
   剛存的紀錄可能還在寫入中（還沒有 id），先做記號，寫好後再補存一次。 */
function updateRecord(r){
  if(!recDb) return;
  if(r.id == null){ r.dirty = true; return; }
  delete r.dirty;
  try { recWriteTx().put(r); } catch(e){ recWriteFailed(); }
}
/* 移除一批紀錄（封存舊學年用）：記憶體和這台電腦的資料庫都拿掉 */
function removeRecords(list){
  const gone = new Set(list);
  records = records.filter(r => !gone.has(r));
  if(!recDb) return;
  try { const st = recDb.transaction(REC_STORE, "readwrite").objectStore(REC_STORE); list.forEach(r => { if(r.id != null) st.delete(r.id); }); } catch(e){}
}
function clearRecords(){
  records = [];
  if(!recDb) return;
  try { recDb.transaction(REC_STORE, "readwrite").objectStore(REC_STORE).clear(); } catch(e){}
}
/* 平板作答（data.js 的 TABLET）不存進平板的資料庫：紀錄只放在記憶體、送到老師的 Google 表單（見 tablet.js） */
(async () => { recDb = TABLET ? null : await openRecDb(); records = await loadRecords(); recordsLoaded = true; if(typeof renderTidyNote === "function") renderTidyNote(); $("#dbWarn").hidden = !!recDb || !!TABLET; checkBackup(); askPersist(); })();

/* 永久保存（2026-11-06 維護者決定）：電腦空間不足時，瀏覽器可能自動清掉網站的資料（作答紀錄、學生名單、貼紙）。
   向瀏覽器申請「這個網站的資料不要自動清掉」：Chrome、Edge 不會問老師，自己決定答不答應；Firefox 會跳出一次詢問，請老師按「允許」。
   有作答紀錄才申請（第一次打開、還沒用過的老師不會被問）；平板不存資料，不申請。申請不到也照常使用，只是要更記得下載備份檔。 */
function askPersist(){
  if(TABLET || !recDb || !records.length || !(navigator.storage && navigator.storage.persist)) return;
  navigator.storage.persisted().then(ok => { if(!ok) return navigator.storage.persist(); }).catch(() => {});
}

/* 備份提醒：有紀錄、而且超過 30 天沒下載備份檔（或從來沒備份過）時，設定畫面上方提醒一次 */
const BACKUP_KEY = KEYS.lastBackup, BACKUP_DAYS = 30;
function checkBackup(){
  const last = load(BACKUP_KEY, null), days = last ? Math.round((today - parse(last)) / DAY) : null;
  const show = records.length > 0 && !!recDb && (days == null || days >= BACKUP_DAYS);
  $("#backupWarn").hidden = !show;
  if(show) $("#backupText").textContent = `這台電腦有 ${records.length} 筆作答紀錄，${days == null ? "還沒有下載過備份檔" : `上次備份是 ${days} 天前`}。清除瀏覽資料或換電腦時紀錄會不見，建議現在備份。`;
}
$("#backupOpen").onclick = () => { renderRecSheet(); openSheet("#recSheet"); $("#recBackup").click(); };
/* 右上角選單的「下載備份檔」「匯入檔案」：打開作答紀錄面板再執行，結果訊息才看得到 */
$("#menuBackup").onclick = () => { renderRecSheet(); openSheet("#recSheet"); $("#recBackup").click(); };
$("#menuRestore").onclick = () => { renderRecSheet(); openSheet("#recSheet"); $("#recRestore").click(); };


/* =========================================================
   7. Excel 匯出、作答紀錄面板與備份
   ========================================================= */
/* Excel 欄位：標題 → 怎麼從紀錄取值 */
const yesNo = v => v ? "是" : "否";
/* 答錯規則的簡稱（Excel 用）；舊紀錄沒有這些欄位，顯示「未記錄」或「無」 */
const RULE_SHORT = {remove:"打叉", next:"提示", free:"自己點", reveal:"顯示答案"};
const COLS = [
  ["日期時間", r => new Date(r.at).toLocaleString("zh-TW", {hour12:false})],
  ["學生代號", r => r.kid], ["名字", r => r.kidName], ["年級", r => r.grade], ["學習年級", r => r.studyGrade],
  ["正式或練習", r => r.kind === "formal" ? "正式評量" : "練習"],
  ["評量目標", r => goalName(r.goal)], ["評量方式", r => r.mode === "flu" ? "流暢性" : "正確率"],
  ["時限（秒）", r => r.timeLimit], ["作答模式", r => (ANSWERS.find(a => a.id === r.answer) || {}).name || r.answer],
  ["出題方式", r => r.method === "all" ? "全部出題" : (METHODS.find(m => m.id === r.method) || {}).name || r.method],
  ["課本", r => BOOKS[r.book] ? bookName(r.book) : r.bookName], ["課次", r => BOOKS[r.book] && BOOKS[r.book].lessons[r.lesson] ? lessonName(r.book, r.lesson) : r.lesson], ["目標字", r => r.char], ["語詞", r => r.word],
  ["常用字加題", r => yesNo(r.boost)], ["選項數", r => r.choices], ["全部選項", r => r.options],
  ["版面", r => r.layout === "bingo" ? "生字賓果卡" : "選項卡"],
  ["第一次選的字", r => r.firstPick], ["第一次就答對", r => yesNo(r.firstCorrect)], ["錯誤類型", r => r.errorType],
  ["最後答對", r => yesNo(r.passed)], ["顯示答案", r => yesNo(r.revealed)], ["答錯次數", r => r.wrongCount],
  ["提示層級", r => r.hintLevel], ["用到的提示", r => r.hints], ["老師提示", r => r.teacherPrompt],
  ["提示設定", r => r.hintSet === undefined ? "未記錄" : r.hintSet ? r.hintSet.split(",").map(hintName).join("→") : "無提示"],
  ["答錯規則", r => r.rule === undefined ? "未記錄" : r.rule === "none" ? "答錯就記錯" : r.rule.split(",").map(x => RULE_SHORT[x] || x).join("→")],
  ["第一次作答秒數", r => r.firstSec], ["答對秒數", r => r.correctSec ?? ""],
  ["前後測", r => r.prepost || ""], ["教學後天數", r => r.daysAfter],
  ["主題", r => r.theme ? themeName(r.theme) : "無"], ["遊戲玩法", r => gameName(r)], ["選項注音", r => r.bpmf ? "有" : "無"], ["報讀（當時設定）", r => r.read ? "開" : "關"], ["按了報讀", r => r.readUsed || "無"], ["獎勵", r => r.reward || "無"], ["獎勵代號", r => r.rewardCode || ""],
  ["中途結束（不列入分析）", r => yesNo(r.quit)],
  ["作答字的大小", r => r.fontScale ? (FONT_SIZES.find(f => f[0] === r.fontScale) || [, r.fontScale])[1] : "未記錄"],
  ["唸讀速度", r => r.rate ?? "未記錄"], ["顯示計時", r => r.clock === undefined ? "未記錄" : yesNo(r.clock)], ["音效", r => r.sfx === undefined ? "未記錄" : r.sfx ? "開" : "關"],
  /* 新欄位一律加在最後面，舊的欄位順序不變（Excel 的欄位位置才不會跑掉） */
  ["裝置", r => r.device || "未記錄"], ["紀錄格式版本", r => r.fmt || 1],
  /* 第 3 版（A8，2026-10-25）：研究計畫與研究時期（研究計畫做出來前是空白） */
  ["研究計畫代號", r => r.planId || ""], ["研究計畫版本", r => r.planVer || ""], ["研究時期", r => r.rphase || ""],
  /* 只考有教的字（wordsets.js）：以前的紀錄都是整課出題 */
  ["只考有教的字", r => !r.wsChars ? "整課" : `${r.ws === "p" ? "練習自己點的" : `第 ${r.ws} 組`}：${[...r.wsChars].length}／${r.wsAll} 字（${r.wsChars}）`],
  /* 聽音選部件（R6，2026-10-31）：只加在最後面，舊紀錄沒有這些欄位（空白）；A8 第 24 點：只加欄位，紀錄格式不升版 */
  ["部件題的正確部件（聽音補部件、聽音選部件）", r => r.answerSet || ""], ["聽音選部件：最後選的部件", r => r.pickSet || ""], ["部件取自第幾層", r => r.partsLayer ? `第 ${r.partsLayer} 層` : ""],
  /* 聽音補部件（R5，2026-10-31）：只加在最後面，舊紀錄沒有這些欄位（空白） */
  ["聽音補部件：被遮的是第幾塊", r => r.maskIdx || ""], ["聽音補部件：字的結構", r => r.maskStruct || ""]
];
const fileDate = t => { const d = new Date(t); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}_${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}`; };
/* Excel 元件按匯出時才載入（見 shared/common.js 的 loadXlsx） */
function exportXlsx(list, filename, msgSel){
  if(!list.length){ setMsg(msgSel, "沒有可以匯出的紀錄。"); return; }
  setMsg(msgSel, "準備匯出…");
  loadXlsx().then(() => writeXlsx(list, filename, msgSel), () => { setMsg(msgSel, "Excel 元件載入失敗，請重新整理網頁再試一次。"); });
}
function writeXlsx(list, filename, msgSel){
  const rows = list.map(r => Object.fromEntries(COLS.map(([h, f]) => [h, f(r)])));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "作答紀錄");
  try { XLSX.writeFile(wb, filename); setMsg(msgSel, `已匯出 ${list.length} 筆紀錄。`); }
  catch(e){ setMsg(msgSel, "這個環境不允許下載檔案，請用一般瀏覽器開啟網站再匯出。"); }
}

/* 作答紀錄面板：每一次評量一列 */
function renderRecSheet(){
  const by = new Map();
  for(const r of records){ if(!by.has(r.session)) by.set(r.session, []); by.get(r.session).push(r); }
  const sessions = [...by].sort((a, b) => b[0] - a[0]);
  $("#recInfo").textContent = recDb ? `這台電腦共有 ${records.length} 筆作答紀錄、${sessions.length} 次評量。` : "這台電腦的瀏覽器不允許存檔，只看得到這次打開網頁後的紀錄。";
  $("#recTable").innerHTML = sessions.length ? `<thead><tr><th>日期</th><th>學生</th><th>性質</th><th>方式</th><th>題數</th><th>第一次就答對</th></tr></thead><tbody>${
    sessions.slice(0, 50).map(([sid, rs]) => {
      const first = rs.filter(r => r.firstCorrect).length, quit = rs.some(r => r.quit);
      return `<tr><td>${new Date(sid).toLocaleString("zh-TW", {hour12:false, month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit"})}</td>
        <td>${esc([...new Set(rs.map(r => r.kid))].join("、"))}</td><td>${rs[0].kind === "formal" ? "正式" : "練習"}${quit ? "・<span class=\"warn\">中途結束</span>" : ""}</td>
        <td>${rs[0].mode === "flu" ? "流暢性" : "正確率"}</td><td>${rs.length}</td><td>${Math.round(first / rs.length * 100)}%</td></tr>`;
    }).join("")}</tbody>` : `<tbody><tr><td>還沒有作答紀錄。</td></tr></tbody>`;
  $("#recMsg").textContent = ""; $("#importAsk").hidden = true;
  $("#recClear").classList.remove("armed"); $("#recClear").textContent = "清除全部紀錄";
  renderYears();
}

/* 封存舊學年：紀錄多了以後，把以前學年的紀錄存成檔案、再從這台電腦移除，網頁會比較快。
   封存檔和備份檔格式相同，需要時用「匯入檔案」加回來。一定要先下載封存檔，才能移除。 */
const yearOf = r => { const d = new Date(r.at); return (d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1) - 1911; };
const archived = new Set();   /* 這次打開網頁後已經下載過封存檔的學年 */
function renderYears(){
  const by = new Map(); for(const r of records){ const y = yearOf(r); if(y < SCHOOL_YEAR){ if(!by.has(y)) by.set(y, []); by.get(y).push(r); } }
  const years = [...by].sort((a, b) => a[0] - b[0]);
  $("#recYears").innerHTML = !years.length ? "" : `<h3>封存以前學年的紀錄</h3>
    <p class="note" style="margin:0">紀錄很多時，可以把以前學年的紀錄存成封存檔，再從這台電腦移除，網頁會比較快。移除後老師專區就看不到那一學年；需要時用「匯入檔案」選封存檔加回來。</p>
    ${years.map(([y, rs]) => `<div class="row"><b>${y} 學年：${rs.length} 筆</b>
      <button class="ghost" data-archive="${y}">下載封存檔</button>
      <button class="danger" data-remove="${y}" ${archived.has(y) ? "" : "disabled title=\"先下載封存檔才能移除\""}>從這台電腦移除</button></div>`).join("")}`;
  $("#recYears").querySelectorAll("[data-archive]").forEach(b => b.onclick = () => {
    const y = +b.dataset.archive, rs = by.get(y);
    if(downloadJson({app:"literacy", kind:"archive", version:2, archive:y, savedAt:new Date().toISOString(), settings, kids, teach, records: rs.map(({id, ...r}) => r)}, `識字評量_${y}學年封存_${fileDate(Date.now())}.json`)){
      archived.add(y); renderYears(); $("#recMsg").textContent = `已下載 ${y} 學年的封存檔（${rs.length} 筆），請存到隨身碟或雲端硬碟，再按「從這台電腦移除」。`;
    }
  });
  $("#recYears").querySelectorAll("[data-remove]").forEach(b => b.onclick = () => {
    const y = +b.dataset.remove;
    if(!b.classList.contains("armed")){ b.classList.add("armed"); b.textContent = "確定要移除？再按一次"; return; }
    const n = by.get(y).length; removeRecords(by.get(y)); archived.delete(y);
    renderRecSheet(); checkBackup(); $("#recMsg").textContent = `已從這台電腦移除 ${y} 學年的 ${n} 筆紀錄。`;
  });
}
$("#recXlsx").onclick = () => exportXlsx(records, `識字評量_全部紀錄_${fileDate(Date.now())}.xlsx`, "#recMsg");
/* 備份檔：把作答紀錄、學生名單、教學日期、設定存成一個檔案，換電腦時可以還原 */
/* 備份檔第 2 版：除了上面這些，其他模組（例如之後的貼紙收藏、頭像）可以用 addBackupPart() 把自己的資料加進來。
   第 1 版的舊備份檔沒有這些部分，照樣可以還原。 */
const BACKUP_PARTS = [];
const addBackupPart = (key, save, restore) => BACKUP_PARTS.push({key, save, restore});
$("#recBackup").onclick = async () => {
  const data = {app:"literacy", kind:"backup", version:2, savedAt:new Date().toISOString(), settings, kids, kidsArchived, teach, records: records.map(({id, ...r}) => r)};
  for(const p of BACKUP_PARTS){ try { data[p.key] = await p.save(); } catch(e){} }
  if(!downloadJson(data, `識字評量_備份_${fileDate(Date.now())}.json`)) return;
  $("#recMsg").textContent = "已下載備份檔，請存到隨身碟或雲端硬碟。";
  store(BACKUP_KEY, iso(new Date())); checkBackup();
};
/* 把資料存成 .json 檔下載（備份檔、封存檔、字組檔）；這個環境不能下載時回傳 false */
function downloadJson(data, filename, msgSel = "#recMsg"){
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:"application/json"}));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    /* 下載開始後釋放暫存的檔案（備份檔可能有好幾 MB，不釋放會一直佔記憶體，直到關掉網頁）；等一分鐘，避免慢的電腦還沒開始下載就被收走 */
    setTimeout(() => URL.revokeObjectURL(a.href), 60 * 1000);
    return true;
  } catch(e){ setMsg(msgSel, "這個環境不允許下載檔案，請用一般瀏覽器開啟網站再下載。"); return false; }
}
/* ---------- 匯入檔案（規格書 A7） ----------
   平台存的檔案都是「平台資料檔」（.json），檔案裡的 kind 寫著是哪一種：
     backup＝備份檔、archive＝封存檔（兩種格式相同）、wordsets＝字組檔（見 wordsets.js）。
   以前的備份檔、封存檔沒有 kind，看有沒有 archive 判斷，照樣可以匯入。
   選了檔案先說明「這是什麼檔、裡面有什麼」，老師按「匯入」才真的加進來。
   Excel 檔只有一種能匯入：從 Google 試算表下載的平板作答紀錄（kind＝tablet，見 tablet.js 的 tabletSheet）；平台匯出的 Excel 只能看。 */
const fileKind = d => d.kind || (d.archive ? "archive" : "backup");
const recKey = r => `${r.session}|${r.at}|${r.kid}|${r.char}`;
const savedDay = d => { const t = new Date(d.savedAt); return isNaN(t) ? "" : `${t.getFullYear()}/${t.getMonth() + 1}/${t.getDate()} `; };
$("#recRestore").onchange = async e => {
  const f = e.target.files[0]; e.target.value = "";
  if(!f) return;
  const ask = $("#importAsk"); ask.hidden = true;
  let data;
  if(/\.(xlsx|csv)$/i.test(f.name)){
    try { data = await tabletSheet(f); } catch(err){ $("#recMsg").textContent = `沒辦法讀取這個 Excel 檔：${err.message}`; return; }
    if(!data){ $("#recMsg").textContent = "這個 Excel 檔裡找不到平板作答的紀錄。平台匯出的 Excel 只能看，不能匯入；換電腦請用備份檔。"; return; }
  } else try { data = JSON.parse(await f.text()); } catch(err){ $("#recMsg").textContent = "沒辦法讀取這個檔案：這不是平台存的資料檔（Excel 檔只能看，不能匯入）。"; return; }
  if(!data || data.app !== "literacy"){ $("#recMsg").textContent = "沒辦法讀取這個檔案：這不是識字評量存的資料檔。"; return; }
  const kind = fileKind(data);
  let text, doIt, extra = "", check = null;
  /* 備份檔、封存檔先檢查內容的形狀（2026-11-10 發布前測試）：被改壞的檔案原本會照單全收，學生名單多出怪東西，之後打開名單就出錯 */
  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  const listOk = (v, ok) => v === undefined || (Array.isArray(v) && v.every(ok));
  const okKid = k => isObj(k) && typeof k.code === "string" && k.code !== "";
  if((kind === "backup" || kind === "archive") && !(listOk(data.records, r => isObj(r) && r.kid != null && !isNaN(new Date(r.at))) && listOk(data.kids, okKid) && listOk(data.kidsArchived, okKid)
    && (data.teach === undefined || isObj(data.teach)) && (data.settings === undefined || isObj(data.settings)))){
    $("#recMsg").textContent = "沒辦法匯入這個檔案：內容不完整或被改過（學生名單或作答紀錄的格式不對）。請用平台下載的原始備份檔。"; return;
  }
  if(kind === "backup" || kind === "archive"){
    const have = new Set(records.map(recKey)), recs = data.records || [];
    const add = recs.filter(r => !have.has(recKey(r))).length, wsN = Object.keys(data.wordsets || {}).length;
    text = `這是 ${savedDay(data)}下載的${kind === "archive" ? ` ${esc(data.archive)} 學年封存檔` : "備份檔"}，有 ${recs.length} 筆作答紀錄（其中 ${add} 筆是這台電腦還沒有的）、${(data.kids || []).length} 位學生${wsN ? `、${wsN} 課的字組` : ""}。
      ${kind === "archive" ? "封存檔只加回作答紀錄，現在的評量設定不會動。" : "匯入後，評量設定（正式評量的條件）也會換成檔案裡的。"}<br><span class="warn">這個檔案有學生資料，請不要寄給不相關的人。</span>`;
    doIt = () => restoreBackup(data);
  } else if(kind === "wordsets"){
    const plan = wsImportPlan(data.sets);
    text = `這是 ${savedDay(data)}存的字組檔，有 ${Object.keys(data.sets || {}).length} 課：${esc(Object.values(data.sets || {}).map(v => v.name).filter(Boolean).join("、"))}。字組檔沒有學生資料。`
      + (plan.skip.length ? `<br><span class="warn">${esc(plan.skip.join("、"))}：這台電腦的字組已經用在正式評量，不會被換掉（要換，請先在第 2 步按「重新開始一組」再匯入）。</span>` : "")
      + (plan.none.length ? `<br>${esc(plan.none.join("、"))}：這個版本的網頁沒有這一課的字，會略過。` : "");
    doIt = () => { wsImport(plan); render(); return `已匯入 ${plan.ok.length} 課的字組${plan.skip.length ? `，${plan.skip.length} 課沒有換掉` : ""}。到第 2 步選課次就會看到。`; };
  } else if(kind === "tablet"){
    /* 名單裡沒有的代號（2026-11-09 維護者決定，取代 2026-10-31「不收進來」）：搬家到新網站時，有些老師重新建立了學生，
       舊網站的平板紀錄代號就對不上。這些代號逐一列出來，附上作答線索，老師選「併入現有學生」「新增為新學生」或「略過」（預設略過）。
       併入、新增的舊代號記在學生的 oldCodes，之後再匯入同一份試算表會自動對到同一位學生，不用再選。封存的學生算「名單裡有」。 */
    const toKid = code => knownKid(code) ? code : (kidByOld(code) || {}).code;
    const unknownRecs = data.records.filter(r => r.kid && !toKid(r.kid));
    const unknown = [...new Set(unknownRecs.map(r => r.kid))];
    const plan = () => tabletAddList(data.records, toKid);
    const add0 = plan().length;
    text = `這是${data.sheet ? "從 Google 試算表下載的平板作答紀錄" : "平板上下載的紀錄檔（送不出去時用）"}：${esc(data.sessions)} 次練習、${data.records.length} 筆作答紀錄（其中 ${add0} 筆是這台電腦還沒有、而且學生在名單裡的）。`
      + (data.missing ? `<br><span class="warn">有 ${esc(data.missing)} 次練習少了一部分資料（可能沒有送完），收到的部分照樣匯入。</span>` : "")
      + (unknown.length ? `<br><span class="warn">有 ${unknown.length} 個代號不在這台電腦的學生名單裡（共 ${unknownRecs.length} 筆紀錄）。可能是舊網站的代號（老師重新建立學生後換了新代號），也可能是已經刪除的學生、別台電腦的學生。請在下面選每個代號要怎麼處理。</span>` : "");
    if(unknown.length){
      extra = unknownPanel(unknown, unknownRecs);
      check = () => unknownCheck(ask, unknown);
    }
    doIt = () => {
      /* 先處理名單裡沒有的代號：併入的把舊代號記到那位學生身上，新增的建立新學生（代號由系統產生） */
      const done = unknown.length ? unknownApply(ask, unknown, unknownRecs) : {merged:[], created:[], skipped:[]};
      const add = plan();
      /* 平板沒有學生名字，用這台電腦的學生名單補上 */
      add.forEach(r => { const k = kidBy(r.kid) || kidsArchived.find(x => x.code === r.kid); r.kidName = k ? k.name : ""; saveRecord(r); });
      /* 平板上抽到的貼紙，匯入時才收進貼紙簿（見 collect.js 的 importStickers） */
      const got = importStickers(add);
      render();
      const skipN = unknownRecs.filter(r => done.skipped.includes(r.kid)).length;
      return `已匯入 ${add.length} 筆新的作答紀錄（重複的紀錄不會再加一次）${got ? `，${got} 張貼紙收進學生的貼紙簿` : ""}。`
        + (done.merged.length ? `併入現有學生：${done.merged.join("、")}。` : "")
        + (done.created.length ? `新增學生：${done.created.join("、")}（到「學生名單」可以改年級）。` : "")
        + (done.skipped.length ? `略過的代號：${done.skipped.join("、")}（${skipN} 筆沒有匯入）。` : "");
    };
  } else { $("#recMsg").textContent = "這個檔案是比較新版本的網頁存的，請重新整理網頁後再匯入一次。"; return; }
  $("#recMsg").textContent = "";
  ask.innerHTML = `<p style="margin:0">${text}</p>${extra}<p style="margin:0"><b>要匯入嗎？</b></p>
    <div class="row"><button class="save" id="importYes">匯入</button><button class="ghost" id="importNo">取消</button></div>`;
  ask.hidden = false;
  ask.querySelectorAll("[data-oldpick]").forEach(s => s.onchange = () => { ask.querySelector(`[data-oldname="${s.dataset.oldpick}"]`).hidden = s.value !== "new"; });
  $("#importNo").onclick = () => { ask.hidden = true; $("#recMsg").textContent = "沒有匯入。"; };
  $("#importYes").onclick = async () => {
    const bad = check && check();
    if(bad){ $("#recMsg").textContent = bad; return; }
    ask.hidden = true;
    try { const msg = await doIt(); renderRecSheet(); $("#recMsg").textContent = msg; }
    catch(err){ $("#recMsg").textContent = `沒辦法匯入這個檔案：${err.message}`; }
  };
};
/* ---------- 平板紀錄裡名單沒有的代號（2026-11-09） ----------
   學生的 oldCodes：以前用過、匯入時老師指定給這位學生的舊代號（例如舊網站的代號）。只在匯入平板紀錄時用來對應，其他地方都用 code。 */
const kidByOld = code => [...kids, ...kidsArchived].find(k => (k.oldCodes || []).includes(code));
/* 要加進來的紀錄：代號換成名單裡的學生（toKid 找不到的不收），換完代號再判斷重複，同一份試算表匯入兩次也不會多一份 */
function tabletAddList(recs, toKid){
  const have = new Set(records.map(recKey)), out = [];
  for(const r of recs){
    const code = r.kid && toKid(r.kid);
    if(!code) continue;
    const r2 = code === r.kid ? r : {...r, kid:code};
    const key = recKey(r2);
    if(have.has(key)) continue;
    have.add(key); out.push(r2);
  }
  return out;
}
/* 學年：8 月到隔年 1 月算同一學年（和 data.js 的 SCHOOL_YEAR 同一個算法），用來推算新增學生的年級 */
const schoolYearOf = d => (d.getMonth() + 1 >= 8 ? d.getFullYear() : d.getFullYear() - 1) - 1911;
/* 每個代號一列：作答線索（幾次、幾題、日期、年級、課次、答對比例）＋怎麼處理的選單；新增學生時才出現名字欄 */
function unknownPanel(codes, recs){
  const opt = k => `<option value="k:${esc(k.code)}">${esc(kidLabel(k))}</option>`;
  const kidOpts = (kids.length ? `<optgroup label="併入現在名單的學生">${kids.map(opt).join("")}</optgroup>` : "")
    + (kidsArchived.length ? `<optgroup label="併入封存區的學生">${kidsArchived.map(opt).join("")}</optgroup>` : "");
  const rows = codes.map(code => {
    const rs = recs.filter(r => r.kid === code).sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const day = r => { const t = new Date(r.at); return isNaN(t) ? "" : `${t.getFullYear()}/${t.getMonth() + 1}/${t.getDate()}`; };
    const first = day(rs[0]), last = day(rs[rs.length - 1]);
    const grade = rs[rs.length - 1].grade, formal = rs.filter(r => r.kind === "formal").length;
    const lessons = [...new Set(rs.map(r => r.book && BOOKS[r.book] ? `${bookName(r.book)}${lessonName(r.book, String(r.lesson))}` : "").filter(Boolean))];
    const right = rs.filter(r => r.firstCorrect).length;
    const clue = [`${new Set(rs.map(r => r.session)).size} 次、${rs.length} 題`,
      first && (first === last ? first : `${first}～${last}`),
      grade && `${GRADES[grade - 1] || grade}年級`,
      lessons.length && (lessons.length > 3 ? `${lessons.slice(0, 3).join("、")} 等 ${lessons.length} 課` : lessons.join("、")),
      `第一次就答對 ${Math.round(right / rs.length * 100)}%`,
      formal && `其中正式評量 ${formal} 題`].filter(Boolean).join("・");
    return `<div class="arow"><span class="an">代號 ${esc(code)}<br><small>${esc(clue)}</small></span>
      <select data-oldpick="${esc(code)}" aria-label="代號 ${esc(code)} 要怎麼處理"><option value="skip">略過（不匯入）</option><option value="new">新增為新學生</option>${kidOpts}</select>
      <input data-oldname="${esc(code)}" hidden maxlength="20" placeholder="新學生的名字" aria-label="代號 ${esc(code)} 新學生的名字" style="border:2px solid var(--ink);border-radius:10px;padding:4px 8px;min-width:0">
    </div>`;
  }).join("");
  return `<div style="margin:8px 0">${rows}</div>
    <p class="note" style="margin:0 0 8px">併入現有學生：這個代號的紀錄、貼紙都算那位學生的（一位學生可以併入好幾個舊代號）。選好後，之後再匯入同一份試算表，這個代號會自動對到同一位學生。</p>`;
}
/* 按「匯入」前檢查：新學生要有名字、不能和現有學生或其他新學生同名（名字不能重複，見 data.js 的 nameTaken） */
function unknownCheck(ask, codes){
  const names = [];
  for(const code of codes){
    if(ask.querySelector(`[data-oldpick="${code}"]`).value !== "new") continue;
    const name = ask.querySelector(`[data-oldname="${code}"]`).value.trim();
    if(!name) return `代號 ${code} 選了「新增為新學生」，請填名字。`;
    const other = nameTaken(name);
    if(other) return `已經有一位叫「${name}」的學生${kidsArchived.includes(other) ? "（在封存區）" : ""}了。學生名字不能重複：是同一位學生的話，請改選「併入」這位學生；不是的話，請換一個名字。`;
    if(names.includes(name)) return `兩個代號都要新增叫「${name}」的學生。名字不能重複，請換一個名字。`;
    names.push(name);
  }
  return "";
}
/* 照老師的選擇處理：併入的把舊代號記到那位學生身上，新增的建立新學生（年級用最後一筆紀錄的年級推算到今年） */
function unknownApply(ask, codes, recs){
  const done = {merged:[], created:[], skipped:[]};
  let archTouched = false;
  for(const code of codes){
    const v = ask.querySelector(`[data-oldpick="${code}"]`).value;
    if(v === "skip"){ done.skipped.push(code); continue; }
    let k;
    if(v === "new"){
      const name = ask.querySelector(`[data-oldname="${code}"]`).value.trim();
      /* 最後一筆有年級的紀錄：記那一學年的年級，kidGrade 會自動升到今年；都沒有就先放二年級（和新增學生一樣） */
      const r = recs.filter(x => x.kid === code && x.grade && !isNaN(new Date(x.at))).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
      k = r ? {code:newKidCode(), name, grade:+r.grade, sy:schoolYearOf(new Date(r.at)), since:iso(new Date())}
            : {code:newKidCode(), name, grade:2, sy:SCHOOL_YEAR, since:iso(new Date())};
      kids.push(k); done.created.push(`${name}（舊代號 ${code}）`);
    } else {
      const c = v.slice(2);
      k = kids.find(x => x.code === c) || kidsArchived.find(x => x.code === c);
      if(!k){ done.skipped.push(code); continue; }
      if(kidsArchived.includes(k)) archTouched = true;
      done.merged.push(`${code} → ${kidLabel(k)}`);
    }
    k.oldCodes = [...new Set([...(k.oldCodes || []), code])];
  }
  saveKids(); if(archTouched) saveArchived();
  return done;
}
/* 匯入備份檔、封存檔：作答紀錄、學生名單、教學日期加進來（重複的不再加），評量設定換成檔案裡的 */
async function restoreBackup(data){
  const have = new Set(records.map(recKey));
  const add = (data.records || []).filter(r => !have.has(recKey(r)));
  add.forEach(saveRecord);
  /* 學生名單：沒有的加進來；這台電腦上同代號但還沒填名字的（例如舊版第一次打開時放的範例 S01、S02；2026-10-31 起新的電腦不再放範例學生），用備份檔裡的取代 */
  /* 封存區：這台電腦已經封存的學生不會被備份檔「叫回」現在名單；備份檔裡封存的，這台沒有才加進封存區（同一位學生不會兩邊都有，2026-10-31） */
  const arch = archivedCodes();
  for(const k of data.kids || []){ if(arch.has(k.code)) continue; const i = kids.findIndex(x => x.code === k.code);
    if(i < 0) kids.push(k); else if(!kids[i].name && k.name) kids[i] = k; }
  for(const k of data.kidsArchived || []) if(!knownKid(k.code)) kidsArchived.push(k);
  saveArchived();
  /* 教學日期：這台電腦沒有的課加進來；個別學生的設定也合併（這台電腦已有的不蓋掉） */
  for(const [k, v] of Object.entries(data.teach || {})){
    if(!teach[k]) teach[k] = v;
    else if(v.kids) teach[k].kids = {...v.kids, ...(teach[k].kids || {})};
  }
  saveKids(); saveTeach();
  /* 評量設定（正式評量的條件）跟著還原，換電腦後前後才能比較；畫面與聲音是每台電腦自己的，不動 */
  const FORMAL_KEYS = ["choices", "formalTheme", "clockFormal"];   /* A3-6、A3-10（2026-10-25）：正式評量不提示、不報讀，提示與報讀不再是設定 */
  /* 封存檔是舊學年的資料，不動現在的設定（2026-10-25 維護者決定）；備份檔才還原設定 */
  const isArchive = fileKind(data) === "archive";
  /* 檔案裡的值先檢查（2026-11-06）：選項數只收 3、4、6，開關只收是／否；不合規定的值不換，免得被改過的檔案弄壞正式評量的條件 */
  const FORMAL_OK = {choices: v => CHOICES.some(c => c[0] === v), formalTheme: v => typeof v === "boolean", clockFormal: v => typeof v === "boolean"};
  if(!isArchive && data.settings) FORMAL_KEYS.forEach(k => { if(data.settings[k] !== undefined && FORMAL_OK[k](data.settings[k])) settings[k] = data.settings[k]; });
  if(!isArchive) saveSettings();
  for(const p of BACKUP_PARTS) if(data[p.key]) await p.restore(data[p.key]);
  render();
  return `已匯入 ${add.length} 筆新的作答紀錄（重複的紀錄不會再加一次）${isArchive ? "，現在的評量設定沒有動" : "，評量設定也一起換成檔案裡的了"}。`;
}
$("#recClear").onclick = e => {
  const b = e.currentTarget;
  if(!b.classList.contains("armed")){ b.classList.add("armed"); b.textContent = "確定要刪除？再按一次"; return; }
  clearRecords(); renderRecSheet(); $("#recMsg").textContent = "已清除全部作答紀錄。";
};
