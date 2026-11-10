"""
產生「只有注音」的字型 shared/fonts/bpmf-only.woff2（docs/scripts/make_bpmf_only.py，2026-11-10 加，寫字評量 W1 看注音寫國字用）

為什麼：看注音寫國字要「只顯示注音、不顯示字」。But Ko 的「字嗨注音而已」（Bpmf Zihi Only）字型裡，每個漢字只畫它的注音
（直排、聲調和輕聲的位置都排好，和「字嗨注音標楷」字旁的注音同一套字形），破音字一樣用異體字選擇子選讀音，
所以 shared/bpmf.js 判斷出的讀音（Bpmf.text、BPMF_CH）直接套用。畫面上把要寫的字用這個字型顯示，左邊放預設的虛線方格
（2026-11-10 維護者決定：考卷的格子大小另外固定，所以不用「字嗨注音加框」的方框）。
只收錄課本生字（shared/lessons*.js 每課的 write、read）和它們的所有讀音，新增課本後要重新執行（和 make_bpmf.py 一起）。

需要：Python 3、fonttools、brotli（pip install fonttools brotli）、Node.js
需要先下載（不放進 repo）：bpmfvs 的 BpmfSpecial.zip，解壓縮後的 BpmfZihiOnly-R.ttf
  https://github.com/ButTaiwan/bpmfvs/releases/download/v1.500/BpmfSpecial.zip
授權：bpmfvs 注音 IVS 字型規格 Apache 2.0（zip 內 NOTICE.txt）；字型本身 zip 內的授權文件沒有單獨寫明，
  依同系列（字嗨注音標楷：漢字 CC BY 4.0、其餘 SIL OFL 1.1；這個字型只有注音、沒有漢字字形）判斷為 SIL OFL 1.1，
  見 docs/materials/data-sources.md（待作者確認）。
執行（在 repo 最上層）：
  python3 docs/scripts/make_bpmf_only.py <BpmfZihiOnly-R.ttf>
"""
import os, subprocess, sys
from fontTools import subset
from fontTools.ttLib import TTFont

SRC = sys.argv[1]
OUT = 'shared/fonts/bpmf-only.woff2'
JS = r'''
const src=require("./docs/scripts/lessons-src.js")();const o={};new Function(src+";this.B=BOOKS;").call(o);
const s=new Set();for(const b of Object.values(o.B))for(const L of Object.values(b.lessons))for(const c of (L.write||"")+(L.read||""))s.add(c);
process.stdout.write([...s].join(""));'''
chars = subprocess.run(['node', '-e', JS], capture_output=True, text=True, check=True).stdout

font = TTFont(SRC)
have = font.getBestCmap()
miss = [c for c in chars if ord(c) not in have]
opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = []; opts.drop_tables += ['vhea', 'vmtx', 'BASE']
sub = subset.Subsetter(opts)
sub.populate(unicodes=[ord(c) for c in chars] + list(range(0xE01E0, 0xE01F0)))   # 生字＋異體字選擇子（破音字的其他讀音）
sub.subset(font)
font.flavor = 'woff2'
font.save(OUT)
print(f'{OUT}：{len(chars)} 個字，{os.path.getsize(OUT)} bytes' + (f'；字型裡沒有的 {len(miss)} 個：{"".join(miss)}' if miss else ''))
