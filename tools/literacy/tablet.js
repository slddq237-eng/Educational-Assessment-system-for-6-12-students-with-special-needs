/* =========================================================
   識字評量：平板作答（tablet.js）（開發路線圖 F2；2026-10-23 先做練習，見 docs/records.md「平板作答回傳到 Google 表單」）
   1. 老師電腦：「⚙ 細部設定 → 練習與遊戲」貼上自己的 Google 表單網址；第 2 步作答模式選「平板掃 QR code」，
      按「產生 QR code」。QR code 是一個網址，#t= 後面帶著這次練習的設定（讀法見 data.js 的 TABLET）。
   2. 學生平板：用相機掃描打開網頁 → 點自己的名字（沒填名字的顯示代號）→ 作答 → 做完把這次的紀錄每 20 題一包，送到老師的 Google 表單。
      平板不讀、不改平板自己存的設定，作答紀錄也不存進平板（見 records.js）。
   3. 老師電腦：從 Google 試算表下載 Excel，在「作答紀錄」按「匯入檔案」（見 records.js 的匯入檔案、本檔的 tabletSheet）。
   學生名字放進 QR code，讓學生在平板上點自己的名字（2026-10-23 維護者要求：代號容易點錯）；平板一打開就把名字從網址列拿掉（見 data.js 的 TABLET）。
   送到表單的紀錄不放名字，匯入時用老師電腦的學生名單補上。還原後的紀錄格式和平常一樣（作答模式 answer＝qr）。
   打包方式（第 2 版，2026-10-24）：這次每一題都一樣的欄位（學生、課本、設定…）只在包頭 head 寫一次，
   每題只放不一樣的欄位；推算得出來的 kidName、bookName、crossed（＝wrongCount）不送。匯入時 {...head, ...每題} 再補回來。
   第 1 版（每題寫完整紀錄）不再讀（2026-10-24 維護者決定：當時還沒有人在用）。
   ========================================================= */

/* 一次送幾題：2026-10-23 實測一包約 1.6 萬字收得到、約 4 萬字整筆收不到。
   第 2 版打包後一題約 400 字，20 題約 8 千字，留一倍的空間 */
const TAB_CHUNK = 20, TAB_VERSION = 2;
const TAB_DROP = ["kidName", "bookName", "crossed"];   /* 推算得出來、不用送的欄位 */
/* 第 2 版打包：每一題都一樣的欄位放進 head，每題只留不一樣的 */
function tabletPackRecords(list){
  const slim = list.map(r => { const o = {...r}; TAB_DROP.forEach(k => delete o[k]); return o; });
  const head = {};
  for(const k of Object.keys(slim[0] || {})){
    const v = JSON.stringify(slim[0][k]);
    if(slim.every(r => k in r && JSON.stringify(r[k]) === v)) head[k] = slim[0][k];
  }
  return {head, rows:slim.map(r => { const o = {}; for(const k in r) if(!(k in head)) o[k] = r[k]; return o; })};
}
/* 匯入時還原成完整的紀錄 */
function tabletUnpack(head, row){
  const r = {...head, ...row};
  r.kidName = ""; r.crossed = r.wrongCount; r.bookName = r.book ? bookName(r.book) : "";
  return r;
}
/* 老師貼上的網址要有表單代碼（/forms/d/e/代碼）和題目編號（entry.數字）；「取得預先填入的連結」兩個都有 */
function parseFormUrl(s){
  const id = (s.match(/\/forms\/d\/e\/([\w-]+)/) || [])[1], entry = (s.match(/entry\.(\d+)/) || [])[1];
  return id && entry ? {id, entry} : null;
}
/* 送一包資料到表單。瀏覽器的安全規則讓網頁看不到 Google 的回答（mode:no-cors），
   所以只知道「有沒有送出去」（沒網路時會失敗），不知道 Google 有沒有收到 */
