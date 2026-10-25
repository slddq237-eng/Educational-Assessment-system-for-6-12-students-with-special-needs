# 文件索引（先讀這份）

給接手這個 repo 的 Claude（和人）看的交接文件入口。**不用全部讀完**：先讀這一頁，再依要做的工作，只讀下面表格列的檔案。
2026-10-22 起，原本的 `docs/history/project-status.md`（約 5 萬字）拆成下面幾個小檔案，避免一次讀太多、讀到過時的內容。

## 要做什麼 → 讀哪些檔案

| 要做的工作 | 讀這些檔案 |
|---|---|
| 任何工作 | 這一頁、`CLAUDE.md`（每次自動載入） |
| 做完任何改動、發 PR 前 | `rules.md`「改完要更新哪些檔案」 |
| 查合作規則、通知等級（①②③）、規格書怎麼用 | `rules.md` |
| 改任何程式（新增、刪除、改名檔案，或改到別的檔案會用的東西） | `code/architecture.md`（程式地圖：誰用誰、資料存哪裡、改這裡要一起檢查哪裡）、`code/architecture-notes.md`（注意事項：平板不載入哪些檔案等）、`code/refactor.md`（整理程式的規則：存資料走入口等） |
| 整理（重構）程式 | `code/refactor.md`（規則與進度清單）、`code/architecture.md` |
| 改識字評量的功能、畫面、玩法 | `design/literacy-design.md`；賓果整合、增強系統、血量、部件重組讀 `design/literacy-play.md`；`plans/roadmap.md`（確認屬於哪個階段） |
| 改貼紙、扭蛋、星等、進化、設定步驟、玩法設定表 | `design/game-design.md` |
| 改老師專區、分析、報告、備課分析 | `design/analysis-design.md`、`design/records.md` |
| 改作答紀錄格式、資料儲存、匯出入 | `design/records.md`、`design/a8-terms.md`（**改格式前一定要先讀，並先和維護者討論**） |
| 改教材資料、語詞、干擾字、部件、讀音、注音 | `materials/materials.md`；干擾字讀 `materials/distractors.md`；讀音、注音、破音字讀 `materials/pronunciation.md`；`materials/data-sources.md` |
| 維護者上傳教材檔案、課本改版 | `materials/data-sources.md`「上傳教材檔案、課本改版時」、`materials/materials.md` |
| 加入新的外部資料（課本、字頻、圖片、聲音、字型、程式元件） | `materials/data-sources.md`（同步更新「關於我們」頁 `about.html`） |
| 有人提出新想法、要排優先順序 | `plans/roadmap.md`、`plans/pending.md`；還沒做的計畫細節在 `plans/roadmap-plans.md` |
| 要討論、還沒決定的事 | `plans/pending.md`；A3 正式評量條件讀 `plans/a3-conditions.md`；老師專區簡潔畫面讀 `design/analysis-page-draft.md` |
| 查「當初為什麼這樣決定」、已完成的實作細節 | `history/history.md`（2026-10-24 起的新歷史在 `history/history-2026-10-24.md`；A8 原文在 `history/history-2026-10-25.md`）；教材、讀音的歷史在 `history/history-materials.md`；路線圖已完成項目做了什麼在 `history/history-roadmap.md` |
| 研究方法（單一受試、介入設計） | `design/research-method-spec.md` |

## 每個檔案放什麼（新決定記在對應的檔案，同一件事只記一個地方）

