# 評量目標能力表（B12）和識字評量組合測試
- 日期：2026-10-31
- 動到哪裡：`tools/literacy/data.js`、`setup.js`、`teacher.js`、`docs/scripts/combo.js`（新）、`docs/scripts/smoke.js`、`docs/code/architecture*.md`、`setup-flow-audit.md`
- 改了什麼：整理，**行為不變**。每個評量目標的特性集中在 `data.js` 的 `GOAL_CAPS`（能不能正式評量／流暢性、不能玩賓果的原因、答案是不是部件、哪些字不出題、不適合的提示）；原本散在 `goalSkips`、`playWhy`、`step1Miss`、`HINT_UNFIT`、`isPartsGoal`、`GOALS` 的 `practiceOnly` 的判斷改讀這張表。新增 `docs/scripts/combo.js`（由 `smoke.js` 呼叫）：目標 × 練習／正式 × 正確率／流暢性 × 玩法 × 作答方式，能選的組合都真的開始作答、答第一題，確認沒有程式錯誤也沒卡住（目前實際跑 24 種，其餘依設定畫面的限制略過）
- 想法或決定的變化：以後新增評量目標，先在 `GOAL_CAPS` 加一列；`play.js` 裡依目標分支的出題、記錄程式沒動（那是各目標自己的邏輯）
- 被改掉的舊說法原文：`HINT_UNFIT` 常數（現在是 `GOAL_CAPS` 各目標的 `hintUnfit`）；`GOALS` 裡 R5、R6 的 `practiceOnly:"只有練習"`（現在是 `formal:false, flu:false`）
