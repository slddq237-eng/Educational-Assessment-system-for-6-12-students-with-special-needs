/* =========================================================
   共用小工具：識字評量、備課分析都讀這一份
   要在 shared/lessons.js、shared/parts.js 之後載入。
   課本排序、課本名稱、語詞、部件查詢等規則只寫在這裡，改一處所有工具一起生效。
   ========================================================= */

/* 防止文字被當成網頁程式碼（學生名字、語詞放進畫面前都要先經過這個） */
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* 課本的排列順序：依版本、年級、學期自動排序，新增課本時不用改程式 */
const EDITION_ORDER = ["翰林", "南一", "康軒"];
const edRank = e => { const i = EDITION_ORDER.indexOf(e); return i < 0 ? 99 : i; };
const termRank = b => b.grade * 2 + (b.term === "下" ? 1 : 0);
const BOOK_ORDER = Object.keys(BOOKS).sort((a, b) => edRank(BOOKS[a].edition) - edRank(BOOKS[b].edition) || termRank(BOOKS[a]) - termRank(BOOKS[b]));

/* 課本與課次的名稱：第 0 課是課前單元（例如康軒一上的「真簡單」），直接顯示單元名稱 */
const bookName = b => `${BOOKS[b].edition} ${BOOKS[b].grade}${BOOKS[b].term}`;
const lessonName = (b, n) => n === "0" ? (BOOKS[b].lessons[n].title || "課前單元") : `第 ${n} 課`;
const lessonKeys = b => Object.keys(BOOKS[b].lessons).sort((x, y) => x - y);

/* 語詞、例句、干擾字：各版本自己的資料（*_ED）優先，沒有再用共用的 */
const fromEd = (ed, b, c) => ((typeof ed !== "undefined" && ed[b]) || {})[c];
const wordOf = (c, b) => fromEd(typeof WORDS_ED !== "undefined" ? WORDS_ED : undefined, b, c) || WORDS[c] || "";
const sentOf = (c, b) => fromEd(typeof SENT_ED !== "undefined" ? SENT_ED : undefined, b, c) || SENT[c] || "";
const confOf = (c, b) => fromEd(typeof CONF_ED !== "undefined" ? CONF_ED : undefined, b, c) || CONF[c];

/* 部件：先用 lessons.js 的 PARTS（人工整理），沒有再用 parts.js 的 PARTS_AUTO（自動拆解）；回傳第一層部件的清單。
   各工具再依用途加規則：識字評量只把拆成 2 塊以上的當成「拆得開」，備課分析把同一部件的不同寫法合併計算。 */
/* 這個字的拆法從哪裡來：manual＝人工（lessons.js 的 PARTS）、auto＝電腦自動拆（parts.js，不一定適合教學，要人工檢查）、""＝沒有拆法 */
const partsSource = c => (typeof PARTS !== "undefined" && PARTS[c]) ? "manual" : (typeof PARTS_AUTO !== "undefined" && PARTS_AUTO[c]) ? "auto" : "";
const rawParts = c => ((typeof PARTS !== "undefined" && PARTS[c]) || (typeof PARTS_AUTO !== "undefined" && PARTS_AUTO[c]) || "").split(/\s+/).filter(Boolean);

/* 顯示一行提示：畫面已經換掉、找不到那個位置時就不顯示（匯出要等元件載入，這段時間老師可能已經切到別的畫面） */
const setMsg = (sel, text) => { const el = document.querySelector(sel); if(el) el.textContent = text; };

/* Excel 匯出元件（SheetJS，放在 shared/vendor/，不用連外網）：按「匯出」時才下載，平常打開網頁不用多載 880 KB */
const SHARED_BASE = document.currentScript ? document.currentScript.src.replace(/[^/]*$/, "") : "../../shared/";
let xlsxLoading = null;
function loadXlsx(){
  if(window.XLSX) return Promise.resolve();
  return xlsxLoading = xlsxLoading || new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = SHARED_BASE + "vendor/xlsx-0.18.5.full.min.js";
    s.onload = () => res();
    s.onerror = () => { xlsxLoading = null; s.remove(); rej(new Error("Excel 元件載入失敗")); };
    document.head.appendChild(s);
  });
}
