/* =========================================================
   識字評量：打怪獸場景（scenes.js）
   四個主題場景移植自原本的生字賓果（2026-10-21 已移除）：
   海洋＝釣神秘大魚、太空＝勇士打外星人、恐龍谷＝敲開神秘恐龍蛋、甜點店＝疊超級大蛋糕。
   和賓果不同的地方：
   - 只在題目之間的固定長度過場出現（作答時看不到），每做完幾題一次（play.js 的 sceneEvery）。
   - 依「第一次就答對」的題數前進；都沒答對播 miss（再加油），不前進。最後一律完成，但蛋糕高度、外星人剩的血照答對題數。
   - 打敗怪獸得到的東西就是這次的貼紙（由 collect.js 的 drawStickers 發、giveStickers 揭曉）。
   - 題目很多時，太空的血條最多 20 格、蛋糕最多 12 層，依比例前進。
   每個場景回傳 {setPlayer(學生代號), hit(累計答對題數, 還剩幾題), miss(還剩幾題), win(累計答對題數) → {bannerAt, delay}, stop()}。
   ========================================================= */
(() => {
const {THEMES, RARE_GLOW, FISH, DINOS, fishBody, dinoSvg} = Themes;
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
function retrigger(el,cls,ms){ if(!el) return; el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); clearTimeout(el["_t_"+cls]); el["_t_"+cls]=setTimeout(()=>el.classList.remove(cls),ms); }
/* 場景裡的主角換成這位學生的頭像（照片或卡通動物）；沒有頭像資料時保留原本畫的臉 */
function avHref(code){
  const a = code ? (Rewards.get(code).avatar || {}) : {};
  return a.type === "photo" && a.data ? a.data : a.type === "animal" ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(Rewards.animalSvg(a.id).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')) : "";
}
function setSvgAv(img, face, code){
  if(!img) return;
  const href = avHref(code);
  if(href){ img.setAttribute("href", href); img.style.display = ""; face.style.display = "none"; }
  else { img.style.display = "none"; face.style.display = ""; }
}
/* 場景音效（跟著「畫面與聲音」的音效開關）；ac() 在 play.js */
function tone(f,t0,dur,type="sine",vol=.18){ const c=ac(); if(!c) return; try { const o=c.createOscillator(), g=c.createGain(); o.type=type; o.frequency.value=f;
  const t=c.currentTime+t0; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.02); g.gain.exponentialRampToValueAtTime(.001,t+dur); o.connect(g).connect(c.destination); o.start(t); o.stop(t+dur+.05); } catch(e){} }
function sweep(f0,f1,t0,dur,type="sine",vol=.15){ const c=ac(); if(!c) return; try { const o=c.createOscillator(), g=c.createGain(); o.type=type; const t=c.currentTime+t0;
  o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(f1,t+dur); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur); o.connect(g).connect(c.destination); o.start(t); o.stop(t+dur+.05); } catch(e){} }
let nbuf=null;
function noise(t0,dur,vol,f0,f1,type="bandpass"){ const c=ac(); if(!c) return; try {
  if(!nbuf){ nbuf=c.createBuffer(1,c.sampleRate,c.sampleRate); const d=nbuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
  const s=c.createBufferSource(); s.buffer=nbuf; const f=c.createBiquadFilter(); f.type=type; f.Q.value=1.2; const t=c.currentTime+t0;
  f.frequency.setValueAtTime(f0,t); if(f1) f.frequency.exponentialRampToValueAtTime(f1,t+dur);
  const g=c.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur); s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t+dur+.05); } catch(e){} }
const on = f => (...a) => { if(settings.sfx) f(...a); };
const SFX = {
  hit: on(()=>{ tone(180,0,.15,"square",.08); tone(120,.08,.2,"square",.06); }),
  reel: on(()=>{ for(let i=0;i<12;i++) tone(1300+(i%2)*350,i*.045,.03,"square",.035); }),
  splash: on(()=>noise(0,.8,.4,1800,250,"lowpass")),
  bloop: on(()=>sweep(520,140,0,.3,"sine",.16)),
  slash: on(()=>noise(0,.22,.35,5000,700,"bandpass")),
  zap: on(()=>sweep(1300,160,0,.4,"sawtooth",.07)),
  crack: on(()=>{ noise(0,.05,.45,3200,0,"highpass"); noise(.08,.04,.35,2600,0,"highpass"); }),
  hatch: on(()=>[392,523,659,784,1047].forEach((f,i)=>tone(f,i*.09,.45,"triangle",.18)))
};

/* --- 海洋：釣神秘大魚 --- */
/* 神秘大魚的剪影（2026-10-24 維護者決定 O2）：遊戲中和結尾都用同一個通用的形狀，不用這次戰利品的真實形狀，
   學生才猜不到是哪一條；扭蛋機打開時才揭曉（gacha.js）。座標和 themes.js 的 fishBody 一樣（魚頭朝左、嘴在 x≈0） */
const MYSTERY_FISH = `<path d="M126 0 L164 -34 L156 0 L164 34Z" fill="#333"/><path d="M60 -38 L80 -62 L98 -36Z" fill="#333"/>
  <path d="M0 2 Q14 -46 74 -44 Q134 -40 140 0 Q134 40 74 44 Q14 46 0 2Z" fill="#333"/><path d="M70 30 L60 52 L88 34Z" fill="#333"/>`;
