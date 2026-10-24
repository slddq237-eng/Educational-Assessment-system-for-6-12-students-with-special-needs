# 程式地圖（architecture.md）

整個平台的程式「誰做什麼、誰用誰、資料從哪裡來、存到哪裡」。**改程式前先看這份**，找出會一起受影響的地方，避免改一處壞另一處。
（2026-10-23 建立。只寫「關係」，細節看各檔案開頭的中文說明；檔案內的「第 ○ 節」就是下面表格的節號。）

**維護規則**：新增、刪除、改名 `.js` 檔，或改了檔案之間的關係（新的共用函數、新的儲存位置、新的對外連線），在同一個 PR 更新這份。整理（重構）程式時照 `docs/refactor.md` 的規則，做完更新那裡的進度清單。自動檢查 `docs/scripts/check.js` 會幫忙抓：有 .js 檔或儲存名稱沒列在這份地圖、有檔案繞過入口直接存資料（見 `refactor.md` 規則 1）。

## 1. 全景

```
                 ┌──────────── 教材與字型（自動產生或人工整理，所有工具共用）────────────┐
 docs/scripts/   │ shared/lessons.js  課本、生字、語詞、例句、干擾字（人工整理）        │
 make_parts.py ─→│ shared/parts.js    部件（自動產生，可手改）                         │
 make_bpmf.py  ─→│ shared/bpmf.js、fonts/bpmf-kai*  注音讀音表與注音字型（自動產生）    │
 make_kai.py   ─→│ shared/fonts/tw-kai*  標準楷書字型（自動產生）                        │
                 │ shared/freq.js     字頻排名                                         │
                 └──────────────────────────────┬──────────────────────────────────────┘
                                                │ 讀
                 ┌──────────── 共用程式 ─────────┴──────────────────────────────────────┐
                 │ shared/common.js   課本排序與名稱、語詞、干擾字、部件查詢、載入 Excel 元件 │
                 │ shared/themes.js   主題、貼紙圖形（window.Themes）                     │
                 │ shared/rewards.js  學生貼紙收藏與頭像（window.Rewards，存 IndexedDB）  │
                 └───────────────┬──────────────────────────────┬──────────────────────┘
                                 │                              │
              tools/literacy/ 識字評量                   tools/prep/ 備課分析
              （設定→作答→存紀錄→老師專區）              （部件排行、生字一覽、字頻）
                                 │
                     老師自己的瀏覽器（localStorage、IndexedDB）
                     ＋ 備份檔 .json、匯出 Excel（老師自己下載）
```

- 沒有後端、沒有資料庫伺服器：所有程式都在老師的瀏覽器裡跑，資料只存在那台電腦（見第 6 節）。
- 首頁 `index.html`、`about.html`（關於我們）、`privacy.html`（資料與隱私）只有文字和連結，只載入楷書字型，不載入程式。
- `tools/bingo/index.html` 只是轉址到識字評量的說明頁。

## 2. 每個頁面載入哪些檔案（順序很重要）

所有 `.js` 都是一般的 `<script>`，上面的檔案定義的名稱（例如 `BOOKS`、`esc`、`records`），下面的檔案直接拿來用。**順序錯了網頁會壞**；新增檔案要放對位置。

| 頁面 | 載入順序 |
|---|---|
| `tools/literacy/index.html` | lessons → bpmf → freq → parts → common → sticker-art → themes → rewards → data → setup → records → wordsets → play → collect → gacha → scenes → teacher → pivot → tablet → app → tour（平板作答不載入 teacher、pivot、tour，見下方） |
| `tools/prep/index.html` | lessons → parts → freq → common → prep |
| `tools/literacy/guide.html`、`analysis-guide.html`（使用說明、分析教學） | 頁面裡的 `DEMOS` → demo.js（示範動畫）；樣式 demo.css |

- 每個 `<script src>`、`<link>` 後面都有 `?v=日期`，**所有頁面要一樣**；改了任何 js、css 就全部換成新的版本號，老師的瀏覽器才會抓新檔（自動檢查第 3 項）。
- Excel 元件 `shared/vendor/xlsx-0.18.5.full.min.js` 不在上表：要匯出、匯入 Excel 時才由 `common.js` 的 `loadXlsx()` 載入。QR code 元件 `shared/vendor/qrcode-generator-1.4.4.js` 也一樣，按「產生 QR code」時才由 `tablet.js` 的 `loadQr()` 載入。

## 3. 共用檔案 `shared/`

