/* =========================================================
   識字評量：老師專區（teacher.js）
   三個分頁：一位學生（選單逐步選，每次一張圖或一張表）、全班總表、進階分析（在 pivot.js）。
   每個分頁上方有「這一頁怎麼用？」，結果下方有「這張圖怎麼看？」；完整說明在 analysis-guide.html（分析教學）。
   原則（2026-10-20 定案）：
   - 分析一律用「時期」（基線期／教學中／教學後／維持期），用的是作答當下記下的時期。
   - 「中途結束」的紀錄一律不算；預設只看正式評量。
   - 每個圖都有「看明細」表格，數字也能從表格讀到（不用滑鼠移上去才看得到）。
   ========================================================= */

/* =========================================================
   15. 老師專區：選單狀態與資料篩選
   ========================================================= */
const TEACH_UI = "literacy-teacher";
const T = Object.assign({tab:"one", kid:"", metric:"acc", view:"time", axis:"date", range:"term", from:"", to:"",
  kind:"formal", goal:"", book:"", lesson:"", gap:"after", top:"300"}, load(TEACH_UI, {}));
const saveT = () => store(TEACH_UI, T);
const hasFreq = () => typeof FREQ !== "undefined";

/* 看什麼：trend＝可以依時間／課別／時期看變化；list＝用排序表或分布呈現 */
const METRICS = [
  {id:"acc",   name:"正確率", kind:"trend", what:"第一次就答對的比例（錯誤率＝100% 減掉它）"},
  {id:"sec",   name:"反應時間", kind:"trend", what:"題目唸完到答對的平均秒數，越短越熟"},
  {id:"flu",   name:"流暢性", kind:"trend", what:"流暢性模式每分鐘答對幾個"},
  {id:"gap",   name:"間隔", kind:"list", what:"隔多久再考，正確率有沒有掉"},
  {id:"miss",  name:"常錯字排序", kind:"list", what:"錯誤率最高的字排在最前面"},
  {id:"freq",  name:"高字頻生字", kind:"list", what:"常用字的錯誤率", need:"freq"},
  {id:"etype", name:"錯誤類型", kind:"list", what:"第一次選錯時，選到的是哪一類的字"},
  {id:"hint",  name:"提示層級", kind:"list", what:"需要多少幫助才答對（0＝不用提示）"}
];
const VIEWS = [["time","依時間"],["lesson","依課別"],["phase","依時期比較"]];
const RANGES = [["term","本學期"],["last","上學期"],["all","全部"],["custom","自訂日期"]];
const KINDS_F = [["formal","正式評量"],["practice","練習"],["both","全部"]];
const PHASE_ORDER = [...PHASES, "未判斷"];
const ETYPES = ["同詞易混","同音","形近","同部件","課文字","其他字"];   /* 同部件只出現在目標 4-1 部件重組 */
const GAP_BUCKETS = {
  after: {name:"教學後天數", what:"該課教學結束到這次評量隔幾天", list:["教學前或教學中","0～6 天","7～13 天","14～29 天","30 天以上"]},
  prev:  {name:"距上次評量天數", what:"同一個字上次考到這次隔幾天", list:["第一次考","同一天","1～6 天","7～13 天","14～29 天","30 天以上"]}
};

/* 日期小工具 */
const dayOf = r => iso(new Date(r.at));
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / DAY);
const shortDay = s => { const d = parse(s); return `${d.getMonth()+1}/${d.getDate()}`; };
/* 學期的起訖：back＝0 本學期、1 上學期。上學期 8/1～1/31，下學期 2/1～7/31 */
function termRange(back){
  let y = SCHOOL_YEAR + 1911, t = TERM;
  for(let i = 0; i < back; i++){ if(t === "上"){ t = "下"; y--; } else t = "上"; }
  return t === "上" ? [`${y}-08-01`, `${y+1}-01-31`] : [`${y+1}-02-01`, `${y+1}-07-31`];
}
function rangeDates(){
  if(T.range === "term") return termRange(0);
  if(T.range === "last") return termRange(1);
  if(T.range === "custom") return [T.from || "0000-01-01", T.to || "9999-12-31"];
  return ["0000-01-01", "9999-12-31"];
}
const rangeText = () => { const [a, b] = rangeDates(); return T.range === "all" ? "全部日期" : `${a.startsWith("0000") ? "最早" : a}～${b.startsWith("9999") ? "現在" : b}`; };

/* 距上次評量天數：同一位學生、同一個字，依時間排好後和前一筆比（只算有效紀錄） */
let prevCache = null, prevCacheLen = -1;
function prevGap(r){
  if(prevCacheLen !== records.length){
    prevCache = new Map(); prevCacheLen = records.length;
    const by = new Map();
    for(const x of records) if(!x.quit){ const k = x.kid + "|" + x.char; if(!by.has(k)) by.set(k, []); by.get(k).push(x); }
    for(const list of by.values()){
      list.sort((a, b) => a.at < b.at ? -1 : 1);
      list.forEach((x, i) => prevCache.set(x, i ? daysBetween(dayOf(list[i-1]), dayOf(x)) : null));
    }
  }
  return prevCache.get(r);
}
function gapBucket(r, type){
  if(type === "after"){
    const d = r.daysAfter;
    if(d === "" || d == null) return "教學前或教學中";
    return d < 7 ? "0～6 天" : d < 14 ? "7～13 天" : d < 30 ? "14～29 天" : "30 天以上";
  }
  const d = prevGap(r);
  if(d == null) return "第一次考";
  return d === 0 ? "同一天" : d < 7 ? "1～6 天" : d < 14 ? "7～13 天" : d < 30 ? "14～29 天" : "30 天以上";
}

/* 依選單篩出這次要分析的紀錄（kidFilter＝false 時不篩學生，全班總表用） */
function filtered(kidFilter = true){
  const [a, b] = rangeDates();
  return records.filter(r => !r.quit
    && (!kidFilter || r.kid === T.kid)
    && (T.kind === "both" || r.kind === T.kind)
    && (!T.goal || r.goal === T.goal)
    && (!T.book || r.book === T.book)
    && (!T.lesson || r.lesson === T.lesson)
    && dayOf(r) >= a && dayOf(r) <= b);
}

/* 指標的算法（每個都回傳 {v, n}：數值與用了幾筆紀錄） */
const pct = (a, b) => b ? Math.round(a / b * 100) : null;
const avg = a => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length * 10) / 10 : null;
const accOf = rs => ({v: pct(rs.filter(r => r.firstCorrect).length, rs.length), n: rs.length});
const secOf = rs => { const s = rs.filter(r => r.passed && typeof r.correctSec === "number").map(r => r.correctSec); return {v: avg(s), n: s.length}; };
/* 流暢性：每一回合（同一次評量、同一位學生）一個值＝第一次就答對的題數 × 60 ÷ 時限秒數 */
function rounds(rs){
  const by = new Map();
  for(const r of rs) if(r.mode === "flu" && r.timeLimit){ const k = r.session + "|" + r.kid; if(!by.has(k)) by.set(k, []); by.get(k).push(r); }
  return [...by.values()].map(list => ({rs:list, at:list[0].at, perMin: Math.round(list.filter(r => r.firstCorrect).length * 60 / +list[0].timeLimit),
    aim: list[0].aim || null}));
}
const fluOf = rs => { const rd = rounds(rs); return {v: avg(rd.map(x => x.perMin)), n: rd.length}; };
const METRIC_FN = {acc: accOf, sec: secOf, flu: fluOf};
const fmt = (m, v) => v == null ? "—" : m === "acc" ? `${v}%` : m === "sec" ? `${v} 秒` : `${v} 個／分`;
const unitN = m => m === "flu" ? "回合" : "題";

