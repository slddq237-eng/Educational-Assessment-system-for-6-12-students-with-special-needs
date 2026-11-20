"""
產生「每一畫有編號」的筆畫對照圖（docs/scripts/make_stroke_numbers.py，2026-11-20 從暫時腳本整理進 repo）

用途：包圍字、交疊字、部件分不開的字，要請維護者指定「外層是第幾畫、裡面是第幾畫」（可以不連續）時，
  給維護者看這種圖，維護者用「字：外層第幾畫、裡面第幾畫」回覆；Claude 再填進 make_ruler.py 的 PART_RANGES／PART_STROKES。
圖長什麼樣：每個字一格，每一畫用顏色由藍（第 1 畫）漸變到紅（最後一畫），畫的中心標編號（白底小圈，看得清楚）；
  格子下面寫字和總畫數。編號是教育部筆畫的書寫順序（g0v zh-stroke-data；g0v 重複抄兩遍的筆畫會先去掉，做法和 make_ruler.py 的 load_strokes 一樣）。
筆畫資料：和 make_ruler.py 用同一個資料夾（需要的筆畫檔會自動從 g0v 下載進去；資料夾不要放進 repo）。g0v 沒有的字略過並印出來。
文字用文泉驛正黑（/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc）；楷書字型只有課本字，不能拿來畫標籤。
輸出：輸出資料夾裡的 stroke-numbers-01.png、02.png…（預設每張 4 欄 × 3 列 = 12 個字，一張在對話裡看得清楚；--cols、--rows 可以改）。
執行（repo 最上層；字可以用字串，或用 @檔案 讀一個文字檔，檔案裡的非漢字會略過）：
  python3 -I docs/scripts/make_stroke_numbers.py 筆畫資料夾 輸出資料夾 烏馬司幾 [--cols 4] [--rows 3] [--cell 360]
需要：Pillow（pip install pillow）。
"""
import sys, os, json, subprocess, colorsys, argparse
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
URL = 'https://raw.githubusercontent.com/g0v/zh-stroke-data/master/json/{:x}.json'
COORD = 2048   # g0v 座標 0～2048，y 向下


def fetch(stroke_dir, chars):
    """沒有的筆畫檔從 g0v 下載（404 的記成 .none，下次不再試）"""
    os.makedirs(stroke_dir, exist_ok=True)
    from concurrent.futures import ThreadPoolExecutor
    def one(ch):
        p = os.path.join(stroke_dir, f'{ord(ch):x}.json')
        if os.path.exists(p) or os.path.exists(p + '.none'): return
        r = subprocess.run(['curl', '-sS', '-f', '-m', '60', '-o', p, URL.format(ord(ch))], capture_output=True)
        if r.returncode != 0:
            if os.path.exists(p): os.remove(p)
            if r.returncode == 22: open(p + '.none', 'w').close()
    with ThreadPoolExecutor(8) as ex: list(ex.map(one, chars))


