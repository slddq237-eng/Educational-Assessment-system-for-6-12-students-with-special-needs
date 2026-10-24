# 合作規則（發 PR 前讀）

2026-10-24 從 docs 的 README（同日改名 `docs/INDEX.md`）原文搬來（索引縮成純索引，省每次開工讀的字數）。**開工不用讀這份**：發 PR 前讀「改完要更新哪些檔案」，要查合作規則、通知等級、規格書怎麼用時再讀。

## 改完要更新哪些檔案（2026-10-23 維護者決定）

每次做完、發 PR 前，Claude 對照下表逐項更新，PR 說明加一行「**文件更新**：改了哪些檔案」。同一件事只記一個地方，其他地方寫「見 ○○」。
**少改就好**（2026-10-24 維護者決定）：一個改動只更新最相關的**一份**主題檔案；`roadmap.md` 只在那一項做完時打 ✅，`pending.md` 只在做了決定時才動，中間進度都不用改這兩份。規格書不用同步（見下方「規格書的角色」）。

| 改了什麼 | 要更新 |
|---|---|
| 任何改動 | PR 說明：通知等級、有沒有動到共用檔案、「文件更新」一行；**變更紀錄**：在 `docs/changelog/changes/` 加一個小檔案（2026-10-24 起，見 `changelog.md`「怎麼寫」）；改了網頁會載入的 js、css：執行 `node docs/scripts/bump.js` 換版本號 |
| 新想法、老師回饋 | `roadmap.md` 適合的階段；要討論的加進 `pending.md` |
| 做了決定（定案、取消、改方向） | 對應的主題檔案改寫現況，舊說法移到最新的決策歷史檔（`history-2026-10-24.md`）；`pending.md` 拿掉或標定案；`roadmap.md` 打 ✅；在規格書討論過的，請擁有者在那一節標「已定案，見 docs/○○.md」 |
| 新功能、改變行為 | 對應的主題檔案（識字評量 `literacy-design.md`（玩法、增強、血量 `literacy-play.md`）、分析 `analysis-design.md`、紀錄 `records.md`、教材 `materials.md`）、`roadmap.md` 那一列的狀態改成 ✅（只寫日期和「詳細在哪」，做了什麼寫在主題檔案，不寫進路線圖，2026-10-23 重整後的規則）；老師看得到的：首頁 `index.html`「最後更新」 |
| 新增、刪除、改名程式檔，或改到檔案之間的關係、新的儲存名稱 | `architecture.md`（自動檢查會提醒）；新增、刪除、改名資料夾或主要檔案時，也改根目錄 `README.md` 的「資料夾地圖」（2026-10-24 維護者決定） |
| 整理程式 | `refactor.md` 進度清單 |
| 作答紀錄格式、正式評量條件 | **先討論**；`records.md`、`data.js` 的 `RECORD_FORMAT` |
| 教材、讀音、部件 | `materials.md`（干擾字 `distractors.md`、讀音 `pronunciation.md`）；跑 `make_parts.py`、`make_bpmf.py`、`make_kai.py` |
| 新的外部資料（課本、字頻、圖片、聲音、字型、程式元件） | `data-sources.md`、`about.html` |
| 存學生資料的新功能、新的對外連線 | `privacy.html`、`architecture.md` 第 6、7 節 |
| 合作規則 | 本頁第 2 節（詳細）；一定要做的事才放進 `CLAUDE.md`（只寫一句、指回本頁，不重複細節）；影響 GitHub 操作的：「GitHub 新手使用說明」 |
| 修 bug、改錯字、小調整（③級） | 只要 PR 說明和變更紀錄的小檔案，其他文件都不用動 |

### 規格書的角色（2026-10-23 維護者決定）
- **`docs/` 是唯一正確的版本**：決定、規則、設計都記在 `docs/`，不再同步回規格書（同一件事記兩份太花 token，也容易新舊不一致）。
- **規格書只用來討論**：要全體一起決定的事（例如 A3、A8），在規格書寫討論資料、在句子旁留言。定案後把結果記進 `docs/` 對應的檔案，規格書那一節標「已定案，見 GitHub `docs/○○.md`」。規格書裡還沒搬過來的舊內容（例如 E9 討論資料）照常引用，哪一項定案再搬。
- 規格書開頭寫明「最新的決定以 GitHub 的 `docs/` 為準」，附 `docs/INDEX.md` 連結。
- **規格書在哪裡**：「識字評量工具 規格書」https://claude.ai/artifact/XJtNNtqj2J1YpTVVvwRBXU（claude.ai 文件，需擁有者分享）。`docs/` 寫「細節在規格書」時，Claude 用文件工具（Claude Docs 的 read，搜尋該節名稱）只讀那幾段；打不開就請維護者把那段貼過來。

## 1. 專案在做什麼

給 6～12 歲特殊需求學生使用的線上教學與評量平台，由兩位程式新手（特教老師）用 Claude 共同開發。
平台上有多個小工具，部署在 GitHub Pages：
https://slddq237-eng.github.io/Educational-Assessment-system-for-6-12-students-with-special-needs/

