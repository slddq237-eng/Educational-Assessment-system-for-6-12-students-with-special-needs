# 檢查遮擋資料有沒有對上，並修正 ps 的來源
- 日期：2026-10-31
- 動到哪裡：`docs/scripts/check.js`、`docs/scripts/make_mask_fix.js`、`docs/materials/mask-fix.json`、`docs/design/parts-layers-impl.md`
- 改了什麼：(1) `check.js` 新增錯誤：`tools/literacy/mask-fix.js` 要和 `docs/materials/mask-fix.json` 產生的結果完全一樣，改了 json 或手改 js 卻沒重新產生就過不了；(2) 修正設計漏洞：每個字的「調整當時的第一層部件（ps）」改存在 json（由調整工具寫入），產生程式原樣照抄，不再用「現在」的第一層（否則老師改了拆法再重跑，舊調整會悄悄套到新拆法，防呆失效）；舊版工具下載的 json 沒有 ps 時，產生程式用現在的第一層補上並提醒；(3) 一次性把 338 個字的 ps 補進 json（調整當時的拆法＝現在的拆法，產生出的 `mask-fix.js` 沒有任何變化）
- 想法或決定的變化：合併多人調整結果先不做合併程式，分工（各組不重疊）加手動合併（維護者 2026-10-31 決定）
- 被改掉的舊說法原文：`make_mask_fix.js` 的 `ps` 取自 `Parts.read` 的「現在」第一層
