# 程式地圖 architecture.md 拆出識字評量一份
- 日期：2026-10-31
- 動到哪裡：文件（`docs/code/architecture.md`、新增 `docs/code/architecture-literacy.md`、`docs/INDEX.md`、`README.md`）、`docs/scripts/check.js`
- 改了什麼：`architecture.md` 超過 1 萬字（學生名單管理五個 PR 加的說明讓它從 9,990 字變成 10,670 字），把第 4 節「識字評量 `tools/literacy/`」（每個 `.js` 檔做什麼、誰用誰、一次評量的流程，2,666 字）原文搬到新檔案 `architecture-literacy.md`，原處留標題和指引，節號不變；`architecture.md` 剩 8,135 字。`check.js` 檢查「每個 .js 檔要寫進程式地圖」時改成同時讀這兩份（已測：沒寫會提醒、寫在新檔案裡就不提醒）。程式沒有改，內容只搬移沒有修改
- 想法或決定的變化：沿用 2026-10-24 拆出 `architecture-notes.md` 的做法（快到字數上限就依主題拆、原處留「見 ○○」）