工具、資料夾、負責人的表格留在 `INDEX.md`「專案在做什麼、工具與負責人」（開工時要用）。

決定、規則、設計以 `docs/` 為準；識字評量規格書只用來討論（見「規格書的角色」）。

## 2. 合作規則（詳細版；CLAUDE.md 只放一定要做的事）

- 分資料夾負責；`shared/`、首頁 `index.html`、`privacy.html`、`README.md`、`CLAUDE.md`、`docs/` 是共用檔案，改前提醒維護者告知夥伴，PR 說明要標出。
- 開工前到 GitHub 的 Pull requests 檢查是否有未合併的 PR 動到同一批檔案（Files changed）；有的話先說好誰先改。
- 開工就先發草稿 PR（2026-10-20 維護者決定），讓 PR 清單成為「誰正在改哪裡」的即時看板；做完再改成可合併。人多了之後（3～5 人）再加 GitHub Projects 看板與 CODEOWNERS，更多人時加 GitHub Actions 自動提醒同檔案衝突（規格書「合作規則」、待決問題 H 類）。
- 新功能開分支、發 PR；不直接推 main。**一件事一個新分支**（2026-10-23 維護者決定）：從最新的 main 開，名字看得出在做什麼（例如 `claude/a8-leanings`）；PR 合併後這個分支就不再用，下一件事再開新的（同一個 Claude 對話換做別的事時也一樣）。合併後的分支由 GitHub 自動刪除（2026-10-23 已打開 Settings → General「Automatically delete head branches」）；要回溯用 PR 頁的「Revert」或「Restore branch」。**合併分級**（2026-10-22 維護者決定）：動到共用檔案（`shared/`、`docs/`、首頁、`privacy.html`、`CLAUDE.md`、`README.md`、`.github/`）、識字評量 `tools/literacy/`、作答紀錄格式或正式評量條件的，要 repo 擁有者（slddq237-eng）同意才合併，Claude 不自己合併；只改自己新工具資料夾 `tools/<工具名稱>/` 的，自動檢查通過後作者可以自己合併，合併後告知擁有者（首頁加入口那段仍要同意）。
- **合併前先用 Vercel 預覽測試**（2026-10-24 維護者決定）：repo 已連上 Vercel（自動把每個 PR 做成一個可以點開試用的網站）。每次發 PR、推新的修改，`vercel` 機器人會在 PR 下面留言：Deployment 欄 **Ready** 是做好了、**Error** 是網頁建置失敗（要先修）；點 **Preview** 打開這個 PR 版本的網站，實際操作改到的頁面，確認沒問題再合併。Claude 發 PR 時在說明寫「預覽時要測哪些地方」。預覽網址的作答紀錄和正式網站分開（瀏覽器依網址各存各的），測試只用假名字（例如「測試一號」）。正式網站仍是 GitHub Pages（見第 1 節）；合併到 main 時 Vercel 也會更新一個 Vercel 正式網址，但不給老師用。夥伴打不開預覽網址時，由擁有者到 Vercel 專案 Settings → Deployment Protection 調整。
- **文件同步分級**（2026-10-22 維護者決定）：新想法、老師回饋、做了決定都要記進 `docs/` 對應的檔案（規格書不同步，見「規格書的角色」）；新功能或改變行為的改動在同一個 PR 更新 `docs/`；修 bug、改錯字、小調整不用記。
- **版本號（`?v=`）衝突怎麼處理**（2026-10-24 加，兩人同時改程式前先講好）：改了 js、css 都要跑 `node docs/scripts/bump.js` 換版本號，它會改所有網頁的 `?v=`，所以兩個 PR 同時改程式，後合併的那個一定會在 `?v=` 衝突。這種衝突不用比對：GitHub 或 Claude 處理衝突時 `?v=` 隨便留一邊，再跑一次 `bump.js`、推上去就好（自動檢查會擋各頁版本號不一致）。請 Claude 處理時說「把 main 合併進來，`?v=` 衝突照 rules.md 處理」。「版本號只寫在一個檔案」維護者決定不做（見 `refactor.md`）。
- 純前端、無建置工具。repo 公開：嚴禁把學生姓名、照片、成績寫進任何檔案。
- **自動檢查**（2026-10-22 加）：每次發 PR、改 main，GitHub Actions 會跑 `docs/scripts/check.js`（設定檔 `.github/workflows/check.yml`），檢查程式語法、教材資料（語詞裡有沒有這個字、干擾字有沒有包含答案等）、各頁版本號是否一致、有沒有照片或備份檔等學生資料。PR 頁面出現紅叉就先修好再合併；本機可以跑 `node docs/scripts/check.js`。已知、等決定的教材問題放在檔案裡的 `KNOWN`（只提醒不失敗）。2026-10-24 起同一個檢查也會跑「網頁打得開測試」`docs/scripts/smoke.js`：用瀏覽器打開每一頁和平板作答網址，有程式錯誤就紅叉（例如改了某個共用名稱，別的檔案還在用舊名字）；加了新網頁要加進它的 `PAGES`。建議 repo 擁有者在 Settings → Rules 設定「main 要檢查通過才能合併」。
- 維護者是新手：回覆用繁體中文，術語附白話解釋；程式碼每個段落開頭加中文說明（不逐行註解）。
- **檔案放哪裡**：每個小工具放 `tools/<工具名稱>/`，入口是該資料夾的 `index.html`，首頁 `index.html` 列出工具。教材資料只放 `shared/lessons.js`、工具間共用的小工具只寫在 `shared/common.js`，不要在工具資料夾另外複製一份。各檔案的關係見 `architecture.md`。
- **教材與字型**：新增課本後執行 `docs/scripts/make_parts.py`、`make_bpmf.py`、`make_kai.py`（改了頁面文字也要跑 `make_kai.py`）；讀音、注音以課本為主（見 `pronunciation.md`）；楷書一律用 `TWKai`（全字庫正楷體），不要用霞鶩文楷或 Kaiti TC 等大陸字形的楷體。維護者上傳教材檔案時，先說哪些讀得到、哪些讀不到和解決方法（見 `data-sources.md`「上傳教材檔案、課本改版時」），原檔不放進 repo。
- **省 token**（2026-10-23 維護者決定）：`CLAUDE.md` 每則訊息都會載入，只寫一定要做的事、指回這裡；詳細規則只寫在 `docs/` 一個地方（根目錄 `README.md` 只放摘要和連結；規格書只用來討論）。大檔案不整份讀，先搜尋再讀需要的段落。給人看的使用建議：claude.ai 文件「省 token 的 Claude 使用指南」（https://claude.ai/artifact/2DSYrCEwmkGVrqNpHRTTEG，需擁有者分享）。

