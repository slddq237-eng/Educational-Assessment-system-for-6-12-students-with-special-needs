"""
全部課本生字的部件筆畫範圍（第一層、第二層）：自動算＋分類（2026-11-23 開始，規劃見 docs/design/parts-strokes.md 第 6 節）
給 Claude 或熟悉程式的人執行，老師不用動。

做什麼：每個課本生字，照部件表的第一層、第二層，算出每個部件是教育部筆順的第幾畫到第幾畫，並分成
  已驗證（shared/stroke-parts.js 已經有、和第一層對得上的分組）、已確認（維護者看對照圖確認過，docs/materials/stroke-ranges-confirmed.json，
  或 stroke-parts.js 的 q）、自動（第二層剛好是已驗證／已確認第一層的細分，筆畫數湊得剛好）、建議確認、需人工（部件表的筆畫數加起來對不上）、不拆、沒有筆畫。
  算法：照部件表順序（大致就是書寫順序）累加筆畫數；辶、廴最後寫；囗外框先寫 2 畫、最後封口；匚上面一橫先寫、最後豎折；凵裡面先寫；
  第二層在第一層的每一塊裡再分。抽查過 96 個「自動」的字（2026-11-23），交錯書寫的部件（戈、匚等）、不連續的塊一律改成建議確認。
需要：Python 3、Node.js；教育部筆畫（g0v zh-stroke-data 的 json，不放進 repo；make_ruler.py 會下載到同一個資料夾）
執行（在 repo 最上層）：python3 docs/scripts/make_stroke_ranges.py <筆畫資料夾> <輸出資料夾>
輸出：<輸出資料夾>/ranges.json（每個字：筆畫數、第一層和第二層的 [狀態, 範圍, 原因, 部件]），範圍格式「1-4;5-8;9-12」（部件之間 ;，同一部件不連續用 ,）。
對照圖：python3 docs/scripts/stroke_ranges_sheet.py（見那支程式的說明）。對照圖含教育部筆畫，只給維護者確認，不放進 repo。
"""
import json, os, re, sys, subprocess
from collections import Counter, defaultdict
REPO = '.'
G, W = sys.argv[1], sys.argv[2]
os.makedirs(W, exist_ok=True)
# 課本生字和部件表（用 Node 執行網頁同一份資料）
C = json.loads(subprocess.run(['node', '-e', r'''
const fs=require("fs");const src=require("./docs/scripts/lessons-src.js")();
const code=src+";"+["shared/parts.js","shared/parts-layers.js","shared/parts-api.js"].map(f=>fs.readFileSync(f,"utf8")).join(";")+";this.B=BOOKS;this.P=window.Parts;";
const o={window:{}};new Function("window",code).call(o,o.window);
const out={};for(const b of Object.values(o.B))for(const L of Object.values(b.lessons))for(const c of (L.write||"")+(L.read||"")){if(out[c])continue;
 const l1=o.P.layer(c,1),l2=o.P.read(c,{from:2});out[c]={s:o.P.struct(c),l1:l1?l1.parts:null,l2:l2?l2.parts:null,l2layer:l2?l2.layer:0};}
process.stdout.write(JSON.stringify(out));'''], capture_output=True, text=True, check=True).stdout)
CONF1 = json.load(open('docs/materials/stroke-ranges-confirmed.json', encoding='utf-8'))['第一層']   # 維護者確認過的第一層（不拆＝null）

# 缺的筆畫檔從 g0v 下載（和 make_ruler.py 的 fetch_strokes 一樣；g0v 沒有的字留一個 .none）
def fetch(chars):
    from concurrent.futures import ThreadPoolExecutor
    def one(ch):
        p = os.path.join(G, f'{ord(ch):x}.json')
        if os.path.exists(p) or os.path.exists(p + '.none'): return
        r = subprocess.run(['curl', '-sS', '-f', '-m', '60', '-o', p, f'https://raw.githubusercontent.com/g0v/zh-stroke-data/master/json/{ord(ch):x}.json'], capture_output=True)
        if r.returncode != 0:
            if os.path.exists(p): os.remove(p)
            if r.returncode == 22: open(p + '.none', 'w').close()
    os.makedirs(G, exist_ok=True)
    with ThreadPoolExecutor(8) as ex: list(ex.map(one, chars))