/* =========================================================
   16. 老師專區：選單畫面
   ========================================================= */
const chipRow = (list, cur, key, extra = () => "") => list.map(([v, t]) => `<button class="chip ${cur === v ? "on" : ""}" data-${key}="${v}" aria-pressed="${cur === v}" ${extra(v)}>${t}</button>`).join("");
function kidsWithData(){ const have = new Set(records.filter(r => !r.quit).map(r => r.kid)); return kids.filter(k => have.has(k.code)); }

function renderTeacher(){
  $("#tTabs").innerHTML = chipRow([["one","一位學生"],["class","全班總表"],["pivot","進階分析（研究用）"]], T.tab, "ttab");
  renderTabHelp();
  $("#tTabs").querySelectorAll("[data-ttab]").forEach(b => b.onclick = () => { T.tab = b.dataset.ttab; saveT(); renderTeacher(); });
  const withData = kidsWithData();
  if(!kidBy(T.kid) && withData.length) T.kid = withData[0].code;
  $("#tRangeBox").hidden = T.tab === "pivot";
  renderRangeMenu();
  if(T.tab === "one") renderOne();
  else if(T.tab === "class") renderClass();
  else renderPivot();
}

/* 每個分頁上方的「這一頁怎麼用？」：平常收起來，打開後記住（換分頁也維持打開） */
const TAB_HELP = {
  one: ["看一位學生的進步。由上往下選：看誰 → 看什麼 → 怎麼看，下面再選日期和課次範圍。", [
    "<b>正確率</b>＝第一次就點對的比例（越高越好）；<b>反應時間</b>＝題目唸完到答對的秒數（越短越熟）；<b>流暢性</b>＝計時挑戰每分鐘答對幾個。",
    "<b>依時期比較</b>最直接看介入有沒有效：基線期（還沒教）→ 教學中 → 教學後 → 維持期（教完 7 天以上）。",
    "結果區的「看明細」是圖上每個數字的表格；任何一個字都可以點，看那個字的每一次作答。",
    "找不到資料時，先把日期改成「全部」、性質改成「全部」。"], "one"],
  class: ["一眼看全班：每一列是一位學生，每一欄是一個字。", [
    "格子大字＝第一次就答對的比例，小字＝作答次數；藍色越深越好，「—」＝還沒考過。",
    "直著看一欄：全班都淺色的字，可能字本身難或教學要調整；橫著看一列：哪位學生需要個別加強。",
    "點格子看那位學生那個字的每一次作答。"], "class"],
  pivot: ["自己決定怎麼分組比較，做法像 Excel 的樞紐分析表：先選要算的數字（指標），再選怎麼分組（列、欄）。", [
    "不知道怎麼選？先按上方的<b>範例</b>，每個範例都附「這在回答什麼、怎麼看」。",
    "<b>列</b>＝表格每一橫列是一組；<b>欄</b>＝每一直欄是一組（可以不選）；每一格是那一組的數字，小字是用了幾筆紀錄。",
    "<b>篩選</b>＝只留下某一種紀錄（例如只看小明）；<b>分組</b>＝全部留下、分開算。",
    "淡色格子筆數太少，數字容易因為多對一題就大變，僅供參考。"], "pivot"]
};
function renderTabHelp(){
  const [lead, list, anchor] = TAB_HELP[T.tab], el = $("#tHelp");
  el.innerHTML = `<summary>這一頁怎麼用？</summary><p>${lead}</p><ul>${list.map(x => `<li>${x}</li>`).join("")}</ul>
    <p><a href="analysis-guide.html#${anchor}" target="_blank" rel="noopener">看完整的分析教學（名詞解釋、範例）</a></p>`;
  el.open = !!T.helpOpen;
  el.ontoggle = () => { if(T.helpOpen !== el.open){ T.helpOpen = el.open; saveT(); } };
}

/* 範圍選單（一位學生、全班總表共用） */
function renderRangeMenu(){
  const books = [...new Set(records.map(r => r.book))].filter(b => BOOKS[b]).sort((a, b) => BOOK_ORDER.indexOf(a) - BOOK_ORDER.indexOf(b));
  const goals = [...new Set(records.map(r => r.goal))].sort();
  $("#tRange").innerHTML = `
    <div class="trow"><span class="tl">日期</span>${chipRow(RANGES, T.range, "trange")}
      ${T.range === "custom" ? `<label>從 <input type="date" id="tFrom" value="${T.from}"></label><label>到 <input type="date" id="tTo" value="${T.to}"></label>` : ""}
      <span class="note" style="margin:0">${esc(rangeText())}</span></div>
    <div class="trow"><span class="tl">性質</span>${chipRow(KINDS_F, T.kind, "tkind")}</div>
    <div class="trow"><span class="tl">課次</span>
      <select id="tBook" aria-label="課本"><option value="">全部課本</option>${books.map(b => `<option value="${b}" ${T.book === b ? "selected" : ""}>${esc(bookName(b))}</option>`).join("")}</select>
      ${T.book ? `<select id="tLesson" aria-label="課次"><option value="">全部課次</option>${Object.keys(BOOKS[T.book].lessons).map(n => `<option value="${n}" ${T.lesson === n ? "selected" : ""}>${esc(lessonName(T.book, n))}</option>`).join("")}</select>` : ""}
      ${goals.length > 1 ? `<select id="tGoal" aria-label="評量目標"><option value="">全部目標</option>${goals.map(g => `<option value="${g}" ${T.goal === g ? "selected" : ""}>目標 ${g}</option>`).join("")}</select>` : ""}</div>`;
  const re = () => { saveT(); renderTeacher(); };
  $("#tRange").querySelectorAll("[data-trange]").forEach(b => b.onclick = () => { T.range = b.dataset.trange; re(); });
  $("#tRange").querySelectorAll("[data-tkind]").forEach(b => b.onclick = () => { T.kind = b.dataset.tkind; re(); });
  if($("#tFrom")) $("#tFrom").onchange = e => { T.from = e.target.value; re(); };
  if($("#tTo")) $("#tTo").onchange = e => { T.to = e.target.value; re(); };
  $("#tBook").onchange = e => { T.book = e.target.value; T.lesson = ""; re(); };
  if($("#tLesson")) $("#tLesson").onchange = e => { T.lesson = e.target.value; re(); };
  if($("#tGoal")) $("#tGoal").onchange = e => { T.goal = e.target.value; re(); };
}