| 檔案 | 內容（主要名稱） | 誰在用 | 怎麼改 |
|---|---|---|---|
| `lessons.js` | `BOOKS`（課本→課次→習寫字 write、認讀字 read；課次可有 `title`、`sayChar`＝題目只唸字，見 play.js 的 `promptOf`）、`WORDS`/`WORDS_ED` 語詞、`SENT`/`SENT_ED` 例句、`CONF`/`CONF_ED` 干擾字、`PARTS` 人工部件、`PICS`、`POLY_ED` | 識字評量、備課分析、自動檢查、所有 make_*.py | 人工改；新增課本後要跑三支 make_*.py |
| `parts.js` | `PARTS_AUTO` 自動拆的部件 | 透過 `common.js` 的 `rawParts` | `make_parts.py` 只新增，可手改錯的 |
| `bpmf.js` | `BPMF_TXT`、`BPMF_CH`、`BPMF_SAY`、`Bpmf`（注音顯示、唸題換字） | 識字評量（`play.js` 的 `sayOf`、選項注音） | **不要手改**，跑 `make_bpmf.py`；讀音例外寫在它的 `CHECKED` |
| `freq.js` | `FREQ`（字→排名） | 識字評量（常用字、字頻優先、高字頻）、備課分析 | 從原始檔重新產生 |
| `common.js` | `esc`（防止文字變成程式碼）、`BOOK_ORDER`、`bookName`、`lessonName`、`lessonKeys`、`wordOf`、`sentOf`、`confOf`、`rawParts`、`partsSource`、`setMsg`、`loadXlsx` | 識字評量、備課分析 | 規則只寫在這裡，**改一處兩個工具都變** |
| `themes.js`、`themes.css` | `window.Themes`：四主題、貼紙清單與圖、星等、代號、抽貼紙、作答背景 `backdrop`（新圖在 sticker-art.js） | `collect.js`、`scenes.js`、`play.js`、`rewards.js` | |
| `rewards.js` | `window.Rewards`：頭像、貼紙收藏、`ready`、`award`、`owned`、`hasSession`、`exportAll`/`importAll` | 識字評量各處（頭像）、`collect.js`（發貼紙） | 之後的新工具也可以發貼紙 |
| `fonts/` | `tw-kai*` 楷書、`bpmf-kai*` 注音字型（依用到的字切成小檔） | 所有頁面 | 跑 `make_kai.py`、`make_bpmf.py`，不要手改 |

## 4. 識字評量 `tools/literacy/`

| 檔案 | 節 | 做什麼 | 主要對外名稱（別的檔案會用） |
|---|---|---|---|
| `data.js` | 1～3 | 基本設定與選項表（目標、提示、玩法）、存讀 localStorage、學生名單、教學日期、**評量時機判斷**、紀錄格式版本 | `state`、`settings`、`kids`、`teach`、`teachFor`、`phaseFor`、`key`、`iso`、`today`、`RECORD_FORMAT`、`HINT_UNFIT`、`fitHints`、`partsOf` |
| `setup.js` | 4～5 | 設定畫面（快速開始、四個步驟、學扶前後測）、學生名單／教學日期／細部設定面板 | `render()`（任何設定改變都呼叫）、`setUi`、`splitKey`、`rtiDays`、`openSheet` |
| `records.js` | 6～7 | 作答紀錄存取（IndexedDB）、`COLS` 紀錄欄位、Excel 匯出、紀錄面板、備份還原、匯入檔案 | `records`（全部紀錄）、`saveRecord`、`updateRecord`、`exportXlsx`、`addBackupPart` |
| `wordsets.js` | — | 只考有教的字（字組、鎖定、分享） | `wsPick`（這課要考哪些字）、`wsStart`、`wsImport` |
| `play.js` | 8～10 | 出題、組選項、提示、語音、開始前先下載字型（讀取條）、作答畫面、賓果卡、血量、打怪獸過場、流暢性、結果畫面 | `startSession`、`prepareThen`（`collect.js` 的 `chooseTheme` 呼叫）、`sessionText`、`loadFonts`（`tablet.js` 也用）、`endItem`、`finish`、`G`（這次作答的狀態） |
| `collect.js` | 11～14 | 選主題、頭像、得到貼紙、貼紙簿 | `chooseTheme`、`drawStickers`、`giveStickers`、`importStickers` |
| `gacha.js` | — | 扭蛋機：拉拉桿揭曉貼紙、各星等特效與聲音 | `showGacha`（`collect.js` 的 `showReveals` 呼叫） |
| `scenes.js` | — | 打怪獸的四個場景動畫 | 由 `play.js` 的 3-3 呼叫 |
| `teacher.js` | 15～20 | 老師專區：一位學生的圖表、全班總表、逐字學習紀錄 | `renderTeacher`、`openCharLog` |
| `pivot.js` | 21～23 | 進階分析（樞紐分析表） | `renderPivot` |
| `tablet.js` | — | 平板作答（F2）：表單網址設定、產生 QR code、平板點代號與送出、匯入 Google 試算表的 Excel | `tabletQr`、`tabletStart`、`tabletSend`（`finish` 呼叫）、`tabletSheet`（`records.js` 的匯入檔案呼叫） |
| `app.js` | — | 全部載入後畫出第一個畫面（平板作答時改成點代號的畫面）、過夜換日提醒 | — |
| `tour.js` | — | 新手導覽 | — |
| `demo.js`、`demo.css` | — | 使用說明、分析教學頁的示範動畫 | 只給 guide.html、analysis-guide.html 用 |

