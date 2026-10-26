/* =========================================================
   識字評量：主題、頭像、貼紙（collect.js）
   主題外觀與貼紙圖形在 shared/themes.js，每位學生的收藏與頭像在 shared/rewards.js，
   這個檔案只負責識字評量裡的畫面。
   規則（2026-10-20 定案）：主題只換外觀，計時、提示、答錯規則都不變；作答中不播動畫；
   每完成一次評量抽一張貼紙，不論對錯；中途結束不給；正式評量從基線期起每次都一樣。
   ========================================================= */

/* =========================================================
   11. 主題（設定第 4 步，請學生點一個主題）
   主題卡片畫在 setup.js 的 renderThemePick；按「開始」就用選好的主題開始作答。
   ========================================================= */
/* 這次要不要用主題和貼紙：練習一定用；正式評量看「評量設定」（預設要用） */
const useRewards = () => state.kind !== "formal" || settings.formalTheme;
const themeName = id => (Themes.THEMES[id] || {}).name || "無";
/* 這次會不會玩遊戲（還沒選主題前先判斷；玩遊戲就一定要有主題，場景跟著主題）。
   多位學生各玩各的還不能玩遊戲（正式評量固定個人，所以正式評量只有一位學生或平板時才玩） */
const willFight = () => gameAllowed() && useRewards() && state.kind !== "formal" && playNow() === "game";

function chooseTheme(){
  state.theme = useRewards() && state.themePick !== "none" ? state.themePick : "";
  /* 先下載這次要用的字型（play.js 的 prepareThen）；平板在點名字的畫面已經下載過（tablet.js） */
  TABLET ? startSession() : prepareThen(startSession);
}

/* 作答畫面換上主題的顏色；角落放一個主題小圖示（不會動） */
/* backdrop＝要不要加主題背景插圖（只在練習；正式評量維持固定的主題底色，2026-10-22 維護者決定） */
function applySkin(theme, backdrop){
  const p = $("#play");
  if(theme){ p.dataset.skin = theme; p.classList.add("skin-bg"); $("#pDeco").innerHTML = Themes.icon(theme, Themes.THEMES[theme].stickers[0][0]); }
  else { delete p.dataset.skin; p.classList.remove("skin-bg"); $("#pDeco").innerHTML = ""; }
  $("#pBack").innerHTML = theme && backdrop ? Themes.backdrop(theme) : "";
}

/* =========================================================
   12. 頭像（學生名單裡點頭像更換；預設卡通動物，照片選填）
   ========================================================= */
function avatarPanel(k){
  const a = Rewards.get(k.code).avatar || {};
  return `<div class="avpick" data-code="${esc(k.code)}">
    <p class="note" style="margin:0">選一個卡通角色${k.name ? `給${esc(k.name)}` : ""}：</p>
    <div class="avgrid">${Rewards.ANIMALS.map((x, i) => `<button class="avbtn ${a.type === "animal" && a.id === i ? "on" : ""}" data-av="${i}" aria-label="${x.name}" aria-pressed="${a.type === "animal" && a.id === i}"><span class="av">${Rewards.animalSvg(i)}</span><small>${x.name}</small></button>`).join("")}</div>
    <div class="group"><label class="chip" style="cursor:pointer">上傳照片（選填）<input type="file" accept="image/*" data-photo hidden></label>
      ${a.type === "photo" ? `<span class="note" style="margin:0">目前用照片。</span>` : ""}
      <span class="note" style="margin:0">照片只存在這台電腦，會一起放進備份檔，請妥善保管。</span></div>
  </div>`;
}
function bindAvatarPanel(box, done){
  if(!box) return;
  const code = box.dataset.code;
  box.querySelectorAll("[data-av]").forEach(b => b.onclick = () => { Rewards.setAvatar(code, {type:"animal", id:+b.dataset.av}); done(); });
  box.querySelector("[data-photo]").onchange = async e => {
    const f = e.target.files[0]; if(!f) return;
    try { Rewards.setAvatar(code, {type:"photo", data: await Rewards.photoFromFile(f)}); done(); }
    catch(err){ box.querySelector(".note").textContent = "這張照片讀不進來，請換一張。"; }
  };
}

