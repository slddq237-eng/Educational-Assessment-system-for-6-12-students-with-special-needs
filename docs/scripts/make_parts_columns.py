"""
部件表的三種拆法欄（給 Claude 或熟悉程式的人執行，老師不用動）

在 docs/materials/parts-table.xlsx「生字部件」頁最後面加上（或重新產生）三欄：
  A：形符＋聲符（只拆兩塊）    Claude 依規則自動判斷，黃色＝待老師確認
  B：可教學角度拆到最細        Claude 依規則自動產生，黃色＝待老師確認
  C：開源部件預設拆法          cjkvi-ids 原本的第一層拆法（沒經過人工修改）
A、B 右邊各有一欄「人工手動」（綠色），老師覺得 A、B 不對時寫在這裡，程式不會動它。
原本的欄位一個都不動；A、B、C 三欄每次執行都整欄重算（不要直接改這三欄，要改請寫在旁邊的人工手動欄）。
平台（識字評量、備課分析）不讀這三欄，仍然用「人工 PARTS 優先，沒有才用 parts.js」。

什麼時候跑：make_parts.py 之後（新增課本、改了 shared/lessons.js 的 PARTS 之後）。

需要：Python 3、openpyxl、Node.js
需要先下載（不放進 repo）：
  1. cjkvi-ids 的 ids.txt  https://github.com/cjkvi/cjkvi-ids（衍生自 CHISE，GPLv2 或更新版）
  2. pinyin-data 的 pinyin.txt  https://github.com/mozillazg/pinyin-data（MIT；讀音來自 Unicode Unihan 等）
     只拿來比對「部件和字的讀音像不像」以判斷聲符，讀音本身不寫進表格。
執行（在 repo 最上層）：
  python3 docs/scripts/make_parts_columns.py <ids.txt> <pinyin.txt>

規則（2026-10-28 第一版；判斷不了的寫明原因，不硬猜）：
  A 欄：先看人工拆法（lessons.js 的 PARTS）剛好兩塊就用它，否則用 cjkvi-ids 最上層的兩塊。
        兩塊裡讀音和字一樣（不看聲調）或韻母相同的是聲符，另一塊是形符；
        兩塊都像（或都不像）時，常見的形符（氵、扌、木…）當形符，還分不出來就標「？」。
        都不像：寫「看不出聲符，可能是會意字」；左中右、上中下三塊並排、或其中一塊打不出來：寫原因。
  B 欄：從第一層部件（人工優先）開始往下拆；遇到部首（康熙 214 部首和常見變形，例如足、金、氵）就停；
        一個部件拆開後每一塊都是「看得懂的部件」才拆，否則就停在這個部件。
        看得懂＝不是單一筆畫、不是罕用字（擴充區）、拆得出兩塊以上。
        同一個部件出現幾次就寫幾次（森＝木 木 木），部件重組時用得到。
  C 欄：parts.js 的自動拆法；人工整理過的字，parts.js 沒有它的自動拆法，就用 cjkvi-ids 照 make_parts.py 同樣的規則重算。
"""
import copy, json, re, subprocess, sys
import openpyxl
from openpyxl.styles import PatternFill
from openpyxl.comments import Comment

IDS, PINYIN = sys.argv[1], sys.argv[2]
TABLE = 'docs/materials/parts-table.xlsx'
HEAD = ['A：形符＋聲符（只拆兩塊）', 'B：可教學角度拆到最細', 'C：開源部件預設拆法']

# 1. 讀 lessons.js 的人工 PARTS 和 parts.js 的 PARTS_AUTO（用 Node 執行後轉成 JSON）
js = '''const o={};new Function(require("./docs/scripts/lessons-src.js")()+";"+require("fs").readFileSync("shared/parts.js","utf8")+
";Object.assign(this,{PARTS,PARTS_AUTO})").call(o);console.log(JSON.stringify({P:o.PARTS,A:o.PARTS_AUTO}));'''
L = json.loads(subprocess.run(['node', '-e', js], capture_output=True, text=True, check=True).stdout)
PARTS, AUTO = L['P'], L['A']

# 2. 讀 cjkvi-ids（和 make_parts.py 一樣，優先台灣字形）
D = {}
for line in open(IDS, encoding='utf8'):
    if line.startswith('#'): continue
    f = line.rstrip('\n').split('\t')
    if len(f) < 3: continue
    pick = None
    for o in f[2:]:
        m = re.match(r'^(.*?)\[(\w+)\]$', o)
        if m and 'T' in m.group(2): pick = m.group(1); break
    if pick is None:
        plain = [o for o in f[2:] if '[' not in o]
        pick = plain[0] if plain else re.sub(r'\[\w+\]$', '', f[2])
    D[f[1]] = re.sub(r'&[^;]+;', '？', pick)
