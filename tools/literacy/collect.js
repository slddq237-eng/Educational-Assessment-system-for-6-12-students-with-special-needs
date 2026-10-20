/* =========================================================
   識字評量：主題、頭像、貼紙（collect.js）
   主題外觀與貼紙圖形在 shared/themes.js，每位學生的收藏與頭像在 shared/rewards.js，
   這個檔案只負責識字評量裡的畫面。
   規則（2026-10-20 定案）：主題只換外觀，計時、提示、答錯規則都不變；作答中不播動畫；
   每完成一次評量抽一張貼紙，不論對錯；中途結束不給；正式評量從基線期起每次都一樣。
   ========================================================= */

/* =========================================================
   11. 選主題畫面（按「開始」之後、第一題之前）
   ========================================================= */
/* 這次要不要用主題和貼紙：練習一定用；正式評量看「評量設定」（預設要用） */
const useRewards = () => state.kind !== "formal" || settings.formalTheme;
const themeName = id => (Themes.THEMES[id] || {}).name || "無";

function chooseTheme(){
  if(!useRewards()){ state.theme = ""; startSession(); return; }
  const list = selKids().map(kidBy);
  /* 打怪獸（3-3）：練習可以在這裡選要不要玩；正式評量照評量設定。要玩就一定要選主題（場景跟著主題） */
  const can = gameAllowed(), formal = state.kind === "formal", play = can && (formal ? !!settings.formalGame : settings.practiceGame !== false);
  $("#pickGame").innerHTML = !can ? "" : formal
    ? `<span class="note" style="margin:0">${play ? "這次會打怪獸（評量設定）：打敗怪獸得到的就是這次的貼紙。" : ""}</span>`
    : `<span class="tl">玩法</span>${chipRow([["1", `打怪獸（${list.length > 1 ? "大家合作" : "自己打"}）`], ["0", "只換顏色"]], play ? "1" : "0", "pgame")}`;
  $("#pickGame").querySelectorAll("[data-pgame]").forEach(b => b.onclick = () => { settings.practiceGame = b.dataset.pgame === "1"; saveSettings(); chooseTheme(); });
  /* 血量模式（3-3b）：只在練習的正確率模式；合作打怪獸時全組共用，其他時候每人各自 */
  const hp = heartsAllowed() ? +settings.practiceHearts || 0 : 0;
  $("#pickHearts").innerHTML = !heartsAllowed() ? "" : `<span class="tl">愛心</span>${chipRow([["0", "不用"], ...HEART_CHOICES.map(n => [String(n), `${n} 顆`])], String(hp), "phearts")}
    ${hp ? `<span class="note" style="margin:0">答錯少一顆、連續答對 3 題補一顆，用完就結束${list.length > 1 ? (play ? "（大家共用）" : "（每人各自）") : ""}</span>` : ""}`;
  $("#pickHearts").querySelectorAll("[data-phearts]").forEach(b => b.onclick = () => { settings.practiceHearts = +b.dataset.phearts; saveSettings(); chooseTheme(); });
  /* 注音（3-4，只在練習）：選項加不加注音；語詞、句子提示一律有注音 */
  $("#pickBpmf").innerHTML = formal ? "" : `<span class="tl">注音</span>${chipRow([["0", "選項不加"], ["1", "選項加注音"]], settings.practiceBpmf ? "1" : "0", "pbpmf")}
    <span class="note" style="margin:0">語詞、句子提示一律有注音</span>`;
  $("#pickBpmf").querySelectorAll("[data-pbpmf]").forEach(b => b.onclick = () => { settings.practiceBpmf = b.dataset.pbpmf === "1"; saveSettings(); chooseTheme(); });
  const LINE = id => play ? Themes.THEMES[id].line : `可以得到${Themes.THEMES[id].name}的貼紙`;
  $("#pickWho").innerHTML = list.map(k => `<span class="pk">${Rewards.avatarHtml(k.code)}${esc(kidShow(k))}</span>`).join("");
  $("#pickHint").textContent = list.length > 1 ? "大家一起決定，要去哪裡冒險？" : "你想去哪裡冒險？";
  $("#themes").innerHTML = Themes.ids.map(id => { const t = Themes.THEMES[id];
    return `<button class="theme" data-skin="${id}" data-t="${id}">${Themes.icon(id, t.stickers[0][0])}${esc(t.name)}<small>${esc(LINE(id))}</small></button>`; }).join("")
    + (play ? "" : `<button class="theme none" data-t=""><span style="font-size:72px;line-height:110px">☆</span>不用主題<small>一樣可以得到貼紙</small></button>`);
  $("#themes").querySelectorAll("button").forEach(b => b.onclick = () => { state.theme = b.dataset.t; startSession(); });
  showScreen("#pick");
}
$("#pickBack").onclick = () => showScreen("#setup");

