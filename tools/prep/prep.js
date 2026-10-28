/* =========================================================
   備課分析（prep.js）
   讀 shared/lessons.js（課本生字）與 shared/parts.js（部件），
   統計選定範圍內的常見部件，列出含這個部件的生字和學過的舊字。
   字頻：shared/ 裡有 FREQ（字 → 排名）時才會出現，資料還沒匯入前先顯示說明。
   ========================================================= */

/* =========================================================
   1. 基本設定與小工具
   ========================================================= */
const $ = s => document.querySelector(s);
/* esc、課本排序與名稱（BOOK_ORDER、termRank、bookName、lessonName、lessonKeys）、wordOf、rawParts 在 shared/common.js */
const hasFreq = typeof FREQ !== "undefined";

/* 單一筆畫：預設不列入排行（幾乎每個字都有，對教學沒有幫助） */
const STROKES = new Set([..."一丨丿丶乙乚亅㇇㇀㇉𠃌𠃋𠄌𠂆𠃊𠄎𡿨"]);
/* 同一個部件的不同寫法合併計算；顯示名稱另外補充說明 */
const ALIAS = {"糸":"糹"};
const LABEL = {"糹":"糹（糸）", "⺼":"⺼（肉）", "⺕":"⺕（彐）"};
const label = p => LABEL[p] || p;

/* 查一個字的第一層部件（老師的 A 人工手動拆法優先，再來是人工 PARTS，見 shared/common.js 的 rawParts；2026-10-28）；備課分析把同一部件的不同寫法合併計算 */
/* 拆法來源：獨體字（拆不開）不算自動拆，不用檢查 */
const srcOf = c => partsOf(c).length ? partsSource(c, "first") : "";
const SRC_NAME = {manual:"人工", auto:"自動（請檢查）", "":"—"};
const partsOf = c => rawParts(c, "first").filter(p => p !== c).map(p => ALIAS[p] || p);
/* 拆到最細：老師有寫 B 人工手動拆法的字直接用它（2026-10-28）；沒有就把部件一路往下拆，收集途中所有部件（不重複） */
function allParts(c, seen = new Set()){
  const fine = manualPartsOf(c, "teach");
  if(fine){ for(const p of fine.split(/\s+/)) if(p && p !== c) seen.add(ALIAS[p] || p); return seen; }
  for(const p of partsOf(c)) if(!seen.has(p)){ seen.add(p); allParts(p, seen); }
  return seen;
}

/* =========================================================
   2. 畫面狀態（記在這台電腦的瀏覽器，下次打開還在）
   ========================================================= */