function oceanScene(el, goal, prize){
  const DEEP=280, NEAR=150, SURF=112;
  let ticks=""; for(let m=0;m<=10;m+=2){ const y=SURF+m/10*(DEEP-SURF); ticks+=`<line x1="14" x2="24" y1="${y}" y2="${y}" stroke="#d7f3ff" stroke-width="2" opacity=".8"/><text x="28" y="${y+4}" font-size="12" fill="#d7f3ff">${m}</text>`; }
  el.innerHTML = `<svg class="scn" viewBox="0 0 560 360" role="img" aria-label="把神秘大魚釣上來">
  <defs>
    <linearGradient id="oSkyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd0f2"/><stop offset="1" stop-color="#d7f3ff"/></linearGradient>
    <linearGradient id="oSeaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a9fd0"/><stop offset="1" stop-color="#05263a"/></linearGradient>
    <clipPath id="oAvClip"><circle cx="119" cy="42" r="25"/></clipPath>
  </defs>
  <rect width="560" height="360" fill="url(#oSkyG)"/>
  <circle cx="34" cy="30" r="15" fill="#ffe27a"/>
  <g fill="#fff" opacity=".9"><circle cx="232" cy="40" r="10"/><circle cx="246" cy="34" r="13"/><circle cx="261" cy="41" r="9"/><circle cx="452" cy="30" r="9"/><circle cx="466" cy="24" r="12"/><circle cx="480" cy="31" r="8"/></g><path d="M300 22 q6 -5 12 0 q6 -5 12 0 M326 36 q5 -4 10 0 q5 -4 10 0" stroke="#4a6a80" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M478 112 Q505 94 540 112Z" fill="#e8d39a"/><path d="M512 104 Q514 84 520 72" stroke="#7a5a2c" stroke-width="4" fill="none" stroke-linecap="round"/><g fill="#4f9a3a"><path d="M520 72 Q504 64 494 72 Q508 70 520 74Z"/><path d="M520 72 Q536 62 548 72 Q534 68 520 74Z"/><path d="M520 72 Q518 58 506 54 Q516 62 519 74Z"/></g>
  <path id="oBack" fill="url(#oSeaG)"/>
  <g opacity=".08" fill="#fff"><path d="M150 112 L180 112 L140 360 L90 360Z"/><path d="M300 112 L320 112 L344 360 L294 360Z"/><path d="M450 112 L466 112 L496 360 L452 360Z"/></g>
  <g fill="#3a5a6a"><ellipse cx="120" cy="362" rx="46" ry="16"/><ellipse cx="260" cy="366" rx="30" ry="12"/><ellipse cx="520" cy="360" rx="50" ry="18"/></g><g fill="none" stroke="#3fb37f" stroke-width="5" stroke-linecap="round"><path d="M90 360 q-10 -20 0 -40 q10 -20 0 -40"/><path d="M106 360 q10 -16 0 -32 q-10 -16 0 -30"/><path d="M250 360 q-8 -14 0 -28 q8 -14 0 -26"/><path d="M500 360 q-10 -18 0 -36 q10 -18 0 -34"/><path d="M530 360 q10 -20 0 -40 q-10 -20 0 -36"/></g><g fill="#ff8a8a"><path d="M180 360 l-6 -22 l6 8 l4 -16 l4 16 l6 -8 l-6 22Z"/><path d="M420 360 l-5 -18 l5 6 l3 -13 l3 13 l5 -6 l-5 18Z" fill="#ffb36b"/></g><g opacity=".7"><path d="M200 200 q10 -8 20 0 q-10 8 -20 0Z M220 200 l8 -6 l0 12Z" fill="#ffcf3f"/><path d="M150 250 q8 -6 16 0 q-8 6 -16 0Z M166 250 l6 -5 l0 10Z" fill="#ff8a65"/><path d="M470 180 q10 -8 20 0 q-10 8 -20 0Z M470 180 l-8 -6 l0 12Z" fill="#9fe0ff"/></g>
  <g>${ticks}<text x="10" y="${DEEP+24}" font-size="12" fill="#d7f3ff">水深(公尺)</text><path id="oMark" d="M0 0 L-8 -6 L-8 6Z" fill="#ffcc4d"/></g>
  <path id="oLine" fill="none" stroke="#ffffff" stroke-width="1.6"/>
  <g id="oFish"><path d="M-1 0 Q-10 -1 -10 -10 Q-10 -16 -4 -16" fill="none" stroke="#dfe7ee" stroke-width="2.5" stroke-linecap="round"/>
    <g id="oSkin" style="filter:brightness(0);opacity:.6;transition:opacity .9s">${MYSTERY_FISH}</g></g>
  <path id="oFront" fill="#0b5f88" opacity=".2" pointer-events="none"/>
  <g id="oBub"></g>
  <g transform="translate(110 0)"><g id="oBoat">
    <path d="M102 92 V74 Q102 64 119 64 Q136 64 136 74 V92 Z" fill="#ffb02e" stroke="#9a5a00" stroke-width="2.5"/>
    <path d="M132 74 Q142 76 150 80" stroke="#ffb02e" stroke-width="9" stroke-linecap="round" fill="none"/>
    <circle cx="150" cy="80" r="5" fill="#f2c9a0" stroke="#9a5a00" stroke-width="1.5"/>
    <g id="oFace"><circle cx="119" cy="42" r="25" fill="#f6d2ac"/><circle cx="110" cy="42" r="3" fill="#333"/><circle cx="128" cy="42" r="3" fill="#333"/><path d="M110 51 Q119 58 128 51" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>
    <image id="oAv" x="94" y="17" width="50" height="50" clip-path="url(#oAvClip)" preserveAspectRatio="xMidYMid slice" style="display:none"/>
    <circle cx="119" cy="42" r="25" fill="none" stroke="#fff" stroke-width="3"/>
    <path d="M88 22 Q119 13 150 22 L143 17 Q119 -6 95 17 Z" fill="#ffd23f" stroke="#9a7a00" stroke-width="2" stroke-linejoin="round"/>
    <path d="M56 92 H196 L182 120 H72 Z" fill="#e2553f" stroke="#7a2418" stroke-width="3" stroke-linejoin="round"/>
    <path d="M64 101 H189" stroke="#fff" stroke-width="4"/>
  </g></g>
  <path id="oRod" fill="none" stroke="#6b4423" stroke-width="4.5" stroke-linecap="round"/>
  <g id="oSplash"></g>
  </svg><div class="scenelab" id="sceneLab"></div>`;
  const q=id=>el.querySelector("#"+id);
  const back=q("oBack"), front=q("oFront"), rod=q("oRod"), line=q("oLine"), fish=q("oFish"), boat=q("oBoat"), mark=q("oMark"), bub=q("oBub"), spl=q("oSplash");
  const S={y:DEEP, ty:DEEP, vy:0, ten:.3, wob:3, lift:0, win:false, fx:220, fy:DEEP, done:0};
  let raf;
  function wave(t){ let d=`M0 ${SURF}`; for(let x=0;x<=560;x+=16) d+=` L${x} ${(SURF+Math.sin(x/28+t*1.8)*2.5).toFixed(1)}`; return d+" L560 360 L0 360Z"; }
  function frame(now){
    const t=now/1000;
    if(REDUCE){ S.y=S.ty; } else { S.vy += (S.ty-S.y)*0.05; S.vy *= 0.82; S.y += S.vy; }
    S.ten += ((S.win?1:0.3)-S.ten)*0.035; S.wob += ((S.win?6:3)-S.wob)*0.03; S.lift += ((S.win?1:0)-S.lift)*0.06;
    const bob = REDUCE?0:Math.sin(t*1.6)*2.5;
    const bx=260, by=80+bob;
    const tipx = 372 - S.ten*8 - S.lift*14, tipy = 14 + S.ten*26 - S.lift*34 + bob*.5;
    const cx=(bx+tipx)/2 + 4, cy=(by+tipy)/2 - 14 + S.ten*16;
    rod.setAttribute("d",`M${bx} ${by.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${tipx.toFixed(1)} ${tipy.toFixed(1)}`);
    const wx = REDUCE?0:Math.sin(t*5.3)*S.wob;
    S.fx = tipx + wx; S.fy = S.win ? Math.max(S.y, tipy+12) : S.y;
    const sag=(1-S.ten)*22;
    line.setAttribute("d",`M${tipx.toFixed(1)} ${tipy.toFixed(1)} Q${((tipx+S.fx)/2+sag).toFixed(1)} ${((tipy+S.fy)/2).toFixed(1)} ${S.fx.toFixed(1)} ${S.fy.toFixed(1)}`);
    const ang = S.win ? 72 + (REDUCE?0:Math.sin(t*7)*S.wob*1.4) : 25 + S.ten*45 + (REDUCE?0:Math.sin(t*7.7)*S.wob*1.8);
    fish.setAttribute("transform",`translate(${S.fx.toFixed(1)} ${S.fy.toFixed(1)}) rotate(${ang.toFixed(1)}) scale(.74)`);
    boat.setAttribute("transform",`translate(0 ${bob.toFixed(1)})`);
    const w=wave(t); back.setAttribute("d",w); front.setAttribute("d",w);
    mark.setAttribute("transform",`translate(14 ${Math.min(DEEP,Math.max(SURF,S.fy)).toFixed(1)})`);
    raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  function bubbles(n){ for(let i=0;i<n;i++){ const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx",(S.fx+20+Math.random()*40).toFixed(1)); c.setAttribute("cy",(S.fy-4+Math.random()*16).toFixed(1)); c.setAttribute("r",(2+Math.random()*4).toFixed(1));
    c.setAttribute("fill","none"); c.setAttribute("stroke","#d7f3ff"); c.setAttribute("stroke-width","1.5"); c.setAttribute("class","bub"); c.style.animationDelay=(i*0.07)+"s";
    bub.appendChild(c); setTimeout(()=>c.remove(),1800); } }
  function splash(){ for(let i=0;i<18;i++){ const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx",(S.fx-10+Math.random()*30).toFixed(1)); c.setAttribute("cy",SURF); c.setAttribute("r",(2+Math.random()*4).toFixed(1)); c.setAttribute("fill","#e2f7ff");
    c.setAttribute("class","drop"); c.style.setProperty("--dx",((Math.random()-.5)*110).toFixed(0)+"px"); c.style.setProperty("--dy",(-20-Math.random()*70).toFixed(0)+"px");
    spl.appendChild(c); setTimeout(()=>c.remove(),1100); } }
  let qLeft=goal;   /* 還剩幾題 */
  function label(){ const depth=Math.round((S.ty-SURF)/(DEEP-SURF)*10);
    q("sceneLab").textContent = S.win ? "釣到神秘大魚了！拉拉桿看看是哪一條" : `神秘大魚在水深 ${depth} 公尺，再答 ${qLeft} 題！`; }
  label();
  return {
    setPlayer(p){ setSvgAv(q("oAv"), q("oFace"), p); },
    hit(done, left){ S.done=done; if(left!=null) qLeft=left; S.ty = DEEP-(DEEP-NEAR)*(done/goal); S.ten=1; S.wob=14; bubbles(6); SFX.reel(); label(); },
    miss(left){ if(left!=null){ qLeft=left; label(); } const keep=S.ty; S.ty=Math.min(DEEP+20,keep+28); S.ten=.9; S.wob=22; bubbles(4); SFX.bloop(); setTimeout(()=>{ if(!S.win) S.ty=keep; },600); },
    win(){ S.win=true; S.done=goal; S.ty=40; S.ten=1; S.wob=18; SFX.reel(); label();
      /* 釣起來了，但還是黑影（不暴雷）：顏色和名字留到扭蛋機揭曉 */
      setTimeout(()=>{ splash(); SFX.splash(); q("oSkin").style.opacity="1"; },500);
      setTimeout(splash,800);
      return {bannerAt:900, delay:3000}; },
    stop(){ cancelAnimationFrame(raf); }
  };
}

/* --- 太空：勇士對決外星人 --- */
function spaceScene(el, goal){
  const NSEG=Math.min(goal,20), segW=(130-(NSEG-1)*3)/NSEG; let hp=""; for(let i=0;i<NSEG;i++) hp+=`<rect class="hpseg" x="${(172+i*(segW+3)).toFixed(1)}" y="128" width="${segW.toFixed(1)}" height="12" rx="3" fill="#ff5d73"/>`;
  const BAND=[[206,266,-20],[266,262,25],[236,296,0],[192,282,15],[280,284,-15],[218,206,-30],[256,206,30],[214,292,20],[258,292,-10],[200,240,-12],[274,240,18],[236,198,0]];
  el.innerHTML = `<svg class="scn" viewBox="0 0 560 360" role="img" aria-label="勇士對決外星人">
  <defs><clipPath id="sAvClip"><circle cx="80" cy="196" r="30"/></clipPath>
    <radialGradient id="sPl" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#7a6bd1"/><stop offset="1" stop-color="#2b1f63"/></radialGradient>
    <linearGradient id="sSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1145"/><stop offset="1" stop-color="#3a2a85"/></linearGradient></defs>
  <rect width="560" height="360" fill="url(#sSky)"/>
  <g fill="#fff">${Array.from({length:40},(_,i)=>`<circle cx="${(i*137)%560}" cy="${(i*71)%300}" r="${(1+(i%3)*.5).toFixed(1)}"/>`).join("")}</g>
  <circle cx="60" cy="60" r="26" fill="#ff9f6b"/><ellipse cx="60" cy="62" rx="42" ry="9" fill="none" stroke="#ffd2b0" stroke-width="4"/>
  <circle cx="500" cy="80" r="14" fill="#7fd6ff"/><circle cx="495" cy="76" r="4" fill="#bfeaff"/>
  <ellipse cx="280" cy="482" rx="440" ry="164" fill="url(#sPl)"/>
  <ellipse cx="70" cy="340" rx="30" ry="8" fill="#241a55"/><ellipse cx="460" cy="346" rx="36" ry="9" fill="#241a55"/><ellipse cx="290" cy="352" rx="18" ry="5" fill="#241a55"/>
  <g transform="translate(25 -140) scale(1.5)">
  <text x="237" y="120" text-anchor="middle" font-size="14" fill="#f1ecff">${THEMES.space.monster}</text>
  <g id="sHp">${hp}</g>
  <g id="sAlien" class="alien">
    <path d="M220 198 L208 172 M252 198 L264 172" stroke="#2f6b14" stroke-width="4" stroke-linecap="round"/><circle cx="207" cy="169" r="7" fill="#ffd23f"/><circle cx="265" cy="169" r="7" fill="#ffd23f"/>
    <path d="M192 250 Q170 256 170 278" stroke="#2f6b14" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M192 250 Q170 256 170 278" stroke="#7ee04f" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M280 250 Q300 258 298 280" stroke="#2f6b14" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M280 250 Q300 258 298 280" stroke="#7ee04f" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M190 302 Q182 210 236 196 Q290 210 282 302 Q270 292 259 304 Q247 292 236 304 Q225 292 213 304 Q202 292 190 302Z" fill="#7ee04f" stroke="#2f6b14" stroke-width="3.5"/>
    <circle cx="208" cy="282" r="5" fill="#5fc236"/><circle cx="262" cy="272" r="6" fill="#5fc236"/><circle cx="246" cy="290" r="3.5" fill="#5fc236"/>
    <g class="aNorm">
      <circle cx="236" cy="238" r="21" fill="#fff" stroke="#2f6b14" stroke-width="3"/><circle cx="229" cy="240" r="9" fill="#2a1b5e"/><circle cx="226" cy="236" r="3" fill="#fff"/>
      <path d="M212 212 L258 222" stroke="#2f6b14" stroke-width="5" stroke-linecap="round"/>
      <path d="M216 270 Q236 286 256 270 Z" fill="#9b1d3a" stroke="#2f6b14" stroke-width="3.5" stroke-linejoin="round"/><path d="M222 272 l4 6 l4 -5 M242 273 l4 5 l4 -6" fill="#fff"/>
    </g>
    <g class="aHurt">
      <circle cx="236" cy="238" r="21" fill="#fff" stroke="#2f6b14" stroke-width="3"/>
      <path d="M222 228 L246 238 L222 248" stroke="#2a1b5e" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M214 222 L256 210" stroke="#2f6b14" stroke-width="5" stroke-linecap="round"/>
      <path d="M258 236 q6 10 0 16 q-6 -6 0 -16Z" fill="#7fd6ff"/>
      <ellipse cx="236" cy="278" rx="13" ry="11" fill="#9b1d3a" stroke="#2f6b14" stroke-width="3.5"/><ellipse cx="236" cy="283" rx="7" ry="4" fill="#ff7a9a"/>
    </g>
    <g id="sBands"></g>
    <g class="dizzy"><path d="M206 176 l3 6 l6 1 l-4.5 4 l1 6 l-5.5 -3 l-5.5 3 l1 -6 l-4.5 -4 l6 -1Z" fill="#ffe14d"/><path d="M266 176 l3 6 l6 1 l-4.5 4 l1 6 l-5.5 -3 l-5.5 3 l1 -6 l-4.5 -4 l6 -1Z" fill="#ffe14d"/><path d="M236 156 l3 6 l6 1 l-4.5 4 l1 6 l-5.5 -3 l-5.5 3 l1 -6 l-4.5 -4 l6 -1Z" fill="#ffe14d"/><path d="M236 206 l3 6 l6 1 l-4.5 4 l1 6 l-5.5 -3 l-5.5 3 l1 -6 l-4.5 -4 l6 -1Z" fill="#ffe14d" opacity="0"/></g>
  </g>
  <g class="goo"><circle cx="186" cy="246" r="10" fill="#b4ff6b" stroke="#2d6b10" stroke-width="3"/><circle cx="183" cy="243" r="3" fill="#fff"/></g>
  <g id="sHero" class="hero">
    <path d="M64 238 Q44 280 52 306 L108 306 Q112 270 96 238Z" fill="#e8553f"/>
    <rect x="66" y="280" width="11" height="26" rx="4" fill="#3b4a8f"/><rect x="84" y="280" width="11" height="26" rx="4" fill="#3b4a8f"/>
    <rect x="64" y="298" width="15" height="10" rx="4" fill="#2a2a3a"/><rect x="82" y="298" width="15" height="10" rx="4" fill="#2a2a3a"/>
    <path d="M62 240 Q80 232 98 240 L100 284 L60 284Z" fill="#6fa8ff" stroke="#24407a" stroke-width="3" stroke-linejoin="round"/>
    <rect x="60" y="270" width="40" height="7" fill="#ffd23f"/>
    <path d="M80 248 l3 6 l6 1 l-4.5 4 l1 6 l-5.5 -3 l-5.5 3 l1 -6 l-4.5 -4 l6 -1Z" fill="#fff"/>
    <g class="sword"><rect x="118" y="186" width="7" height="66" rx="2.5" fill="#eef4ff" stroke="#6b7bb5" stroke-width="2"/><path d="M121.5 192 V246" stroke="#b9c6ee" stroke-width="1.5"/>
      <rect x="110" y="248" width="23" height="6" rx="2" fill="#ffd23f" stroke="#9a7a00" stroke-width="1.5"/><rect x="118" y="254" width="7" height="14" rx="2" fill="#8a5a2b"/></g>
    <path d="M96 248 Q110 256 121 262" stroke="#24407a" stroke-width="12" stroke-linecap="round" fill="none"/><path d="M96 248 Q110 256 121 262" stroke="#6fa8ff" stroke-width="8" stroke-linecap="round" fill="none"/>
    <circle cx="80" cy="196" r="35" fill="#d9e2ff" stroke="#24407a" stroke-width="3"/>
    <g id="sFace"><circle cx="80" cy="196" r="30" fill="#f6d2ac"/><circle cx="70" cy="194" r="3.2" fill="#333"/><circle cx="90" cy="194" r="3.2" fill="#333"/><path d="M70 206 Q80 213 90 206" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>
    <image id="sAv" x="50" y="166" width="60" height="60" clip-path="url(#sAvClip)" preserveAspectRatio="xMidYMid slice" style="display:none"/>
    <path d="M74 162 Q90 140 110 150 Q96 154 88 164Z" fill="#e8553f" stroke="#9a2a1a" stroke-width="1.5"/>
  </g>
  <path class="slash" d="M200 186 Q262 222 226 316" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round"/>
  <path class="slash" d="M214 190 Q266 230 238 304" stroke="#ffe08a" stroke-width="3" fill="none" stroke-linecap="round"/>
  <g class="impact"><path d="M222 244 L232 222 L238 240 L256 226 L250 246 L272 250 L252 258 L262 276 L242 266 L236 288 L228 266 L208 274 L218 256 L198 248Z" fill="#fff36b" stroke="#ff7a1a" stroke-width="3" stroke-linejoin="round"/>
    <text x="234" y="258" text-anchor="middle" font-size="18" font-weight="700" fill="#d6321a">砰!</text></g>
  <text class="dmg" id="sDmg" x="272" y="192" font-size="30" font-weight="700" fill="#ffe08a" stroke="#2a1b5e" stroke-width="1.5">-1</text>
  </g></svg><div class="scenelab" id="sceneLab"></div>`;
  const svg=el.querySelector("svg"), q=id=>el.querySelector("#"+id);
  let left=goal, nb=0, won=false;   /* left＝外星人剩的血（總題數－答對題數） */
  const label=()=>{ q("sceneLab").textContent = won || left<=0 ? "外星人被打跑了！" : `外星人還有 ${left} 格血`; };
  const segs=()=>q("sHp").querySelectorAll(".hpseg").forEach((r,i)=>r.classList.toggle("gone", i>=Math.ceil(left/goal*NSEG)));
  function bandage(){ const b=BAND[nb++ % BAND.length]; const g=document.createElementNS("http://www.w3.org/2000/svg","g");
    g.setAttribute("transform",`translate(${b[0]} ${b[1]}) rotate(${b[2]})`);
    g.innerHTML=`<g class="bandpop"><rect x="-13" y="-5" width="26" height="10" rx="5" fill="#f6d3a8" stroke="#c99a6a" stroke-width="1.3"/><rect x="-4.5" y="-5" width="9" height="10" fill="#ead0b0" stroke="#c99a6a" stroke-width="1"/><circle cx="-9" cy="-1.5" r=".9" fill="#c99a6a"/><circle cx="9" cy="1.5" r=".9" fill="#c99a6a"/></g>`;
    q("sBands").appendChild(g); }
  label();
  return {
    setPlayer(p){ setSvgAv(q("sAv"), q("sFace"), p); },
    hit(done){ const n=Math.max(1,left-(goal-done)); left=goal-done;   /* n＝這次扣幾格（新答對幾題） */ q("sDmg").textContent=`-${n}`;
      retrigger(svg,"atk",1300); setTimeout(()=>{ SFX.slash(); SFX.hit(); },320);
      setTimeout(()=>{ segs(); bandage(); label(); },420); },
    miss(){ retrigger(svg,"hurt",900); setTimeout(SFX.zap,180); },
    /* 最後一律打跑外星人，但血條只扣到答對的題數（剩下的血留著） */
    win(final){ const n=Math.max(0,left-(goal-final)); left=goal-final; won=true; q("sDmg").textContent=n?`-${n}`:"";
      retrigger(svg,"atk",1300); setTimeout(()=>{ SFX.slash(); SFX.hit(); segs(); bandage(); label(); },420);
      setTimeout(()=>svg.classList.add("won"),1100);
      return {bannerAt:1300, delay:3600}; },
    stop(){}
  };
}

/* --- 恐龍谷：神秘恐龍蛋 --- */
function dinoScene(el, goal, hatchIdx){
  /* 光芒用固定的顏色（2026-10-24）：以前照星等變色，金色就知道是傳說 */
  const glow = "#ffe9a8";
  const EGG="M160 148 C205 148 232 210 232 255 C232 300 200 332 160 332 C120 332 88 300 88 255 C88 210 115 148 160 148Z";
  const ZZ="M90 240 L108 226 L124 242 L142 224 L160 242 L178 224 L196 242 L212 226 L230 240";
  const TOP=`${ZZ} C228 200 204 148 160 148 C116 148 92 200 90 240Z`;
  const BOT=`${ZZ} C232 248 232 252 232 255 C232 300 200 332 160 332 C120 332 88 300 88 255 C88 250 89 245 90 240Z`;
  const CR=["M160 242 L142 224 L146 212","M160 242 L178 224 L186 212","M142 224 L124 242 L116 254","M178 224 L196 242 L204 254","M124 242 L108 226 L90 240","M196 242 L212 226 L230 240"];
  const spotsT=`<ellipse cx="130" cy="200" rx="10" ry="7" fill="#e9d29a"/><ellipse cx="192" cy="190" rx="8" ry="6" fill="#e9d29a"/><ellipse cx="160" cy="170" rx="6" ry="4" fill="#e9d29a"/>`;
  const spotsB=`<ellipse cx="178" cy="292" rx="12" ry="8" fill="#e9d29a"/><ellipse cx="124" cy="282" rx="7" ry="5" fill="#e9d29a"/><ellipse cx="204" cy="266" rx="6" ry="4" fill="#e9d29a"/>`;
  let rays=""; for(let i=0;i<12;i++){ const a=i*30*Math.PI/180, a2=a+0.2; rays+=`<path d="M160 240 L${(160+Math.cos(a)*200).toFixed(0)} ${(240+Math.sin(a)*200).toFixed(0)} L${(160+Math.cos(a2)*200).toFixed(0)} ${(240+Math.sin(a2)*200).toFixed(0)}Z"/>`; }
  el.innerHTML = `<svg class="scn" viewBox="0 0 560 360" role="img" aria-label="神秘恐龍蛋">
  <defs><clipPath id="dEggClip"><path d="${EGG}"/></clipPath></defs>
  <rect width="560" height="360" fill="#bfe6f5"/>
  <circle cx="500" cy="44" r="24" fill="#fff1a8"/>
  <path d="M0 250 L60 170 L120 230 L190 160 L260 250Z M330 250 L420 150 L480 210 L560 140 V250Z" fill="#a9cfa0"/>
  <rect y="249" width="560" height="111" fill="#9ccc6a"/>
  <g fill="#6aa84f"><circle cx="24" cy="252" r="22"/><circle cx="52" cy="256" r="18"/><circle cx="530" cy="252" r="24"/><circle cx="504" cy="258" r="16"/></g>
  <g transform="translate(72 -136) scale(1.3)">
  <path d="M-10 300 L70 150 L104 150 L190 300Z" fill="#9b8a6e"/><path d="M70 150 L104 150 L96 168 L88 160 L80 170Z" fill="#e3672f"/>
  <g fill="#e8e3da" opacity=".85"><circle cx="86" cy="128" r="10"/><circle cx="98" cy="112" r="13"/><circle cx="84" cy="96" r="9"/></g>
  <path d="M230 300 Q236 220 262 170" stroke="#7a5a2c" stroke-width="9" fill="none" stroke-linecap="round"/>
  <g fill="#4f9a3a"><path d="M262 170 Q230 150 206 168 Q236 162 262 172Z"/><path d="M262 170 Q296 150 316 172 Q290 164 262 172Z"/><path d="M262 170 Q256 136 230 128 Q252 146 260 172Z"/><path d="M262 170 Q280 138 306 136 Q282 150 264 172Z"/></g>
  <g fill="#7fb24e"><path d="M20 310 l5 -12 l5 12Z"/><path d="M290 330 l5 -12 l5 12Z"/><path d="M40 380 l5 -12 l5 12Z"/><path d="M260 390 l5 -12 l5 12Z"/></g>
  <g class="rays" id="dRays" fill="${glow}">${rays}</g>
  <ellipse cx="160" cy="330" rx="112" ry="30" fill="#7a4e22"/>
  <g id="dEgg" class="egg">
    <g id="dIn" style="display:none"><ellipse cx="160" cy="232" rx="64" ry="20" fill="${glow}"/>
      <g class="peek"><circle cx="146" cy="229" r="4.5" fill="#fff"/><circle cx="147" cy="229" r="2.4" fill="#222"/><circle cx="174" cy="229" r="4.5" fill="#fff"/><circle cx="175" cy="229" r="2.4" fill="#222"/></g></g>
    <g id="dWhole"><path d="${EGG}" fill="#fff4dc" stroke="#c9a46a" stroke-width="3"/><g clip-path="url(#dEggClip)">${spotsT}${spotsB}</g></g>
    <g id="dBot" style="display:none"><path d="${BOT}" fill="#fff4dc" stroke="#c9a46a" stroke-width="3" stroke-linejoin="round"/>${spotsB}</g>
    <g id="dCr" clip-path="url(#dEggClip)">${CR.map(d=>`<path class="crk" d="${d}" stroke="${glow}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/><path class="crk" d="${d}" stroke="#6b4a1e" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}</g>
    <g id="dTop" class="top" style="display:none"><path d="${TOP}" fill="#fff4dc" stroke="#c9a46a" stroke-width="3" stroke-linejoin="round"/>${spotsT}</g>
  </g>
  <path d="M48 326 Q160 372 272 326 L274 344 Q160 394 46 344Z" fill="#a8743a"/>
  <g stroke="#7a4e22" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M60 334 l22 10"/><path d="M96 346 l26 4"/><path d="M140 352 l24 0"/><path d="M186 350 l26 -4"/><path d="M232 342 l24 -10"/><path d="M78 352 l20 -4"/><path d="M216 354 l22 -6"/></g>
  <g id="dChips"></g>
  <text id="dBig" x="160" y="262" text-anchor="middle" font-size="96" font-weight="700" fill="#e3672f" stroke="#fff" stroke-width="4" paint-order="stroke" opacity="0">?</text>
  <text id="dQ" x="210" y="160" font-size="40" font-weight="700" fill="#e3672f" opacity="0">?</text>
  </g></svg><div class="scenelab" id="sceneLab"></div>`;
  const q=id=>el.querySelector("#"+id), egg=q("dEgg");
  let done=0, qLeft=goal;   /* done＝累計答對題數（裂痕），qLeft＝還剩幾題 */
  const label=()=>{ q("sceneLab").textContent = qLeft>0 ? `再答 ${qLeft} 題，蛋就會打開` : "蛋快孵出來了！拉拉桿看看是誰"; };
  function render(){
    const p=done/goal, n=Math.ceil(p*CR.length);
    const crk=q("dCr").querySelectorAll(".crk");
    crk.forEach((c,i)=>c.classList.toggle("on", Math.floor(i/2)<n));
    const lifted = p>=0.75;
    q("dWhole").style.display = lifted?"none":""; q("dCr").style.display = lifted?"none":"";
    q("dBot").style.display = lifted?"":"none"; q("dTop").style.display = lifted?"":"none"; q("dIn").style.display = lifted?"":"none";
    if(lifted && p<1) q("dTop").style.transform = `translate(-3px,${-(7+(p-.75)*44).toFixed(1)}px) rotate(-7deg)`;
  }
  function chips(n){ for(let i=0;i<n;i++){ const c=document.createElementNS("http://www.w3.org/2000/svg","path");
    const x=120+Math.random()*80, y=215+Math.random()*30; c.setAttribute("d",`M${x.toFixed(0)} ${y.toFixed(0)} l6 -3 l-2 7Z`); c.setAttribute("fill","#fff4dc"); c.setAttribute("stroke","#c9a46a");
    c.setAttribute("class","drop"); c.style.setProperty("--dx",((Math.random()-.5)*120).toFixed(0)+"px"); c.style.setProperty("--dy",(-30-Math.random()*60).toFixed(0)+"px");
    q("dChips").appendChild(c); setTimeout(()=>c.remove(),1000); } }
  render(); label();
  return {
    setPlayer(){},
    hit(d, left){ done=d; if(left!=null) qLeft=left; retrigger(egg,"wob",750); SFX.crack(); setTimeout(()=>{ render(); chips(5); label(); },250); },
    miss(left){ if(left!=null){ qLeft=left; label(); } retrigger(egg,"huh",550); retrigger(q("dQ"),"qm",1000); },
    /* 結尾（2026-10-24 維護者決定 D2，不暴雷）：蛋裂開、透出光和大大的「？」，看不到恐龍；拉扭蛋機才孵出來（gacha.js） */
    win(){ done=goal; qLeft=0; render(); label(); retrigger(egg,"wob",750); SFX.crack();
      setTimeout(()=>{ q("dRays").classList.add("on"); chips(14); SFX.hatch(); },650);
      setTimeout(()=>{ q("dBig").classList.add("bigq"); },850);
      return {bannerAt:900, delay:3300}; },
    stop(){}
  };
}
/* --- 甜點店：甜點師傅疊蛋糕 --- */
function dessertScene(el, goal){
  const FL=[["#ff9fbf","#ffd9e6"],["#9a6040","#f3d2ae"],["#ffe7a3","#fffaf0"],["#a8dca0","#f1fbe9"],["#b9a3ff","#efe9ff"],["#ffbe7a","#fff0dc"]];
  const LG=Math.min(goal,12), BASE=328, CX=218, H=Math.min(30, 206/LG), W0=150, W1=Math.max(64, 150-LG*9);
  el.innerHTML = `<svg class="scn" viewBox="0 0 560 360" role="img" aria-label="甜點師傅疊蛋糕">
  <defs><clipPath id="cAvClip"><circle cx="70" cy="198" r="30"/></clipPath></defs>
  <rect width="560" height="360" fill="#ffe7ef"/>
  <g fill="#ffd3e1">${Array.from({length:14},(_,i)=>`<rect x="${i*40}" y="0" width="20" height="330"/>`).join("")}</g>
  <path d="M0 34 ${Array.from({length:14},(_,i)=>`Q${i*40+20} 56 ${i*40+40} 34`).join(" ")} V0 H0Z" fill="#f78fb3"/>
  <g transform="translate(486 90)"><rect x="-34" y="0" width="68" height="84" rx="6" fill="#fff" stroke="#e7a3bb" stroke-width="3"/><path d="M-34 28 H34 M-34 56 H34" stroke="#e7a3bb" stroke-width="3"/>
    <circle cx="-14" cy="18" r="8" fill="#ff9fbf"/><circle cx="12" cy="18" r="8" fill="#ffe7a3"/><circle cx="-12" cy="46" r="8" fill="#a8dca0"/><circle cx="14" cy="46" r="8" fill="#9a6040"/><circle cx="0" cy="72" r="8" fill="#b9a3ff"/></g>
  <rect y="325" width="560" height="35" fill="#c98b5e"/><rect y="325" width="560" height="9" fill="#e0a77a"/>
  <g transform="translate(76 -78) scale(1.2)">
  <path d="M${CX-92} ${BASE+8} H${CX+92}" stroke="#bfc6cf" stroke-width="7" stroke-linecap="round"/><rect x="${CX-10}" y="${BASE+8}" width="20" height="20" fill="#d5dbe2"/><ellipse cx="${CX}" cy="${BASE+28}" rx="34" ry="6" fill="#bfc6cf"/>
  <g id="cLayers"></g>
  <g id="cTop"></g>
  <g id="cSpark"></g>
  <g id="cChef" class="chef">
    <rect x="56" y="300" width="12" height="32" rx="5" fill="#4a4a5a"/><rect x="74" y="300" width="12" height="32" rx="5" fill="#4a4a5a"/>
    <path d="M38 304 Q36 240 70 230 Q104 240 102 304Z" fill="#fff" stroke="#c9b8bd" stroke-width="3"/>
    <circle cx="70" cy="254" r="3" fill="#d9447a"/><circle cx="70" cy="270" r="3" fill="#d9447a"/><circle cx="70" cy="286" r="3" fill="#d9447a"/>
    <path d="M56 230 L84 230 L70 246Z" fill="#e8553f"/>
    <path d="M40 252 Q28 270 40 282" stroke="#c9b8bd" stroke-width="15" fill="none" stroke-linecap="round"/><path d="M40 252 Q28 270 40 282" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round"/>
    <g class="arm"><path d="M98 250 Q116 246 128 232" stroke="#c9b8bd" stroke-width="15" fill="none" stroke-linecap="round"/><path d="M98 250 Q116 246 128 232" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round"/>
      <circle cx="130" cy="229" r="7" fill="#f6d2ac"/>
      <path d="M130 228 L146 200 L156 206 Z" fill="#ffb0cb" stroke="#d9447a" stroke-width="2" stroke-linejoin="round"/><path d="M151 203 l6 -6" stroke="#d9447a" stroke-width="3" stroke-linecap="round"/></g>
    <g id="cFace"><circle cx="70" cy="198" r="30" fill="#f6d2ac"/><circle cx="60" cy="196" r="3.2" fill="#333"/><circle cx="80" cy="196" r="3.2" fill="#333"/><path d="M60 208 Q70 215 80 208" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>
    <image id="cAv" x="40" y="168" width="60" height="60" clip-path="url(#cAvClip)" preserveAspectRatio="xMidYMid slice" style="display:none"/>
    <circle cx="70" cy="198" r="30" fill="none" stroke="#fff" stroke-width="3"/>
    <path d="M42 170 Q30 140 50 132 Q52 108 70 112 Q88 104 94 130 Q114 136 98 170Z" fill="#fff" stroke="#c9b8bd" stroke-width="3" stroke-linejoin="round"/>
    <rect x="42" y="160" width="56" height="14" rx="4" fill="#fff" stroke="#c9b8bd" stroke-width="3"/>
    <g class="sweat"><path d="M104 182 q7 10 0 15 q-7 -5 0 -15Z" fill="#7fd6ff"/></g>
  </g>
  </g>
  <g class="oops"><path d="M18 108 H124 Q134 108 134 118 V150 Q134 160 124 160 H104 L124 176 L90 160 H18 Q8 160 8 150 V118 Q8 108 18 108Z" fill="#fff36b" stroke="#3a1f2a" stroke-width="3.5" stroke-linejoin="round"/>
    <text x="71" y="145" text-anchor="middle" font-size="28" font-weight="700" fill="#3a1f2a">哎呀！</text></g>
  </svg><div class="dprog" id="dProg" role="img"></div><div class="scenelab" id="sceneLab"></div>`;
  const q=id=>el.querySelector("#"+id), svg=el.querySelector("svg"), chef=q("cChef");
  const NS="http://www.w3.org/2000/svg";
  let done=0, qLeft=goal;   /* done＝疊了幾層蛋糕，qLeft＝還剩幾題（題目很多時，答對幾題才疊一層） */
  const wOf=i=> LG>1 ? W0-(W0-W1)*i/(LG-1) : W0;
  const label=()=>{ if(prog){ const left=prog[1]-prog[0]; q("sceneLab").textContent = left>0 ? `還有 ${left} 個字，蛋糕就完成了！` : "超級大蛋糕完成了！"; return; }
    q("sceneLab").textContent = qLeft>0 ? `再答 ${qLeft} 題，蛋糕就完成了！` : "蛋糕完成了！"; };
  function layer(i, who){
    const w=wOf(i), x=CX-w/2, y=BASE-(i+1)*H, [c,f]=FL[i%FL.length];
    let drip=`M${x} ${y+2} H${x+w} V${y+H*.42}`; const n=Math.max(4,Math.round(w/18));
    for(let j=n;j>0;j--){ const x1=x+w*j/n, x0=x+w*(j-1)/n, dy=(j%2?H*.62:H*.42); drip+=` Q${((x0+x1)/2).toFixed(1)} ${(y+dy+H*.2).toFixed(1)} ${x0.toFixed(1)} ${(y+H*.42).toFixed(1)}`; }
    drip+="Z";
    let dots=""; for(let j=0;j<Math.round(w/16);j++){ const dx=x+8+Math.random()*(w-16), dy=y+H*.62+Math.random()*H*.25; dots+=`<rect x="${dx.toFixed(1)}" y="${dy.toFixed(1)}" width="5" height="2" rx="1" fill="${["#ff5d73","#4fa8f0","#ffd23f","#6ed36e"][j%4]}" transform="rotate(${(Math.random()*180).toFixed(0)} ${dx.toFixed(1)} ${dy.toFixed(1)})"/>`; }
    /* 落點的影子：蛋糕越掉越近，影子越來越大 */
    const sh=document.createElementNS(NS,"ellipse"); sh.setAttribute("class","lshadow");
    sh.setAttribute("cx",CX); sh.setAttribute("cy",(y+H).toFixed(1)); sh.setAttribute("rx",(w/2).toFixed(1)); sh.setAttribute("ry","5"); sh.setAttribute("fill","#7a3a4a");
    q("cLayers").appendChild(sh); setTimeout(()=>sh.remove(),620);
    const g=document.createElementNS(NS,"g"); g.setAttribute("class","lay");
    g.style.setProperty("--fall", (-(y+90)).toFixed(0)+"px");
    g.innerHTML=`<rect x="${x}" y="${y}" width="${w}" height="${H}" rx="6" fill="${c}" stroke="#7a3a4a" stroke-width="2"/><path d="${drip}" fill="${f}"/>${dots}`;
    /* 合作：這一層是誰疊的，中間貼那位學生的小頭像（顏色框分得出是不同的人） */
    const href = who ? avHref(who) : "";
    if(href){ const r=Math.min(H*.42, 13), id="lc"+Math.random().toString(36).slice(2,8);
      g.insertAdjacentHTML("beforeend", `<clipPath id="${id}"><circle cx="${CX}" cy="${(y+H/2).toFixed(1)}" r="${r.toFixed(1)}"/></clipPath><circle cx="${CX}" cy="${(y+H/2).toFixed(1)}" r="${(r+1.5).toFixed(1)}" fill="#fff" stroke="${WHOCOL[(WHOLIST.indexOf(who)+WHOCOL.length)%WHOCOL.length]}" stroke-width="2.5"/><image href="${href}" x="${CX-r}" y="${(y+H/2-r).toFixed(1)}" width="${(r*2).toFixed(1)}" height="${(r*2).toFixed(1)}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`); }
    q("cLayers").appendChild(g);
  }
  /* 一層一層從高處掉下來，著地時才出聲音和亮片 */
  const DROP=380, LAND=540;
  const WHOCOL=["#e8553f","#3b8fe8","#2fa84f"], WHOLIST=[];   /* 每位學生一個框的顏色（照出現順序） */
  function dropTo(target, startDelay, by){
    let k=0; const total=target-done;
    while(done<target){ const i=done++, who = !by || !by.length ? "" : total >= by.length ? by[Math.floor(k*by.length/total)] : [...new Set(by)][k % new Set(by).size];   /* 層數比答對的題數少時，輪流給每位答對的學生一層 */ if(who && !WHOLIST.includes(who)) WHOLIST.push(who);
      setTimeout(()=>{ layer(i, who); setTimeout(()=>{ SFX.hit(); sparkle(10, BASE-(i+1)*H); },LAND); }, startDelay+k*DROP); k++; }
    return startDelay + Math.max(0,k-1)*DROP + LAND;
  }
  let prog=null;
  function cupSvg(i){ const c=FL[i%FL.length][0];
    return `<svg viewBox="0 0 40 46" aria-hidden="true"><path class="fr" d="M6 23 Q3 12 13 10 Q15 3 23 4 Q34 4 34 14 Q38 18 34 23Z" fill="${c}" stroke="#7a3a4a" stroke-width="2"/><circle class="ch" cx="22" cy="5" r="4" fill="#e2304a" stroke="#7a1f2a" stroke-width="1.5"/><path class="liner" d="M5 23 H35 L31 43 H9Z" stroke-width="2.2" stroke-linejoin="round"/><path class="pleat" d="M12 25 L14 42 M20 25 V42 M28 25 L26 42" stroke-width="1.6"/></svg>`; }
  function sparkle(n,y){ for(let i=0;i<n;i++){ const s=document.createElementNS(NS,"circle");
    s.setAttribute("cx",(CX-60+Math.random()*120).toFixed(1)); s.setAttribute("cy",(y+Math.random()*10).toFixed(1)); s.setAttribute("r",(2+Math.random()*3).toFixed(1));
    s.setAttribute("fill",["#ff5d73","#ffd23f","#4fa8f0","#6ed36e","#fff"][i%5]); s.setAttribute("class","drop");
    s.style.setProperty("--dx",((Math.random()-.5)*120).toFixed(0)+"px"); s.style.setProperty("--dy",(-20-Math.random()*60).toFixed(0)+"px");
    q("cSpark").appendChild(s); setTimeout(()=>s.remove(),1000); } }
  label();
  return {
    setPlayer(p){ setSvgAv(q("cAv"), q("cFace"), p); },
    hit(d, left, by){ if(left!=null) qLeft=left; retrigger(chef,"toss",800); dropTo(Math.min(LG-1, Math.ceil(d/goal*LG)), 250, by); label(); },
    /* 進度條：一個杯子蛋糕＝一個字（每位同學都答完這一輪才算做好一個） */
    progress(r,T,part){ prog=[r,T]; const box=q("dProg");
      if(box.children.length!==T) box.innerHTML=Array.from({length:T},(_,i)=>`<span class="cup">${cupSvg(i)}</span>`).join("");
      [...box.children].forEach((c,i)=>{ const full=i<r; if(full&&!c._full) retrigger(c,"pop",700); c._full=full;
        c.classList.toggle("full",full); c.classList.toggle("now",i===r); c.classList.toggle("half",i===r&&part>0); });
      box.setAttribute("aria-label",`蛋糕進度：完成 ${r} 個字，共 ${T} 個字`); label(); },
    miss(left){ if(left!=null){ qLeft=left; label(); } retrigger(chef,"wobble",700); retrigger(svg,"oopsing",1000); },
    /* 最後一律完成（插蠟燭），蛋糕高度照答對題數；一題都沒答對也有一層 */
    win(final, by){ retrigger(chef,"toss",800);
      const top=Math.max(1, done, Math.min(LG, Math.ceil(final/goal*LG)));
      qLeft=0; const landed = dropTo(top, 250, by); label();
      setTimeout(()=>sparkle(14, BASE-top*H), landed);
      setTimeout(()=>{ const topY=BASE-top*H, w=wOf(top-1);
        let cand=""; [-0.28,0,0.28].forEach((f,i)=>{ const cx=CX+f*w, col=["#4fa8f0","#ff5d73","#ffd23f"][i];
          cand+=`<g class="candle" style="animation-delay:${i*0.15}s"><rect x="${cx-4}" y="${topY-34}" width="8" height="34" rx="2" fill="${col}" stroke="#7a3a4a" stroke-width="1.5"/>
            <path d="M${cx-4} ${topY-26} l8 -5 M${cx-4} ${topY-14} l8 -5" stroke="#fff" stroke-width="2"/>
            <path class="flame" d="M${cx} ${topY-54} Q${cx+8} ${topY-42} ${cx} ${topY-36} Q${cx-8} ${topY-42} ${cx} ${topY-54}Z" fill="#ffb020"/><circle cx="${cx}" cy="${topY-41}" r="2.6" fill="#fff3a0"/></g>`; });
        cand+=`<circle class="candle" cx="${CX+0.14*w}" cy="${topY-6}" r="6" fill="#e2304a" stroke="#7a1f2a" stroke-width="1.5" style="animation-delay:.5s"/>`;
        q("cTop").innerHTML=cand; SFX.hatch(); sparkle(24, topY-40); chef.classList.add("cheer"); }, landed+350);
      return {bannerAt:landed+650, delay:landed+3150}; },
    stop(){}
  };
}

window.Scenes = { ocean:oceanScene, space:spaceScene, dino:dinoScene, dessert:dessertScene };
})();