REV = {v: k for k, v in D.items() if len(v) > 1}          # 拆法 → 字（找「打不出來的那一塊」有沒有對應的字）
IDC = set(chr(c) for c in range(0x2FF0, 0x2FFC))
STROKES = set('一丨丿丶乀乚𠃌乛亅𠄌㇀㇇㇉乁𡿨𠃊𠃋𠂆')
rare = lambda c: 0x3400 <= ord(c) <= 0x4DBF or ord(c) >= 0x20000
junk = lambda x: re.match(r'[①-⓿゠-ヿ　-〿？]', x)

# 3. 讀音（不看聲調）：字 → {(聲母, 韻母)}
TONE = str.maketrans('āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹḿ', 'aaaaeeeeiiiioooouuuuüüüünnnm')
INI = ('zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w')
def split(py):
    py = py.translate(TONE)
    for i in INI:
        if py.startswith(i) and len(py) > len(i): return i, py[len(i):]
    return '', py
READ = {}
for line in open(PINYIN, encoding='utf8'):
    m = re.match(r'U\+([0-9A-F]+):\s*([^#]+)', line)
    if m: READ[chr(int(m.group(1), 16))] = {split(p.strip()) for p in m.group(2).split(',') if p.strip()}

def core(f):   # 韻母去掉介音（ㄧㄨㄩ），例如 iang、uang → ang
    return f[1:] if len(f) > 1 and f[0] in 'iuü' else f
def sound(part, c):   # 2＝讀音一樣（不看聲調）、1＝韻母相同（不看介音）、0＝不像
    a, b = READ.get(part, set()), READ.get(c, set())
    if a & b: return 2
    return 1 if {core(f) for _, f in a} & {core(f) for _, f in b} else 0

# 常見的形符（表示意思的部件）：兩塊讀音都像時，用來判斷哪一塊是形符
SEM = set('氵扌亻忄艹⺮竹糹糸訁言釒金阝辶宀冖灬火爫彳礻示衤衣疒广厂攵刂卩冫⺼月肉口木土日目女犭虫足⻊石禾米貝車馬魚鳥雨山心手水王玉田皿耳舟革頁食飠欠走見角酉門隹力刀巾弓缶羽隹鬼骨歹立网罒老而耒舌血行豆豕赤身辛邑里阜韋音風飛香')

def end(s, i):   # 從第 i 個字開始的「一塊」到哪裡結束（一塊＝一個字，或一段組合符號＋它的各塊）
    if i >= len(s): raise ValueError
    if s[i] not in IDC: return i + 1
    j = i + 1
    for _ in range(3 if s[i] in '⿲⿳' else 2): j = end(s, j)
    return j
def pieces(s):   # 把 IDS 最上層切成兩塊或三塊（每塊是一個字，或一段打不出來的組合）
    if not s or s[0] not in IDC: return None
    try:
        out, i = [], 1
        for _ in range(3 if s[0] in '⿲⿳' else 2):
            j = end(s, i); out.append(s[i:j]); i = j
        return out if i == len(s) else None
    except ValueError:
        return None

def col_a(c):
    m = [p for p in (PARTS.get(c) or '').split() if p != c]
    if c in PARTS and not m: return '獨體字', False
    if len(m) == 2: two = m
    else:
        s = D.get(c)
        if not s or s == c: return '獨體字', False
        ps = pieces(s)
        if ps is None: return '拆不成兩塊（資料格式特殊，見 C 欄）', True
        if len(ps) == 3: return '三塊並排（' + '＋'.join(REV.get(p, p) for p in ps) + '），拆不成兩塊', True
        two = [REV.get(p, p) for p in ps]
        if any(len(p) > 1 or junk(p) for p in two):
            return '其中一塊打不出來（' + '＋'.join(two) + '），請老師判斷', True
    x, y = two
    sx, sy = sound(x, c), sound(y, c)
    if sx == sy == 0: return f'{x}＋{y}（看不出聲符：可能是會意字，或古今讀音不同）', True
    if sx != sy:
        sem, pho = (y, x) if sx > sy else (x, y)
        return f'形：{sem}　聲：{pho}' + ('' if max(sx, sy) == 2 else '（韻母相同）'), rare(pho)
    if (x in SEM) != (y in SEM):      # 兩塊讀音都像：常見形符當形符
        sem, pho = (x, y) if x in SEM else (y, x)
        return f'形：{sem}　聲：{pho}', False
    return f'{x}＋{y}（兩塊讀音都像，哪個是聲符？）', True

def parts(c): return [p for p in (PARTS.get(c) or AUTO.get(c) or '').split() if p != c]
def ok(p): return p not in STROKES and not rare(p) and not junk(p)
# 部首（康熙 214 部首和常見的變形）是最小的教學單位，拆到部首就停（例如足不再拆成口＋龰、金不再拆）
import unicodedata
RADICAL = {unicodedata.normalize('NFKC', chr(c)) for c in range(0x2F00, 0x2FD6)} | \
          {unicodedata.normalize('NFKC', chr(c)) for c in range(0x2E80, 0x2EF4)} | \
          set('氵扌亻忄艹⺮糹訁釒阝辶⻊⺼礻衤灬爫罒⺈龶⺌⺍⺊⺗⺝⻌⻏⻖丬犭飠钅')