| 檔案 | 內容 | 原本 project-status 的節 |
|---|---|---|
| `INDEX.md`（本頁；2026-10-24 從 `README.md` 改名，和根目錄的專案簡介 `../README.md` 區隔） | 索引、工具與負責人 | 1 的工具表 |
| `rules.md` | 改完要更新哪些檔案、規格書的角色、專案說明、合作規則詳細版、三級通知、合併審核進度（2026-10-24 從本頁搬去） | 1、2 |
| `code/architecture.md` | 程式地圖：每個檔案做什麼、載入順序、資料流、存放位置、改動連帶影響（2026-10-23 新增） | （新） |
| `code/architecture-notes.md` | 程式架構的注意事項：共用名稱、平板作答模式、作答紀錄的存取界線（2026-10-24 從 `code/architecture.md` 第 10 節拆出） | （新） |
| `code/refactor.md` | 整理程式（重構）的規則與進度清單：不整個重寫、存資料一律走入口、一次整理一件事（2026-10-23 新增） | （新） |
| `plans/roadmap.md` | 開發路線圖（階段 A～F，版本規劃 2026-10-24 併入）、開放給其他老師前的準備 | 2-1、5、3-3 的「開放給其他老師前的準備」 |
| `plans/roadmap-plans.md` | 還沒做的計畫細節：E9～E11、平台首頁規劃、多人合作破關遊戲、網站瀏覽量統計（2026-10-24 從 `plans/roadmap.md` 拆出） | 3-3 的「平台首頁規劃」「多人合作破關遊戲」 |
| `design/literacy-design.md` | 識字評量已定案的設計（評量目標、正式評量與練習、提示、評量時機、畫面）、待決的設計問題 | 3 |
| `design/literacy-play.md` | 賓果整合與增強系統、血量模式、部件重組（2026-10-24 從 `design/literacy-design.md` 拆出） | 3-1、3-3 的「血量模式」「目標 4-1」 |
| `design/game-design.md` | 遊戲與獎勵：貼紙代號、星等、扭蛋、進化、設定步驟與玩法設定表（2026-10-24 新增） | （新） |
| `design/analysis-design.md` | 老師專區（分析）、研究方法分層、學扶前後測、分析教學、備課分析 | 3-2、3-4、3-3 的「學扶前後測」「分析教學」 |
| `design/records.md` | 資料怎麼存、作答紀錄 | 4 |
| `design/a8-terms.md` | A8 名詞與時期定義：前後測、研究時期、紀錄第 3 版欄位、實作待辦（2026-10-25 從 `design/records.md` 拆出） | 3-3 的「A8 名詞與時期定義」 |
| `design/analysis-page-draft.md` | 老師專區「一位學生」簡潔畫面設計草稿：預設畫面、換字表、待決題號（2026-10-25 新增） | （新） |
| `materials/data-sources.md` | 資料來源與授權清單、上傳教材檔案時讀得到哪些檔案 | 4-1、「上傳教材檔案、課本改版時」 |
| `materials/materials.md` | 教材資料的來源與使用邏輯、待確認清單、資料掃描發現、部件資料 | 4-1 的「教材資料的來源與使用邏輯」 |
| `materials/distractors.md` | 干擾字：跟著版本還是固定、怎麼分配、形音都像、老師選干擾字類型（2026-10-24 從 `materials/materials.md` 拆出） | 4-1 |
| `materials/pronunciation.md` | 讀音與注音：破音字、以課本為主、老師怎麼回報讀音、人名地名的特殊讀音（2026-10-24 從 `materials/materials.md` 拆出） | 4-1 |
| `plans/a3-conditions.md` | A3 正式評量標準條件表（草案）：已定案項目、待決項目與 Claude 的建議，回答用題號（2026-10-25 新增） | （新） |
| `plans/pending.md` | 所有待決問題的總清單（每題一行，依誰決定分組，細節在各主題檔案） | 6 |
| `history/history.md` | 決策歷史：整合的分階段計畫、已完成的實作細節、全面檢查 | 原開頭、3-3 主段與實作細節、5-1 |
| `history/history-2026-10-24.md` | 2026-10-24 起的決策歷史（`history/history.md` 滿了，依時間切開；之後快到 1 萬字就再開新檔，檔名用新檔第一天的日期） | （新） |
| `history/history-2026-10-25.md` | 2026-10-25 起的決策歷史：A8 整節原文（拆成 `design/a8-terms.md` 前） | （新） |
| `history/history-materials.md` | 決策歷史：各本課本的匯入紀錄、破音字讀音的比對過程 | 4 的課本匯入細節、4-1 的破音字舊段落 |
| `changelog/changelog.md`、`changelog/changelog-年-月-日.md` | 變更紀錄：每個 PR 改了什麼、想法怎麼變（2026-10-24 新增）。**平常不用讀**，要追某件事的變化時才讀，或執行 `node docs/scripts/changelog.js` 印出整張表；發 PR 時在 `docs/changelog/changes/` 加一個小檔案（2026-10-24 起，見 `changelog/changelog.md`「怎麼寫」） | （新） |
| `history/history-roadmap.md` | 路線圖已完成項目做了什麼（2026-10-23 整理 `plans/roadmap.md` 時原文搬來） | 2-1、「開放給其他老師前的準備」的已完成部分 |

