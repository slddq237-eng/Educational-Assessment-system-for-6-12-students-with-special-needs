"""
筆畫範圍的編號對照圖（給維護者確認用；含教育部筆畫，產生的檔案不要放進 repo）
執行：python3 docs/scripts/stroke_ranges_sheet.py <筆畫資料夾> <make_stroke_ranges.py 的輸出資料夾> <檔名> <l1 或 l2> <狀態,狀態> [抽樣幾字，0＝全部] [每張幾字]
  例：python3 docs/scripts/stroke_ranges_sheet.py 筆畫資料夾 輸出資料夾 layer2 l2 需人工,建議確認 0 32
輸出：<輸出資料夾>/<檔名>-1.html…（每個字用顏色分部件、圓圈是筆順編號、下面是部件小圖和範圍）；要圖片時用 Playwright 開啟 html 截圖。
"""
import json, os, sys, random
G, W, OUT, LAYER, STATS = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5].split(',')
SAMPLE = int(sys.argv[6]) if len(sys.argv) > 6 else 0
PER = int(sys.argv[7]) if len(sys.argv) > 7 else 48
R = json.load(open(f'{W}/ranges.json'))
items = [(c, r) for c, r in R.items() if r[LAYER][0] in STATS]
if SAMPLE: random.seed(int(os.environ.get("SEED","7"))); items = random.sample(items, min(SAMPLE, len(items)))
items.sort(key=lambda x: (STATS.index(x[1][LAYER][0]), x[0]))

def strokes(ch):
    seen, out = set(), []
    for s in json.load(open(os.path.join(G, f'{ord(ch):x}.json'), encoding='utf-8')):
        xs = [q.get('x', q.get('end', {}).get('x')) for q in s['outline']]; ys = [q.get('y', q.get('end', {}).get('y')) for q in s['outline']]
        k = tuple(int(v // 8) for v in (min(xs), max(xs), min(ys), max(ys)))
        if k not in seen: seen.add(k); out.append(s)
    res = []
    for s in out:
        d, xs, ys = '', [], []
        for e in s['outline']:
            t = e['type']
            if t in 'ML': d += f"{t}{e['x']} {e['y']}"; xs.append(e['x']); ys.append(e['y'])
            elif t == 'Q': d += f"Q{e['begin']['x']} {e['begin']['y']} {e['end']['x']} {e['end']['y']}"; xs += [e['begin']['x'], e['end']['x']]; ys += [e['begin']['y'], e['end']['y']]
        tr = s.get('track') or [{'x': xs[0], 'y': ys[0]}]
        res.append({'d': d + 'Z', 'b': (min(xs), min(ys), max(xs), max(ys)), 't': (tr[0]['x'], tr[0]['y'])})
    return res
def parse(rg):
    return [[k - 1 for part in g.split(',') for k in range(int(part.split('-')[0]), int(part.split('-')[-1]) + 1)] for g in rg.split(';')] if rg else None
COL = ['#d32f2f', '#1565c0', '#2e7d32', '#ef6c00', '#6a1b9a', '#00838f']
cells = []
for no, (c, r) in enumerate(items, 1):
    stat, rg, why, parts = r[LAYER]; st = strokes(c); groups = parse(rg); owner = {}
    for gi, g in enumerate(groups or []):
        for k in g: owner[k] = gi
    svg = ''.join(f'<path d="{s["d"]}" fill="{COL[owner[k] % 6] if k in owner else "#666"}" fill-opacity=".85"/>' for k, s in enumerate(st))
    svg += ''.join(f'<circle cx="{s["t"][0]}" cy="{s["t"][1]}" r="80" fill="#fff" stroke="#222" stroke-width="10"/><text x="{s["t"][0]}" y="{s["t"][1] + 35}" font-size="100" text-anchor="middle" font-family="sans-serif" font-weight="700">{k + 1}</text>' for k, s in enumerate(st))
    def mini(g, gi):
        bs = [st[k]['b'] for k in g]; b = (min(x[0] for x in bs), min(x[1] for x in bs), max(x[2] for x in bs), max(x[3] for x in bs))
        w = max(b[2] - b[0], b[3] - b[1]) + 120; cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        return f'<svg class="mini" viewBox="{cx - w / 2} {cy - w / 2} {w} {w}">' + ''.join(f'<path d="{st[k]["d"]}" fill="{COL[gi % 6]}"/>' for k in g) + '</svg>'
    if groups:
        leg = ''.join(f'<span class="it">{mini(g, gi)}<b style="color:{COL[gi % 6]}">{p}</b> {seg}</span>' for gi, (p, g, seg) in enumerate(zip(parts, groups, rg.split(';'))))
    else:
        leg = '　'.join(parts or []) + '（請寫出第幾畫到第幾畫）'
    cls = '' if stat in ('自動', '已驗證', '已確認') else ' warn'
    cells.append(f'<div class="cell{cls}"><div class="hd"><span class="no">{no}</span> <span class="ch">{c}</span> <span class="tag">{stat}</span></div><svg viewBox="0 0 2048 2048"><rect width="2048" height="2048" fill="#fff"/>{svg}</svg><div class="leg">{leg}</div><div class="sz">共 {r["n"]} 畫{"　" + "；".join(why) if why else ""}</div></div>')
title = {'l1': '第一層', 'l2': '第二層'}[LAYER]
pages = [cells[i:i + PER] for i in range(0, len(cells), PER)]
for pi, pc in enumerate(pages, 1):
    html = f'''<!doctype html><meta charset="utf-8"><style>
body{{font-family:"Noto Sans TC","Noto Sans CJK TC",sans-serif;margin:16px;background:#f6f6f2}} h1{{font-size:22px;margin:0 0 4px}} p{{margin:0 0 12px;color:#444;font-size:14px}}
.grid{{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}} .cell{{background:#fff;border:2px solid #ccc;border-radius:8px;padding:5px}} .cell.warn{{border-color:#ef6c00}}
.hd{{display:flex;align-items:center;gap:6px}} .no{{color:#888;font-size:12px}} .ch{{font-size:20px;font-weight:700}} .tag{{margin-left:auto;font-size:11px;color:#2e7d32}} .warn .tag{{color:#ef6c00;font-weight:700}}
svg{{width:100%;aspect-ratio:1;display:block}} .leg{{font-size:13px;margin-top:3px;line-height:1.4;display:flex;flex-wrap:wrap;gap:1px 8px}} .it{{display:inline-flex;align-items:center;gap:2px;white-space:nowrap}}
.mini{{width:22px;height:22px;border:1px solid #ddd;background:#fff}} .sz{{font-size:11px;color:#888}}
</style><h1>{title}部件的筆畫範圍（{OUT}，第 {pi}/{len(pages)} 張）</h1><p>每個字用顏色分出部件，圓圈是教育部筆順第幾畫；下面是每個部件切出來的樣子、名稱、第幾畫到第幾畫。橘框＝請確認。筆畫：教育部《國字標準字體筆順學習網》（經 g0v zh-stroke-data）。只供內部確認。</p><div class="grid">{"".join(pc)}</div>'''
    open(f'{W}/{OUT}-{pi}.html', 'w').write(html)
print(len(items), '字', len(pages), '張')