def load_strokes(stroke_dir, ch):
    p = os.path.join(stroke_dir, f'{ord(ch):x}.json')
    if not os.path.exists(p): return None
    seen, out = set(), []
    for s in json.load(open(p, encoding='utf-8')):   # 去掉 g0v 重複的筆畫（外框位置差不到 8 的）；和 make_ruler.py 的 load_strokes 一樣
        xs = [q.get('x', q.get('end', {}).get('x')) for q in s['outline']]; ys = [q.get('y', q.get('end', {}).get('y')) for q in s['outline']]
        k = tuple(int(v // 8) for v in (min(xs), max(xs), min(ys), max(ys)))
        if k not in seen: seen.add(k); out.append(s)
    return out


def flatten(outline, steps=10):
    pts, cur = [], None
    for cmd in outline:
        if cmd['type'] in 'ML':
            cur = (cmd['x'], cmd['y']); pts.append(cur)
        else:   # Q：二次曲線拆成短線段
            b = (cmd['begin']['x'], cmd['begin']['y']); e = (cmd['end']['x'], cmd['end']['y'])
            for i in range(1, steps + 1):
                u = i / steps
                pts.append(((1 - u) ** 2 * cur[0] + 2 * (1 - u) * u * b[0] + u * u * e[0], (1 - u) ** 2 * cur[1] + 2 * (1 - u) * u * b[1] + u * u * e[1]))
            cur = e
    return pts


def color(i, n):
    """第 1 畫藍、最後一畫紅（色相 240° → 0°）"""
    h = (240 - 240 * (i / max(1, n - 1))) / 360
    r, g, b = colorsys.hsv_to_rgb(h, .85, .85)
    return int(r * 255), int(g * 255), int(b * 255)


def draw_cell(strokes, size, font):
    im = Image.new('RGB', (size, size), 'white'); dr = ImageDraw.Draw(im)
    pad = size * .05; k = (size - 2 * pad) / COORD
    n = len(strokes); labels = []
    for i, s in enumerate(strokes):
        pts = [(pad + x * k, pad + y * k) for x, y in flatten(s['outline'])]
        dr.polygon(pts, fill=color(i, n))
        # 編號放在這一筆的中心（外框中心；筆畫彎的時候用最靠近中心的點，免得標在筆畫外面）
        cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2; cy = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2
        labels.append((i + 1, min(pts, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2)))
    for num, (x, y) in labels:
        t = str(num); w = dr.textlength(t, font=font); r = font.size * .62
        dr.ellipse([x - r, y - r, x + r, y + r], fill='white', outline=(60, 60, 60))
        dr.text((x - w / 2, y), t, fill=(0, 0, 0), font=font, anchor='lm')
    dr.rectangle([0, 0, size - 1, size - 1], outline=(150, 150, 150))
    return im


def main():
    ap = argparse.ArgumentParser(description='每一畫有編號的筆畫對照圖')
    ap.add_argument('stroke_dir'); ap.add_argument('out_dir'); ap.add_argument('chars', help='字串，或 @檔案')
    ap.add_argument('--cols', type=int, default=4); ap.add_argument('--rows', type=int, default=3); ap.add_argument('--cell', type=int, default=360)
    a = ap.parse_args()
    text = open(a.chars[1:], encoding='utf-8').read() if a.chars.startswith('@') else a.chars
    chars = []
    for ch in text:
        if '㐀' <= ch <= '鿿' or '\U00020000' <= ch <= '\U0002ffff':
            if ch not in chars: chars.append(ch)
    if not chars: sys.exit('沒有漢字')
    if not os.path.exists(FONT): sys.exit(f'找不到字型 {FONT}（要裝文泉驛正黑，例如 apt-get install fonts-wqy-zenhei）')
    fetch(a.stroke_dir, chars)
    font = ImageFont.truetype(FONT, max(12, a.cell // 22)); lab = ImageFont.truetype(FONT, max(14, a.cell // 12))
    ok, missing = [], []
    for ch in chars:
        st = load_strokes(a.stroke_dir, ch)
        (ok if st else missing).append((ch, st))
    os.makedirs(a.out_dir, exist_ok=True)
    per = a.cols * a.rows; gap = 10; head = a.cell // 8
    sheets = 0
    for s0 in range(0, len(ok), per):
        chunk = ok[s0:s0 + per]; rows = (len(chunk) + a.cols - 1) // a.cols
        big = Image.new('RGB', (a.cols * (a.cell + gap) + gap, rows * (a.cell + head + gap) + gap), (235, 235, 235))
        for k, (ch, st) in enumerate(chunk):
            cell = Image.new('RGB', (a.cell, a.cell + head), 'white')
            cell.paste(draw_cell(st, a.cell, font), (0, 0))
            ImageDraw.Draw(cell).text((8, a.cell + head / 2), f'{s0 + k + 1}. {ch}  {len(st)}畫', fill=(0, 0, 0), font=lab, anchor='lm')
            big.paste(cell, (gap + (k % a.cols) * (a.cell + gap), gap + (k // a.cols) * (a.cell + head + gap)))
        sheets += 1
        big.save(os.path.join(a.out_dir, f'stroke-numbers-{sheets:02d}.png'))
    print(f'{a.out_dir}：{len(ok)} 個字、{sheets} 張圖（每張最多 {per} 字）')
    if missing: print(f'g0v 沒有筆畫資料、略過 {len(missing)} 個：' + ''.join(c for c, _ in missing))


main()
