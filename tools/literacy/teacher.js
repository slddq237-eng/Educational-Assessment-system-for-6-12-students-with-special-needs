/* =========================================================
   識字評量：老師專區（teacher.js）
   三個分頁：個人、多位學生（原全班總表）、進階分析（在 pivot.js）。
   每個分頁上方有「這一頁怎麼用？」，結果下方有「這張圖怎麼看？」；（分析教學頁 2026-10-25 已刪除，只留程式內的短說明。）
   原則（2026-10-20 定案）：
   - 分析一律用「前後測」（前測／後測；沒標的是未標記），用的是作答當下老師按的標記（A8，2026-10-25）。
   - 「中途結束」的紀錄一律不算；預設只看正式評量。
   - 每個圖都有「看明細」表格，數字也能從表格讀到（不用滑鼠移上去才看得到）。
   ========================================================= */

/* =========================================================
   15. 老師專區：選單狀態與資料篩選
   ========================================================= */
const TEACH_UI = KEYS.teacher;
const T = Object.assign({tab:"one", kid:"", metric:"acc", view:"time", axis:"date", split:"lesson", range:"term", from:"", to:"",
  kind:"formal", goal:"", book:"", lesson:"", gap:"after", top:"300", adv:"charts", simpleLesson:"", simpleGoal:"", classKids:[], groups:[], classLesson:""}, load(TEACH_UI, {}));
const saveT = () => store(TEACH_UI, {...T, simpleGoal:"", groups: getGroups()});   /* 組別由 getGroups／saveGroups 管，這裡不蓋掉；「評量目標比較」的目標不存，每次打開都回到整體（維護者 2026-11-11） */
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
const VIEWS = [["time","依時間"],["lesson","依課別"],["phase","依前後測比較"]];
const RANGES = [["term","本學期"],["last","上學期"],["all","全部"],["custom","自訂日期"]];
const KINDS_F = [["formal","正式評量"],["practice","練習"],["both","全部"]];
const PHASE_ORDER = [...PREPOST, "未標記"];
/* 聽音補部件（R5）、聽音選部件（R6）選的是部件，不是字：不納入以「字」為單位的搞混分析和亂猜比較 */
const isPartsGoal = r => !!goalCaps(r.goal).partsAnswer;
const ETYPES = ["同詞易混","同音","形近","同部件","課文字","其他字","少選","選到干擾部件"];   /* 同部件只出現在目標 4-1 部件重組 */
const GAP_BUCKETS = {
  after: {name:"教學後天數", what:"該課教學結束到這次評量隔幾天", list:["教學結束前或沒填日期","0～6 天","7～13 天","14～29 天","30 天以上"]},
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
    if(d === "" || d == null) return "教學結束前或沒填日期";
    return d < 7 ? "0～6 天" : d < 14 ? "7～13 天" : d < 30 ? "14～29 天" : "30 天以上";
  }
  const d = prevGap(r);
  if(d == null) return "第一次考";
  return d === 0 ? "同一天" : d < 7 ? "1～6 天" : d < 14 ? "7～13 天" : d < 30 ? "14～29 天" : "30 天以上";
}

