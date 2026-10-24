/* =========================================================
   識字評量：扭蛋機（gacha.js，2026-10-24 維護者決定，見 docs/game-design.md）
   做完後每位學生一台扭蛋機：拉拉桿（拖下來或點一下都可以）→ 機器搖一搖、轉蛋掉出來 → 依星等不同的特效和聲音打開 → 得到貼紙的大畫面。
   貼紙在做完的那一刻就已經抽好（collect.js 的 drawStickers），拉拉桿只是揭曉；所以「跳過」也不會改變結果。
   特效：普通一下彈跳；稀有藍光加星星；極稀有畫面變暗、轉蛋搖三下、紫色光芒；傳說搖更久、金色光柱、彩帶。
   安全：電腦設定「減少動態效果」時不播動畫（直接揭曉）；聲音跟著「畫面與聲音」的音效開關；不閃爍（沒有快速明暗交替，避免光敏性癲癇）。
   全部用程式畫（SVG、CSS）和瀏覽器合成聲音，不用圖片、音檔。
   ========================================================= */
const GACHA_COLOR = {1:"#6cc66a", 2:"#4fa8f0", 3:"#a77cf0", 4:"#f5c02e"};   /* 轉蛋的顏色＝貼紙簿機率長條的顏色 */
const calmMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 聲音（瀏覽器合成，見 play.js 的 note） ---------- */
const gachaSfx = {
  pull(){ if(!settings.sfx) return; note(196, 0, 0.08, "square", 0.08); note(147, 0.09, 0.1, "square", 0.08); note(330, 0.25, 0.12, "triangle", 0.12); },
  drop(){ if(!settings.sfx) return; note(165, 0, 0.18, "sine", 0.25); note(247, 0.12, 0.12, "triangle", 0.1); },
  /* 打開轉蛋：星等越高越熱鬧；傳說先一串鼓聲再響亮的和弦 */
  open(st){ if(!settings.sfx) return;
    if(st === 1) return note(1047, 0, 0.35, "triangle", 0.18);
    if(st === 2){ [880, 1175].forEach((f, i) => note(f, i * 0.1, 0.4, "triangle", 0.18)); return; }
    if(st === 3){ [523, 659, 784, 1047, 1319].forEach((f, i) => note(f, i * 0.09, 0.45, "triangle", 0.17)); [1568, 2093].forEach((f, i) => note(f, 0.5 + i * 0.12, 0.6, "sine", 0.08)); return; }
    for(let i = 0; i < 10; i++) note(110 + i * 6, i * 0.07, 0.08, "square", 0.06);   /* 鼓聲 */
    [523, 659, 784, 1047].forEach((f, i) => note(f, 0.75 + i * 0.1, 0.5, "triangle", 0.2));
    [523, 659, 784, 1047, 1319].forEach(f => note(f, 1.2, 1.4, "sine", 0.08)); }
};

/* ---------- 扭蛋機的圖 ---------- */
function gachaMachineSvg(){
  const balls = [[70, 70, 1], [100, 58, 2], [128, 74, 1], [84, 98, 3], [116, 100, 1], [96, 80, 4], [62, 100, 2], [136, 102, 1]]
    .map(([x, y, s]) => `<circle cx="${x}" cy="${y}" r="13" fill="${GACHA_COLOR[s]}" stroke="#2d2a26" stroke-width="2.5"/><path d="M${x - 13} ${y} A13 13 0 0 0 ${x + 13} ${y}Z" fill="#fff" opacity=".55"/>`).join("");
  return `<svg class="gmac" viewBox="0 0 200 250" aria-hidden="true">
    <rect x="44" y="128" width="112" height="100" rx="14" fill="#e8504a" stroke="#2d2a26" stroke-width="4"/>
    <rect x="36" y="218" width="128" height="20" rx="8" fill="#c8322a" stroke="#2d2a26" stroke-width="4"/>
    <circle cx="100" cy="82" r="62" fill="#e8f6ff" stroke="#2d2a26" stroke-width="4"/>${balls}
    <path d="M58 46 Q76 30 100 28" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9"/>
    <rect x="76" y="148" width="48" height="16" rx="8" fill="#ffd23f" stroke="#2d2a26" stroke-width="3"/>
    <rect x="80" y="182" width="40" height="30" rx="10" fill="#2d2a26"/>
    <circle cx="100" cy="156" r="5" fill="#fff"/></svg>`;
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
  box.style.setProperty("--gc", GACHA_COLOR[st]);
  box.innerHTML = `<div class="gbox" role="dialog" aria-modal="true" aria-label="扭蛋機">
      <div class="who2">${Rewards.avatarHtml(code)}<b>${esc(name)}</b></div>
      <p class="gsay">拉一下拉桿，看看會扭出什麼！</p>
      <div class="gstage">${gachaMachineSvg()}
        <button class="glever" aria-label="拉拉桿"><span class="gstick"></span><span class="gknob"></span></button>
        <div class="gdrop">${capsuleSvg(st)}</div><div class="gfx"></div></div>
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
    box.classList.add("pulled");
    setTimeout(() => { gachaSfx.drop(); box.classList.add("dropped"); }, 700);
    /* 極稀有、傳說：畫面變暗、轉蛋多搖幾下才打開 */
    const wait = st >= 3 ? (st === 4 ? 1700 : 1100) : 400;
    if(st >= 3) setTimeout(() => box.classList.add("suspense"), 1000);
    setTimeout(() => { gachaSfx.open(st); box.classList.add("opened", "t" + st); burst($g(".gfx"), st); }, 1300 + wait);
    setTimeout(finish, 1300 + wait + (st >= 3 ? 1600 : 900));
  };
  lever.onclick = pull;
  let y0 = null;
  lever.onpointerdown = e => { y0 = e.clientY; };
  lever.onpointermove = e => { if(y0 !== null && e.clientY - y0 > 30){ y0 = null; pull(); } };
  lever.onpointerup = lever.onpointercancel = () => { y0 = null; };
}
/* 打開時飛出來的星星、彩帶：稀有 12 個、極稀有 24 個、傳說 40 個（數量少，舊平板也跑得動） */
function burst(el, st){
  const n = {1:0, 2:12, 3:24, 4:40}[st], colors = st === 4 ? ["#f5c02e", "#ff6b9e", "#6fc3ff", "#7be08a", "#fff3a0"] : [GACHA_COLOR[st], "#fff3a0"];
  el.innerHTML = Array.from({length:n}, (_, i) => { const a = i / n * 360, d = 80 + (i % 3) * 40;
    return `<i style="--a:${a}deg;--d:${d}px;background:${colors[i % colors.length]};animation-delay:${(i % 4) * 40}ms"></i>`; }).join("");
}
