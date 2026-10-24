/* =========================================================
   識字評量：扭蛋機（gacha.js，2026-10-24 維護者決定，見 docs/game-design.md）
   做完後每位學生一台扭蛋機（滿版）：拉拉桿（拖下來或點一下都可以）→ 扭蛋機轉動（約 1 秒，有聲音）→ 轉蛋掉出來 →
   搖三下（約 2 秒，每個星等都一樣）→ 依星等不同的鋪陳 → 打開和特效（普通約 1 秒、稀有 2 秒、極稀有 3 秒、傳說 4 秒）→ 得到貼紙的大畫面（接近滿版）。
   （2026-10-24 維護者決定的時間表，時間都寫在下面的 GACHA_T，要調整改那裡就好）
   貼紙在做完的那一刻就已經抽好（collect.js 的 drawStickers），拉拉桿只是揭曉；所以「跳過」也不會改變結果。
   鋪陳與特效：普通一下彈跳；稀有藍光、星星兩波；極稀有畫面慢慢變暗、紫色光芒、星星三波、閃亮的雨；傳說變暗、金色光柱、彩帶三波、金粉雨。
   安全：電腦設定「減少動態效果」時不播動畫（直接揭曉）；聲音跟著「畫面與聲音」的音效開關；不閃爍（沒有快速明暗交替，避免光敏性癲癇）。
   全部用程式畫（SVG、CSS）和瀏覽器合成聲音，不用圖片、音檔。
   ========================================================= */
const GACHA_COLOR = {1:"#6cc66a", 2:"#4fa8f0", 3:"#a77cf0", 4:"#f5c02e"};   /* 轉蛋的顏色＝貼紙簿機率長條的顏色 */
const calmMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/* 時間表（毫秒）：轉動、掉出、搖三下、打開前的鋪陳（依星等）、打開後的特效（依星等） */
const GACHA_T = {turn:1000, drop:500, shake:2000, pre:{1:400, 2:600, 3:1200, 4:1800}, post:{1:1000, 2:2000, 3:3000, 4:4000}};

/* ---------- 聲音（瀏覽器合成，見 play.js 的 note） ---------- */
const gachaSfx = {
  pull(){ if(!settings.sfx) return; note(196, 0, 0.08, "square", 0.08); note(147, 0.09, 0.1, "square", 0.08); },
  /* 扭蛋機轉動：喀啦喀啦一串，最後「轟」一聲 */
  turn(){ if(!settings.sfx) return; for(let i = 0; i < 8; i++) note(i % 2 ? 520 : 440, i * 0.11, 0.05, "square", 0.05); note(110, 0.85, 0.25, "sine", 0.2); },
  /* 轉蛋搖一下 */
  shake(){ if(settings.sfx){ note(392, 0, 0.07, "triangle", 0.1); note(330, 0.08, 0.07, "triangle", 0.1); } },
  /* 打開前的鋪陳：極稀有、傳說有一段往上爬的音 */
  pre(st){ if(!settings.sfx || st < 3) return; const n = st === 4 ? 12 : 8, d = GACHA_T.pre[st] / 1000 / n;
    for(let i = 0; i < n; i++) note(220 * Math.pow(2, i / 12), i * d, d * 1.2, "triangle", 0.06 + i * 0.006); },
  drop(){ if(!settings.sfx) return; note(165, 0, 0.18, "sine", 0.25); note(247, 0.12, 0.12, "triangle", 0.1); },
  /* 打開轉蛋：星等越高越熱鬧；傳說先一串鼓聲再響亮的和弦 */
  open(st){ if(!settings.sfx) return;
    if(st === 1){ note(1047, 0, 0.35, "triangle", 0.18); note(1319, 0.15, 0.5, "sine", 0.08); return; }
    if(st === 2){ [880, 1175, 1397].forEach((f, i) => note(f, i * 0.12, 0.5, "triangle", 0.17)); [1760, 2093].forEach((f, i) => note(f, 0.9 + i * 0.15, 0.6, "sine", 0.07)); return; }
    if(st === 3){ [523, 659, 784, 1047, 1319].forEach((f, i) => note(f, i * 0.09, 0.45, "triangle", 0.17));
      [1568, 2093, 1568, 2093].forEach((f, i) => note(f, 0.6 + i * 0.3, 0.6, "sine", 0.08)); [523, 784, 1047].forEach(f => note(f, 1.6, 1.3, "sine", 0.07)); return; }
    for(let i = 0; i < 10; i++) note(110 + i * 6, i * 0.07, 0.08, "square", 0.06);   /* 鼓聲 */
    [523, 659, 784, 1047].forEach((f, i) => note(f, 0.75 + i * 0.1, 0.5, "triangle", 0.2));
    [523, 659, 784, 1047, 1319].forEach(f => note(f, 1.2, 1.6, "sine", 0.08));
    [1568, 2093, 2637].forEach((f, i) => note(f, 2.2 + i * 0.25, 0.8, "sine", 0.06)); [523, 659, 784, 1047].forEach(f => note(f, 2.9, 1.0, "triangle", 0.06)); }
};

