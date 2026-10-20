/* =========================================================
   識字評量：進階分析（pivot.js）
   給有研究需求的老師交叉比對，做法像 Excel 的「樞紐分析表」：
   選一個指標，選「列」（第 1 個分組）和「欄」（第 2 個分組，可不選），系統算出每一格的數字。
   每一格都附上筆數；筆數太少的格子變淡，提醒「資料太少，僅供參考」。
   「中途結束」的紀錄一律不算。
   ========================================================= */

/* =========================================================
   21. 進階分析：可以分組的欄位、可以算的指標
   ========================================================= */
const weekOf = r => { const d = parse(dayOf(r)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return `${iso(d)} 那週`; };
const freqGroup = r => { const f = hasFreq() && FREQ[r.char]; return !f ? "沒有字頻資料" : f <= 100 ? "前 100 名" : f <= 300 ? "101～300 名" : f <= 1000 ? "301～1000 名" : "1000 名以後"; };
const ruleText = r => r.rule === undefined ? "未記錄" : r.rule === "none" ? "答錯就記錯" : r.rule.split(",").map(x => RULE_SHORT[x] || x).join("→");
const hintSetText = r => r.hintSet === undefined ? "未記錄" : r.hintSet ? r.hintSet.split(",").map(hintName).join("→") : "無提示";
/* [名稱, 取值, 固定順序（選填）] */
const DIMS = {
  char:      ["字", r => r.char],
  kid:       ["學生", r => { const k = kidBy(r.kid); return k ? kidLabel(k) : r.kid; }],
  phase:     ["時期", r => r.phase || "未判斷", PHASE_ORDER],
  lesson:    ["課別", r => lessonLabel(key(r.book, r.lesson))],
  book:      ["課本", r => r.bookName || r.book],
  goal:      ["評量目標（題目類型）", r => `目標 ${r.goal}`],
  mode:      ["評量方式", r => r.mode === "flu" ? "流暢性" : "正確率"],
  choices:   ["選項數", r => `${r.choices} 個選項`],
  layout:    ["版面（呈現方法）", r => r.layout === "bingo" ? "全課賓果卡" : "選項卡"],
  answer:    ["作答模式", r => (ANSWERS.find(a => a.id === r.answer) || {}).name || r.answer],
  hintSet:   ["提示方法（當時設定）", hintSetText],
  rule:      ["答錯規則", ruleText],
  hintLevel: ["用到的提示層級", r => `層級 ${r.hintLevel || 0}`],
  etype:     ["第一次的結果／錯誤類型", r => r.firstCorrect ? "第一次就對" : r.errorType || "其他"],
  theme:     ["主題", r => r.theme ? themeName(r.theme) : "無"],
  game:      ["遊戲玩法", r => gameName(r.game)],
  hearts:    ["血量模式（愛心）", r => r.hpMax ? `${r.hpMax} 顆愛心` : "沒有"],
  bpmf:      ["選項注音", r => r.bpmf ? "有注音" : "沒有"],
  read:      ["報讀提示", r => !r.read ? "沒有開" : r.readUsed ? "有按報讀" : "有開、沒按"],
  kind:      ["正式或練習", r => r.kind === "formal" ? "正式評量" : "練習"],
  gapAfter:  ["教學後天數（分組）", r => gapBucket(r, "after"), GAP_BUCKETS.after.list],
  gapPrev:   ["距上次評量（分組）", r => gapBucket(r, "prev"), GAP_BUCKETS.prev.list],
  week:      ["日期（週）", weekOf],
  month:     ["日期（月）", r => dayOf(r).slice(0, 7)],
  boost:     ["常用字加題", r => r.boost ? "常用字加題" : "一般題"],
  fontScale: ["作答字的大小", r => r.fontScale ? (FONT_SIZES.find(f => f[0] === r.fontScale) || [, r.fontScale])[1] : "未記錄"],
  freq:      ["字頻（分組）", freqGroup, ["前 100 名","101～300 名","301～1000 名","1000 名以後","沒有字頻資料"]]
};
const dimList = () => Object.entries(DIMS).filter(([k]) => k !== "freq" || hasFreq());
/* [名稱, 計算（回傳 {v, n}）, 單位] */
const avgOf = (rs, f) => { const a = rs.map(f).filter(x => typeof x === "number" && !isNaN(x)); return {v: avg(a), n: a.length}; };
const PMETRICS = {
  n:       ["筆數（題數）", rs => ({v: rs.length, n: rs.length}), ""],
  acc:     ["第一次就答對率", accOf, "%"],
  err:     ["錯誤率（第一次就選錯）", rs => { const a = accOf(rs); return {v: a.v == null ? null : 100 - a.v, n: a.n}; }, "%"],
  sec:     ["平均答對秒數（反應時間）", secOf, " 秒"],
  first:   ["平均第一次作答秒數", rs => avgOf(rs, r => r.firstSec), " 秒"],
  flu:     ["每分鐘答對（流暢性）", fluOf, " 個"],
  hint:    ["平均提示層級", rs => avgOf(rs, r => r.hintLevel || 0), ""],
  hintUse: ["用到提示的比例", rs => ({v: pct(rs.filter(r => r.hintLevel > 0).length, rs.length), n: rs.length}), "%"],
  reveal:  ["顯示答案的比例", rs => ({v: pct(rs.filter(r => r.revealed).length, rs.length), n: rs.length}), "%"],
  after:   ["平均教學後天數（間隔）", rs => avgOf(rs, r => r.daysAfter === "" ? NaN : +r.daysAfter), " 天"],
  prev:    ["平均距上次評量天數（間隔）", rs => avgOf(rs, r => prevGap(r) ?? NaN), " 天"]
};
/* 範例：一鍵套用常見的比較，附「這在回答什麼、怎麼看」（說明也寫在 analysis-guide.html 第 6 節） */
const PIVOT_BASE = {col:"", kind:"formal", from:"", to:"", f1:"", v1:"", f2:"", v2:"", firstOnly:false, minN:5, sort:"name", chart:"bar"};
const PIVOT_EXAMPLES = [
  {id:"effect", name:"介入有沒有效", cfg:{metric:"acc", row:"phase", col:"kid"},
    read:"看每一欄（每位學生）從基線期到教學後、維持期有沒有升高。維持期還很高＝學了有記住。"},
  {id:"speed", name:"有沒有越來越熟練", cfg:{metric:"sec", row:"phase", col:"kid"},
    read:"正確率已經很高時，答對秒數變短代表更自動化。"},
  {id:"hard", name:"哪些字最難", cfg:{metric:"err", row:"char", sort:"desc", minN:3},
    read:"排在最上面、又不是淡色的字，是學生最容易錯的字。點字可以看是誰錯、選成什麼。"},
  {id:"etype", name:"常犯哪一種錯", cfg:{metric:"n", row:"etype", col:"phase"},
    read:"每一欄是一個時期，「第一次就對」應該越來越多；某一類錯誤一直很多，教學可以針對它。"},
  {id:"forget", name:"學完多久會忘", cfg:{metric:"acc", row:"gapAfter", chart:"line"},
    read:"線往右下掉得越快，越需要早一點複習。「教學前或教學中」那一組是對照。"},
  {id:"start", name:"起點能力", cfg:{metric:"acc", row:"lesson", col:"kid", firstOnly:true},
    read:"每個字只看第一次遇到時的表現，比較不受練習次數影響，適合安排教學順序。"},
  {id:"theme", name:"主題會不會影響表現", cfg:{metric:"sec", row:"theme", f1:"phase", v1:"基線期"},
    read:"同一時期裡，各主題的數字應該差不多；差很多時要想想主題是不是讓學生分心。"},
  {id:"hints", name:"哪種提示方法較有幫助", cfg:{metric:"hintUse", row:"hintSet", f1:"phase", v1:"教學中"},
    read:"只能當參考：提示方法不是隨機分配的，差異也可能來自不同學生或不同課。"}
];
const PIVOT_UI = "literacy-pivot", PIVOT_SAVED = "literacy-pivots";
const P = Object.assign({metric:"acc", row:"phase", ...PIVOT_BASE, ex:""}, load(PIVOT_UI, {}));
const saveP = () => store(PIVOT_UI, P);

/* =========================================================
   22. 進階分析：篩選、分組、計算
   ========================================================= */
function pivotRecords(){
  let rs = records.filter(r => !r.quit && (P.kind === "both" || r.kind === P.kind)
    && (!P.from || dayOf(r) >= P.from) && (!P.to || dayOf(r) <= P.to)
    && (!P.f1 || !P.v1 || DIMS[P.f1][1](r) === P.v1) && (!P.f2 || !P.v2 || DIMS[P.f2][1](r) === P.v2));
  /* 每位學生每個字只算第一次作答（例如看教學前的起點） */
  if(P.firstOnly){ const seen = new Set(); rs = rs.slice().sort((a, b) => a.at < b.at ? -1 : 1).filter(r => { const k = r.kid + "|" + r.char; if(seen.has(k)) return false; seen.add(k); return true; }); }
  return rs;
}
function orderValues(dim, values){
  const fixed = DIMS[dim][2];
  return [...values].sort((a, b) => fixed ? (fixed.indexOf(a) + 1 || 99) - (fixed.indexOf(b) + 1 || 99) : String(a).localeCompare(String(b), "zh-Hant", {numeric:true}));
}
function computePivot(){
  const rs = pivotRecords(), fn = PMETRICS[P.metric][1];
  const rowOf = DIMS[P.row][1], colOf = P.col ? DIMS[P.col][1] : () => "全部";
  const cells = new Map();
  for(const r of rs){ const k = rowOf(r) + "\u0001" + colOf(r); if(!cells.has(k)) cells.set(k, []); cells.get(k).push(r); }
  let rows = orderValues(P.row, new Set(rs.map(rowOf)));
  const cols = P.col ? orderValues(P.col, new Set(rs.map(colOf))) : ["全部"];
  const get = (rv, cv) => { const list = cells.get(rv + "\u0001" + cv); return list ? fn(list) : null; };
  const total = rv => fn(rs.filter(r => rowOf(r) === rv));
  if(P.sort !== "name") rows = rows.slice().sort((a, b) => { const x = total(a).v ?? -1, y = total(b).v ?? -1; return P.sort === "desc" ? y - x : x - y; });
  return {rs, rows, cols, get, total, colTotal: cv => fn(rs.filter(r => colOf(r) === cv)), all: fn(rs)};
}

/* =========================================================
   23. 進階分析：畫面
   ========================================================= */
const opt = (list, cur, blank) => (blank ? `<option value="">${blank}</option>` : "") + list.map(([v, t]) => `<option value="${v}" ${cur === v ? "selected" : ""}>${esc(t)}</option>`).join("");
function renderPivot(){
  const dims = dimList().map(([k, d]) => [k, d[0]]);
  if(!DIMS[P.row] || (P.row === "freq" && !hasFreq())) P.row = "phase";
  const base = records.filter(r => !r.quit);
  const valuesOf = f => f ? orderValues(f, new Set(base.map(DIMS[f][1]))).map(v => [v, v]) : [];
  const saved = load(PIVOT_SAVED, []);
  const ex = PIVOT_EXAMPLES.find(e => e.id === P.ex);
  $("#tMenu").innerHTML = `<div class="trow" style="margin-bottom:10px"><span class="tl">範例</span>${chipRow(PIVOT_EXAMPLES.map(e => [e.id, e.name]), P.ex, "pex")}</div>
    ${ex ? `<div class="exnote"><b>範例：${esc(ex.name)}</b>　${esc(ex.read)}套用後可以再自己改下面的選項。</div>` : ""}
    <div class="pivotform">
    <label>指標<select id="pMetric">${opt(Object.entries(PMETRICS).map(([k, m]) => [k, m[0]]), P.metric)}</select></label>
    <label>列（第 1 個分組）<select id="pRow">${opt(dims, P.row)}</select></label>
    <label>欄（第 2 個分組）<select id="pCol">${opt(dims.filter(d => d[0] !== P.row), P.col, "不分組")}</select></label>
    <label>性質<select id="pKind">${opt(KINDS_F, P.kind)}</select></label>
    <label>從<input type="date" id="pFrom" value="${P.from}"></label><label>到<input type="date" id="pTo" value="${P.to}"></label>
    <label>篩選 1<select id="pF1">${opt(dims, P.f1, "不篩選")}</select></label>
    ${P.f1 ? `<label>等於<select id="pV1">${opt(valuesOf(P.f1), P.v1, "（全部）")}</select></label>` : ""}
    <label>篩選 2<select id="pF2">${opt(dims, P.f2, "不篩選")}</select></label>
    ${P.f2 ? `<label>等於<select id="pV2">${opt(valuesOf(P.f2), P.v2, "（全部）")}</select></label>` : ""}
    <label>排序<select id="pSort">${opt([["name","依分組名稱"],["desc","依數值（大到小）"],["asc","依數值（小到大）"]], P.sort)}</select></label>
    <label>筆數少於幾筆要提醒<select id="pMin">${opt([["1","不提醒"],["3","3 筆"],["5","5 筆"],["10","10 筆"]], String(P.minN))}</select></label>
    <label class="chk"><input type="checkbox" id="pFirst" ${P.firstOnly ? "checked" : ""}> 每位學生每個字只算第一次作答</label>
    </div>
    <div class="trow"><span class="tl">我的比較</span>${saved.map((s, i) => `<span class="savedcmp"><button class="chip" data-pload="${i}">${esc(s.name)}</button><button class="chip x" data-pdel="${i}" aria-label="刪除「${esc(s.name)}」">✕</button></span>`).join("")}
      <input id="pName" maxlength="20" placeholder="替這個比較取名字"><button class="chip" id="pSave">存成我的比較</button></div>`;
  const set = (id, k, f = v => v) => { const el = $(id); if(el) el.onchange = e => { P[k] = f(e.target.type === "checkbox" ? e.target.checked : e.target.value); if(k === "f1") P.v1 = ""; if(k === "f2") P.v2 = ""; if(k === "row" && P.col === P.row) P.col = ""; P.ex = ""; saveP(); renderPivot(); }; };
  set("#pMetric", "metric"); set("#pRow", "row"); set("#pCol", "col"); set("#pKind", "kind"); set("#pFrom", "from"); set("#pTo", "to");
  set("#pF1", "f1"); set("#pV1", "v1"); set("#pF2", "f2"); set("#pV2", "v2"); set("#pSort", "sort"); set("#pMin", "minN", Number); set("#pFirst", "firstOnly");
  $("#tMenu").querySelectorAll("[data-pex]").forEach(b => b.onclick = () => { const e = PIVOT_EXAMPLES.find(x => x.id === b.dataset.pex);
    Object.assign(P, PIVOT_BASE, e.cfg, {ex:e.id}); saveP(); renderPivot(); });
  $("#pSave").onclick = () => { const name = $("#pName").value.trim(); if(!name) return $("#pName").focus();
    const list = load(PIVOT_SAVED, []).filter(s => s.name !== name); list.push({name, cfg:{...P}}); store(PIVOT_SAVED, list); renderPivot(); };
  $("#tMenu").querySelectorAll("[data-pload]").forEach(b => b.onclick = () => { Object.assign(P, load(PIVOT_SAVED, [])[+b.dataset.pload].cfg); saveP(); renderPivot(); });
  $("#tMenu").querySelectorAll("[data-pdel]").forEach(b => b.onclick = () => { const list = load(PIVOT_SAVED, []); list.splice(+b.dataset.pdel, 1); store(PIVOT_SAVED, list); renderPivot(); });
  drawPivot();
}

const SERIES = ["var(--s1)","var(--s2)","var(--s3)","var(--s4)","var(--s5)","var(--s6)","var(--s7)","var(--s8)"];
function drawPivot(){
  const R = computePivot(), M = PMETRICS[P.metric], u = M[2];
  const show = c => c && c.v != null ? `${c.v}${u}` : "—";
  const faint = c => c && c.n < P.minN;
  if(!R.rs.length){ $("#tResult").innerHTML = `<p class="hint">這些條件下沒有紀錄，請放寬篩選。</p>`; return; }
  const head = `<tr><th>${esc(DIMS[P.row][0])}${P.col ? ` ＼ ${esc(DIMS[P.col][0])}` : ""}</th>${R.cols.map(c => `<th>${esc(c)}</th>`).join("")}${P.col ? "<th>合計</th>" : ""}</tr>`;
  const cellTd = c => `<td class="${faint(c) ? "faint" : ""}" ${faint(c) ? `title="資料太少，僅供參考（${c.n} 筆）"` : ""}>${c ? `<b>${show(c)}</b><small>${c.n} 筆</small>` : "—"}</td>`;
  const body = R.rows.map(rv => `<tr><th>${P.row === "char" ? charLinkAny(rv) : esc(rv)}</th>${R.cols.map(cv => cellTd(R.get(rv, cv))).join("")}${P.col ? cellTd(R.total(rv)) : ""}</tr>`).join("");
  const foot = P.col ? `<tr class="tot"><th>合計</th>${R.cols.map(cv => cellTd(R.colTotal(cv))).join("")}${cellTd(R.all)}</tr>` : "";
  const canChart = R.cols.length <= 8 && R.rows.length <= 40;
  $("#tResult").innerHTML = `<h3 class="ttitle">${esc(M[0])}：依${esc(DIMS[P.row][0])}${P.col ? `×${esc(DIMS[P.col][0])}` : ""}</h3>
    <p class="plain">${pivotPlain(R)}</p>
    <div class="tstats"><div class="tstat"><span>符合條件的紀錄</span><b>${R.rs.length} 筆</b><small>${P.kind === "formal" ? "正式評量" : P.kind === "practice" ? "練習" : "正式＋練習"}，不含中途結束</small></div>
      <div class="tstat"><span>整體${esc(M[0])}</span><b>${show(R.all)}</b><small>${R.all.n} 筆</small></div>
      <div class="tstat"><span>分組</span><b>${R.rows.length} × ${R.cols.length}</b><small>列 × 欄</small></div></div>
    <div class="tablewrap"><table class="rec pivot"><thead>${head}</thead><tbody>${body}${foot}</tbody></table></div>
    <p class="note">每格大字是${esc(M[0])}，小字是用了幾筆紀錄。淡色的格子筆數少於 ${P.minN} 筆，資料太少，僅供參考。${P.metric === "flu" ? "流暢性的筆數是「回合」數。" : ""}</p>
    ${canChart ? `<div class="row"><span class="tl">圖</span>${chipRow([["bar","長條圖"],["line","折線圖"],["none","不畫圖"]], P.chart, "pchart")}</div><div class="tchart">${P.chart === "none" ? "" : pivotChart(R, show)}</div>`
      : `<p class="note">分組太多（欄超過 8 組或列超過 40 組），只顯示表格。</p>`}
    <div class="row" style="margin-top:12px"><button class="ghost" id="pExport">匯出結果＋原始紀錄（Excel）</button><span class="note" id="pMsg" style="margin:0"></span></div>`;
  $("#tResult").querySelectorAll("[data-pchart]").forEach(b => b.onclick = () => { P.chart = b.dataset.pchart; saveP(); drawPivot(); });
  $("#tResult").querySelectorAll("[data-char]").forEach(el => el.onclick = () => openCharAll(el.dataset.char));
  bindChart($("#tResult"));
  $("#pExport").onclick = () => {
    const table = R.rows.map(rv => Object.fromEntries([[DIMS[P.row][0], rv], ...R.cols.flatMap(cv => { const c = R.get(rv, cv); return [[`${cv}（${M[0]}）`, c && c.v != null ? c.v : ""], [`${cv}（筆數）`, c ? c.n : 0]]; })]));
    const raw = R.rs.map(r => Object.fromEntries(COLS.map(([h, f]) => [h, f(r)])));
    exportSheet(table, "比較結果", `識字評量_進階分析_${fileDate(Date.now())}.xlsx`, "#pMsg", [{name:"原始紀錄", rows: raw}]);
  };
}
/* 用白話說明目前的設定（例：在正式評量、小明的 120 筆紀錄裡，依「時期」分成 4 列，每一格算「第一次就答對率」） */
function pivotPlain(R){
  const kind = {formal:"正式評量", practice:"練習", both:"正式評量和練習"}[P.kind];
  const date = P.from || P.to ? `、${P.from || "最早"}～${P.to || "現在"}` : "";
  const flt = [[P.f1, P.v1], [P.f2, P.v2]].filter(([f, v]) => f && v).map(([f, v]) => `「${DIMS[f][0]}」是「${v}」`);
  const first = P.firstOnly ? "（每位學生每個字只算第一次作答）" : "";
  return `在${esc(kind)}${esc(date)}${flt.length ? "、" + esc(flt.join("而且")) : ""}的 ${R.rs.length} 筆紀錄${first}裡，依「${esc(DIMS[P.row][0])}」分成 ${R.rows.length} 列`
    + (P.col ? `、再依「${esc(DIMS[P.col][0])}」分成 ${R.cols.length} 欄` : "")
    + `，每一格算「${esc(PMETRICS[P.metric][0])}」。` + (P.col ? "「合計」是那一列或那一欄的紀錄全部合起來算，不是把格子平均。" : "");
}
/* 進階分析的字：可能有好幾位學生，點了先問看哪一位 */
const charLinkAny = c => `<button class="charlink" data-char="${esc(c)}">${esc(c)}</button>`;
function openCharAll(c){
  const who = [...new Set(pivotRecords().filter(r => r.char === c).map(r => r.kid))];
  if(who.length === 1) return openCharLog(who[0], c);
  $("#cTitle").textContent = `「${c}」：要看哪一位學生？`;
  $("#cBody").innerHTML = `<div class="row">${who.map(k => `<button class="chip" data-who="${esc(k)}">${esc(kidBy(k) ? kidLabel(kidBy(k)) : k)}</button>`).join("")}</div>`;
  $("#cBody").querySelectorAll("[data-who]").forEach(b => b.onclick = () => { closeSheets(); openCharLog(b.dataset.who, c); });
  $("#cExport").onclick = null; openSheet("#charSheet");
}
/* 長條圖（每列一組，欄是不同顏色）或折線圖（橫軸是列，每欄一條線） */
function pivotChart(R, show){
  const multi = R.cols.length > 1, unit = PMETRICS[P.metric][2];
  const vals = R.rows.flatMap(rv => R.cols.map(cv => (R.get(rv, cv) || {}).v)).filter(v => v != null);
  const ticks = unit === "%" ? [0, 25, 50, 75, 100] : niceTicks(Math.max(...vals)), max = ticks[4];
  const legend = multi ? `<div class="legend">${R.cols.map((c, i) => `<span><i style="background:${SERIES[i]}"></i>${esc(c)}</span>`).join("")}</div>` : "";
  if(P.chart === "line"){
    const H = 300, L = 52, Rr = 20, Tp = 16, B = 40, iw = SVGW - L - Rr, ih = H - Tp - B;
    const X = i => R.rows.length === 1 ? L + iw / 2 : L + i / (R.rows.length - 1) * iw, Y = v => Tp + ih - v / max * ih;
    let g = ticks.map(v => { return `<line class="grid" x1="${L}" x2="${SVGW - Rr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v}${unit}</text>`; }).join("");
    R.cols.forEach((cv, si) => {
      const pts = R.rows.map((rv, i) => ({i, rv, c:R.get(rv, cv)})).filter(p => p.c && p.c.v != null);
      g += `<path class="line" style="stroke:${SERIES[si]}" d="${pts.map((p, k) => `${k ? "L" : "M"}${X(p.i).toFixed(1)} ${Y(p.c.v).toFixed(1)}`).join(" ")}"/>`;
      g += pts.map(p => `<circle class="dot" style="fill:${SERIES[si]}" cx="${X(p.i)}" cy="${Y(p.c.v)}" r="5" tabindex="0" data-tip="${esc(`${p.rv}${multi ? `｜${cv}` : ""}｜${show(p.c)}（${p.c.n} 筆）`)}"/>`).join("");
    });
    let lastX = -1e9;
    g += R.rows.map((rv, i) => { const x = X(i); if(x - lastX < 56) return ""; lastX = x;
      const anchor = x > SVGW - Rr - 30 ? "end" : x < L + 30 ? "start" : "middle";
      return `<text class="ax" x="${x}" y="${H - 18}" text-anchor="${anchor}">${esc(shortAxis(rv))}</text>`; }).join("");
    return `${legend}<div class="chartbox"><svg viewBox="0 0 ${SVGW} ${H}" role="img" aria-label="折線圖，數字請看上方表格">${g}<line class="cross" y1="${Tp}" y2="${Tp + ih}" hidden/></svg><div class="ttip" hidden></div></div>`;
  }
  const bh = multi ? 14 : 20, inner = 2, gap = 14, L = 170, Rr = 120, iw = SVGW - L - Rr;
  const groupH = R.cols.length * (bh + inner) - inner;
  const H = R.rows.length * (groupH + gap) + 8;
  const bar = (x, y, w, h) => w < 1 ? "" : `M${x} ${y}H${x + Math.max(0, w - 4)}Q${x + w} ${y} ${x + w} ${y + 4}V${y + h - 4}Q${x + w} ${y + h} ${x + Math.max(0, w - 4)} ${y + h}H${x}Z`;
  const g = R.rows.map((rv, ri) => { const y0 = 4 + ri * (groupH + gap);
    return `<text class="barname" x="${L - 10}" y="${y0 + groupH / 2 + 5}" text-anchor="end">${esc(String(rv).length > 12 ? String(rv).slice(0, 12) + "…" : rv)}</text>` +
      R.cols.map((cv, ci) => { const c = R.get(rv, cv), y = y0 + ci * (bh + inner), w = c && c.v != null ? c.v / max * iw : 0;
        return `<g class="barhit" tabindex="0" data-tip="${esc(`${rv}${multi ? `｜${cv}` : ""}｜${show(c)}${c ? `（${c.n} 筆）` : ""}`)}"><rect x="${L}" y="${y - inner / 2}" width="${iw + Rr}" height="${bh + inner}" fill="transparent"/>
          <path class="bar ${c && c.n < P.minN ? "faint" : ""}" style="fill:${SERIES[ci]}" d="${bar(L, y, w, bh)}"/></g>
          ${!multi || R.cols.length <= 3 ? `<text class="barval" x="${L + w + 6}" y="${y + bh / 2 + 4}">${show(c)}</text>` : ""}`; }).join(""); }).join("");
  return `${legend}<div class="chartbox"><svg viewBox="0 0 ${SVGW} ${H}" role="img" aria-label="長條圖，數字請看上方表格">${g}</svg><div class="ttip" hidden></div></div>`;
}
