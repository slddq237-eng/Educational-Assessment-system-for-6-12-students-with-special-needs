"""
產生標準楷書字型子集（給 Claude 或熟悉程式的人執行，老師不用動）

為什麼需要：原本網頁的楷書用 Google Fonts「霞鶩文楷」，它改自日本字型，很多字的筆畫、部件和
教育部標準楷書不同（例如「骨、這、述、令、刃」），學生容易學錯。改用行政院「全字庫正楷體」（TW-Kai），
字形依教育部國字標準字體；字型檔放在 repo 裡，每台電腦、平板、手機看到的字形都一樣。

新增課本（改了 shared/lessons.js）、部件（shared/parts.js）或頁面文字之後要重新執行一次，新的字才會是標準楷書
（沒收錄的字會改用電腦裡的標楷體，Mac 和手機可能顯示成別的字型）。
產生：shared/fonts/tw-kai-*.woff2、tw-kai.css
  只收錄平台用到的字，依「頁面文字 → 各課本（年級由低到高）→ 部件」拆成幾個小檔；
  CSS 的 unicode-range 讓瀏覽器只下載畫面上用到的字所在的那幾個檔。
  只收中文字和全形標點；英文、數字交給後面的字型（全字庫正楷體的英數字比較寬）。

需要：Python 3、fonttools、brotli（pip install fonttools brotli）、Node.js
需要先下載（不放進 repo）：全字庫正楷體 TW-Kai-98_1.ttf
  https://www.cns11643.gov.tw/ 「下載專區」→ 字型下載（政府資料開放授權條款－第 1 版）
執行（在 repo 最上層）：
  python3 docs/scripts/make_kai.py <TW-Kai-98_1.ttf>
"""
import glob, json, os, subprocess, sys
from fontTools import subset
from fontTools.ttLib import TTFont

FONT = sys.argv[1]
OUT_DIR = 'shared/fonts'

# 1. 讀 lessons.js（用 Node 執行後轉成 JSON，和 make_bpmf.py 相同）
JS = r'''
const fs=require("fs");const src=fs.readFileSync("shared/lessons.js","utf8");
const o={};new Function(src+";Object.assign(this,{BOOKS,WORDS,WORDS_ED,SENT,SENT_ED,CONF,CONF_ED});").call(o);
console.log(JSON.stringify(o));'''
L = json.loads(subprocess.run(['node', '-e', JS], capture_output=True, text=True, check=True).stdout)

# 2. 要收錄哪些字：中文字、注音、全形標點（U+2E80 以後），字型裡有的才收
CMAP = TTFont(FONT).getBestCmap()
def cjk(s): return {c for c in s if ord(c) >= 0x2E80 and ord(c) in CMAP}
def read(f): return open(f, encoding='utf8').read()

# 3. 分組：每個字放在第一次出現的那一組
#    頁面文字（標題、按鈕、說明）每頁都會用到，放第一組；接著每本課本的生字、語詞、例句、形近字；
#    最後是 lessons.js 其他的字、部件
pages = set()
for f in glob.glob('**/*.html', recursive=True) + glob.glob('tools/**/*.js', recursive=True):
    pages |= cjk(read(f))
order = sorted(L['BOOKS'], key=lambda b: (L['BOOKS'][b]['grade'], L['BOOKS'][b]['term'] == '下', b))
def book_chars(b):
    s = set(); W = (L['WORDS_ED'].get(b) or {}); S = (L['SENT_ED'].get(b) or {}); C = (L['CONF_ED'].get(b) or {})
    for les in L['BOOKS'][b]['lessons'].values():
        for c in les['write'] + les['read']:
            s |= {c} | set(W.get(c) or L['WORDS'].get(c) or '') | set(S.get(c) or L['SENT'].get(c) or '')
            s |= set(''.join(C.get(c) or L['CONF'].get(c) or []))
    return cjk(''.join(s))
groups, seen = [pages], set(pages)
for b in order + ['rest', 'parts']:
    g = cjk(read('shared/lessons.js')) if b == 'rest' else cjk(read('shared/parts.js')) if b == 'parts' else book_chars(b)
    groups.append(g - seen); seen |= g
groups = [g for g in groups if g]

# 4. 產生字型檔與 CSS
for f in os.listdir(OUT_DIR):
    if f.startswith('tw-kai'): os.remove(os.path.join(OUT_DIR, f))
css, sizes = [], []
for i, g in enumerate(groups):
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = []; opts.drop_tables += ['vhea', 'vmtx', 'BASE']
    font = TTFont(FONT)
    sub = subset.Subsetter(opts); sub.populate(unicodes=[ord(c) for c in g])
    sub.subset(font); name = f'tw-kai-{i + 1}.woff2'; font.save(os.path.join(OUT_DIR, name))
    sizes.append(os.path.getsize(os.path.join(OUT_DIR, name)))
    rng = ','.join(f'U+{ord(c):X}' for c in sorted(g))
    css.append(f'@font-face{{font-family:"TWKai";font-display:swap;src:url({name}) format("woff2");unicode-range:{rng}}}')
with open(os.path.join(OUT_DIR, 'tw-kai.css'), 'w', encoding='utf8') as f:
    f.write('/* 標準楷書字型（自動產生，見 docs/scripts/make_kai.py）。取自行政院「全字庫正楷體」（TW-Kai，https://www.cns11643.gov.tw/），\n'
            '   政府資料開放授權條款－第 1 版。依頁面文字、課本、部件拆成幾個檔，瀏覽器只下載用到的字所在的檔。 */\n')
    f.write('\n'.join(css) + '\n')
print(f'字數 {len(seen)}，{len(groups)} 個檔共 {sum(sizes) // 1024} KB（最大 {max(sizes) // 1024} KB，頁面文字 {sizes[0] // 1024} KB）')
