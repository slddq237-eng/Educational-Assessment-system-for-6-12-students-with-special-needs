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
function saveRecord(r){
  records.push(r);
  if(!recDb) return;
  try { const q = recDb.transaction(REC_STORE, "readwrite").objectStore(REC_STORE).add(r); q.onsuccess = () => { r.id = q.result; }; } catch(e){}
}
/* 改一筆已經存好的紀錄（例如結果畫面抽到貼紙後，把獎勵寫進去） */
function updateRecord(r){
  if(!recDb || r.id == null) return;
  try { recDb.transaction(REC_STORE, "readwrite").objectStore(REC_STORE).put(r); } catch(e){}
}
function clearRecords(){
  records = [];
  if(!recDb) return;
  try { recDb.transaction(REC_STORE, "readwrite").objectStore(REC_STORE).clear(); } catch(e){}
}
(async () => { recDb = await openRecDb(); records = await loadRecords(); $("#dbWarn").hidden = !!recDb; })();


/* =========================================================
   7. Excel 匯出、作答紀錄面板與備份
   ========================================================= */
/* Excel 欄位：標題 → 怎麼從紀錄取值 */
const yesNo = v => v ? "是" : "否";
/* 答錯規則的簡稱（Excel 用）；舊紀錄沒有這些欄位，顯示「未記錄」或「無」 */
const RULE_SHORT = {remove:"打叉", next:"提示", reveal:"顯示答案"};
const COLS = [
  ["日期時間", r => new Date(r.at).toLocaleString("zh-TW", {hour12:false})],
  ["學生代號", r => r.kid], ["名字", r => r.kidName], ["年級", r => r.grade], ["學習年級", r => r.studyGrade],
  ["正式或練習", r => r.kind === "formal" ? "正式評量" : "練習"],
  ["評量目標", r => `目標 ${r.goal}`], ["評量方式", r => r.mode === "flu" ? "流暢性" : "正確率"],
  ["時限（秒）", r => r.timeLimit], ["作答模式", r => (ANSWERS.find(a => a.id === r.answer) || {}).name || r.answer],
  ["出題方式", r => r.method === "all" ? "全部出題" : (METHODS.find(m => m.id === r.method) || {}).name || r.method],
  ["課本", r => r.bookName], ["課次", r => BOOKS[r.book] && BOOKS[r.book].lessons[r.lesson] ? lessonName(r.book, r.lesson) : r.lesson], ["目標字", r => r.char], ["語詞", r => r.word],
  ["常用字加題", r => yesNo(r.boost)], ["選項數", r => r.choices], ["全部選項", r => r.options],
  ["版面", r => r.layout === "bingo" ? "全課賓果卡" : "選項卡"],
  ["第一次選的字", r => r.firstPick], ["第一次就答對", r => yesNo(r.firstCorrect)], ["錯誤類型", r => r.errorType],
  ["最後答對", r => yesNo(r.passed)], ["顯示答案", r => yesNo(r.revealed)], ["答錯次數", r => r.wrongCount],
  ["提示層級", r => r.hintLevel], ["用到的提示", r => r.hints], ["老師提示", r => r.teacherPrompt],
  ["提示設定", r => r.hintSet === undefined ? "未記錄" : r.hintSet ? r.hintSet.split(",").map(hintName).join("→") : "無提示"],
  ["答錯規則", r => r.rule === undefined ? "未記錄" : r.rule === "none" ? "答錯就記錯" : r.rule.split(",").map(x => RULE_SHORT[x] || x).join("→")],
  ["第一次作答秒數", r => r.firstSec], ["答對秒數", r => r.correctSec ?? ""],
  ["評量時機", r => r.phase], ["教學後天數", r => r.daysAfter],
  ["主題", r => r.theme ? themeName(r.theme) : "無"], ["遊戲玩法", r => r.game || "無"], ["獎勵", r => r.reward || "無"]
];
const fileDate = t => { const d = new Date(t); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}_${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}`; };
function exportXlsx(list, filename, msgSel){
  if(!list.length){ $(msgSel).textContent = "沒有可以匯出的紀錄。"; return; }
  if(!window.XLSX){ $(msgSel).textContent = "Excel 元件沒有載入，請確認電腦有連上網路後重新整理。"; return; }
  const rows = list.map(r => Object.fromEntries(COLS.map(([h, f]) => [h, f(r)])));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "作答紀錄");
  try { XLSX.writeFile(wb, filename); $(msgSel).textContent = `已匯出 ${list.length} 筆紀錄。`; }
  catch(e){ $(msgSel).textContent = "這個環境不允許下載檔案，請用一般瀏覽器開啟網站再匯出。"; }
}

/* 作答紀錄面板：每一次評量一列 */
function renderRecSheet(){
  const by = new Map();
  for(const r of records){ if(!by.has(r.session)) by.set(r.session, []); by.get(r.session).push(r); }
  const sessions = [...by].sort((a, b) => b[0] - a[0]);
  $("#recInfo").textContent = recDb ? `這台電腦共有 ${records.length} 筆作答紀錄、${sessions.length} 次評量。` : "這台電腦的瀏覽器不允許存檔，只看得到這次打開網頁後的紀錄。";
  $("#recTable").innerHTML = sessions.length ? `<thead><tr><th>日期</th><th>學生</th><th>性質</th><th>方式</th><th>題數</th><th>第一次就答對</th></tr></thead><tbody>${
    sessions.slice(0, 50).map(([sid, rs]) => {
      const first = rs.filter(r => r.firstCorrect).length;
      return `<tr><td>${new Date(sid).toLocaleString("zh-TW", {hour12:false, month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit"})}</td>
        <td>${esc([...new Set(rs.map(r => r.kid))].join("、"))}</td><td>${rs[0].kind === "formal" ? "正式" : "練習"}</td>
        <td>${rs[0].mode === "flu" ? "流暢性" : "正確率"}</td><td>${rs.length}</td><td>${Math.round(first / rs.length * 100)}%</td></tr>`;
    }).join("")}</tbody>` : `<tbody><tr><td>還沒有作答紀錄。</td></tr></tbody>`;
  $("#recMsg").textContent = "";
  $("#recClear").classList.remove("armed"); $("#recClear").textContent = "清除全部紀錄";
}
$("#recXlsx").onclick = () => exportXlsx(records, `識字評量_全部紀錄_${fileDate(Date.now())}.xlsx`, "#recMsg");
/* 備份檔：把作答紀錄、學生名單、教學日期、設定存成一個檔案，換電腦時可以還原 */
/* 備份檔第 2 版：除了上面這些，其他模組（例如之後的貼紙收藏、頭像）可以用 addBackupPart() 把自己的資料加進來。
   第 1 版的舊備份檔沒有這些部分，照樣可以還原。 */
const BACKUP_PARTS = [];
const addBackupPart = (key, save, restore) => BACKUP_PARTS.push({key, save, restore});
$("#recBackup").onclick = async () => {
  const data = {app:"literacy", version:2, savedAt:new Date().toISOString(), settings, kids, teach, records: records.map(({id, ...r}) => r)};
  for(const p of BACKUP_PARTS){ try { data[p.key] = await p.save(); } catch(e){} }
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:"application/json"}));
    a.download = `識字評量_備份_${fileDate(Date.now())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    $("#recMsg").textContent = "已下載備份檔，請存到隨身碟或雲端硬碟。";
  } catch(e){ $("#recMsg").textContent = "這個環境不允許下載檔案，請用一般瀏覽器開啟網站再備份。"; }
};
$("#recRestore").onchange = async e => {
  const f = e.target.files[0]; e.target.value = "";
  if(!f) return;
  try {
    const data = JSON.parse(await f.text());
    if(data.app !== "literacy") throw new Error("不是識字評量的備份檔");
    const have = new Set(records.map(r => `${r.session}|${r.at}|${r.kid}|${r.char}`));
    const add = (data.records || []).filter(r => !have.has(`${r.session}|${r.at}|${r.kid}|${r.char}`));
    add.forEach(saveRecord);
    for(const k of data.kids || []) if(!kidBy(k.code)) kids.push(k);
    for(const [k, v] of Object.entries(data.teach || {})) if(!teach[k]) teach[k] = v;
    saveKids(); saveTeach();
    for(const p of BACKUP_PARTS) if(data[p.key]) await p.restore(data[p.key]);
    renderRecSheet(); $("#recMsg").textContent = `已還原 ${add.length} 筆新的作答紀錄（重複的紀錄不會再加一次）。`; render();
  } catch(err){ $("#recMsg").textContent = `沒辦法讀取這個檔案：${err.message}`; }
};
$("#recClear").onclick = e => {
  const b = e.currentTarget;
  if(!b.classList.contains("armed")){ b.classList.add("armed"); b.textContent = "確定要刪除？再按一次"; return; }
  clearRecords(); renderRecSheet(); $("#recMsg").textContent = "已清除全部作答紀錄。";
};