### 一次評量的流程（從設定到存紀錄）

1. **設定**（`setup.js`）：老師選目標、學生、課次、玩法 → 存進 `state`、`settings`。課次要考的字由 `wordsets.js` 的 `wsPick` 決定。
2. **選主題**（`collect.js` `chooseTheme`）→ 呼叫 `play.js` 的 `startSession()`。
3. **出題**（`play.js` 第 8 節）：`pickItems` 抽字（「常錯優先」會讀 `records`）→ `makeOptions` 組選項（用 `common.js` 的 `confOf`、`wordOf`）→ `hintHtml` 做提示（`data.js` 的 `fitHints` 跳過不適合的提示）。
4. **作答**（第 9 節）：每題結束呼叫 `endItem` → 組成一筆紀錄，時期用 `data.js` 的 `phaseFor` 判斷、字組資訊用 `wordsets.js` → `records.js` 的 `saveRecord` 存進 IndexedDB。
5. **結果**（第 10 節 `finish`）：中途離開的紀錄標 `quit` → `collect.js` 的 `drawStickers` 抽好寫進紀錄 → 平板送出 → `giveStickers` → 扭蛋機 `showGacha` 揭曉。
6. **老師專區**（`teacher.js`、`pivot.js`）：只讀 `records`，不寫回。錯誤類型的「亂猜會佔」用 `play.js` 的 `optType`（傳入紀錄的 `goal`）替舊紀錄的選項重新分類，改 `optType` 時要一起檢查；`pivot.js` 的「目標字在語詞的位置」用 `teacher.js` 的 `wposOf`。

## 5. 備課分析 `tools/prep/`

`prep.js` 一個檔案：讀 `BOOKS`、部件（`rawParts`）、`FREQ`，算部件排行、生字一覽、字頻；畫面狀態存 localStorage；可匯出 Excel。**不讀、不寫任何學生資料。**

## 6. 資料存在哪裡

全部在老師自己的瀏覽器（換電腦要靠備份檔）。

| 存放位置 | 名稱 | 內容 | 讀寫的檔案 |
|---|---|---|---|
| IndexedDB | `literacy` / `records` | **作答紀錄**（每題一筆，欄位見 `records.js` 的 `COLS`） | `records.js`（只有它直接存取） |
| IndexedDB | `platform-rewards` / `kids` | 貼紙收藏、頭像（可能有照片） | `shared/rewards.js` |
| localStorage | `literacy-kids` | 學生名單 | `data.js` |
| localStorage | `literacy-teach` | 教學日期（全班預設＋個別學生） | `data.js` |
| localStorage | `literacy-settings` | 細部設定 | `data.js` |
| localStorage | `literacy-wordsets` | 字組 | `wordsets.js` |
| localStorage | `literacy-ui`、`literacy-preset` | 設定畫面停在哪 | `setup.js` |
| localStorage | `literacy-teacher`、`literacy-pivot`、`literacy-pivots` | 老師專區、進階分析的選單 | `teacher.js`、`pivot.js` |
| localStorage | `literacy-tour` | 看過新手導覽沒 | `tour.js` |
| localStorage | `literacy-lastBackup` | 上次下載備份檔的日期（超過 30 天提醒） | `records.js` |
| localStorage | `prep-ui`、`prep-ranges` | 備課分析的選擇 | `prep.js` |
| sessionStorage | `literacy-tablet` | 平板作答：這個分頁的練習設定（含學生名字），關掉分頁就不見；不放進備份 | `data.js` |

- **備份檔**（.json）：`records.js` 組成，內含作答紀錄、學生名單、教學日期、設定，以及用 `addBackupPart` 登記的其他資料（目前有字組 `wordsets.js`、貼紙與頭像 `collect.js`）。新增要存的資料時，記得用 `addBackupPart` 加進備份。
- 作答紀錄格式的規則在 `docs/records.md`：只加新欄位、不改舊欄位的意思，**改格式前先討論**。

