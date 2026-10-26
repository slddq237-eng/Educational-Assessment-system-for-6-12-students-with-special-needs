# 學習評量平台

給 6～12 歲特殊需求學生使用的線上教學與評量小工具平台。

網站：https://slddq237-eng.github.io/Educational-Assessment-system-for-6-12-students-with-special-needs/

## 目前的工具

| 工具 | 資料夾 | 狀態 |
|---|---|---|
| 識字評量 | `tools/literacy/` | 試用階段：目標 3 形音辨識、目標 4-1 部件重組；大螢幕輪流作答，或平板掃 QR code 作答（只限練習）；作答紀錄、老師專區、Excel 匯出 |
| 備課分析 | `tools/prep/` | 試用階段：依課次／段考範圍統計常見部件、列出學過的舊字、字頻排序（教育部字頻總表）、匯出 Excel |

## 文件在哪裡

- **每個檔案做什麼、檔案之間的關係**：[`docs/code/architecture.md`](docs/code/architecture.md)（程式地圖）
- **交接文件索引**：[`docs/INDEX.md`](docs/INDEX.md)；**合作規則、改完要更新哪些檔案**：[`docs/rules.md`](docs/rules.md)
- **某件事每次改了什麼、想法怎麼變**：[`docs/changelog/changelog.md`](docs/changelog/changelog.md)（變更紀錄）
- 資料與隱私說明：[`privacy.html`](privacy.html)；資料來源與出處：[`about.html`](about.html)
- 給新手的 GitHub 與 Claude Code 使用說明：claude.ai 文件「GitHub 與 Claude code 新手使用說明」（需擁有者分享）

## 資料夾地圖

整個平台只有三種東西：**網頁和程式**（`tools/`、`shared/`、首頁）、**教材資料**（`shared/lessons.js` 等）、**說明文件**（`docs/`）。這裡只列到資料夾和主要檔案；每個檔案做什麼、誰用誰，見 [`docs/code/architecture.md`](docs/code/architecture.md)。

```
根目錄
├─ index.html        平台首頁（工具清單、最後更新）
├─ about.html        關於我們（資料來源與出處）
├─ privacy.html      資料與隱私說明
├─ README.md         專案簡介（本頁，GitHub 首頁會顯示）
├─ CLAUDE.md         給 Claude 的合作規則（每則訊息都會讀，所以很短）
├─ .github/          自動檢查（workflows/check.yml）、CODEOWNERS（誰要審核）
├─ shared/           所有工具共用的教材與程式
│   ├─ lessons.js    課本、生字、語詞、例句、干擾字、人工整理的部件
│   ├─ parts.js      部件（自動產生；要改部件請改 lessons.js，見下方）
│   ├─ bpmf.js       注音讀音表、唸題目的替換字（自動產生）
│   ├─ freq.js       字頻排名
│   ├─ common.js、themes.js、themes.css、sticker-art.js、rewards.js  共用小工具、主題貼紙、學生收藏
│   ├─ fonts/        楷書、注音字型（切成小檔，用到才下載）
│   └─ vendor/       外部元件：Excel、QR code（按了才下載）
├─ tools/
│   ├─ literacy/     識字評量（設定 → 作答 → 存紀錄 → 老師專區；平板作答在 tablet.js）
│   └─ prep/         備課分析（部件排行、生字一覽、字頻）
└─ docs/             所有決定、規則、設計（唯一正確的版本）
    ├─ INDEX.md      索引（開工先讀）
    ├─ rules.md      合作規則、改完要更新哪些檔案（發 PR 前讀）
    ├─ code/         程式地圖 architecture.md、整理程式的規則 refactor.md
    ├─ design/       各功能的設計：識字評量、遊戲獎勵、分析、作答紀錄 records.md、研究方法
    ├─ materials/    教材、干擾字、讀音、資料來源，和給老師校對的 .xlsx 表格
    ├─ plans/        開發路線圖 roadmap.md、還沒決定的事 pending.md
    ├─ history/      舊的說法、已完成的細節（精簡文件時不刪，搬到這裡）
    ├─ changelog/    變更紀錄：每個 PR 改了什麼（changes/ 一個 PR 一個小檔）
    └─ scripts/      自動檢查 check.js、產生部件／注音／字型的程式
```

新增、刪除、改名資料夾時，記得更新這張地圖（見 `docs/rules.md`「改完要更新哪些檔案」）。

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
   - 想讓某個字**不要拆**（當成獨體字），部件就寫它自己，例如 `"王":"王"`。識字評量不會直接顯示這個字，部件提示和部件重組會改成把字切成碎塊分開擺（唸不出來，保留評量效果）。
3. 存檔（Commit），發 Pull Request。`shared/` 是共用檔案，記得先告訴夥伴。
4. 合併後打開「備課分析」，確認部件排行有更新。

**新增課本後**：新課本的生字如果沒有部件，請 Claude 重新產生 `shared/parts.js`。人工寫在 `PARTS` 的拆法不會受影響。

## 合作規則

詳細規則只寫在一個地方：[`docs/rules.md`](docs/rules.md) 第 2 節（避免多份說法不一致）。最重要的三條：

1. 新功能開分支、發 Pull Request，不直接改 main；開工就先發「草稿 PR」，開工前先看有沒有人在改同一批檔案。
2. **不要把學生的真實姓名、照片或成績放進任何檔案**。這個 repo 是公開的。
3. `shared/`、`docs/`、首頁 `index.html`、`privacy.html`、`README.md`、`CLAUDE.md` 是共用檔案，修改前先告訴夥伴，PR 說明要特別標出。

## 授權說明

識字評量的注音字型改自 But Ko「ㄅ字嗨注音標楷」（[bpmfvs](https://github.com/ButTaiwan/bpmfvs)），漢字部分 CC BY 4.0，其餘 SIL OFL 1.1。

`shared/parts.js` 的部件拆解改自 [cjkvi-ids](https://github.com/cjkvi/cjkvi-ids)（衍生自 CHISE 專案），依 GPLv2 或更新版授權（依 CHISE 專案條款；Copyright (c) 2014-2017 CJKVI Database）。
