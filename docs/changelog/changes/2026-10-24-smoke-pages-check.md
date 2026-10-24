# 網頁漏加進測試清單時自動擋下；刪除生字賓果轉址頁

- 日期：2026-10-24
- 動到哪裡：自動檢查、GitHub 設定、首頁 README、文件（共用檔案）；刪除 `tools/bingo/`
- 改了什麼：`check.js` 加第 13 項：每個網頁（.html）都要寫在 `smoke.js` 的 `PAGES`，漏了是錯誤；`PAGES` 裡寫了但找不到的檔案也是錯誤。刪除 `tools/bingo/index.html`（舊網址轉址頁），`CODEOWNERS`、`README.md` 資料夾地圖、`INDEX.md`、`architecture.md`、`rules.md` 跟著拿掉
- 想法或決定的變化：原本靠文件提醒「加了新網頁要加進 PAGES」，維護者要求改成自動擋下，就不用每次記得。轉址頁維護者決定刪除：原作者當初是直接傳 HTML 檔分享，沒有用這個網址，沒有舊書籤要轉
