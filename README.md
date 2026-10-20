# 學習評量平台

給 6～12 歲特殊需求學生使用的線上教學與評量小工具平台。

## 目前的工具

| 工具 | 資料夾 | 狀態 |
|---|---|---|
| 生字賓果 | `tools/bingo/` | 可使用 |
| 識字評量 | `tools/literacy/` | 第 1 版：目標 3 形音辨識、大螢幕輪流作答、作答紀錄與 Excel 匯出 |
| 備課分析 | `tools/prep/` | 第 1 版：依課次／段考範圍統計常見部件、列出學過的舊字、匯出 Excel；字頻待資料匯入 |

## 資料夾說明

```
index.html        平台首頁（工具選單、最後更新日期）
privacy.html      資料與隱私說明（給學校、家長、老師看）
LICENSE           授權條款（MIT，範圍見下方「授權說明」）
docs/
  project-status.md  專案現況與決策紀錄（交接用）
shared/
  lessons.js      共用教材資料：生字、語詞、例句、部件、形近同音字
  themes.js       共用主題與貼紙（海洋、太空、恐龍、甜點；取自生字賓果）
  themes.css      主題配色、頭像、貼紙的樣式
  rewards.js      每位學生的貼紙收藏與頭像（存在這台電腦）
  parts.js        自動產生的部件拆解（所有生字＋部件再往下拆）
tools/
  bingo/          生字賓果遊戲（讀取 shared/lessons.js）
  literacy/       識字評量（讀取 shared/lessons.js）
    index.html    畫面
    data.js       基本設定、學生與教學日期、評量時機判斷
    setup.js      設定畫面與彈出面板
    records.js    作答紀錄、Excel 匯出、備份還原
    play.js       出題、作答畫面、結果畫面
    collect.js    選主題、頭像、得到貼紙、貼紙簿
    scenes.js     打怪獸的四個場景（移植自生字賓果）
    teacher.js    老師專區（一位學生的圖表、全班總表、逐字學習紀錄）
    pivot.js      老師專區的進階分析（樞紐分析表）
    guide.html    學扶前後測快速指南（可列印成一張 A4）
    analysis-guide.html  分析教學：老師專區怎麼看、名詞解釋、進階分析範例
    app.js        程式入口（說明各檔案的載入順序）
  prep/           備課分析（讀取 shared/lessons.js、shared/parts.js）
```

## 怎麼修改或新增部件

部件資料有兩份，查一個字時**先看人工的，沒有才用自動的**：

| 檔案 | 內容 | 要不要手動改 |
|---|---|---|
| `shared/lessons.js` 的 `PARTS` | 人工整理的拆法 | **要改部件就改這裡** |
| `shared/parts.js` 的 `PARTS_AUTO` | 程式自動產生（cjkvi-ids） | 不建議：重新產生時會被覆蓋 |

**格式**：`"字":"部件 部件"`。部件之間用**半形空格**分開，每個部件是一個字（例如 `"清":"氵 青"`、`"串":"口 口 丨"`）。每一筆之間用半形逗號 `,` 隔開。

**修正或新增一個字的拆法**（在 GitHub 網頁上就能改）：

1. 先開新分支，打開 `shared/lessons.js`，按右上角鉛筆圖示編輯。
2. 找到 `const PARTS = {`（第 28 行附近），在 `{` 後面加上一筆，例如 `"王":"王",` 或 `"只":"口 八",`。
   - 同一個字已經有了，就直接改引號裡的部件。
   - 想讓某個字**不要拆**（當成獨體字），部件就寫它自己，例如 `"王":"王"`。
3. 存檔（Commit），發 Pull Request。`shared/` 是共用檔案，記得先告訴夥伴。
4. 合併後打開「備課分析」，確認部件排行有更新。

**新增課本後**：新課本的生字如果沒有部件，請 Claude 重新產生 `shared/parts.js`。人工寫在 `PARTS` 的拆法不會受影響。

## 合作規則

1. 每個新功能開一個分支（branch，一份可以放心修改的複本），完成後發 Pull Request（PR，請對方確認後合併回 main 的申請），由另一位夥伴確認再合併。維護者明確要求直接合併時可以，但仍要告知夥伴。
2. 每個工具放在 `tools/` 底下自己的資料夾，盡量不要兩人同時改同一個工具。
3. **開工前先到 GitHub 檢查有沒有人在改同一批檔案**：打開 repo 的「Pull requests」分頁，點進每個還沒合併的 PR 看「Files changed」。有改到同一個檔案，就先說好誰先改，或等對方合併後再開工。不然兩個 PR 改到同一段，後合併的會出現「衝突」（conflict：Git 不知道要留哪個版本，得手動挑）。
4. **開工就先發「草稿 PR」**（Draft，還沒做完、不能合併的 PR），做完再按「Ready for review」改成可合併。這樣 Pull requests 清單就是大家「正在改哪裡」的即時看板。
5. **不要把學生的真實姓名、照片或成績放進程式碼**。這個 repo 是公開的。
6. `shared/`、`docs/` 和首頁 `index.html`、`privacy.html`、`README.md`、`CLAUDE.md` 是共用檔案，修改前先告訴夥伴，PR 說明要特別標出。

完整版（含人多了之後的看板規劃）見規格書「平台架構與分工 → 合作規則」。

## 授權說明

### 本專案自己寫的程式：MIT

本專案自己寫的程式碼（HTML、CSS、JavaScript）採用 [MIT 授權](LICENSE)：任何人都可以免費使用、修改、再發布，只要保留版權聲明與授權條文；程式「照現狀」提供，不負擔保責任。

**生字賓果（`tools/bingo/`）例外**：這個資料夾是夥伴的作品，授權方式**待夥伴確認**，確認前不在 MIT 範圍內。

### 不在 MIT 範圍內的教材與第三方資料

下列資料各有自己的授權，**不因本專案採用 MIT 而改變**；要拿去用的人須自行遵守原本的授權。清單以 `docs/project-status.md` 的「資料來源與授權清單」為準。

| 資料 | 位置 | 來源 | 授權 |
|---|---|---|---|
| 課本生字、語詞、例句、形近字 | `shared/lessons.js` | 各出版社課本、維護者整理；部分由 Claude 擬定 | 課本內容屬各出版社著作權，未取得授權，僅供教學參考 |
| 部件拆解 | `shared/parts.js`、`docs/parts-table.xlsx` | 改自 [cjkvi-ids](https://github.com/cjkvi/cjkvi-ids)（衍生自 CHISE 專案） | GPLv2 |
| 注音字型（嵌在 `tools/bingo/index.html`） | `tools/bingo/` | 改自 But Ko「ㄅ字嗨注音標楷」（[bpmfvs](https://github.com/ButTaiwan/bpmfvs)） | 漢字部分 CC BY 4.0，其餘 SIL OFL 1.1 |
| 網頁字型 Huninn、LXGW WenKai TC | 各頁面（從 Google Fonts 載入，不在 repo 裡） | Google Fonts | SIL OFL 1.1 |
| SheetJS 0.18.5（匯出 Excel） | 各頁面（從 cdnjs 載入，不在 repo 裡） | SheetJS | Apache 2.0 |