const postForm = (f, text) => fetch(`https://docs.google.com/forms/d/e/${f.id}/formResponse`,
  {method:"POST", mode:"no-cors", body:new URLSearchParams({[`entry.${f.entry}`]: text})});
/* 中文設定轉成網址可以放的文字（UTF-8 → base64，+/ 換成 -_） */
const b64url = s => { let bin = ""; new TextEncoder().encode(s).forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };

/* =========================================================
   老師電腦：表單網址設定
   ========================================================= */
function renderTabForm(msg){
  const f = settings.tabletForm;
  $("#tabForm").value = f ? f.url : "";
  $("#tabFormTest").disabled = !f;
  $("#tabFormMsg").textContent = msg || (f ? "已設定。可以按「送一筆測試」，再到 Google 試算表看有沒有多一列。" : "還沒設定。");
}
$("#tabForm").onchange = e => {
  const v = e.target.value.trim();
  if(v){
    const f = parseFormUrl(v);
    if(!f) return renderTabForm("看不懂這個網址：要貼「取得預先填入的連結」，網址裡要有 /forms/d/e/ 和 entry.數字。");
    settings.tabletForm = {...f, url:v};
  } else delete settings.tabletForm;
  saveSettings(); renderTabForm(); render();
};
$("#tabFormTest").onclick = () => {
  if(!settings.tabletForm) return;
  renderTabForm("送出中…");
  /* 測試列（kind＝tablet-test）匯入時會自動略過 */
  postForm(settings.tabletForm, JSON.stringify({app:"literacy", kind:"tablet-test", savedAt:new Date().toISOString(), note:"測試，匯入時會略過"}))
    .then(() => renderTabForm("已送出一筆測試。請到 Google 試算表看有沒有多一列（匯入時會自動略過這一列）。"),
          () => renderTabForm("送不出去，請檢查網路。"));
};
renderTabForm();

/* =========================================================
   老師電腦：產生 QR code
   只帶這次練習用得到的資料：設定、選的學生（代號、名字、年級）、這幾課的教學日期與字組、第 2～4 步的選擇
   ========================================================= */