const STORE = "prep-ui", RANGES = "prep-ranges";
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch(e){ return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
const state = Object.assign({books:[BOOK_ORDER[0]], lessons:{}, kind:"both", depth:"first", tab:"parts"}, load(STORE, {}));
state.books = state.books.filter(b => BOOKS[b]);
if(!state.books.length) state.books = [BOOK_ORDER[0]];
let ranges = load(RANGES, []);
let current = null;  /* 最近一次分析結果，匯出 Excel 用 */

/* 每本課本選了哪些課：沒設定過就是全選 */
const chosen = b => state.lessons[b] || lessonKeys(b);

/* =========================================================
   3. 選範圍的畫面
   ========================================================= */
function drawSetup(){
  $("#books").innerHTML = BOOK_ORDER.map(b =>
    `<button class="opt ${state.books.includes(b) ? "on" : ""}" data-book="${b}">${bookName(b)}<small>${lessonKeys(b).length} 課</small></button>`).join("");
  $("#lessons").innerHTML = state.books.map(b => `<div class="book"><b>${bookName(b)}
      <button class="mini" data-all="${b}">全選</button><button class="mini" data-none="${b}">清除</button></b>
      <div class="row">${lessonKeys(b).map(n =>
        `<button class="chip ${chosen(b).includes(n) ? "on" : ""}" data-b="${b}" data-n="${n}">${lessonName(b, n)}</button>`).join("")}</div></div>`).join("");
  $("#kinds").innerHTML = [["both","習寫字＋認讀字"],["write","只看習寫字"],["read","只看認讀字"]].map(([id, t]) =>
    `<button class="opt ${state.kind === id ? "on" : ""}" data-kind="${id}">${t}</button>`).join("");
  $("#depth").innerHTML = [["first","第一層部件","字直接拆開"],["all","拆到最細","部件再往下拆"]].map(([id, t, s]) =>
    `<button class="opt ${state.depth === id ? "on" : ""}" data-depth="${id}">${t}<small>${s}</small></button>`).join("");
  $("#savedList").innerHTML = ranges.map((r, i) =>
    `<span class="saved"><button data-load="${i}">${esc(r.name)}</button><button class="x" data-del="${i}" aria-label="刪除 ${esc(r.name)}">✕</button></span>`).join("");
  $("#tabs").innerHTML = [["parts","部件排行"],["chars","生字一覽"],["freq","字頻"]].map(([id, t]) =>
    `<button class="opt ${state.tab === id ? "on" : ""}" data-tab="${id}">${t}</button>`).join("");
}

document.addEventListener("click", e => {
  const t = e.target.closest("button"); if(!t) return;
  const d = t.dataset;
  if(d.book){
    const i = state.books.indexOf(d.book);
    if(i < 0) state.books.push(d.book); else if(state.books.length > 1) state.books.splice(i, 1);
    state.books.sort((a, b) => BOOK_ORDER.indexOf(a) - BOOK_ORDER.indexOf(b));
  }
  else if(d.n){
    const list = new Set(chosen(d.b));
    list.has(d.n) ? list.delete(d.n) : list.add(d.n);
    state.lessons[d.b] = lessonKeys(d.b).filter(n => list.has(n));
  }
  else if(d.all) delete state.lessons[d.all];
  else if(d.none) state.lessons[d.none] = [];
  else if(d.kind) state.kind = d.kind;
  else if(d.depth) state.depth = d.depth;
  else if(d.tab) state.tab = d.tab;
  else if(d.load){
    const r = ranges[d.load];
    state.books = r.books.filter(b => BOOKS[b]); state.lessons = {...r.lessons}; state.kind = r.kind;
  }
  else if(d.del){ if(!confirm(`刪除「${ranges[d.del].name}」？`)) return; ranges.splice(d.del, 1); save(RANGES, ranges); }
  else return;
  update();
});
$("#saveRange").onclick = () => {
  const name = $("#rangeName").value.trim();
  if(!name){ $("#rangeName").focus(); return; }
  const lessons = {}; state.books.forEach(b => lessons[b] = chosen(b));
  ranges = ranges.filter(r => r.name !== name).concat({name, books:[...state.books], lessons, kind:state.kind});
  save(RANGES, ranges); $("#rangeName").value = ""; update();
};
$("#hideStroke").onchange = $("#minN").onchange = () => update();

/* =========================================================
   4. 分析：收集範圍內的字、統計部件、找學過的舊字
   ========================================================= */
/* 範圍內的字：同一個字出現在多課只算一次，記下第一次出現的課 */
function collect(){
  const map = new Map();
  for(const b of state.books) for(const n of chosen(b)){
    const L = BOOKS[b].lessons[n];
    const add = (s, kind) => { for(const c of s) if(!map.has(c)) map.set(c, {c, b, n, kind}); };
    if(state.kind !== "read") add(L.write, "習寫");
    if(state.kind !== "write") add(L.read, "認讀");
  }
  return [...map.values()];
}
/* 學過的舊字：同一個版本、比所選範圍更早的課（前面年級學期＋同一本前面的課） */
function learnedBefore(inRange){
  const old = new Map();
  for(const b of state.books){
    const first = Math.min(...chosen(b).map(Number));
    for(const k of BOOK_ORDER){
      const B = BOOKS[k];
      if(B.edition !== BOOKS[b].edition || termRank(B) > termRank(BOOKS[b])) continue;
      for(const n of lessonKeys(k)){
        if(k === b && Number(n) >= first) continue;
        for(const c of B.lessons[n].write + B.lessons[n].read)
          if(!inRange.has(c) && !old.has(c)) old.set(c, `${bookName(k)} ${lessonName(k, n)}`);
      }
    }
  }
  return old;
}
function analyse(){
  const list = collect(), inRange = new Set(list.map(x => x.c));
  const hide = $("#hideStroke").checked, minN = Number($("#minN").value);
  const partsFor = c => [...(state.depth === "all" ? allParts(c) : new Set(partsOf(c)))].filter(p => !(hide && STROKES.has(p)));
  /* 部件 → 含這個部件的生字 */
  const byPart = new Map();
  for(const x of list) for(const p of partsFor(x.c)){
    if(!byPart.has(p)) byPart.set(p, []);
    byPart.get(p).push(x);
  }
  /* 舊字也算一次部件，才能列出「學過的字裡也有這個部件」 */
  const old = learnedBefore(inRange), oldByPart = new Map();
  for(const [c, where] of old) for(const p of partsFor(c)){
    if(!oldByPart.has(p)) oldByPart.set(p, []);
    oldByPart.get(p).push({c, where});
  }
  const rows = [...byPart].filter(([, xs]) => xs.length >= minN)
    .sort((a, b) => b[1].length - a[1].length || (oldByPart.get(b[0]) || []).length - (oldByPart.get(a[0]) || []).length)
    .map(([p, xs]) => ({p, xs, old: oldByPart.get(p) || []}));
  const split = list.filter(x => partsOf(x.c).length).length;
  return {list, rows, split, kinds: byPart.size};
}

/* =========================================================
   5. 結果畫面：三個重點數字＋目前分頁的表格
   ========================================================= */
const where = x => `${bookName(x.b)} ${lessonName(x.b, x.n)}（${x.kind}）`;
const charSpan = x => `<span title="${esc(where(x))}">${esc(x.c)}</span>`;
function drawResult(){
  const R = current = analyse();
  const nLessons = state.books.reduce((s, b) => s + chosen(b).length, 0);
  const rangeOf = b => chosen(b).length === lessonKeys(b).length ? "全冊" : chosen(b).map(n => lessonName(b, n)).join("、") || "沒有勾課";
  $("#rangeText").textContent = nLessons ? `範圍：${state.books.map(b => `${bookName(b)}（${rangeOf(b)}）`).join("；")}` : "還沒有勾選課次。";
  const top = R.rows[0];
  $("#stats").innerHTML = [
    [R.list.length, "範圍內的字（不重複）"],
    [R.rows.length, `常見部件（至少 ${$("#minN").value} 個字）`],
    [top ? `${label(top.p)} ${top.xs.length}` : "—", "出現最多的部件"]
  ].map(([b, s]) => `<div class="stat"><b>${esc(b)}</b><span>${s}</span></div>`).join("");
  $("#msg").textContent = "";

  if(state.tab === "parts"){
    const max = top ? top.xs.length : 1;
    $("#table").innerHTML = R.rows.length ? `<table><thead><tr><th>排名</th><th>部件</th><th>出現字數</th><th>範圍內的字（游標移到字上看課次）</th><th>學過的舊字（可串聯複習）</th></tr></thead><tbody>${
      R.rows.map((r, i) => `<tr><td class="n">${i + 1}</td><td class="big">${esc(label(r.p))}</td>
        <td class="n">${r.xs.length} 字（${Math.round(r.xs.length / R.list.length * 100)}%）<div class="bar" style="width:${r.xs.length / max * 100}%"></div></td>
        <td class="chars">${r.xs.map(charSpan).join("")}</td>
        <td class="chars old">${r.old.map(o => `<span title="${esc(o.where)}">${esc(o.c)}</span>`).join("") || "<span class=note>—</span>"}</td></tr>`).join("")}</tbody></table>
      <p class="note">出現率＝含這個部件的字 ÷ 範圍內的字。可拆成部件的字有 ${R.split} 個，其餘是獨體字（例如「人」「木」）。</p>`
      : `<p class="note">沒有符合條件的部件。可以多勾幾課，或把「至少出現在」改小一點。</p>`;
  }
  else if(state.tab === "chars"){
    /* 拆法來源（開發路線圖 B3）：電腦自動拆的字標黃色，方便老師檢查；拆得不適合教學的，在 shared/lessons.js 的 PARTS 補人工拆法 */
    const auto = R.list.filter(x => srcOf(x.c) === "auto"), rows = state.autoOnly ? auto : R.list;
    $("#table").innerHTML = R.list.length ? `<p class="note autonote">範圍內有 <b>${auto.length}</b> 個字的部件是電腦自動拆的（標黃色），不一定適合教學，例如「王＝一＋土」。發現拆得不好，跟 Claude 說「○ 改成怎麼拆」，或用部件拆解表修正。
      <label class="check"><input type="checkbox" id="autoOnly" ${state.autoOnly ? "checked" : ""}>只看自動拆的字</label></p>
      <table><thead><tr><th>課次</th><th>字</th><th>種類</th><th>部件</th><th>拆法來源</th><th>語詞</th></tr></thead><tbody>${
      rows.map(x => `<tr class="${srcOf(x.c) === "auto" ? "auto" : ""}"><td class="n">${esc(bookName(x.b))} ${esc(lessonName(x.b, x.n))}</td><td class="big">${esc(x.c)}</td><td class="n">${x.kind}</td>
        <td class="chars">${esc(partsOf(x.c).map(label).join("＋") || "獨體字")}</td><td class="n">${SRC_NAME[srcOf(x.c)]}</td><td>${esc(wordOf(x.c, x.b))}</td></tr>`).join("")}</tbody></table>` : "";
    if($("#autoOnly")) $("#autoOnly").onchange = e => { state.autoOnly = e.target.checked; update(); };
  }
  else {
    $("#table").innerHTML = hasFreq
      ? `<table><thead><tr><th>字頻排名</th><th>字</th><th>課次</th></tr></thead><tbody>${
          R.list.filter(x => FREQ[x.c]).sort((a, b) => FREQ[a.c] - FREQ[b.c]).map(x =>
            `<tr><td class="n">${FREQ[x.c]}</td><td class="big">${esc(x.c)}</td><td>${esc(where(x))}</td></tr>`).join("")}</tbody></table>`
      : `<p class="warn">字頻資料還沒匯入。維護者確認字頻來源與授權後，放進 <code>shared/</code>，這裡就會依常用程度排出範圍內的字。</p>`;
  }
}

/* =========================================================
   6. 匯出 Excel：匯出目前分頁的內容
   ========================================================= */
$("#export").onclick = () => {
  if(!current) return;
  let rows, sheet;
  if(state.tab === "parts"){
    sheet = "部件排行";
    rows = current.rows.map((r, i) => ({"排名": i + 1, "部件": label(r.p), "出現字數": r.xs.length,
      "出現率": `${Math.round(r.xs.length / current.list.length * 100)}%`,
      "範圍內的字": r.xs.map(x => x.c).join(""), "學過的舊字": r.old.map(o => o.c).join("")}));
  } else if(state.tab === "chars"){
    sheet = "生字一覽";
    rows = current.list.map(x => ({"課本": bookName(x.b), "課次": lessonName(x.b, x.n), "字": x.c, "種類": x.kind,
      "部件": partsOf(x.c).map(label).join("＋") || "獨體字", "拆法來源": SRC_NAME[srcOf(x.c)], "語詞": wordOf(x.c, x.b)}));
  } else { $("#msg").textContent = "字頻資料匯入後才能匯出。"; return; }
  /* Excel 元件按匯出時才載入（見 shared/common.js 的 loadXlsx） */
  setMsg("#msg", "準備匯出…");
  loadXlsx().then(() => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheet);
    try { XLSX.writeFile(wb, `備課分析_${sheet}.xlsx`); setMsg("#msg", `已匯出 ${rows.length} 列。`); }
    catch(e){ setMsg("#msg", "這個環境不允許下載檔案，請用一般瀏覽器開啟網站再匯出。"); }
  }, () => { setMsg("#msg", "Excel 元件載入失敗，請重新整理網頁再試一次。"); });
};

/* =========================================================
   7. 開始：畫出設定與結果；每次改設定都重新分析
   ========================================================= */
function update(){ save(STORE, state); drawSetup(); drawResult(); }
update();