/* 一位學生：看誰 → 看什麼 → 怎麼看（只有趨勢類才需要） */
function renderOne(){
  const withData = kidsWithData();
  const metrics = METRICS.filter(m => m.need !== "freq" || hasFreq());
  if(!metrics.find(m => m.id === T.metric)) T.metric = "acc";
  const M = METRICS.find(m => m.id === T.metric);
  $("#tMenu").innerHTML = `
    <div class="trow"><span class="tl">看誰</span>${withData.length ? chipRow(withData.map(k => [k.code, esc(kidLabel(k))]), T.kid, "tkid") : `<span class="note" style="margin:0">還沒有作答紀錄。學生做過評量後，這裡就會出現名字。</span>`}</div>
    <div class="trow"><span class="tl">看什麼</span>${chipRow(metrics.map(m => [m.id, m.name]), T.metric, "tmetric")}<span class="note" style="margin:0">${esc(M.what)}</span></div>
    ${M.kind === "trend" ? `<div class="trow"><span class="tl">怎麼看</span>${chipRow(VIEWS, T.view, "tview")}
      ${T.view === "time" ? `<span class="sep"></span>${chipRow([["date","橫軸：測驗日期"],["teach","橫軸：教學開始後第幾天"]], T.axis, "taxis")}` : ""}</div>` : ""}
    ${M.id === "gap" ? `<div class="trow"><span class="tl">哪一種間隔</span>${chipRow(Object.entries(GAP_BUCKETS).map(([k, g]) => [k, g.name]), T.gap, "tgap")}</div>` : ""}
    ${M.id === "freq" ? `<div class="trow"><span class="tl">常用字範圍</span>${chipRow([["100","前 100 名"],["300","前 300 名"],["1000","前 1000 名"]], T.top, "ttop")}</div>` : ""}`;
  const re = () => { saveT(); renderTeacher(); };
  $("#tMenu").querySelectorAll("[data-tkid]").forEach(b => b.onclick = () => { T.kid = b.dataset.tkid; re(); });
  $("#tMenu").querySelectorAll("[data-tmetric]").forEach(b => b.onclick = () => { T.metric = b.dataset.tmetric; re(); });
  $("#tMenu").querySelectorAll("[data-tview]").forEach(b => b.onclick = () => { T.view = b.dataset.tview; re(); });
  $("#tMenu").querySelectorAll("[data-taxis]").forEach(b => b.onclick = () => { T.axis = b.dataset.taxis; re(); });
  $("#tMenu").querySelectorAll("[data-tgap]").forEach(b => b.onclick = () => { T.gap = b.dataset.tgap; re(); });
  $("#tMenu").querySelectorAll("[data-ttop]").forEach(b => b.onclick = () => { T.top = b.dataset.ttop; re(); });
  const rs = withData.length ? filtered() : [];
  const out = rs.length ? (M.kind === "trend" ? trendView(rs, M.id) : LIST_VIEWS[M.id](rs)) : null;
  if(out) out.howto = howTo(M);
  showResult(out, rs.length ? "" : withData.length ? "這個範圍裡沒有紀錄。可以把日期改成「全部」，或把性質改成「全部」。" : "");
}

