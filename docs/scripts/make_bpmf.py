"""
產生注音字型子集與破音字讀音表（給 Claude 或熟悉程式的人執行，老師不用動）

新增課本（改了 shared/lessons.js）之後要重新執行一次，新課本的字才會有注音。
產生兩個檔案：
  shared/fonts/bpmf-kai-*.woff2、bpmf-kai.css  注音字型：只收錄 lessons.js 用到的字（含每個字的所有讀音），
      依課本拆成幾個小檔；瀏覽器只下載畫面上用到的字所在的那幾個檔
  shared/bpmf.js               讀音表：語詞、例句裡的破音字該念哪一個音

需要：Python 3、fonttools、brotli（pip install fonttools brotli）、Node.js
需要先下載（不放進 repo）：
  1. 字嗨注音標楷 fonts/BpmfZihiKaiStd-Regular.ttf 與讀音順序表 phonetic/phonic_table_Z.txt
     https://github.com/ButTaiwan/bpmfvs（字型：漢字 CC BY 4.0、其餘 SIL OFL 1.1）
  2. 新酷音詞庫 dict/chewing/tsi.csv
     https://github.com/chewing/libchewing-data（LGPL-2.1，只用來判斷語詞的讀音）
執行（在 repo 最上層）：
  python3 docs/scripts/make_bpmf.py <BpmfZihiKaiStd-Regular.ttf> <phonic_table_Z.txt> <tsi.csv>

讀音怎麼決定：語詞、例句裡出現的每個詞庫詞（2 字以上）一起投票，詞越常用、越長票越重；
找到的讀音在字型裡排第幾個，就記第幾個（0＝字型預設讀音，不用記）。
單獨一個字（沒有組成詞）用字型的預設讀音；「一」「不」標本調；
「們、麼、個、和」詞庫常收口語讀音，一律用預設讀音。
"""
import json, math, re, subprocess, sys
from fontTools import subset
from fontTools.ttLib import TTFont

FONT, ZTABLE, TSI = sys.argv[1:4]
OUT_DIR, OUT_JS = 'shared/fonts', 'shared/bpmf.js'

# 1. 讀 lessons.js（用 Node 執行後轉成 JSON）
JS = r'''
const fs=require("fs");const src=fs.readFileSync("shared/lessons.js","utf8");
const o={};new Function(src+";Object.assign(this,{BOOKS,WORDS,WORDS_ED,SENT,SENT_ED,CONF,CONF_ED});").call(o);
console.log(JSON.stringify(o));'''
L = json.loads(subprocess.run(['node', '-e', JS], capture_output=True, text=True, check=True).stdout)

# 2. 讀音順序表：字 → [讀音1, 讀音2, ...]（第 n 個讀音用異體字選擇子 U+E01E0+n 選）
Z = {}
for line in open(ZTABLE, encoding='utf8'):
    f = line.rstrip('\n').split('\t')
    if len(f) >= 4: Z[f[0]] = f[3:]

# 3. 新酷音詞庫：詞 → 最常用的讀音（輕聲符號移到前面，和讀音表一致）
def norm(p): return '˙' + p[:-1] if p.endswith('˙') else p
RAW = {}
for line in open(TSI, encoding='utf8'):
    if line.startswith('#'): continue
    f = line.rstrip('\n').split(',')
    if len(f) < 3: continue
    w, freq, ph = f[0], int(f[1] or 0), f[2].split(' ')
    if len(ph) == len(w): RAW.setdefault(w, []).append((freq, [norm(p) for p in ph]))
def zi(c, p): rs = Z.get(c, []); return rs.index(p) if p in rs else 99
# 同一個詞有好幾種讀音時：選詞頻最高的；一樣高就選比較標準的（在讀音表排越前面越標準）
DICT = {w: (max(f for f, _ in es), min(es, key=lambda e: (-e[0], sum(zi(c, p) for c, p in zip(w, e[1]))))[1]) for w, es in RAW.items()}
# 這些字詞庫常收口語讀音（我們ㄇㄣˊ、什麼ㄇㄛˊ、一個˙ㄍㄜ、和ㄏㄢˋ），課本照預設讀音標
KEEP = set('一不們麼個和')
MAXW = 8