function tabletPack(){
  const codes = selKids(), pick = (o, ks) => Object.fromEntries(ks.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
  return {
    v:1, f:settings.tabletForm.id, e:settings.tabletForm.entry,
    d:{
      "literacy-ui": ui,   /* 快速開始或進階設定（快速開始不用每位學生不同的提示，見 data.js 的 kidCfg） */
      /* 正式評量的條件、設定畫面大小、表單網址平板用不到 */
      "literacy-settings": Object.fromEntries(Object.entries(settings).filter(([k]) => !/^(formal|clockFormal$|uiScale$|tabletForm$)/.test(k))),
      "literacy-kids": codes.map(c => { const k = kidBy(c), p = planOf(k);
        return {code:k.code, name:k.name || "", grade:k.grade, sy:k.sy, ...(p.adjust ? {plans:{[PLAN_KEY]:{adjust:true, level:p.level}}} : {})}; }),
      "literacy-teach": pick(teach, state.lessons),
      "literacy-wordsets": pick(wordSets, state.lessons)
    },
    st:{
      goal:state.goal, mode:state.mode, limit:state.limit, aim:+$("#aim").value || 30, lessons:state.lessons,
      pChoices:state.pChoices, pHints:[...state.pHints], pRule:state.pRule, qCount:state.qCount, qMethod:state.qMethod,
      manual:pick(state.manual, state.lessons), themePick:state.themePick,
      kidHints:isQuick() ? {} : Object.fromEntries(codes.filter(c => state.kidHints[c]).map(c => [c, {hints:[...state.kidHints[c].hints], rule:state.kidHints[c].rule}]))
    }
  };
}
let qrLoading = null;
function loadQr(){
  if(window.qrcode) return Promise.resolve();
  return qrLoading = qrLoading || new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = SHARED_BASE + "vendor/qrcode-generator-1.4.4.js";
    s.onload = () => res();
    s.onerror = () => { qrLoading = null; s.remove(); rej(new Error("QR code 元件載入失敗")); };
    document.head.appendChild(s);
  });
}
async function tabletQr(){
  const url = location.href.split("#")[0] + "#t=" + b64url(JSON.stringify(tabletPack()));
  const q = quizPlan(), g = GOALS.find(x => x.id === state.goal);
  $("#qrInfo").innerHTML = `練習・目標 ${g.id} ${g.name}・${esc(lessonsText())}・${state.mode === "flu" ? "流暢性" : `每人 ${q.count} 題`}<br>學生：${esc(selKids().join("、"))}`;
  $("#qrMsg").textContent = location.protocol === "file:" ? "注意：這個網頁是從電腦裡的檔案打開的，平板打不開。請用網站網址打開識字評量，再產生 QR code。" : "";
  $("#qrBox").innerHTML = `<p class="note">產生中…</p>`;
  openSheet("#qrSheet");
  try {
    await loadQr();
    const qr = qrcode(0, "L"); qr.addData(url); qr.make();
    $("#qrBox").innerHTML = qr.createSvgTag({cellSize:4, margin:4, scalable:true, alt:"平板作答的 QR code"});
  } catch(e){
    $("#qrBox").innerHTML = `<p class="warn">${/overflow/.test(e && e.message || e) ? "這次選的學生或設定太多，QR code 放不下。請少選幾位學生，分成幾個 QR code。" : "QR code 產生失敗，請重新整理網頁再試；也可以按「複製連結」，用其他方式傳給學生。"}</p>`;
  }
  $("#qrCopy").onclick = () => navigator.clipboard.writeText(url).then(() => $("#qrMsg").textContent = "已複製連結。連結裡有學生名字，只傳給學生，不要貼到公開的地方。",
    () => $("#qrMsg").textContent = "這個瀏覽器不允許複製，請改用 QR code。");
}

/* =========================================================
   學生平板：讀取條（先下載這次要用的字型）→ 點自己的名字 → 再按「是我，開始！」確認 → 作答 → 送出
   ========================================================= */
const TABLET_FORM = TABLET && !TABLET.bad ? {id:TABLET.f, entry:TABLET.e} : null;
/* 同一個分頁再掃一次 QR code（或打開另一個 QR 網址）：網址只有 # 後面不同，瀏覽器不會重新載入，
   要自己重新載入，才會回到讀取畫面和選名字（data.js 只在打開網頁時讀網址） */
