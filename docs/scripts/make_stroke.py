"""
把教育部筆順圖放進 tools/practice/stroke/（docs/scripts/make_stroke.py，2026-11-12 加，直式生字練習簿的「筆順示範」用）

來源：教育部《國字標準字體筆順學習網》（https://stroke-order.learningweb.moe.edu.tw/）的全筆順圖（每個字一張 PNG，
  第 1 筆到最後一筆依序排成一欄；維護者從網站下載，zip 裡的檔名是「國字.png」）。
做法：只挑課本寫字生字（shared/lessons*.js 的 write），**原樣複製、不重新壓縮、不裁切、不上色**（教育部的同意範圍是引用、不改作；
  維護者 2026-11-12 告知教育部回覆信同意筆順示範的引用）。zip 裡沒有的字（例如「粄」）不放，練習簿會顯示「沒有筆順圖」。
為什麼可以放進 repo：docs/scripts/check.js 的 ALLOW_IMAGE_DIRS 只放行 tools/practice/stroke/ 裡的 .png（別的圖片仍然擋，防止學生照片）。
出處：關於我們（about.html）和 docs/materials/data-sources.md 都有列；練習簿頁面底部也印出處。

需要：Python 3、Node.js
執行（在 repo 最上層）：python3 -I docs/scripts/make_stroke.py 下載的zip路徑
  （zip 是別人給的檔案，只讀不執行；-I 是不讓 Python 去載入目前資料夾裡的程式）
新增課本後重新執行一次（只會多放新字，已經有的字會覆蓋成同樣的檔案）。
"""
import json, os, subprocess, sys, zipfile

OUT = 'tools/practice/stroke'
if len(sys.argv) != 2:
    sys.exit('用法：python3 -I docs/scripts/make_stroke.py 筆順圖.zip')

JS = r'''
const src=require("./docs/scripts/lessons-src.js")();
const o={window:{}};new Function("window",src+";this.B=BOOKS;").call(o,o.window);
const s=new Set();for(const b of Object.values(o.B))for(const L of Object.values(b.lessons))for(const c of (L.write||"")) s.add(c);
process.stdout.write(JSON.stringify([...s]));'''
chars = json.loads(subprocess.run(['node', '-e', JS], capture_output=True, text=True, check=True).stdout)

z = zipfile.ZipFile(sys.argv[1])
names = {os.path.basename(n): n for n in z.namelist() if n.lower().endswith('.png')}
os.makedirs(OUT, exist_ok=True)
got, miss = 0, []
for c in chars:
    key = c + '.png'
    if key not in names: miss.append(c); continue
    data = z.read(names[key])
    if not data.startswith(b'\x89PNG'): miss.append(c); continue
    with open(os.path.join(OUT, key), 'wb') as f: f.write(data)   # 原樣寫出
    got += 1
print(f'{OUT}：{got} 個字（課本寫字生字共 {len(chars)} 個；zip 裡沒有的 {len(miss)} 個：{"".join(miss)}）')
