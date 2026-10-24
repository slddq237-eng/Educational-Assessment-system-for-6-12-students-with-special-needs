# 給 Claude 的專案約定

這份每則訊息都會載入，只寫一定要做的事（2026-10-23 精簡，維護者決定：詳細規則只寫在 `docs/`，不重複）。
開工先讀 `docs/README.md`（文件索引、合作規則、改完要更新哪些檔案），再依工作只讀相關的檔案。

- 兩位維護者都是程式新手：回覆用繁體中文，術語第一次出現附白話解釋；依問題大小回答，簡單的事簡短回答。
- 嚴禁把學生真實姓名、照片、成績寫進任何檔案（repo 是公開的）。發現著作權、授權、個資、商標等法律疑慮，第一時間告訴維護者。
- 開工前看還沒合併的 PR 有沒有動到同一批檔案；開工先發草稿 PR；一件事一個新分支（從最新的 main 開，合併後不再用）；不直接推 main；推之前跑 `node docs/scripts/check.js`，錯誤要修好。
- 共用檔案（`shared/`、`docs/`、首頁 `index.html`、`privacy.html`、`README.md`、`CLAUDE.md`、`.github/`）和識字評量 `tools/literacy/`：提醒維護者先告知夥伴、PR 說明標出；要 repo 擁有者（slddq237-eng）同意才合併，Claude 不自己合併。
- 會改作答紀錄格式或正式評量條件的，先討論再動手。新想法先評估可行性和急迫性、判斷屬於哪個階段（`docs/roadmap.md`「新想法怎麼排」）。
- 發 PR 前對照 `docs/README.md`「改完要更新哪些檔案」；PR 說明標通知等級（①②③，見 `docs/README.md`）和「文件更新：…」。
- **`docs/` 是唯一正確的版本**（2026-10-23 維護者決定）：決定、規則、設計都記在 `docs/`，不同步回規格書。規格書（claude.ai 文件）只用來討論要全體決定的事（例如 A3、A8）；定案後把結果記進 `docs/`，並請擁有者在規格書那一節標「已定案，見 GitHub `docs/○○.md`」。
- **精簡文件不直接刪**（2026-10-24 維護者決定）：拿掉的內容原文搬到 history 檔案，原處留「見 ○○」（見 `docs/README.md`「寫文件的規則」）。
- **省 token**（2026-10-23 維護者決定）：不要整份讀大檔案（`shared/lessons.js`、`parts.js`、`bpmf.js`、`freq.js`、`themes.js`、`tools/literacy/` 的 `index.html`、`setup.js`、`play.js`、`teacher.js`、`scenes.js`、`analysis-guide.html` 等超過約 30KB 的檔案；清單由 `check.js` 自動檢查），先用搜尋找到位置、只讀需要的那一段；改程式前先看 `docs/architecture.md` 找相關檔案，不要整個資料夾讀過；資料用程式統計，不要讀進對話裡數。