/* 依選單篩出這次要分析的紀錄（kidFilter＝false 時不篩學生，全班總表用） */
function filtered(kidFilter = true){
  const [a, b] = rangeDates(), hid = archivedCodes();   /* 封存的學生不算進分析，全班統計也一樣（2026-10-31） */
  return records.filter(r => !r.quit && !hid.has(r.kid)
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
  return [...by.values()].map(list => ({rs:list, at:list[0].at, perMin: Math.round(list.filter(r => r.firstCorrect).length * 60 / +list[0].timeLimit)}));
}
const fluOf = rs => { const rd = rounds(rs); return {v: avg(rd.map(x => x.perMin)), n: rd.length}; };
const METRIC_FN = {acc: accOf, sec: secOf, flu: fluOf};
const fmt = (m, v) => v == null ? "—" : m === "acc" ? `${v}%` : m === "sec" ? `${v} 秒` : `${v} 個／分`;
const unitN = m => m === "flu" ? "回合" : "題";

/* =========================================================
   16. 老師專區：選單畫面
   ========================================================= */
/* 一排可以點選的小按鈕（chipRow）在 data.js：設定畫面也會用到，平板不載入這個檔案（2026-10-24） */
function kidsWithData(){ const have = new Set(records.filter(r => !r.quit).map(r => r.kid)); return kids.filter(k => have.has(k.code)); }


/* =========================================================
   15b. 一位學生的簡潔畫面（2026-10-25 維護者指定，設計見 docs/design/analysis-page-draft.md）
   一般模式老師只需要選學生，其他不用點，整頁往下捲：
   總體紀錄 → 每天的平均正確率（折線圖）→ 每天的平均反應時間（折線圖）→ 各課前後測正確率（折線圖）→ 常錯的字 → 反應最慢的字
   → 容易搞混的字 → 近期正式評量紀錄 → 近期練習紀錄。統計、折線圖、字的清單都是正式評量＋練習全部一起算；前後測只有正式評量。
   原本的選單、圖、表收進最下面的「進階」（預設收起）。
   ========================================================= */
/* 錯誤類型在老師畫面上的名稱：同詞／同音／形近（維護者 2026-10-25 決定；只改顯示，紀錄裡存的 errorType 不變，同詞易混＝同詞） */
const typeName = t => ({同詞易混:"同詞"})[t] || t;
/* =========================================================
   統計上顯著（維護者 2026-11-11）：「特別容易搞混」「忘記部件」「被干擾」這類說法，p 值要小於 SIG_ALPHA 才下判斷，不然一律寫「看不出來」。
   p 值＝如果學生其實是亂猜，碰巧看到這麼極端的結果的機率；越小越不像巧合。
   用精確的機率計算（每一題的亂猜機率不同，所以是「每題機率加總」，不是固定比例）；同時比好幾組（3 種錯誤類型、幾十個部件）時，
   把門檻除以比較的組數（Bonferroni 修正），不然總會有一組碰巧特別高。以前只看「是亂猜的 1.5 倍」：錯 5～10 題時，純亂猜也有兩成以上會被誤判。
   另外保留 1.5 倍的實用下限（題數很多時，1.2 倍也會顯著，但差距太小沒有教學意義）。 */
const SIG_ALPHA = 0.05;
function pbDist(qs){ let d = [1]; for(const q of qs){ const nd = new Array(d.length + 1).fill(0); d.forEach((p, k) => { nd[k] += p * (1 - q); nd[k + 1] += p * q; }); d = nd; } return d; }   /* 每題各有一個機率 q，成功次數的機率分布 */
const pbUpper = (qs, k) => Math.min(1, pbDist(qs).slice(Math.max(0, k)).reduce((a, b) => a + b, 0));   /* 成功 k 次以上的機率 */
const pbLower = (qs, k) => Math.min(1, pbDist(qs).slice(0, Math.max(0, k + 1)).reduce((a, b) => a + b, 0));   /* 成功 k 次以下的機率 */
const logFact = (() => { const t = [0]; return n => { for(let i = t.length; i <= n; i++) t[i] = t[i - 1] + Math.log(i); return t[n]; }; })();
const logComb = (n, k) => logFact(n) - logFact(k) - logFact(n - k);
/* 聽音選部件「有沒有分辨力」的檢定（2026-11-11 修正：以前把所有題的卡片合在一起算一次，每題答案數、卡片數不同時，亂選也會顯著；
   用假資料測出亂選的學生被判成「有分辨力」）。改成每題各自算：這題 N 張卡裡有 K 張答案、學生選了 n 張，亂選時選到的答案數是超幾何分布；
   再把每一題的分布加起來（卷積），算「全部題選到的答案數至少這麼多」的機率。每題的 n 是學生自己選的，所以全選、少選都不會讓結果偏掉 */
function hyperDist(N, K, n){
  const lo = Math.max(0, n - (N - K)), hi = Math.min(K, n), d = new Array(hi + 1).fill(0);
  for(let i = lo; i <= hi; i++) d[i] = Math.exp(logComb(K, i) + logComb(N - K, n - i) - logComb(N, n));
  return d;
}
const convolve = (a, b) => { const r = new Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => { if(x) b.forEach((y, j) => { r[i + j] += x * y; }); }); return r; };
function strataUpper(strata, x){   /* strata＝每題 [N, K, n]；x＝實際選到的答案總數；回傳「至少 x 個」的機率 */
  let d = [1]; for(const [N, K, n] of strata) d = convolve(d, hyperDist(N, K, n));
  return Math.min(1, d.slice(Math.max(0, x)).reduce((a, b) => a + b, 0));
}
const fmtP = p => p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(3)}`;
const okRec = r => !r.quit;
const r1 = x => Math.round(x * 10) / 10;   /* 四捨五入到小數 1 位，避免出現 3.9000000000000004 */
const median = a => { if(!a.length) return null; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : Math.round((b[m - 1] + b[m]) / 2 * 10) / 10; };
const secList = rs => rs.filter(r => r.passed && typeof r.correctSec === "number").map(r => r.correctSec);
const sessionsOf = rs => [...groupBy(rs, r => r.session)].map(([id, list]) => ({id, rs: list, at: list[0].at, day: dayOf(list[0])})).sort((a, b) => a.at < b.at ? -1 : 1);
const tagText = list => { const t = [...new Set(list.map(r => r.prepost).filter(Boolean))]; return t.length ? t.join("、") : ""; };
const lessonsText2 = list => { const ks = [...new Set(list.map(r => key(r.book, r.lesson)))]; return ks.length > 3 ? `${lessonLabel(ks[0])} 等 ${ks.length} 課` : ks.map(lessonLabel).join("、"); };

/* 每天一個點：x＝距離第一天幾天（相隔越久離越遠），有標前測、後測的那天在日期後面註明 */
function dailyChart(rs, metric){
  const g = groupBy(rs, dayOf), days = [...g.keys()].sort(), first = days[0];
  const fn = metric === "acc" ? accOf : metric === "sec" ? secOf : fluOf, at = {};
  const pts = days.map(d => { const list = g.get(d), t = tagText(list), x = daysBetween(first, d); at[x] = shortDay(d); return {x, day: d, label: shortDay(d) + (t ? `（${t}）` : ""), rs: list, ...fn(list)}; });
  return lineChart(pts, {metric, noPhase: true, xLabel: x => at[x] || "", xName: ""});
}
/* 流暢性（計時挑戰、流暢性模式）：每一回合＝一位學生做完一次，每分鐘第一次就答對幾個；一天一個點，正式評量和練習的回合全部算 */
function fluencySection(all){
  const flu = all.filter(r => r.mode === "flu" && r.timeLimit);
  if(!flu.length) return `<p class="note" style="margin:0">還沒有流暢性的紀錄。做「計時挑戰」（或進階設定的流暢性模式），這裡就會出現每天每分鐘認出幾個字。</p>`;
  const n = rounds(flu).length;
  return `<div class="tchart">${dailyChart(flu, "flu")}</div><p class="note">流暢性＝限時內第一次就答對的字數，換算成每分鐘幾個（越高越流暢）。每個點是那一天所有回合的平均，共 ${n} 個回合；正式評量和練習的流暢性回合全部算。</p>`;
}
function simpleSummary(rs){
  const sess = sessionsOf(rs), days = [...new Set(rs.map(dayOf))].sort(), a = accOf(rs), secs = secList(rs);
  const lastDay = days[days.length - 1], lastAcc = accOf(rs.filter(r => dayOf(r) === lastDay));
  let speed = ["—", "資料還不到一週"];
  if(daysBetween(days[0], lastDay) >= 7){
    const w1 = avg(secList(rs.filter(r => daysBetween(days[0], dayOf(r)) < 7))), w2 = avg(secList(rs.filter(r => daysBetween(dayOf(r), lastDay) < 7)));
    if(w1 != null && w2 != null){ const d = Math.round((w2 - w1) * 10) / 10; speed = [d < 0 ? `快 ${-d} 秒` : d > 0 ? `慢 ${d} 秒` : "一樣快", `第一週 ${w1} → 最近一週 ${w2}`]; }
  }
  const wrongT = rs.filter(r => !r.firstCorrect && r.errorType), topType = [...groupBy(wrongT, r => r.errorType)].sort((a, b) => b[1].length - a[1].length)[0];
  const tile = (label, value, sub) => `<div class="tstat"><span>${label}</span><b>${esc(value)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;
  return `<div class="tstats">${tile("做過", `${sess.length} 次`, `${days.length} 天・${rs.length} 題`)}${tile("整體正確率", a.v == null ? "—" : `${a.v}%`, `最近一天 ${lastAcc.v == null ? "—" : lastAcc.v + "%"}`)}
    ${tile("平均反應時間", secs.length ? `${avg(secs)} 秒` : "—", secs.length ? `中位數 ${median(secs)} 秒` : "")}${tile("反應速度變化", speed[0], speed[1])}${tile("常見錯誤類型", topType ? typeName(topType[0]) : "—", topType ? `${topType[1].length} 次・佔錯誤 ${pct(topType[1].length, wrongT.length)}%` : "還沒有選錯")}</div>`;
}
const SIMPLE_CHIPS = 24, SIMPLE_ROWS = 10;
/* 做過哪些評量目標（依 GOALS 的順序，不認得的舊代號排最後）；「看哪個目標」按鈕用（個人、多位學生，維護者 2026-11-11） */
/* 舊紀錄的目標代號（2026-10-26 A1 改代號以前）：3＝聽音選字（R3）、4-1＝部件重組（R4），紀錄裡沒有轉換；分析一律先用 goalKey 換成新代號再比（維護者 2026-11-11） */
const goalKey = g => g === "3" ? "R3" : g === "4-1" ? "R4" : g;
const isGoal = (r, g) => goalKey(r.goal) === g;
/* 個人、多位學生預設只看聽音選字（維護者 2026-11-11：最符合識字評量——聽到題目，要知道是哪個字）；其他目標到「評量目標比較」，一次看一位學生 */
const MAIN_GOAL = "R3";
const goalsOf = rs => [...new Set(rs.map(r => goalKey(r.goal)))].sort((a, b) => { const i = GOALS.findIndex(g => g.id === a), j = GOALS.findIndex(g => g.id === b); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
function wrongChars(rs){
  const by = groupBy(rs, r => r.char);
  const list = [...by].map(([c, l]) => ({c, n: l.length, w: l.filter(r => !r.firstCorrect).length})).filter(x => x.w >= 1)
    .sort((a, b) => b.w - a.w || a.n - b.n).slice(0, SIMPLE_CHIPS);
  if(!list.length) return `<p class="note" style="margin:0">還沒有選錯的字。</p>`;
  return `<div class="schips">${list.map(x => `<div class="schip">${charLink(x.c, T.kid)}<span>錯 ${x.w} 次<br>正確率 ${pct(x.n - x.w, x.n)}%</span></div>`).join("")}</div>`;
}
function slowChars(rs){
  const by = groupBy(rs, r => r.char);
  const rows = [...by].map(([c, l]) => {
    const passed = l.filter(r => r.passed && typeof r.correctSec === "number"), s = passed.map(r => r.correctSec), r0 = l[0];
    return {char: c, kid: T.kid, word: r0.word || "", lesson: lessonName(r0.book, r0.lesson), n: l.length, acc: pct(l.filter(r => r.firstCorrect).length, l.length), v: avg(s),
      span: s.length ? `${r1(s[0])} → ${r1(s[s.length - 1])} 秒` : "—", hasSec: s.length > 0};
  }).filter(x => x.hasSec).sort((a, b) => b.v - a.v).slice(0, SIMPLE_ROWS);
  if(!rows.length) return `<p class="note" style="margin:0">還沒有答對的紀錄。</p>`;
  return detailTable([["字", r => r.char, true], ["詞語", r => r.word], ["課次", r => r.lesson], ["出現", r => r.n], ["正確率", r => `${r.acc}%`], ["平均反應", r => `${r.v} 秒`], ["第一次 → 最近一次", r => r.span]], rows);
}
function confusedChars(rs){
  const wrong = rs.filter(r => !r.firstCorrect && r.firstPick && !isPartsGoal(r));   /* 聽音選部件選的是部件，不是字，不算在「容易搞混的字」 */
  if(!wrong.length) return `<p class="note" style="margin:0">還沒有選錯的紀錄。</p>`;
  const g = groupBy(wrong, r => `${r.char}→${r.firstPick}`);
  const rows = [...g].map(([k, l]) => { const [c, p] = k.split("→"), ty = groupBy(l.filter(r => r.errorType), r => r.errorType), top = [...ty].sort((a, b) => b[1].length - a[1].length)[0];
    return {char: c, kid: T.kid, pick: p, n: l.length, type: top ? typeName(top[0]) : ""}; }).sort((a, b) => b.n - a.n).slice(0, SIMPLE_ROWS);
  /* 和亂猜比較：統計上顯著（p 值）才說「特別容易」，不然寫「看不出來」（維護者 2026-11-11；見上面「統計上顯著」） */
  const st = sigTypes(wrong), mn = st.n && !st.sig.length ? moreNeeded(st, rs.filter(r => !isPartsGoal(r)).length) : null;
  const trialsTxt = mn && mn.extraTrials ? `（約再作答 ${mn.extraTrials} 題）` : "";
  const moreTxt = !mn ? (st.n >= 5 && !st.sig.length ? "目前沒有哪一類明顯比亂猜多，繼續累積作答再看；如果學生其實是亂猜，不會顯著。" : "")
    : mn.kind === "min" ? `再累積約 ${mn.extraErr} 題錯誤${trialsTxt}才能開始判斷；要錯到十幾二十題以上才比較有機會達到顯著。`
    : mn.kind === "go" ? `如果之後選錯的方式和現在差不多（${esc(typeName(mn.t))}佔錯誤的 ${mn.share}%，亂猜約 ${mn.chance}%），大約再累積 ${mn.extraErr} 題錯誤${trialsTxt}就有機會達到顯著（估算，之後選法變了就不準）。`
    : `${esc(typeName(mn.t))}目前佔錯誤的 ${mn.share}%（亂猜約 ${mn.chance}%），但還要累積很多題（超過 300 題錯誤）才會達到顯著。`;
  const note = !st.n ? "" : st.n < 5
    ? `<p class="note" style="margin:0 0 8px">錯的題目只有 ${st.n} 題，還不夠判斷哪一種錯誤類型比較容易（至少要 5 題）。${moreTxt}</p>`
    : st.sig.length ? `<p class="note" style="margin:0 0 8px">特別容易選成的錯誤類型：${st.sig.map(o => `<b>${esc(typeName(o.t))}</b>（${o.k} 次，亂猜預期約 ${r1(o.e)} 次，統計上顯著，${fmtP(o.p)}）`).join("、")}。</p>`
    : `<p class="note" style="margin:0 0 8px">看不出特別容易搞混哪一種錯誤類型：沒有達到統計上的顯著（p 值要小於 ${r1(st.alpha * 1000) / 1000}）。可能是錯的題數還不夠，也可能接近亂猜。${moreTxt}</p>`;
  return note + detailTable([["字", r => r.char, true], ["常選成", r => r.pick], ["次數", r => r.n], ["錯誤類型", r => r.type]], rows);
}
/* =========================================================
   聽音補部件（R5）、聽音選部件（R6）：是忘記部件、被干擾，還是亂猜（維護者 2026-11-11；規則寫在 docs/design/analysis-parts-confusion.md）
   只看「第一次選／第一次送出」：之後學生已經看過對錯回饋，變成排除法，看不出記不記得。只讀紀錄現有的欄位（options、answerSet、firstPick），不改紀錄格式；
   部件都是單一字元，連在一起的字串用 [...字串] 拆開。
   所有「判斷」都要統計上顯著（p < SIG_ALPHA，見上面「統計上顯著」），沒達到就寫「看不出來」：
   ① 有沒有分辨力：聽音補部件＝答對次數比亂猜（每題 1÷選項數）多；聽音選部件＝選到答案部件的比例比選到干擾部件的比例高（每題各自算超幾何分布再加總，見 strataUpper；不能把所有題的卡片合在一起算）。
      沒達到＝「看不出來」（可能是亂猜，也可能是題數還不夠），不判斷忘記或被干擾。
   ② 忘記部件（有分辨力才判斷）：聽音選部件＝漏選的張數；聽音補部件看不出漏選，選錯的部件**不集中**就算忘記。
   ③ 被干擾：聽音選部件＝多選的張數；聽音補部件＝選錯的是「顯著集中的干擾部件」。
   ④ 忘記和被干擾哪個多：兩者次數做符號檢定（各半），不顯著＝「看不出哪一種比較多」。
   部件別：「常忘記」＝這個部件當答案時第一次選到的比例，顯著低於這位學生其他部件（至少當答案 3 次）；
           「容易被它干擾」＝聽音補部件：這個部件在選錯的題目裡被選到的次數，顯著多於隨機選（至少 3 次）；聽音選部件：被誤選的比例顯著高於這位學生誤選其他干擾部件的比例（至少 3 次）。
           比較的部件很多，門檻除以「夠格比較的部件數」。 */
const PART_MIN = 5;
const countOf = a => { const m = new Map(); a.forEach(x => m.set(x, (m.get(x) || 0) + 1)); return m; };
function partTrial(r){
  if(!isPartsGoal(r) || !r.answerSet || !r.options) return null;
  const opts = [...r.options], ans = r.goal === "R6" ? r.answerSet.split(" ").filter(Boolean) : [r.answerSet], picked = [...(r.firstPick || "")];
  const ac = countOf(ans), oc = countOf(opts), pc = countOf(picked);
  if(!ans.length || !picked.length || [...ac].some(([p, n]) => (oc.get(p) || 0) < n)) return null;   /* 紀錄對不上（舊資料、手動改過）就不算 */
  const answers = [...ac].map(([p, n]) => ({p, n, hit: Math.min(pc.get(p) || 0, n)}));
  const dis = [...oc].map(([p, n]) => ({p, n: n - (ac.get(p) || 0)})).filter(x => x.n > 0).map(x => ({p: x.p, hit: pc.has(x.p) ? 1 : 0}));
  const miss = answers.reduce((n, x) => n + x.n - x.hit, 0), over = dis.reduce((n, x) => n + x.hit, 0);
  return {r, char: r.char, goal: r.goal, answers, dis, miss, over, nAns: ans.length, nDis: dis.length, ok: !miss && !over};
}
function partStats(rs){
  const trials = rs.map(partTrial).filter(Boolean), n = trials.length, sum = f => trials.reduce((a, t) => a + f(t), 0), isR5 = n > 0 && trials.every(t => t.goal === "R5");
  const cardsA = sum(t => t.nAns), cardsD = sum(t => t.nDis), hitsA = cardsA - sum(t => t.miss), fas = sum(t => t.over), H = cardsA ? hitsA / cardsA : null, F = cardsD ? fas / cardsD : null;
  /* ① 有沒有分辨力 */
  let pDisc = null;
  if(n >= PART_MIN) pDisc = isR5 ? pbUpper(trials.map(t => 1 / (t.nDis + 1)), trials.filter(t => !t.miss).length) : strataUpper(trials.map(t => [t.nAns + t.nDis, t.nAns, t.nAns - t.miss + t.over]), hitsA);
  const discr = pDisc != null && pDisc < SIG_ALPHA;
  /* 部件別 */
  const by = new Map(), P = p => by.get(p) || by.set(p, {p, a: 0, h: 0, e: 0, c: 0, qw: [], cw: 0}).get(p);
  trials.forEach(t => {
    t.answers.forEach(x => { const o = P(x.p); o.a += x.n; o.h += x.hit; });
    t.dis.forEach(x => { const o = P(x.p); o.e++; o.c += x.hit; if(isR5 && t.over){ o.qw.push(1 / t.nDis); o.cw += x.hit; } });   /* 聽音補部件：只看選錯的題目，那題選錯時隨機選到它的機率 1÷干擾部件數 */
  });
  const parts = [...by.values()], eligF = parts.filter(o => o.a >= 3).length, eligD = parts.filter(o => isR5 ? o.qw.length >= 3 : o.e >= 3).length;
  const aF = SIG_ALPHA / Math.max(1, eligF), aD = SIG_ALPHA / Math.max(1, eligD);
  parts.forEach(o => {
    o.forget = o.disturb = false; o.pF = o.pD = null;
    if(!discr) return;   /* 看不出有分辨力時，部件別也不下判斷 */
    if(o.a >= 3){ const Hp = (hitsA - o.h + 1) / (cardsA - o.a + 2); o.pF = pbLower(new Array(o.a).fill(Hp), o.h); o.forget = o.h / o.a < Hp && o.pF < aF; }   /* 跟這位學生其他部件比（加一點平滑，免得其他部件全對時機率變成 0） */
    if(isR5 ? o.cw >= 3 && o.qw.length >= 3 : o.c >= 3 && o.e >= 3){
      o.pD = isR5 ? pbUpper(o.qw, o.cw) : pbUpper(new Array(o.e).fill((fas - o.c + 1) / (cardsD - o.e + 2)), o.c);
      o.disturb = o.pD < aD;
    }
  });
  const flagged = new Set(parts.filter(o => o.disturb).map(o => o.p));
  /* 次數：聽音選部件＝張數；聽音補部件＝選錯的題數（選到顯著集中的干擾部件算被干擾，其他算忘記） */
  let forgetN, disturbN;
  if(isR5){ const wrong = trials.filter(t => t.over); disturbN = wrong.filter(t => t.dis.some(x => x.hit && flagged.has(x.p))).length; forgetN = wrong.length - disturbN; }
  else { forgetN = sum(t => t.miss); disturbN = sum(t => t.over); }
  const m = forgetN + disturbN, pSign = m ? Math.min(1, 2 * pbUpper(new Array(m).fill(0.5), Math.max(forgetN, disturbN))) : 1;
  let tag;
  if(n < PART_MIN) tag = "資料不夠";
  else if(!discr) tag = "看不出來";
  else if(!m) tag = "都選對了";
  else tag = pSign < SIG_ALPHA ? (forgetN > disturbN ? "主要是忘記部件" : "主要是被干擾") : "看不出哪一種比較多";
  return {trials, n, H, F, pDisc, discr, parts, forgetN, disturbN, pSign, tag, isR5, okN: trials.filter(t => t.ok).length};
}
const partUnit = st => st.isR5 ? "題" : "張";
const partPct = x => x == null ? "—" : Math.round(x * 100) + "%";
function partConfusion(rs, kid){
  const st = partStats(rs);
  if(!st.n) return `<p class="note" style="margin:0">還沒有可以分析的紀錄（需要有「給學生選的部件」和「第一次選的部件」，比較早的紀錄可能沒有）。</p>`;
  const tile = (label, value, sub) => `<div class="tstat"><span>${label}</span><b>${esc(value)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;
  const u = partUnit(st);
  const how = st.isR5 ? "聽音補部件一次只選一個，看不出漏選：選錯的部件如果顯著集中在同一個干擾部件，算被干擾，其他算忘記。" : "漏選的部件算忘記，多選的干擾部件算被干擾。";
  const why = st.n < PART_MIN ? `只有 ${st.n} 題，少於 ${PART_MIN} 題，先多做幾題再判斷。`
    : !st.discr ? `選到答案部件的比例（${partPct(st.H)}）和${st.isR5 ? "亂猜（約四分之一）" : `選到干擾部件的比例（${partPct(st.F)}）`}沒有明顯差別（統計上沒有達到顯著，${fmtP(st.pDisc)}），所以看不出學生是記得還是在亂選，下面不判斷忘記或被干擾。可能是亂猜，也可能是題數還不夠。`
    : `選到答案部件的比例（${partPct(st.H)}）${st.isR5 ? "" : `顯著高於選到干擾部件的比例（${partPct(st.F)}）`}，統計上顯著（${fmtP(st.pDisc)}），不像亂猜。${how}${st.forgetN + st.disturbN ? (st.pSign < SIG_ALPHA ? `忘記和被干擾的次數差距顯著（${fmtP(st.pSign)}）。` : "忘記和被干擾的次數差距不夠大，看不出哪一種比較多。") : ""}`;
  const head = `<div class="tstats">${tile("看到的題數", `${st.n} 題`, "只看第一次" + (st.isR5 ? "選" : "送出"))}${tile("第一次就全對", `${partPct(st.okN / st.n)}`, `${st.okN}/${st.n} 題`)}
    ${tile("選到答案部件", partPct(st.H), "越高越記得")}${tile("選到干擾部件", partPct(st.F), "越高越像亂選")}${tile("判讀", st.tag, `忘記 ${st.forgetN} ${u}・被干擾 ${st.disturbN} ${u}`)}</div><p class="note">${esc(why)}</p>`;
  const severity = o => (o.forget ? 100 : 0) + (o.disturb ? 100 : 0) + (o.a - o.h) + o.c;
  const prows = st.parts.filter(o => o.a - o.h + o.c > 0).sort((a, b) => severity(b) - severity(a)).slice(0, SIMPLE_ROWS + 2);
  const verdict = o => [o.forget ? `常忘記（${fmtP(o.pF)}）` : "", o.disturb ? `容易被它干擾（${fmtP(o.pD)}）` : ""].filter(Boolean).join("・") || "看不出來";
  const ptable = prows.length ? `<h4 class="sgrp">哪些部件容易出問題<span>　當答案時第一次選到幾次、當干擾時被誤選幾次；統計上顯著才下判斷，其他寫「看不出來」</span></h4>` + detailTable([["部件", r => r.p], ["當答案時第一次選到", r => r.a ? `${r.h}/${r.a}（${pct(r.h, r.a)}%）` : "—"], ["當干擾時被誤選", r => r.e ? `${r.c}/${r.e}（${pct(r.c, r.e)}%）` : "—"],
    ["判讀", verdict]], prows) : "";
  /* 字 × 部件：聽音補部件＝被遮的部件被誤選成哪一個；聽音選部件＝這個字漏選哪些部件、多選了哪些 */
  const g = new Map();
  st.trials.filter(t => !t.ok).forEach(t => {
    const lack = t.answers.filter(x => x.hit < x.n).map(x => x.p + (x.n - x.hit > 1 ? `×${x.n - x.hit}` : "")).join(" "), extra = t.dis.filter(x => x.hit).map(x => x.p).join(" "), k = `${t.char}|${lack}|${extra}`;
    g.set(k, g.get(k) || {char: t.char, kid, lack, extra, n: 0}); g.get(k).n++;
  });
  const crows = [...g.values()].sort((a, b) => b.n - a.n).slice(0, SIMPLE_ROWS);
  const ctable = crows.length ? `<h4 class="sgrp">哪個字選錯了哪些部件<span>　點字可以看每一次作答（含給學生選的部件）</span></h4>` + detailTable([["字", r => r.char, true], [st.isR5 ? "被遮的部件" : "漏選的部件", r => r.lack || "—"], [st.isR5 ? "誤選成" : "多選的部件", r => r.extra || "—"], ["次數", r => r.n]], crows) : "";
  return head + ptable + ctable;
}
/* 近期紀錄（正式評量、練習各一張）：一次評量、一課一列，同一課的放在一起（圖片版面，維護者 2026-10-25）；
   只列最近 10 筆；中途結束的也列出來（灰色、註明「未做完」），但不算進平均 */
const RECENT_ROWS = 10;
/* 和預設不同時才在「前後測／玩法」欄後面加小註記，預設的什麼都不寫（維護者 2026-10-25：選項數、提示現在都固定，整欄拿掉太可惜但不用每列重複）。
   預設：選項 4 個；提示——練習（正確率模式）是「語詞挖空、部件」，正式評量和計時挑戰是「無提示」。舊紀錄（A3 以前的正式評量有提示）、進階設定改過的練習會顯示出來 */
const DEFAULT_PRACTICE_HINTS = "word,parts";
function deviation(r){
  const out = [];
  if(r.layout !== "bingo" && r.choices && r.choices !== 4) out.push(`${r.choices} 個選項`);
  if(r.hintSet !== undefined){
    const def = r.kind !== "formal" && r.mode !== "flu" ? DEFAULT_PRACTICE_HINTS : "";
    if(r.hintSet !== def) out.push(r.hintSet ? `提示：${r.hintSet.split(",").map(h => hintName(h).replace(/（.*?）/g, "")).join("、")}` : "無提示");   /* 名稱去掉括號的說明，免得表格太寬 */
  }
  return out.length ? `（${out.join("；")}）` : "";
}
const recentPlay = r => r.kind === "formal" ? "" : r.mode === "flu" ? "計時挑戰" : r.game ? gameName(r) : r.layout === "bingo" ? "生字賓果" : "一般";
function recentByLesson(all, formal){
  const rows = [];
  for(const s of sessionsOf(all.filter(r => (r.kind === "formal") === formal)))
    for(const [k, list] of groupBy(s.rs, r => key(r.book, r.lesson))) rows.push({k, at: s.at, day: s.day, rs: list});
  const top = rows.sort((a, b) => a.at < b.at ? 1 : -1).slice(0, RECENT_ROWS);
  if(!top.length) return `<p class="note" style="margin:0">還沒有紀錄。</p>`;
  const groups = [...groupBy(top, x => x.k)];   /* 同一課放一起；課次依最近一次的先後排 */
  const cols = formal ? ["日期", "目標", "前後測", "抽到的字", "正確率", "點錯", "平均反應", "沒有一次答對的字"] : ["日期", "目標", "玩法", "抽到的字", "正確率", "點錯", "平均反應", "沒有一次答對的字"];
  return groups.map(([k, list]) => {
    const counted = list.filter(x => !x.rs.some(r => r.quit)), a = accOf(counted.flatMap(x => x.rs));
    const head = `<h4 class="sgrp">${esc(lessonLabel(k))}<span>　${formal ? "評量" : "練習"} ${counted.length} 次${a.v == null ? "" : `，平均正確率 ${a.v}%`}</span></h4>`;
    const body = list.map(x => {
      const r0 = x.rs[0], quit = x.rs.some(r => r.quit), acc = accOf(x.rs), secs = secList(x.rs);
      const chars = [...new Set(x.rs.map(r => r.char))], miss = [...new Set(x.rs.filter(r => !r.firstCorrect).map(r => r.char))];
      const cells = [shortDay(x.day), goalName(goalKey(r0.goal)), (formal ? (r0.prepost || "—") : recentPlay(r0)) + deviation(r0), `<span class="schars">${esc(chars.join(""))}</span>`,
        `${x.rs.filter(r => r.firstCorrect).length}/${x.rs.length}（${acc.v}%）${quit ? "・未做完" : ""}`, x.rs.reduce((n, r) => n + (r.wrongCount || 0), 0), secs.length ? `${avg(secs)} 秒` : "—", `<span class="schars miss">${esc(miss.join(""))}</span>`];
      return `<tr class="${quit ? "squit" : ""}">${cells.map((c, i) => `<td>${i === 3 || i === 7 ? c : esc(c)}</td>`).join("")}</tr>`;
    }).join("");
    return `${head}<div class="tablewrap"><table class="rec"><thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
  }).join("");
}