/* =========================================================
   13. 得到貼紙（結果畫面）
   每位這次有做完的學生各抽一張（中途按「結束」、沒做完的不給）；抽到什麼記在這位學生這次的最後一筆作答紀錄（「獎勵」「獎勵代號」欄）。
   做完的那一刻就先抽好、寫進紀錄（drawStickers，平板要在送出紀錄前抽好），結果畫面的動畫播完才揭曉（giveStickers）。
   ========================================================= */
const VERB = id => (Themes.GACHA_VERB || {})[id] || "得到了";
function drawStickers(g){
  if(!g.rewards || g.got) return;
  g.got = [];
  for(const code of g.kids){
    if(!g.done.has(code)) continue;   /* 沒做完（中途按結束）就不給 */
    const theme = g.theme || Themes.ids[Math.floor(Math.random() * Themes.ids.length)];
    /* 打怪獸：打敗怪獸得到的東西（開始前就決定好）就是這次的貼紙，合作時大家得到一樣的 */
    const pick = g.game ? g.prize : undefined;
    /* 平板不存收藏（2026-10-24 決定）：只抽、寫進紀錄送給老師，老師匯入後才收進貼紙簿 */
    const idx = TABLET ? (pick ?? Themes.drawSticker(theme, [])) : Rewards.award(code, theme, {tool:"識字評量", session:g.session, idx:pick});
    if(TABLET) (tabletGot[code] ||= []).push(Themes.codeOf(theme, idx));   /* 平板的貼紙簿看得到今天抽到的（不存起來） */
    const text = Themes.stickerName(theme, idx);
    const mine = records.filter(r => r.session === g.session && r.kid === code);
    if(mine.length){ const r = mine[mine.length - 1]; r.reward = text; r.rewardCode = Themes.codeOf(theme, idx); updateRecord(r); }
    g.got.push({code, theme, idx, text});
  }
}
/* 結果畫面：每張卡片加上這次的貼紙，再一位一位播「得到貼紙」的大畫面 */
function giveStickers(g){
  drawStickers(g);
  if(!g.got || g.awarded) return;
  g.awarded = true;
  for(const {code, theme, idx} of g.got){
    const card = $(`#rList .rcard[data-kid="${CSS.escape(code)}"]`);
    if(card) card.insertAdjacentHTML("beforeend", `<div class="sticker">${Themes.stickerSvg(theme, idx)}<div>得到新貼紙<br><b>${esc(Themes.THEMES[theme].stickers[idx][1])}</b>${Themes.stars(theme, idx) ? `<br><span class="rstar">${"★".repeat(Themes.stars(theme, idx))}</span>` : ""}</div></div>`);
  }
  showReveals(g.got);
}
/* 匯入平板的作答紀錄後：紀錄裡的貼紙代號收進學生的貼紙簿（同一次作答只收一次）；回傳收了幾張 */
function importStickers(recs){
  let n = 0;
  for(const r of recs){
    const f = r.rewardCode && !r.quit ? Themes.findCode(r.rewardCode) : null;
    if(!f || Rewards.hasSession(r.kid, r.session)) continue;
    Rewards.award(r.kid, f.theme, {tool:"識字評量（平板）", session:r.session, sticker:r.rewardCode}); n++;
  }
  return n;
}
/* 一位一位：先開扭蛋機（gacha.js，拉拉桿揭曉），再顯示「得到貼紙」的大畫面，按「收進貼紙簿」換下一位 */
function showReveals(list){
  if(!list.length) return;
  showGacha(list[0], () => showCard(list));
}
function showCard(list){
  const {code, theme, idx} = list[0], k = kidBy(code), name = k ? kidShow(k) : code;
  const t = Themes.THEMES[theme], stars = Themes.stars(theme, idx), label = Themes.rareLabel(theme, idx);
  const box = document.createElement("div"); box.className = "reveal";
  box.style.setProperty("--rc", stars ? Themes.RARE_GLOW[stars] : t.stickers[idx][0]);
  box.innerHTML = `<div class="rays2"></div><div class="box" role="dialog" aria-modal="true" aria-label="得到貼紙">
    <div class="who2">${Rewards.avatarHtml(code)}<b>${esc(name)}</b></div>
    ${Themes.stickerSvg(theme, idx)}${stars ? `<div class="stars">${"★".repeat(stars)}</div>` : ""}
    <div class="rname">${esc(t.stickers[idx][1])}</div>${label ? `<div class="rare">${esc(label)}</div>` : ""}
    <div style="font-size:20px">${esc(name)}${VERB(theme)}${esc(t.stickers[idx][1])}！</div>
    <button class="go" data-ok>收進貼紙簿</button></div>`;
  document.body.appendChild(box);
  box.querySelector("[data-ok]").focus();
  if(stars < 3) sfx.fanfare();   /* 極稀有、傳說在扭蛋機打開時已經有一大段音效 */
  /* 唸名字只用本機語音，沒有就只唸得到什麼（見 play.js 的 speak） */
  setTimeout(() => { if(!speak(`${name}${VERB(theme)}${t.stickers[idx][1]}！`, null, null, true)) speak(`${VERB(theme)}${t.stickers[idx][1]}！`); }, 600);
  box.querySelector("[data-ok]").onclick = () => { box.remove(); showReveals(list.slice(1)); };
}

