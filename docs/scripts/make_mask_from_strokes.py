"""
用教育部筆畫自動算「聽音補部件（R5）遮擋位置」（docs/scripts/make_mask_from_strokes.py，2026-11-17 新增）

為什麼：遮擋位置原本靠維護者用遮擋位置調整工具手調；老師改了第一層（或部件寫法統一成部首變體）後，舊的調整對不上，遊戲就改用預設位置
  （check.js 會提醒）。教育部筆畫知道「每個部件是哪幾筆」，可以直接算出每個部件要遮的方框，不用手調。
做法：照部件表第一層，每個部件的筆畫數（單獨的字用自己的筆畫數、偏旁用反推的、或 make_ruler.py 的 PART_STROKES）把筆畫按書寫順序分給各部件
  → 把筆畫放到遊戲裡字的實際位置（遊戲把字放在 1em 的方框、line-height:1；位置用瀏覽器量字型的外框，見下面 ink.json）
  → 每個部件用 1～8 個方框蓋住它的筆畫（外框多留 3%），挑「蓋到別的部件的筆畫不超過 2%」而且方框最少的切法（形狀太貼近會洩漏答案）。
  部件交錯的字（例如栽）方框蓋不乾淨（蓋到別的部件 10% 以上），不套用，留給維護者手調。
只做舊調整已經有的塊號（不增加 R5 題目）。輸出：maskfix-new.json（格式同 docs/materials/mask-fix.json 的「個別字」），
  合併進 docs/materials/mask-fix.json 後執行 node docs/scripts/make_mask_fix.js。
需要：make_ruler.py 的筆畫資料夾（g0v zh-stroke-data）、ink.json（每個字在 1em 方框裡的外框 [左,上,右,下]；用練習簿網頁的 glyphCanvas 量，
  再換成 1em：(v - 0.1) / 0.8）。這支腳本是暫時的做法；之後遊戲的遮擋改用筆畫（pending.md「遮擋改用筆畫 2.0」）就不需要了。
執行（repo 最上層）：python3 -I docs/scripts/make_mask_from_strokes.py 筆畫資料夾 ink.json 輸出.json 字串
"""
import sys, os, runpy, json, numpy as np
from PIL import Image, ImageDraw
STROKES, INK, OUT, CHARS = sys.argv[1:5]
sys.argv=['make_ruler.py', STROKES]
G=runpy.run_path('docs/scripts/make_ruler.py', run_name='mk')
load_strokes=G['load_strokes']; flatten=G['flatten']; piece_count=G['piece_count']; RADICAL=G['RADICAL']; PART_STROKES=G['PART_STROKES']
ink=json.load(open(INK))
layer1=json.loads(__import__('subprocess').run(['node','-e','''
global.window={};eval(["shared/parts.js","shared/parts-layers.js","shared/parts-api.js"].map(f=>require("fs").readFileSync(f,"utf8")).join(";"));
const o={};for(const c of process.argv[1]){const r=window.Parts.layer(c,1);o[c]=r?r.parts:null}console.log(JSON.stringify(o))''',CHARS],capture_output=True,text=True).stdout)
old=json.load(open('docs/materials/mask-fix.json',encoding='utf-8'))['個別字']
M=512
G['fetch_strokes'](sorted(set(''.join(layer1)) | {x for ps in layer1.values() if ps for p in ps for x in p}))
G['_sc'].clear()
def fixbox(c): # 遊戲裡 1em 方框中字的筆畫外框（練習簿的畫布把字畫成 0.8em，換算成 1em）
    x0,y0,x1,y1=ink[c]; f=lambda v:(v-.1)/.8
    return f(x0),f(y0),f(x1),f(y1)
out={}; report=[]
for c,parts in layer1.items():
    st=load_strokes(c); N=len(st)
    sizes=[piece_count(p,RADICAL) if len(p)==1 else None for p in parts]
    if c in PART_STROKES and len(PART_STROKES[c])==len(parts) and sum(PART_STROKES[c])==N: sizes=list(PART_STROKES[c])
    unk=[i for i,k in enumerate(sizes) if k is None]
    if len(unk)==1: sizes[unk[0]]=N-sum(k for k in sizes if k is not None)
    if None in sizes or sum(sizes)!=N: report.append((c,'部件筆畫數對不上',sizes,N)); continue
    allp=[p for s in st for p in flatten(s['outline'],2)]
    sx0,sx1=min(p[0] for p in allp),max(p[0] for p in allp); sy0,sy1=min(p[1] for p in allp),max(p[1] for p in allp)
    bx0,by0,bx1,by1=fixbox(c)
    def tr(pt): return ((bx0+(pt[0]-sx0)/(sx1-sx0)*(bx1-bx0))*M,(by0+(pt[1]-sy0)/(sy1-sy0)*(by1-by0))*M)
    masks=[]; i0=0
    for k in sizes:
        im=Image.new('L',(M,M),0); dr=ImageDraw.Draw(im)
        for s in st[i0:i0+k]: dr.polygon([tr(p) for p in flatten(s['outline'])],fill=255)
        masks.append(np.array(im)>127); i0+=k
    keys=[k for k in old.get(c,{}) if k!='ps']
    ent={'ps':' '.join(parts)}; info=[]
    for idx in range(1,len(parts)+1):
        if len(parts)==2 and str(idx) not in keys and keys: continue   # 只做舊調整有的塊號（不增加題目）
        own=masks[idx-1]; other=np.zeros_like(own)
        for j,m in enumerate(masks):
            if j!=idx-1: other|=m
        best=None
        for ax in (0,1):
            for K in range(1,9):
                ys,xs=np.nonzero(own); lo,hi=(xs.min(),xs.max()+1) if ax==0 else (ys.min(),ys.max()+1)
                edges=np.linspace(lo,hi,K+1).astype(int); rects=[]
                for a,b in zip(edges,edges[1:]):
                    sub=own[:,a:b] if ax==0 else own[a:b,:]
                    if not sub.any(): continue
                    yy,xx=np.nonzero(sub)
                    if ax==0: r=(a+xx.min(),yy.min(),a+xx.max()+1,yy.max()+1)
                    else: r=(xx.min(),a+yy.min(),xx.max()+1,a+yy.max()+1)
                    rects.append(r)
                mg=int(.03*M)
                rects=[(max(int(.02*M),r[0]-mg),max(int(.02*M),r[1]-mg),min(int(.98*M),r[2]+mg),min(int(.98*M),r[3]+mg)) for r in rects]
                cov=np.zeros_like(own)
                for r in rects: cov[r[1]:r[3],r[0]:r[2]]=True
                bad=(cov&other).sum()/max(1,other.sum())
                score=(0 if bad<=.02 else round(bad,3),len(rects))   # 蓋到別的部件不超過 2% 就算可以，優先用少的方框（形狀太貼近會洩漏答案）
                if best is None or score<best[0]: best=((round(bad,3),len(rects)) if False else score,rects,ax,K,bad)
        (_s,n),rects,ax,K,bad=best
        ent[str(idx)]=[[round(r[0]/M,2),round(r[1]/M,2),round(r[2]/M,2),round(r[3]/M,2),0] for r in rects]
        info.append((idx,len(rects),f'蓋到別的部件 {bad*100:.1f}%'))
    out[c]=ent; report.append((c,sizes,info))
json.dump(out,open(OUT,'w'),ensure_ascii=False)
for r in report: print(r)