/* 作答畫面換上主題的顏色；角落放一個主題小圖示（不會動） */
function applySkin(theme){
  const p = $("#play");
  if(theme){ p.dataset.skin = theme; p.classList.add("skin-bg"); $("#pDeco").innerHTML = Themes.icon(theme, Themes.THEMES[theme].stickers[0][0]); }
  else { delete p.dataset.skin; p.classList.remove("skin-bg"); $("#pDeco").innerHTML = ""; }
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
   每位這次有做完的學生各抽一張（中途按「結束」、沒做完的不給）；抽到什麼記在這位學生這次的最後一筆作答紀錄（「獎勵」欄）。
   ========================================================= */
const VERB = id => (Themes.GACHA_VERB || {})[id] || "得到了";
function giveStickers(g){
  if(!g.rewards || g.awarded) return;
  g.awarded = true;
  const got = [];
  for(const code of g.kids){
    if(!g.done.has(code)) continue;   /* 沒做完（中途按結束）就不給 */
    const theme = g.theme || Themes.ids[Math.floor(Math.random() * Themes.ids.length)];
    /* 打怪獸：打敗怪獸得到的東西（開始前就決定好）就是這次的貼紙，合作時大家得到一樣的 */
    const idx = Rewards.award(code, theme, {tool:"識字評量", session:g.session, idx: g.game ? g.prize : undefined});
    const text = Themes.stickerName(theme, idx);
    const mine = records.filter(r => r.session === g.session && r.kid === code);
    if(mine.length){ const r = mine[mine.length - 1]; r.reward = text; updateRecord(r); }
    got.push({code, theme, idx, text});
    const card = $(`#rList .rcard[data-kid="${CSS.escape(code)}"]`);
    if(card) card.insertAdjacentHTML("beforeend", `<div class="sticker">${Themes.stickerSvg(theme, idx)}<div>得到新貼紙<br><b>${esc(Themes.THEMES[theme].stickers[idx][1])}</b>${Themes.stars(theme, idx) ? `<br><span class="rstar">${"★".repeat(Themes.stars(theme, idx))}</span>` : ""}</div></div>`);
  }
  showReveals(got);
}
/* 一位一位顯示「得到貼紙」的大畫面，按「收進貼紙簿」換下一位 */
function showReveals(list){
  if(!list.length) return;
  const {code, theme, idx} = list[0], k = kidBy(code), name = k ? kidShow(k) : code;
  const t = Themes.THEMES[theme], stars = Themes.stars(theme, idx), g = (Themes.GACHA[theme] || [])[idx];
  const box = document.createElement("div"); box.className = "reveal";
  box.style.setProperty("--rc", stars ? Themes.RARE_GLOW[stars] : t.stickers[idx][0]);
  box.innerHTML = `<div class="rays2"></div><div class="box" role="dialog" aria-modal="true" aria-label="得到貼紙">
    <div class="who2">${Rewards.avatarHtml(code)}<b>${esc(name)}</b></div>
    ${Themes.stickerSvg(theme, idx)}${stars ? `<div class="stars">${"★".repeat(stars)}</div>` : ""}
    <div class="rname">${esc(t.stickers[idx][1])}</div>${g ? `<div class="rare">${esc(g.label)}</div>` : ""}
    <div style="font-size:20px">${esc(name)}${VERB(theme)}${esc(t.stickers[idx][1])}！</div>
    <button class="go" data-ok>收進貼紙簿</button></div>`;
  document.body.appendChild(box);
  box.querySelector("[data-ok]").focus();
  sfx.fanfare();
  /* 唸名字只用本機語音，沒有就只唸得到什麼（見 play.js 的 speak） */
  setTimeout(() => { if(!speak(`${name}${VERB(theme)}${t.stickers[idx][1]}！`, null, null, true)) speak(`${VERB(theme)}${t.stickers[idx][1]}！`); }, 600);
  box.querySelector("[data-ok]").onclick = () => { box.remove(); showReveals(list.slice(1)); };
}

/* =========================================================
   14. 貼紙簿（學生自己看：選名字 → 看四個主題收集了哪些）
   ========================================================= */
let bookKid = null;
function renderBook(){
  if(!kidBy(bookKid)) bookKid = null;
  $("#bookNames").innerHTML = kids.length ? kids.map(k => `<button class="chip kidchip ${bookKid === k.code ? "on" : ""}" data-k="${esc(k.code)}" aria-pressed="${bookKid === k.code}">${Rewards.avatarHtml(k.code)}${esc(kidShow(k))}</button>`).join("")
    : `<p class="note">還沒有學生，請老師先到「學生名單」加入。</p>`;
  $("#bookNames").querySelectorAll("[data-k]").forEach(b => b.onclick = () => { bookKid = b.dataset.k; renderBook(); });
  if(!bookKid){ $("#bookBody").innerHTML = kids.length ? `<p class="hint">點自己的名字，看看收集了哪些貼紙。</p>` : ""; return; }
  const st = Rewards.get(bookKid).stickers || {};
  $("#bookBody").innerHTML = Themes.ids.map(id => {
    const t = Themes.THEMES[id], cnt = {};
    (st[id] || []).forEach(i => { if(i < t.stickers.length) cnt[i] = (cnt[i] || 0) + 1; });
    const have = Object.keys(cnt).length;
    return `<section class="card booksec"><h2>${esc(t.name)}　<small>${have} / ${t.stickers.length}${Themes.GACHA[id] ? "（星星越多越稀有）" : ""}</small></h2>
      <div class="stkrow">${t.stickers.map((s, i) => cnt[i]
        ? `<div class="stk">${Themes.stickerSvg(id, i)}<div>${esc(s[1])}${cnt[i] > 1 ? ` ×${cnt[i]}` : ""}</div>${Themes.stars(id, i) ? `<span class="rstar">${"★".repeat(Themes.stars(id, i))}</span>` : ""}</div>`
        : `<div class="stk no"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="#b9dcc2" stroke-width="4" stroke-dasharray="8 8"/><text x="50" y="62" text-anchor="middle" font-size="36" fill="#b9dcc2">?</text></svg><div>還沒收集</div></div>`).join("")}</div></section>`;
  }).join("");
}
$("#openBook").onclick = () => { renderBook(); showScreen("#book"); };
$("#bookBack").onclick = () => showScreen("#setup");

/* 備份檔裡一起放收藏與頭像（備份檔第 2 版） */
addBackupPart("rewards", () => Rewards.exportAll(), list => Rewards.importAll(list));