/* 各課前後測正確率（維護者 2026-10-25）：每個點是一次標了前測或後測的正式評量，灰色背景＝前測、藍色＝後測；
   點上面的課次可以只看那一課（這一欄是唯一需要手動點的地方），預設看全部課合計。依「學生 × 課次」配對（A8 第 12 點） */
function lessonOrder(a, b){ const [ba, na] = splitKey(a), [bb, nb] = splitKey(b); return BOOK_ORDER.indexOf(ba) - BOOK_ORDER.indexOf(bb) || (+na - +nb); }
/* 教學結束後的時間線：橫軸是「每次評量一格」，所以線畫在兩格中間（第 i 格前面＝i - 0.5）；那段時間沒有評量就不畫。days＝每一格的日期（由早到晚） */
function afterEvents(end, days){
  const byIdx = new Map();
  [[0, "教學結束"], [7, "1 週"], [14, "2 週"], [30, "1 個月"]].forEach(([d, name]) => {
    const i = days.findIndex(day => daysBetween(end, day) >= d);
    if(i > 0) byIdx.set(i, [...(byIdx.get(i) || []), name]);
  });
  return [...byIdx].map(([i, names]) => ({x: i - 0.5, cls: "after", label: [...names.filter(n => n === "教學結束"), ...(names.some(n => n !== "教學結束") ? ["教學後 " + names.filter(n => n !== "教學結束").join("・")] : [])].join("・")}));
}
function lessonPrePost(all){
  const formal = all.filter(r => r.kind === "formal"), tagged = formal.filter(r => r.prepost), prac = all.filter(r => r.kind !== "formal");
  /* 還沒有前測、後測時，練習照樣畫（維護者 2026-11-03）：每次練習一格，不會因為沒有前後測就全部疊在同一個位置 */
  if(!tagged.length && !prac.length) return `<p class="note" style="margin:0">還沒有前測、後測或練習的紀錄。做評量時選「正式評量」，再按「前測」或「後測」，就會出現在這裡；練習也會用橘色空心標記畫在這裡。</p>`;
  const ks = [...new Set([...tagged, ...prac].map(r => key(r.book, r.lesson)))].sort(lessonOrder), many = new Set(ks.map(k => splitKey(k)[0])).size > 1;
  const sel = ks.includes(T.simpleLesson) ? T.simpleLesson : "";
  const inLesson = r => !sel || key(r.book, r.lesson) === sel;
  /* 這一課（或全部課）所有「標了前測、後測的正式評量」和「練習」，依時間排成一排，每次評量一格 */
  const sess = sessionsOf([...tagged, ...prac].filter(inLesson)).map(s => ({...s, prac: s.rs[0].kind !== "formal"}));
  const perDay = {}; sess.forEach((s, i) => { s.x = i; s.nth = perDay[s.day] = (perDay[s.day] || 0) + 1; });
  const lab = s => perDay[s.day] > 1 ? `${shortDay(s.day)} 第 ${s.nth} 次` : shortDay(s.day);
  const pts = sess.filter(s => !s.prac).map(s => ({x: s.x, day: s.day, nth: s.nth, rs: s.rs, phase: s.rs[0].prepost, label: lab(s), ...accOf(s.rs)}));
  const extra = sess.filter(s => s.prac).map(s => { const a = accOf(s.rs); return {x: s.x, v: a.v, tip: `${lab(s)}｜練習｜${a.v}%（${a.n} 題）`}; });
  /* 同一天做好幾次：這幾格用細線框成一組，日期寫在這組的中間（維護者 2026-11-03） */
  const dayGroups = Object.keys(perDay).filter(d => perDay[d] > 1).map(d => { const xs = sess.filter(s => s.day === d).map(s => s.x); return {from: Math.min(...xs), to: Math.max(...xs), label: shortDay(d)}; });
  const at = Object.fromEntries(sess.map(s => [s.x, s.nth === 1 && perDay[s.day] === 1 ? shortDay(s.day) : ""]));
  /* 只看一課、而且這位學生這課有教學結束日時，在教學結束、1 週、2 週、1 個月後的第一次評量前面畫直立線（維護者 2026-10-25）；只是看圖的輔助，不影響前測、後測的標記 */
  const tEnd = sel ? teachFor(sel, T.kid) : {}, events = tEnd.type === "dates" && tEnd.end ? afterEvents(tEnd.end, sess.map(s => s.day)) : [];
  const chips = chipRow([["", "全部課合計"], ...ks.map(k => [k, esc(many ? lessonLabel(k) : lessonName(...splitKey(k)))])], sel, "tlsn");
  const note = `點上面的課次，可以只看那一課。一次評量考了好幾課時，會自動依課拆開，各課只算自己那幾題。`;
  if(!sel){
    /* 全部課合計（維護者 2026-11-03）：每課一條線（顏色分課），同一課的前測、後測連在一起；一次評量有好幾課就依課拆開，同一格裡各課各一個點 */
    const series = ks.map((k, i) => { const name = many ? lessonLabel(k) : lessonName(...splitKey(k));
      return {name, color: SERIES_COLORS[i % SERIES_COLORS.length], pts: sess.flatMap(s => { const lr = s.rs.filter(r => key(r.book, r.lesson) === k);
        if(!lr.length) return []; const phase = s.prac ? "練習" : s.rs[0].prepost;
        return [{x: s.x, ...accOf(lr), prac: s.prac, hollow: phase === "前測", label: `${name}｜${lab(s)}｜${phase}`}]; })}; });
    const key2 = `<span><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style="vertical-align:-2px"><circle cx="7" cy="7" r="5" fill="#fff" stroke="var(--muted)" stroke-width="2"/></svg> 前測</span><span><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style="vertical-align:-2px"><circle cx="7" cy="7" r="5" fill="var(--muted)"/></svg> 後測</span><span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style="vertical-align:-3px"><path d="M8 1L15 8L8 15L1 8Z" fill="#fff" stroke="var(--muted)" stroke-width="2.5"/></svg> 練習（和前後測連成同一條線）</span>`;
    return `<div class="trow"><span class="tl">看哪一課</span>${chips}</div>
    <div class="tchart">${multiLine(series, {metric: "acc", at, cells: sess.length, dayGroups, legendExtra: key2})}</div>
    <p class="note">正確率＝第一次就答對的比例。每次評量一格；顏色分課，同一課的前測（空心圓）、練習（空心菱形）、後測（實心圓）依時間連成一條線。各課的前測、後測時間不一樣，所以這張圖不塗背景。同一天做好幾次，用橫軸下面的括號框起來。${note}</p>`;
  }
  const legend = phaseLegend(pts).replace(/<\/div>$/, `<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style="vertical-align:-3px"><path d="M8 1L15 8L8 15L1 8Z" fill="#fff" stroke="#d98a1a" stroke-width="2.5"/></svg>練習（橘色空心菱形，不分前後測，一起連線）</span></div>`);
  return `<div class="trow"><span class="tl">看哪一課</span>${chips}</div>
    <div class="tchart">${legend}${lineChart(pts, {metric: "acc", extra, joinExtra: true, axisPts: sess, dayGroups, slotBands: true, xLabel: x => at[x] || "", xName: "每次評量一格（前測、後測、練習）", events})}</div>
    <p class="note">正確率＝第一次就答對的比例。圓點是正式評量的前測、後測（灰色背景是前測、藍色是後測），橘色空心菱形是練習（不分前後測），全部依時間連成一條線；還沒有前測、後測時也會畫出來。背景只蓋前測、後測那幾格，中間的練習不塗色。同一天做好幾次，每次各占一格，用橫軸下面的括號框起來。${pts.length ? "" : "這裡還沒有前測、後測，目前只有練習。"}${note}${events.length ? "直立線是這課教學結束後的時間：畫在「教學結束、滿 1 週、滿 2 週、滿 1 個月」之後的第一次評量前面（那段時間沒有評量就不畫）。" : ""}</p>`;
}
function renderSimple(){
  /* 兩個分頁共用同一個版面：個人＝固定看聽音選字；評量目標比較＝可以選評量目標（維護者 2026-11-11）。
     聽音選字、部件重組用「選字版面」（選項是字）；聽音補部件、聽音選部件用「選部件版面」（選項是部件，沒有前後測和流暢性） */
  const box = $("#tSimple"), side = $("#tSide"), withData = kidsWithData(), goalMode = T.tab === "goal";
  box.hidden = T.tab !== "one" && !goalMode;
  if(box.hidden) return;
  if(!withData.length){ side.innerHTML = ""; box.innerHTML = `<section class="card tpanel"><p class="hint" style="margin:0">還沒有作答紀錄。學生做過評量後，這裡就會出現名字和結果。</p></section>`; return; }
  /* 統計、折線圖、字的清單：正式評量加練習全部一起算（維護者 2026-10-25）；只有前後測是正式評量才有（練習沒有前後測標記）。中途結束的不算 */
  const kidRecs = records.filter(r => r.kid === T.kid && okRec(r)), goalIds = goalsOf(kidRecs);
  const goal = goalMode ? (goalIds.includes(T.simpleGoal) ? T.simpleGoal : goalIds.includes(MAIN_GOAL) ? MAIN_GOAL : goalIds[0] || MAIN_GOAL) : MAIN_GOAL;
  if(goalMode) T.simpleGoal = goal;
  const everything = records.filter(r => r.kid === T.kid && isGoal(r, goal)), all = everything.filter(okRec), partsPage = !!goalCaps(goal).partsAnswer;
  const kid = kidBy(T.kid), sec = (title, body) => `<section class="ssec"><h3 class="ttitle">${title}</h3>${body}</section>`;
  side.innerHTML = `<div class="trow"><span class="tl">看誰</span>${chipRow(withData.map(k => [k.code, esc(kidLabel(k))]), T.kid, "tkid2")}</div>`
    + (goalMode ? `<div class="trow"><span class="tl">看哪個目標</span>${chipRow(goalIds.map(g => [g, esc(goalName(g))]), goal, "tgoal2")}</div>` : "");
  const head = `<section class="ssec"><h2 class="sname">${esc(kid ? kidLabel(kid) : T.kid)}<small style="font-size:18px;color:var(--muted)">　${esc(goalName(goal))}</small></h2></section>`;
  /* 個人頁：說明只看聽音選字，並列出這位學生其他目標各做了幾題，請到「評量目標比較」看 */
  const others = goalMode ? [] : goalIds.filter(g => g !== MAIN_GOAL).map(g => `${goalName(g)} ${kidRecs.filter(r => isGoal(r, g)).length} 題`);
  const onlyNote = goalMode ? "" : `<section class="ssec"><p class="note" style="margin:0">這頁只看「${esc(goalName(MAIN_GOAL))}」（聽到題目，從選項中找出是哪個字）。${others.length ? `這位學生還有其他目標的作答：${esc(others.join("、"))}，請到上面的「評量目標比較」看。` : ""}</p></section>`;
  if(!all.length){
    box.innerHTML = head + onlyNote + `<section class="ssec"><p class="hint" style="margin:0">這位學生還沒有「${esc(goalName(goal))}」的作答紀錄。</p></section>`;
  } else {
    const secSec = metric => metric === "sec" ? `答對的題目，從${goal === "R4" ? "畫面出現" : "題目唸完"}到答對的平均秒數${goal === "R4" ? "（部件重組沒有唸題目，所以不能和聽音選字的反應時間直接比）" : ""}。` : "";
    const summary = sec("總體紀錄（正式評量＋練習）", simpleSummary(all));
    const accSec = sec("每天的平均正確率", `<div class="tchart">${dailyChart(all, "acc")}</div><p class="note">正確率＝第一次就答對的比例。每個點是那一天所有評量和練習的平均；有標前測、後測的那天，日期後面會註明。</p>`);
    const secSecH = sec("每天的平均反應時間（越低越快）", `<div class="tchart">${dailyChart(all, "sec")}</div><p class="note">${secSec("sec")}</p>`);
    const common = sec("常錯的字", wrongChars(all)) + sec("反應最慢的字", slowChars(all));
    box.innerHTML = head + onlyNote + (partsPage
      ? summary + accSec + secSecH + common + sec("容易搞混的部件（是忘記部件、被干擾，還是亂猜）", partConfusion(all, T.kid)) + sec("近期練習紀錄", recentByLesson(everything, false))
      : summary + accSec + secSecH + sec("每天的流暢性（每分鐘認出幾個字）", fluencySection(all)) + sec("各課前後測正確率", lessonPrePost(all)) + common
        + sec("容易搞混的字", confusedChars(all)) + sec("近期正式評量紀錄", recentByLesson(everything, true)) + sec("近期練習紀錄", recentByLesson(everything, false)));
  }
  const re = () => { const y = window.scrollY; saveT(); renderTeacher(); window.scrollTo(0, y); };   /* 重畫後回到原本捲到的位置 */
  side.querySelectorAll("[data-tkid2]").forEach(b => b.onclick = () => { T.kid = b.dataset.tkid2; T.simpleGoal = ""; re(); });   /* 換學生就回到預設的目標 */
  side.querySelectorAll("[data-tgoal2]").forEach(b => b.onclick = () => { T.simpleGoal = b.dataset.tgoal2; re(); });
  box.querySelectorAll("[data-tlsn]").forEach(b => b.onclick = () => { T.simpleLesson = b.dataset.tlsn; re(); });
  box.querySelectorAll("[data-char]").forEach(el => el.onclick = () => openCharLog(el.dataset.kid || T.kid, el.dataset.char));
  bindChart(box);
}