/* =========================================================
   14. 貼紙簿（學生自己看：選名字 → 看四個主題收集了哪些）
   ========================================================= */
let bookKid = null, bookFrom = "#setup";
/* 平板上今天抽到的貼紙（只在這個分頁，不存起來；老師匯入後才真的收進貼紙簿） */
const tabletGot = {};
/* 某位學生的收藏 {主題:[貼紙代號…]}。電腦：這台電腦存的（rewards.js）。
   平板（2026-10-24 維護者決定）：產生 QR code 時帶來的「老師電腦上已收集哪幾張」（tablet.js 的 ownPack，只記有沒有、不記幾張），加上今天抽到的 */
function bookStickers(code){
  if(!TABLET) return Rewards.get(code).stickers || {};
  const st = ownUnpack(((TABLET.st || {}).ow || {})[code]);
  for(const c of tabletGot[code] || []){ const f = Themes.findCode(c); if(f) (st[f.theme] ||= []).push(c); }
  return st;
}
/* 抽中機率（2026-10-24 維護者決定：寫百分比，加一條照比例分段的彩色長條；長條只是圖，文字才是內容）。
   四個主題的機率一樣，所以貼紙簿最上面固定寫一次就好（維護者要求，不要每個主題都寫） */
const ODDS_COLOR = {1:"#6cc66a", 2:"#4fa8f0", 3:"#a77cf0", 4:"#f5c02e"};
function oddsHtml(){
  const t = Themes.ids[0], odds = Themes.tierOdds(t), evo = Themes.LISTS[t].filter(d => d.evo).length;
  return `<div class="card odds"><div class="oddsbar" aria-hidden="true">${odds.map(o => `<span style="flex:${o.pct};background:${ODDS_COLOR[o.stars]}"></span>`).join("")}</div>
    <p class="oddstxt">抽中機會（每個主題都一樣）：${odds.map(o => `<span><i style="background:${ODDS_COLOR[o.stars]}"></i>${"★".repeat(o.stars)} ${o.label} ${o.pct}%</span>`).join("")}${evo ? `<span class="evo">每個主題有 ${evo} 張要進化才拿得到，抽不到</span>` : ""}</p></div>`;
}
/* 貼紙簿的排列：照稀有度（普通 → 稀有 → 極稀有 → 傳說），同一級裡抽得到的在前、只能進化的在後（2026-10-24 維護者要求）；
   只改畫面上的順序，貼紙代號和收藏都不變 */
