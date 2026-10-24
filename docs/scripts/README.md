# 自動產生資料、檢查的程式（docs/scripts/）

2026-10-24 從 `docs/architecture.md` 第 9 節原文搬來（那份快到字數上限），新增 `bump.js`、`changelog.js` 兩列。都在 repo 最上層執行，例如 `node docs/scripts/check.js`、`python3 docs/scripts/make_kai.py`。

| 程式 | 產生什麼 | 什麼時候跑 |
|---|---|---|
| `check.js` | 不產生檔案；檢查語法、教材、版本號、學生資料、文件長度、這份地圖與存資料的入口、文件裡的指向（檔案和「某一節」找不找得到）、大檔案清單、楷書字型缺字、網頁下載量、對外連線（2026-10-24 加，都只提醒） | 每次推之前；GitHub 每個 PR 自動跑 |
| `make_parts.py` | `shared/parts.js`、`docs/parts-table.xlsx` | 新增課本後 |
| `make_bpmf.py` | `shared/bpmf.js`、`shared/fonts/bpmf-kai*` | 新增課本、改讀音後 |
| `make_kai.py` | `shared/fonts/tw-kai*` | 新增課本、部件，或改了頁面文字後 |
| `make_conf_candidates.py` | `docs/material-review.xlsx` 的「干擾字候選」頁 | 要請老師挑干擾字時 |
| `bump.js` | 改所有網頁的版本號 `?v=`（今天的日期，同一天第二次起加 b、c…）（2026-10-24 加） | 改了網頁會載入的 js、css 後 |
| `changelog.js` | 不產生檔案；把舊的變更紀錄表和 `docs/changes/` 的小檔案合成一張表印出來，從 git 找 PR 編號；可以加關鍵字只印相關的列（2026-10-24 加） | 要追某件事的變化時 |