function renderTeacher(){
  /* 四個分頁：個人、多位學生（都只看聽音選字）、評量目標比較（一次看一位學生、可選目標，2026-11-11）、進階分析。進階分析裡有兩部分：更多圖表與明細（原本「一位學生」下面的選單）、樞紐分析 */
  $("#tTabs").innerHTML = chipRow([["one","個人"],["class","多位學生"],["goal","評量目標比較"],["pivot","進階分析"]], T.tab, "ttab");
  renderTabHelp();
  $("#tTabs").querySelectorAll("[data-ttab]").forEach(b => b.onclick = () => { T.tab = b.dataset.ttab; saveT(); renderTeacher(); });
  const withData = kidsWithData();
  if(!kidBy(T.kid) && withData.length) T.kid = withData[0].code;
  const isOne = T.tab === "one" || T.tab === "goal", isAdv = T.tab === "pivot", charts = isAdv && T.adv !== "pivot";
  const sideTab = isOne || T.tab === "class";   /* 個人、評量目標比較、多位學生：選學生放左側欄 */
  $("#tBody").classList.toggle("hasside", sideTab);
  $("#tSide").hidden = !sideTab;
  $("#tResult").classList.toggle("tflat", T.tab === "class");   /* 多位學生：每個項目各自一張卡片，外層不再包一張大卡片 */
  $("#tMore").hidden = isOne;   /* 個人、評量目標比較：只有上面的簡潔畫面 */
  $("#tAdvTabs").hidden = !isAdv;
  if(isAdv){
    $("#tAdvTabs").innerHTML = chipRow([["charts","更多圖表與明細"],["pivot","樞紐分析（自己決定怎麼分組比較）"]], charts ? "charts" : "pivot", "tadv");
    $("#tAdvTabs").querySelectorAll("[data-tadv]").forEach(b => b.onclick = () => { T.adv = b.dataset.tadv; saveT(); renderTeacher(); });
  }
  $("#tMenu").parentElement.hidden = T.tab === "class";   /* 多位學生：和個人畫面一樣，不用範圍選單 */
  $("#tRangeBox").hidden = isAdv && !charts;   /* 範圍選單：全班和「更多圖表與明細」用，樞紐分析有自己的篩選 */
  renderRangeMenu();
  renderSimple();
  if(isOne) return;
  if(T.tab === "class") renderClass();
  else if(charts) renderOne();
  else renderPivot();
}

/* 每個分頁上方的「這一頁怎麼用？」：平常收起來，打開後記住（換分頁也維持打開） */
const TAB_HELP = {
  one: ["只要選學生，往下捲就看得到（這頁只看「聽音選字」：聽到題目，從選項中找出是哪個字；其他目標到「評量目標比較」看）：總體紀錄、每天的平均正確率和反應時間（折線圖）、各課前後測正確率、常錯的字、反應最慢的字、容易搞混的字、近期正式評量紀錄和近期練習紀錄。想看別的數字、匯出 Excel，到「進階分析」。", [
    "<b>正確率</b>＝第一次就點對的比例（越高越好）；<b>反應時間</b>＝題目唸完到答對的秒數（越短越熟）。",
    "統計、每天的折線圖和字的清單，是正式評量加練習全部一起算；「各課前後測正確率」的圓點是正式評量的前測、後測，橘色空心菱形是練習，依時間連成一條線。",
    "「各課前後測正確率」上面的課次按鈕可以點，看每一課；任何一個字都可以點，看那個字的每一次作答。"], "one"],
  goal: ["選一位學生、再選評量目標，版面和「個人」一樣。聽音選字、部件重組用「選字」的版面（選項是字）；聽音補部件、聽音選部件用「選部件」的版面（選項是部件，沒有前後測和流暢性，分析的是忘記部件、被干擾，還是亂猜）。", [
    "不同目標的難度和計時方式不一樣（亂猜時第一次答對：聽音選字約 25%、聽音選部件全對只有約 5～7%；聽音選字從題目唸完才計時，部件重組從畫面出現就計時），所以不要把不同目標的正確率、反應時間直接拿來比。",
    "「特別容易搞混」「忘記部件」「被干擾」這類判斷，要統計上顯著（p 值小於 0.05）才寫；題數不夠或接近亂猜時一律寫「看不出來」，不是系統壞了。",
    "聽音補部件、聽音選部件目前只開放練習，有提示和回饋，數字看學生的狀況，不當前後測比較。"], "goal"],
  charts: ["看一位學生的進步，自己選：由上往下選：看誰 → 看什麼 → 怎麼看，下面再選日期和課次範圍。", [
    "<b>正確率</b>＝第一次就點對的比例（越高越好）；<b>反應時間</b>＝題目唸完到答對的秒數（越短越熟）；<b>流暢性</b>＝計時挑戰每分鐘答對幾個。",
    "<b>依前後測比較</b>最直接看有沒有進步：前測 → 後測。沒標前測或後測的評量放在「未標記」。",
    "結果區的「看明細」是圖上每個數字的表格；任何一個字都可以點，看那個字的每一次作答。",
    "找不到資料時，先把日期改成「全部」、性質改成「全部」。"], "one"],
  class: ["比較幾位學生：先點上面的學生（最多 8 位，可以存成組別，組別也能在「學生名單」編輯），每一列是一位學生。", [
    "常錯的字、反應最慢的字、容易搞混的字：每位學生各列出前 5 個；任何一個字都可以點，看那位學生那個字的每一次作答。",
    "最下面是「學生 × 生字」：格子大字＝第一次就答對的比例，小字＝作答次數；藍色越深越好，「—」＝還沒考過。直著看一欄，大家都淺色的字，可能字本身難或教學要調整。",
    "這頁和「個人」一樣只看聽音選字；其他目標到「評量目標比較」，一次看一位學生。",
    "「特別容易搞混」「忘記部件」「被干擾」這類判斷，要統計上顯著（p 值小於 0.05）才寫；題數不夠或接近亂猜時一律寫「看不出來」，不是系統壞了。",
    "組別只存在這台電腦的瀏覽器裡，不會進作答紀錄。"], "class"],
  pivot: ["自己決定怎麼分組比較，做法像 Excel 的樞紐分析表：先選要算的數字（指標），再選怎麼分組（列、欄）。", [
    "不知道怎麼選？先按上方的<b>範例</b>，每個範例都附「這在回答什麼、怎麼看」。",
    "<b>列</b>＝表格每一橫列是一組；<b>欄</b>＝每一直欄是一組（可以不選）；每一格是那一組的數字，小字是用了幾筆紀錄。",
    "<b>篩選</b>＝只留下某一種紀錄（例如只看小明）；<b>分組</b>＝全部留下、分開算。",
    "淡色格子筆數太少，數字容易因為多對一題就大變，僅供參考。"], "pivot"]
};
function renderTabHelp(){
  const [lead, list] = TAB_HELP[T.tab === "pivot" && T.adv !== "pivot" ? "charts" : T.tab], el = $("#tHelp");
  el.innerHTML = `<summary>這一頁怎麼用？</summary><p>${lead}</p><ul>${list.map(x => `<li>${x}</li>`).join("")}</ul>`;
  el.open = !!T.helpOpen;
  el.ontoggle = () => { if(T.helpOpen !== el.open){ T.helpOpen = el.open; saveT(); } };
}

