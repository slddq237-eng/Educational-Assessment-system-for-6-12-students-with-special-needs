/* =========================================================
   平台共用：主題與貼紙（shared/themes.js）
   海洋、太空、恐龍、甜點四個主題的名稱、顏色、貼紙清單與貼紙圖形。
   2026-10-24 擴充成每個主題 15 張、四級星等（見 docs/game-design.md）；新畫的圖在 shared/sticker-art.js（要先載入）。
   原本的圖形取自原本的生字賓果（2026-10-21 已移除；當時 tools/bingo/index.html 的「扭蛋恐龍」「扭蛋大魚」「主題」三段），
   賓果本身沒有修改。之後要改貼紙，改這個檔案，所有工具一起生效。
   對外只提供 window.Themes（見檔案最後），避免和各工具自己的變數撞名。
   ========================================================= */
(function(){
/* ===================== 扭蛋恐龍 ===================== */
const DINOS = [
  {code:"dino-01", name:"草草小暴龍", color:"#6cc66a", stars:1},
  {code:"dino-02", name:"橘子三角龍", color:"#ff9f43", stars:1},
  {code:"dino-03", name:"天空翼龍",   color:"#4fa8f0", stars:2},
  {code:"dino-04", name:"彩虹劍龍",   color:"#a77cf0", stars:2},
  {code:"dino-05", name:"黃金腕龍",   color:"#f5c02e", stars:3},
  {code:"dino-06", name:"火焰迅猛龍", color:"#ff6b4a", stars:2},
  {code:"dino-07", name:"冰晶雷龍",   color:"#7fdcf5", stars:2},
  {code:"dino-08", name:"棉花糖鴨嘴龍", color:"#ffb3d9", stars:2},
  {code:"dino-09", name:"熔岩甲龍",   color:"#c0502e", stars:3},
  {code:"dino-10", name:"星空龍王",   color:"#3b2f8f", stars:4},
  /* 2026-10-24 新增（圖在 sticker-art.js）；evo＝只能進化得到、抽不到 */
  {code:"dino-11", name:"蘋果厚頭龍", color:"#e8574a", stars:1},
  {code:"dino-12", name:"蘑菇小盔龍", color:"#8fbf5a", stars:1},
  {code:"dino-13", name:"香蕉禽龍",   color:"#f5d33f", stars:1},
  {code:"dino-14", name:"彩晶棘龍",   color:"#3fa7a0", stars:3, evo:true},
  {code:"dino-15", name:"太陽神龍王", color:"#f5b52e", stars:4, evo:true}
];
const RARE_GLOW = {1:"#fff3b8", 2:"#7fd6ff", 3:"#ffd23f", 4:"#ff9ad5"};
const ART = () => window.StickerArt || {};
function dinoSvg(i){
  const art = ART()[DINOS[i].code];
  if(art) return `<svg viewBox="0 0 120 100" aria-hidden="true">${art.body()}</svg>`;
  const d=DINOS[i], c=d.color, k="#2d2a26", S=`stroke="${k}" stroke-width="2.5" stroke-linejoin="round"`;
  const eye=(x,y)=>`<circle cx="${x}" cy="${y}" r="5.5" fill="#fff" stroke="${k}" stroke-width="1.5"/><circle cx="${x+1.2}" cy="${y}" r="2.8" fill="${k}"/><circle cx="${x+2}" cy="${y-1.3}" r="1" fill="#fff"/>`;
  const blush=(x,y)=>`<ellipse cx="${x}" cy="${y}" rx="4" ry="2.5" fill="#ff8fa8" opacity=".75"/>`;
  const leg=(x,y,h)=>`<rect x="${x}" y="${y}" width="10" height="${h}" rx="4" fill="${c}" ${S}/>`;
  let b="";
  if(i===0){ // 小暴龍
    b=`<path d="M36 56 Q14 52 4 70 Q20 71 38 68Z" fill="${c}" ${S}/>${leg(44,70,20)}${leg(60,70,20)}
      <ellipse cx="56" cy="60" rx="24" ry="19" fill="${c}" ${S}/><ellipse cx="58" cy="65" rx="14" ry="10" fill="#e9f7c9"/>
      <path d="M73 58 Q81 60 81 67" stroke="${k}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M73 58 Q81 60 81 67" stroke="${c}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <path d="M62 44 Q62 22 84 20 Q106 20 108 36 Q108 48 96 50 L70 52 Q62 52 62 44Z" fill="${c}" ${S}/>
      <path d="M84 44 Q96 47 104 42" stroke="${k}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M90 45.5 l2 3 l2 -2.6 M96 45.5 l2 3 l2 -3" stroke="${k}" stroke-width="1.2" fill="#fff"/>
      ${eye(87,31)}${blush(98,40)}<circle cx="104" cy="29" r="1.3" fill="${k}"/>
      <path d="M48 42 l3 -6 l4 5 M38 47 l2 -6 l4 5" stroke="${k}" stroke-width="2" fill="#4ea84c"/>`;
  } else if(i===1){ // 三角龍
    b=`<path d="M28 58 Q10 56 4 66 Q18 68 30 66Z" fill="${c}" ${S}/>${leg(32,66,20)}${leg(44,68,18)}${leg(62,68,18)}${leg(74,66,20)}
      <ellipse cx="54" cy="58" rx="30" ry="18" fill="${c}" ${S}/><ellipse cx="54" cy="64" rx="18" ry="9" fill="#ffe1bf"/>
      <path d="M74 54 Q68 24 92 22 Q114 24 110 52Z" fill="#e0731f" ${S}/><circle cx="84" cy="32" r="2.5" fill="#ffd2a1"/><circle cx="96" cy="28" r="2.5" fill="#ffd2a1"/><circle cx="105" cy="36" r="2.5" fill="#ffd2a1"/>
      <ellipse cx="94" cy="57" rx="17" ry="13" fill="${c}" ${S}/>
      <path d="M86 46 L83 28 L92 44Z" fill="#fff6e0" stroke="${k}" stroke-width="2" stroke-linejoin="round"/><path d="M99 46 L104 28 L106 47Z" fill="#fff6e0" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M108 55 L117 49 L111 60Z" fill="#fff6e0" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
      ${eye(92,53)}${blush(101,61)}<path d="M99 64 Q105 66 109 62" stroke="${k}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  } else if(i===2){ // 翼龍
    b=`<path d="M54 50 Q30 24 4 28 Q18 42 15 58 Q36 50 54 64Z" fill="${c}" ${S}/><path d="M66 50 Q90 24 116 28 Q102 42 105 58 Q84 50 66 64Z" fill="${c}" ${S}/>
      <path d="M50 52 Q30 40 14 34 M70 52 Q90 40 106 34" stroke="#bfe3ff" stroke-width="2" fill="none"/>
      <path d="M54 74 l-3 9 M66 74 l3 9" stroke="${k}" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="60" cy="58" rx="12" ry="17" fill="${c}" ${S}/><ellipse cx="60" cy="62" rx="7" ry="10" fill="#d8efff"/>
      <path d="M53 30 L34 18 L55 25Z" fill="#2f7fc4" ${S}/><ellipse cx="60" cy="35" rx="12" ry="11" fill="${c}" ${S}/>
      <path d="M70 32 L96 37 L70 42Z" fill="#ffd27a" ${S}/>${eye(62,32)}${blush(56,40)}`;
  } else if(i===5){ // 火焰迅猛龍
    b=`<path d="M32 58 Q14 52 4 60 Q12 70 34 66Z" fill="${c}" ${S}/><path d="M6 59 Q-2 48 8 42 Q8 50 14 53 Q14 46 20 44 Q18 54 18 58Z" fill="#ffd23f" ${S}/>
      ${leg(44,68,22)}${leg(58,68,22)}
      <ellipse cx="54" cy="58" rx="23" ry="16" fill="${c}" ${S}/><ellipse cx="56" cy="63" rx="13" ry="8" fill="#ffe3c7"/>
      <path d="M72 50 Q80 44 84 36" stroke="${k}" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M72 50 Q80 44 84 36" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M76 34 Q76 18 96 18 Q114 20 114 32 Q114 42 100 43 L84 43 Q76 43 76 34Z" fill="${c}" ${S}/>
      <path d="M84 20 Q80 8 88 2 Q90 10 94 8 Q98 14 94 20Z" fill="#ffd23f" ${S}/>
      <path d="M88 42 L90 47 L93 42 M96 42 L98 47 L101 42" stroke="${k}" stroke-width="1.2" fill="#fff"/>
      ${eye(92,29)}${blush(104,38)}<circle cx="110" cy="27" r="1.3" fill="${k}"/>
      <path d="M66 56 l8 4 M66 60 l8 3" stroke="${k}" stroke-width="2.2" stroke-linecap="round"/>`;
  } else if(i===7){ // 棉花糖鴨嘴龍
    b=`<path d="M30 60 Q12 56 4 64 Q16 70 32 68Z" fill="${c}" ${S}/>${leg(36,68,20)}${leg(50,70,18)}${leg(66,68,20)}
      <ellipse cx="54" cy="58" rx="28" ry="17" fill="${c}" ${S}/><ellipse cx="56" cy="66" rx="17" ry="8" fill="#fff0f7"/>
      <path d="M54 66 C42 57 48 48 54 54 C60 48 66 57 54 66Z" fill="#ff7fb8" stroke="${k}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M72 52 Q84 44 86 32" stroke="${k}" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M72 52 Q84 44 86 32" stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round"/>
      <path d="M88 20 Q80 4 94 6 Q100 12 98 22Z" fill="#ff7fb8" ${S}/>
      <ellipse cx="94" cy="28" rx="12" ry="10" fill="${c}" ${S}/>
      <path d="M100 28 Q118 24 120 31 Q118 38 102 37Z" fill="#ffd06b" ${S}/>
      ${eye(92,25)}${blush(98,34)}`;
  } else if(i===8){ // 熔岩甲龍
    b=`<path d="M30 64 Q16 66 10 68" stroke="${k}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M30 64 Q16 66 10 68" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle cx="9" cy="68" r="9" fill="#8a3a20" ${S}/><path d="M2 62 l-3 -4 M9 58 l0 -5 M16 62 l3 -4" stroke="${k}" stroke-width="2.4" stroke-linecap="round"/>
      ${leg(34,72,16)}${leg(48,74,14)}${leg(66,74,14)}${leg(78,72,16)}
      <path d="M24 74 Q24 28 60 28 Q96 28 96 74Z" fill="${c}" ${S}/>
      <path d="M32 74 Q34 44 60 40 Q88 40 90 74Z" fill="#8a3a20" opacity=".35"/>
      <g fill="#ffcc80" stroke="${k}" stroke-width="1.5"><circle cx="44" cy="42" r="4.5"/><circle cx="60" cy="36" r="5"/><circle cx="76" cy="42" r="4.5"/><circle cx="52" cy="56" r="4"/><circle cx="68" cy="56" r="4"/></g>
      <path d="M36 30 l-3 -9 l8 5Z M84 30 l3 -9 l-8 5Z M60 28 l0 -10 l5 8Z" fill="#fff6e0" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>
      <ellipse cx="100" cy="66" rx="13" ry="10" fill="${c}" ${S}/>${eye(103,63)}${blush(108,71)}`;
  } else if(i===3 || i===9){ // 劍龍／星空龍王
    const king=i===9;
    const pc=king?["#ffd23f","#ffe98a","#ffd23f","#ffe98a","#ffd23f","#ffe98a"]:["#ff6b6b","#ffb13d","#ffe14d","#6ed36e","#4fa8f0","#a77cf0"]; let plates="";
    [30,40,50,60,70,80].forEach((x,j)=>{ const y=60-18*Math.sqrt(Math.max(0,1-((x-56)/32)**2))+3; plates+=`<path d="M${x-7} ${y.toFixed(1)} L${x} ${(y-17).toFixed(1)} L${x+7} ${y.toFixed(1)}Z" fill="${pc[j]}" ${S}/>`; });
    b=`${plates}<path d="M27 58 Q8 56 2 66 Q16 70 29 66Z" fill="${c}" ${S}/><path d="M6 62 l-5 -8 l9 4Z M13 60 l-2 -10 l7 7Z" fill="#fff6e0" stroke="${k}" stroke-width="1.5" stroke-linejoin="round"/>
      ${leg(32,68,18)}${leg(44,70,16)}${leg(62,70,16)}${leg(74,68,18)}
      <ellipse cx="56" cy="61" rx="32" ry="18" fill="${c}" ${S}/><ellipse cx="56" cy="68" rx="20" ry="8" fill="#e8dcff"/>
      <ellipse cx="95" cy="66" rx="13" ry="9.5" fill="${c}" ${S}/>${eye(97,63)}${blush(104,70)}<path d="M100 71 Q104 72 107 70" stroke="${k}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
      + (king?`<g fill="#fff8b0"><circle cx="40" cy="58" r="1.8"/><circle cx="52" cy="66" r="1.5"/><circle cx="64" cy="56" r="2"/><circle cx="74" cy="64" r="1.5"/><circle cx="48" cy="52" r="1.3"/></g><path d="M86 56 L88 46 L93 53 L97 45 L101 53 L106 47 L106 57Z" fill="#ffd23f" stroke="${k}" stroke-width="1.8" stroke-linejoin="round"/><path d="M110 14 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2Z M14 22 l1.5 4.5 l4.5 1.5 l-4.5 1.5 l-1.5 4.5 l-1.5 -4.5 l-4.5 -1.5 l4.5 -1.5Z" fill="#fff3a0" stroke="#e0a800" stroke-width="1"/>`:"");
  } else { // 腕龍／冰晶雷龍
    const ice=i===6;
    b=`<path d="M26 64 Q8 66 2 80 Q16 78 28 73Z" fill="${c}" ${S}/>${leg(30,72,22)}${leg(42,74,20)}${leg(56,74,20)}${leg(68,72,22)}
      <ellipse cx="50" cy="68" rx="28" ry="17" fill="${c}" ${S}/><circle cx="40" cy="62" r="3.5" fill="#ffe58a"/><circle cx="52" cy="58" r="2.5" fill="#ffe58a"/><circle cx="58" cy="66" r="3" fill="#ffe58a"/>
      <path d="M64 60 Q74 32 84 16" stroke="${k}" stroke-width="15" fill="none" stroke-linecap="round"/><path d="M64 60 Q74 32 84 16" stroke="${c}" stroke-width="10" fill="none" stroke-linecap="round"/>
      <ellipse cx="90" cy="15" rx="13" ry="9" fill="${c}" ${S}/>${eye(92,12)}${blush(99,18)}
      ${ice?`<path d="M30 52 l4 -12 l5 12Z M42 48 l4 -13 l5 13Z M54 46 l4 -12 l5 12Z" fill="#e8fbff" stroke="${k}" stroke-width="2" stroke-linejoin="round"/><path d="M106 40 l0 14 M99 47 l14 0 M101 42 l10 10 M111 42 l-10 10" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M16 26 l0 12 M10 32 l12 0" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`:`<path d="M106 40 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2Z" fill="#fff3a0" stroke="#e0a800" stroke-width="1"/>
      <path d="M16 26 l1.5 4.5 l4.5 1.5 l-4.5 1.5 l-1.5 4.5 l-1.5 -4.5 l-4.5 -1.5 l4.5 -1.5Z" fill="#fff3a0" stroke="#e0a800" stroke-width="1"/>`}`;
  }
  return `<svg viewBox="0 0 120 100" aria-hidden="true">${b}</svg>`;
}

/* ===================== 扭蛋大魚 ===================== */
const FISH = [
  {code:"ocean-01", name:"胖胖河豚",   color:"#ffcf3f", stars:1,   vb:"-8 -74 148 148"},
  {code:"ocean-02", name:"大嘴石斑魚", color:"#e98a4a", stars:1,   vb:"-8 -70 192 140"},
  {code:"ocean-03", name:"閃電劍旗魚", color:"#3d8fd8", stars:2,   vb:"-58 -90 254 180"},
  {code:"ocean-04", name:"燈籠鮟鱇魚", color:"#7a4fc0", stars:2,   vb:"-28 -92 192 184"},
  {code:"ocean-05", name:"黃金大鯊魚", color:"#f5c02e", stars:3, vb:"-8 -80 210 160"},
  {code:"ocean-06", name:"條紋小丑魚", color:"#ff7a2e", stars:2,   vb:"-8 -62 182 124"},
  {code:"ocean-07", name:"彩虹神仙魚", color:"#5fd0e8", stars:2,   vb:"-10 -100 182 200"},
  {code:"ocean-08", name:"藍斑魔鬼魟", color:"#4a5fa8", stars:2,   vb:"-30 -100 240 200"},
  {code:"ocean-09", name:"皇冠獅子魚", color:"#d94a4a", stars:3, vb:"-30 -96 220 190"},
  {code:"ocean-10", name:"月光龍王魚", color:"#7be0c8", stars:4,   vb:"-44 -76 290 152"},
  /* 2026-10-24 新增（圖在 sticker-art.js，vb 跟著圖）；evo＝只能進化得到、抽不到 */
  {code:"ocean-11", name:"泡泡金魚",   color:"#ff8c2e", stars:1},
  {code:"ocean-12", name:"條紋小鯖魚", color:"#6fa8e0", stars:1},
  {code:"ocean-13", name:"圓滾滾海星", color:"#ff7b6b", stars:1},
  {code:"ocean-14", name:"水晶水母王", color:"#7fd6ff", stars:3, evo:true},
  {code:"ocean-15", name:"深海巨鯨王", color:"#4f86e8", stars:4, evo:true}
];
FISH.forEach(d => { const a = (window.StickerArt || {})[d.code]; if(a) d.vb = a.vb; });
function fishBody(i, dizzy){
  const art = ART()[FISH[i].code];
  if(art) return art.body(dizzy);
  const c=FISH[i].color, k="#2a2140", S=`stroke="${k}" stroke-width="3.5" stroke-linejoin="round"`, S2=`stroke="${k}" stroke-width="2.5" stroke-linejoin="round"`;
  const eye=(x,y,r)=> dizzy
    ? `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${S2}/><path d="M${x-r*.5} ${y-r*.5} L${x+r*.5} ${y+r*.5} M${x+r*.5} ${y-r*.5} L${x-r*.5} ${y+r*.5}" stroke="${k}" stroke-width="3" stroke-linecap="round"/>`
    : `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${S2}/><circle cx="${x-r*.25}" cy="${y+r*.1}" r="${r*.5}" fill="#111"/><circle cx="${x-r*.42}" cy="${y-r*.18}" r="${r*.17}" fill="#fff"/>`;
  const blush=(x,y)=>`<ellipse cx="${x}" cy="${y}" rx="7" ry="4" fill="#ff7f9e" opacity=".6"/>`;
  if(i===0){ // 河豚
    let sp=""; for(let d=0; d<360; d+=30){ if(Math.abs(d-180)<40) continue; const r=x=>x*Math.PI/180;
      sp+=`<path d="M${(62+44*Math.cos(r(d-9))).toFixed(1)} ${(44*Math.sin(r(d-9))).toFixed(1)} L${(62+62*Math.cos(r(d))).toFixed(1)} ${(62*Math.sin(r(d))).toFixed(1)} L${(62+44*Math.cos(r(d+9))).toFixed(1)} ${(44*Math.sin(r(d+9))).toFixed(1)}Z" fill="#f0b400" ${S2}/>`; }
    return `${sp}<path d="M104 0 L132 -22 L127 0 L132 22Z" fill="${c}" ${S}/><circle cx="62" cy="0" r="46" fill="${c}" ${S}/>
      <ellipse cx="64" cy="20" rx="32" ry="20" fill="#fff3c4"/><circle cx="80" cy="-24" r="3" fill="#d99a00"/><circle cx="92" cy="-8" r="2.5" fill="#d99a00"/><circle cx="70" cy="-34" r="2.5" fill="#d99a00"/>
      <ellipse cx="78" cy="6" rx="12" ry="7" fill="#f0b400" ${S2} transform="rotate(-20 78 6)"/>
      <ellipse cx="9" cy="6" rx="8" ry="7" fill="#ff8fa8" ${S2}/><ellipse cx="9" cy="6" rx="3" ry="3" fill="#7a1f2a"/>
      ${eye(40,-14,14)}${blush(46,12)}`;
  }
  if(i===1){ // 石斑
    return `<path d="M40 -38 L54 -60 L66 -42 L80 -60 L92 -42 L106 -56 L118 -34Z" fill="#c96a2e" ${S}/><path d="M146 0 L180 -32 L172 0 L180 32Z" fill="#c96a2e" ${S}/>
      <path d="M0 4 Q10 -44 72 -42 Q140 -36 150 0 Q140 36 72 42 Q10 44 0 4Z" fill="${c}" ${S}/>
      <path d="M14 18 Q72 46 138 12 Q120 36 72 38 Q30 38 14 18Z" fill="#f8cfa4"/>
      <g fill="#b9612a"><circle cx="70" cy="-20" r="5"/><circle cx="92" cy="-8" r="6"/><circle cx="116" cy="-16" r="4"/><circle cx="104" cy="12" r="5"/><circle cx="78" cy="4" r="4"/><circle cx="128" cy="4" r="4"/></g>
      <path d="M0 4 L30 -10 L30 22Z" fill="#7a1f2a" ${S}/><path d="M8 0 L12 6 L16 -2Z M10 15 L14 9 L18 16Z" fill="#fff"/>
      <path d="M80 18 L68 40 L96 24Z" fill="#c96a2e" ${S2}/>
      ${eye(46,-18,12)}<path d="M32 -32 L58 -30" stroke="${k}" stroke-width="4" stroke-linecap="round"/>`;
  }
  if(i===2){ // 劍旗魚
    return `<path d="M40 -20 Q56 -84 116 -60 Q102 -40 106 -18Z" fill="#2a6fb3" ${S}/><path d="M50 -24 Q64 -66 100 -56 M70 -26 Q80 -58 104 -50" stroke="#7fc0ff" stroke-width="2" fill="none"/>
      <path d="M156 0 Q176 -36 194 -42 Q180 -10 172 0 Q180 10 194 42 Q176 36 156 0Z" fill="#2a6fb3" ${S}/>
      <path d="M6 -6 L-54 -11 L6 2Z" fill="#a9c3e0" ${S2}/>
      <path d="M2 2 Q20 -26 80 -24 Q140 -20 162 0 Q140 20 80 24 Q20 26 2 2Z" fill="${c}" ${S}/>
      <path d="M10 8 Q80 30 150 6 Q120 22 80 22 Q30 22 10 8Z" fill="#d6ebff"/>
      <path d="M60 -22 L56 18 M80 -23 L76 20 M100 -21 L96 19 M120 -17 L117 15" stroke="#8fd0ff" stroke-width="3" opacity=".7"/>
      <path d="M90 -6 L82 8 L94 4 L86 18" stroke="#ffe14d" stroke-width="3.5" fill="none" stroke-linejoin="round"/>
      <path d="M70 12 L58 30 L86 16Z" fill="#2a6fb3" ${S2}/>
      ${eye(30,-8,9)}<path d="M6 6 Q14 10 22 8" stroke="${k}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  }
  if(i===3){ // 鮟鱇魚
    return `<path d="M42 -40 Q48 -88 -12 -70" stroke="${k}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <circle cx="-14" cy="-68" r="18" fill="#fff36b" opacity=".35"/><circle cx="-14" cy="-68" r="9" fill="#fff36b" ${S2}/>
      <path d="M132 4 L160 -26 L155 4 L160 34Z" fill="#5a3596" ${S}/>
      <path d="M0 10 Q4 -46 70 -46 Q130 -40 136 4 Q128 46 70 46 Q8 46 0 10Z" fill="${c}" ${S}/>
      <circle cx="96" cy="-20" r="4" fill="#a785e0"/><circle cx="110" cy="0" r="3" fill="#a785e0"/><circle cx="88" cy="24" r="3.5" fill="#a785e0"/>
      <path d="M0 10 Q36 -2 70 16 Q40 44 4 32Z" fill="#2a1030" ${S}/>
      <path d="M6 9 L11 17 L16 7 L21 16 L27 6 L32 15 L38 6 L44 15 L50 8 L56 16 L62 12" fill="#fff" stroke="#fff" stroke-width="1" stroke-linejoin="round"/>
      <path d="M10 31 L15 24 L20 32 L26 24 L32 33 L38 25 L44 32" fill="#fff" stroke="#fff" stroke-width="1" stroke-linejoin="round"/>
      <path d="M86 16 L76 40 L102 24Z" fill="#5a3596" ${S2}/>
      ${eye(58,-18,10)}`;
  }
  if(i===5){ // 小丑魚
    return `<path d="M50 -38 Q76 -68 114 -34Z" fill="${c}" ${S2}/><path d="M60 38 Q82 62 108 34Z" fill="${c}" ${S2}/>
      <path d="M130 0 L168 -28 L160 0 L168 28Z" fill="${c}" ${S}/>
      <path d="M0 6 Q6 -40 66 -40 Q126 -34 136 0 Q126 34 66 40 Q6 44 0 6Z" fill="${c}" ${S}/>
      <path d="M40 -38 Q30 0 40 40 L58 40 Q48 0 58 -39Z" fill="#fff" stroke="${k}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M92 -37 Q84 0 94 37 L108 35 Q100 0 108 -34Z" fill="#fff" stroke="${k}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M12 16 Q40 36 70 30" stroke="#ffb27a" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>
      ${eye(22,-8,10)}<path d="M2 12 Q10 18 18 14" stroke="${k}" stroke-width="2.5" fill="none" stroke-linecap="round"/>${blush(26,14)}`;
  }
  if(i===6){ // 神仙魚
    return `<path d="M56 -30 Q66 -90 98 -96 Q94 -50 92 -22Z" fill="#3aa6c4" ${S}/><path d="M56 30 Q66 90 98 96 Q94 50 92 22Z" fill="#3aa6c4" ${S}/>
      <path d="M128 0 L166 -24 L156 0 L166 24Z" fill="#3aa6c4" ${S}/>
      <path d="M0 0 Q40 -56 86 -40 Q132 -20 132 0 Q132 20 86 40 Q40 56 0 0Z" fill="${c}" ${S}/>
      <path d="M52 -40 Q34 0 52 40" stroke="#ff6b6b" stroke-width="7" fill="none" opacity=".85"/><path d="M68 -42 Q52 0 68 42" stroke="#ffd23f" stroke-width="7" fill="none" opacity=".9"/><path d="M84 -38 Q70 0 84 38" stroke="#7be08a" stroke-width="7" fill="none" opacity=".9"/><path d="M100 -30 Q88 0 100 30" stroke="#b58cff" stroke-width="7" fill="none" opacity=".9"/>
      ${eye(26,-8,10)}${blush(32,12)}<path d="M3 4 Q10 8 16 6" stroke="${k}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  }
  if(i===7){ // 魔鬼魟
    return `<path d="M128 -2 Q170 -2 206 6 Q170 8 128 4Z" fill="#2c3a78" ${S2}/>
      <path d="M-4 -4 L-26 -22 L6 -12Z" fill="#2c3a78" ${S2}/><path d="M-4 8 L-26 26 L6 16Z" fill="#2c3a78" ${S2}/>
      <path d="M12 2 Q40 -92 118 -92 Q104 -40 132 2 Q104 44 118 96 Q40 92 12 2Z" fill="${c}" ${S}/>
      <path d="M30 2 Q60 -40 112 -30 Q96 2 112 34 Q60 44 30 2Z" fill="#dfe8ff"/>
      <g fill="#fff" opacity=".85"><circle cx="70" cy="-62" r="4"/><circle cx="92" cy="-72" r="3.5"/><circle cx="84" cy="-48" r="3"/><circle cx="70" cy="66" r="4"/><circle cx="92" cy="74" r="3.5"/><circle cx="84" cy="52" r="3"/></g>
      ${eye(26,-12,8)}${eye(26,16,8)}<path d="M14 2 Q20 6 26 2" stroke="${k}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  }
  if(i===8){ // 獅子魚
    let sp=""; for(let x=34;x<=120;x+=14){ sp+=`<path d="M${x} -30 L${x+4} -88 L${x+13} -28Z" fill="#f4b0a0" ${S2}/>`; sp+=`<path d="M${x} 30 L${x+4} 80 L${x+13} 28Z" fill="#f4b0a0" ${S2}/>`; }
    return `${sp}<path d="M140 0 L186 -28 L176 0 L186 28Z" fill="#f4b0a0" ${S}/>
      <path d="M4 6 Q8 -34 74 -34 Q136 -28 144 0 Q136 30 74 34 Q8 38 4 6Z" fill="${c}" ${S}/>
      <path d="M44 -34 Q36 0 46 34 M70 -35 Q62 0 72 35 M96 -32 Q90 0 98 32 M120 -26 Q114 0 122 26" stroke="#fff" stroke-width="5" fill="none"/>
      <path d="M62 8 L26 -2 L60 -20Z" fill="#f4b0a0" ${S2}/>
      ${eye(26,-10,9)}<path d="M4 8 Q12 12 20 10" stroke="${k}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  }
  if(i===9){ // 月光龍王魚
    return `<path d="M4 -4 Q-18 -30 -36 -14" stroke="${k}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M4 8 Q-18 34 -36 20" stroke="${k}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M200 -10 L238 -38 L230 -10 L238 18Z" fill="#ffd23f" ${S}/>
      <path d="M14 0 Q54 -52 102 -10 Q150 30 202 -10" stroke="${k}" stroke-width="40" fill="none" stroke-linecap="round"/>
      <path d="M14 0 Q54 -52 102 -10 Q150 30 202 -10" stroke="${c}" stroke-width="33" fill="none" stroke-linecap="round"/>
      <path d="M14 8 Q54 -42 102 -2 Q150 38 202 -2" stroke="#e6fff7" stroke-width="10" fill="none" stroke-linecap="round" opacity=".8"/>
      <g fill="#38b89c" opacity=".7"><circle cx="64" cy="-34" r="4"/><circle cx="92" cy="-34" r="4"/><circle cx="128" cy="2" r="4"/><circle cx="156" cy="16" r="4"/></g>
      <ellipse cx="12" cy="0" rx="26" ry="21" fill="${c}" ${S}/>
      <path d="M2 -18 L-4 -42 L12 -24 L20 -44 L24 -18Z" fill="#ffd23f" ${S2}/>
      ${eye(8,-5,8)}<path d="M-12 6 Q-4 12 6 8" stroke="${k}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M126 -44 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3Z M170 30 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2Z" fill="#fff8b0" stroke="#e0a800" stroke-width="1.2"/>`;
  }
  // 黃金鯊魚
  return `<path d="M74 -32 L96 -74 L114 -30Z" fill="#e0a800" ${S}/><path d="M160 -2 L198 -48 L188 -2 L196 32Z" fill="#e0a800" ${S}/>
    <path d="M0 6 Q30 -34 90 -34 Q150 -30 168 -2 Q150 26 90 30 Q30 32 0 6Z" fill="${c}" ${S}/>
    <path d="M8 12 Q60 36 142 12 Q100 30 60 28 Q22 26 8 12Z" fill="#fff8d6"/>
    <path d="M54 -12 Q50 0 54 10 M62 -14 Q58 0 62 12 M70 -14 Q66 0 70 12" stroke="#b98a00" stroke-width="2.5" fill="none"/>
    <path d="M74 18 L58 48 L96 24Z" fill="#e0a800" ${S2}/>
    <path d="M4 9 Q22 20 42 12" stroke="${k}" stroke-width="3" fill="#fff" stroke-linejoin="round"/><path d="M10 12 l3 5 l3 -4 M20 15 l3 5 l3 -5 M30 15 l3 4 l3 -5" stroke="${k}" stroke-width="1.5" fill="#fff"/>
    ${eye(32,-10,9)}
    <path d="M120 -50 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3Z" fill="#fff8b0" stroke="#e0a800" stroke-width="1.2"/>
    <path d="M150 30 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2Z" fill="#fff8b0" stroke="#e0a800" stroke-width="1.2"/>`;
}
const fishSvg = (i,dizzy) => `<svg viewBox="${FISH[i].vb}" aria-hidden="true">${fishBody(i,dizzy)}</svg>`;
const GACHA = { ocean:FISH, dino:DINOS };
const GACHA_VERB = { ocean:"釣到了", dino:"孵出了" };
function prizeSvg(theme,k){ return theme==="ocean" ? fishSvg(k) : dinoSvg(k); }

/* ===================== 太空、甜點的貼紙 =====================
   01～06 是原本的貼紙（同一個圖形換顏色，icon）；07～15 是 2026-10-24 新畫的（sticker-art.js）。evo＝只能進化得到 */
const SPACE = [
  {code:"space-01", name:"金色流星", color:"#ffd23f", stars:1}, {code:"space-02", name:"火紅彗星", color:"#ff8a3d", stars:1},
  {code:"space-03", name:"冰藍星球", color:"#6fd3ff", stars:1}, {code:"space-04", name:"紫色星雲", color:"#b58cff", stars:2},
  {code:"space-05", name:"綠色衛星", color:"#7bd389", stars:1}, {code:"space-06", name:"粉紅月亮", color:"#ff6fa8", stars:1},
  {code:"space-07", name:"土星光環", color:"#f2a65a", stars:2}, {code:"space-08", name:"雙子星",   color:"#7fd3ff", stars:2},
  {code:"space-09", name:"小火箭",   color:"#e8504a", stars:2}, {code:"space-10", name:"流星雨",   color:"#ffd23f", stars:2},
  {code:"space-11", name:"銀河漩渦", color:"#b58cff", stars:3}, {code:"space-12", name:"神秘黑洞", color:"#ff9a3d", stars:3},
  {code:"space-13", name:"超新星",   color:"#ffe45c", stars:3, evo:true},
  {code:"space-14", name:"彩虹星系", color:"#ffd23f", stars:4}, {code:"space-15", name:"宇宙之心", color:"#ff5d9e", stars:4, evo:true}
];
const DESSERT = [
  {code:"dessert-01", name:"草莓杯子蛋糕", color:"#ff8fb3", stars:1}, {code:"dessert-02", name:"巧克力杯子蛋糕", color:"#8b5a3c", stars:1},
  {code:"dessert-03", name:"香草杯子蛋糕", color:"#ffe28a", stars:1}, {code:"dessert-04", name:"抹茶杯子蛋糕", color:"#9fe0a8", stars:1},
  {code:"dessert-05", name:"藍莓杯子蛋糕", color:"#b9a3ff", stars:2}, {code:"dessert-06", name:"橘子杯子蛋糕", color:"#ffb36b", stars:1},
  {code:"dessert-07", name:"馬卡龍",     color:"#ffa8c8", stars:2}, {code:"dessert-08", name:"甜甜圈",     color:"#ff8fc0", stars:2},
  {code:"dessert-09", name:"冰淇淋",     color:"#9be0c0", stars:2}, {code:"dessert-10", name:"焦糖布丁",   color:"#ffe08a", stars:2},
  {code:"dessert-11", name:"彩虹千層蛋糕", color:"#ffb347", stars:3}, {code:"dessert-12", name:"巧克力噴泉", color:"#8b5a3c", stars:3},
  {code:"dessert-13", name:"城堡蛋糕",   color:"#cfe6ff", stars:3, evo:true},
  {code:"dessert-14", name:"黃金皇冠蛋糕", color:"#ffd23f", stars:4}, {code:"dessert-15", name:"夢幻甜點城堡", color:"#ff6b9e", stars:4, evo:true}
];
/* 每個主題的貼紙清單（順序就是貼紙簿的順序） */
const LISTS = {ocean:FISH, space:SPACE, dino:DINOS, dessert:DESSERT};
/* 四級星等（2026-10-24 維護者決定） */
const RARE_LABEL = {1:"普通", 2:"稀有", 3:"極稀有", 4:"傳說"};

/* ===================== 主題 ===================== */
const THEMES = {
  ocean:{ name:"海洋探險", line:"釣起神秘大魚，看看是哪一種！", monster:"神秘大魚", coopWin:"大家一起釣到大魚了！", winBanner:"釣到了！",
    stickers:FISH.map(d=>[d.color,d.name,d.code]) },
  space:{ name:"太空任務", line:"勇士出擊，打敗外星人！", monster:"搗蛋外星人", coopWin:"大家一起打敗外星人！", winBanner:"打敗外星人！",
    stickers:SPACE.map(d=>[d.color,d.name,d.code]) },
  dino:{ name:"恐龍谷", line:"敲開神秘恐龍蛋，看看孵出誰！", monster:"神秘恐龍蛋", coopWin:"恐龍蛋孵出來了！", winBanner:"孵出來了！",
    stickers:DINOS.map(d=>[d.color,d.name,d.code]) },
  dessert:{ name:"甜點店", line:"當甜點師傅，疊出超級大蛋糕！", monster:"甜點師傅", coopWin:"大家一起做出超級大蛋糕！", winBanner:"蛋糕完成！",
    stickers:DESSERT.map(d=>[d.color,d.name,d.code]) }
};
function icon(theme,color){
  color = color || "#ffcc4d";
  if(theme==="ocean") return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M78 50 L96 34 L96 66 Z" fill="${color}"/><ellipse cx="48" cy="50" rx="34" ry="24" fill="${color}"/><path d="M36 28 Q48 10 60 28" fill="${color}"/><path d="M40 34 Q34 50 40 66" stroke="#fff" stroke-width="5" fill="none" opacity=".7"/><circle cx="28" cy="45" r="7" fill="#fff"/><circle cx="27" cy="45" r="3.5" fill="#123"/><path d="M18 58 Q24 62 30 58" stroke="#123" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
  if(theme==="space") return `<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,6 62,36 95,38 69,58 78,92 50,73 22,92 31,58 5,38 38,36" fill="${color}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><circle cx="41" cy="50" r="4" fill="#2a1b5e"/><circle cx="59" cy="50" r="4" fill="#2a1b5e"/><path d="M42 61 Q50 67 58 61" stroke="#2a1b5e" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
  if(theme==="dino") return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M30 44 Q28 16 54 14 Q80 14 78 40 L86 44 Q88 52 78 54 L70 56 Q72 64 62 64 L38 64 Z" fill="${color}"/><circle cx="60" cy="30" r="6" fill="#fff"/><circle cx="61" cy="30" r="3" fill="#222"/><path d="M68 47 Q74 49 80 47" stroke="#222" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M14 62 L24 54 L32 64 L42 54 L50 64 L58 54 L68 64 L76 54 L86 62 L86 70 Q86 94 50 94 Q14 94 14 70 Z" fill="#fff8e6" stroke="#c9b27a" stroke-width="3"/><circle cx="34" cy="78" r="4" fill="#ecdcae"/><circle cx="64" cy="84" r="5" fill="#ecdcae"/></svg>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M22 54 L30 92 L70 92 L78 54 Z" fill="#f6c78f"/><path d="M34 56 L38 90 M50 56 L50 90 M66 56 L62 90" stroke="#d99a5b" stroke-width="3"/><circle cx="30" cy="48" r="14" fill="${color}"/><circle cx="70" cy="48" r="14" fill="${color}"/><circle cx="50" cy="38" r="20" fill="${color}"/><circle cx="50" cy="16" r="8" fill="#e23b50"/><path d="M50 9 Q54 2 60 4" stroke="#3a7d2c" stroke-width="3" fill="none"/><circle cx="43" cy="40" r="3.5" fill="#5e2a35"/><circle cx="57" cy="40" r="3.5" fill="#5e2a35"/><path d="M44 48 Q50 53 56 48" stroke="#5e2a35" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
}
function stickerSvg(theme, i){
  if(GACHA[theme]) return prizeSvg(theme, i);
  const d = LISTS[theme][i], art = ART()[d.code];
  return art ? `<svg viewBox="0 0 100 100" aria-hidden="true">${art.body()}</svg>` : icon(theme, d.color);
}

/* ===================== 對外提供的功能 ===================== */
/* 抽一張貼紙（2026-10-24 維護者決定，四個主題都一樣）：先依星等的固定機率抽一級（普通 55%、稀有 32%、極稀有 9%、傳說 4%），
   再從這一級「抽得到的」貼紙平均抽一張；只能進化的（evo）抽不到。可以重複、不保底，所以不用知道學生以前有哪些。
   （owned 參數留著相容舊的呼叫，不再使用。） */
const TIER_ODDS = {1:55, 2:32, 3:9, 4:4};
function drawSticker(theme){
  const L = LISTS[theme], pool = t => L.map((d, i) => d.stars === t && !d.evo ? i : -1).filter(i => i >= 0);
  const tiers = Object.keys(TIER_ODDS).map(Number).filter(t => pool(t).length);   /* 這個主題沒有的星等不算 */
  let r = Math.random() * tiers.reduce((a, t) => a + TIER_ODDS[t], 0), tier = tiers[tiers.length - 1];
  for(const t of tiers){ r -= TIER_ODDS[t]; if(r < 0){ tier = t; break; } }
  const p = pool(tier);
  return p[Math.floor(Math.random() * p.length)];
}
/* 貼紙代號（2026-10-24 維護者決定）：每張貼紙一個固定代號，例如 "dino-05"，收藏、作答紀錄、平板回傳都用它。
   代號一旦用過就不能改、也不能給別張用；新增貼紙就給新的代號（順序可以調整，不影響收藏）。 */
const codeOf = (theme, i) => { const t = THEMES[theme]; return t && t.stickers[i] ? t.stickers[i][2] : ""; };
/* 代號 → {theme, idx}；找不到回傳 null */
function findCode(code){
  for(const id of Object.keys(THEMES)){ const i = THEMES[id].stickers.findIndex(s => s[2] === code); if(i >= 0) return {theme:id, idx:i}; }
  return null;
}
/* 這個主題實際的抽中機率（貼紙簿、扭蛋機的說明用）：只算這個主題抽得到的星等，換算成百分比；
   和 drawSticker 用同一張 TIER_ODDS，改機率時說明會跟著變 */
function tierOdds(theme){
  const L = LISTS[theme] || [], tiers = Object.keys(TIER_ODDS).map(Number).filter(t => L.some(d => d.stars === t && !d.evo));
  const tot = tiers.reduce((a, t) => a + TIER_ODDS[t], 0);
  return tiers.map(t => ({stars:t, label:RARE_LABEL[t], pct:Math.round(TIER_ODDS[t] / tot * 1000) / 10}));
}
/* 星等、星等名稱、是不是只能進化 */
const stars = (theme, i) => (LISTS[theme] && LISTS[theme][i] || {}).stars || 0;
const rareLabel = (theme, i) => RARE_LABEL[stars(theme, i)] || "";
const isEvo = (theme, i) => !!(LISTS[theme] && LISTS[theme][i] || {}).evo;
/* 貼紙的文字說明，例如「恐龍谷・黃金腕龍（極稀有）」 */
function stickerName(theme, i){
  const t = THEMES[theme]; if(!t || !t.stickers[i]) return "";
  return `${t.name}・${t.stickers[i][1]}（${rareLabel(theme, i)}）`;
}
/* ===================== 主題背景插圖（練習的作答畫面） =====================
   2026-10-22 加：自己畫的卡通背景（沒有授權問題），讓練習比較有主題感。
   不干擾作答：圖案只放在畫面底部和四個角、顏色淡、對比低、不會動；中間題目和選項的位置保持乾淨。
   畫布 1600×900，底部對齊（preserveAspectRatio＝xMidYMax slice），螢幕比例不同時切掉的是上方或兩側。 */
function backdrop(theme){
  const R = (n, f) => Array.from({length:n}, (_, i) => f(i)).join("");
  const art = {
    /* 恐龍：侏儸紀（遠方火山、蕨類、長頸龍和翼龍的剪影） */
    dino: `<g opacity=".55">
      <path d="M-20 900 L180 640 Q210 610 240 640 L470 900Z M1180 900 L1360 680 Q1385 655 1410 680 L1620 900Z" fill="#9fbf86"/>
      <path d="M180 640 Q210 610 240 640 L228 660 L214 648 L198 664Z M1360 680 Q1385 655 1410 680 L1398 698 L1386 688 L1372 700Z" fill="#e9a07a"/>
      <g fill="#e8efe0">${R(3, i => `<circle cx="${212 + i * 14}" cy="${590 - i * 34}" r="${18 + i * 8}"/>`)}</g>
      <path d="M1180 760 Q1190 700 1240 690 Q1262 640 1262 600 Q1262 586 1276 588 Q1288 592 1282 606 Q1276 650 1268 700 Q1320 708 1330 760Z" fill="#86a86d"/>
      <g fill="#86a86d">${R(2, i => `<path d="M${150 + i * 1220} ${120 + i * 40} q30 -26 60 0 q-30 -12 -60 0Z M${180 + i * 1220} ${112 + i * 40} l6 -14 l6 14Z"/>`)}</g>
    </g>
    <g fill="#7fae5c" opacity=".6">${R(6, i => { const x = i < 3 ? 40 + i * 90 : 1300 + (i - 3) * 100, h = 120 + (i % 3) * 40;
      return `<path d="M${x} 900 Q${x + 6} ${900 - h * .5} ${x + 12} ${900 - h}" stroke="#6a9a4c" stroke-width="8" fill="none"/>` +
        R(5, j => `<ellipse cx="${x + 12 + (j % 2 ? 26 : -26)}" cy="${900 - h + j * 18}" rx="30" ry="9" transform="rotate(${j % 2 ? 20 : -20} ${x + 12} ${900 - h + j * 18})"/>`); })}</g>
    <rect y="860" width="1600" height="40" fill="#8fb870" opacity=".5"/>`,
    /* 海洋：海底（從上面照下來的光、海草、珊瑚、沙地、泡泡、遠處的小魚） */
    ocean: `<g fill="#fff" opacity=".04">${R(4, i => `<path d="M${200 + i * 380} 0 L${260 + i * 380} 0 L${180 + i * 380} 900 L${80 + i * 380} 900Z"/>`)}</g>
    <path d="M0 830 Q200 790 420 830 T860 820 T1300 830 T1600 810 V900 H0Z" fill="#1d6d8c" opacity=".7"/>
    <g fill="none" stroke="#3fb37f" stroke-width="10" stroke-linecap="round" opacity=".45">${R(8, i => { const x = i < 4 ? 60 + i * 70 : 1300 + (i - 4) * 75;
      return `<path d="M${x} 900 q-18 -40 0 -80 q18 -40 0 -80${i % 2 ? " q-14 -30 0 -60" : ""}"/>`; })}</g>
    <g opacity=".4">${R(4, i => `<path d="M${380 + i * 300 + (i > 1 ? 380 : 0)} 840 l-14 -50 l14 18 l8 -40 l8 40 l14 -18 l-14 50Z" fill="${["#ff8a8a", "#ffb36b", "#ff8ac4", "#ffd06b"][i]}"/>`)}</g>
    <g fill="none" stroke="#d7f3ff" stroke-width="3" opacity=".3">${R(10, i => `<circle cx="${i < 5 ? 120 + (i % 3) * 40 : 1440 + (i % 3) * 40}" cy="${300 + i * 50}" r="${6 + (i % 4) * 4}"/>`)}</g>
    <g fill="#9fe0ff" opacity=".25">${R(3, i => `<path d="M${i < 2 ? 180 + i * 90 : 1380} ${140 + i * 60} q22 -16 44 0 q-22 16 -44 0Z M${i < 2 ? 224 + i * 90 : 1424} ${140 + i * 60} l14 -10 l0 20Z"/>`)}</g>`,
    /* 太空：星星、有環的行星、月亮、小火箭、遠處的星球表面 */
    space: `<g fill="#fff" opacity=".5">${R(70, i => { const x = (i * 397 + i * i * 71) % 1600, y = (i * 233 + i * i * 37) % 900; return x > 420 && x < 1180 && y > 160 && y < 800 ? "" : `<circle cx="${x}" cy="${y}" r="${1.5 + (i % 3)}"/>`; })}</g>
    <g opacity=".5"><circle cx="170" cy="150" r="62" fill="#ff9f6b"/><ellipse cx="170" cy="156" rx="104" ry="20" fill="none" stroke="#ffd2b0" stroke-width="8"/></g>
    <g opacity=".45"><circle cx="1440" cy="130" r="44" fill="#d9d4f7"/><circle cx="1424" cy="118" r="9" fill="#bdb6e8"/><circle cx="1458" cy="146" r="6" fill="#bdb6e8"/></g>
    <ellipse cx="800" cy="1120" rx="1100" ry="300" fill="#2b1f63" opacity=".8"/>
    <g opacity=".5" transform="translate(1420 690) rotate(-30)"><path d="M0 -60 Q20 -30 20 20 H-20 Q-20 -30 0 -60Z" fill="#f1ecff"/><circle cy="-14" r="8" fill="#6fd3ff"/>
      <path d="M-20 4 L-36 28 H-20Z M20 4 L36 28 H20Z" fill="#ff6fa8"/><path d="M-12 22 Q0 56 12 22Z" fill="#ffb020"/></g>`,
    /* 甜點：上方三角旗、糖果罐、蛋糕櫃、撒在旁邊的糖粒 */
    dessert: `<path d="M0 0 ${R(16, i => `L${i * 100 + 50} 60 L${i * 100 + 100} 0`)}Z" fill="#f78fb3" opacity=".35"/>
    <g opacity=".45"><rect x="70" y="700" width="120" height="160" rx="26" fill="#fff" stroke="#e7a3bb" stroke-width="6"/><rect x="92" y="680" width="76" height="26" rx="8" fill="#e7a3bb"/>
      ${R(9, i => `<circle cx="${100 + (i % 3) * 30}" cy="${740 + Math.floor(i / 3) * 36}" r="12" fill="${["#ff9fbf", "#ffe7a3", "#a8dca0", "#b9a3ff"][i % 4]}"/>`)}</g>
    <g opacity=".45" transform="translate(1340 640)"><rect width="200" height="220" rx="14" fill="#fff" stroke="#e7a3bb" stroke-width="6"/><path d="M0 110 H200" stroke="#e7a3bb" stroke-width="6"/>
      <rect x="40" y="56" width="120" height="40" rx="10" fill="#ff9fbf"/><rect x="56" y="30" width="88" height="30" rx="10" fill="#ffe7a3"/>${R(3, i => `<circle cx="${50 + i * 50}" cy="170" r="22" fill="${["#9a6040", "#a8dca0", "#b9a3ff"][i]}"/>`)}</g>
    <g opacity=".35">${R(24, i => { const x = i % 2 ? 40 + (i * 37) % 300 : 1260 + (i * 53) % 300, y = 160 + (i * 97) % 440;
      return `<rect x="${x}" y="${y}" width="18" height="6" rx="3" fill="${["#ff5d73", "#4fa8f0", "#ffd23f", "#6ed36e"][i % 4]}" transform="rotate(${(i * 47) % 180} ${x} ${y})"/>`; })}</g>
    <rect y="868" width="1600" height="32" fill="#e0a77a" opacity=".45"/>`
  }[theme];
  return art ? `<svg class="backdrop" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${art}</svg>` : "";
}
window.Themes = {
  THEMES, GACHA, GACHA_VERB, RARE_GLOW,
  FISH, DINOS, fishBody, dinoSvg,   /* 打怪獸場景要畫大魚和恐龍（識字評量 scenes.js） */
  ids: Object.keys(THEMES),
  LISTS, RARE_LABEL, TIER_ODDS, tierOdds,
  icon, stickerSvg, drawSticker, stickerName, codeOf, findCode, backdrop, stars, rareLabel, isEvo
};
})();
