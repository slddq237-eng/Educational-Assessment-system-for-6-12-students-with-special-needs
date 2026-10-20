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
index.html        平台首頁（工具選單）
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
    app.js        程式入口（說明各檔案的載入順序）
  prep/           備課分析（讀取 shared/lessons.js、shared/parts.js）
```

## 合作規則

1. 每個新功能開一個分支（branch），完成後發 Pull Request，由另一位夥伴確認再合併。
2. 每個工具放在 `tools/` 底下自己的資料夾，盡量不要兩人同時改同一個工具。
3. **不要把學生的真實姓名、照片或成績放進程式碼**。這個 repo 是公開的。
4. `shared/`、`docs/` 和首頁 `index.html`、`README.md`、`CLAUDE.md` 是共用檔案，修改前先告訴夥伴。

## 授權說明

生字賓果使用的注音字型改自 But Ko「ㄅ字嗨注音標楷」（[bpmfvs](https://github.com/ButTaiwan/bpmfvs)），漢字部分 CC BY 4.0，其餘 SIL OFL 1.1。

`shared/parts.js` 的部件拆解改自 [cjkvi-ids](https://github.com/cjkvi/cjkvi-ids)（衍生自 CHISE 專案），依 GPLv2 授權。