const bookOrder = theme => Themes.THEMES[theme].stickers.map((s, i) => i)
  .sort((a, b) => Themes.stars(theme, a) - Themes.stars(theme, b) || Themes.isEvo(theme, a) - Themes.isEvo(theme, b) || a - b);
/* 貼紙簿的一格（2026-10-24 維護者決定）：收集到的是彩色圖和名稱；還沒收集的——
   一、二星是灰色圖和名稱，三星是全黑剪影、名稱「???」，四星（傳說）再加金框和「傳說」字樣；只能進化的另外寫「進化才能得到」 */
function bookCard(theme, i, name, n){
  const st = Themes.stars(theme, i), starTxt = `<span class="rstar">${"★".repeat(st)}</span>`;
  if(n) return `<div class="stk ${st === 4 ? "lgd" : ""}">${Themes.stickerSvg(theme, i)}<div>${esc(name)}${n > 1 ? ` ×${n}` : ""}</div>${starTxt}</div>`;
  const evo = Themes.isEvo(theme, i) ? `<small class="evo">進化才能得到</small>` : "";
  if(st <= 2) return `<div class="stk no gray">${Themes.stickerSvg(theme, i)}<div>${esc(name)}</div>${starTxt}${evo}</div>`;
  return `<div class="stk no shadow ${st === 4 ? "lgd" : ""}">${Themes.stickerSvg(theme, i)}<div>???</div>${st === 4 ? `<span class="legendtag">傳說</span>` : starTxt}${evo}</div>`;
}
function renderBook(){
  if(!kidBy(bookKid)) bookKid = null;
  /* 平板只看得到正在作答的這位學生 */
  const who = TABLET ? kids.filter(k => state.kids.has(k.code)) : kids;
  $("#bookNames").innerHTML = who.length ? who.map(k => `<button class="chip kidchip ${bookKid === k.code ? "on" : ""}" data-k="${esc(k.code)}" aria-pressed="${bookKid === k.code}">${Rewards.avatarHtml(k.code)}${esc(kidShow(k))}</button>`).join("")
    : `<p class="note">還沒有學生，請老師先到「學生名單」加入。</p>`;
  $("#bookNames").querySelectorAll("[data-k]").forEach(b => b.onclick = () => { bookKid = b.dataset.k; renderBook(); });
  if(!bookKid){ $("#bookBody").innerHTML = kids.length ? `<p class="hint">點自己的名字，看看收集了哪些貼紙。</p>` : ""; return; }
  const st = bookStickers(bookKid);
  $("#bookBody").innerHTML = oddsHtml() + Themes.ids.map(id => {
    const t = Themes.THEMES[id], cnt = {};
    (st[id] || []).forEach(c => { const f = Themes.findCode(c); if(f && f.theme === id) cnt[f.idx] = (cnt[f.idx] || 0) + 1; });
    const have = Object.keys(cnt).length;
    return `<section class="card booksec"><h2>${esc(t.name)}　<small>${have} / ${t.stickers.length}（星星越多越稀有）</small></h2>
      <div class="stkrow">${bookOrder(id).map(i => bookCard(id, i, t.stickers[i][1], cnt[i])).join("")}</div></section>`;
  }).join("");
}
/* 打開貼紙簿：從設定畫面（選單），或從結果畫面（2026-10-24 維護者要求：玩完可以直接看貼紙簿，看完回到結果畫面） */
function openBook(from, code){
  bookFrom = from; if(code) bookKid = code;
  $("#bookBack").textContent = from === "#result" ? "回到結果" : "回到設定";
  renderBook(); showScreen("#book");
}
$("#openBook").onclick = () => openBook("#setup");
$("#bookBack").onclick = () => showScreen(bookFrom);
$("#rBook").onclick = () => { if(G) openBook("#result", G.kids[0]); };

/* 備份檔裡一起放收藏與頭像（備份檔第 2 版） */
addBackupPart("rewards", () => Rewards.exportAll(), list => Rewards.importAll(list));