其他：`design/research-method-spec.md` 研究方法規格；`scripts/` 產生資料、自動檢查的程式；`materials/material-review.xlsx`、`materials/parts-table.xlsx` 給老師確認的教材清單。
人看的文件（claude.ai 文件，需擁有者分享才能開）：識字評量規格書（2026-10-23 起只用來討論，最新決定以 `docs/` 為準）、GitHub 新手使用說明。

## 寫文件的規則

- 新決定記在上表對應的檔案；改變決定時**直接改寫現況**，舊的說法移到 history 檔案（現在寫進 `history/history-2026-10-24.md`），不要讓新舊說法並存。
- **精簡、重整、拆分文件時不直接刪內容**（2026-10-24 維護者決定）：拿掉的段落原文搬到 history 檔案（決定的歷史 `history/history-2026-10-24.md`（舊的在 `history/history.md`）、教材 `history/history-materials.md`、路線圖已完成項目 `history/history-roadmap.md`；都不適合就在最新的決策歷史檔加一節），原處留一句「見 ○○」。只有錯字、重複的同一句話可以直接刪。PR 說明寫出每一段搬去哪裡。
- **檔案放哪個資料夾**（2026-10-24 分資料夾）：`docs/` 最上層只放本頁和 `rules.md`；其他依用途放 `code/`（程式）、`design/`（功能設計）、`materials/`（教材）、`plans/`（路線圖、待決）、`history/`（歷史）、`changelog/`（變更紀錄）、`scripts/`（程式工具）。新增檔案放進最接近的資料夾、加進上面兩張表；一個資料夾超過約 10 份說明文件再考慮細分。
- 單一檔案超過約 10,000 字，自動檢查會提醒該拆了。
- 檔案內文寫的「見 3-1」「第 2-1 節」是原本 project-status 的節號，用上表找在哪個檔案。

## 專案在做什麼、工具與負責人

給 6～12 歲特殊需求學生使用的線上教學與評量平台（介紹、網址見 `rules.md` 第 1 節）。開工時用下表判斷要改的檔案歸誰、是不是共用檔案。

| 工具 | 資料夾 | 負責人 | 狀態 |
|---|---|---|---|
| 生字賓果 | （已刪除） | 夥伴（原作者） | **2026-10-21 移除**：原作者決定不保留檔案，玩法已整合進識字評量（見 3-1）。兩位維護者之後一起修訂識字評量。老師瀏覽器裡的賓果舊紀錄不匯入（3-1 已定案）。 |
| 識字評量 | `tools/literacy/` | 另一位維護者 | 第 1 版＋快速開始 |
| 備課分析 | `tools/prep/` | 提出的維護者（2026-10-20 新增） | 第 1 版：部件排行、生字一覽、字頻 |
| 共用教材 | `shared/lessons.js` | 共用（改前先告知對方） | 識字評量、備課分析都讀這份 |
| 共用部件 | `shared/parts.js` | 共用（自動產生） | 備課分析、識字評量的部件提示與部件重組讀這份 |

## 合作規則、改完要更新哪些檔案

見 `rules.md`（2026-10-24 從本頁搬去）：改完要更新哪些檔案、規格書的角色、專案說明、合作規則詳細版、三級通知與每週摘要、合併審核（CODEOWNERS）進度。發 PR 前讀。
