/* =========================================================
   平台共用：新增貼紙的圖形（shared/sticker-art.js）
   2026-10-24 貼紙擴充成每個主題 15 張（見 docs/design/game-design.md），新畫的 28 張放在這裡，原本的圖留在 themes.js。
   全部用程式畫（SVG），不用圖片檔；以貼紙代號為鍵（代號用過就不能改）：
     海洋：body(dizzy) 回傳大魚的圖（和 themes.js 的 fishBody 同一套座標，魚頭朝左、嘴在 x≈0），vb 是貼紙用的視窗
     恐龍：body() 回傳 viewBox 0 0 120 100 裡的圖（頭朝右，和 dinoSvg 一樣）
     太空、甜點：body() 回傳 viewBox 0 0 100 100 裡的圖
   要先於 themes.js 載入；對外只提供 window.StickerArt。
   ========================================================= */
(function(){
const K = "#2d2a26", S = `stroke="${K}" stroke-width="2.5" stroke-linejoin="round"`, S3 = `stroke="${K}" stroke-width="3.5" stroke-linejoin="round"`;
/* 可愛的眼睛、腮紅、微笑；dizzy＝釣起來時暈頭的叉叉眼 */
const eye = (x, y, r, dizzy) => dizzy
  ? `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${S}/><path d="M${x-r*.5} ${y-r*.5} L${x+r*.5} ${y+r*.5} M${x+r*.5} ${y-r*.5} L${x-r*.5} ${y+r*.5}" stroke="${K}" stroke-width="3" stroke-linecap="round"/>`
  : `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${S}/><circle cx="${x-r*.2}" cy="${y+r*.1}" r="${r*.5}" fill="#111"/><circle cx="${x-r*.38}" cy="${y-r*.18}" r="${r*.18}" fill="#fff"/>`;
const blush = (x, y, rx = 6, ry = 3.5) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#ff8fa8" opacity=".65"/>`;
const smile = (x, y, w = 6) => `<path d="M${x-w} ${y} Q${x} ${y+w*.9} ${x+w} ${y}" stroke="${K}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
/* 小臉（太空、甜點用）：兩眼、微笑、腮紅 */
const face = (x, y, s = 1) => `<circle cx="${x-8*s}" cy="${y}" r="${3.2*s}" fill="#2a1b3e"/><circle cx="${x+8*s}" cy="${y}" r="${3.2*s}" fill="#2a1b3e"/>
  <circle cx="${x-7*s}" cy="${y-1.2*s}" r="${1*s}" fill="#fff"/><circle cx="${x+9*s}" cy="${y-1.2*s}" r="${1*s}" fill="#fff"/>
  <path d="M${x-5*s} ${y+6*s} Q${x} ${y+10*s} ${x+5*s} ${y+6*s}" stroke="#2a1b3e" stroke-width="${2.4*s}" fill="none" stroke-linecap="round"/>
  <ellipse cx="${x-13*s}" cy="${y+5*s}" rx="${3.5*s}" ry="${2*s}" fill="#ff8fa8" opacity=".7"/><ellipse cx="${x+13*s}" cy="${y+5*s}" rx="${3.5*s}" ry="${2*s}" fill="#ff8fa8" opacity=".7"/>`;
/* 閃亮的四角星 */
const spark = (x, y, r = 6, fill = "#fff8b0", line = "#e0a800") => `<path d="M${x} ${y-r} L${x+r*.3} ${y-r*.3} L${x+r} ${y} L${x+r*.3} ${y+r*.3} L${x} ${y+r} L${x-r*.3} ${y+r*.3} L${x-r} ${y} L${x-r*.3} ${y-r*.3}Z" fill="${fill}" stroke="${line}" stroke-width="1.2" stroke-linejoin="round"/>`;
/* 王冠 */
const crown = (x, y, w = 24, fill = "#ffd23f") => `<path d="M${x-w/2} ${y} L${x-w/2} ${y-w*.55} L${x-w/4} ${y-w*.25} L${x} ${y-w*.7} L${x+w/4} ${y-w*.25} L${x+w/2} ${y-w*.55} L${x+w/2} ${y}Z" fill="${fill}" ${S}/>
  <circle cx="${x}" cy="${y-w*.3}" r="${w*.08}" fill="#ff5d7a"/>`;

const ART = {
/* ===================== 海洋（大魚） ===================== */
  /* 普通：泡泡金魚——圓圓的身體、大大的雙尾 */
  "ocean-11": {vb:"-10 -70 190 140", body: d => `<path d="M112 0 Q150 -60 172 -34 Q150 -10 132 0 Q150 10 172 34 Q150 60 112 0Z" fill="#ffb347" ${S3}/>
    <path d="M128 -6 Q152 -40 164 -30 M128 6 Q152 40 164 30" stroke="#ffe0b0" stroke-width="3" fill="none"/>
    <path d="M50 -36 Q70 -66 92 -38Z" fill="#ffb347" ${S3}/>
    <ellipse cx="62" cy="0" rx="58" ry="44" fill="#ff8c2e" ${S3}/><ellipse cx="66" cy="18" rx="36" ry="18" fill="#ffd9a8"/>
    <path d="M70 12 Q84 30 96 12" fill="#ffb347" ${S}/>
    ${eye(30, -10, 13, d)}${blush(36, 14)}<circle cx="8" cy="4" r="4" fill="#d9532e"/>
    <g fill="#dff6ff" stroke="#7fc8e8" stroke-width="2"><circle cx="-2" cy="-40" r="7"/><circle cx="10" cy="-58" r="5"/><circle cx="-6" cy="-62" r="3"/></g>`},
  /* 普通：條紋小鯖魚——細長的藍色身體、背上有斑馬紋 */
  "ocean-12": {vb:"-10 -60 200 120", body: d => `<path d="M150 0 L186 -30 L178 0 L186 30Z" fill="#4a86c8" ${S3}/>
    <path d="M60 -26 L74 -46 L92 -26Z M70 24 L84 40 L96 22Z" fill="#4a86c8" ${S}/>
    <path d="M0 2 Q20 -34 84 -32 Q140 -26 156 0 Q140 26 84 30 Q20 34 0 2Z" fill="#6fa8e0" ${S3}/>
    <path d="M10 10 Q80 34 148 8 Q120 28 80 28 Q30 28 10 10Z" fill="#eef6ff"/>
    <path d="M56 -28 Q50 -14 58 -4 M76 -30 Q68 -16 78 -4 M96 -28 Q88 -14 98 -2 M116 -24 Q110 -12 118 -2" stroke="#24538a" stroke-width="4" fill="none" stroke-linecap="round"/>
    ${eye(28, -8, 11, d)}${blush(34, 12, 5, 3)}${smile(10, 6, 5)}`},
  /* 普通：圓滾滾海星——胖胖的五角星 */
  "ocean-13": {vb:"-10 -76 156 152", body: d => { const pt = (r, a) => `${(68+r*Math.cos(a)).toFixed(1)} ${(r*Math.sin(a)).toFixed(1)}`, A = j => -Math.PI/2 + j*2*Math.PI/5;
    /* 五個尖角之間用弧線連起來，看起來胖胖的 */
    let p = `M${pt(70, A(0))} `; for(let j = 0; j < 5; j++) p += `Q${pt(22, A(j) + Math.PI/5)} ${pt(70, A(j + 1))} `;
    return `<path d="${p}Z" fill="#ff7b6b" ${S3} stroke-linecap="round"/>
    <g fill="#ffd1c8"><circle cx="68" cy="-40" r="4"/><circle cx="30" cy="-12" r="4"/><circle cx="106" cy="-12" r="4"/><circle cx="44" cy="34" r="4"/><circle cx="92" cy="34" r="4"/></g>
    ${eye(56, -2, 9, d)}${eye(82, -2, 9, d)}${blush(48, 14, 5, 3)}${blush(90, 14, 5, 3)}${smile(69, 14, 6)}`; }},
  /* 極稀有（只能進化）：水晶水母王——透明發光的傘、頭上有王冠 */
  "ocean-14": {vb:"-20 -96 180 200", body: d => `<g stroke="#9be7ff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".9">
      <path d="M34 20 Q24 50 38 74 Q50 92 40 100"/><path d="M58 22 Q66 54 54 80"/><path d="M82 22 Q74 54 88 82"/><path d="M106 20 Q118 48 104 72 Q94 88 104 98"/></g>
    <path d="M10 22 Q10 -58 70 -58 Q130 -58 130 22 Q112 30 96 22 Q82 32 70 22 Q56 32 44 22 Q28 30 10 22Z" fill="#b6f0ff" fill-opacity=".85" ${S3}/>
    <path d="M30 -20 Q40 -46 66 -48" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".8"/>
    <g fill="#e3faff" stroke="#7fd6ff" stroke-width="1.5"><path d="M88 -30 l6 -10 l6 10 l-6 10Z"/><path d="M104 -6 l5 -8 l5 8 l-5 8Z"/></g>
    ${eye(54, -6, 9, d)}${eye(86, -6, 9, d)}${blush(44, 8, 5, 3)}${blush(96, 8, 5, 3)}${smile(70, 6, 6)}
    ${crown(70, -60, 34)}${spark(-6, -40, 7, "#e3faff", "#4fc3e8")}${spark(146, -10, 6, "#e3faff", "#4fc3e8")}`},
  /* 傳說（只能進化）：深海巨鯨王——藍色大鯨魚，噴出閃亮的水柱 */
  "ocean-15": {vb:"-14 -110 240 200", body: d => `<path d="M176 -6 Q196 -44 222 -40 Q206 -18 200 -2 Q214 14 226 30 Q196 32 176 8Z" fill="#3c6fd1" ${S3}/>
    <path d="M0 10 Q0 -60 90 -60 Q170 -60 182 0 Q170 48 90 50 Q0 52 0 10Z" fill="#4f86e8" ${S3}/>
    <path d="M6 20 Q40 50 120 44 Q160 38 176 14 Q150 44 92 46 Q30 48 6 20Z" fill="#dbe9ff"/>
    <path d="M24 30 L150 30 M30 38 L140 38" stroke="#9fbef0" stroke-width="3" stroke-linecap="round"/>
    <path d="M100 24 Q118 48 136 24" fill="#3c6fd1" ${S}/>
    ${eye(40, -12, 13, d)}${blush(52, 12)}${smile(18, 12, 7)}
    <g stroke="#9be7ff" stroke-width="5" fill="none" stroke-linecap="round"><path d="M86 -62 Q76 -84 60 -90"/><path d="M90 -62 L90 -98"/><path d="M94 -62 Q104 -84 120 -90"/></g>
    ${crown(90, -60, 32)}${spark(54, -96, 7)}${spark(128, -96, 7)}${spark(202, -70, 8)}<g fill="#fff3a0"><circle cx="70" cy="-30" r="2.4"/><circle cx="120" cy="-36" r="2"/><circle cx="146" cy="-14" r="2.4"/></g>`},

/* ===================== 恐龍（viewBox 0 0 120 100，頭朝右） ===================== */
  /* 普通：蘋果厚頭龍——圓圓的紅色頭頂像蘋果 */
  "dino-11": {body: () => `<path d="M34 60 Q14 58 4 72 Q20 74 36 68Z" fill="#e8574a" ${S}/>
    <rect x="44" y="70" width="10" height="20" rx="4" fill="#e8574a" ${S}/><rect x="60" y="70" width="10" height="20" rx="4" fill="#e8574a" ${S}/>
    <ellipse cx="56" cy="60" rx="24" ry="18" fill="#e8574a" ${S}/><ellipse cx="58" cy="65" rx="14" ry="9" fill="#ffe1d8"/>
    <path d="M66 50 Q66 40 76 38 L96 38 Q106 40 106 50 Q106 60 96 60 L76 60 Q66 60 66 50Z" fill="#e8574a" ${S}/>
    <path d="M70 40 Q70 14 88 14 Q106 14 106 40Z" fill="#c8322a" ${S}/><path d="M86 15 Q86 6 92 4" stroke="#6b3f1f" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M92 6 Q102 2 104 10 Q96 12 92 6Z" fill="#5cb85c" ${S}/><path d="M78 22 Q82 18 88 19" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
    <circle cx="94" cy="47" r="5.5" fill="#fff" stroke="${K}" stroke-width="1.5"/><circle cx="95.2" cy="47" r="2.8" fill="${K}"/>${blush(100, 55, 4, 2.5)}${smile(98, 56, 3)}`},
  /* 普通：蘑菇小盔龍——頭上的冠像一朵蘑菇 */
  "dino-12": {body: () => `<path d="M32 62 Q12 60 2 74 Q18 76 34 70Z" fill="#8fbf5a" ${S}/>
    <rect x="42" y="72" width="10" height="18" rx="4" fill="#8fbf5a" ${S}/><rect x="58" y="72" width="10" height="18" rx="4" fill="#8fbf5a" ${S}/>
    <ellipse cx="54" cy="62" rx="24" ry="17" fill="#8fbf5a" ${S}/><ellipse cx="56" cy="67" rx="14" ry="8" fill="#eef8d8"/>
    <path d="M70 56 Q76 38 90 36 Q106 36 108 48 Q108 58 98 60 L76 62Z" fill="#8fbf5a" ${S}/>
    <rect x="84" y="20" width="8" height="18" rx="3" fill="#f6ead2" ${S}/>
    <path d="M70 24 Q70 4 88 4 Q106 4 106 24Z" fill="#e8504a" ${S}/><g fill="#fff"><circle cx="80" cy="14" r="3.5"/><circle cx="94" cy="10" r="3"/><circle cx="98" cy="19" r="2.5"/></g>
    <circle cx="94" cy="45" r="5.5" fill="#fff" stroke="${K}" stroke-width="1.5"/><circle cx="95.2" cy="45" r="2.8" fill="${K}"/>${blush(101, 53, 4, 2.5)}${smile(99, 53, 3)}`},
  /* 普通：香蕉禽龍——黃色身體、大拇指像香蕉 */
  "dino-13": {body: () => `<path d="M36 58 Q14 54 2 66 Q18 70 36 66Z" fill="#f5d33f" ${S}/>
    <rect x="46" y="68" width="10" height="22" rx="4" fill="#f5d33f" ${S}/><rect x="62" y="68" width="10" height="22" rx="4" fill="#f5d33f" ${S}/>
    <ellipse cx="58" cy="58" rx="24" ry="18" fill="#f5d33f" ${S}/><g fill="#c9a51f"><circle cx="48" cy="52" r="2.5"/><circle cx="58" cy="48" r="2"/><circle cx="66" cy="56" r="2.5"/></g>
    <ellipse cx="60" cy="64" rx="14" ry="8" fill="#fff6c8"/>
    <path d="M74 60 Q84 58 86 66" stroke="${K}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M74 60 Q84 58 86 66" stroke="#f5d33f" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M84 62 Q92 56 92 66 Q88 70 84 66Z" fill="#fff3a0" ${S}/>
    <path d="M70 46 Q72 24 92 24 Q110 26 110 38 Q110 48 98 50 L76 52Z" fill="#f5d33f" ${S}/>
    <circle cx="93" cy="33" r="5.5" fill="#fff" stroke="${K}" stroke-width="1.5"/><circle cx="94.2" cy="33" r="2.8" fill="${K}"/>${blush(101, 42, 4, 2.5)}${smile(100, 42, 3)}`},
  /* 極稀有（只能進化）：彩晶棘龍——背上是彩色水晶帆 */
  "dino-14": {body: () => { const cs = ["#ff7b9c", "#ffb84d", "#ffe45c", "#7be08a", "#6fc3ff", "#b48cff"]; let sail = "";
      cs.forEach((c, j) => { const x = 30 + j*9; sail += `<path d="M${x} 58 L${x+4} ${30 - (j < 3 ? j*6 : (5-j)*6)} L${x+9} 58Z" fill="${c}" ${S}/>`; });
      return `${sail}<path d="M28 62 Q8 62 2 76 Q16 78 30 70Z" fill="#3fa7a0" ${S}/>
    <rect x="38" y="70" width="10" height="20" rx="4" fill="#3fa7a0" ${S}/><rect x="56" y="70" width="10" height="20" rx="4" fill="#3fa7a0" ${S}/>
    <ellipse cx="52" cy="62" rx="26" ry="16" fill="#3fa7a0" ${S}/><ellipse cx="54" cy="67" rx="16" ry="7" fill="#dff7f2"/>
    <path d="M72 58 Q82 44 98 44 L114 48 Q116 56 106 58 L80 64Z" fill="#3fa7a0" ${S}/>
    <circle cx="92" cy="50" r="5" fill="#fff" stroke="${K}" stroke-width="1.5"/><circle cx="93" cy="50" r="2.5" fill="${K}"/>${blush(100, 57, 4, 2.2)}
    ${spark(16, 24, 7, "#fff", "#b48cff")}${spark(106, 20, 6, "#fff", "#6fc3ff")}${spark(88, 30, 4, "#fff", "#ff7b9c")}`; }},
  /* 傳說（只能進化）：太陽神龍王——金色的龍、背後一圈太陽光、戴王冠 */
  "dino-15": {body: () => { let rays = ""; for(let j = 0; j < 12; j++){ const a = j*Math.PI/6; rays += `<path d="M${(70+30*Math.cos(a)).toFixed(1)} ${(42+30*Math.sin(a)).toFixed(1)} L${(70+44*Math.cos(a+.13)).toFixed(1)} ${(42+44*Math.sin(a+.13)).toFixed(1)} L${(70+44*Math.cos(a-.13)).toFixed(1)} ${(42+44*Math.sin(a-.13)).toFixed(1)}Z" fill="#ffcf3a" opacity=".85"/>`; }
      return `<circle cx="70" cy="42" r="32" fill="#fff1a8" opacity=".9"/>${rays}
    <path d="M30 62 Q10 62 2 76 Q16 80 32 70Z" fill="#f5b52e" ${S}/><path d="M4 72 l-4 -8 l9 3Z" fill="#ff7a3d" ${S}/>
    <rect x="40" y="70" width="10" height="20" rx="4" fill="#f5b52e" ${S}/><rect x="58" y="70" width="10" height="20" rx="4" fill="#f5b52e" ${S}/>
    <ellipse cx="54" cy="62" rx="26" ry="17" fill="#f5b52e" ${S}/><ellipse cx="56" cy="68" rx="16" ry="7" fill="#fff4cc"/>
    <path d="M40 48 Q30 26 48 30 Q44 40 50 46Z" fill="#ff8a3d" ${S}/>
    <path d="M70 56 Q76 32 94 30 Q112 30 114 44 Q114 54 102 56 L78 62Z" fill="#f5b52e" ${S}/>
    <circle cx="96" cy="40" r="5.5" fill="#fff" stroke="${K}" stroke-width="1.5"/><circle cx="97.2" cy="40" r="2.8" fill="${K}"/>${blush(104, 49, 4, 2.5)}${smile(104, 48, 3)}
    ${crown(92, 30, 22)}${spark(14, 18, 7)}${spark(112, 74, 6)}`; }},

/* ===================== 太空（viewBox 0 0 100 100） ===================== */
  /* 稀有：土星光環 */
  "space-07": {body: () => `<ellipse cx="50" cy="54" rx="46" ry="14" fill="none" stroke="#ffcf7a" stroke-width="7" transform="rotate(-14 50 54)"/>
    <circle cx="50" cy="50" r="28" fill="#f2a65a" stroke="#fff" stroke-width="3"/><path d="M26 42 Q50 36 74 42 M24 56 Q50 50 76 56" stroke="#d98a3a" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M6 66 Q50 82 94 42" stroke="#ffcf7a" stroke-width="7" fill="none" stroke-linecap="round" transform="rotate(-2 50 54)"/>${face(50, 48, .9)}`},
  /* 稀有：雙子星——兩顆手牽手的星星 */
  "space-08": {body: () => { const star = (cx, cy, r, c) => { let p = ""; for(let j = 0; j < 10; j++){ const a = -Math.PI/2 + j*Math.PI/5, rr = j % 2 ? r*.48 : r; p += `${j ? "L" : "M"}${(cx+rr*Math.cos(a)).toFixed(1)} ${(cy+rr*Math.sin(a)).toFixed(1)} `; } return `<path d="${p}Z" fill="${c}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`; };
      return `${star(30, 54, 28, "#ffd23f")}${star(70, 46, 28, "#7fd3ff")}<path d="M42 64 Q50 70 58 60" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>
      ${face(30, 56, .6)}${face(70, 48, .6)}`; }},
  /* 稀有：小火箭 */
  "space-09": {body: () => `<path d="M38 70 Q24 76 22 92 Q34 84 42 80Z M62 70 Q76 76 78 92 Q66 84 58 80Z" fill="#e8504a" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
    <path d="M42 80 Q50 100 58 80Z" fill="#ffb347"/><path d="M45 80 Q50 92 55 80Z" fill="#fff3a0"/>
    <path d="M50 6 Q72 24 70 62 L66 80 L34 80 L30 62 Q28 24 50 6Z" fill="#eef3fb" stroke="#fff" stroke-width="3"/>
    <path d="M50 6 Q62 14 66 26 L34 26 Q38 14 50 6Z" fill="#e8504a"/><circle cx="50" cy="44" r="11" fill="#7fd3ff" stroke="#3d6fa8" stroke-width="3"/>
    <circle cx="46" cy="42" r="2" fill="#2a1b3e"/><circle cx="54" cy="42" r="2" fill="#2a1b3e"/><path d="M46 48 Q50 51 54 48" stroke="#2a1b3e" stroke-width="2" fill="none" stroke-linecap="round"/>`},
  /* 稀有：流星雨——三顆拖著尾巴的流星 */
  "space-10": {body: () => { const m = (x, y, s, c) => `<path d="M${x} ${y} L${x-34*s} ${y-30*s}" stroke="${c}" stroke-width="${9*s}" stroke-linecap="round" opacity=".55"/><circle cx="${x}" cy="${y}" r="${10*s}" fill="${c}" stroke="#fff" stroke-width="2.5"/>`;
      return `${m(78, 70, 1.2, "#ffd23f")}${m(46, 44, .8, "#ff8fb3")}${m(84, 30, .7, "#7fd3ff")}${face(78, 70, .55)}<g fill="#fff"><circle cx="20" cy="80" r="2"/><circle cx="34" cy="90" r="1.5"/><circle cx="16" cy="60" r="1.5"/></g>`; }},
  /* 極稀有：銀河漩渦 */
  "space-11": {body: () => `<circle cx="50" cy="50" r="44" fill="#2a1b5e"/>
    <path d="M50 50 Q50 30 66 32 Q86 36 82 58 Q76 84 48 84 Q16 82 14 52 Q14 18 50 12" stroke="#b58cff" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M50 50 Q50 64 38 64 Q26 62 28 48 Q30 34 46 30" stroke="#7fd3ff" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="50" cy="50" r="9" fill="#fff3a0"/><g fill="#fff"><circle cx="76" cy="22" r="2"/><circle cx="24" cy="76" r="1.6"/><circle cx="84" cy="80" r="1.8"/><circle cx="18" cy="30" r="1.4"/></g>${spark(78, 18, 6)}`},
  /* 極稀有：神秘黑洞——發光的圓環，中間是會眨眼的黑洞 */
  "space-12": {body: () => `<circle cx="50" cy="50" r="44" fill="#120a2e"/>
    <ellipse cx="50" cy="52" rx="44" ry="13" fill="none" stroke="#ff9a3d" stroke-width="6" transform="rotate(-10 50 52)"/>
    <circle cx="50" cy="50" r="24" fill="#000" stroke="#ffd27a" stroke-width="4"/>
    <path d="M10 56 Q50 72 90 46" stroke="#ffcf7a" stroke-width="6" fill="none" stroke-linecap="round" transform="rotate(-2 50 52)"/>
    <circle cx="42" cy="48" r="3.5" fill="#fff"/><circle cx="58" cy="48" r="3.5" fill="#fff"/><path d="M45 57 Q50 60 55 57" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    ${spark(84, 18, 6, "#fff", "#ff9a3d")}${spark(16, 82, 5, "#fff", "#ff9a3d")}`},
  /* 極稀有（只能進化）：超新星——爆開的彩色光芒 */
  "space-13": {body: () => { let r = ""; const cs = ["#ff6b6b", "#ffb347", "#ffe45c", "#7be08a", "#6fc3ff", "#b48cff"];
      for(let j = 0; j < 12; j++){ const a = j*Math.PI/6; r += `<path d="M50 50 L${(50+46*Math.cos(a-.12)).toFixed(1)} ${(50+46*Math.sin(a-.12)).toFixed(1)} L${(50+46*Math.cos(a+.12)).toFixed(1)} ${(50+46*Math.sin(a+.12)).toFixed(1)}Z" fill="${cs[j % 6]}"/>`; }
      return `${r}<circle cx="50" cy="50" r="22" fill="#fff8d0" stroke="#fff" stroke-width="3"/>${face(50, 48, .75)}${spark(16, 16, 6)}${spark(86, 84, 6)}`; }},
  /* 傳說：彩虹星系——彩虹色的光環圍著一顆星球 */
  "space-14": {body: () => `<circle cx="50" cy="50" r="46" fill="#1b1145"/>
    ${["#ff6b6b", "#ffb347", "#ffe45c", "#7be08a", "#6fc3ff", "#b48cff"].map((c, j) => `<ellipse cx="50" cy="50" rx="${44-j*4}" ry="${18-j*1.4}" fill="none" stroke="${c}" stroke-width="3.5" transform="rotate(-20 50 50)"/>`).join("")}
    <circle cx="50" cy="50" r="18" fill="#ffd23f" stroke="#fff" stroke-width="3"/>${face(50, 48, .65)}
    ${spark(84, 14, 7)}${spark(14, 82, 6)}${spark(86, 76, 5)}<g fill="#fff"><circle cx="20" cy="22" r="2"/><circle cx="74" cy="90" r="1.6"/></g>`},
  /* 傳說（只能進化）：宇宙之心——發光的愛心星球，戴著王冠 */
  "space-15": {body: () => `<circle cx="50" cy="54" r="44" fill="#ffd6f2" opacity=".55"/>
    <path d="M50 88 Q10 62 12 38 Q14 20 32 20 Q44 20 50 32 Q56 20 68 20 Q86 20 88 38 Q90 62 50 88Z" fill="#ff5d9e" stroke="#fff" stroke-width="3.5"/>
    <path d="M24 34 Q28 26 36 26" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>
    <ellipse cx="50" cy="54" rx="46" ry="10" fill="none" stroke="#ffe45c" stroke-width="4" transform="rotate(-12 50 54)"/>${face(50, 50, .8)}
    ${crown(50, 22, 26)}${spark(10, 14, 7)}${spark(90, 14, 7)}${spark(88, 88, 6)}`},

/* ===================== 甜點（viewBox 0 0 100 100） ===================== */
  /* 稀有：馬卡龍 */
  "dessert-07": {body: () => `<ellipse cx="50" cy="66" rx="38" ry="16" fill="#9be0c0" stroke="#fff" stroke-width="3"/>
    <rect x="14" y="52" width="72" height="12" rx="6" fill="#fff6e8"/><ellipse cx="50" cy="44" rx="38" ry="20" fill="#ffa8c8" stroke="#fff" stroke-width="3"/>
    <path d="M20 52 Q50 60 80 52" stroke="#ff8ab4" stroke-width="3" fill="none"/>${face(50, 42, .8)}`},
  /* 稀有：甜甜圈 */
  "dessert-08": {body: () => `<circle cx="50" cy="52" r="40" fill="#e3a868" stroke="#fff" stroke-width="3"/>
    <path d="M14 46 Q14 16 50 14 Q86 16 86 46 Q84 58 74 54 Q66 66 56 58 Q48 68 40 58 Q30 66 24 54 Q14 58 14 46Z" fill="#ff8fc0"/>
    <circle cx="50" cy="52" r="12" fill="#fdf3e4" stroke="#fff" stroke-width="3"/>
    <g stroke-width="3.5" stroke-linecap="round"><path d="M28 30 l5 -3" stroke="#ffe45c"/><path d="M66 26 l5 3" stroke="#7fd3ff"/><path d="M42 22 l4 4" stroke="#7be08a"/><path d="M74 42 l2 -5" stroke="#fff"/><path d="M24 44 l3 4" stroke="#b48cff"/></g>
    ${face(50, 76, .7)}`},
  /* 稀有：冰淇淋 */
  "dessert-09": {body: () => `<path d="M30 52 L50 96 L70 52Z" fill="#f2c27a" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
    <path d="M36 60 L60 80 M44 54 L66 70 M64 60 L42 80 M56 54 L36 70" stroke="#d99a5b" stroke-width="2.5"/>
    <circle cx="50" cy="40" r="22" fill="#fff4e0" stroke="#fff" stroke-width="3"/><circle cx="36" cy="24" r="14" fill="#ffa8c8"/><circle cx="64" cy="24" r="14" fill="#9be0c0"/>
    <path d="M30 52 Q36 60 42 52 Q48 60 54 52 Q60 60 70 52" fill="#fff4e0"/><circle cx="50" cy="8" r="6" fill="#e23b50"/>${face(50, 40, .7)}`},
  /* 稀有：焦糖布丁 */
  "dessert-10": {body: () => `<ellipse cx="50" cy="86" rx="42" ry="8" fill="#e8f0ff" stroke="#fff" stroke-width="2"/>
    <path d="M24 30 L18 82 Q50 92 82 82 L76 30Z" fill="#ffe08a" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
    <path d="M24 30 Q50 22 76 30 L78 42 Q70 50 66 42 Q58 52 52 42 Q44 52 38 42 Q30 50 22 42Z" fill="#a3561f"/>
    <circle cx="50" cy="20" r="7" fill="#e23b50"/>${face(50, 64, .8)}`},
  /* 極稀有：彩虹千層蛋糕 */
  "dessert-11": {body: () => `${["#ff6b6b", "#ffb347", "#ffe45c", "#7be08a", "#6fc3ff", "#b48cff"].map((c, j) => `<rect x="14" y="${30+j*9}" width="72" height="9" fill="${c}"/>`).join("")}
    <rect x="14" y="22" width="72" height="62" rx="6" fill="none" stroke="#fff" stroke-width="3"/><path d="M14 26 Q50 14 86 26 L86 30 L14 30Z" fill="#fff6e8"/>
    <g fill="#fff6e8"><circle cx="26" cy="20" r="5"/><circle cx="50" cy="16" r="5"/><circle cx="74" cy="20" r="5"/></g><circle cx="50" cy="8" r="6" fill="#e23b50"/>
    <ellipse cx="50" cy="90" rx="44" ry="6" fill="#e8f0ff"/>${face(50, 58, .8)}${spark(8, 10, 6)}${spark(92, 40, 5)}`},
  /* 極稀有：巧克力噴泉——三層巧克力瀑布 */
  "dessert-12": {body: () => `<ellipse cx="50" cy="88" rx="42" ry="9" fill="#7a4a2a" stroke="#fff" stroke-width="2.5"/>
    <path d="M18 86 Q18 64 50 64 Q82 64 82 86Z" fill="#8b5a3c"/><path d="M30 64 Q30 46 50 46 Q70 46 70 64Z" fill="#9c6845"/><path d="M38 46 Q38 30 50 30 Q62 30 62 46Z" fill="#ad7650"/>
    <path d="M50 30 L50 14" stroke="#c9a06a" stroke-width="4"/><circle cx="50" cy="10" r="6" fill="#5e3a22"/>
    <path d="M24 72 q2 8 0 12 M76 72 q-2 8 0 12 M36 54 q2 6 0 10 M64 54 q-2 6 0 10" stroke="#5e3a22" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="16" cy="60" r="6" fill="#e23b50"/><circle cx="84" cy="58" r="6" fill="#ffe45c"/>${face(50, 74, .75)}${spark(90, 20, 6)}`},
  /* 極稀有（只能進化）：城堡蛋糕——三層蛋糕上有小城堡 */
  "dessert-13": {body: () => `<rect x="12" y="66" width="76" height="22" rx="5" fill="#ffd1e0" stroke="#fff" stroke-width="3"/>
    <rect x="22" y="46" width="56" height="22" rx="5" fill="#fff0c2" stroke="#fff" stroke-width="3"/>
    <path d="M34 46 L34 26 L40 26 L40 30 L46 30 L46 26 L54 26 L54 30 L60 30 L60 26 L66 26 L66 46Z" fill="#cfe6ff" stroke="#fff" stroke-width="2.5"/>
    <path d="M46 46 L46 38 Q50 32 54 38 L54 46Z" fill="#8b5a3c"/><path d="M50 26 L50 10" stroke="#8b5a3c" stroke-width="2.5"/><path d="M50 10 L62 14 L50 18Z" fill="#e23b50"/>
    <path d="M12 72 Q22 80 32 72 Q42 80 52 72 Q62 80 72 72 Q82 80 88 72" stroke="#fff" stroke-width="3" fill="none"/>${face(50, 76, .65)}${spark(14, 30, 6)}${spark(88, 34, 6)}`},
  /* 傳說：黃金皇冠蛋糕 */
  "dessert-14": {body: () => `<ellipse cx="50" cy="88" rx="44" ry="7" fill="#fff3c4"/>
    <rect x="16" y="50" width="68" height="36" rx="8" fill="#ffd23f" stroke="#fff" stroke-width="3"/>
    <path d="M16 58 Q24 66 32 58 Q40 66 50 58 Q60 66 68 58 Q76 66 84 58" stroke="#fff6c8" stroke-width="4" fill="none"/>
    <path d="M24 50 L24 22 L37 36 L50 14 L63 36 L76 22 L76 50Z" fill="#ffc21a" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="50" cy="34" r="5" fill="#ff5d7a"/><circle cx="34" cy="42" r="3.5" fill="#6fc3ff"/><circle cx="66" cy="42" r="3.5" fill="#7be08a"/>
    ${face(50, 70, .8)}${spark(10, 20, 7)}${spark(90, 18, 7)}${spark(92, 70, 5)}`},
  /* 傳說（只能進化）：夢幻甜點城堡——彩色塔樓、棒棒糖和雲朵 */
  "dessert-15": {body: () => `<ellipse cx="50" cy="90" rx="46" ry="8" fill="#ffffff" stroke="#ffd6f2" stroke-width="2"/>
    <rect x="14" y="40" width="18" height="48" rx="3" fill="#ffa8c8" stroke="#fff" stroke-width="2.5"/><rect x="68" y="40" width="18" height="48" rx="3" fill="#9be0c0" stroke="#fff" stroke-width="2.5"/>
    <path d="M12 42 L23 18 L34 42Z" fill="#b48cff" stroke="#fff" stroke-width="2.5"/><path d="M66 42 L77 18 L88 42Z" fill="#ffb347" stroke="#fff" stroke-width="2.5"/>
    <rect x="30" y="50" width="40" height="38" rx="4" fill="#fff0c2" stroke="#fff" stroke-width="2.5"/>
    <path d="M28 52 L50 20 L72 52Z" fill="#ff6b9e" stroke="#fff" stroke-width="2.5"/><path d="M42 88 L42 74 Q50 64 58 74 L58 88Z" fill="#8b5a3c"/>
    <circle cx="23" cy="14" r="4" fill="#ffe45c"/><circle cx="77" cy="14" r="4" fill="#ffe45c"/>${crown(50, 20, 18)}
    <path d="M90 60 L90 88" stroke="#fff" stroke-width="2.5"/><circle cx="90" cy="56" r="7" fill="#ff6b6b" stroke="#fff" stroke-width="2"/>
    ${face(50, 60, .55)}${spark(8, 8, 6)}${spark(94, 30, 6)}`}
};

window.StickerArt = ART;
})();