fetch(sorted(set(C) | {p for v in C.values() for L in (v['l1'] or [], v['l2'] or []) for p in L if len(p) == 1}))

# 教育部筆畫（和 make_ruler.py 的 load_strokes 一樣去掉重複的筆畫，編號才一致）
_sc = {}
def strokes(ch):
    if ch in _sc: return _sc[ch]
    p = os.path.join(G, f'{ord(ch):x}.json')
    if not os.path.exists(p): _sc[ch] = None; return None
    seen, out = set(), []
    for s in json.load(open(p, encoding='utf-8')):
        xs = [q.get('x', q.get('end', {}).get('x')) for q in s['outline']]; ys = [q.get('y', q.get('end', {}).get('y')) for q in s['outline']]
        k = tuple(int(v // 8) for v in (min(xs), max(xs), min(ys), max(ys)))
        if k not in seen: seen.add(k); out.append(s)
    _sc[ch] = out; return out

# 現在的 stroke-parts.js（第一層對得上的 l、維護者確認的第二層 q）：從路徑的每一筆起點對回筆畫編號
SP = json.loads(subprocess.run(['node', '-e', '''const vm=require("vm"),fs=require("fs");const c={window:{}};vm.createContext(c);
vm.runInContext(fs.readFileSync("shared/stroke-parts.js","utf8").replace(/^const (\\w+)/mg,"var $1"),c);process.stdout.write(JSON.stringify(c.STROKE_PARTS));'''], cwd=REPO, capture_output=True, text=True, check=True).stdout)
def groups_from_paths(ch, paths):
    # 每一筆用「第一個外框的起點」對；同一個起點有好幾筆時照順序一筆一筆用；一筆裡第二個以後的外框（M）跳過
    firsts, extra = defaultdict(list), set()
    for i, st in enumerate(strokes(ch)):
        ms = [(round(e['x'] / 4), round(e['y'] / 4)) for e in st['outline'] if e['type'] == 'M']
        firsts[ms[0]].append(i); extra.update(ms[1:])
    used, out = set(), []
    for d in paths:
        g = []
        for a, b in re.findall(r'M(\d+) (\d+)', d):
            pt = (int(a), int(b)); cand = [i for i in firsts.get(pt, []) if i not in used]
            if cand: used.add(cand[0]); g.append(cand[0])
            elif pt not in extra: return None
        out.append(sorted(g))
    return out if sorted(i for g in out for i in g) == list(range(len(strokes(ch)))) else None

# 部件筆畫數：手填（偏旁、罕用部件）→ g0v 單字 → 名稱部件用每個字加起來 → 從字的總筆畫數反推（多數決）
MANUAL = {'⺀':2,'⺼':4,'丙':5,'丨':1,'丷':2,'丿':1,'乀':1,'乙':1,'乛':1,'亅':1,'了':2,'亠':2,'亻':2,'亾':3,'儿':2,'冂':2,'冖':2,'冫':2,
  '凶':4,'刂':2,'勹':2,'卌':4,'囗':3,'屮':3,'帀':4,'幺':3,'广':3,'彳':3,'忄':3,'扌':3,'攵':4,'毋':4,'母':5,'氵':3,'氺':5,'灬':4,'用':5,
  '疒':5,'臣':6,'艹':4,'衤':5,'阝':3,'隹':8,'龴':2,'龶':4,'龷':4,'𠁣':4,'𠂆':2,'𠂉':2,'𠂊':2,'𠃊':1,'𠃌':1,'𠃛':4,'𠄌':1,'𣎳':4,'𩰋':5,'𩰊':5,
  '辶':4,'廴':3,'礻':4,'讠':2,'纟':3,'钅':5,'饣':3,'⺌':3,'⺊':2,'⺈':2,'⻊':7,'⻗':8,'⺮':6,'⺶':6,'⺧':4,'⺩':4,'⺪':5,'⺳':4,'⺷':6,'⺻':5,'⻖':3,'⻏':3,'𧾷':7,'犭':3,'丶':1,'一':1,'乚':1,'𠃍':1,'㇏':1}
POS = re.compile(r'半|中間|外框|裡面|上面|下面|左邊|右邊|外$|內$')
def base_count(p):
    if p in MANUAL: return MANUAL[p]
    if len(p) == 1:
        s = strokes(p); return len(s) if s else None
    if POS.search(p): return None
    ks = [base_count(x) for x in p]
    return sum(ks) if None not in ks else None
votes = defaultdict(Counter)
for c, v in C.items():
    st = strokes(c)
    if not st: continue
    for L in (v['l1'], v['l2'] if v['l2layer'] == 2 else None):
        if not L or len(L) < 2: continue
        ks = [base_count(p) for p in L]; unk = [i for i, k in enumerate(ks) if k is None]
        if len(unk) == 1 and not POS.search(L[unk[0]]):
            r = len(st) - sum(k for k in ks if k is not None)
            if r > 0: votes[L[unk[0]]][r] += 1
LEARN = {p: cnt.most_common(1)[0][0] for p, cnt in votes.items()}
def count(p):
    k = base_count(p)
    return k if k is not None else (None if POS.search(p) else LEARN.get(p))

LAST = {'辶', '廴'}
MIXED = set('戈弋戊戌戍戉匚匸凵囗𢦏乂')   # 和其他部件交錯書寫、照順序分常常分錯的部件：一律要確認
def sequential(parts, sizes, n, struct):
    """照書寫順序累加；辶、廴最後寫；全包圍的囗：外框先寫 2 畫、裡面、最後封口；下方包圍（凵）：裡面先寫"""
    order = [k for k in range(len(parts)) if parts[k] not in LAST] + [k for k in range(len(parts)) if parts[k] in LAST]
    groups, at = [None] * len(parts), 0
    if parts and parts[0] in ('匚', '匸') and len(parts) >= 2 and sizes[0] >= 2:   # 匚：上面一橫先寫、裡面、最後豎折
        m = sizes[0]; groups[0] = [0] + list(range(n - (m - 1), n)); at = 1; order = [k for k in order if k != 0]
        for k in order: groups[k] = list(range(at, at + sizes[k])); at += sizes[k]
        return groups
    if parts and parts[0] == '凵' and len(parts) == 2:   # 凵：裡面先寫
        return [list(range(sizes[1], n)), list(range(sizes[1]))]
    if (struct == "全包圍" or (parts and parts[0] == "囗")) and len(parts) >= 2 and sizes[0] >= 3:
        m = sizes[0]; groups[0] = list(range(2)) + list(range(n - (m - 2), n)); at = 2; order = [k for k in order if k != 0]
    elif struct == '下方包圍' and len(parts) == 2:
        order = [1, 0]
    for k in order: groups[k] = list(range(at, at + sizes[k])); at += sizes[k]
    return groups

def fmt(groups):
    out = []
    for g in groups:
        g = [k + 1 for k in g]; seg, s = [], g[0]
        for a, b in zip(g, g[1:] + [None]):
            if b != a + 1: seg.append(f'{s}' if s == a else f'{s}-{a}'); s = b
        out.append(','.join(seg))
    return ';'.join(out)

res = {}
for c, v in C.items():
    st = strokes(c); r = {'n': len(st) if st else 0}
    res[c] = r
    if not st: r['l1'] = r['l2'] = ('沒有筆畫', None, []); continue
    n = len(st); sp = SP.get(c)
    # ---- 第一層 ----
    L1 = v['l1'] if v['l1'] and len(v['l1']) >= 2 else None
    g1 = None
    if c in CONF1:   # 維護者 2026-11-23 看對照圖確認的第一層（名稱沒寫的用部件表的）
        if CONF1[c] is None: L1 = None; r['l1'] = ('不拆', None, ['維護者確認不拆'])
        else:
            L1 = [nm or (v['l1'][k] if v['l1'] and k < len(v['l1']) else '') for k, (nm, _) in enumerate(CONF1[c])]
            g1 = [[i - 1 for part in rg.split(',') for i in range(int(part.split('-')[0]), int(part.split('-')[-1]) + 1)] for _, rg in CONF1[c]]
            r['l1'] = ('已確認', g1, []); r['l1names'] = L1
    elif not L1: r['l1'] = ('不拆', None, [])
    elif sp and sp.get('l') and len(sp['p']) == len(L1):
        g1 = groups_from_paths(c, sp['p']); r['l1'] = ('已驗證', g1, []) if g1 else ('需人工', None, ['筆畫檔對不回編號'])
    else:
        ks = [count(p) for p in L1]; why = []
        unk = [i for i, k in enumerate(ks) if k is None]
        if len(unk) == 1: ks[unk[0]] = n - sum(k for k in ks if k is not None); why.append('有部件的筆畫數是推算的')
        if None in ks or sum(ks) != n or min(ks) < 1: r['l1'] = ('需人工', None, ['部件筆畫數加起來對不上'])
        else:
            g1 = sequential(L1, ks, n, v['s'])
            if v['s'] in ('左上包圍', '右上包圍', '上方包圍', '左方包圍', '交疊'): why.append(f'{v["s"]}照外層先寫')
            if any(k == 1 for k in ks): why.append('有單一筆畫的部件')
            if any(p in LAST for p in L1): why.append('辶、廴照最後寫')
            r['l1'] = ('建議確認', g1, why)
    # ---- 第二層 ----
    L2 = v['l2'] if v['l2'] and v['l2layer'] == 2 and len(v['l2']) >= 2 else None
    if not L2: r['l2'] = ('不拆', None, []); continue
    if sp and sp.get('q') and len(sp['q']) == len(L2):
        g2 = groups_from_paths(c, sp['q']); r['l2'] = ('已確認', g2, []) if g2 else ('需人工', None, ['筆畫檔對不回編號']); continue
    ks = [count(p) for p in L2]; why = []
    unk = [i for i, k in enumerate(ks) if k is None]
    if len(unk) == 1: ks[unk[0]] = n - sum(k for k in ks if k is not None); why.append('有部件的筆畫數是推算的')
    if None in ks or sum(ks) != n or min(ks) < 1: r['l2'] = ('需人工', None, ['部件筆畫數加起來對不上']); continue
    if L1 and L2 == L1 and g1: r['l2'] = (r['l1'][0], g1, r['l1'][2]); continue
    # 第二層在第一層的每一塊裡面再分：照順序把第二層的部件分給第一層的塊，筆畫數剛好湊滿才算對得上
    g2 = None
    if g1:
        sizes1, j, assign = [len(g) for g in g1], 0, []
        for gi, s1 in enumerate(sizes1):
            acc, take = 0, []
            while j < len(L2) and acc < s1: acc += ks[j]; take.append(j); j += 1
            if acc != s1: assign = None; break
            assign.append(take)
        if assign is not None and j == len(L2):
            g2 = [None] * len(L2)
            for gi, take in enumerate(assign):
                sub = sequential([L2[t] for t in take], [ks[t] for t in take], len(g1[gi]), '')
                if len(take) > 1 and g1[gi] != list(range(g1[gi][0], g1[gi][0] + len(g1[gi]))) and '第一層這塊的筆畫不連續（包圍），裡面怎麼分要確認' not in why: why.append('第一層這塊的筆畫不連續（包圍），裡面怎麼分要確認')
                for t, gg in zip(take, sub): g2[t] = [g1[gi][x] for x in gg]
            if any(ks[t] == 1 for t in range(len(L2))): why.append('有單一筆畫的部件')
            if any(p in MIXED for p in L2): why.append('有常常交錯書寫的部件（戈、匚等）')
            stat = '自動' if r['l1'][0] in ('已驗證', '已確認') and not why else '建議確認'
            if r['l1'][0] not in ('已驗證', '已確認'): why.append('第一層也還沒確認')
            r['l2'] = (stat, g2, why); continue
        why.append('第二層和第一層的分塊對不起來')
    g2 = sequential(L2, ks, n, v['s'])
    if any(k == 1 for k in ks): why.append('有單一筆畫的部件')
    r['l2'] = ('建議確認', g2, why)

S1, S2 = Counter(r['l1'][0] for r in res.values()), Counter(r['l2'][0] for r in res.values())
print('第一層', dict(S1)); print('第二層', dict(S2))
json.dump({c: {'n': r['n'], 'l1': [r['l1'][0], fmt(r['l1'][1]) if r['l1'][1] else '', r['l1'][2], r.get('l1names') or C[c]['l1']],
               'l2': [r['l2'][0], fmt(r['l2'][1]) if r['l2'][1] else '', r['l2'][2], C[c]['l2']], 's': C[c]['s']} for c, r in res.items()},
          open(f'{W}/ranges.json', 'w'), ensure_ascii=False)
print('推算的部件筆畫數', len(LEARN), dict(list(LEARN.items())[:30]))
