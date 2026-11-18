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
  g0v 有幾個字的筆畫資料重複（懂 32 畫、慰 18 畫），外框位置一樣的筆畫只留一個（load_strokes）。
  不使用 g0v 的 missing/ 資料夾（那是 g0v 自己變形組出的新字，不符合教育部回信的「不變形、不創造新字形」）。g0v 整份筆畫資料不放進 repo；放進 repo 的是算出來的分線（shared/ruler.js）和部件筆畫外形（shared/stroke-parts.js，2026-11-16 起）。
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
const code=src+";"+["shared/parts.js","shared/parts-layers.js","shared/parts-api.js"].map(f=>fs.readFileSync(f,"utf8")).join(";")+";this.B=BOOKS;this.P=window.Parts;this.PL=PARTS_LAYERS;";
const o={window:{}};new Function("window",code).call(o,o.window);
const out={};for(const b of Object.values(o.B))for(const L of Object.values(b.lessons))for(const c of (L.write||"")+(L.read||""))out[c]=o.P.struct(c)||"";
for(const c of Object.keys(o.PL))out[c]=o.P.struct(c)||"";   /* 部件表裡不在課本的字也算（練習簿可以自己貼字，2026-11-16） */
process.stdout.write(JSON.stringify(out));'''
STRUCT = json.loads(subprocess.run(['node', '-e', JS], capture_output=True, text=True, check=True).stdout)
SPLITS = {'左右': ('x', 1), '左中右': ('x', 2), '上下': ('y', 1), '上中下': ('y', 2)}
# 人工修正：自動算錯的字，直接寫分線在格子裡的位置（0～1，三分的字寫兩個）；寫 None 表示這個字不畫字型尺（十字格）
# 老師回報比例不對的字就加在這裡，重新執行一次。
RULER_FIX = {}
# 人工確認：沒有教育部筆畫可算、只有字型量的結果，維護者看過對照圖確認「分線是對的」的字（一個字串，例如 '案倒件'）；
# 沒有列在這裡的不確定字，不收進 ruler.js
# 維護者指定的第一層每塊幾畫（部件名稱查不到筆畫數時用；例如憂＝前 12 畫｜夊 3 畫，2026-11-14；南…業是第三批、焉…齒是第四批）：{字: [第一塊畫數, 第二塊畫數, ...]}
PART_STROKES = {'從': [3, 8], '惠': [8, 4], '拜': [4, 5], '既': [5, 4], '書': [6, 4], '朗': [6, 4], '條': [3, 8], '歸': [10, 8], '段': [5, 4], '毒': [4, 4], '溼': [3, 10], '漫': [3, 12], '無': [8, 4], '留': [5, 5], '畫': [6, 5, 1], '當': [8, 5], '發': [5, 7], '監': [9, 5], '直': [2, 6], '竊': [5, 18], '競': [10, 10], '算': [11, 3], '纂': [11, 9], '臨': [6, 11], '華': [4, 8], '虧': [14, 3], '衡': [3, 10, 3], '表': [4, 4], '裳': [8, 6], '貌': [7, 7], '貴': [5, 7], '賞': [8, 7], '門': [4, 4], '鬥': [5, 5], '鹽': [19, 5], '黑': [8, 4], '齊': [10, 4], '龍': [9, 7], '乞': [2, 1], '亂': [12, 1], '侯': [2, 7], '免': [2, 5], '典': [6, 2], '前': [3, 6], '劉': [13, 2], '北': [3, 2], '印': [4, 2], '即': [5, 2], '商': [4, 7], '善': [9, 3], '單': [6, 6], '嚴': [6, 14], '壽': [3, 4, 7], '夜': [2, 6], '妻': [5, 3], '寬': [7, 8], '專': [8, 3], '尚': [3, 5], '師': [6, 4], '幻': [3, 1], '徊': [3, 6], '焉': [5, 6], '爭': [4, 4], '疊': [15, 7], '盡': [9, 5], '竹': [3, 3], '第': [6, 5], '舞': [8, 6], '製': [8, 7], '豐': [11, 7], '赤': [3, 4], '骨': [6, 4], '備': [2, 10], '器': [6, 4, 6], '帶': [5, 6], '歲': [4, 9], '班': [4, 2, 4], '畏': [5, 4], '薄': [4, 13], '象': [6, 6], '辨': [7, 2, 7], '長': [5, 3], '鬱': [14, 15], '齒': [4, 11], '南': [2, 7], '卷': [3, 5], '喪': [9, 3], '奉': [3, 5], '奧': [10, 3], '對': [11, 3], '慰': [11, 4], '懂': [3, 13], '拳': [4, 6], '望': [7, 4], '業': [5, 8], '憂': [12, 3], '晉': [6, 4], '毫': [5, 6], '牽': [7, 4], '益': [5, 5], '聖': [9, 4], '舉': [11, 6], '豪': [5, 9], '賓': [3, 11], '釜': [4, 6], '黃': [4, 8]}   # 憂是第一批、其餘是對照圖第二批（維護者 2026-11-14 指定「前 N 畫｜其餘」）
RULER_OK = set('乾佩侃冠制務參哭啟嘗噪堂墊幹弱德愣慚敢散敷旅旋族旗暴曹曾朝棄森款殺沿漢漸然率產磊穀穎簸素縣羈聚聰聽色莫蒜蟲解負責賴足那鐵鑿隙難霜青類飾黍黝亭修具夏害寒尋徵徽愛掌')   # 2026-11-14 維護者看過對照圖第 1～3 張確認「其他都可以」的字（80 個，不含另外指定拆法的 兩嫩候索里午寡帝憂旁）；其中有第一層的字用第一層算，沒有第一層的用「最細部件分組」的候選

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
const code=src+";"+["shared/parts.js","shared/parts-layers.js","shared/parts-api.js"].map(f=>fs.readFileSync(f,"utf8")).join(";")+";this.B=BOOKS;this.P=window.Parts;this.PA=PARTS_AUTO;this.PL=PARTS_LAYERS;";
const o={window:{}};new Function("window",code).call(o,o.window);
const out={};for(const b of Object.values(o.B))for(const L of Object.values(b.lessons))for(const c of (L.write||"")+(L.read||"")){const r=o.P.layer(c,1);out[c]=r?r.parts:null;}
for(const c of Object.keys(o.PL)){if(c in out)continue;const r=o.P.layer(c,1);out[c]=r?r.parts:null;}
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
    if ch not in _sc:
        st = json.load(open(p, encoding='utf-8'))
        seen, out = set(), []
        for s in st:          # g0v 有幾個字的筆畫資料重複了（例如懂 32 畫＝16 畫抄兩遍、慰 18 畫＝最後 3 畫重複）：外框位置一樣（座標差不到 8）的筆畫只留第一個
            xs = [p.get('x', p.get('end', {}).get('x')) for p in s['outline']]; ys = [p.get('y', p.get('end', {}).get('y')) for p in s['outline']]
            k = tuple(int(v // 8) for v in (min(xs), max(xs), min(ys), max(ys)))
            if k not in seen: seen.add(k); out.append(s)
        _sc[ch] = out
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


def piece_count(p, radical=None):
    """一塊部件幾畫：單一個字用它自己的筆畫數（偏旁用反推的）；[名稱] 部件（部件表第一層可以用名稱補，2026-11-14，例如「亻丨」）是每個字的筆畫數加起來；有一個不知道就回傳 None"""
    if len(p) == 1:
        n = stroke_count(p)
        return n if n is not None else (radical or {}).get(p)
    cs = [piece_count(x, radical) for x in p]
    return sum(cs) if all(k is not None for k in cs) else None


PSIZE, LEAFSIZE = {}, {}   # 字 → 各部件的筆畫數（stroke_cuts 算的、最細部件分組算的）


def stroke_cuts(c, parts, axis, n, radical):
    """回傳 (分線們, 切到的墨最多的那條的比例, 方法) 或 (None, None, 失敗原因)"""
    st = load_strokes(c)
    if st is None: return None, None, '沒有筆畫資料'
    if not parts or len(parts) != n + 1: return None, None, '沒有對應的部件'
    N = len(st)
    known = [piece_count(p, radical) for p in parts]   # 偏旁（氵、亻…）沒有單獨的檔案，用反推出來的筆畫數（見 radical_table）
    if c in PART_STROKES and len(PART_STROKES[c]) == len(parts) and sum(PART_STROKES[c]) == N: known = list(PART_STROKES[c])   # 維護者指定的優先
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
    PSIZE[c] = list(known)   # 每個部件幾畫（照書寫順序，第一個部件寫前幾筆…），給 shared/stroke-parts.js 用
    return cuts, max(costs), 'ok'


def radical_table(todo):
    """偏旁沒有單獨的筆畫檔：用「另一個部件有檔案」的字反推（例如清＝氵＋青，青 8 畫、清 11 畫，所以氵 3 畫）；
       至少 2 個字、而且 80% 以上的字結論一樣才採用"""
    votes = {}
    for c, parts, axis, n in todo:
        st = load_strokes(c)
        if st is None or not parts or len(parts) != n + 1: continue
        known = [piece_count(p) for p in parts]
        unk = [i for i, k in enumerate(known) if k is None]
        if len(unk) == 1 and len(parts[unk[0]]) == 1:    # 只反推單一個字的偏旁（[名稱] 部件不反推）
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
        found.append((max(costs), [round(PAD + f * (1 - 2 * PAD), 3) for f in fr], known))
    if not found: return None
    found.sort(key=lambda x: x[0])
    LEAFSIZE[c] = found[0][2]
    return found[0][1], found[0][0], (found[1][0] - found[0][0]) if len(found) > 1 else 1.0


# ---------- 包圍字（2026-11-17，先做左下包圍）：裡面那一塊的方框 ----------
# 外層（辶、走…）包住裡面那一塊：裡面是一個方框，貼著格子沒被外層佔住的邊。
# 左下包圍：外層在左邊和下面，裡面是右上角的方框 [左, 上, 寬, 高]（0～1，格子的比例；上＝0、右邊貼 1）。
# 外層和裡面誰先寫不一定（辶最後寫，走先寫）：兩種都試，挑「外層的墨掉進方框裡、裡面的墨掉到方框外」最少的。
SURR = {'左下包圍': ('l', 'b'), '左上包圍': ('l', 't'), '右上包圍': ('r', 't'), '上方包圍': ('l', 't', 'r'),
        '左方包圍': ('l', 't', 'b'), '下方包圍': ('l', 'b', 'r'), '全包圍': ('l', 't', 'r', 'b')}      # 結構 → 外層在哪幾邊（l 左、r 右、t 上、b 下）
SRECT, SRANGE, SORDER = {}, {}, {}   # 字 → 方框；字 → 各部件的筆畫範圍（部件表的順序）；字 → 各部件的書寫順位（0＝最先寫）
# 維護者指定的部件筆畫（可以不連續）：字 → [外層的筆畫範圍們, 裡面的筆畫範圍們]，範圍是（第幾畫起, 第幾畫止），從 0 算、止不含
# 載、戴、裁：「𢦏」＝第 1～3 畫（十）＋最後 3 畫（戈），中間是車／異／衣（維護者 2026-11-17 指定載；戴、裁照同一規則，待確認）
PART_RANGES = {'載': [[(0, 3), (10, 13)], [(3, 10)]], '戴': [[(0, 3), (14, 17)], [(3, 14)]], '裁': [[(0, 3), (9, 12)], [(3, 9)]],
               # 維護者 2026-11-18 指定（第幾畫從 1 算）：式＝弋 1、5～6 畫＋工 2～4 畫；可＝丁 1、5 畫＋口 2～4 畫；感＝1～2、11～13 畫＋3～10 畫；威＝1～2、7～9 畫＋3～6 畫；同＝1～2 畫＋3～6 畫
               '式': [[(0, 1), (4, 6)], [(1, 4)]], '可': [[(0, 1), (4, 5)], [(1, 4)]], '感': [[(0, 2), (10, 13)], [(2, 10)]], '威': [[(0, 2), (6, 9)], [(2, 6)]], '同': [[(0, 2)], [(2, 6)]],
               # 區：匸＝第 1 畫（上面的橫）＋第 11 畫（左邊的豎和下面的橫，最後才寫），中間第 2～10 畫是品（Claude 看筆畫編號圖指定，2026-11-18，待維護者確認）
               '區': [[(0, 1), (10, 11)], [(1, 10)]],
               # 維護者 2026-11-18 指定（包圍字清單 A 類）：向＝前 3 畫｜其餘；周＝前 5 畫｜其餘；與＝前 12 畫｜其餘〔第 13～14 畫是底下兩隻腳，不是外層，算出來放錯 18%，不收〕；鼎＝前 5 畫｜其餘（外層是後面的 6～13 畫）；囪＝第 1～3 畫＋第 7 畫｜第 4～6 畫
               '向': [[(0, 3)], [(3, 6)]], '周': [[(0, 5)], [(5, 8)]], '與': [[(0, 12)], [(12, 14)]], '鼎': [[(5, 13)], [(0, 5)]], '囪': [[(0, 3), (6, 7)], [(3, 6)]],
               # 維護者 2026-11-18 指定（包圍字清單 B、C 類）：鳳＝前 2 畫｜其餘；栽＝第 1～3 畫＋第 8～10 畫｜第 4～7 畫；屆＝前 3 畫｜第 4～8 畫；癌＝前 5 畫｜其餘；危＝前 4 畫｜其餘；厭＝前 2 畫｜其餘；迴＝前 5 畫（回，先寫）｜其餘（辶，後寫，所以辶是外層）；包＝前 2 畫｜其餘
               '鳳': [[(0, 2)], [(2, 14)]], '栽': [[(0, 3), (7, 10)], [(3, 7)]], '屆': [[(0, 3)], [(3, 8)]], '癌': [[(0, 5)], [(5, 17)]],
               '危': [[(0, 4)], [(4, 6)]], '厭': [[(0, 2)], [(2, 14)]], '迴': [[(5, 10)], [(0, 5)]], '包': [[(0, 2)], [(2, 5)]]}
SURR_COST_OVERRIDE = {'包': .15}   # 維護者指定過筆畫、方框看起來合理、但放錯的比例剛好超過門檻的字（包：巳的尾巴伸出勹外面，14%）
SURR_MAX_COST = .12                  # 最好的方框還是有超過 12% 的墨放錯邊：部件對錯了或不是這種包圍，不收


def surround_rect(c, parts, struct, radical):
    """回傳 (方框, 放錯的墨比例, 各部件的筆畫範圍, 各部件的書寫順位) 或 (None, 失敗原因, None, None)"""
    st = load_strokes(c)
    if st is None: return None, '沒有筆畫資料', None, None
    if not parts or len(parts) != 2: return None, '沒有對應的部件（要 2 塊：外層、裡面）', None, None
    N = len(st)
    known = [piece_count(p, radical) for p in parts]
    if c in PART_STROKES and len(PART_STROKES[c]) == 2 and sum(PART_STROKES[c]) == N: known = list(PART_STROKES[c])
    unk = [i for i, k in enumerate(known) if k is None]
    if len(unk) == 1: known[unk[0]] = N - sum(k for k in known if k is not None)
    if c in PART_RANGES: known = [1, 1]   # 維護者指定筆畫的字：不用部件筆畫數
    elif None in known or sum(known) != N or min(known) < 1: return None, '部件筆畫數對不上', None, None
    masks = raster_strokes(st)
    outer_n, inner_n = known                        # 部件表第一個是外層、第二個是裡面
    # 要試的分法：每個選項＝（外層的筆畫編號們, 裡面的筆畫編號們）；維護者指定的（PART_RANGES）只有一種
    if c not in PART_RANGES and struct == '全包圍' and parts[0] == '囗' and N >= 5:   # 囗：先寫豎和橫折（前 2 畫），裡面寫完最後才封口（最後 1 畫）
        og, ig = list(range(0, 2)) + [N - 1], list(range(2, N - 1)); options = [(og, ig)]
    elif c in PART_RANGES:
        og, ig = [[i for a, b in rg for i in range(a, b)] for rg in PART_RANGES[c]]
        if sorted(og + ig) != list(range(N)): return None, 'PART_RANGES 的筆畫沒有剛好分完', None, None
        options = [(og, ig)]
    else:
        options = [(list(range(0, outer_n)), list(range(outer_n, N))), (list(range(inner_n, N)), list(range(0, inner_n)))]
    sides = SURR[struct]                            # 外層在哪幾邊：這幾個邊界的位置可以動（方框貼著外層）；其他邊貼著字的外框
    best = None
    for o_idx, i_idx in options:
        outer_first = min(o_idx) < min(i_idx)
        om = np.zeros_like(masks[0]); im = np.zeros_like(masks[0])
        for i in o_idx: om |= masks[i]
        for i in i_idx: im |= masks[i]
        allm = om | im; ys, xs = np.nonzero(allm)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        # 用累計和很快算出每個方框的放錯量：外層的墨掉進方框裡 ＋ 裡面的墨掉到方框外
        oc = np.pad(np.cumsum(np.cumsum(om, 0), 1), ((1, 0), (1, 0))); ic = np.pad(np.cumsum(np.cumsum(im, 0), 1), ((1, 0), (1, 0)))
        def box(c_, xa, xb, ya, yb): return c_[yb, xb] - c_[ya, xb] - c_[yb, xa] + c_[ya, xa]   # xa 等可以是陣列
        tot_i = im.sum(); step = {1: 4, 2: 4, 3: 8, 4: 12}[len(sides)]   # 外層的邊越多，要找的邊界越多，格子放粗一點才算得快
        rng = {'l': range(x0, x1, step) if 'l' in sides else [x0], 't': range(y0, y1, step) if 't' in sides else [y0],
               'r': range(x0 + step, x1 + 1, step) if 'r' in sides else [x1], 'b': range(y0 + step, y1 + 1, step) if 'b' in sides else [y1]}
        XL, YT, XR, YB = np.meshgrid(np.array(rng['l']), np.array(rng['t']), np.array(rng['r']), np.array(rng['b']), indexing='ij')
        bad = box(oc, XL, XR, YT, YB) + (tot_i - box(ic, XL, XR, YT, YB))   # 每一種方框的放錯量，一次算完
        bad = np.where((XR > XL) & (YB > YT), bad, np.iinfo(np.int64).max)
        k_ = int(np.argmin(bad)); ij = np.unravel_index(k_, bad.shape)    # 並列時取迴圈最前面那個（和原本的巢狀迴圈一樣）
        res = (int(bad[ij]), int(XL[ij]), int(YT[ij]), int(XR[ij]), int(YB[ij]))
        cost = res[0] / max(1, allm.sum()); _, xl, yt, xr, yb = res
        # 換成格子的比例：字的外框長邊對到 88%、置中（和練習簿放字的方式一樣，shared/ruler-cell.js 的格子）；沒有外層的那幾邊貼著格子邊（0 或 1）
        k = .88 / max(x1 - x0, y1 - y0); cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        mx = lambda v: min(1, max(0, .5 + (v - cx) * k)); my = lambda v: min(1, max(0, .5 + (v - cy) * k))
        L = mx(xl) if 'l' in sides else 0; T = my(yt) if 't' in sides else 0
        R = mx(xr) if 'r' in sides else 1; B = my(yb) if 'b' in sides else 1
        cand = (cost, [round(L, 3), round(T, 3), round(R - L, 3), round(B - T, 3)], outer_first, o_idx, i_idx)
        if best is None or cand[0] < best[0]: best = cand
    cost, rect, outer_first = best[0], best[1], best[2]
    if cost > SURR_COST_OVERRIDE.get(c, SURR_MAX_COST): return None, f'放錯的墨太多（{cost * 100:.0f}%）', None, None
    L_, T_, W_, H_ = rect                            # 外層包住的每一邊，方框離格子邊至少 8%，不然外層其實沒有包住那一邊（例如感、威：戈的撇穿過整個字）
    if ('l' in sides and L_ < .08) or ('t' in sides and T_ < .08) or ('r' in sides and L_ + W_ > .92) or ('b' in sides and T_ + H_ > .92):
        return None, '外層沒有包住這一邊（方框貼著格子邊）', None, None
    og, ig = best[3], best[4]
    order = [0, 1] if min(og) < min(ig) else [1, 0]
    return rect, cost, [og, ig], order


SCUTS, SINFO = {}, {'筆畫': 0}
SFAIL = collections.Counter(); SHIGH = []; SWHY = {}
if STROKE_DIR:
    todo = [(c, PARTS.get(c), SPLITS[s][0], SPLITS[s][1]) for c, s in STRUCT.items() if s in SPLITS]
    need = {c for c, parts, _, _ in todo} | {p for _, parts, _, _ in todo for p in (parts or []) if len(p) == 1}
    fetch_strokes(sorted(need))
    todo_s = [(c, PARTS.get(c), None, 1) for c, s in STRUCT.items() if s in SURR]
    fetch_strokes(sorted({c for c, parts, _, _ in todo_s} | {p for _, parts, _, _ in todo_s for p in (parts or []) if len(p) == 1}))
    RADICAL = radical_table(todo)
    RADICAL_S = radical_table(todo + todo_s)   # 包圍字（辶、走…）另外一張偏旁表，不影響原本左右、上下的字
    for c, parts, axis, n in todo:
        cuts, cost, how_ = stroke_cuts(c, parts, axis, n, RADICAL)
        if cuts is None: SFAIL[how_] += 1; SWHY[c] = how_
        elif cost > MAX_CROSS: SHIGH.append((c, round(cost * 100, 1))); SFAIL['切到太多墨（>30%）'] += 1; SWHY[c] = '切到太多墨（>30%）'
        else: SCUTS[c] = cuts; SINFO['筆畫'] += 1
    SSKIP = {}
    for c, parts, _, _ in todo_s:
        rect, cost, rng, order = surround_rect(c, parts, STRUCT[c], RADICAL_S)
        if rect is None: SSKIP[c] = cost
        else: SRECT[c] = rect; SRANGE[c] = rng; SORDER[c] = order
    print(f'包圍字（{"、".join(SURR)}）：用筆畫算出 {len(SRECT)} 個字的方框；用不了的 {len(SSKIP)} 個：' + '、'.join(f'{c}（{w}）' for c, w in SSKIP.items()))
    print(f'教育部筆畫（{STROKE_DIR}）：用筆畫算出 {len(SCUTS)} 個字；用不了的 {sum(SFAIL.values())} 個，原因：{dict(SFAIL)}；偏旁筆畫數反推 {len(RADICAL)} 個')
else:
    print('沒有指定筆畫資料資料夾（python3 docs/scripts/make_ruler.py 筆畫資料夾路徑）：全部照字型量的結果，比較不準')

out, skipped, how = dict(SCUTS), [], {'blob': 0, 'gap': 0}   # 先放教育部筆畫算出來的（確定）
out.update(SRECT)   # 包圍字：裡面那一塊的方框 [左, 上, 寬, 高]
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


# ---------- shared/stroke-parts.js：依筆畫褪除用的資料（2026-11-16，維護者決定 g0v 資料可以放進 repo）----------
# 每個字：b＝全部筆畫的外框 [x0,y0,x1,y1]（座標 0～512，y 向下）、p＝每個部件的筆畫外形（SVG 路徑，筆畫外形原樣，沒有變形）。
# 部件的筆畫數：字形尺分線用的那組（教育部筆畫、維護者指定、或維護者確認的最細部件分組）。
QU = 4   # 座標用 1/4 精度（0～512）：格子 2 公分時差不到 0.04 公釐，肉眼看不出來；檔案小很多


def stroke_path(st):
    """每一筆的外框轉成 SVG 路徑：M 起點（絕對座標）、之後用相對座標的 l、q（只有數字，沒有逗號），一筆畫完用 z 封口"""
    d = []
    q = lambda v: round(v / QU)
    for s_ in st:
        cx = cy = 0
        for cmd in s_['outline']:
            if cmd['type'] == 'M':
                cx, cy = q(cmd['x']), q(cmd['y']); d.append(f"M{cx} {cy}")
            elif cmd['type'] == 'L':
                x, y = q(cmd['x']), q(cmd['y']); d.append(f"l{x - cx} {y - cy}"); cx, cy = x, y
            else:
                bx, by, ex, ey = q(cmd['begin']['x']), q(cmd['begin']['y']), q(cmd['end']['x']), q(cmd['end']['y'])
                d.append(f"q{bx - cx} {by - cy} {ex - cx} {ey - cy}"); cx, cy = ex, ey
        d.append('z')
    return ''.join(d).replace(' -', '-')



if STROKE_DIR:
    SP_OUT = 'shared/stroke-parts.js'
    sp_data, sp_skip = {}, []
    for c in sorted(out):
        st = load_strokes(c)
        if c in SRECT:   # 包圍字：部件表順序（外層、裡面）；o＝各部件的書寫順位（0＝最先寫），褪除要照書寫順序
            pts = [pt for s_ in st for pt in flatten(s_['outline'], 2)]
            xs_, ys_ = [x for x, _ in pts], [y for _, y in pts]
            sp_data[c] = {'b': [round(min(xs_) / QU), round(min(ys_) / QU), round(max(xs_) / QU), round(max(ys_) / QU)],
                          'p': [stroke_path([st[i] for i in g]) for g in SRANGE[c]], 'o': SORDER[c]}
            continue
        sizes = PSIZE.get(c) if c in SCUTS else (LEAFSIZE.get(c) if c in RULER_OK else None)
        if c in PART_STROKES and st and sum(PART_STROKES[c]) == len(st): sizes = list(PART_STROKES[c])
        if not sizes or not st or sum(sizes) != len(st): sp_skip.append(c); continue
        pts = [pt for s_ in st for pt in flatten(s_['outline'], 2)]
        xs_, ys_ = [x for x, _ in pts], [y for _, y in pts]
        groups, i0 = [], 0
        for k in sizes: groups.append(stroke_path(st[i0:i0 + k])); i0 += k
        sp_data[c] = {'b': [round(min(xs_) / QU), round(min(ys_) / QU), round(max(xs_) / QU), round(max(ys_) / QU)], 'p': groups}
    sp_head = '''/* =========================================================
   依筆畫褪除用的部件筆畫外形（自動產生，不要手改；重新產生：python3 docs/scripts/make_ruler.py 筆畫資料夾）
   每個字：b＝全部筆畫的外框 [左,上,右,下]（座標 0～512，y 向下）、p＝每個部件的筆畫外形（SVG 路徑，照書寫順序，第一個部件在前）。
   來源：教育部《國字標準字體筆順學習網》的筆畫，經 g0v zh-stroke-data 轉成座標；筆畫外形原樣，沒有變形、沒有新造字形
   （授權與出處見 docs/materials/stroke-data.md、shared/stroke/README.md）。只放字形尺有分線、而且部件筆畫數確定的字；練習簿的部件褪除用。
   ========================================================= */
'''
    with open(SP_OUT, 'w', encoding='utf-8') as f:
        f.write(sp_head + 'const STROKE_PARTS = ' + json.dumps(sp_data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'{SP_OUT}：{len(sp_data)} 個字（{os.path.getsize(SP_OUT) / 1e6:.1f} MB）；有分線但部件筆畫數不明、沒收的 {len(sp_skip)} 個：' + ''.join(sp_skip))
