# 遮擋位置調整工具的產生程式放進 docs/scripts
- 日期：2026-10-31
- 動到哪裡：`docs/scripts/make_mask_tool.js`（新）、`docs/scripts/mask-tool-template.txt`（新）、`docs/scripts/README.md`、`docs/design/parts-layers-impl.md`、`docs/code/architecture.md`、`.gitignore`（新）
- 改了什麼：把之前臨時做的「遮擋位置調整工具」變成可重複產生：`node docs/scripts/make_mask_tool.js` 載入真正的 `data.js`（預設位置、分組）、用全字庫正楷體畫字形圖、嵌入 `docs/materials/mask-fix.json` 當起始結果，輸出單機 HTML（約 6MB，已列入 `.gitignore`，不放進 repo）。產生時自我檢查每張字形圖上中下三段都有筆畫，避免再發生字下半截被切掉的問題。工具多了「重設為 repo 現有結果」按鈕；下載的結果每個字帶 `ps`（調整當時的第一層部件，對應 #207 的修正）和「基於版本」（從 repo 哪一版出發）；repo 的結果比這台電腦存的新時，工具顯示提醒並可以三方合併（只有我改→留我的、只有別人改→用新的、兩邊都改且不同＝衝突，先留我的並列出來）；「還原」改成回到 repo 現在的版本
- 想法或決定的變化：部件表（第一層拆法）改了，要重新產生工具（不然字形、分組是舊的）；夥伴分工時可以各自產生或由維護者傳檔案
- 被改掉的舊說法原文：`parts-layers-impl.md`：「工具不在 repo，需要時請 Claude 重新產生」
