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

2026-11-14 改用教育部筆畫資料（更準；老師反應有些字的比例不對，例如筆畫交疊的字）：
  教育部回信同意使用筆順資料（見 docs/materials/stroke-data.md），筆畫座標用 g0v zh-stroke-data（原始來源是教育部《國字標準字體筆順學習網》）。
  做法：每一筆畫成圖 → 用部件表第一層（Parts.layer(c, 1)）知道每個部件幾畫（部件是單獨的字就用它自己的筆畫數；偏旁如氵、亻沒有單獨的檔案，
  用「另一個部件有檔案」的字反推：清＝氵＋青，青 8 畫、清 11 畫，所以氵 3 畫；至少 2 個字、80% 以上結論一樣才採用；
  只有一個部件不知道時用總筆畫數減出來）→ 按書寫順序把筆畫分給各部件 → 找一條直線，讓「前面的部件跑到線後面的墨」和「後面的部件跑到線前面的墨」最少；
  有多個一樣好的位置取中間。這樣部件的筆畫連在一起、交疊的字也分得出來（舊方法只看空隙，量不到）。
  算不出來的字（沒有筆畫資料、部件對不上、前後部件的位置順序不符、分線離字邊不到 10%、最好的線還是切到超過 30% 的墨）**不確定，不收進 ruler.js**，
  網頁對沒有分線的字畫十字格，不畫字型尺（寧可不分，也不要分錯；維護者 2026-11-14 決定）。這些字的「候選」分線印在清單裡、可以產生對照圖（第 3 個參數）：
  先用「最細部件分組」（沒有第一層的字，用電腦自動拆法的最細部件分組、用筆畫驗證，見 leaf_cuts；綠線，標 LEAF，切到墨很少而且只有一種合理分法的標 LEAF+），
  沒有再用字型量的（橘線，標 FONT）。維護者看過畫面確認是對的字，加進 RULER_OK 才會收進去（怎麼揪錯見 docs/materials/ruler-review.md）。
  不使用 g0v 的 missing/ 資料夾（那是 g0v 自己變形組出的新字，不符合教育部回信的「不變形、不創造新字形」）。筆畫資料不放進 repo，只放算出來的分線。
  跟全字庫正楷體對照：教育部筆畫畫出來的字和全字庫正楷體平均重疊 96%，所以分線位置可以直接用在現在的字形尺。
  執行：python3 docs/scripts/make_ruler.py 筆畫資料夾（需要的筆畫檔會自動從 g0v 下載到這個資料夾，要能連網、有 curl）

需要：Python 3、fonttools、brotli、Pillow、numpy、scipy、Node.js、curl（pip install fonttools brotli pillow numpy scipy）
執行（在 repo 最上層）：python3 docs/scripts/make_ruler.py 筆畫資料夾 [對照圖資料夾]
  （不給筆畫資料夾就沒有確定的字，ruler.js 幾乎是空的；給對照圖資料夾會把「不確定的字」畫成對照圖 PNG，放在 repo 外面）
