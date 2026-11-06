/* =========================================================
   識字評量：程式入口（app.js）
   程式分成十三個檔案，index.html 依下面的順序載入（teacher.js、pivot.js 例外：按「老師專區」才由下面的 loadTeacher 下載，2026-11-06）：
     data.js     1. 基本設定與小工具  2. 存在這台電腦的資料  3. 教學日期與前後測
     setup.js    4. 設定畫面  5. 彈出面板（學生名單、教學日期、評量設定）
     records.js  6. 作答紀錄的存取  7. Excel 匯出、作答紀錄面板與備份
     wordsets.js 只考有教的字（字組：每課要考哪些字、鎖定、分享）
     play.js     8. 出題與題目內容  9. 作答畫面  10. 結果畫面
     collect.js  11. 選主題  12. 頭像  13. 得到貼紙  14. 貼紙簿
     gacha.js    扭蛋機（拉拉桿揭曉這次的貼紙，依星等不同的特效和聲音）
     scenes.js   打怪獸的四個場景（移植自生字賓果；什麼時候出現由 play.js 的 3-3 決定）
     teacher.js  15～20. 老師專區（選單、趨勢圖、排序與分布、全班總表、逐字學習紀錄）
     pivot.js    21～23. 進階分析（樞紐分析表）
     tablet.js   平板作答（QR code、送到 Google 表單、匯入 Google 試算表）
     app.js      全部載入後開始畫畫面、老師專區按了才下載（這個檔案）
   平台共用的檔案：shared/lessons.js（生字資料）、shared/common.js（課本排序與名稱、語詞、部件查詢、Excel 元件）、
   shared/themes.js（主題與貼紙）、shared/rewards.js（收藏與頭像）。
   ========================================================= */

/* 全部準備好後，畫出設定畫面（依上次用的模式） */
/* 平板作答（data.js 的 TABLET）：不顯示設定畫面，直接請學生點自己的代號（見 tablet.js） */
if(TABLET) tabletStart(); else setUi(ui);

/* 老師專區、進階分析（teacher.js、pivot.js，約 120 KB）按「老師專區」才下載（2026-11-06）：
   打開網頁時少下載這些，設定畫面出現得比較快。網址帶著本檔的版本號（?v=…），改版時瀏覽器會重新下載。
   兩個檔要照順序載入（pivot.js 用到 teacher.js 的名稱）；載入失敗（例如沒網路）可以再按一次重試。 */
const TEACHER_BASE = document.currentScript ? document.currentScript.src.replace(/[^/]*$/, "") : "";
const TEACHER_VER = document.currentScript ? (document.currentScript.src.match(/\?v=[^&#]*/) || [""])[0] : "";
let teacherLoading = null;
const loadScript = name => new Promise((res, rej) => {
  const s = document.createElement("script");
  s.src = TEACHER_BASE + name + TEACHER_VER;
  s.onload = () => res(); s.onerror = () => { s.remove(); rej(new Error(name + " 載入失敗")); };
  document.head.appendChild(s);
});
function loadTeacher(){
  if(typeof renderTeacher === "function" && typeof renderPivot === "function") return Promise.resolve();
  return teacherLoading = teacherLoading || (typeof renderTeacher === "function" ? Promise.resolve() : loadScript("teacher.js"))
    .then(() => typeof renderPivot === "function" ? null : loadScript("pivot.js"))
    .catch(e => { teacherLoading = null; throw e; });
}
$("#openTeacher").onclick = () => {
  document.body.style.cursor = "progress";
  loadTeacher().then(() => { renderTeacher(); showScreen("#teacher"); },
    () => alert("老師專區載入失敗，請檢查網路，再按一次「老師專區」。"))
    .finally(() => { document.body.style.cursor = ""; });
};
/* 收藏與頭像讀完後再畫一次，學生按鈕上才有頭像 */
Rewards.ready.then(TABLET ? tabletKids : render);

/* 網頁開著過夜：「教學後第幾天」是用打開網頁那天算的，日期換了就提醒重新整理（不自動重新整理，免得打斷正在進行的評量） */
const checkDay = () => { $("#dayWarn").hidden = iso(new Date()) === iso(today); };
document.addEventListener("visibilitychange", () => { if(!document.hidden) checkDay(); });
setInterval(checkDay, 60 * 1000);
$("#dayReload").onclick = () => location.reload();