/* 範圍選單（一位學生、全班總表共用） */
function renderRangeMenu(){
  const books = [...new Set(records.map(r => r.book))].filter(b => BOOKS[b]).sort((a, b) => BOOK_ORDER.indexOf(a) - BOOK_ORDER.indexOf(b));
  const goals = [...new Set(records.map(r => r.goal))].sort();
  if(T.book && !BOOKS[T.book]){ T.book = ""; T.lesson = ""; }   /* 存著的課本已經不在資料裡（改代號、拿掉）：回到全部課本，不然整頁會壞（2026-11-06 健檢） */
  $("#tRange").innerHTML = `
    <div class="trow"><span class="tl">日期</span>${chipRow(RANGES, T.range, "trange")}
      ${T.range === "custom" ? `<label>從 <input type="date" id="tFrom" value="${T.from}"></label><label>到 <input type="date" id="tTo" value="${T.to}"></label>` : ""}
      <span class="note" style="margin:0">${esc(rangeText())}</span></div>
    <div class="trow"><span class="tl">性質</span>${chipRow(KINDS_F, T.kind, "tkind")}</div>
    <div class="trow"><span class="tl">課次</span>
      <select id="tBook" aria-label="課本"><option value="">全部課本</option>${books.map(b => `<option value="${b}" ${T.book === b ? "selected" : ""}>${esc(bookName(b))}</option>`).join("")}</select>
      ${T.book ? `<select id="tLesson" aria-label="課次"><option value="">全部課次</option>${Object.keys(BOOKS[T.book].lessons).map(n => `<option value="${n}" ${T.lesson === n ? "selected" : ""}>${esc(lessonName(T.book, n))}</option>`).join("")}</select>` : ""}
      ${goals.length > 1 ? `<select id="tGoal" aria-label="評量目標"><option value="">全部目標</option>${goals.map(g => `<option value="${esc(g)}" ${T.goal === g ? "selected" : ""}>${esc(goalName(g))}</option>`).join("")}</select>` : ""}</div>`;
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
      ${T.view === "time" ? `<span class="sep"></span>${chipRow([["date","橫軸：測驗日期"],["teach","橫軸：教學開始後第幾天"]], T.axis, "taxis")}<span class="sep"></span>${chipRow([["lesson","每課分開"],["all","合併成一條"]], T.split, "tsplit")}` : ""}</div>` : ""}
    ${M.id === "gap" ? `<div class="trow"><span class="tl">哪一種間隔</span>${chipRow(Object.entries(GAP_BUCKETS).map(([k, g]) => [k, g.name]), T.gap, "tgap")}</div>` : ""}
    ${M.id === "freq" ? `<div class="trow"><span class="tl">常用字範圍</span>${chipRow([["100","前 100 名"],["300","前 300 名"],["1000","前 1000 名"]], T.top, "ttop")}</div>` : ""}`;
  const re = () => { saveT(); renderTeacher(); };
  $("#tMenu").querySelectorAll("[data-tkid]").forEach(b => b.onclick = () => { T.kid = b.dataset.tkid; re(); });
  $("#tMenu").querySelectorAll("[data-tmetric]").forEach(b => b.onclick = () => { T.metric = b.dataset.tmetric; re(); });
  $("#tMenu").querySelectorAll("[data-tview]").forEach(b => b.onclick = () => { T.view = b.dataset.tview; re(); });
  $("#tMenu").querySelectorAll("[data-taxis]").forEach(b => b.onclick = () => { T.axis = b.dataset.taxis; re(); });
  $("#tMenu").querySelectorAll("[data-tsplit]").forEach(b => b.onclick = () => { T.split = b.dataset.tsplit; re(); });
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
  if(M.kind === "trend"){
    if(T.view === "lesson") return `<p>每一條是一課，長度是那一課全部作答合起來的${esc(M.name)}（${better}）。括號是用了幾題。比較哪一課比較難，可以優先複習。</p>`;
    if(T.view === "phase") return `<p>每一條是前測或後測，${esc(M.name)}${better}。理想的樣子：前測低 → 後測升高。</p>
      <p>括號是筆數；只有幾題時，數字容易大幅變動，先多評量幾次再下結論。前測、後測是作答前老師按的標記。</p>`;
    return `<p>${T.split === "lesson" ? "最上面「全部課合計」是每次評量全部的課合起來一個點，不分前測後測，看整體的起伏；下面每一課一張小圖，橫軸對齊，可以上下比較：先教的課有沒有先進步、還沒教的課是不是維持原樣。" : "全部的課合成一條線。"}一個點＝一次評量（流暢性是一回合），${esc(M.name)}${better}。背景顏色＝前測、後測（顏色對照在圖的上方），虛線＝標記改變的地方；直線＝本學期安排的學扶、資源班開始日。空心點＝那一點不到 3 題，數字容易大起大落。滑鼠移到點上看數字。</p>
      ${T.split === "all" ? "<p>合成一條時，同一次評量含好幾課，背景顏色用的是那次最多題目的標記，可能前後跳來跳去。要看前測後測請切回「每課分開」。</p>" : ""}
      <ul><li><b>水準</b>：前測、後測大約在多高？</li><li><b>趨勢</b>：同一種標記裡的點往上、持平還是往下？前測已經一直往上的話，很難說進步是教學造成的。</li>
      <li><b>穩定</b>：點有沒有忽高忽低？</li><li><b>立即效果</b>：教學開始後頭幾個點，是不是馬上和前測不同。</li></ul>`;
  }
  return {
    gap: `<p>依間隔天數分組，每一條是那一組第一次就答對的比例。間隔越長、比例掉越多，表示越需要早一點複習。「教學結束前或沒填日期」那一組可以當對照。</p>`,
    miss: `<p>錯誤率最高的字排最前面（第一次就選錯的比例），一樣時作答次數多的在前。看「最常選錯成」：同音字多要加強聽音辨字，形近字多要比較字形。點字看每一次作答。</p>`,
    freq: `<p>常用字依字頻排名排序，條越長錯越多。先確保最常用的字都會。</p>`,
    etype: `<p>第一次選錯時，選到哪一類的字。同音多→多做聽音辨字、用語詞區分；形近多→比較字形、部件；同詞多→語詞裡每個字的位置還不穩；同部件多（部件重組）→部件的位置和組合還不熟。</p>`,
    hint: `<p>每一題用到的最高提示：0＝不用提示，1～3＝系統給，4～7＝老師按的按鈕。介入有效時，「0 不用提示」的比例應該越來越高。</p>`
  }[M.id];
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
const phaseOf = r => r.prepost || "未標記";
/* 一群紀錄最常見的時期（同一次評量含多課時可能不同） */
const mainPhase = rs => { const c = {}; rs.forEach(r => c[phaseOf(r)] = (c[phaseOf(r)] || 0) + 1); return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; };

function trendView(rs, m){
  const fn = METRIC_FN[m], k = kidBy(T.kid), who = k ? kidLabel(k) : T.kid;
  const src = m === "flu" ? rs.filter(r => r.mode === "flu") : rs;
  if(m === "flu" && !src.length) return {title:`${who}・流暢性`, tiles:[["流暢性回合","0",""]], chart:"",
    /* 計時挑戰算練習：只看正式評量時看不到，提醒老師切換「性質」 */
    note: T.kind === "formal" ? "正式評量沒有流暢性紀錄。計時挑戰算練習，請把上面的「性質」切到「練習」或「全部」。" : "這個範圍沒有流暢性模式（計時挑戰）的紀錄。", cols:[], rows:[]};
  const all = fn(src), mName = METRICS.find(x => x.id === m).name;
  let groups, chart, cols, note = "", latest;   /* latest＝「最近一次」卡片用的點（每課分開時看全部課合起來的最後一次評量） */
  if(T.view === "time" && T.axis === "teach"){
    /* 教學開始後第幾天：每筆紀錄依它那一課的教學開始日對齊 */
    /* 每位學生用自己的教學開始日（有個別設定就用個別的） */
    const withStart = src.filter(r => teachFor(key(r.book, r.lesson), r.kid).start);
    const g = groupBy(withStart, r => daysBetween(teachFor(key(r.book, r.lesson), r.kid).start, dayOf(r)));
    groups = [...g].sort((a, b) => a[0] - b[0]).map(([d, list]) => ({x:d, label: d < 0 ? `開始前 ${-d} 天` : `第 ${d} 天`, rs:list, phase: mainPhase(list), ...fn(list)}));
    note = `只有輸入過教學日期的課才能這樣對齊（${withStart.length} / ${src.length} ${unitN("acc")}）。0＝教學開始那一天。`;
    const o = {metric:m, xLabel: d => `${d}`, events:[{x:0, label:"教學開始"}], eventsInDomain:true, xName:"教學開始後第幾天"};
    if(T.split === "lesson"){
      ({chart, groups} = lessonPanels(withStart, (r, kk) => daysBetween(teachFor(kk, r.kid).start, dayOf(r)), fn,
        (x, list) => ({label: x < 0 ? `開始前 ${-x} 天` : `第 ${x} 天`}), o, null, groups));
    } else chart = phaseLegend(groups) + lineChart(groups, o);
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
    const sess = groups;   /* 每課分開時也用同一個橫軸：第幾次評量 */
    const o = {metric:m, xLabel: i => sess[i] && sess[i].nth === 1 ? shortDay(sess[i].day) : "", events: planEvents(sess), xName:"測驗日期（每次評量一格）"};
    if(T.split === "lesson"){
      const at = new Map(sess.map(p => [p.rs[0].session, p]));
      ({chart, groups} = lessonPanels(src, r => at.get(r.session).x, fn, x => ({label: sess[x].label, day: sess[x].day}), o, sess, sess));
      latest = sess[sess.length - 1];
    } else chart = phaseLegend(groups) + lineChart(groups, o);
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
    note = "前測、後測是作答前老師按的標記。";
  }
  const viewName = T.view === "time" ? (T.axis === "teach" ? "依教學開始後天數" : "依測驗日期") : T.view === "lesson" ? "依課別" : "依前後測";
  const last = latest || groups[groups.length - 1];
  const perLesson = T.view === "time" && T.split === "lesson";
  cols = [[T.view === "lesson" ? "課次" : T.view === "phase" ? "前後測" : "日期", g => g.label], ...(perLesson ? [["課次", g => g.lesson]] : []), ...(T.view === "time" ? [["前後測", g => g.phase]] : []),
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

/* ---------- 依時間・每課分開（2026-10-24 維護者決定）----------
   時期是每一課各自算的，全部合成一條線時時期會來回跳；改成一課一張小圖、上下排、共用橫軸（單一受試研究的多基線圖）。
   xOf(r, 課)＝這筆紀錄在橫軸的位置；info(x, list)＝這一點的標籤等；all＝共用橫軸的全部點（給橫軸標籤和範圍用）；
   total＝全部課合起來的點：畫在最上面「全部課合計」，每次評量一個點，不分時期（2026-10-24 維護者要求） */
function lessonPanels(src, xOf, fn, info, o, all, total){
  const order = k => { const [b, n] = splitKey(k); return BOOK_ORDER.indexOf(b) * 1000 + (+n); };
  if(!src.length) return {chart:"", groups:[]};
  const byLesson = [...groupBy(src, r => key(r.book, r.lesson))].sort((a, b) => order(a[0]) - order(b[0]));
  const lessons = byLesson.map(([kk, list]) => {
    const name = lessonLabel(kk);
    const pts = [...groupBy(list, r => xOf(r, kk))].sort((a, b) => a[0] - b[0])
      .map(([x, rs]) => ({x, ...info(x, rs), lesson:name, rs, phase: mainPhase(rs), ...fn(rs)}));
    return {name, pts};
  });
  /* 橫軸：「全部課合計」用全部的點；每一課小圖用自己的範圍（2026-10-26 維護者決定：老師要的是直觀看單課的進步，
     不用上下對齊，後面的課才不會被前面的空白擠到一邊）。直線（教學安排、教學開始）只畫在範圍內；o.eventsInDomain＝直線一定要在圖裡（教學開始） */
  const rangeOf = (pts, evs) => {
    const xs = pts.map(p => p.x).concat(evs.map(e => e.x));
    if(!xs.length) return [0, 1];
    const a = Math.min(...xs), b = Math.max(...xs), pad = b > a ? (b - a) * 0.04 : 0.5;
    return [a - pad, b + pad];
  };
  const events = o.events || [];
  const totalDomain = rangeOf(all || lessons.flatMap(l => l.pts), events);
  /* 縱軸也統一，各課才比得出高低（正確率本來就固定 0～100%） */
  const ymax = Math.max(...lessons.flatMap(l => l.pts.map(p => p.v || 0)), ...(total || []).map(p => p.v || 0));
  const own = l => {
    const lo = Math.min(...l.pts.map(p => p.x)), hi = Math.max(...l.pts.map(p => p.x));
    const evs = o.eventsInDomain ? events : events.filter(e => e.x >= lo - 1 && e.x <= hi + 1);
    return {domain: rangeOf(l.pts, evs), events: evs};
  };
  const chart = (total && total.length ? lineChart(total, {...o, domain: totalDomain, ymax, axisPts: all, title:"全部課合計（每次評量一個點，不分時期）", compact:true, noPhase:true, xName:""}) : "") + phaseLegend(lessons.flatMap(l => l.pts)) + lessons.map((l, i) =>
    lineChart(l.pts, {...o, ...own(l), ymax, axisPts: l.pts, title:l.name, compact:true, xName: i === lessons.length - 1 ? o.xName : ""})).join("");
  return {chart, groups: lessons.flatMap(l => l.pts).sort((a, b) => a.x - b.x)};
}
/* 同一天做好幾次：橫軸下面一條細括號把這幾格框起來，日期寫在括號中間（維護者 2026-11-03 選的做法） */
const dayBraces = (groups, X, y, H) => (groups || []).map(d => { const a = X(d.from) - 10, b = X(d.to) + 10;
  return `<path class="daybrace" d="M${a} ${y + 6}V${y + 10}H${b}V${y + 6}"/><text class="ax" x="${(a + b) / 2}" y="${H - 14}" text-anchor="middle">${esc(d.label)}</text>`; }).join("");
/* 時期的背景色（淺色，靠圖例和虛線輔助，不只靠顏色分辨）；未標記不塗色 */
const phaseCls = p => `ph${p === "前測" ? 0 : p === "後測" ? 1 : 4}`;   /* 前測灰、後測藍、未標記不塗色（CSS 的 ph0、ph1、ph4） */
function phaseLegend(pts){
  const has = new Set(pts.map(p => p.phase));
  return `<div class="legend phaselegend">${PHASE_ORDER.filter(p => has.has(p)).map(p => `<span><i class="${phaseCls(p)}"></i>${esc(p)}</span>`).join("")}<span><i class="dashkey"></i>標記改變</span></div>`;
}

/* ---------- 圖：折線圖（依時間） ----------
   一條線（單一學生、單一指標），2px 線、8px 點；背景顏色＝時期，時期改變的地方畫虛線（2026-10-24 起不在圖上寫時期名稱，看上方圖例）；
   直線＝教學安排開始日。滑鼠或鍵盤移到點上會顯示數字；不到 3 題的點畫空心。
   o.domain＝共用的橫軸範圍、o.ymax＝共用的縱軸最大值、o.title＝小圖標題、o.compact＝矮一點（每課分開時用）、o.noPhase＝不畫時期（全部課合計） */
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
  const H = o.compact ? (o.xName ? 214 : 204) : 300, L = 52, R = 20, Tp = o.compact ? 28 : 22, B = o.compact ? (o.xName ? 42 : 32) : 38, iw = SVGW - L - R, ih = H - Tp - B;
  const ys = pts.map(p => p.v).filter(v => v != null).concat((o.extra || []).map(p => p.v).filter(v => v != null));
  const ticks = o.metric === "acc" ? [0, 25, 50, 75, 100] : niceTicks((o.ymax != null ? o.ymax : Math.max(...ys)) * 1.05), max = ticks[4];
  const xs = pts.map(p => p.x).concat((o.events || []).map(e => e.x), (o.extra || []).map(p => p.x));
  const edge = (o.extra || []).length ? 0.5 : 0;   /* 有練習點（每次評量一格）時左右各留半格，頭尾的點不會貼在邊框上 */
  const [x0, x1] = o.domain || [Math.min(...xs) - edge, Math.max(...xs) + edge], span = x1 - x0 || 1;
  const X = x => !o.domain && new Set(xs).size === 1 ? L + iw / 2 : L + (x - x0) / span * iw, Y = v => Tp + ih - v / max * ih;
  const unit = o.metric === "acc" ? "%" : o.metric === "sec" ? " 秒" : "";
  /* 時期：背景色塊（先畫，在格線和線的下面）＋改變處的虛線；第一段和最後一段在點的外面留半格，碰到圖的邊就到邊 */
  let g = "", lines = "";
  const segs = []; pts.forEach((p, i) => { if(!i || p.phase !== pts[i-1].phase) segs.push({phase:p.phase, from:i, to:i}); else segs[segs.length - 1].to = i; });
  const pad = pts.length > 1 ? Math.min(24, (X(pts[1].x) - X(pts[0].x)) / 2) : 24;
  if(!o.noPhase) segs.forEach((s, i) => {
    const first = pts[s.from], lastP = pts[s.to];
    /* slotBands（每次評量一格、中間夾練習時）：背景只從這個時期的第一格蓋到最後一格，夾在前測和後測中間的練習不塗色（維護者 2026-11-03） */
    const a = o.slotBands ? Math.max(L, X(first.x - 0.5)) : i ? (X(pts[s.from - 1].x) + X(first.x)) / 2 : (first.x <= x0 ? L : Math.max(L, X(first.x) - pad));
    const b = o.slotBands ? Math.min(SVGW - R, X(lastP.x + 0.5)) : i < segs.length - 1 ? (X(lastP.x) + X(pts[s.to + 1].x)) / 2 : (lastP.x >= x1 ? SVGW - R : Math.min(SVGW - R, X(lastP.x) + pad));
    g += `<rect class="band ${phaseCls(s.phase)}" x="${a.toFixed(1)}" y="${Tp}" width="${Math.max(0, b - a).toFixed(1)}" height="${ih}"><title>${esc(s.phase)}</title></rect>`;
    if(i) lines += `<line class="phaseline" x1="${a}" x2="${a}" y1="${Tp}" y2="${Tp + ih}"/>`;
  });
  g += ticks.map(t => `<line class="grid" x1="${L}" x2="${SVGW - R}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${L - 8}" y="${Y(t) + 4}" text-anchor="end">${t}${unit}</text>`).join("") + lines;
  if(o.title) g += `<text class="paneltitle" x="${L}" y="${Tp - 9}">${esc(o.title)}</text>`;
  (o.events || []).forEach(e => { const x = X(e.x); g += `<line class="event ${e.cls || ""}" x1="${x}" x2="${x}" y1="${Tp}" y2="${Tp + ih}"/><text class="eventname ${e.cls || ""}" x="${x + 4}" y="${Tp + ih - 6}">${esc(e.label)}</text>`; });
  g += dayBraces(o.dayGroups, X, Tp + ih, H);
  /* 線與點（數值是空的點不畫） */
  const ok = pts.filter(p => p.v != null);
  const path = (o.joinExtra ? ok.concat((o.extra || []).filter(p => p.v != null)).sort((a, b) => a.x - b.x) : ok).map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");
  g += `<path class="line" d="${path}"/>`;
  g += ok.map(p => `<circle class="dot${o.metric !== "flu" && p.n < 3 ? " few" : ""}" cx="${X(p.x)}" cy="${Y(p.v)}" r="5" tabindex="0" data-tip="${esc(`${p.label}｜${p.lesson ? p.lesson + "｜" : ""}${o.noPhase ? "" : p.phase + "｜"}${fmt(o.metric, p.v)}（${p.n} ${unitN(o.metric)}）`)}"/>`).join("");
  /* 額外的一組點（例如前後測圖裡的練習）：橘色空心菱形，和主線的圓點分得出來；o.joinExtra＝也連進主線（各課前後測圖，維護者 2026-11-03），否則不連線；o.extra＝[{x, v, tip}] */
  (o.extra || []).filter(p => p.v != null).forEach(p => { const cx = X(p.x), cy = Y(p.v);
    g += `<path class="pdot" d="M${cx} ${cy - 7}L${cx + 7} ${cy}L${cx} ${cy + 7}L${cx - 7} ${cy}Z" tabindex="0" data-tip="${esc(p.tip)}"/>`; });
  /* 最後一點標數字（只標一個，其餘看表格或移上去看）；前一點太近就不標，避免疊在一起 */
  const lp = ok[ok.length - 1], lp0 = ok[ok.length - 2];
  if(lp && (!lp0 || X(lp.x) - X(lp0.x) > 44)) g += `<text class="endlabel" x="${Math.min(X(lp.x), SVGW - R - 4)}" y="${Y(lp.v) - 12}" text-anchor="${X(lp.x) > SVGW - 80 ? "end" : "middle"}">${fmt(o.metric, lp.v)}</text>`;
  /* 橫軸標籤：和前一個標籤至少隔 48 像素才標，日期靠很近時不會疊在一起 */
  let lastX = -1e9;
  g += (o.axisPts || pts).map(p => { const x = X(p.x), t = o.xLabel(p.x); if(!t || x - lastX < 48) return ""; lastX = x; return `<text class="ax" x="${x}" y="${H - 14}" text-anchor="middle">${esc(t)}</text>`; }).join("");
  if(o.xName) g += `<text class="ax" x="${SVGW - R}" y="${H - 1}" text-anchor="end">${esc(o.xName)}</text>`;
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
      const dist = c => svg.dataset.multi ? Math.hypot(c.cx.baseVal.value - loc.x, c.cy.baseVal.value - loc.y) : Math.abs(c.cx.baseVal.value - loc.x);   /* 多條線的圖：找最近的點（上下也算），單條線只看左右 */
      const d = dots.reduce((a, b) => dist(b) < dist(a) ? b : a);
      show(d, d.cx.baseVal.value);
    });
    box.querySelectorAll(".barhit, .pdot").forEach(b => b.addEventListener("pointerenter", () => show(b)));
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
    wrong.forEach(r => { if(r.firstPick && !isPartsGoal(r)) conf[r.firstPick] = (conf[r.firstPick] || 0) + 1; });
    const top = Object.entries(conf).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const r0 = list[list.length - 1];
    return {char:c, kid:r0.kid, word:r0.word, lesson:lessonLabel(key(r0.book, r0.lesson)), n:list.length, wrong:wrong.length,
      err: pct(wrong.length, list.length), acc: pct(list.length - wrong.length, list.length), conf: top.map(([x, n]) => `${x}（${n}）`).join("、"), sec: secOf(list).v};
  });
}
/* 和隨機猜比較：每一題選錯時，如果是在干擾字裡隨便猜，各類字被選到的機會＝那類字在干擾字裡占幾分之幾。
   把每一題的機會加起來，就是「隨機猜的話預期幾次」。選項的類別用 play.js 的 optType 依現在的教材重新判斷（紀錄只存了選項的字） */