"""
import collections, glob, io, itertools, json, os, subprocess, sys
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
# 人工修正：自動算錯的字，直接寫分線在格子裡的位置（0～1，三分的字寫兩個）；寫 None 表示這個字不畫字型尺（十字格）
# 老師回報比例不對的字就加在這裡，重新執行一次。
RULER_FIX = {}
# 人工確認：沒有教育部筆畫可算、只有字型量的結果，維護者看過對照圖確認「分線是對的」的字（一個字串，例如 '案倒件'）；
# 沒有列在這裡的不確定字，不收進 ruler.js
RULER_OK = set('')

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

# 3. 用教育部筆畫資料（g0v zh-stroke-data）算分線（2026-11-14）：比「看字型的空隙」準，因為知道哪一筆屬於哪個部件，
#    部件的筆畫連在一起、交疊的字也分得出來。算不出來的字（沒有筆畫資料、部件對不上、切不開）照舊用上面字型量的結果。
PARTS = json.loads(subprocess.run(['node', '-e', r'''
const fs=require("fs");const src=require("./docs/scripts/lessons-src.js")();
const code=src+";"+["shared/parts.js","shared/parts-layers.js","shared/parts-api.js"].map(f=>fs.readFileSync(f,"utf8")).join(";")+";this.B=BOOKS;this.P=window.Parts;this.PA=PARTS_AUTO;";
const o={window:{}};new Function("window",code).call(o,o.window);
const out={};for(const b of Object.values(o.B))for(const L of Object.values(b.lessons))for(const c of (L.write||"")+(L.read||"")){const r=o.P.layer(c,1);out[c]=r?r.parts:null;}
process.stdout.write(JSON.stringify({layer1:out,auto:o.PA}));'''], capture_output=True, text=True, check=True).stdout)
AUTO = PARTS['auto']; PARTS = PARTS['layer1']   # AUTO：電腦自動拆法（最細的部件，照書寫順序）
STROKE_DIR = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('RULER_STROKE_DIR', '')
MAX_CROSS = .30      # 最好的直線還是切到超過 30% 的墨（部件對錯了，例如筆畫數對不上；部件本來就交疊的字最多 10～25%，看過畫面是對的），不用筆畫的結果
SSIZE = 512          # 筆畫畫成 512×512 的圖來算


def fetch_strokes(chars):
    """把需要的筆畫檔（json/Unicode 編碼.json）從 g0v zh-stroke-data 下載到 STROKE_DIR（已經有的不再下載；g0v 沒有的字略過）"""
    os.makedirs(STROKE_DIR, exist_ok=True)
    from concurrent.futures import ThreadPoolExecutor
    def one(ch):
        p = os.path.join(STROKE_DIR, f'{ord(ch):x}.json')
        if os.path.exists(p) or os.path.exists(p + '.none'): return
        r = subprocess.run(['curl', '-sS', '-f', '-m', '60', '-o', p, f'https://raw.githubusercontent.com/g0v/zh-stroke-data/master/json/{ord(ch):x}.json'], capture_output=True)
        if r.returncode != 0:
            if os.path.exists(p): os.remove(p)
            if r.returncode == 22: open(p + '.none', 'w').close()   # 404：g0v 沒有這個字
    with ThreadPoolExecutor(8) as ex: list(ex.map(one, chars))


_sc = {}
def load_strokes(ch):
    p = os.path.join(STROKE_DIR, f'{ord(ch):x}.json')
    if not os.path.exists(p): return None
    if ch not in _sc: _sc[ch] = json.load(open(p, encoding='utf-8'))
    return _sc[ch]


def stroke_count(ch):
    s = load_strokes(ch) if len(ch) == 1 else None
    return len(s) if s else None


def flatten(outline, steps=10):
    pts, cur = [], None
    for cmd in outline:
        if cmd['type'] in 'ML':
            cur = (cmd['x'], cmd['y']); pts.append(cur)
        else:   # Q：二次曲線，拆成短線段
            b = (cmd['begin']['x'], cmd['begin']['y']); e = (cmd['end']['x'], cmd['end']['y'])
            for i in range(1, steps + 1):
                u = i / steps
                pts.append(((1 - u) ** 2 * cur[0] + 2 * (1 - u) * u * b[0] + u * u * e[0], (1 - u) ** 2 * cur[1] + 2 * (1 - u) * u * b[1] + u * u * e[1]))
            cur = e
    return pts


def raster_strokes(strokes):
    """每一筆畫成一張遮罩；座標 0～2048，y 軸向下，和全字庫正楷體的畫法一致（平均重疊 96%）"""
    k = SSIZE / 2048
    out = []
    for s in strokes:
        im = Image.new('L', (SSIZE, SSIZE), 0)
        ImageDraw.Draw(im).polygon([(x * k, y * k) for x, y in flatten(s['outline'])], fill=255)
        out.append(np.array(im) > 127)
    return out


def best_cut(pa, pb):
    """A 在前（左／上）、B 在後；pa、pb 是兩組筆畫沿分割方向每一欄（列）的墨量。
       找一條直線，讓 A 跑到線後面、B 跑到線前面的墨最少；有好幾個一樣好時取中間。回傳（位置, 切到的墨占全部的比例）"""
    ca = np.concatenate([[0], np.cumsum(pa)]); cb = np.concatenate([[0], np.cumsum(pb)])
    cost = (ca[-1] - ca) + cb
    idx = np.nonzero(cost == cost.min())[0]
    return int(idx[len(idx) // 2]), cost.min() / max(1, ca[-1] + cb[-1])


def stroke_cuts(c, parts, axis, n, radical):
    """回傳 (分線們, 切到的墨最多的那條的比例, 方法) 或 (None, None, 失敗原因)"""
    st = load_strokes(c)
    if st is None: return None, None, '沒有筆畫資料'
    if not parts or len(parts) != n + 1: return None, None, '沒有對應的部件'
    N = len(st)
    known = [stroke_count(p) for p in parts]
    for i, p in enumerate(parts):          # 偏旁（氵、亻…）沒有單獨的檔案，用反推出來的筆畫數（見 radical_table）
        if known[i] is None and p in radical: known[i] = radical[p]
    unk = [i for i, k in enumerate(known) if k is None]
    if len(unk) == 1:
        rest = N - sum(k for k in known if k is not None)
        if rest < 1: return None, None, '部件筆畫數對不上'
        known[unk[0]] = rest
    elif unk or sum(known) != N:
        return None, None, '部件筆畫數對不上' if not unk else '兩個以上部件不知道幾畫'
    masks = raster_strokes(st)
    groups, i = [], 0
    for k in known:
        m = np.zeros_like(masks[0])
        for x in masks[i:i + k]: m |= x
        groups.append(m); i += k
    allm = np.zeros_like(masks[0])
    for g in groups: allm |= g
    ys, xs = np.nonzero(allm)
    a0, a1 = (xs.min(), xs.max() + 1) if axis == 'x' else (ys.min(), ys.max() + 1)
    pr = [g.sum(0 if axis == 'x' else 1) for g in groups]
    cen = [(p * np.arange(len(p))).sum() / p.sum() for p in pr]
    if any(cen[j] >= cen[j + 1] for j in range(n)): return None, None, '部件順序和位置不符'
    cuts, costs, fr = [], [], []
    for j in range(n):
        pos, cost = best_cut(pr[j], pr[j + 1])
        fr.append((pos - a0) / (a1 - a0))
        cuts.append(round(PAD + fr[-1] * (1 - 2 * PAD), 3)); costs.append(cost)
    # 分線太靠邊（離字的邊緣不到 10%）、或三分的字兩條線太近：表示其中一個部件根本沒有分出來（例如「失」的丿穿過整個字），不用
    if any(f < .10 or f > .90 for f in fr) or any(fr[j + 1] - fr[j] < .10 for j in range(n - 1)):
        return None, None, '分線太靠邊或太近（部件分不開）'
    return cuts, max(costs), 'ok'


def radical_table(todo):
    """偏旁沒有單獨的筆畫檔：用「另一個部件有檔案」的字反推（例如清＝氵＋青，青 8 畫、清 11 畫，所以氵 3 畫）；
       至少 2 個字、而且 80% 以上的字結論一樣才採用"""
    votes = {}
    for c, parts, axis, n in todo:
        st = load_strokes(c)
        if st is None or not parts or len(parts) != n + 1: continue
        known = [stroke_count(p) for p in parts]
        unk = [i for i, k in enumerate(known) if k is None]
        if len(unk) == 1:
            rest = len(st) - sum(k for k in known if k is not None)
            if rest >= 1: votes.setdefault(parts[unk[0]], collections.Counter())[rest] += 1
    table = {}
    for p, cnt in votes.items():
        (v, m), = cnt.most_common(1)
        if sum(cnt.values()) >= 2 and m / sum(cnt.values()) >= .8: table[p] = v
    return table


def leaf_cuts(c, axis, n, radical):
    """沒有第一層（部件表沒有、或有一塊打不出來／讀不出聲音）的字：用電腦自動拆法的「最細部件」（照書寫順序），
       試所有「切在最細部件之間」的分組方式，每一種用筆畫驗證（順序、分線不靠邊、切到的墨），挑切到墨最少的；
       回傳 (分線們, 切到的墨比例, 和第二名的差) 或 None。差越大越確定（只有一種合理分法）。
       驗證：拿有第一層的字（答案是用第一層筆畫數算的 1,524 字）來比，切到墨 ≤3% 而且和第二名差 ≥5% 的 1,393 字裡，分線差 ≤0.03 的佔 99.9%（只有「克」「攀」不同）。
       這些字沒有名字（部件表第一層要求每塊是可讀出聲音的字），只能當字型尺的分線，不能直接當第一層。"""
    leaves = AUTO.get(c, '').split()
    st = load_strokes(c)
    if st is None or len(leaves) < n + 1: return None
    counts = [stroke_count(x) if stroke_count(x) is not None else radical.get(x) for x in leaves]
    unk = [i for i, k in enumerate(counts) if k is None]
    N = len(st)
    if len(unk) == 1:
        rest = N - sum(k for k in counts if k is not None)
        if rest < 1: return None
        counts[unk[0]] = rest
    elif unk or sum(counts) != N: return None
    masks = raster_strokes(st)
    allm = np.zeros_like(masks[0])
    for m in masks: allm |= m
    ys, xs = np.nonzero(allm)
    a0, a1 = (xs.min(), xs.max() + 1) if axis == 'x' else (ys.min(), ys.max() + 1)
    found = []
    for cuts in itertools.combinations(range(1, len(leaves)), n):
        bounds = (0,) + cuts + (len(leaves),)
        known = [sum(counts[i:j]) for i, j in zip(bounds, bounds[1:])]
        groups, k0 = [], 0
        for k in known:
            m = np.zeros_like(masks[0])
            for x in masks[k0:k0 + k]: m |= x
            groups.append(m); k0 += k
        pr = [g.sum(0 if axis == 'x' else 1) for g in groups]
        if any(p.sum() == 0 for p in pr): continue
        cen = [(p * np.arange(len(p))).sum() / p.sum() for p in pr]
        if any(cen[j] >= cen[j + 1] for j in range(n)): continue
        costs, fr = [], []
        for j in range(n):
            pos, cost = best_cut(pr[j], pr[j + 1])
            costs.append(cost); fr.append((pos - a0) / (a1 - a0))
        if any(f < .10 or f > .90 for f in fr) or any(fr[j + 1] - fr[j] < .10 for j in range(n - 1)) or max(costs) > MAX_CROSS: continue
        found.append((max(costs), [round(PAD + f * (1 - 2 * PAD), 3) for f in fr]))
    if not found: return None
    found.sort(key=lambda x: x[0])
    return found[0][1], found[0][0], (found[1][0] - found[0][0]) if len(found) > 1 else 1.0


SCUTS, SINFO = {}, {'筆畫': 0}
SFAIL = collections.Counter(); SHIGH = []; SWHY = {}
if STROKE_DIR:
    todo = [(c, PARTS.get(c), SPLITS[s][0], SPLITS[s][1]) for c, s in STRUCT.items() if s in SPLITS]
    need = {c for c, parts, _, _ in todo} | {p for _, parts, _, _ in todo for p in (parts or []) if len(p) == 1}
    fetch_strokes(sorted(need))
    RADICAL = radical_table(todo)
    for c, parts, axis, n in todo:
        cuts, cost, how_ = stroke_cuts(c, parts, axis, n, RADICAL)
        if cuts is None: SFAIL[how_] += 1; SWHY[c] = how_
        elif cost > MAX_CROSS: SHIGH.append((c, round(cost * 100, 1))); SFAIL['切到太多墨（>30%）'] += 1; SWHY[c] = '切到太多墨（>30%）'
        else: SCUTS[c] = cuts; SINFO['筆畫'] += 1
    print(f'教育部筆畫（{STROKE_DIR}）：用筆畫算出 {len(SCUTS)} 個字；用不了的 {sum(SFAIL.values())} 個，原因：{dict(SFAIL)}；偏旁筆畫數反推 {len(RADICAL)} 個')
else:
    print('沒有指定筆畫資料資料夾（python3 docs/scripts/make_ruler.py 筆畫資料夾路徑）：全部照字型量的結果，比較不準')

out, skipped, how = dict(SCUTS), [], {'blob': 0, 'gap': 0}   # 先放教育部筆畫算出來的（確定）
CAND = {}   # 不確定的字：候選分線（最細部件分組算的，沒有就用字型量的；都不收進 ruler.js，要維護者確認）
CSRC, CLIKELY = {}, {}   # 候選是哪一種算的（leaf＝最細部件分組、font＝字型）、「可能對」
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
    if c in SCUTS: continue
    LC = leaf_cuts(c, SPLITS[s][0], SPLITS[s][1], RADICAL) if STROKE_DIR else None
    if LC and LC[1] <= .10:      # 最細部件分組：候選（綠線）；切到墨 ≤3% 而且和第二名差 ≥5% 的標「可能」，審的時候先看
        CAND[c] = LC[0]; CSRC[c] = 'leaf'; CLIKELY[c] = LC[1] <= .03 and LC[2] >= .05
        cuts = LC[0]
    else:
        CAND[c] = cuts; CSRC[c] = 'font'
    if cuts and c in RULER_OK: out[c] = cuts   # 維護者看過確認
    elif not cuts: skipped.append(c)
for c, v in RULER_FIX.items():
    if v: out[c] = v
    else: out.pop(c, None)
UNSURE = sorted(c for c, s in STRUCT.items() if s in SPLITS and c not in out)   # 不確定的字：網頁畫十字格

head = '''/* =========================================================
   字型尺分線位置表（自動產生，不要手改；新增課本後請 Claude 重新執行 docs/scripts/make_ruler.py）
   寫字考卷（tools/literacy/exam.js）的「字型尺提示」：左右、上下、左中右、上中下結構的字，分線照字的比例畫。
   數字是分線在格子裡的位置（0～1，左到右或上到下）。主要用教育部筆畫資料（2026-11-14，教育部《國字標準字體筆順學習網》，經 g0v zh-stroke-data 整理）
   算出每個部件的範圍。算不出來、不確定的字不收（網頁畫十字格，不畫字型尺）；不確定的字清單和怎麼揪錯見 docs/materials/ruler-review.md。
   ========================================================= */
'''
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(head + 'const RULER = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
total = sum(1 for c, s in STRUCT.items() if s in SPLITS)
why = collections.Counter(SWHY.get(c, '沒有筆畫資料') for c in UNSURE)
print(f'候選：最細部件分組 {sum(1 for c in UNSURE if CSRC.get(c) == "leaf")} 個（其中標 LEAF+ 的 {sum(1 for c in UNSURE if CLIKELY.get(c))}）、字型 {sum(1 for c in UNSURE if CSRC.get(c) == "font" and CAND.get(c))} 個、沒有候選 {sum(1 for c in UNSURE if not CAND.get(c))} 個')
print(f'{OUT}：{len(out)} 個字有分線（教育部筆畫 {SINFO["筆畫"]}、維護者確認 {sum(1 for c in out if c in RULER_OK)}）；左右、上下、左中右、上中下共 {total} 個，其中 {len(UNSURE)} 個不確定、不畫字型尺（原因：{dict(why)}）')
_by = collections.defaultdict(list)
for c in UNSURE: _by[SWHY.get(c, '沒有筆畫資料')].append(c)
for r_, cs_ in sorted(_by.items(), key=lambda kv: -len(kv[1])): print(f'不確定（{r_}，{len(cs_)} 個）：' + ''.join(cs_))

REASON_CODE = {'沒有對應的部件': 'A', '沒有筆畫資料': 'B', '兩個以上部件不知道幾畫': 'C', '部件筆畫數對不上': 'D', '分線太靠邊或太近（部件分不開）': 'E', '切到太多墨（>30%）': 'F'}
REVIEW_DIR = sys.argv[2] if len(sys.argv) > 2 else ''
if REVIEW_DIR:
    # 對照圖：每張 30 個字（6 欄 × 5 列）；橘線＝字型量的候選位置（不一定對），沒有候選的不畫線；字下面寫字、候選位置、不確定的原因
    os.makedirs(REVIEW_DIR, exist_ok=True)
    CELL, COLS, ROWS = 200, 6, 5
    print('對照圖的原因代號：' + '；'.join(f'{v} ＝ {k}' for k, v in REASON_CODE.items()))
    lab = ImageFont.load_default()
    ORDER = sorted(UNSURE, key=lambda c: (0 if CLIKELY.get(c) else 1 if CSRC.get(c) == 'leaf' else 2 if CAND.get(c) else 3, c))   # LEAF+ 先看（最可能對），再 LEAF、FONT、沒有候選
    for sheet in range(0, len(ORDER), COLS * ROWS):
        chunk = ORDER[sheet:sheet + COLS * ROWS]
        big = Image.new('RGB', (COLS * (CELL + 8) + 8, ROWS * (CELL + 36) + 8), (235, 235, 235))
        for k, c in enumerate(chunk):
            cell = Image.new('RGB', (CELL, CELL + 28), 'white'); dr = ImageDraw.Draw(cell)
            if c in fonts:
                g = Image.new('L', (SIZE, SIZE), 255)
                ImageDraw.Draw(g).text((SIZE / 2, SIZE / 2), c, font=fonts[c], fill=0, anchor='mm')
                bb = g.point(lambda v: 255 if v < 200 else 0).getbbox()
                if bb:
                    gl = g.crop(bb); sc = CELL * (1 - 2 * PAD) / max(gl.size)
                    gl = gl.resize((max(1, int(gl.width * sc)), max(1, int(gl.height * sc))))
                    cell.paste(gl, ((CELL - gl.width) // 2, (CELL - gl.height) // 2))
            axis = SPLITS[STRUCT[c]][0]
            for pos in (CAND.get(c) or []):
                q = int(pos * CELL)
                dr.line([(q, 0), (q, CELL)] if axis == 'x' else [(0, q), (CELL, q)], fill=(20, 150, 40) if CSRC.get(c) == 'leaf' else (240, 130, 0), width=2)
            dr.rectangle([0, 0, CELL - 1, CELL - 1], outline=(60, 60, 60))
            # 預設字型沒有中文，標籤只用數字和英文字母（編號、結構、原因代號、候選位置）；字另外縮小貼在標籤上
            st_ = {'左右': 'LR', '上下': 'TB', '左中右': 'LMR', '上中下': 'TMB'}[STRUCT[c]]
            code = REASON_CODE.get(SWHY.get(c, '沒有筆畫資料'), '?')
            dr.text((4, CELL + 3), f'{sheet + k + 1}.', fill=(0, 0, 0), font=lab)
            cand_ = ','.join(f'{float(x):.2f}' for x in (CAND.get(c) or [])) or 'none'
            dr.text((46, CELL + 3), f'{st_} {code} {"LEAF" + ("+" if CLIKELY.get(c) else "") if CSRC.get(c) == "leaf" else "FONT"} {cand_}', fill=(0, 0, 0), font=lab)
            if c in fonts and bb:
                sm = g.crop(bb); h_ = 20; sm = sm.resize((max(1, int(sm.width * h_ / sm.height)), h_)); cell.paste(sm, (22, CELL + 1))
            big.paste(cell, (8 + (k % COLS) * (CELL + 8), 8 + (k // COLS) * (CELL + 36)))
        big.save(os.path.join(REVIEW_DIR, f'ruler-review-{sheet // (COLS * ROWS) + 1:02d}.png'))
    print(f'對照圖：{REVIEW_DIR}（{(len(UNSURE) + COLS * ROWS - 1) // (COLS * ROWS)} 張）')
