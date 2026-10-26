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
  python3 docs/scripts/make_bpmf.py <BpmfZihiKaiStd-Regular.ttf> <phonic_table_Z.txt> <tsi.csv> [審訂表.pdf]

比對審訂表（每次都會做）：程式自動從教育部網站下載《國語一字多音審訂表》88 年版 PDF
  https://language.moe.gov.tw/001/Upload/Files/wxiao89/a.pdf （存在電腦的暫存資料夾，不放進 repo；
  下載過就不再下載）。不能上網時，可以自己下載後當第 4 個參數；給 skip 就不比對。
  需要 pdftotext（在 poppler-utils 套件裡）；沒有的話只會提醒，注音照樣產生。
  程式會列出語詞、例句、生字裡和審訂表不一致的讀音，請維護者對照課本後決定：
  要改就加進下面的 FIX，確認沒錯就加進 CHECKED，下次就不會再列出來。
  讀音以課本為主（2026-10-22 維護者決定）：課本 → 審訂表 → 詞庫。和審訂表不同但課本就是這樣標的，
  放進 CHECKED 並寫課本出處（例如「悶悶不樂」課本標變調）。

讀音怎麼決定：語詞、例句裡出現的每個詞庫詞（2 字以上）一起投票，詞越常用、越長票越重；
找到的讀音在字型裡排第幾個，就記第幾個（0＝字型預設讀音，不用記）。
單獨一個字（沒有組成詞）用字型的預設讀音；「一」「不」照課本標變調（2026-10-22 維護者查課本確定，規則見 sandhi()）；
「們、麼、個、和」詞庫常收口語讀音，一律用預設讀音。
"""
import json, math, re, subprocess, sys, unicodedata
from fontTools import subset
from fontTools.ttLib import TTFont

FONT, ZTABLE, TSI = sys.argv[1:4]
MOE_URL = 'https://language.moe.gov.tw/001/Upload/Files/wxiao89/a.pdf'   # 《國語一字多音審訂表》88 年版
MOE_PDF = sys.argv[4] if len(sys.argv) > 4 else 'auto'
OUT_DIR, OUT_JS = 'shared/fonts', 'shared/bpmf.js'

# 1. 讀 lessons.js（用 Node 執行後轉成 JSON）
JS = r'''
const fs=require("fs");const src=require("./docs/scripts/lessons-src.js")();
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
# 這些字詞庫常收口語讀音（我們ㄇㄣˊ、什麼ㄇㄛˊ、一個˙ㄍㄜ、和ㄏㄢˋ），課本照預設讀音標；「一」「不」另外用變調規則
KEEP = set('一不們麼個和')
# 「一」不變調的情況：統一、唯一這類詞的最後一個字（後面接別的字也不變）
YI_END = ('統一', '唯一', '獨一', '萬一', '之一', '單一', '劃一', '專一', '均一', '第一', '十一', '初一')
DIGITS = set('一二三四五六七八九十零〇')   # 數數、序數（一百、一千會變調，不放進來）
MAXW = 8

# 詞庫裡會造成誤判的詞（「都會到」的都不是都市的都）
for w in ('都會',): DICT.pop(w, None)
# 人工修正：詞 → 正確讀音（詞庫標錯或只收口語讀音的詞）
FIX = {'體會': 'ㄊㄧˇ ㄏㄨㄟˋ', '極大': 'ㄐㄧˊ ㄉㄚˋ',
       '瀕臨絕種': 'ㄅㄧㄣ ㄌㄧㄣˊ ㄐㄩㄝˊ ㄓㄨㄥˇ', '難字': 'ㄋㄢˊ ㄗˋ', '會中': 'ㄏㄨㄟˋ ㄓㄨㄥ',
       '悶悶不樂': 'ㄇㄣˋ ㄇㄣˋ ㄅㄨˊ ㄌㄜˋ',
       # 依教育部《國語一字多音審訂表》88 年版（詞庫兩種讀音同分或沒收這個詞）
       '綢繆': 'ㄔㄡˊ ㄇㄡˊ', '崗位': 'ㄍㄤˇ ㄨㄟˋ', '站崗': 'ㄓㄢˋ ㄍㄤˇ',
       # 2026-10-22 維護者對照課本後決定照審訂表
       '著急': 'ㄓㄠ ㄐㄧˊ', '著涼': 'ㄓㄠ ㄌㄧㄤˊ', '暖和': 'ㄋㄨㄢˇ ˙ㄏㄨㄛ', '我和你': 'ㄨㄛˇ ㄏㄢˋ ㄋㄧˇ',
       '擁擠': 'ㄩㄥ ㄐㄧˇ', '諸葛': 'ㄓㄨ ㄍㄜˊ', '角色': 'ㄐㄩㄝˊ ㄙㄜˋ', '埋怨': 'ㄇㄢˊ ㄩㄢˋ',
       '高麗': 'ㄍㄠ ㄌㄧˊ', '呱呱叫': 'ㄍㄨㄚ ㄍㄨㄚ ㄐㄧㄠˋ', '頂呱呱': 'ㄉㄧㄥˇ ㄍㄨㄚ ㄍㄨㄚ',
       '呱呱': 'ㄍㄨㄚ ㄍㄨㄚ',   # 翰林二上第 4 課青蛙叫聲，2026-10-22 維護者查課本確認（「呱呱墜地」才唸ㄍㄨ）
       '擁抱': 'ㄩㄥ ㄅㄠˋ'}   # 2026-10-23 翰林五上、南一五上新增時照審訂表（和擁擠一樣），待老師對照課本
for w, ph in FIX.items(): DICT[w] = (10**9, ph.split(' '))
FORCE = 10**9   # FIX 的詞連「們、麼、個、和」也照改（例如暖和、我和你）
# 語音唸題目的替換字：電腦語音會把這個詞裡的破音字唸錯，唸的時候換成「同音同調、只有一種唸法」的字。
# 只改唸出來的聲音，畫面上的字和注音不變。格式：詞 → (要換的字, 換成的字)。實機測試確認唸錯、讀音也確認過才加。
SAY = {'削價': ('削', '消'),   # 2026-10-22 老師反應唸成「ㄒㄩㄝ價的ㄒㄧㄠ」；康軒六上課本唸ㄒㄧㄠ
       # 2026-10-23 實機測試（家裡電腦 Windows）唸錯的；替換字都只有一種唸法、同音同調（規格書候選替換字表）
       '跌倒': ('倒', '導'), '放假': ('假', '架'), '暑假': ('假', '架'), '咀嚼': ('嚼', '決'),
       '反彈': ('彈', '談'), '彈簧': ('彈', '談'), '參與': ('與', '育'), '四處': ('處', '觸'),
       '油炸': ('炸', '閘'), '雞冠': ('冠', '關'), '不禁': ('禁', '今'), '縫隙': ('縫', '鳳'),
       '我和你': ('和', '漢'), '馬偕': ('偕', '街'), '諸葛亮': ('葛', '隔'),
       # 2026-10-23 實機測試（維護者，iPad Air 2）：「因為的為」最後的字唸成ㄨㄟˊ；「成為」本來就唸ㄨㄟˊ，不用換
       '因為': ('為', '位'),
       # 2026-10-26 實機測試（維護者，平板，測試頁）：「曲項的項」唸成「區項五的項」、換「向」變「曲向三的項」，開頭是「曲」的詞後面都會多一個音；
       # 把「曲」換成同音同調（ㄑㄩ 第一聲）、只有一種唸法的「驅」就正確了。「彎曲的曲」「歌曲」的曲不受影響
       '曲項': ('曲', '驅'),
       # 2026-10-26 實機測試（維護者）：「領子的領」唸成「ㄌㄧㄥˊㄗˇ的ㄌㄧㄥˇ」（領子的領唸成第二聲）；把「領」換成同音同調（ㄌㄧㄥˇ）、只有一種唸法的「嶺」。維護者實機測試確認唸讀正確
       '領子': ('領', '嶺')}
# 比對審訂表時，已經確認沒錯的（語詞或例句, 字）→ 原因；不會再列出來
CHECKED = {('肚子', '肚'): '人的肚子（例句：把肚皮都吃撐了），審訂表的ㄉㄨˇ是「豬肚子」',
           ('淡淡', '淡'): '淡淡的花香、清香，審訂表的ㄧㄢˇ是「若隱若現貌」',
           ('中的', '中'): '審訂表的「中的」是射中目標；課文是「傳說中」「故事中」＋「的」',
           ('馬偕', '偕'): '2026-10-22 維護者決定人名「馬偕」照課本唸ㄐㄧㄝ；其他有「偕」的語詞照審訂表ㄒㄧㄝˊ',
           ('馬偕博士在臺灣創辦了醫院。', '偕'): '同上（馬偕）'}

def readings(text):
    """投票：這段文字裡所有出現在詞庫的詞（2 個字以上）都投票，詞越常用、越長，票越重；
    每個字選得票最高的讀音，沒有詞涵蓋的字用預設讀音。回傳每個字在讀音表裡的位置"""
    n = len(text); votes = [dict() for _ in range(n)]; forced = set()
    for i in range(n):
        for j in range(i + 2, min(n, i + MAXW) + 1):
            w = text[i:j]
            if w not in DICT: continue
            wt = math.log(DICT[w][0] + 2) * (j - i)
            for k, p in enumerate(DICT[w][1]):
                votes[i + k][p] = votes[i + k].get(p, 0) + wt
                if DICT[w][0] == FORCE: forced.add(i + k)
    out = [0] * n
    for i, v in enumerate(votes):
        c = text[i]
        if not v or (c in KEEP and i not in forced): continue
        p = max(v, key=v.get); rs = Z.get(c, [])
        if p in rs: out[i] = rs.index(p)
    sandhi(text, out, forced)
    return out

def tone(r):
    return 0 if r.startswith('˙') else 2 if r.endswith('ˊ') else 3 if r.endswith('ˇ') else 4 if r.endswith('ˋ') else 1

def sandhi(text, out, forced):
    """「一」「不」照課本標變調（課本的做法，2026-10-22 維護者查康軒、南一課本確定）：
    不：後面是第四聲 → ㄅㄨˊ（不是、不要），其他 → ㄅㄨˋ（不同、不懂）
    一：後面是第四聲 → ㄧˊ（一定、一個），第一、二、三聲 → ㄧˋ（一起、一天、一點）
    不變調（標ㄧ）：單獨、在句尾或標點前、序數（第一、一月、一年級）、數數（一二三、十一）、
    統一、唯一這類詞的最後一個字、「看一看」這種重疊（課本標輕聲，字型沒有輕聲，先標本調）
    人工修正表 FIX 的詞照 FIX"""
    n = len(text)
    for i, c in enumerate(text):
        if c not in '一不' or i in forced: continue
        nx = text[i + 1] if i + 1 < n else ''
        if not nx or nx not in Z: out[i] = 0; continue
        t = tone(Z[nx][out[i + 1]])
        if t == 0: t = tone(Z[nx][0])               # 後面是輕聲：看它的本調
        if c == '不':
            out[i] = Z['不'].index('ㄅㄨˊ') if t == 4 else 0
            continue
        prev = text[i - 1] if i else ''
        if ((prev and prev in '第初') or nx in DIGITS or prev in DIGITS
                or text[i + 1:i + 2] == '月' or text[i + 1:i + 3] == '年級'
                or any(text[max(0, i - len(w) + 1):i + 1] == w for w in YI_END)
                or (prev and prev == nx)):
            out[i] = 0; continue
        out[i] = Z['一'].index('ㄧˊ' if t == 4 else 'ㄧˋ')

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
            r = readings(w)[w.index(c)] if c in w and c not in '一不' else 0   # 一、不單獨出現時唸本調
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
   語詞的讀音依新酷音詞庫（libchewing-data，LGPL-2.1）判斷，少數詞人工修正；「一」「不」照課本標變調。

   BPMF_TXT：語詞、例句 → 要換讀音的位置 [[第幾個字(從 0 算), 第幾個讀音(0＝預設)], ...]
   BPMF_CH：各課本的生字 → 在這本課本語詞裡的讀音（選項加注音時用）
   BPMF_SAY：電腦語音會唸錯的詞 → [要換的字, 換成的同音字]（只改唸出來的聲音）
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
  /* 唸出來的文字：電腦語音會唸錯的詞，把破音字換成同音字（畫面不變） */
  const sayText = s => Object.entries(BPMF_SAY).reduce((t, [w, [c, r]]) => t.split(w).join(w.split(c).join(r)), s);
  /* 唸題目「語詞的字」：語詞和最後那個字都照同一個讀音唸 */
  const say = (w, c) => { const f = BPMF_SAY[w]; return `${sayText(w)}的${f && f[0] === c ? f[1] : c}`; };
  return {text, blank, char, sayText, say};
})();
'''
with open(OUT_JS, 'w', encoding='utf8') as f:
    f.write(head)
    f.write('const BPMF_TXT = ' + json.dumps(TXT, ensure_ascii=False, separators=(',', ':')) + ';\n')
    f.write('const BPMF_CH = ' + json.dumps(CH, ensure_ascii=False, separators=(',', ':')) + ';\n')
    f.write('const BPMF_SAY = ' + json.dumps({w: list(v) for w, v in SAY.items()}, ensure_ascii=False, separators=(',', ':')) + ';\n')
    f.write(api)

# 6. 比對教育部《國語一字多音審訂表》88 年版（有給 PDF 才做）
def moe_table(pdf):
    """讀審訂表 PDF：字 → (合法讀音, {詞例或限讀的詞: 讀音})"""
    raw = subprocess.run(['pdftotext', '-raw', pdf, '-'], capture_output=True, text=True, check=True).stdout
    raw = unicodedata.normalize('NFKC', raw)   # PDF 有些字是相容字（看起來一樣、編碼不同），先統一
    fix = lambda p: re.sub('[|丨│]', 'ㄧ', p).replace('‧', '˙')   # PDF 用直線代替注音「ㄧ」
    BP = 'ㄅ-ㄩ|丨│ˊˇˋ˙‧'
    ent, cur = {}, None
    for line in raw.split('\n'):
        m = re.match(r'^\*?\d{4} (\S) (.*)$', line)
        if m: cur = m.group(1); ent[cur] = [m.group(2)]; continue
        if line.startswith('［'): cur = None   # 書末的同音字表
        if cur and not line.startswith(('教育部國語', '流水號')) and not re.match(r'^\s*－\d+－\s*$', line): ent[cur].append(line)
    T = {}
    for c, ls in ent.items():
        # 審定音：第一行，加上後面「2.ㄨㄟˋ」這種行；單獨的聲調符號接回上一個音，「讀」「語」「(限讀)」略過
        first = ls[0].strip(); rs = []
        m = re.match(r'(\d\.)?\s*([%s]+)(讀|語)?' % BP, first)   # 「讀」「語」＝讀書音、口語音
        if m: rs.append(m.group(2))
        k = 1
        if m and m.group(1):
            for line in ls[1:]:
                x = line.strip()
                if re.fullmatch(r'[ˊˇˋ˙]', x) and rs: rs[-1] += x
                elif x in ('讀', '語', '(限讀)'): pass
                elif re.fullmatch(r'\d\.\s*[%s]+(讀|語)?' % BP, x): rs.append(re.sub(r'^\d\.\s*|讀$|語$', '', x))
                else: break
                k += 1
        elif len(ls) > 1 and re.fullmatch(r'[ˊˇˋ˙]', ls[1].strip()) and rs: rs[-1] += ls[1].strip(); k = 2
        rs = [fix(r) for r in rs]
        if not rs: continue   # PDF 裡讀不到審定音的字（少數，略過）
        rest = (first[m.end():] if m else first) + ''.join(x.strip() for x in ls[k:])
        rest = re.sub(r'\s', '', rest)
        alt = {fix(x) for x in re.findall(r'音([%s]+)' % BP, rest)} - set(rs)   # 通假說明、備注裡提到的其他讀音
        ex = {}
        for k, seg in re.findall(r'(\d)\.(.*?)(?=\d\.|$)', rest.split('通「')[0]):   # 通假說明之後不是詞例
            k = int(k) - 1
            if k >= len(rs): continue
            for w in re.findall(r'[\u4e00-\u9fff]{2,}', seg):
                if c in w and w not in ex: ex[w] = rs[k]
        T[c] = (set(rs), alt, ex)
    return T
def moe_download():
    """下載審訂表 PDF 到暫存資料夾（下載過就直接用）；失敗回傳 None"""
    import os, ssl, shutil, tempfile, urllib.request
    path = os.path.join(tempfile.gettempdir(), 'moe-polyphone-88.pdf')
    if os.path.exists(path) and os.path.getsize(path) > 1_000_000: return path
    try:
        if shutil.which('curl'):   # curl 最穩
            subprocess.run(['curl', '-sSfL', '-m', '120', '-o', path, MOE_URL], check=True)
        else:   # 沒有 curl 用 Python 下載；照常檢查憑證，只是不用 Python 3.13 新加的嚴格模式（教育部網站的憑證過不了）
            ctx = ssl.create_default_context(); ctx.verify_flags &= ~getattr(ssl, 'VERIFY_X509_STRICT', 0)
            with urllib.request.urlopen(MOE_URL, timeout=120, context=ctx) as r, open(path, 'wb') as f: f.write(r.read())
        with open(path, 'rb') as f:
            if f.read(5) != b'%PDF-': raise ValueError('下載到的不是 PDF')
        return path
    except Exception as e:
        if os.path.exists(path): os.remove(path)
        print(f'\n⚠ 下載審訂表失敗（{e}），這次沒有比對讀音。可以自己下載 {MOE_URL} 後當第 4 個參數。')
        return None
def same_but_tone(a, b): return a.lstrip('˙').rstrip('ˊˇˋ') == b.lstrip('˙').rstrip('ˊˇˋ')
import shutil
if MOE_PDF == 'skip': MOE_PDF = None
elif not shutil.which('pdftotext'):
    print('\n⚠ 找不到 pdftotext（poppler-utils 套件），這次沒有比對審訂表。'); MOE_PDF = None
elif MOE_PDF == 'auto': MOE_PDF = moe_download()
if MOE_PDF:
    T = moe_table(MOE_PDF); found = []
    def check(t, pos_reading, where, only=None):
        for i, c in enumerate(t):
            if c not in T or c not in Z or (only is not None and i != only) or (t, c) in CHECKED: continue
            if c in '一不': continue    # 照課本標變調，審訂表只列本調，不比對
            p = Z[c][pos_reading.get(i, 0)]; ok, alt, ex = T[c]
            # 詞例：審訂表列出的詞出現在這段文字裡，而且蓋到這個字
            for w, wp in ex.items():
                for j in range(max(0, i - len(w) + 1), i + 1):
                    if t[j:j + len(w)] == w and w[i - j] == c and p != wp and not (p.startswith('˙') and same_but_tone(p, wp)):
                        if (w, c) not in CHECKED: found.append((where, t, c, p, f'審訂表「{w}」唸{wp}'))
            # 讀音不在審訂表裡（輕聲不算錯：審訂表只列本調）
            if p not in ok and not (p.startswith('˙') and any(same_but_tone(p, q) for q in ok)):
                found.append((where, t, c, p, '審訂表只有 ' + '、'.join(sorted(ok)) + ('（' + p + '只在通假或特殊用法，見備注）' if p in alt else '')))
    for t in sorted(texts): check(t, dict(TXT.get(t, [])), '語詞例句')
    for b, book in L['BOOKS'].items():   # 生字：用這本課本語詞裡的讀音（BPMF_CH），沒有記就是預設讀音
        for c in ''.join(les['write'] + les['read'] for les in book['lessons'].values()):
            r = (CH.get(b) or {}).get(c, 0)
            w = (L['WORDS_ED'].get(b) or {}).get(c) or L['WORDS'].get(c) or ''
            if c in w: check(w, {w.index(c): r}, f'生字（{b}）', only=w.index(c))
    seen_f = set(); uniq = [f for f in found if not (f[1:] in seen_f or seen_f.add(f[1:]))]
    print(f'\n比對審訂表 88 年版：審訂表 {len(T)} 字，和平台讀音不一致 {len(uniq)} 處（讀音以課本為主，請對照課本：課本和平台不同就加進 FIX，課本就是這樣標就加進 CHECKED 並寫出處）')
    for where, t, c, p, why in uniq: print(f'  {c}：平台{p}，{why}｜{where}：{t}')

print(f'字數 {len(chars)}，字型 {OUT_FONT_INFO}，讀音表 {os.path.getsize(OUT_JS)//1024} KB，'
      f'有破音字的語詞例句 {len(TXT)} 句，生字換讀音 {sum(len(v) for v in CH.values())} 個')