function chanceQs(wrong){   /* 每一類：每題的亂猜機率（那題選錯時，隨便猜到這類字的機率）；2026-11-11 為了算 p 值，從 chanceOf 拆出來 */
  const qs = {};
  wrong.forEach(r => {
    if(isPartsGoal(r)) return;   /* 聽音選部件的選項是部件、錯法是少選或選到干擾部件，不拿亂猜比較 */
    const opts = [...(r.options || "")].filter(x => x !== r.char);
    if(!opts.length) return;
    const cnt = {};
    opts.forEach(x => {
      let t; try { t = optType(r.char, x, key(r.book, r.lesson), r.goal); } catch(e){ t = "其他字"; }
      if(t !== "答案") cnt[t] = (cnt[t] || 0) + 1 / opts.length;
    });
    for(const t in cnt) (qs[t] = qs[t] || []).push(cnt[t]);
  });
  return qs;
}
function chanceOf(wrong){   /* 每一類「亂猜預期幾次」＝每題機率加總 */
  const exp = {};
  Object.entries(chanceQs(wrong)).forEach(([t, a]) => { exp[t] = a.reduce((x, y) => x + y, 0); });
  return exp;
}
/* 哪些錯誤類型「統計上顯著」比亂猜多（個人頁的字、進階分析的錯誤類型共用）：錯的題目至少 5 題，該類至少 3 次、至少 1.5 倍，
   而且 p 值小於 SIG_ALPHA ÷ 比較的類別數 */
function sigTypes(wrong){
  const use = wrong.filter(r => r.errorType && !isPartsGoal(r) && [...(r.options || "")].some(x => x !== r.char));
  const qs = chanceQs(use), g = groupBy(use, r => r.errorType), types = ETYPES.filter(t => qs[t]), alpha = SIG_ALPHA / Math.max(1, types.length);
  const rows = types.map(t => { const k = g.has(t) ? g.get(t).length : 0, e = qs[t].reduce((a, b) => a + b, 0); return {t, k, e, ratio: e ? k / e : 0, p: pbUpper(qs[t], k)}; });
  return {n: use.length, alpha, rows, sig: use.length >= 5 ? rows.filter(o => o.k >= 3 && o.ratio >= 1.5 && o.p < alpha).sort((a, b) => a.p - b.p) : []};
}
/* 「再累積多少題才有機會判斷」的估算（維護者 2026-11-11）：假設之後選錯的方式和現在一樣（以目前最偏向的那一類為準），
   模擬再多錯幾題時會不會達到顯著（同樣的 p 值規則，亂猜機率用目前每題的平均）；再用這位學生的錯誤率換算成要再作答幾題。
   目前沒有哪一類比亂猜多 1.5 倍時沒辦法估（回傳 null）。只是估算，之後選法變了就會不準。 */
