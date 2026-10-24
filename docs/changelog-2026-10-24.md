# 變更紀錄：2026-10-24 起

每一列是一個 PR（或一次想法的改變），從舊到新排。怎麼看、怎麼寫，見 `changelog.md`。

| 日期 | PR | 動到哪裡 | 改了什麼 | 想法或決定的變化 |
|---|---|---|---|---|
| 2026-10-24 | [#103](https://github.com/slddq237-eng/Educational-Assessment-system-for-6-12-students-with-special-needs/pull/103) | 專案簡介、文件 | 「GitHub 與 Claude code 新手使用說明」的資料夾地圖搬進根目錄 `README.md`（加網站網址）；`rules.md`「改完要更新哪些檔案」加一句改資料夾時更新地圖；新手說明那一段改成連結（**還沒合併**） | 地圖原本只在 claude.ai 文件，要分享才看得到、也容易忘記同步；搬進 repo，同一個 PR 就能一起改，新手說明只留連結 |
| 2026-10-24 | [#104](https://github.com/slddq237-eng/Educational-Assessment-system-for-6-12-students-with-special-needs/pull/104) | 文件 | `roadmap.md` 加 B9 玩法相容表、E5 加「貼紙夥伴打怪獸」的決定；`pending.md`「相關小組討論」加相容表內容、貼紙夥伴的兩個待決問題 | 「學生用貼紙角色互相對戰」改成「貼紙角色一起打怪獸」（合作，只在練習）；玩法、作答方式、主題的搭配規則要集中成一張相容表，先做相容表再做新玩法 |
| 2026-10-24 | [#106](https://github.com/slddq237-eng/Educational-Assessment-system-for-6-12-students-with-special-needs/pull/106) | 識字評量、共用貼紙、文件 | 貼紙扭蛋 PR1（資料基礎）：每張貼紙固定代號、收藏存代號、紀錄加 `rewardCode`；做完就先抽貼紙再送平板紀錄（修好平板「獎勵」欄空白）；平板不存收藏、匯入時收進貼紙簿；平板回傳第 2 版打包（每包 20 題）；「超稀有」改名「極稀有」；新增 `game-design.md` 記扭蛋、星等、進化、設定步驟與玩法設定表的決定 | 維護者和 Claude 討論後決定：結尾改成扭蛋機、四級星等、進化；平板只回報抽到什麼、老師匯入才更新收藏；玩法改成一般、遊戲、賓果，遊戲分對抗類、建築類；正式評量也用扭蛋 |
| 2026-10-24 | [#109](https://github.com/slddq237-eng/Educational-Assessment-system-for-6-12-students-with-special-needs/pull/109) | 文件 | `rules.md` 第 2 節加「合併前先用 Vercel 預覽測試」：怎麼看 PR 下的 vercel 留言、點 Preview 測試、測試資料和正式網站分開 | 原本合併前只靠自動檢查；接上 Vercel 後，改成合併前先在預覽網址實際操作一次 |