## 7. 對外連線

| 連到哪裡 | 用途 | 連不上時 |
|---|---|---|
| Google Fonts（fonts.googleapis.com、fonts.gstatic.com） | 介面字型 Huninn | 改用電腦內建字型，照常使用 |
| 瀏覽器的語音（Chrome 的 Google 語音會連雲端） | 唸題目；唸學生名字只用本機語音 | 沒有語音時提醒老師 |
| Google 表單（docs.google.com） | 問題回報連結 | 只是連結 |
| 老師自己的 Google 表單（docs.google.com/forms/…/formResponse） | 平板作答：學生做完送出作答紀錄（只有代號），見 `tablet.js` | 結果畫面顯示「送不出去」，可再送或下載紀錄檔 |

新增對外連線時要更新 `privacy.html` 和 `docs/data-sources.md`。

## 8. 改這裡，要一起檢查哪裡

| 要改的東西 | 會一起受影響 |
|---|---|
| `shared/lessons.js` 新增課本 | 跑 `make_parts.py`、`make_bpmf.py`、`make_kai.py`；跑自動檢查；兩個工具的課本清單會自動更新 |
| `shared/common.js` 的任何函數 | 識字評量**和**備課分析都要打開試一次 |
| 作答紀錄欄位（`play.js` 的 `endItem`、`records.js` 的 `COLS`） | Excel 匯出、老師專區、進階分析（`pivot.js` 的 `DIMS`）、備份與匯入、`RECORD_FORMAT` 版本、`docs/records.md`；**先討論** |
| 時期判斷（`data.js` 第 3 節 `phaseFor`） | 寫進每筆紀錄的 `phase`、老師專區依時期的圖、學扶前後測；屬 A8，**先討論** |
| 教學日期的存法（`teach`、`teachFor`） | 時期判斷、老師專區「教學開始後第幾天」（用現在的教學日期回推）、備份 |
| 提示的種類或順序（`data.js` 的 `HINT_ORDER`、`HINT_UNFIT`） | 設定畫面、`play.js` 的 `hintHtml`、紀錄的 `hintSet`、老師專區「提示層級」 |
| 字組（`wordsets.js`） | 設定第 3 步、出題 `testChars`、紀錄的 `ws` 欄、備份、匯入檔案 |
| 主題、貼紙（`shared/themes.js`、`rewards.js`） | 設定第 4 步、作答背景、打怪獸場景、貼紙簿、備份 |
| 新增 localStorage／IndexedDB 名稱 | 第 6 節的表、備份（`addBackupPart`）、`privacy.html` |
| 新增 `.js`、`.css` 檔 | 頁面的載入順序（第 2 節）、所有頁面的 `?v=`、這份地圖 |
| 頁面上的中文字 | 跑 `make_kai.py`（新字才有楷書） |

## 9. 自動產生資料的程式 `docs/scripts/`

`check.js`、`bump.js`、`changelog.js`、`make_parts.py`、`make_bpmf.py`、`make_kai.py`、`make_conf_candidates.py`：各產生什麼、什麼時候跑，見 `docs/scripts/README.md`（2026-10-24 搬去）。

## 10. 現在架構的特點與注意事項

- **共用名稱**：識字評量的檔案靠「上面定義、下面直接用」溝通，沒有明確的介面。改名稱前先在整個 repo 搜尋這個名稱（例如在 GitHub 或請 Claude 搜尋），確定所有用到的地方都一起改。`themes.js`、`rewards.js` 只對外提供 `window.Themes`、`window.Rewards`，比較不會撞名，新的共用程式建議照這個寫法。
- **平板作答模式**（網址有 `#t=`，`data.js` 的 `TABLET`）：`load` 改從網址讀、`store` 不寫，`records.js` 不開資料庫，其他程式照常跑。新增要存的資料時記得它在平板上不會存下來。**平板不載入 `teacher.js`、`pivot.js`、`tour.js`**（2026-10-24 R4a）：平板會跑到的程式**不能用這三個檔案的東西**，共用小工具放 `data.js`（例如 `chipRow`）。
- **作答紀錄只有 `records.js` 直接存取 IndexedDB**：這是之後要換成線上資料庫（階段 F）時最需要守住的界線；其他檔案只讀 `records` 陣列、透過 `saveRecord`／`updateRecord` 寫入。
- **日期以打開網頁那天為準**（`data.js` 的 `today`）：網頁開過夜會提醒重新整理（`app.js`）。
- **整理（重構）程式**：規則與進度清單在 `docs/refactor.md`。