/* 結果區：3 個重點數字＋一張圖或一張表＋「看明細」＋匯出 */
let tCurrent = null;
function showResult(out, empty){
  tCurrent = out;
  $("#tResult").innerHTML = !out ? `<p class="hint">${esc(empty)}</p>` : `
    <h3 class="ttitle">${esc(out.title)}</h3>
    <div class="tstats">${out.tiles.map(([label, value, sub]) => `<div class="tstat"><span>${esc(label)}</span><b>${esc(value)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`).join("")}</div>
    <div class="tchart">${out.chart || ""}</div>
    ${out.note ? `<p class="note">${out.note}</p>` : ""}
    ${out.howto ? `<details class="why howto"><summary>這張圖怎麼看？</summary>${out.howto}</details>` : ""}
    <details class="tdetail" ${out.open ? "open" : ""}><summary>看明細（表格）</summary>${detailTable(out.cols, out.rows)}</details>
    <div class="row" style="margin-top:12px"><button class="ghost" id="tExport">匯出這個畫面（Excel）</button><span class="note" id="tMsg" style="margin:0"></span></div>`;
  if(!out) return;
  bindChart($("#tResult"));
  $("#tResult").querySelectorAll("[data-char]").forEach(el => el.onclick = () => openCharLog(el.dataset.kid || T.kid, el.dataset.char));
  $("#tExport").onclick = () => exportRows(out.cols, out.rows, out.title, "#tMsg");
}
/* 「這張圖怎麼看？」：依看什麼、怎麼看給不同的說明 */
function howTo(M){
  const better = {acc:"越高越好", sec:"越低越好（越快越熟）", flu:"越高越好"}[M.id];
  const more = a => `<p><a href="analysis-guide.html#${a}" target="_blank" rel="noopener">更多說明</a></p>`;
  if(M.kind === "trend"){
    if(T.view === "lesson") return `<p>每一條是一課，長度是那一課全部作答合起來的${esc(M.name)}（${better}）。括號是用了幾題。比較哪一課比較難，可以優先複習。</p>${more("one")}`;
    if(T.view === "phase") return `<p>每一條是一個時期，${esc(M.name)}${better}。理想的樣子：基線期低 → 教學中升高 → 教學後更高 → 維持期仍然高（學了有記住）。</p>
      <p>括號是筆數；某個時期只有幾題時，數字容易大幅變動，先多評量幾次再下結論。時期是作答當下判斷的。</p>${more("one")}`;
    return `<p>一個點＝一次評量（流暢性是一回合），${esc(M.name)}${better}。虛線＝時期改變的地方，上方標時期；直線＝本學期安排的學扶、資源班開始日${M.id === "flu" ? "；水平線＝目標每分鐘幾個" : ""}。滑鼠移到點上看數字。</p>
      <ul><li><b>水準</b>：每個時期大約在多高？</li><li><b>趨勢</b>：時期裡的點往上、持平還是往下？基線期已經一直往上的話，很難說進步是教學造成的。</li>
      <li><b>穩定</b>：點有沒有忽高忽低？基線期最好至少 3 次而且穩定。</li><li><b>立即效果</b>：教學開始後頭幾個點，是不是馬上和基線期不同。</li></ul>${more("one")}`;
  }
  return {
    gap: `<p>依間隔天數分組，每一條是那一組第一次就答對的比例。間隔越長、比例掉越多，表示越需要早一點複習。「教學前或教學中」那一組可以當對照。</p>`,
    miss: `<p>錯誤率最高的字排最前面（第一次就選錯的比例），一樣時作答次數多的在前。看「最常選錯成」：同音字多要加強聽音辨字，形近字多要比較字形。點字看每一次作答。</p>`,
    freq: `<p>常用字依字頻排名排序，條越長錯越多。先確保最常用的字都會。</p>`,
    etype: `<p>第一次選錯時，選到哪一類的字。同音多→多做聽音辨字、用語詞區分；形近多→比較字形、部件；同詞易混多→語詞裡每個字的位置還不穩；同部件多（部件重組）→部件的位置和組合還不熟。</p>`,
    hint: `<p>每一題用到的最高提示：0＝不用提示，1～3＝系統給，4～7＝老師按的按鈕。介入有效時，「0 不用提示」的比例應該越來越高。</p>`
  }[M.id] + more("lists");
}
/* 明細表：cols＝[[標題, 取值函式, 可以點的字？]] */
function detailTable(cols, rows){
  return `<div class="tablewrap"><table class="rec"><thead><tr>${cols.map(c => `<th>${esc(c[0])}</th>`).join("")}</tr></thead><tbody>${
    rows.map(r => `<tr>${cols.map(c => { const v = c[1](r); return `<td>${c[2] ? charLink(r.char || v, r.kid) : esc(v ?? "")}</td>`; }).join("")}</tr>`).join("")
  }</tbody></table></div>`;
}
const charLink = (c, kid) => `<button class="charlink" data-char="${esc(c)}" ${kid ? `data-kid="${esc(kid)}"` : ""} title="看「${esc(c)}」的學習紀錄">${esc(c)}</button>`;
function exportRows(cols, rows, title, msgSel){
  exportSheet(rows.map(r => Object.fromEntries(cols.map(c => [c[0], c[1](r) ?? ""]))), title, `識字評量_${title}_${fileDate(Date.now())}.xlsx`, msgSel);
}
/* 匯出一張或多張工作表：sheets＝[{name, rows}] 或單一 rows */
function exportSheet(rows, name, filename, msgSel, more = []){
  setMsg(msgSel, "準備匯出…");
  loadXlsx().then(() => writeSheet(rows, name, filename, msgSel, more), () => { setMsg(msgSel, "Excel 元件載入失敗，請重新整理網頁再試一次。"); });
}
function writeSheet(rows, name, filename, msgSel, more){
  const wb = XLSX.utils.book_new(), safe = s => s.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "工作表";
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{"說明":"沒有資料"}]), safe(name));
  more.forEach(s => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{"說明":"沒有資料"}]), safe(s.name)));
  try { XLSX.writeFile(wb, filename.replace(/[\\/?*:|"<>]/g, "")); setMsg(msgSel, `已匯出 ${rows.length} 列。`); }
  catch(e){ setMsg(msgSel, "這個環境不允許下載檔案，請用一般瀏覽器開啟網站再匯出。"); }
}

/* =========================================================
   17. 老師專區：趨勢（依時間／依課別／依時期）
   ========================================================= */
const groupBy = (list, keyFn) => { const m = new Map(); for(const x of list){ const k = keyFn(x); if(k == null) continue; if(!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
const lessonLabel = k => { const [b, n] = splitKey(k); return BOOKS[b] ? `${bookName(b)} ${lessonName(b, n)}` : k; };
const phaseOf = r => r.phase || "未判斷";
/* 一群紀錄最常見的時期（同一次評量含多課時可能不同） */
const mainPhase = rs => { const c = {}; rs.forEach(r => c[phaseOf(r)] = (c[phaseOf(r)] || 0) + 1); return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; };

function trendView(rs, m){
  const fn = METRIC_FN[m], k = kidBy(T.kid), who = k ? kidLabel(k) : T.kid;
  const src = m === "flu" ? rs.filter(r => r.mode === "flu") : rs;
  if(m === "flu" && !src.length) return {title:`${who}・流暢性`, tiles:[["流暢性回合","0",""]], chart:"",
    /* 計時挑戰算練習：只看正式評量時看不到，提醒老師切換「性質」 */
    note: T.kind === "formal" ? "正式評量沒有流暢性紀錄。計時挑戰算練習，請把上面的「性質」切到「練習」或「全部」。" : "這個範圍沒有流暢性模式（計時挑戰）的紀錄。", cols:[], rows:[]};
  const all = fn(src), mName = METRICS.find(x => x.id === m).name;
  let groups, chart, cols, note = "";
  if(T.view === "time" && T.axis === "teach"){
    /* 教學開始後第幾天：每筆紀錄依它那一課的教學開始日對齊 */
    /* 每位學生用自己的教學開始日（有個別設定就用個別的） */
    const withStart = src.filter(r => teachFor(key(r.book, r.lesson), r.kid).start);
    const g = groupBy(withStart, r => daysBetween(teachFor(key(r.book, r.lesson), r.kid).start, dayOf(r)));
    groups = [...g].sort((a, b) => a[0] - b[0]).map(([d, list]) => ({x:d, label: d < 0 ? `開始前 ${-d} 天` : `第 ${d} 天`, rs:list, phase: mainPhase(list), ...fn(list)}));
    note = `只有輸入過教學日期的課才能這樣對齊（${withStart.length} / ${src.length} ${unitN("acc")}）。0＝教學開始那一天。`;
    chart = lineChart(groups, {metric:m, xLabel: d => d < 0 ? `${d}` : `${d}`, events:[{x:0, label:"教學開始"}], xName:"教學開始後第幾天"});
  } else if(T.view === "time"){
    /* 測驗日期：每一次評量一個點（流暢性是每一回合）。
       橫軸照評量先後排、每次一格（2026-10-24 維護者回報：原本照日期排，同一天玩幾次點會疊成一條直線）；
       只在換日的那一點標日期，同一天第二次起標「第 2 次」 */
    const g = groupBy(src, r => r.session), perDay = {};
    groups = [...g].sort((a, b) => a[0] - b[0]).map(([s, list], i) => {
      const d = dayOf(list[0]), nth = perDay[d] = (perDay[d] || 0) + 1;
      return {x:i, day:d, nth, rs:list, phase: mainPhase(list), ...fn(list)};
    });
    groups.forEach(p => p.label = perDay[p.day] > 1 ? `${p.day} 第 ${p.nth} 次` : p.day);
    chart = lineChart(groups, {metric:m, xLabel: i => groups[i].nth === 1 ? shortDay(groups[i].day) : "", events: planEvents(groups), xName:"測驗日期（每次評量一格）",
      aim: m === "flu" ? (rounds(src).map(x => x.aim).filter(Boolean).pop() || null) : null});
    if(Object.values(perDay).some(n => n > 1)) note = "同一天評量好幾次時，每次各畫一個點；橫軸每格是一次評量，不代表相隔幾天。";
  } else if(T.view === "lesson"){
    const g = groupBy(src, r => key(r.book, r.lesson));
    const order = k => { const [b, n] = splitKey(k); return BOOK_ORDER.indexOf(b) * 1000 + (+n); };
    groups = [...g].sort((a, b) => order(a[0]) - order(b[0])).map(([kk, list]) => ({label: lessonLabel(kk), rs:list, ...fn(list)}));
    chart = barChart(groups, {metric:m});
  } else {
    const g = groupBy(src, phaseOf);
    groups = PHASE_ORDER.filter(p => g.has(p)).map(p => ({label:p, rs:g.get(p), ...fn(g.get(p))}));
    chart = barChart(groups, {metric:m});
    note = "時期是作答當下依教學日期或年級判斷的結果。";
  }
  const viewName = T.view === "time" ? (T.axis === "teach" ? "依教學開始後天數" : "依測驗日期") : T.view === "lesson" ? "依課別" : "依時期";
  const last = groups[groups.length - 1];
  cols = [[T.view === "lesson" ? "課次" : T.view === "phase" ? "時期" : "日期", g => g.label], ...(T.view === "time" ? [["時期", g => g.phase]] : []),
    [mName, g => fmt(m, g.v)], [m === "flu" ? "回合數" : m === "sec" ? "答對題數" : "題數", g => g.n]];
  return {title:`${who}・${mName}（${viewName}）`, chart, note, cols, rows:groups,
    tiles:[[m === "flu" ? "流暢性回合" : "作答題數", `${m === "flu" ? all.n : src.length}`, `${rangeText()}`],
      [m === "acc" ? "第一次就答對" : m === "sec" ? "平均答對秒數" : "平均每分鐘答對", fmt(m, all.v), m === "acc" && all.v != null ? `錯誤率 ${100 - all.v}%` : ""],
      [T.view === "time" ? "最近一次" : "最後一組", last ? fmt(m, last.v) : "—", last ? last.label : ""]]};
}
/* 教學安排的開始日（原班、資源班、學習扶助），畫成直線 */
function planEvents(groups){
  const k = kidBy(T.kid); if(!k || !groups.length) return [];
  const out = [];
  /* 橫軸是評量順序：直線畫在開始日之後第一次評量的前面（半格） */
  for(const p of Object.values(k.plans || {})) for(const v of SERVICES){
    const s = p[v.id + "Start"]; if(!s) continue;
    const i = groups.findIndex(g => g.day >= s);
    if(i > 0) out.push({x: i - 0.5, label:`${v.name}開始`});
  }
  return out;
}

/* ---------- 圖：折線圖（依時間） ----------
   一條線（單一學生、單一指標），2px 線、8px 點；時期改變的地方畫虛線並在上方標時期；
   直線＝教學安排開始日；流暢性有目標線。滑鼠或鍵盤移到點上會顯示數字。 */
const SVGW = 760;
function niceMax(v){ if(v <= 5) return 5; const p = Math.pow(10, Math.floor(Math.log10(v))); for(const m of [1, 2, 2.5, 5, 10]) if(m * p >= v) return m * p; return 10 * p; }
/* 縱軸刻度：分成 4 格，每格是 1、2、5 的整數倍（例如 0、1、2、3、4 秒），不會出現 1.3、3.8 這種數字 */
function niceTicks(v){
  const raw = Math.max(v, 0.4) / 4, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map(m => m * p).find(s => s >= raw);
  return [0, 1, 2, 3, 4].map(i => Math.round(i * step * 100) / 100);
}
/* 橫軸標籤縮短：日期只留月/日，月份寫成「9 月」 */
const shortAxis = s => { s = String(s); let m = s.match(/^\d{4}-(\d{2})-(\d{2})/); if(m) return `${+m[1]}/${+m[2]}`; m = s.match(/^\d{4}-(\d{2})$/); return m ? `${+m[1]} 月` : s.slice(0, 8); };
function lineChart(pts, o){
  const H = 300, L = 52, R = 20, Tp = 30, B = 38, iw = SVGW - L - R, ih = H - Tp - B;
  const ys = pts.map(p => p.v).filter(v => v != null);
  const ticks = o.metric === "acc" ? [0, 25, 50, 75, 100] : niceTicks(Math.max(...ys, o.aim || 0) * 1.05), max = ticks[4];
  const xs = pts.map(p => p.x).concat((o.events || []).map(e => e.x));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), span = x1 - x0 || 1;
  const X = x => pts.length === 1 && !(o.events || []).length ? L + iw / 2 : L + (x - x0) / span * iw, Y = v => Tp + ih - v / max * ih;
  const unit = o.metric === "acc" ? "%" : o.metric === "sec" ? " 秒" : "";
  let g = ticks.map(t => `<line class="grid" x1="${L}" x2="${SVGW - R}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${L - 8}" y="${Y(t) + 4}" text-anchor="end">${t}${unit}</text>`).join("");
  /* 時期分隔與標籤 */
  const segs = []; pts.forEach((p, i) => { if(!i || p.phase !== pts[i-1].phase) segs.push({phase:p.phase, from:i, to:i}); else segs[segs.length - 1].to = i; });
  segs.forEach((s, i) => {
    const a = i ? (X(pts[s.from - 1].x) + X(pts[s.from].x)) / 2 : L, b = i < segs.length - 1 ? (X(pts[s.to].x) + X(pts[s.to + 1].x)) / 2 : SVGW - R;
    if(i) g += `<line class="phaseline" x1="${a}" x2="${a}" y1="${Tp - 18}" y2="${Tp + ih}"/>`;
    g += `<text class="phasename" x="${(a + b) / 2}" y="${Tp - 8}" text-anchor="middle">${esc(s.phase)}</text>`;
  });
  (o.events || []).forEach(e => { const x = X(e.x); g += `<line class="event" x1="${x}" x2="${x}" y1="${Tp}" y2="${Tp + ih}"/><text class="eventname" x="${x + 4}" y="${Tp + ih - 6}">${esc(e.label)}</text>`; });
  if(o.aim) g += `<line class="aim" x1="${L}" x2="${SVGW - R}" y1="${Y(o.aim)}" y2="${Y(o.aim)}"/><text class="eventname" x="${SVGW - R}" y="${Y(o.aim) - 6}" text-anchor="end">目標每分鐘 ${o.aim} 個</text>`;
  /* 線與點（數值是空的點不畫） */
  const ok = pts.filter(p => p.v != null);
  const path = ok.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");
  g += `<path class="line" d="${path}"/>`;
  g += ok.map(p => `<circle class="dot" cx="${X(p.x)}" cy="${Y(p.v)}" r="5" tabindex="0" data-tip="${esc(`${p.label}｜${p.phase}｜${fmt(o.metric, p.v)}（${p.n} ${unitN(o.metric)}）`)}"/>`).join("");
  /* 最後一點標數字（只標一個，其餘看表格或移上去看）；前一點太近就不標，避免疊在一起 */
  const lp = ok[ok.length - 1], lp0 = ok[ok.length - 2];
  const below = o.aim && Math.abs(Y(lp ? lp.v : 0) - Y(o.aim)) < 24 && lp.v < o.aim;   /* 靠近目標線時把數字放到點的下面 */
  if(lp && (!lp0 || X(lp.x) - X(lp0.x) > 44)) g += `<text class="endlabel" x="${Math.min(X(lp.x), SVGW - R - 4)}" y="${Y(lp.v) + (below ? 26 : -12)}" text-anchor="${X(lp.x) > SVGW - 80 ? "end" : "middle"}">${fmt(o.metric, lp.v)}</text>`;
  /* 橫軸標籤：和前一個標籤至少隔 48 像素才標，日期靠很近時不會疊在一起 */
  let lastX = -1e9;
  g += pts.map(p => { const x = X(p.x), t = o.xLabel(p.x); if(!t || x - lastX < 48) return ""; lastX = x; return `<text class="ax" x="${x}" y="${H - 14}" text-anchor="middle">${esc(t)}</text>`; }).join("");
  g += `<text class="ax" x="${SVGW - R}" y="${H - 1}" text-anchor="end">${esc(o.xName)}</text>`;
  return `<div class="chartbox"><svg viewBox="0 0 ${SVGW} ${H}" role="img" aria-label="折線圖，數字請看下方明細表">${g}<line class="cross" y1="${Tp}" y2="${Tp + ih}" hidden/></svg><div class="ttip" hidden></div></div>`;
}
/* ---------- 圖：橫條圖（依課別、依時期、分布） ---------- */
function barChart(rows, o){
  const bh = 22, gap = 14, L = 170, R = 150, H = rows.length * (bh + gap) + 10;
  const max = o.metric === "acc" || o.pct ? 100 : niceMax(Math.max(...rows.map(r => r.v || 0), 1));
  const iw = SVGW - L - R;
  const bar = (x, y, w, h) => w < 1 ? "" : `M${x} ${y}H${x + Math.max(0, w - 4)}Q${x + w} ${y} ${x + w} ${y + 4}V${y + h - 4}Q${x + w} ${y + h} ${x + Math.max(0, w - 4)} ${y + h}H${x}Z`;
  const g = rows.map((r, i) => { const y = 6 + i * (bh + gap), w = (r.v || 0) / max * iw;
    const txt = o.label ? o.label(r) : `${fmt(o.metric, r.v)}（${r.n} ${unitN(o.metric)}）`;
    return `<text class="barname" x="${L - 10}" y="${y + bh / 2 + 5}" text-anchor="end">${esc(r.label.length > 12 ? r.label.slice(0, 12) + "…" : r.label)}</text>
      <line class="grid" x1="${L}" x2="${L}" y1="${y - 4}" y2="${y + bh + 4}"/>
      <g class="barhit" tabindex="0" data-tip="${esc(`${r.label}｜${txt}`)}"><rect x="${L}" y="${y - gap / 2}" width="${iw + R}" height="${bh + gap}" fill="transparent"/>
      <path class="bar" d="${bar(L, y, w, bh)}"/></g>
      <text class="barval" x="${L + w + 8}" y="${y + bh / 2 + 5}">${esc(txt)}</text>`; }).join("");
  return `<div class="chartbox"><svg viewBox="0 0 ${SVGW} ${H}" role="img" aria-label="橫條圖，數字請看下方明細表">${g}</svg><div class="ttip" hidden></div></div>`;
}
/* 滑鼠／鍵盤提示：折線圖找最近的點，橫條圖整列都可以碰 */
function bindChart(root){
  root.querySelectorAll(".chartbox").forEach(box => {
    const tip = box.querySelector(".ttip"), svg = box.querySelector("svg"), cross = box.querySelector(".cross");
    const show = (el, cx) => {
      tip.textContent = el.dataset.tip; tip.hidden = false;
      const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
      tip.style.left = `${Math.min(r.left - b.left + r.width / 2, b.width - 10)}px`; tip.style.top = `${r.top - b.top}px`;
      box.querySelectorAll(".on").forEach(x => x.classList.remove("on")); el.classList.add("on");
      if(cross && cx != null){ cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.hidden = false; }
    };
    const hide = () => { tip.hidden = true; if(cross) cross.hidden = true; box.querySelectorAll(".on").forEach(x => x.classList.remove("on")); };
    const dots = [...box.querySelectorAll(".dot")];
    if(dots.length) svg.addEventListener("pointermove", e => {
      const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const loc = p.matrixTransform(svg.getScreenCTM().inverse());
      const d = dots.reduce((a, b) => Math.abs(b.cx.baseVal.value - loc.x) < Math.abs(a.cx.baseVal.value - loc.x) ? b : a);
      show(d, d.cx.baseVal.value);
    });
    box.querySelectorAll(".barhit").forEach(b => b.addEventListener("pointerenter", () => show(b)));
    box.querySelectorAll("[data-tip]").forEach(el => { el.addEventListener("focus", () => show(el, el.cx ? el.cx.baseVal.value : null)); el.addEventListener("blur", hide); });
    svg.addEventListener("pointerleave", hide);
  });
}

/* =========================================================
   18. 老師專區：排序類與分布（間隔、常錯字、高字頻、錯誤類型、提示層級）
   ========================================================= */
function whoTitle(name){ const k = kidBy(T.kid); return `${k ? kidLabel(k) : T.kid}・${name}`; }
/* 每個字的統計：作答次數、第一次就答對率、最常選錯成哪個字 */
function charStats(rs){
  const by = groupBy(rs, r => r.char);
  return [...by].map(([c, list]) => {
    const wrong = list.filter(r => !r.firstCorrect), conf = {};
    wrong.forEach(r => { if(r.firstPick) conf[r.firstPick] = (conf[r.firstPick] || 0) + 1; });
    const top = Object.entries(conf).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const r0 = list[list.length - 1];
    return {char:c, kid:r0.kid, word:r0.word, lesson:lessonLabel(key(r0.book, r0.lesson)), n:list.length, wrong:wrong.length,
      err: pct(wrong.length, list.length), acc: pct(list.length - wrong.length, list.length), conf: top.map(([x, n]) => `${x}（${n}）`).join("、"), sec: secOf(list).v};
  });
}
/* 和隨機猜比較：每一題選錯時，如果是在干擾字裡隨便猜，各類字被選到的機會＝那類字在干擾字裡占幾分之幾。
   把每一題的機會加起來，就是「隨機猜的話預期幾次」。選項的類別用 play.js 的 optType 依現在的教材重新判斷（紀錄只存了選項的字） */
function chanceOf(wrong){
  const exp = {};
  wrong.forEach(r => {
    const opts = [...(r.options || "")].filter(x => x !== r.char);
    if(!opts.length) return;
    opts.forEach(x => {
      let t; try { t = optType(r.char, x, key(r.book, r.lesson), r.goal); } catch(e){ t = "其他字"; }
      if(t !== "答案") exp[t] = (exp[t] || 0) + 1 / opts.length;
    });
  });
  return exp;
}
/* 目標字在語詞的哪個位置（例如「蘋果」的「蘋」在詞首、「果」在詞尾）；單字或沒有語詞回傳空字串。進階分析也用 */
const WPOS_ORDER = ["詞首（第 1 個字）", "詞中", "詞尾（最後一個字）", "單字或沒有語詞"];
const wposOf = r => { const w = [...(r.word || "")], i = w.indexOf(r.char); return w.length < 2 || i < 0 ? "" : i === 0 ? WPOS_ORDER[0] : i === w.length - 1 ? WPOS_ORDER[2] : WPOS_ORDER[1]; };
/* 錯誤類型說明的最後一段：目標字在詞首、詞尾時的第一次就答對率與同詞易混次數（語詞是整塊記的學生，常常一邊比較穩） */
function wposNote(rs){
  const g = groupBy(rs.filter(r => wposOf(r) && r.goal !== "4-1"), wposOf);
  const parts = WPOS_ORDER.filter(p => g.has(p)).map(p => {
    const list = g.get(p), a = accOf(list), mix = list.filter(r => !r.firstCorrect && r.errorType === "同詞易混").length;
    return `${p}：第一次就答對 ${fmt("acc", a.v)}（${a.n} 題），同詞易混 ${mix} 次`;
  });
  return parts.length > 1 ? `<br>目標字在語詞的位置——${esc(parts.join("；"))}。兩邊差很多（例如詞首穩、詞尾常選成同詞的另一字），代表語詞還是整塊記，字還沒從詞裡分出來。` : "";
}
const LIST_VIEWS = {
  gap(rs){
    const G = GAP_BUCKETS[T.gap], g = groupBy(rs, r => gapBucket(r, T.gap));
    const rows = G.list.filter(b => g.has(b)).map(b => ({label:b, rs:g.get(b), ...accOf(g.get(b))}));
    const best = rows.filter(r => r.n >= 5).sort((a, b) => b.v - a.v)[0];
    return {title: whoTitle(`間隔：${G.name}`), chart: barChart(rows, {metric:"acc"}), rows,
      note: `${esc(G.what)}。每一條是那個間隔的第一次就答對比例。`,
      cols:[[G.name, r => r.label], ["第一次就答對", r => fmt("acc", r.v)], ["題數", r => r.n]],
      tiles:[["作答題數", `${rs.length}`, rangeText()], ["分成幾組", `${rows.length}`, G.name], ["正確率最高（至少 5 題）", best ? fmt("acc", best.v) : "—", best ? best.label : "資料還不夠"]]};
  },
  miss(rs){
    const list = charStats(rs).sort((a, b) => b.err - a.err || b.n - a.n);
    const rows = list.slice(0, 30), wrongChars = list.filter(x => x.wrong);
    return {title: whoTitle("常錯字排序"), open:true,
      chart: barChart(rows.slice(0, 12).map(x => ({label:`${x.char}　${x.word || ""}`, v:x.err, n:x.n})), {pct:true, label: r => `錯 ${r.v}%（${r.n} 次）`}),
      note: "依錯誤率排序（第一次就選錯的比例），一樣時作答次數多的排前面。點字可以看那個字的每一次作答。",
      cols:[["字", r => r.char, true], ["語詞", r => r.word], ["課次", r => r.lesson], ["作答次數", r => r.n], ["錯誤率", r => `${r.err}%`], ["最常選錯成", r => r.conf], ["平均答對秒數", r => r.sec ?? "—"]], rows,
      tiles:[["作答的字", `${list.length} 個`, rangeText()], ["錯過的字", `${wrongChars.length} 個`, list.length ? `占 ${pct(wrongChars.length, list.length)}%` : ""], ["錯最多的字", wrongChars[0] ? wrongChars[0].char : "—", wrongChars[0] ? `錯誤率 ${wrongChars[0].err}%` : "都答對了"]]};
  },
  freq(rs){
    const top = +T.top, list = charStats(rs).filter(x => FREQ[x.char] && FREQ[x.char] <= top).sort((a, b) => FREQ[a.char] - FREQ[b.char]);
    const all = accOf(rs.filter(r => FREQ[r.char] && FREQ[r.char] <= top));
    return {title: whoTitle(`高字頻生字（前 ${top} 名）`), open:true,
      chart: barChart(list.slice(0, 15).map(x => ({label:`${x.char}（第 ${FREQ[x.char]} 名）`, v:x.err, n:x.n})), {pct:true, label: r => `錯 ${r.v}%（${r.n} 次）`}),
      cols:[["字頻排名", r => FREQ[r.char]], ["字", r => r.char, true], ["作答次數", r => r.n], ["錯誤率", r => `${r.err}%`], ["最常選錯成", r => r.conf]], rows:list,
      tiles:[["常用字的作答", `${all.n} 題`, `前 ${top} 名`], ["常用字錯誤率", all.v == null ? "—" : `${100 - all.v}%`, ""], ["考到的常用字", `${list.length} 個`, ""]]};
  },
  etype(rs){
    const wrong = rs.filter(r => !r.firstCorrect && r.errorType), g = groupBy(wrong, r => r.errorType);
    const exp = chanceOf(wrong), expAll = Object.values(exp).reduce((a, b) => a + b, 0);
    const rows = ETYPES.filter(t => g.has(t) || exp[t]).map(t => {
      const v = g.has(t) ? g.get(t).length : 0, e = exp[t] || 0;
      return {label:t, v, n:v, share:pct(v, wrong.length), chance: expAll ? pct(e, expAll) : null, ratio: e ? Math.round(v / e * 10) / 10 : null};
    });
    const conf = {}; wrong.forEach(r => { const k = `${r.char}→${r.firstPick}`; conf[k] = (conf[k] || 0) + 1; });
    const pairs = Object.entries(conf).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => k.replace("→", " 選成 ") + `（${n} 次）`).join("、");
    const top = rows.slice().sort((a, b) => b.v - a.v)[0];
    /* 特別容易搞混的類別：至少 3 次、而且實際比例是亂猜會佔的 1.5 倍以上（倍數只拿來判斷，不顯示） */
    const over = rows.filter(r => r.v >= 3 && r.ratio >= 1.5).sort((a, b) => b.ratio - a.ratio);
    return {title: whoTitle("錯誤類型"), chart: barChart(rows, {label: r => `${r.v} 次（${r.share}%）${r.chance == null ? "" : `・亂猜會佔 ${r.chance}%`}`}), rows,
      note: `第一次就選錯時，選到的是哪一類的字。同詞易混＝同一個語詞裡的另一個字（例如「新聞」的「聞」）；同部件＝有相同部件的字（只在部件重組）。`
        + `<br>「亂猜會佔」：如果學生不會、亂猜一個，這類字大概會被點到幾 %（例如 3 個選項裡只有 1 個同詞易混字，亂猜選錯時就有一半會點到它）。實際比例是它的 1.5 倍以上、又至少錯 3 次，會列在上方「特別容易搞混」：代表學生不是亂猜，而是一直把這類字當成答案。（字屬於哪一類是照現在的教材判斷，教材改過的話可能稍有出入。）`
        + `${pairs ? `<br>最常搞混：${esc(pairs)}` : ""}${wposNote(rs)}`,
      cols:[["錯誤類型", r => r.label], ["次數", r => r.v], ["比例", r => `${r.share}%`], ["亂猜會佔", r => r.chance == null ? "—" : `${r.chance}%`]],
      tiles:[["第一次就選錯", `${wrong.length} 題`, `共 ${rs.length} 題`], ["最常見", top ? top.label : "—", top ? `${top.share}%` : "沒有錯誤"],
        ["特別容易搞混", over.length ? over.map(r => r.label).join("、") : "—", over.length ? `${over[0].label}：實際 ${over[0].share}%，亂猜會佔 ${over[0].chance}%` : wrong.length < 5 ? "樣本數不夠" : "看不出錯誤類型，接近亂猜"]]};
  },
  hint(rs){
    const g = groupBy(rs, r => r.hintLevel || 0), levels = [...g.keys()].sort((a, b) => a - b);
    const name = lv => lv === 0 ? "0 不用提示" : lv <= 3 ? `${lv} 系統提示` : `${lv} ${TEACHER_BTNS.find(t => t[0] === lv)[1]}`;
    const rows = levels.map(lv => ({label:name(lv), level:lv, v:g.get(lv).length, n:g.get(lv).length, share:pct(g.get(lv).length, rs.length)}));
    const used = rs.filter(r => r.hintLevel > 0).length;
    return {title: whoTitle("提示層級"), chart: barChart(rows, {label: r => `${r.v} 題（${r.share}%）`}), rows,
      note: "每一題記的是用到的最高提示層級：1～3 是系統給的（語詞、圖片、部件等），4～7 是老師按的按鈕。基線期固定不給提示。",
      cols:[["提示層級", r => r.label], ["題數", r => r.v], ["比例", r => `${r.share}%`]],
      tiles:[["作答題數", `${rs.length}`, rangeText()], ["用到提示", `${pct(used, rs.length)}%`, `${used} 題`], ["平均提示層級", `${avg(rs.map(r => r.hintLevel || 0))}`, "0＝都不用提示"]]};
  }
};

/* =========================================================
   19. 全班總表（學生 × 生字，格子是第一次就答對的比例）
   ========================================================= */
function renderClass(){
  const rs = filtered(false), kidList = kidsWithData().filter(k => rs.some(r => r.kid === k.code));
  $("#tMenu").innerHTML = "";
  if(!rs.length){ showResult(null, "這個範圍裡沒有紀錄。可以把日期改成「全部」，或把性質改成「全部」。"); return; }
  /* 字的順序：依課本、課次、課本裡的順序 */
  const order = new Map(); BOOK_ORDER.forEach((b, bi) => Object.keys(BOOKS[b].lessons).forEach(n => charsOf(key(b, n)).forEach((c, ci) => { const k = c; if(!order.has(k)) order.set(k, bi * 1e6 + (+n) * 1e3 + ci); })));
  const chars = [...new Set(rs.map(r => r.char))].sort((a, b) => (order.get(a) ?? 9e9) - (order.get(b) ?? 9e9));
  const cell = new Map(); for(const r of rs){ const k = r.kid + "|" + r.char; if(!cell.has(k)) cell.set(k, []); cell.get(k).push(r); }
  /* 顏色只用一種藍色，越深越好（不用紅黃綠，避免看起來像警告燈） */
  const shade = v => v == null ? "" : v >= 80 ? "c4" : v >= 60 ? "c3" : v >= 40 ? "c2" : "c1";
  const table = `<div class="tablewrap classgrid"><table class="rec"><thead><tr><th>學生</th><th>全部</th>${chars.map(c => `<th class="ch">${esc(c)}</th>`).join("")}</tr></thead><tbody>${
    kidList.map(k => { const mine = rs.filter(r => r.kid === k.code), a = accOf(mine);
      return `<tr><th>${esc(kidLabel(k))}</th><td><b>${fmt("acc", a.v)}</b></td>${chars.map(c => { const list = cell.get(k.code + "|" + c); if(!list) return `<td class="na">—</td>`;
        const v = accOf(list).v; return `<td class="${shade(v)}"><button class="charlink cellbtn" data-char="${esc(c)}" data-kid="${esc(k.code)}" title="${esc(`${kidLabel(k)}「${c}」：第一次就答對 ${v}%（${list.length} 次）`)}">${v}%<small>${list.length}</small></button></td>`; }).join("")}</tr>`; }).join("")}</tbody></table></div>`;
  const rows = []; kidList.forEach(k => chars.forEach(c => { const list = cell.get(k.code + "|" + c); if(list) rows.push({kid:k.code, name:kidLabel(k), char:c, ...accOf(list)}); }));
  const all = accOf(rs);
  tCurrent = null;
  $("#tResult").innerHTML = `<h3 class="ttitle">全班總表（第一次就答對的比例）</h3>
    <div class="tstats"><div class="tstat"><span>學生</span><b>${kidList.length} 位</b><small>${esc(rangeText())}</small></div>
      <div class="tstat"><span>考過的字</span><b>${chars.length} 個</b></div><div class="tstat"><span>全班第一次就答對</span><b>${fmt("acc", all.v)}</b><small>${all.n} 題</small></div></div>
    <p class="note">格子裡大字是第一次就答對的比例，小字是作答次數；藍色越深越好（白色＝不到 40%，最深＝80% 以上）。點格子看那位學生那個字的每一次作答。學習成效一覽（習得／精熟／維持）等判斷標準定好後再加上。</p>
    ${table}
    <div class="row" style="margin-top:12px"><button class="ghost" id="tExport">匯出全班總表（Excel）</button><span class="note" id="tMsg" style="margin:0"></span></div>`;
  $("#tResult").querySelectorAll("[data-char]").forEach(el => el.onclick = () => openCharLog(el.dataset.kid, el.dataset.char));
  $("#tExport").onclick = () => {
    const wide = kidList.map(k => Object.fromEntries([["學生", kidLabel(k)], ["全部", fmt("acc", accOf(rs.filter(r => r.kid === k.code)).v)],
      ...chars.map(c => { const l = cell.get(k.code + "|" + c); return [c, l ? `${accOf(l).v}%（${l.length}）` : ""]; })]));
    exportSheet(wide, "全班總表", `識字評量_全班總表_${fileDate(Date.now())}.xlsx`, "#tMsg",
      [{name:"逐格資料", rows: rows.map(r => ({"學生": r.name, "字": r.char, "第一次就答對（%）": r.v, "作答次數": r.n}))}]);
  };
}

/* =========================================================
   20. 逐字學習紀錄（任何畫面點一個字）
   ========================================================= */
function openCharLog(kid, c){
  const k = kidBy(kid), list = records.filter(r => r.kid === kid && r.char === c).sort((a, b) => a.at < b.at ? -1 : 1);
  const valid = list.filter(r => !r.quit), a = accOf(valid);
  const res = r => r.firstCorrect ? "✓ 第一次就對" : r.passed ? `✗ 錯 ${r.wrongCount} 次後答對` : r.revealed ? "✗ 顯示答案" : "✗ 答錯";
  const rows = list.map(r => ({...r, day:dayOf(r), gap:prevGap(r)}));
  const cols = [["日期", r => r.day], ["性質", r => (r.kind === "formal" ? "正式" : "練習") + (r.quit ? "・中途結束（不列入）" : "")], ["時期", r => r.phase || "未判斷"],
    ["目標", r => `目標 ${r.goal}`], ["方式", r => r.mode === "flu" ? "流暢性" : "正確率"], ["結果", res], ["第一次選", r => r.firstPick],
    ["錯誤類型", r => r.errorType || ""], ["第一次秒數", r => r.firstSec ?? ""], ["答對秒數", r => r.correctSec ?? ""], ["提示層級", r => r.hintLevel || 0],
    ["教學後天數", r => r.daysAfter === "" || r.daysAfter == null ? "" : r.daysAfter], ["距上次（天）", r => r.quit ? "" : r.gap ?? "第一次"]];
  $("#cTitle").textContent = `「${c}」的學習紀錄`;
  $("#cBody").innerHTML = `<p class="hint" style="margin:0">${esc(k ? kidLabel(k) : kid)}・${esc(list[0] ? list[0].word || "" : "")}・共 ${list.length} 次（有效 ${valid.length} 次，第一次就答對 ${fmt("acc", a.v)}）。這裡列出全部日期、正式和練習都包含。</p>
    ${detailTable(cols, rows)}`;
  $("#cExport").onclick = () => exportRows(cols, rows, `「${c}」學習紀錄`, "#cMsg");
  $("#cMsg").textContent = "";
  openSheet("#charSheet");
}

$("#openTeacher").onclick = () => { renderTeacher(); showScreen("#teacher"); };
$("#teacherBack").onclick = () => showScreen("#setup");
