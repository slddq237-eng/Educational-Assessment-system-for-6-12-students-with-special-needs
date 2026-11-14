"""
把教育部筆順圖放進 shared/stroke/（docs/scripts/make_stroke.py，2026-11-12 加，直式生字練習簿的「筆順示範」用）

來源：教育部《國字標準字體筆順學習網》（https://stroke-order.learningweb.moe.edu.tw/）的全筆順圖（每個字一張 PNG，
  第 1 筆到最後一筆依序排成一欄；維護者從網站下載，zip 裡的檔名是「國字.png」）。
做法：zip 裡每一張圖都**原樣複製、不重新壓縮、不裁切、不上色**（保持原筆畫形狀，符合創用 CC 禁止改作；
  教育部 115 年 11 月回信同意，見 shared/stroke/README.md、docs/design/parts-strokes.md 第 3 節）。課本寫字生字（shared/lessons*.js 的 write）和不是課本的字都放
  （維護者 2026-11-12 決定：練習簿可以自己貼任何字）；zip 裡沒有的字（例如課本的「粄」）練習簿會顯示「沒有筆順圖」。
為什麼可以放進 repo：docs/scripts/check.js 的 ALLOW_IMAGE_DIRS 只放行 shared/stroke/ 裡的 .png（別的圖片仍然擋，防止學生照片）。
出處：關於我們（about.html）和 docs/materials/data-sources.md 都有列；練習簿頁面底部也印出處。

需要：Python 3、Node.js
執行（在 repo 最上層）：python3 -I docs/scripts/make_stroke.py 下載的zip路徑
  （zip 是別人給的檔案，只讀不執行；-I 是不讓 Python 去載入目前資料夾裡的程式）
教育部更新圖、或換新的 zip 時重新執行一次（已經有的字會覆蓋成同樣的檔案）。新增課本不用重跑，除非新課本有 zip 裡之前沒有的字。
"""
import json, os, subprocess, sys, zipfile

OUT = 'shared/stroke'
if len(sys.argv) != 2:
    sys.exit('用法：python3 -I docs/scripts/make_stroke.py 筆順圖.zip')

Z = zipfile.ZipFile(sys.argv[1])
names = {os.path.basename(n): n for n in Z.namelist() if n.lower().endswith('.png')}
os.makedirs(OUT, exist_ok=True)
got, bad = 0, []
for key in sorted(names):
    data = Z.read(names[key])
    if not data.startswith(b'\x89PNG') or len(os.path.splitext(key)[0]) != 1:   # 只收「一個字.png」
        bad.append(key); continue
    with open(os.path.join(OUT, key), 'wb') as f: f.write(data)   # 原樣寫出
    got += 1

# 課本寫字生字有沒有都在
JS = r'''
const src=require("./docs/scripts/lessons-src.js")();
const o={window:{}};new Function("window",src+";this.B=BOOKS;").call(o,o.window);
const s=new Set();for(const b of Object.values(o.B))for(const L of Object.values(b.lessons))for(const c of (L.write||"")) s.add(c);
process.stdout.write(JSON.stringify([...s]));'''
chars = json.loads(subprocess.run(['node', '-e', JS], capture_output=True, text=True, check=True).stdout)
miss = [c for c in chars if c + '.png' not in names]
print(f'{OUT}：{got} 個字（略過不是「一個字.png」的 {len(bad)} 個；課本寫字生字 {len(chars)} 個，zip 裡沒有的 {len(miss)} 個：{"".join(miss)}）')
