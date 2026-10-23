/* =========================================================
   識字評量：程式入口（app.js）
   程式分成十二個檔案，index.html 依下面的順序載入：
     data.js     1. 基本設定與小工具  2. 存在這台電腦的資料  3. 評量時機判斷
     setup.js    4. 設定畫面  5. 彈出面板（學生名單、教學日期、評量設定）
     records.js  6. 作答紀錄的存取  7. Excel 匯出、作答紀錄面板與備份
     wordsets.js 只考有教的字（字組：每課要考哪些字、鎖定、分享）
     play.js     8. 出題與題目內容  9. 作答畫面  10. 結果畫面
     collect.js  11. 選主題  12. 頭像  13. 得到貼紙  14. 貼紙簿
     scenes.js   打怪獸的四個場景（移植自生字賓果；什麼時候出現由 play.js 的 3-3 決定）
     teacher.js  15～20. 老師專區（選單、趨勢圖、排序與分布、全班總表、逐字學習紀錄）
     pivot.js    21～23. 進階分析（樞紐分析表）
     app.js      全部載入後開始畫畫面（這個檔案）
     tablet.js   平板作答（QR code、送到 Google 表單、匯入 Google 試算表）
     tour.js     新手導覽（第一次打開時自動出現，右上角「選單」可重看）
   平台共用的檔案：shared/lessons.js（生字資料）、shared/common.js（課本排序與名稱、語詞、部件查詢、Excel 元件）、
   shared/themes.js（主題與貼紙）、shared/rewards.js（收藏與頭像）。
   ========================================================= */

/* 全部準備好後，畫出設定畫面（依上次用的模式） */
/* 平板作答（data.js 的 TABLET）：不顯示設定畫面，直接請學生點自己的代號（見 tablet.js） */
if(TABLET) tabletStart(); else setUi(ui);
/* 收藏與頭像讀完後再畫一次，學生按鈕上才有頭像 */
Rewards.ready.then(TABLET ? tabletKids : render);

/* 網頁開著過夜：評量時機是用打開網頁那天判斷的，日期換了就提醒重新整理（不自動重新整理，免得打斷正在進行的評量） */
const checkDay = () => { $("#dayWarn").hidden = iso(new Date()) === iso(today); };
document.addEventListener("visibilitychange", () => { if(!document.hidden) checkDay(); });
setInterval(checkDay, 60 * 1000);
$("#dayReload").onclick = () => location.reload();
