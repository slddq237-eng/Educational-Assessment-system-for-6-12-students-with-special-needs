"""
產生字型尺分線位置表 shared/ruler.js（docs/scripts/make_ruler.py，2026-11-10 加，寫字考卷的「字型尺提示」用）

為什麼：字型尺原本左右、上下都從格子正中間分；維護者 2026-11-10 要求照字的比例畫（例如「晴」左邊的日比較窄）。
做法：用網站本來就用的全字庫正楷體（shared/fonts/tw-kai-*.woff2，政府資料開放授權條款第 1 版，可以做衍生資料，要標出處）
  把每個課本生字畫成 256×256 的灰階圖，量出筆畫的範圍（字的外框）：
  1. 先找出每一塊相連的筆畫（連通區塊），沿著分割方向分成兩群（三分的字分三群），選兩群之間空隙最大的分法，分線畫在兩群中間；
     每一群至少要有全部筆畫的 12%（避免把一個點當成一個部件）。部件之間沒有相連的字這樣最準（例如「現」＝王＋見）。
  2. 部件的筆畫連在一起分不開時（只用在左右、上下；三分的字找空隙常常量錯，照平均三等分），改成沿著分割的方向數每一欄（或每一列）有多少筆畫：
     在字寬的 22%～78% 之間（三分的字各找兩段）找筆畫最少、而且最寬的那一段空隙，空隙中間就是分線。
  空隙裡的筆畫量不到最多那一欄的 12% 才算明顯空隙；12%～30%（筆畫有點交疊）只有分線落在中段（30%～70%）才收，其他照樣從正中間分。
  分線位置換算成格子的比例（0～1；學生寫字會寫滿格子，所以把字的外框對到格子的 6%～94%）。
  只處理結構是「左右、上下、左中右、上中下」的字（結構照 shared/parts-api.js 的 Parts.struct）；
  找不到明顯空隙（筆畫交疊）的字不收，網頁照樣從正中間分。包圍類的字照網頁內建的比例，不在這張表。
只收錄課本生字，新增課本後要重新執行（在 make_kai.py 之後，字型才有新字）。

需要：Python 3、fonttools、brotli、Pillow、numpy、scipy、Node.js（pip install fonttools brotli pillow numpy scipy）
執行（在 repo 最上層）：python3 docs/scripts/make_ruler.py
"""
import glob, io, json, subprocess
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

OUT = 'shared/ruler.js'
SIZE = 256
PAD = .06   # 字的外框對到格子的 6%～94%

# 1. 課本生字和它們的結構（用 Node 執行網頁同一份資料）
JS = r'''
const fs=require("fs");const src=require("./docs/scripts/lessons-src.js")();
const code=src+";"+["shared/parts.js","shared/parts-layers.js","shared/parts-api.js"].map(f=>fs.readFileSync(f,"utf8")).join(";")+";this.B=BOOKS;this.P=window.Parts;";
const o={window:{}};new Function("window",code).call(o,o.window);
const out={};for(const b of Object.values(o.B))for(const L of Object.values(b.lessons))for(const c of (L.write||"")+(L.read||""))out[c]=o.P.struct(c)||"";
process.stdout.write(JSON.stringify(out));'''
STRUCT = json.loads(subprocess.run(['node', '-e', JS], capture_output=True, text=True, check=True).stdout)
SPLITS = {'左右': ('x', 1), '左中右': ('x', 2), '上下': ('y', 1), '上中下': ('y', 2)}
# 人工修正：自動量錯的字（例如「否」量到「不」的中間），直接寫分線在格子裡的位置（0～1）；寫 None 表示照正中間分。
# 老師回報量錯的字就加在這裡，重新執行一次。
RULER_FIX = {}

# 2. 楷書字型：每個字在哪一個字型檔
fonts = {}
for path in sorted(glob.glob('shared/fonts/tw-kai-*.woff2')):
    f = TTFont(path)
    buf = io.BytesIO(); f.flavor = None; f.save(buf)
    pil = ImageFont.truetype(io.BytesIO(buf.getvalue()), int(SIZE * .8))
    for cp in f.getBestCmap(): fonts.setdefault(chr(cp), pil)

def profile(img, axis):
    w, h = img.size; px = img.load()
    if axis == 'x': return [sum(255 - px[x, y] for y in range(h)) for x in range(w)]
    return [sum(255 - px[x, y] for x in range(w)) for y in range(h)]

def find_gap(prof, lo, hi):
    """lo～hi 之間筆畫最少的那一段：回傳（中間位置, 那一段的筆畫量占最大值的比例）"""
    seg = prof[lo:hi]
    if not seg: return None
    m = min(seg); tol = m + max(prof) * .02
    best, run, start = None, 0, None
    for i, v in enumerate(seg + [float('inf')]):
        if v <= tol:
            if start is None: start = i
        elif start is not None:
            if best is None or i - start > best[1] - best[0]: best = (start, i)
            start = None
    if not best: return None
    return (lo + (best[0] + best[1] - 1) / 2, m / (max(prof) or 1))

import numpy as np
from scipy import ndimage

