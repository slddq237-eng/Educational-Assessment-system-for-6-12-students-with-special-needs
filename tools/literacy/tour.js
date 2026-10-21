/* =========================================================
   識字評量：新手導覽（tour.js）
   這台電腦第一次打開時，自動一步一步介紹設定畫面：畫面變暗，只亮出要看的地方，
   紅框標出位置，旁邊一張小卡說明。看完或按「略過」就不再自動出現；
   右上角「選單」裡的「新手導覽」可以隨時重看。
   設定畫面分四步（一次只看一步），導覽每一步的 step 是要先切到第幾步，看完再回到老師原本停的那一步。
   ========================================================= */
const TOUR_STEPS = [
  {say:"第一次使用嗎？花 30 秒認識這個畫面。隨時可以按「略過」，之後從右上角「選單」裡的「新手導覽」重看。"},
  {t:"#topMenu", say:"老師專區、學生名單、作答紀錄、使用說明都收在右上角的「選單」。第一次用，先到「學生名單」填代號、名字、年級（名字只存在這台電腦）。"},
  {t:"#wTabs", step:1, say:"設定分四步，一次只看一步：選評量目標 → 選評量方式和學生 → 選課次 → 選主題和玩法。"},
  {t:'[aria-labelledby="h1"]', step:1, say:"第 1 步：選今天要評量的目標，選好按「下一步」。"},
  {t:'[aria-labelledby="hq"]', step:2, say:"第 2 步：選一張卡片，其他設定會自動填好。學扶、資源班老師選「學扶前後測」。想自己調整，點上面的「進階設定」。"},
  {t:'[aria-labelledby="h4"]', step:2, say:"點要做的學生，最多 4 位輪流作答。"},
  {t:'[aria-labelledby="h5"]', step:3, say:"第 3 步：選版本、年級和課次，可以選好幾課。"},
  {t:'[aria-labelledby="h7"]', step:4, say:"第 4 步：選玩法（一般模式、打怪獸、生字賓果），練習還可以設定血量、注音、報讀。最後請學生點一個主題。"},
  {t:"#go", step:4, say:"確認摘要，按「開始」就開始作答。"},
  {t:"#topMenu", say:"做完的成績、進步圖表在「選單」的「老師專區」。紀錄只存在這台電腦的瀏覽器，每週到「作答紀錄」下載備份檔。忘記怎麼用，看「使用說明」。"}
];
let tourAt = -1, tourBox = null, tourCard = null, tourFrom = 1;   /* tourFrom：開始導覽前停在第幾步 */

/* 這一步要亮出來的東西（看不到的就跳過，例如進階設定時沒有卡片區） */
const tourTarget = s => { const el = s.t && $(s.t); return el && el.getClientRects().length ? el : null; };

function startTour(){
  if(!$("#setup") || $("#setup").hidden) return;
  closeSheets();
  if(!tourBox){
    tourBox = document.createElement("div"); tourBox.className = "tourbox";
    tourCard = document.createElement("div"); tourCard.className = "tourcard";
    tourCard.setAttribute("role", "dialog"); tourCard.setAttribute("aria-modal", "true"); tourCard.setAttribute("aria-label", "新手導覽");
    document.body.append(tourBox, tourCard);
    window.addEventListener("resize", placeTour);
    window.addEventListener("scroll", placeTour, {passive:true});
  }
  tourBox.hidden = tourCard.hidden = false;
  tourFrom = wstep; $("#topMenu").open = false;
  showTour(0);
}
function endTour(){
  if(tourAt < 0) return;
  tourAt = -1; tourBox.hidden = tourCard.hidden = true;
  store("literacy-tour", "done");
  showStep(tourFrom);
  $("#topMenu summary").focus();
}
/* 換到第 n 步：跳過看不到的；捲到看得到的地方再畫 */
function showTour(n, dir = 1){
  const goStep = s => { if(s.step) showStep(s.step); return s; };
  while(n > 0 && n < TOUR_STEPS.length && TOUR_STEPS[n].t && !tourTarget(goStep(TOUR_STEPS[n]))) n += dir;
  if(n < 0) n = 0;
  if(n >= TOUR_STEPS.length){ endTour(); return; }
  tourAt = n;
  const s = goStep(TOUR_STEPS[n]), last = n === TOUR_STEPS.length - 1;
  tourCard.innerHTML = `<p class="tstep">新手導覽　${n + 1} / ${TOUR_STEPS.length}</p><p>${s.say}</p>
    <div class="row"><button class="ghost" data-tour="skip">${last ? "關閉" : "略過"}</button>
      ${n ? `<button class="ghost" data-tour="prev">上一步</button>` : ""}
      <button class="save" data-tour="next">${n ? (last ? "完成" : "下一步") : "開始導覽"}</button></div>`;
  tourCard.querySelector('[data-tour="skip"]').onclick = endTour;
  tourCard.querySelector('[data-tour="next"]').onclick = () => showTour(n + 1, 1);
  if(n) tourCard.querySelector('[data-tour="prev"]').onclick = () => showTour(n - 1, -1);
  const el = tourTarget(s);
  /* 比畫面一半還高的區塊（例如選課次）捲到它的開頭，先看到最上面的選項 */
  if(el) el.scrollIntoView({block: el.offsetHeight > innerHeight * 0.55 ? "start" : "center", behavior:"instant"});
  placeTour();
  tourCard.querySelector('[data-tour="next"]').focus();
}
/* 把亮框放在要看的東西上，小卡放在它下面（放不下就放上面，再不行就貼在畫面底部） */
function placeTour(){
  if(tourAt < 0) return;
  const el = tourTarget(TOUR_STEPS[tourAt]), vw = innerWidth, vh = innerHeight;
  const w = Math.min(380, vw - 32); tourCard.style.width = w + "px";
  const h = tourCard.offsetHeight;
  if(!el){
    Object.assign(tourBox.style, {left: vw / 2 + "px", top: vh / 2 + "px", width: "0px", height: "0px"});
    tourBox.classList.add("none");
    Object.assign(tourCard.style, {left: (vw - w) / 2 + "px", top: Math.max(16, (vh - h) / 2) + "px"});
    return;
  }
  tourBox.classList.remove("none");
  const r = el.getBoundingClientRect(), pad = 6;
  Object.assign(tourBox.style, {left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px"});
  let top = r.bottom + pad + 12;
  if(top + h > vh - 8) top = r.top - pad - 12 - h;
  if(top < 8) top = vh - h - 16;
  const left = Math.min(Math.max(16, r.left), vw - w - 16);
  Object.assign(tourCard.style, {left: left + "px", top: top + "px"});
}
document.addEventListener("keydown", e => { if(tourAt >= 0 && e.key === "Escape") endTour(); });
$("#tourBtn").onclick = startTour;

/* 這台電腦第一次打開：自動開始 */
if(load("literacy-tour", "") !== "done") startTour();