/* ---------- 扭蛋機的圖（2026-10-24 維護者決定：照主題換外觀，見 docs/game-design.md） ----------
   四個主題各一款，位置都一樣（圓罩、曲柄、出口、拉桿），只換顏色和裝飾；時間表、動畫不變。
   罩子裡的球一律用星等的顏色（和貼紙簿機率長條一樣），換主題也不會讓學生搞混顏色的意思。
   找不到主題時用通用那台（紅色）；沒有主題就沒有貼紙，所以平常不會用到 */
const GACHA_SKIN = {
  ocean:{body:"#2f8fd8", base:"#1d5f9e", glass:"#d6f1ff",
    inner:`<path d="M49.3 50 q12.7 -8 25.4 0 t25.4 0 t25.4 0 t25.4 0 A60 60 0 1 1 49.3 50Z" fill="#8fd3f5"/>`,   /* 罩子裡裝著水 */
    back:`<path d="M44 196 q14 -10 28 0 t28 0 t28 0 t28 0 V228 H44Z" fill="#1d5f9e"/>`,
    front:`<g class="gbubs" fill="none" stroke="#fff" stroke-width="2.5" opacity=".85"><circle class="gbub" cx="60" cy="120" r="5"/><circle class="gbub" cx="142" cy="116" r="4" style="animation-delay:-1.2s"/><circle class="gbub" cx="104" cy="124" r="3.5" style="animation-delay:-2.1s"/></g>
      <path d="M58 172 l4 -9 l4 9 l9 1 l-7 6 l2 9 l-8 -5 l-8 5 l2 -9 l-7 -6Z" fill="#ffb04a" stroke="#2d2a26" stroke-width="2"/>`},
  dino:{body:"#9b8b78", base:"#6f6152", glass:"#fdf3dc", egg:true,
    back:``,
    front:`<path d="M30 226 q-16 -22 -2 -42 q12 18 6 42Z M36 226 q-2 -30 22 -40 q-2 24 -18 40Z" fill="#5fae4e" stroke="#2d2a26" stroke-width="2.5" stroke-linejoin="round"/>
      <g fill="none" stroke="#5e5040" stroke-width="2.5" stroke-linecap="round"><path d="M52 140 l10 8 l-4 10"/><path d="M148 196 l-10 6 l2 10"/></g>
      <g fill="#b4a592"><circle cx="62" cy="200" r="5"/><circle cx="136" cy="146" r="4"/><circle cx="70" cy="214" r="3"/></g>`},
  space:{body:"#f4f6fb", base:"#8a94a6", glass:"#1e2a52", rim:"#8a94a6",
    back:`<path d="M100 2 Q160 36 156 128 H44 Q40 36 100 2Z" fill="#f4f6fb" stroke="#2d2a26" stroke-width="4"/>
      <path d="M44 188 L22 236 H44Z M156 188 L178 236 H156Z" fill="#e8504a" stroke="#2d2a26" stroke-width="4" stroke-linejoin="round"/>
      <g class="gflame"><path d="M78 238 Q86 250 100 247 Q114 250 122 238Z" fill="#ffb04a" stroke="#2d2a26" stroke-width="3"/><path d="M90 238 Q100 246 110 238Z" fill="#ffe27a"/></g>`,
    front:`<g fill="#fff"><circle cx="60" cy="52" r="2"/><circle cx="138" cy="44" r="1.6"/><circle cx="118" cy="124" r="1.8"/><circle cx="56" cy="110" r="1.4"/></g>
      <rect x="44" y="196" width="112" height="10" fill="#e8504a"/>`},
  dessert:{body:"#ff9ec4", base:"#e46a9a", glass:"#fff4fa",
    back:``,
    front:`<rect x="70" y="14" width="60" height="14" rx="6" fill="#e46a9a" stroke="#2d2a26" stroke-width="3.5"/>
      <path d="M100 14 q2 -8 10 -12" stroke="#2d2a26" stroke-width="2.5" fill="none"/><circle cx="100" cy="8" r="7" fill="#e8304a" stroke="#2d2a26" stroke-width="2.5"/>
      <path d="M44 132 h112 v10 q-7 12 -14 0 t-14 0 t-14 0 t-14 0 t-14 0 t-14 0 t-14 0 t-14 0Z" fill="#fff" stroke="#2d2a26" stroke-width="2.5"/>
      <g stroke-width="4" stroke-linecap="round"><path d="M58 176 l5 -3" stroke="#6fc3ff"/><path d="M140 168 l4 4" stroke="#7be08a"/><path d="M64 206 l4 3" stroke="#f5c02e"/><path d="M134 204 l5 -2" stroke="#a77cf0"/></g>`}
};
const GACHA_SKIN_DEFAULT = {body:"#e8504a", base:"#c8322a", glass:"#e8f6ff", back:"", front:""};
const gachaSkin = theme => GACHA_SKIN[theme] || GACHA_SKIN_DEFAULT;
function gachaMachineSvg(theme){
  const k = gachaSkin(theme);
  /* 罩子裡的球：恐龍是蛋形（橢圓、有斑點），其他主題是圓球 */
  const balls = [[70, 70, 1], [100, 58, 2], [128, 74, 1], [84, 98, 3], [116, 100, 1], [96, 80, 4], [62, 100, 2], [136, 102, 1]]
    .map(([x, y, s]) => k.egg
      ? `<ellipse cx="${x}" cy="${y}" rx="11" ry="14" fill="${GACHA_COLOR[s]}" stroke="#2d2a26" stroke-width="2.5"/><circle cx="${x - 3}" cy="${y - 4}" r="2.5" fill="#fff" opacity=".7"/><circle cx="${x + 4}" cy="${y + 4}" r="2" fill="#fff" opacity=".7"/>`
      : `<circle cx="${x}" cy="${y}" r="13" fill="${GACHA_COLOR[s]}" stroke="#2d2a26" stroke-width="2.5"/><path d="M${x - 13} ${y} A13 13 0 0 0 ${x + 13} ${y}Z" fill="#fff" opacity=".55"/>`).join("");
  return `<svg class="gmac" viewBox="0 0 200 250" aria-hidden="true">${k.back}
    <rect x="44" y="128" width="112" height="100" rx="14" fill="${k.body}" stroke="#2d2a26" stroke-width="4"/>
    <rect x="36" y="218" width="128" height="20" rx="8" fill="${k.base}" stroke="#2d2a26" stroke-width="4"/>
    <circle cx="100" cy="82" r="62" fill="${k.glass}" stroke="${k.rim || "#2d2a26"}" stroke-width="${k.rim ? 9 : 4}"/>${k.rim ? `<circle cx="100" cy="82" r="67" fill="none" stroke="#2d2a26" stroke-width="3"/>` : ""}${k.inner || ""}<g class="gballs">${balls}</g>
    <path d="M58 46 Q76 30 100 28" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9"/>${k.front}
    <g class="gcrank"><circle cx="100" cy="156" r="17" fill="#ffd23f" stroke="#2d2a26" stroke-width="3"/><rect x="83" y="152" width="34" height="8" rx="4" fill="#fff" stroke="#2d2a26" stroke-width="2.5"/></g>
    <rect x="80" y="182" width="40" height="30" rx="10" fill="#2d2a26"/>
    </svg>`;
}
/* 轉蛋（上下兩半，打開時上半飛走） */
const capsuleSvg = st => `<svg class="gcap" viewBox="0 0 80 80" aria-hidden="true">
  <g class="gbot"><path d="M8 40 A32 32 0 0 0 72 40Z" fill="#fff" stroke="#2d2a26" stroke-width="4"/></g>
  <g class="gtop"><path d="M8 40 A32 32 0 0 1 72 40Z" fill="${GACHA_COLOR[st]}" stroke="#2d2a26" stroke-width="4"/><path d="M20 26 Q28 16 40 14" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/></g></svg>`;