# 詞庫裡會造成誤判的詞（「都會到」的都不是都市的都）
for w in ('都會',): DICT.pop(w, None)
# 人工修正：詞 → 正確讀音（詞庫標錯或只收口語讀音的詞）
FIX = {'體會': 'ㄊㄧˇ ㄏㄨㄟˋ', '極大': 'ㄐㄧˊ ㄉㄚˋ', '著急': 'ㄓㄠˊ ㄐㄧˊ', '著涼': 'ㄓㄠˊ ㄌㄧㄤˊ',
       '瀕臨絕種': 'ㄅㄧㄣ ㄌㄧㄣˊ ㄐㄩㄝˊ ㄓㄨㄥˇ', '難字': 'ㄋㄢˊ ㄗˋ', '會中': 'ㄏㄨㄟˋ ㄓㄨㄥ',
       '悶悶不樂': 'ㄇㄣˋ ㄇㄣˋ ㄅㄨˊ ㄌㄜˋ',
       # 依教育部《國語一字多音審訂表》88 年版（詞庫兩種讀音同分或沒收這個詞）
       '綢繆': 'ㄔㄡˊ ㄇㄡˊ', '崗位': 'ㄍㄤˇ ㄨㄟˋ', '站崗': 'ㄓㄢˋ ㄍㄤˇ'}
for w, ph in FIX.items(): DICT[w] = (10**9, ph.split(' '))

def readings(text):
    """投票：這段文字裡所有出現在詞庫的詞（2 個字以上）都投票，詞越常用、越長，票越重；
    每個字選得票最高的讀音，沒有詞涵蓋的字用預設讀音。回傳每個字在讀音表裡的位置"""
    n = len(text); votes = [dict() for _ in range(n)]
    for i in range(n):
        for j in range(i + 2, min(n, i + MAXW) + 1):
            w = text[i:j]
            if w not in DICT: continue
            wt = math.log(DICT[w][0] + 2) * (j - i)
            for k, p in enumerate(DICT[w][1]): votes[i + k][p] = votes[i + k].get(p, 0) + wt
    out = [0] * n
    for i, v in enumerate(votes):
        c = text[i]
        if not v or c in KEEP: continue
        p = max(v, key=v.get); rs = Z.get(c, [])
        if p in rs: out[i] = rs.index(p)
    return out

# 4. 讀音表：語詞、例句裡有破音字要換讀音的位置 [[第幾個字, 第幾個讀音], ...]
texts = set(L['WORDS'].values()) | set(L['SENT'].values())
for d in (L['WORDS_ED'], L['SENT_ED']):
    for m in d.values(): texts |= set(m.values())
TXT = {}
for t in sorted(texts):
    pos = [[i, r] for i, r in enumerate(readings(t)) if r]
    if pos: TXT[t] = pos
# 各課本的生字：依這本課本的語詞決定讀音（選項加注音時用）
CH = {}
for b, book in L['BOOKS'].items():
    for les in book['lessons'].values():
        for c in les['write'] + les['read']:
            w = (L['WORDS_ED'].get(b) or {}).get(c) or L['WORDS'].get(c) or ''
            r = readings(w)[w.index(c)] if c in w else 0
            if r: CH.setdefault(b, {})[c] = r

# 5. 字型子集：所有課本生字、干擾字、語詞、例句用到的字，加上提示用的符號
#    依課本（年級由低到高）分組：每個字放在第一次出現的那本課本的檔案
order = sorted(L['BOOKS'], key=lambda b: (L['BOOKS'][b]['grade'], L['BOOKS'][b]['term'] == '下', b))
def book_chars(b):
    s = set(); W = (L['WORDS_ED'].get(b) or {}); S = (L['SENT_ED'].get(b) or {}); C = (L['CONF_ED'].get(b) or {})
    for les in L['BOOKS'][b]['lessons'].values():
        for c in les['write'] + les['read']:
            s |= {c} | set(W.get(c) or L['WORDS'].get(c) or '') | set(S.get(c) or L['SENT'].get(c) or '')
            s |= set(''.join(C.get(c) or L['CONF'].get(c) or []))
    return s
groups, seen = [set('○（　）的')], set('○（　）的')
for b in order:
    g = book_chars(b) - seen
    groups.append(g); seen |= g