def blob_cuts(ink, axis, n):
    """把字裡每一塊相連的筆畫（連通區塊）沿著分割方向排好，分成 n+1 群；分線畫在兩群之間（左群的最右邊和右群的最左邊的中間）。
       選「兩群之間空隙最大」的分法，每一群至少要有全部筆畫的 12%；分不出來回傳 None"""
    lab, k = ndimage.label(ink, structure=np.ones((3, 3)))
    if k < n + 1: return None
    idx = 1 if axis == 'x' else 0   # x：欄（第 2 維），y：列（第 1 維）
    blobs = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        m = lab[sl] == i; cnt = int(m.sum())
        coords = np.nonzero(lab == i)[idx]
        blobs.append((float(coords.mean()), int(sl[idx].start), int(sl[idx].stop), cnt))
    blobs.sort()
    total = sum(b[3] for b in blobs)
    best = None
    def groups_ok(gs): return all(sum(b[3] for b in g) >= total * .12 for g in gs)
    import itertools
    for cut in itertools.combinations(range(1, len(blobs)), n):
        gs = [blobs[i:j] for i, j in zip((0,) + cut, cut + (len(blobs),))]
        if not groups_ok(gs): continue
        gaps = [(min(b[1] for b in gs[t + 1]) - max(b[2] for b in gs[t]), (max(b[2] for b in gs[t]) + min(b[1] for b in gs[t + 1])) / 2) for t in range(n)]
        score = min(g[0] for g in gaps)
        if best is None or score > best[0]: best = (score, [g[1] for g in gaps])
    return best

out, skipped, how = {}, [], {'blob': 0, 'gap': 0}
for c, s in sorted(STRUCT.items()):
    if s not in SPLITS or c not in fonts: continue
    axis, n = SPLITS[s]
    img = Image.new('L', (SIZE, SIZE), 255)
    ImageDraw.Draw(img).text((SIZE / 2, SIZE / 2), c, font=fonts[c], fill=0, anchor='mm')
    box = img.point(lambda v: 255 if v < 200 else 0).getbbox()   # 字的外框（筆畫的範圍，忽略很淡的邊）
    if not box: continue
    x0, y0, x1, y1 = box
    a0, a1 = (x0, x1) if axis == 'x' else (y0, y1)
    L = a1 - a0
    cuts = None
    # 1. 先用連通區塊分群（部件之間沒有相連的字最準，例如「現」＝王＋見，不會被「見」下面兩隻腳中間的空白騙到）
    ink = np.array(img) < 128
    bc = blob_cuts(ink, axis, n)
    if bc and bc[0] >= -2:   # 兩群之間沒有重疊（容許 2 像素）
        pos = [(v - a0) / L for v in bc[1]]
        segs = [b - a for a, b in zip([0] + pos, pos + [1])]
        if all(.12 <= p <= .88 for p in pos) and min(segs) >= (.18 if n == 2 else .12): cuts = pos; how['blob'] += 1   # 三分的字每一塊至少 18% 寬
    # 2. 部件相連（筆畫連在一起分不開）時，改找筆畫最少的空隙；三分的字（左中右、上中下）找空隙常常量錯，不用這個方法，照平均三等分
    if cuts is None and n == 1:
        prof = profile(img, axis)
        ranges = [(.22, .78)] if n == 1 else [(.15, .5), (.5, .85)]
        cuts = []
        for r0, r1 in ranges:
            g = find_gap(prof, int(a0 + L * r0), int(a0 + L * r1))
            if not g: cuts = None; break
            pos = (g[0] - a0) / L
            mid = (.3, .7) if n == 1 else ((.2, .45) if r0 < .5 else (.55, .8))
            if g[1] > .3 or (g[1] > .12 and not mid[0] <= pos <= mid[1]): cuts = None; break
            cuts.append(pos)
        if cuts: how['gap'] += 1
    if cuts: cuts = [round(PAD + p * (1 - 2 * PAD), 3) for p in cuts]
    if c in RULER_FIX: cuts = RULER_FIX[c]
    if cuts: out[c] = cuts
    else: skipped.append(c)

head = '''/* =========================================================
   字型尺分線位置表（自動產生，不要手改；新增課本後請 Claude 重新執行 docs/scripts/make_ruler.py）
   寫字考卷（tools/literacy/exam.js）的「字型尺提示」：左右、上下、左中右、上中下結構的字，分線照字的比例畫。
   數字是分線在格子裡的位置（0～1，左到右或上到下）。從全字庫正楷體（政府資料開放授權條款第 1 版）量出來；
   沒有收的字（筆畫交疊找不到空隙）網頁照樣從正中間分。
   ========================================================= */
'''
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(head + 'const RULER = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
total = sum(1 for c, s in STRUCT.items() if s in SPLITS)
print(f'{OUT}：{len(out)} 個字（連通區塊分群 {how["blob"]}、找空隙 {how["gap"]}；左右、上下、左中右、上中下共 {total} 個；找不到空隙改用正中間的 {len(skipped)} 個，例如 {"".join(skipped[:20])}）')