### 三級通知與每週摘要（2026-10-22 維護者決定）
兩位維護者都忙，不可能每個改動都等對方同意；但自己做（就算和 Claude 討論過）也可能做錯。所以依「做錯的代價」分三級：

| 等級 | 哪些改動 | 夥伴要做什麼 | 例子 |
|---|---|---|---|
| ① 先討論再做 | 會寫進作答紀錄、改正式評量條件、法律與授權 | 事前一起決定（整理成選項，夥伴只要選） | A8 名詞與時期、A3、例句版權、LICENSE |
| ② 做完讓他知道 | 新功能、改畫面、改讀音或教材、改文件或合作規則 | 看每週摘要，有意見再提；不回覆就照原計畫 | 練習大勾叉、讀音照課本、文件拆分 |
| ③ 不用通知 | 修錯字、修 bug、小調整 | 不用看 | 「扇子」、「呱呱」 |

- 每個 PR 說明標「通知等級」和理由；**拿不準就升一級**。
- 會影響學生作答畫面的改動，合併後維護者自己先玩一次；第二級裡比較大的改動，可以先用草稿 PR 讓夥伴先看。
- **每週摘要**：維護者說「本週摘要」，Claude 從這週合併的 PR 整理 5～10 行白話，分兩區——「需要你的意見」（最多 3 題，附選項）、「知道就好」（可略過），每項附 PR 連結；維護者轉貼到 LINE。重要的那題在 LINE 直接點名問。
- 第二級做錯可以用一個 PR 退回；自動檢查和 `docs/` 記下的理由，是不靠夥伴也能抓錯的保險。

### 合併審核要不要用 GitHub 強制執行（已決定要做，等夥伴發測試 PR 確認）
（2026-10-22 從 `docs/plans/pending.md` 移來；pending.md 只留一行摘要）
- **合併審核要不要用 GitHub 強制執行（CODEOWNERS）**（2026-10-22 加）：現在「動到共用檔案、識字評量要 repo 擁有者同意」只是約定。等夥伴用自己的 GitHub 帳號發 PR，就可以加 `.github/CODEOWNERS`（列出歸擁有者管的路徑）、在 Settings → Rules 設定「要 Code Owners 審核」與「自動檢查要通過」，並把擁有者加進 Bypass list（GitHub 不允許自己審核自己的 PR，不加會卡住擁有者自己的 PR），再發測試 PR 確認。步驟寫在「GitHub 新手使用說明」的「合併規則與審核設定」。
  - **進度**（2026-10-22）：維護者決定要做。已加 `.github/CODEOWNERS`（共用檔案、`tools/literacy/`、`tools/bingo/` 要擁有者 @slddq237-eng 審核）；2026-10-23 擁有者已在 GitHub 網頁 Settings → Rules 設好規則（要發 PR、要 Code Owners 審核、核准人數 0）。還差：請夥伴發測試 PR 確認（改共用檔案要擁有者審核、只改新工具資料夾不用）。測試完成後把這一項移到 `history.md`。2026-10-24：`docs/changelog/changes/`（每個 PR 都要加的變更紀錄小檔）改成不用審核，否則只改新工具資料夾的 PR 也會被 `/docs/` 卡住。