function moreNeeded(st, trialsAll){
  const rate = trialsAll ? st.n / trialsAll : 0, toTrials = x => rate > 0 ? Math.ceil(x / rate) : null;
  if(st.n < 5) return {kind: "min", extraErr: 5 - st.n, extraTrials: toTrials(5 - st.n)};
  const cand = st.rows.filter(o => o.k >= 1 && o.ratio >= 1.5).sort((a, b) => b.ratio - a.ratio)[0];
  if(!cand) return null;
  const share = cand.k / st.n, q = cand.e / st.n;
  for(let n2 = st.n + 1; n2 <= 300; n2++){
    const k2 = Math.max(3, Math.ceil(n2 * share));
    if(k2 / (n2 * q) >= 1.5 && pbUpper(new Array(n2).fill(q), k2) < st.alpha) return {kind: "go", t: cand.t, share: Math.round(share * 100), chance: Math.round(q * 100), extraErr: n2 - st.n, extraTrials: toTrials(n2 - st.n)};
  }
  return {kind: "far", t: cand.t, share: Math.round(share * 100), chance: Math.round(q * 100)};
}
/* 目標字在語詞的哪個位置（例如「蘋果」的「蘋」在詞首、「果」在詞尾）；單字或沒有語詞回傳空字串。進階分析也用 */
const WPOS_ORDER = ["詞首（第 1 個字）", "詞中", "詞尾（最後一個字）", "單字或沒有語詞"];
const wposOf = r => { const w = [...(r.word || "")], i = w.indexOf(r.char); return w.length < 2 || i < 0 ? "" : i === 0 ? WPOS_ORDER[0] : i === w.length - 1 ? WPOS_ORDER[2] : WPOS_ORDER[1]; };
/* 錯誤類型說明的最後一段：目標字在詞首、詞尾時的第一次就答對率與同詞易混次數（語詞是整塊記的學生，常常一邊比較穩） */
function wposNote(rs){
  const g = groupBy(rs.filter(r => wposOf(r) && r.goal !== "R4"), wposOf);
  const parts = WPOS_ORDER.filter(p => g.has(p)).map(p => {
    const list = g.get(p), a = accOf(list), mix = list.filter(r => !r.firstCorrect && r.errorType === "同詞易混").length;
    return `${p}：正確率 ${fmt("acc", a.v)}（${a.n} 題），同詞 ${mix} 次`;
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
      return {label:typeName(t), v, n:v, share:pct(v, wrong.length), chance: expAll ? pct(e, expAll) : null, ratio: e ? Math.round(v / e * 10) / 10 : null};
    });
    const conf = {}; wrong.filter(r => !isPartsGoal(r)).forEach(r => { const k = `${r.char}→${r.firstPick}`; conf[k] = (conf[k] || 0) + 1; });
    const pairs = Object.entries(conf).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => k.replace("→", " 選成 ") + `（${n} 次）`).join("、");
    const top = rows.slice().sort((a, b) => b.v - a.v)[0];
    /* 特別容易搞混的類別：統計上顯著才列（p 值，見上面「統計上顯著」）；以前是「亂猜的 1.5 倍以上、至少 3 次」 */
    const sg = sigTypes(wrong), over = sg.sig.map(o => ({...rows.find(r => r.label === typeName(o.t)), p: o.p}));
    return {title: whoTitle("錯誤類型"), chart: barChart(rows, {label: r => `${r.v} 次（${r.share}%）${r.chance == null ? "" : `・亂猜會佔 ${r.chance}%`}`}), rows,
      note: `第一次就選錯時，選到的是哪一類的字。同詞＝同一個語詞裡的另一個字（例如「新聞」的「聞」）；同部件＝有相同部件的字（只在部件重組）。`
        + `<br>「亂猜會佔」：如果學生不會、亂猜一個，這類字大概會被點到幾 %（例如 3 個選項裡只有 1 個同詞字，亂猜選錯時就有一半會點到它）。錯的題目至少 5 題，而且某一類被選到的次數在統計上顯著比亂猜多（p 值小於 0.05，同時比好幾類時已修正；也至少 3 次、至少 1.5 倍），才會列在上方「特別容易搞混」：代表學生不是亂猜，而是一直把這類字當成答案；沒達到就寫「看不出來」。（字屬於哪一類是照現在的教材判斷，教材改過的話可能稍有出入。）`
        + `${pairs ? `<br>最常搞混：${esc(pairs)}` : ""}${wposNote(rs)}`,
      cols:[["錯誤類型", r => r.label], ["次數", r => r.v], ["比例", r => `${r.share}%`], ["亂猜會佔", r => r.chance == null ? "—" : `${r.chance}%`]],
      tiles:[["第一次就選錯", `${wrong.length} 題`, `共 ${rs.length} 題`], ["最常見", top ? top.label : "—", top ? `${top.share}%` : "沒有錯誤"],
        ["特別容易搞混", over.length ? over.map(r => r.label).join("、") : "—", over.length ? `${over[0].label}：實際 ${over[0].share}%，亂猜會佔 ${over[0].chance}%（${fmtP(over[0].p)}）` : sg.n < 5 ? "樣本數不夠" : "看不出來（沒有達到統計上的顯著）"]]};
  },
  hint(rs){
    const g = groupBy(rs, r => r.hintLevel || 0), levels = [...g.keys()].sort((a, b) => a - b);
    const name = lv => lv === 0 ? "0 不用提示" : lv <= 3 ? `${lv} 系統提示` : `${lv} ${TEACHER_BTNS.find(t => t[0] === lv)[1]}`;
    const rows = levels.map(lv => ({label:name(lv), level:lv, v:g.get(lv).length, n:g.get(lv).length, share:pct(g.get(lv).length, rs.length)}));
    const used = rs.filter(r => r.hintLevel > 0).length;
    return {title: whoTitle("提示層級"), chart: barChart(rows, {label: r => `${r.v} 題（${r.share}%）`}), rows,
      note: "每一題記的是用到的最高提示層級：1～3 是系統給的（語詞、圖片、部件等），4～7 是老師按的按鈕。前測和後測的條件完全一樣。",
      cols:[["提示層級", r => r.label], ["題數", r => r.v], ["比例", r => `${r.share}%`]],
      tiles:[["作答題數", `${rs.length}`, rangeText()], ["用到提示", `${pct(used, rs.length)}%`, `${used} 題`], ["平均提示層級", `${avg(rs.map(r => r.hintLevel || 0))}`, "0＝都不用提示"]]};
  }
};

/* =========================================================
   19. 全班總表（學生 × 生字，格子是第一次就答對的比例）
   ========================================================= */
/* 多位學生（原「全班總表」，2026-10-25 維護者改）：自己點選最多 8 位；組別存在老師自己的瀏覽器（T.groups，只存學生代號），不進作答紀錄 */
const CLASS_MAX = 8, CLASS_TOP = 5;
const pickedKids = () => (T.classKids || []).filter(kidBy);
function classPicker(withData){
  const sel = new Set(pickedKids()), groups = getGroups();
  const cur = groups.findIndex(g => g.kids.length === sel.size && g.kids.every(c => sel.has(c)));
  return `<div class="trow"><span class="tl">選學生（最多 ${CLASS_MAX} 位）</span>${withData.map(k =>
      `<button class="chip ${sel.has(k.code) ? "on" : ""}" data-ckid="${esc(k.code)}" aria-pressed="${sel.has(k.code)}">${esc(kidLabel(k))}</button>`).join("")}</div>
    <div class="trow" style="margin-top:8px"><span class="tl">組別</span>${groups.map((g, i) =>
      `<button class="chip ${i === cur ? "on" : ""}" data-cgrp="${i}" aria-pressed="${i === cur}">${esc(g.name)}</button>`).join("") || `<span class="note" style="margin:0">還沒有組別</span>`}
      <button class="ghost" id="cGrpSave" ${sel.size ? "" : "disabled"}>把目前選的存成組別</button>${cur >= 0 ? `<button class="ghost" id="cGrpDel">刪除「${esc(groups[cur].name)}」</button>` : ""}</div>
    <p class="note" id="cMsg" style="margin:6px 0 0"></p>`;
}
/* 每位學生一列的比較表：每格列出這位學生最前面幾個字（和「一位學生」畫面的常錯、最慢、容易搞混同一套算法） */
function classTable(title, kidList, rs, cellFn){
  const rows = kidList.map(k => { const html = cellFn(k, rs.filter(r => r.kid === k.code)); return `<tr><th>${esc(kidLabel(k))}</th><td>${html || `<span class="note" style="margin:0">—</span>`}</td></tr>`; }).join("");
  return `<section class="ssec"><h3 class="ttitle">${title}</h3><div class="tablewrap"><table class="rec"><thead><tr><th>學生</th><th>前 ${CLASS_TOP} 個</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
/* 多位學生的折線圖：每位學生一條線（只畫有資料的日期，沒資料的日子就沒有點），橫軸是日期（距離第一天幾天）。
   顏色用色盲也分得開的 8 色；點可以空心（前測）或實心（後測、一般） */
const SERIES_COLORS = ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#E69F00", "#56B4E9", "#6a4fa3", "#555555"];
function multiLine(series, o){
  const H = 300, L = 52, R = 20, Tp = 22, B = 38, iw = SVGW - L - R, ih = H - Tp - B;
  const all = series.flatMap(s => s.pts).filter(p => p.v != null);
  const ticks = o.metric === "acc" ? [0, 25, 50, 75, 100] : niceTicks(Math.max(...all.map(p => p.v)) * 1.05), max = ticks[4];
  const slots = o.slots, cells = slots ? slots.length : o.cells, xs = all.map(p => p.x), x0 = cells ? -0.5 : Math.min(...xs), x1 = cells ? cells - 0.5 : Math.max(...xs), span = x1 - x0 || 1;
  const X = x => x0 === x1 ? L + iw / 2 : L + (x - x0) / span * iw, Y = v => Tp + ih - v / max * ih;
  const unit = o.metric === "acc" ? "%" : o.metric === "sec" ? " 秒" : "";
  let g = "";
  /* 大家的評量日期對得上時（slots＝每次評量一格）：灰色背景＝前測、藍色＝後測，和「個人」畫面一樣 */
  if(slots){
    let from = 0;
    slots.forEach((sl, i) => { if(i === slots.length - 1 || slots[i + 1].phase !== sl.phase){
      const a = X(from - 0.5), b = X(i + 0.5);
      g += `<rect class="band ${phaseCls(sl.phase)}" x="${a.toFixed(1)}" y="${Tp}" width="${(b - a).toFixed(1)}" height="${ih}"><title>${esc(sl.phase)}</title></rect>`;
      if(from && sl.phase !== "練習") g += `<line class="phaseline" x1="${a}" x2="${a}" y1="${Tp}" y2="${Tp + ih}"/>`;
      from = i + 1; } });
  }
  g += ticks.map(t => `<line class="grid" x1="${L}" x2="${SVGW - R}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${L - 8}" y="${Y(t) + 4}" text-anchor="end">${t}${unit}</text>`).join("");
  (o.events || []).forEach(e => { const x = X(e.x); g += `<line class="event ${e.cls || ""}" x1="${x}" x2="${x}" y1="${Tp}" y2="${Tp + ih}"/><text class="eventname ${e.cls || ""}" x="${x + 4}" y="${Tp + ih - 6}">${esc(e.label)}</text>`; });
  g += dayBraces(o.dayGroups, X, Tp + ih, H);
  series.forEach(s => {
    /* p.prac＝練習：同顏色的空心菱形，和其他點依時間連成同一條線（各課前後測圖用，維護者 2026-11-03） */
    s.pts.filter(p => p.prac && p.v != null).forEach(p => { const cx = X(p.x), cy = Y(p.v);
      g += `<path class="pdot" style="stroke:${s.color}" d="M${cx} ${cy - 7}L${cx + 7} ${cy}L${cx} ${cy + 7}L${cx - 7} ${cy}Z" tabindex="0" data-tip="${esc(`${p.label}｜${fmt(o.metric, p.v)}（${p.n} ${unitN(o.metric)}）`)}"/>`; });
    const ok = s.pts.filter(p => p.v != null && !p.prac), joined = s.pts.filter(p => p.v != null).sort((a, b) => a.x - b.x);
    g += `<path class="line" style="stroke:${s.color}" d="${joined.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ")}"/>`;
    g += ok.map(p => `<circle class="dot" style="${p.hollow ? `fill:#fff;stroke:${s.color}` : `fill:${s.color}`}" cx="${X(p.x)}" cy="${Y(p.v)}" r="5" tabindex="0" data-tip="${esc(`${p.label}｜${fmt(o.metric, p.v)}（${p.n} ${unitN(o.metric)}）`)}"/>`).join("");
  });
  let lastX = -1e9;   /* 橫軸標籤：和前一個標籤至少隔 48 像素 */
  g += Object.keys(o.at).map(Number).sort((a, b) => a - b).map(x => { const px = X(x); if(px - lastX < 48) return ""; lastX = px; return `<text class="ax" x="${px}" y="${H - 14}" text-anchor="middle">${esc(o.at[x])}</text>`; }).join("");
  const legend = `<div class="legend" style="display:flex;flex-wrap:wrap;gap:6px 16px;margin:0 0 6px">${series.map(s => `<span><i style="display:inline-block;width:18px;height:4px;border-radius:2px;background:${s.color};vertical-align:middle"></i> ${esc(s.name)}</span>`).join("")}${o.legendExtra || ""}</div>`;
  return `${legend}<div class="chartbox"><svg viewBox="0 0 ${SVGW} ${H}" data-multi="1" role="img" aria-label="折線圖，每位學生一條線，數字請看下方明細表">${g}<line class="cross" y1="${Tp}" y2="${Tp + ih}" hidden/></svg><div class="ttip" hidden></div></div>`;
}
const classDetail = (cols, rows) => `<details class="why"><summary>看明細表</summary>${detailTable(cols, rows)}</details>`;
const classSec = (title, body) => `<section class="ssec"><h3 class="ttitle">${title}</h3>${body}</section>`;
/* 每天一個點（正確率、反應時間、流暢性）：每位學生各一條線 */
function classDaily(kidList, rs, metric, empty){
  const src = metric === "flu" ? rs.filter(r => r.mode === "flu" && r.timeLimit) : rs;
  if(!src.length) return `<p class="note" style="margin:0">${empty}</p>`;
  const first = [...new Set(src.map(dayOf))].sort()[0], fn = metric === "acc" ? accOf : metric === "sec" ? secOf : fluOf, at = {}, rows = [];
  const series = kidList.map((k, i) => ({name: kidLabel(k), color: SERIES_COLORS[i], pts: [...groupBy(src.filter(r => r.kid === k.code), dayOf)].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([d, list]) => {
    const x = daysBetween(first, d), v = fn(list); at[x] = shortDay(d); rows.push({name: kidLabel(k), day: d, v: fmt(metric, v.v), n: v.n});
    return {x, ...v, label: `${kidLabel(k)}｜${shortDay(d)}`}; })}));
  return `<div class="tchart">${multiLine(series, {metric, at})}</div>` + classDetail([["學生", r => r.name], ["日期", r => r.day], [metric === "acc" ? "正確率" : metric === "sec" ? "平均反應時間" : "每分鐘", r => r.v], [unitN(metric), r => r.n]], rows);
}
/* 各課前後測正確率（多位學生）：顏色分學生（維護者 2026-11-03：不改），空心圓＝前測、實心圓＝後測，練習是同色空心菱形，和前測、後測依時間連成同一條線（維護者 2026-11-03）；
   上面的課次按鈕選看哪一課（預設第一課）。沒有「全部課合計」（維護者 2026-11-03 刪掉：和上面的每天平均正確率重複）；一次評量考了好幾課時只算選到那一課的題目 */