def fine(p, depth=0):
    sub = parts(p)
    if p not in RADICAL and depth < 8 and len(sub) >= 2 and all(ok(s) for s in sub):
        return [q for s in sub for q in fine(s, depth + 1)]
    return [p]
def col_b(c):
    first = parts(c)
    if not first: return '獨體字'
    return ' '.join(q for p in first for q in fine(p))

def ids_first(c):   # 和 make_parts.py 的 first()＋expand() 相同規則
    def first(c):
        s = D.get(c)
        if not s or s == c: return None
        t = [x for x in s if x not in IDC]
        return t if len(t) >= 2 or any(rare(x) for x in t) else None
    def expand(c, depth=0):
        t = first(c)
        if t is None: return None
        out = []
        for x in t:
            e = expand(x, depth + 1) if rare(x) and depth < 6 else None
            out += e if e else [x]
        return [x for x in out if not junk(x)]
    return expand(c)
def col_c(c):
    if AUTO.get(c): return AUTO[c]
    e = ids_first(c)
    return ' '.join(e) if e else '獨體字'

# 4. 寫進部件表：A、B、C 三欄整欄重算；A、B 右邊各有一欄「人工手動」給老師填（綠色），程式不動裡面的內容
#    （2026-10-28 維護者要求加人工手動欄）。表頭找得到就照原位置寫，找不到就加在最後面；舊版沒有人工欄的，插一欄進去。
MANUAL = ['A：人工手動', 'B：人工手動']
LAYOUT = [HEAD[0], MANUAL[0], HEAD[1], MANUAL[1], HEAD[2]]
WIDTH = {HEAD[0]: 30, MANUAL[0]: 20, HEAD[1]: 26, MANUAL[1]: 20, HEAD[2]: 22}
wb = openpyxl.load_workbook(TABLE); ws = wb['生字部件']
head = [ws.cell(1, j).value for j in range(1, ws.max_column + 1)]
start = head.index(HEAD[0]) + 1 if HEAD[0] in head else ws.max_column + 1
for k, h in enumerate(LAYOUT):   # 舊版表格缺人工欄：在該在的位置插一欄（後面的欄往右移，裡面的內容不變）
    if h in MANUAL and ws.cell(1, start + k).value not in (None, h) and ws.cell(1, start + k).value != h:
        ws.insert_cols(start + k)
yellow, green, none = PatternFill('solid', fgColor='FBF1DC'), PatternFill('solid', fgColor='E4F3EC'), PatternFill()
last = ws.cell(1, start - 1)
for k, h in enumerate(LAYOUT):
    cell = ws.cell(1, start + k, h)
    cell.font, cell.fill, cell.alignment, cell.border = copy.copy(last.font), copy.copy(last.fill), copy.copy(last.alignment), copy.copy(last.border)
    ws.column_dimensions[openpyxl.utils.get_column_letter(start + k)].width = WIDTH[h]
note = {HEAD[0]: 'Claude 自動判斷（2026-10-28 第一版），黃色＝待老師確認；規則見 docs/scripts/make_parts_columns.py',
        HEAD[1]: 'Claude 依規則自動產生，黃色＝待老師確認；不拆成單一筆畫或罕用字',
        HEAD[2]: 'cjkvi-ids 原本的拆法，沒經過人工修改',
        MANUAL[0]: '老師填：左邊 A 欄不對時，在這裡寫正確的形符、聲符，例如「形 氵 聲 工」；程式重算時不會動這一欄',
        MANUAL[1]: '老師填：左邊 B 欄不對時，在這裡寫可教學的拆法，部件用半形空格分開，例如「足 耳 耳 耳」；程式重算時不會動這一欄'}
for k, h in enumerate(LAYOUT): ws.cell(1, start + k).comment = Comment(note[h], 'Claude')
stat = {'A 待確認': 0, 'A 形聲': 0, 'A 獨體': 0}
for r in range(2, ws.max_row + 1):
    c = ws.cell(r, 1).value
    if not c: continue
    a, unsure = col_a(c)
    vals = {HEAD[0]: a, HEAD[1]: col_b(c), HEAD[2]: col_c(c)}
    src = ws.cell(r, 3)
    for k, h in enumerate(LAYOUT):
        cell = ws.cell(r, start + k)
        if h in vals: cell.value = vals[h]
        cell.font, cell.alignment, cell.border = copy.copy(src.font), copy.copy(src.alignment), copy.copy(src.border)
        cell.fill = green if h in MANUAL else yellow if h != HEAD[2] else none
    stat['A 待確認'] += unsure; stat['A 形聲'] += a.startswith('形：'); stat['A 獨體'] += a == '獨體字'
end = start + len(LAYOUT) - 1
ws.auto_filter.ref = f'A1:{openpyxl.utils.get_column_letter(end)}{ws.max_row}'
wb.save(TABLE)
print(f'寫入 {ws.max_row - 1} 列（第 {start}～{end} 欄）；', stat)