rest = set()
for t in texts: rest |= set(t)
for v in L['CONF'].values(): rest |= set(''.join(v))
groups.append(rest - seen)
groups = [g for g in ({c for c in g if not c.isspace()} for g in groups) if g]
chars = set().union(*groups)
import os
for f in os.listdir(OUT_DIR):
    if f.startswith('bpmf-kai'): os.remove(os.path.join(OUT_DIR, f))
css, total = [], 0
for i, g in enumerate(groups):
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = []; opts.drop_tables += ['vhea', 'vmtx', 'BASE']
    font = TTFont(FONT)
    sub = subset.Subsetter(opts); sub.populate(unicodes=[ord(c) for c in g] + list(range(0xE01E0, 0xE01F0)))
    sub.subset(font); name = f'bpmf-kai-{i + 1}.woff2'; font.save(os.path.join(OUT_DIR, name))
    total += os.path.getsize(os.path.join(OUT_DIR, name))
    rng = ','.join(f'U+{ord(c):X}' for c in sorted(g)) + ',U+E01E0-E01EF'
    css.append(f'@font-face{{font-family:"BpmfKai";font-display:swap;src:url({name}) format("woff2");unicode-range:{rng}}}')
with open(os.path.join(OUT_DIR, 'bpmf-kai.css'), 'w', encoding='utf8') as f:
    f.write('/* 注音字型（自動產生，見 docs/scripts/make_bpmf.py）。改自 But Ko「ㄅ字嗨注音標楷」（https://github.com/ButTaiwan/bpmfvs），\n'
            '   漢字部分 CC BY 4.0，其餘 SIL OFL 1.1；保留字名「字嗨」。依課本拆成幾個檔，瀏覽器只下載用到的字所在的檔。 */\n')
    f.write('\n'.join(css) + '\n')
OUT_FONT_INFO = f'{len(groups)} 個檔共 {total // 1024} KB（最大 {max(os.path.getsize(os.path.join(OUT_DIR, f"bpmf-kai-{i+1}.woff2")) for i in range(len(groups))) // 1024} KB）'

head = '''/* =========================================================
   注音讀音表（自動產生，不要手改；新增課本後請 Claude 重新執行 docs/scripts/make_bpmf.py）
   搭配 shared/fonts/bpmf-kai.css（改自 But Ko「ㄅ字嗨注音標楷」bpmfvs：漢字 CC BY 4.0、其餘 SIL OFL 1.1）。
   注音字型裡每個字都有預設讀音；破音字在字後面加一個看不見的記號（異體字選擇子）換成別的讀音。
   語詞的讀音依新酷音詞庫（libchewing-data，LGPL-2.1）判斷，少數詞人工修正；「一」「不」標本調。

   BPMF_TXT：語詞、例句 → 要換讀音的位置 [[第幾個字(從 0 算), 第幾個讀音(0＝預設)], ...]
   BPMF_CH：各課本的生字 → 在這本課本語詞裡的讀音（選項加注音時用）
   ========================================================= */
'''
api = '''
const Bpmf = (() => {
  const vs = n => n ? String.fromCodePoint(0xE01E0 + n) : "";
  /* 一段文字加上讀音記號 */
  const text = s => { const p = Object.fromEntries(BPMF_TXT[s] || []); return [...s].map((c, i) => c + vs(p[i] || 0)).join(""); };
  /* 加上讀音記號後，把目標字（連同它的記號）換成空格，例如「努力的○」 */
  const blank = (s, c, rep) => text(s).replace(new RegExp(c + "[\\\\u{E01E0}-\\\\u{E01EF}]?", "gu"), rep);
  /* 一個生字：用這本課本語詞裡的讀音 */
  const char = (c, b) => c + vs((BPMF_CH[b] || {})[c] || 0);
  return {text, blank, char};
})();
'''
with open(OUT_JS, 'w', encoding='utf8') as f:
    f.write(head)
    f.write('const BPMF_TXT = ' + json.dumps(TXT, ensure_ascii=False, separators=(',', ':')) + ';\n')
    f.write('const BPMF_CH = ' + json.dumps(CH, ensure_ascii=False, separators=(',', ':')) + ';\n')
    f.write(api)
print(f'字數 {len(chars)}，字型 {OUT_FONT_INFO}，讀音表 {os.path.getsize(OUT_JS)//1024} KB，'
      f'有破音字的語詞例句 {len(TXT)} 句，生字換讀音 {sum(len(v) for v in CH.values())} 個')