addEventListener("hashchange", () => { if(/^#t=/.test(location.hash)) location.reload(); });
function tabletStart(){
  showScreen("#tabPick");
  const s = TABLET.st;
  if(TABLET.bad || TABLET.v !== 1 || !s || !TABLET_FORM){ $("#tpLoad").hidden = true; $("#tabPick").classList.remove("loading"); $("#tpMsg").textContent = "讀不到這次練習的設定，請重新掃描 QR code；還是不行，請老師重新產生一次。"; return; }
  /* 用不到的課（例如老師的網頁比較新）：請平板重新整理 */
  if(!s.lessons.length || s.lessons.some(k => !lessonChars(k).length)){ $("#tpLoad").hidden = true; $("#tabPick").classList.remove("loading"); $("#tpMsg").textContent = "這個 QR code 的課本這台平板找不到，請重新整理網頁，或請老師重新產生。"; return; }
  Object.assign(state, {kind:"practice", answer:"qr", goal:s.goal, mode:s.mode, limit:s.limit, lessons:s.lessons,
    pChoices:s.pChoices, pHints:new Set(s.pHints), pRule:s.pRule, qCount:s.qCount, qMethod:s.qMethod, manual:s.manual || {},
    themePick:s.themePick || "none",
    kidHints:Object.fromEntries(Object.entries(s.kidHints || {}).map(([c, v]) => [c, {hints:new Set(v.hints), rule:v.rule}]))});
  $("#aim").value = s.aim;
  const g = GOALS.find(x => x.id === state.goal);
  $("#tpInfo").textContent = `今天練習：${lessonsText()}（目標 ${g.id} ${g.name}）`;
  /* 結果畫面只留「再玩一次」（2026-10-23 維護者決定，不用換人）：沒有「回到設定」，平板上也不匯出 Excel */
  $("#rHome").hidden = true; $("#rExport").hidden = true;
  tabletKids();
  /* 讀取條：先下載這次要用的字型（play.js 的 sessionText、loadFonts，最多等 10 秒），下載完才出現名字 */
  const faces = fontsToLoad(sessionText(state.lessons, !!settings.practiceBpmf));
  const ready = () => { $("#tpLoad").hidden = true; $("#tabPick").classList.remove("loading"); tpList(); };
  if(!faces.length) return ready();
  $("#tpPic").innerHTML = loadPic(state.themePick);   /* 讀取中（#tabPick 一開始就有 loading）：只看得到圖片和讀取條 */
  loadFonts(faces, (n, all) => setBar("#tpBar", n, all)).then(ready);
}
/* 顯示名字清單（收起確認畫面） */
function tpList(){ if($("#tpLoad").hidden){ $("#tpList").hidden = false; $("#tpConfirm").hidden = true; } }
/* 平板沒有中文語音時，題目和喇叭都不會唸：點名字的畫面和結果畫面提醒怎麼裝
   （Android 的語音清單要過一下子才會出來，所以等 voiceschanged 或 2 秒後再判斷） */
const VOICE_HELP = "這台平板找不到中文語音，題目和喇叭不會唸出來（作答還是可以進行）。"
  + "Android：設定 → 一般管理 → 語言 → 文字轉換語音輸出，偏好的引擎選「Google 語音服務」，語言選「中文（台灣）」並下載語音資料；"
  + "iPad：設定 → 輔助使用 → 朗讀內容 → 聲音 → 中文（台灣）。設定好後重新整理這一頁。";
function tabletVoice(){
  if(!TABLET) return;
  const bad = !("speechSynthesis" in window) || !hasZhVoice();
  for(const id of ["#tpVoice", "#rVoice"]){ $(id).textContent = VOICE_HELP; $(id).hidden = !bad; }
}
if(TABLET){ setTimeout(tabletVoice, 2000);
  if("speechSynthesis" in window && speechSynthesis.addEventListener) speechSynthesis.addEventListener("voiceschanged", () => setTimeout(tabletVoice, 0)); }
function tabletKids(){
  if(!TABLET || TABLET.bad || !TABLET.st) return;
  /* 顯示名字（沒填名字顯示代號）；同名的學生加上代號才分得出來 */
  const same = k => k.name && kids.filter(x => x.name === k.name).length > 1;
  $("#tpList").innerHTML = kids.map(k => `<button class="chip kidchip" data-k="${esc(k.code)}">${Rewards.avatarHtml(k.code)}${esc(same(k) ? kidLabel(k) : kidShow(k))}</button>`).join("");
  /* 防點錯（2026-10-23 維護者要求）：點了名字先出現大頭像和「是你嗎？」，再按「是我，開始！」才開始。
     只有一位學生也要點：手機、平板的瀏覽器要「使用者剛點過」才肯唸題目 */
  $("#tpList").querySelectorAll("button").forEach(b => b.onclick = () => {
    const k = kidBy(b.dataset.k);
    $("#tpMe").innerHTML = `${Rewards.avatarHtml(k.code)}<span>${esc(b.lastChild.textContent)}</span>`;
    $("#tpList").hidden = true; $("#tpConfirm").hidden = false;
    $("#tpYes").onclick = () => { state.kids = new Set([k.code]); chooseTheme(); };
    $("#tpYes").focus();
  });
}
$("#tpNo").onclick = () => tpList();
/* 做完（finish）時呼叫：這次的紀錄每 20 題一包送出（第 2 版打包）；送不出去可以再送，或下載紀錄檔交給老師（同樣用「匯入檔案」） */
function tabletSend(g){
  /* 送出去的紀錄不放名字（表單、試算表、下載的紀錄檔都只有代號） */
  const list = records.filter(r => r.session === g.session).map(({id, dirty, ...r}) => ({...r, kidName:""})), box = $("#rSend");
  if(!list.length){ box.hidden = true; return; }
  const {head, rows} = tabletPackRecords(list), parts = [];
  for(let i = 0; i < rows.length; i += TAB_CHUNK) parts.push(rows.slice(i, i + TAB_CHUNK));
  const texts = parts.map((recs, i) => JSON.stringify({app:"literacy", kind:"tablet", version:TAB_VERSION, session:g.session,
    part:i + 1, parts:parts.length, savedAt:new Date().toISOString(), head, records:recs}));
  const go = async () => {
    box.hidden = false; box.innerHTML = `<p class="note" style="margin:0">正在把紀錄送給老師…</p>`;
    try {
      for(const t of texts) await postForm(TABLET_FORM, t);
      box.innerHTML = `<p class="hint" style="margin:0">✅ 已經把這次的 ${list.length} 題紀錄送給老師了</p>`;
    } catch(e){
      box.innerHTML = `<p class="warn" style="margin:0">⚠ 紀錄送不出去，可能沒有連上網路。連上網路後按「再送一次」；還是不行，就下載紀錄檔交給老師。</p>
        <div class="row"><button class="save" id="rResend">再送一次</button><button class="ghost" id="rSave">下載紀錄檔</button></div>`;
      $("#rResend").onclick = go;
      $("#rSave").onclick = () => downloadJson({app:"literacy", kind:"tablet", version:1, savedAt:new Date().toISOString(), sessions:1, missing:0, records:list},
        `識字評量_平板_${list[0].kid}_${fileDate(g.session)}.json`, "#rMsg");
    }
  };
  go();
}

/* =========================================================
   老師電腦：讀 Google 試算表下載的 Excel（或 CSV），由 records.js 的「匯入檔案」呼叫
   每一格是一包（kind＝tablet）；同一次練習（session）分成好幾包，拼回來後檢查有沒有缺包。
   回傳和平台資料檔一樣的樣子：{app, kind:"tablet", sheet 從試算表來的, sessions 幾次練習, missing 幾次缺資料, records}；找不到就回傳 null
   ========================================================= */
async function tabletSheet(f){
  await loadXlsx();
  const wb = /\.csv$/i.test(f.name) ? XLSX.read(await f.text(), {type:"string"}) : XLSX.read(await f.arrayBuffer());
  const got = new Map(), all = new Map();
  for(const name of wb.SheetNames) for(const row of XLSX.utils.sheet_to_json(wb.Sheets[name], {header:1, raw:true})) for(const v of row){
    if(typeof v !== "string" || !v.trim().startsWith("{")) continue;
    let d; try { d = JSON.parse(v); } catch(e){ continue; }
    if(!d || d.app !== "literacy" || d.kind !== "tablet" || d.version !== TAB_VERSION || !d.head || !Array.isArray(d.records)) continue;
    const s = got.get(d.session) || {parts:d.parts || 1, have:new Set()};
    s.have.add(d.part || 1); got.set(d.session, s);
    for(const row of d.records){ const r = tabletUnpack(d.head, row); all.set(recKey(r), r); }   /* 同一包送了兩次（再送一次）只算一次 */
  }
  if(!got.size) return null;
  return {app:"literacy", kind:"tablet", sheet:true, sessions:got.size, missing:[...got.values()].filter(s => s.have.size < s.parts).length, records:[...all.values()]};
}
