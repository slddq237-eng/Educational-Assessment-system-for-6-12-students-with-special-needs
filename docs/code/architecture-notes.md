# 程式架構的注意事項（architecture-notes.md）

共用名稱、平板作答模式（平板不載入哪些檔案、只載入哪些課本）、作答紀錄的存取界線、日期、整理程式。改程式前和 `architecture.md` 一起讀。
（2026-10-24 從 `docs/code/architecture.md` 第 10 節拆出（快到 1 萬字上限），內容只搬移、沒有修改）

## 10. 現在架構的特點與注意事項

- **共用名稱**：識字評量的檔案靠「上面定義、下面直接用」溝通，沒有明確的介面。改名稱前先在整個 repo 搜尋這個名稱（例如在 GitHub 或請 Claude 搜尋），確定所有用到的地方都一起改。`themes.js`、`rewards.js` 只對外提供 `window.Themes`、`window.Rewards`，比較不會撞名，新的共用程式建議照這個寫法。
- **平板作答模式**（網址有 `#t=`，`data.js` 的 `TABLET`）：`load` 改從網址讀、`store` 不寫，`records.js` 不開資料庫，其他程式照常跑。新增要存的資料時記得它在平板上不會存下來。**平板不載入 `teacher.js`、`pivot.js`、`tour.js`**（2026-10-24 R4a）：平板會跑到的程式**不能用這三個檔案的東西**，共用小工具放 `data.js`（例如 `chipRow`）。**平板只載入這次用到的課本**（2026-10-24 R4b，`tools/literacy/index.html` 的 `LESSON_ONLY`、`shared/lessons.js` 的 `BOOK_FILES`）：平板上的 `BOOKS` 只有最早四本加上用到的那幾本，要用「所有課本的字」請用 `ALL_LESSON_CHARS`，不要自己從 `BOOKS` 算。
- **作答紀錄只有 `records.js` 直接存取 IndexedDB**：這是之後要換成線上資料庫（階段 F）時最需要守住的界線；其他檔案只讀 `records` 陣列、透過 `saveRecord`／`updateRecord` 寫入。
- **日期以打開網頁那天為準**（`data.js` 的 `today`）：網頁開過夜會提醒重新整理（`app.js`）。
- **整理（重構）程式**：規則與進度清單在 `docs/code/refactor.md`。