/* ---------- 一位學生的扭蛋機 ----------
   item＝{code, theme, idx}；done()＝揭曉後要做的事（collect.js 的得到貼紙大畫面） */
function showGacha(item, done){
  const {code, theme, idx} = item, k = kidBy(code), name = k ? kidShow(k) : code, st = Themes.stars(theme, idx) || 1;
  const box = document.createElement("div"); box.className = "reveal gacha s" + st;   /* s1～s4：星等（傳說多搖幾下） */
  box.style.setProperty("--gc", GACHA_COLOR[st]); box.style.setProperty("--gbase", gachaSkin(theme).base);   /* 拉桿底座跟機身同色 */
  box.innerHTML = `<div class="gbox" role="dialog" aria-modal="true" aria-label="扭蛋機">
      <div class="who2">${Rewards.avatarHtml(code)}<b>${esc(name)}</b></div>
      <p class="gsay">拉一下拉桿，看看會扭出什麼！</p>
      <div class="gstage">${gachaMachineSvg(theme)}
        <button class="glever" aria-label="拉拉桿"><span class="gbase"></span><span class="grod"></span><span class="gknob"></span></button>
        <div class="gdrop">${capsuleSvg(st)}</div><div class="gfx"></div></div>
      <div class="grain" aria-hidden="true"></div>
      <div class="row" style="justify-content:center"><button class="ghost gskip">跳過</button><button class="ghost gq" aria-expanded="false">？抽中機會</button></div>
      <div class="godds" hidden>${oddsHtml()}</div></div>`;
  document.body.appendChild(box);
  const $g = s => box.querySelector(s), lever = $g(".glever");
  lever.focus();
  let pulled = false;
  const finish = () => { box.remove(); done(); };
  $g(".gskip").onclick = () => { pulled = true; finish(); };
  $g(".gq").onclick = e => { const o = $g(".godds"); o.hidden = !o.hidden; e.currentTarget.setAttribute("aria-expanded", !o.hidden); };
  /* 拉拉桿：點一下，或按住往下拖都算 */
  const pull = () => {
    if(pulled) return; pulled = true;
    gachaSfx.pull();
    if(calmMotion()){ gachaSfx.open(st); return setTimeout(finish, 300); }
    const T = GACHA_T, at = (ms, f) => setTimeout(() => { if(box.isConnected) f(); }, ms);
    let t = 0;
    box.classList.add("pulled", "turning"); gachaSfx.turn();                                   /* 1. 扭蛋機轉動 */
    at(t += T.turn, () => { box.classList.remove("turning"); box.classList.add("dropped"); gachaSfx.drop(); });   /* 2. 掉出來 */
    at(t += T.drop, () => { box.classList.add("shaking"); [0, 1, 2].forEach(i => at(i * T.shake / 3, gachaSfx.shake)); });   /* 3. 搖三下 */
    at(t += T.shake, () => { box.classList.remove("shaking"); box.classList.add("pre"); if(st >= 3) box.classList.add("suspense"); gachaSfx.pre(st); });   /* 4. 鋪陳 */
    at(t += T.pre[st], () => { gachaSfx.open(st); box.classList.add("opened", "t" + st); celebrate($g(".gfx"), $g(".grain"), st); });   /* 5. 打開 */
    at(t + T.post[st], finish);
  };
  /* ---------- 拉桿（2026-10-24 維護者要求：看得到一根桿子往下拉） ----------
     p＝拉到哪裡（0＝最上面，1＝拉到底）。圓球從上面滑到底座下方，桿子從底座的軸心連到圓球，跟著變長變短。
     點一下：自己慢慢滑到底（0.6 秒）再彈回去；用手指拉：圓球跟著手指，拉過一半放手就算拉了，沒過一半就彈回去 */
  const knob = $g(".gknob"), rod = $g(".grod"), PIVOT = 0.55;   /* 軸心在拉桿區的 55% 高度 */
  const setP = p => { const k = p * 0.9, top = Math.min(k, PIVOT), len = Math.abs(PIVOT - k);
    knob.style.top = (k * 100) + "%"; rod.style.top = (top * 100 + 6) + "%"; rod.style.height = (len * 100) + "%"; };
  setP(0);
  let anim = 0;
  const glide = (from, to, ms, then) => { cancelAnimationFrame(anim); const t0 = performance.now();
    const step = now => { const r = Math.min(1, (now - t0) / ms), e = r < .5 ? 2 * r * r : 1 - Math.pow(-2 * r + 2, 2) / 2;
      setP(from + (to - from) * e); if(r < 1) anim = requestAnimationFrame(step); else if(then) then(); };
    anim = requestAnimationFrame(step); };
  let cur = 0, y0 = null, dragged = false;
  const goDown = from => { lever.classList.add("held");
    if(calmMotion()){ setP(1); pull(); return; }
    glide(from, 1, 600 * (1 - from) + 100, () => { pull(); setTimeout(() => glide(1, 0, 450), 250); }); };
  lever.onclick = () => { if(!dragged && !pulled) goDown(0); dragged = false; };
  lever.onpointerdown = e => { if(pulled) return; y0 = e.clientY; dragged = false; try { lever.setPointerCapture(e.pointerId); } catch(err){} };
  lever.onpointermove = e => { if(y0 === null || pulled) return;
    const h = lever.getBoundingClientRect().height * 0.9, d = Math.max(0, e.clientY - y0);
    if(d > 6) dragged = true;
    cur = Math.min(1, d / h); lever.classList.add("held"); setP(cur); };
  lever.onpointerup = lever.onpointercancel = () => { if(y0 === null) return; y0 = null;
    if(!dragged) return;   /* 只是點一下：交給 onclick */
    if(cur > 0.5) goDown(cur); else { lever.classList.remove("held"); glide(cur, 0, 300); } };
}
/* 打開時的星星、彩帶：分幾波噴出（稀有 2 波、極稀有和傳說 3 波，每波 12～20 個），極稀有和傳說再加從上面慢慢落下的閃亮雨；
   數量不多，舊平板也跑得動 */
function celebrate(fx, rain, st){
  const waves = {1:1, 2:2, 3:3, 4:3}[st], per = {1:8, 2:12, 3:16, 4:20}[st];
  const colors = st === 4 ? ["#f5c02e", "#ff6b9e", "#6fc3ff", "#7be08a", "#fff3a0"] : [GACHA_COLOR[st], "#fff3a0"];
  for(let w = 0; w < waves; w++) setTimeout(() => {
    fx.insertAdjacentHTML("beforeend", Array.from({length:per}, (_, i) => { const a = (i + w / 2) / per * 360, d = 90 + (i % 3) * 45 + w * 20;
      return `<i style="--a:${a}deg;--d:${d}px;background:${colors[i % colors.length]}"></i>`; }).join(""));
  }, w * 700);
  if(st >= 3) rain.innerHTML = Array.from({length: st === 4 ? 30 : 20}, (_, i) =>
    `<i style="left:${(i * 37) % 100}%;animation-delay:${(i * 130) % 1800}ms;background:${st === 4 ? "#f5c02e" : "#c9b2ff"}"></i>`).join("");
}
