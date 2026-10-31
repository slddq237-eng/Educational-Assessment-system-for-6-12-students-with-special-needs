# 程式地圖：識字評量 `tools/literacy/`（architecture-literacy.md）

2026-10-31 從 `docs/code/architecture.md` 第 4 節拆出（那份超過 1 萬字），**內容只搬移、沒有修改**。
識字評量每個 `.js` 檔做什麼、誰用誰、一次評量的流程。其他部分（全景、載入順序、`shared/`、資料存在哪裡、對外連線、改這裡要檢查哪裡）還在 `architecture.md`。
新增、刪除、改名識字評量的 `.js` 檔時，更新這份（自動檢查會同時讀 `architecture.md` 和這份）。

## 4. 識字評量 `tools/literacy/`

| 檔案 | 節 | 做什麼 | 主要對外名稱（別的檔案會用） |
|---|---|---|---|
| `data.js` | 1～3 | 基本設定與選項表（目標、提示、玩法）、存讀 localStorage、學生名單（`newKidCode` 產生新學生的隨機代號，2026-10-31；`kidLabel` 名字不重複就只顯示名字；封存名單 `kidsArchived`、`knownKid`；名字不能重複 `nameTaken`）與分組（`getGroups`／`saveGroups`，存在 `literacy-teacher` 的 `groups`）、教學日期與前後測（`daysAfterEnd`、`PREPOST`）、紀錄格式版本 | `state`、`settings`、`kids`、`teach`、`teachFor`、`daysAfterEnd`、`PREPOST`、`key`、`iso`、`today`、`RECORD_FORMAT`、`HINT_UNFIT`、`fitHints`、`partsOf` |
| `setup.js` | 4～5 | 設定畫面（快速開始、四個步驟、正式評量的前測／後測按鈕 `renderPrepost`）、學生名單（新增、封存、`deleteKid` 刪除學生連同紀錄與貼紙、新學期 `renderTidy` 整理名單）／教學日期／細部設定面板 | `render()`（任何設定改變都呼叫）、`setUi`、`splitKey`、`rtiDays`、`openSheet` |
| `records.js` | 6～7 | 作答紀錄存取（IndexedDB）、`COLS` 紀錄欄位、Excel 匯出、紀錄面板、備份還原、匯入檔案 | `records`（全部紀錄）、`saveRecord`、`updateRecord`、`exportXlsx`、`addBackupPart` |
| `wordsets.js` | — | 只考有教的字（字組、鎖定、分享） | `wsPick`（這課要考哪些字）、`wsStart`、`wsImport` |
| `play.js` | 8～10 | 出題、組選項、提示、語音、開始前先下載字型（讀取條）、作答畫面、賓果卡、打怪獸過場、貼紙夥伴（選夥伴、出場）、流暢性、結果畫面 | `startSession`、`prepareThen`（`collect.js` 的 `chooseTheme` 呼叫）、`sessionText`、`loadFonts`（`tablet.js` 也用）、`endItem`、`finish`、`G`（這次作答的狀態） |
| `collect.js` | 11～14 | 選主題、頭像、得到貼紙、貼紙簿 | `chooseTheme`、`drawStickers`、`giveStickers`、`importStickers` |
| `gacha.js` | — | 扭蛋機：拉拉桿揭曉貼紙、各星等特效與聲音 | `showGacha`（`collect.js` 的 `showReveals` 呼叫） |
| `scenes.js` | — | 打怪獸的四個場景動畫 | 由 `play.js` 的 3-3 呼叫 |
| `teacher.js` | 15～20 | 老師專區：一位學生的圖表、全班總表、逐字學習紀錄 | `renderTeacher`、`openCharLog` |
| `pivot.js` | 21～23 | 進階分析（樞紐分析表） | `renderPivot` |
| `tablet.js` | — | 平板作答（F2）：表單網址設定、產生 QR code、平板點代號與送出、匯入 Google 試算表的 Excel | `tabletQr`、`tabletStart`、`tabletSend`（`finish` 呼叫）、`tabletSheet`（`records.js` 的匯入檔案呼叫） |
| `app.js` | — | 全部載入後畫出第一個畫面（平板作答時改成點代號的畫面）、過夜換日提醒 | — |

### 一次評量的流程（從設定到存紀錄）

1. **設定**（`setup.js`）：老師選目標、學生、課次、玩法 → 存進 `state`、`settings`。課次要考的字由 `wordsets.js` 的 `wsPick` 決定。
2. **選主題**（`collect.js` `chooseTheme`）→ 呼叫 `play.js` 的 `startSession()`。
3. **出題**（`play.js` 第 8 節）：`pickItems` 抽字（「常錯優先」會讀 `records`）→ 多位學生輪流時 `interleaveLists` 排順序（相鄰題不出同一個字）→ `makeOptions` 組選項（用 `common.js` 的 `confOf`、`wordOf`）→ `hintHtml` 做提示（`data.js` 的 `fitHints` 跳過不適合的提示）。
4. **作答**（第 9 節）：每題結束呼叫 `endItem` → 組成一筆紀錄，前後測用 `play.js` 開始時記下的 `G.prepost`，教學後天數用 `data.js` 的 `daysAfterEnd`、字組資訊用 `wordsets.js` → `records.js` 的 `saveRecord` 存進 IndexedDB。
5. **結果**（第 10 節 `finish`）：中途離開的紀錄標 `quit` → `collect.js` 的 `drawStickers` 抽好寫進紀錄 → 平板送出 → `giveStickers` → 扭蛋機 `showGacha` 揭曉。
6. **老師專區**（`teacher.js`、`pivot.js`）：只讀 `records`，不寫回。錯誤類型的「亂猜會佔」用 `play.js` 的 `optType`（傳入紀錄的 `goal`）替舊紀錄的選項重新分類，改 `optType` 時要一起檢查；`pivot.js` 的「目標字在語詞的位置」用 `teacher.js` 的 `wposOf`。