const PP_RANK = {"前測": 0, "練習": 1, "後測": 2};
function classPrePost(kidList, rs){
  const tagged = rs.filter(r => r.kind === "formal" && r.prepost), prac = rs.filter(r => r.kind !== "formal");
  if(!tagged.length && !prac.length) return `<p class="note" style="margin:0">還沒有前測、後測或練習的紀錄。</p>`;
  const ks = [...new Set([...tagged, ...prac].map(r => key(r.book, r.lesson)))].sort(lessonOrder), many = new Set(ks.map(k => splitKey(k)[0])).size > 1;
  const sel = ks.includes(T.classLesson) ? T.classLesson : ks[0], lname = k => many ? lessonLabel(k) : lessonName(...splitKey(k));
  const src = [...tagged, ...prac].filter(r => key(r.book, r.lesson) === sel), first = [...new Set(src.map(dayOf))].sort()[0], at = {}, rows = [];
  /* 每一格＝「日期＋前測／練習／後測」（同一天的練習合成一格）；排序：日期由早到晚，同一天前測、練習、後測 */
  const pk = r => dayOf(r) + "|" + (r.kind === "formal" ? r.prepost : "練習");
  const order = (a, b) => { const [da, pa] = a.split("|"), [db, pb] = b.split("|"); return da < db ? -1 : da > db ? 1 : PP_RANK[pa] - PP_RANK[pb]; };
  const byKid = kidList.map(k => groupBy(src.filter(r => r.kid === k.code), pk));
  /* 自動判斷評量日期對不對得上（只看前測、後測）：每次「日期＋前測／後測」算一格，平均有六成以上的學生有那一格，就當作大家一起評量（只是有人缺），
     橫軸改成每次評量一格（練習的日期也各占一格）、畫前測／後測背景；有教學結束日、而且大家一樣時，再畫教學結束後的時間線 */
  const formalKeys = [...new Set(byKid.flatMap(m => [...m.keys()].filter(k => !k.endsWith("|練習"))))];
  const aligned = formalKeys.length > 0 && byKid.reduce((n, m) => n + [...m.keys()].filter(k => !k.endsWith("|練習")).length, 0) / (formalKeys.length * kidList.length) >= 0.6;
  const slotKeys = [...new Set(byKid.flatMap(m => [...m.keys()]))].sort(order);
  const slots = aligned ? slotKeys.map(k => ({day: k.split("|")[0], phase: k.split("|")[1]})) : null;
  const perDay = {}; if(aligned) slots.forEach(sl => perDay[sl.day] = (perDay[sl.day] || 0) + 1);
  const dayGroups = Object.keys(perDay).filter(d => perDay[d] > 1).map(d => { const xs = slots.map((sl, i) => sl.day === d ? i : -1).filter(i => i >= 0); return {from: Math.min(...xs), to: Math.max(...xs), label: shortDay(d)}; });
  let events = [];
  if(aligned){
    const ends = new Set(kidList.map(k => teachFor(sel, k.code)).filter(t => t.type === "dates" && t.end).map(t => t.end));
    if(ends.size === 1) events = afterEvents([...ends][0], slots.map(s => s.day));
  }
  /* 每位學生一條線（顏色跟著學生） */
  const series = kidList.map((k, i) => ({name: kidLabel(k), color: SERIES_COLORS[i % SERIES_COLORS.length],
    pts: [...byKid[i]].sort((a, b) => order(a[0], b[0])).map(([dk, list]) => {
      const [d, pp] = dk.split("|"), x = aligned ? slotKeys.indexOf(dk) : daysBetween(first, d), v = accOf(list);
      if(!aligned || perDay[d] === 1) at[x] = shortDay(d);
      rows.push({name: kidLabel(k), lesson: lname(sel), day: d, pp, v: fmt("acc", v.v), n: v.n});
      return {x, ...v, prac: pp === "練習", hollow: pp === "前測", label: `${kidLabel(k)}｜${shortDay(d)}｜${pp}`}; })}));
  if(series.every(s => !s.pts.length)) return `<p class="note" style="margin:0">這一課，選到的學生沒有前測、後測或練習。</p>`;
  const chips = chipRow(ks.map(k => [k, esc(lname(k))]), sel, "tcl");
  const extra = `<span><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style="vertical-align:-2px"><circle cx="7" cy="7" r="5" fill="#fff" stroke="#555" stroke-width="2"/></svg> 空心圓＝前測</span><span><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style="vertical-align:-2px"><circle cx="7" cy="7" r="5" fill="#555"/></svg> 實心圓＝後測</span><span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style="vertical-align:-3px"><path d="M8 1L15 8L8 15L1 8Z" fill="#fff" stroke="#555" stroke-width="2.5"/></svg> 練習（和前後測連成同一條線）</span>`;
  return `<div class="trow"><span class="tl">看哪一課</span>${chips}</div><div class="tchart">${multiLine(series, {metric: "acc", at, legendExtra: extra, slots, events, dayGroups})}</div>`
    + classDetail([["學生", r => r.name], ["課", r => r.lesson], ["日期", r => r.day], ["前後測", r => r.pp], ["正確率", r => r.v], ["題", r => r.n]], rows)
    + `<p class="note">每個點是那一天、那一種（前測、後測或練習）的評量，正確率＝第一次就答對的比例；顏色分學生，練習是同顏色的空心菱形，前測、練習、後測依時間連成一條線（同一天的練習合成一個點）。點上面的課次切換；一次評量考了好幾課時，只算這一課的題目。${aligned ? `大家的評量日期大致對得上，所以每次評量一格，灰色背景是前測、藍色是後測（練習那幾格不塗色），同一天好幾格用橫軸下面的括號框起來${events.length ? "，直立虛線是教學結束後的時間" : "（要畫教學結束後的時間線，需要大家這一課的教學結束日一樣）"}。` : "選到的學生評量日期對不上，所以橫軸依日期排，不畫背景和教學結束後的時間線。"}</p>`;
}
const classWrong = (k, rs) => [...groupBy(rs, r => r.char)].map(([c, l]) => ({c, n: l.length, w: l.filter(r => !r.firstCorrect).length})).filter(x => x.w)
  .sort((a, b) => b.w - a.w || a.n - b.n).slice(0, CLASS_TOP).map(x => `${charLink(x.c, k.code)}<small> 錯 ${x.w} 次・${pct(x.n - x.w, x.n)}%</small>`).join("　");
const classSlow = (k, rs) => [...groupBy(rs, r => r.char)].map(([c, l]) => ({c, v: avg(l.filter(r => r.passed && typeof r.correctSec === "number").map(r => r.correctSec))})).filter(x => x.v != null)
  .sort((a, b) => b.v - a.v).slice(0, CLASS_TOP).map(x => `${charLink(x.c, k.code)}<small> ${x.v} 秒</small>`).join("　");
const classConfused = (k, rs) => [...groupBy(rs.filter(r => !r.firstCorrect && r.firstPick && !isPartsGoal(r)), r => `${r.char}→${r.firstPick}`)].map(([key, l]) => ({key, n: l.length}))
  .sort((a, b) => b.n - a.n).slice(0, CLASS_TOP).map(x => { const [c, p] = x.key.split("→"); return `${charLink(c, k.code)}<small>→${esc(p)}（${x.n} 次）</small>`; }).join("　");
function renderClass(){
  const withData = kidsWithData(), sel = pickedKids(), picked = withData.filter(k => sel.includes(k.code));
  /* 和「個人」畫面統一：正式評量加練習、全部日期，中途結束的不算（維護者 2026-10-25），所以這一頁不用範圍選單 */
  /* 只看聽音選字（維護者 2026-11-11：和「個人」一樣；其他目標到「評量目標比較」，一次看一位學生）；舊紀錄的目標代號 3 也算聽音選字 */
  const rs = records.filter(r => okRec(r) && sel.includes(r.kid) && isGoal(r, MAIN_GOAL)), kidList = picked.filter(k => rs.some(r => r.kid === k.code));
  $("#tMenu").innerHTML = "";
  const side = $("#tSide");
  side.innerHTML = classPicker(withData);
  const bindPicker = () => {
    const res = $("#tResult"), re = () => { const y = window.scrollY; saveT(); renderTeacher(); window.scrollTo(0, y); };
    side.querySelectorAll("[data-ckid]").forEach(b => b.onclick = () => {
      const c = b.dataset.ckid, cur = pickedKids();
      if(cur.includes(c)) T.classKids = cur.filter(x => x !== c);
      else if(cur.length >= CLASS_MAX){ $("#cMsg").textContent = `最多選 ${CLASS_MAX} 位，請先取消一位，或分組來看。`; return; }
      else T.classKids = [...cur, c];
      re();
    });
    res.querySelectorAll("[data-tcl]").forEach(b => b.onclick = () => { T.classLesson = b.dataset.tcl; re(); });
    bindChart(res);
    side.querySelectorAll("[data-cgrp]").forEach(b => b.onclick = () => { T.classKids = getGroups()[+b.dataset.cgrp].kids.filter(kidBy).slice(0, CLASS_MAX); re(); });
    const save = $("#cGrpSave"), del = $("#cGrpDel");
    if(save) save.onclick = () => {
      const name = (prompt("這一組的名字（例如：一年級組）") || "").trim(); if(!name) return;
      const clash = getGroups().find(g => g.name !== name && g.kids.some(c => pickedKids().includes(c)));   /* 一位學生只能在一組 */
      if(clash) return alert(`有學生已經在「${clash.name}」了。一位學生只能在一組，請先到「學生名單」的分組調整。`);
      saveGroups([...getGroups().filter(g => g.name !== name), {name, kids: pickedKids()}]); re();
    };
    if(del) del.onclick = () => { const gs = getGroups(), g = gs.find(x => x.kids.length === sel.length && x.kids.every(c => sel.includes(c))); saveGroups(gs.filter(x => x !== g)); re(); };
  };
  if(!kidList.length){
    tCurrent = null;
    $("#tResult").innerHTML = `<section class="ssec"><p class="hint" style="margin:0">${picked.length ? `選到的學生還沒有「${esc(goalName(MAIN_GOAL))}」的作答紀錄。其他目標請到「評量目標比較」看。` : "請先點左邊的學生（最多 " + CLASS_MAX + " 位），這裡就會出現比較。"}</p></section>`;
    bindPicker(); return;
  }
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
  const noGoal = picked.filter(k => !kidList.includes(k));   /* 選到、但沒有聽音選字紀錄的學生不畫，另外說明 */
  const goalNote = `<section class="ssec"><p class="note" style="margin:0">這頁只看「<b>${esc(goalName(MAIN_GOAL))}</b>」（聽到題目，從選項中找出是哪個字）；其他目標請到「評量目標比較」，一次看一位學生。${noGoal.length ? `沒有聽音選字紀錄的學生：${esc(noGoal.map(kidLabel).join("、"))}。` : ""}</p></section>`;
  $("#tResult").innerHTML = goalNote + classSec("每天的平均正確率", classDaily(kidList, rs, "acc", "")) + classSec("每天的平均反應時間（越低越快）", classDaily(kidList, rs, "sec", ""))
    + classSec("每天的流暢性（每分鐘認出幾個字）", classDaily(kidList, rs, "flu", "選到的學生還沒有流暢性的紀錄（計時挑戰）。")) + classSec("各課前後測正確率", classPrePost(kidList, rs))
    + classTable("常錯的字", kidList, rs, classWrong) + classTable("反應最慢的字", kidList, rs, classSlow) + classTable("容易搞混的字（字→常選成）", kidList, rs, classConfused)
    + `<section class="ssec"><h3 class="ttitle">每個字的正確率（學生 × 生字）</h3>
    <div class="tstats"><div class="tstat"><span>學生</span><b>${kidList.length} 位</b><small>正式評量加練習</small></div>
      <div class="tstat"><span>考過的字</span><b>${chars.length} 個</b></div><div class="tstat"><span>這幾位第一次就答對</span><b>${fmt("acc", all.v)}</b><small>${all.n} 題</small></div></div>
    <p class="note">格子裡大字是第一次就答對的比例，小字是作答次數；藍色越深越好（白色＝不到 40%，最深＝80% 以上）。點格子看那位學生那個字的每一次作答。</p>
    ${table}
    <div class="row" style="margin-top:12px"><button class="ghost" id="tExport">匯出這幾位的總表（Excel）</button><span class="note" id="tMsg" style="margin:0"></span></div></section>`;
  bindPicker();
  $("#tResult").querySelectorAll("[data-char]").forEach(el => el.onclick = () => openCharLog(el.dataset.kid, el.dataset.char));
  $("#tExport").onclick = () => {
    /* 這頁只有聽音選字，每一列的「評量目標」欄寫目標名稱（維護者 2026-11-11） */
    const gn = goalName(MAIN_GOAL);
    const wide = kidList.map(k => Object.fromEntries([["學生", kidLabel(k)], ["評量目標", gn], ["全部", fmt("acc", accOf(rs.filter(r => r.kid === k.code)).v)],
      ...chars.map(c => { const l = cell.get(k.code + "|" + c); return [c, l ? `${accOf(l).v}%（${l.length}）` : ""]; })]));
    exportSheet(wide, "全班總表", `識字評量_全班總表_${fileDate(Date.now())}.xlsx`, "#tMsg",
      [{name:"逐格資料", rows: rows.map(r => ({"學生": r.name, "評量目標": gn, "字": r.char, "第一次就答對（%）": r.v, "作答次數": r.n}))}]);
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
  const cols = [["日期", r => r.day], ["性質", r => (r.kind === "formal" ? "正式" : "練習") + (r.quit ? "・中途結束（不列入）" : "")], ["前後測", r => r.prepost || "未標記"],
    ["目標", r => goalName(r.goal)], ["方式", r => r.mode === "flu" ? "流暢性" : "正確率"], ["結果", res], ["第一次選", r => r.firstPick],
    ["給學生選的", r => r.options ? [...r.options].join(" ") : ""], ["正確部件", r => r.answerSet || ""],   /* 部件題（聽音補部件、聽音選部件）才有「正確部件」；其他目標的「給學生選的」就是選項的字 */
    ["錯誤類型", r => r.errorType || ""], ["第一次秒數", r => r.firstSec ?? ""], ["答對秒數", r => r.correctSec ?? ""], ["提示層級", r => r.hintLevel || 0],
    ["教學後天數", r => r.daysAfter === "" || r.daysAfter == null ? "" : r.daysAfter], ["距上次（天）", r => r.quit ? "" : r.gap ?? "第一次"]];
  $("#cTitle").textContent = `「${c}」的學習紀錄`;
  $("#cBody").innerHTML = `<p class="hint" style="margin:0">${esc(k ? kidLabel(k) : kid)}・${esc(list[0] ? list[0].word || "" : "")}・共 ${list.length} 次（有效 ${valid.length} 次，第一次就答對 ${fmt("acc", a.v)}）。這裡列出全部日期、正式和練習都包含。</p>
    ${detailTable(cols, rows)}`;
  $("#cExport").onclick = () => exportRows(cols, rows, `「${c}」學習紀錄`, "#cMsg");
  $("#cMsg").textContent = "";
  openSheet("#charSheet");
}

/* 「老師專區」按鈕在 app.js（按了才下載這個檔和 pivot.js，2026-11-06） */
$("#teacherBack").onclick = () => showScreen("#setup");
