/* =========================================================
   示範動畫（demo.js）：搭配 demo.css。
   用法：頁面先定義 DEMOS（每個示範的步驟），再載入這個檔案。
   HTML 寫 <figure class="walk" data-demo="名稱">，裡面放 .screen（仿真畫面）、.cap（說明）、.ctl（暫停、重播）。
   每一步：t＝要點的地方（畫面裡 data-t 的名字），say＝下方說明，
   show＝點了之後出現哪一塊（data-later 的名字），keep＝點了不變色（例如「完成」「匯出」按鈕）。
   ========================================================= */
const WALK_CURSOR = '<svg viewBox="0 0 24 24"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.4-6.9L4 20z" fill="#fff" stroke="#1f3d36" stroke-width="1.6" stroke-linejoin="round"/></svg>';

document.querySelectorAll(".walk").forEach(demo => {
  const scr = demo.querySelector(".screen"), cap = demo.querySelector(".cap"), steps = DEMOS[demo.dataset.demo];
  const target = s => scr.querySelector(`[data-t="${s.t}"]`);

  /* 電腦設定減少動態效果：全部顯示，用數字標出點的順序 */
  if(matchMedia("(prefers-reduced-motion: reduce)").matches){
    demo.classList.add("static");
    scr.querySelectorAll(".later").forEach(e => e.classList.add("in"));
    steps.forEach((s, n) => target(s).insertAdjacentHTML("beforeend", `<span class="badge">${n + 1}</span>`));
    cap.textContent = "照紅色數字的順序點。";
    return;
  }

  const cur = document.createElement("div"); cur.className = "cur"; cur.innerHTML = WALK_CURSOR;
  const ring = document.createElement("div"); ring.className = "ring"; ring.hidden = true;
  scr.append(ring, cur);
  let i = 0, timer = null, playing = true, onScreen = false;
  const pauseBtn = demo.querySelector('[data-act="pause"]');

  /* 回到一開始的樣子 */
  function reset(){
    i = 0; ring.hidden = true;
    scr.querySelectorAll(".later").forEach(e => e.classList.remove("in"));
    scr.querySelectorAll(".on").forEach(e => e.classList.remove("on"));
    scr.querySelectorAll("[data-on]").forEach(e => e.classList.add("on"));
    cur.style.left = "92%"; cur.style.top = "92%";
  }
  /* 某個按鈕的中心點（相對於小畫面） */
  function center(el){
    const a = scr.getBoundingClientRect(), b = el.getBoundingClientRect();
    return [b.left - a.left + b.width / 2, b.top - a.top + b.height / 2];
  }
  /* 一步：紅圈先出現在要點的地方 → 游標移過去 → 點下去 → 停一下再做下一步 */
  function step(){
    if(i >= steps.length){ timer = setTimeout(() => { reset(); step(); }, 2500); return; }
    const s = steps[i], el = target(s), [x, y] = center(el);
    cap.innerHTML = `<b>${i + 1}</b>${s.say}`;
    ring.hidden = false; ring.style.left = x + "px"; ring.style.top = y + "px";
    cur.style.left = (x - 4) + "px"; cur.style.top = (y - 2) + "px";
    timer = setTimeout(() => {
      cur.classList.add("press"); setTimeout(() => cur.classList.remove("press"), 180);
      if(!s.keep){
        el.parentElement.querySelectorAll(".on").forEach(e => e.classList.remove("on"));
        el.classList.add("on");
      }
      if(s.show) scr.querySelector(`[data-later="${s.show}"]`).classList.add("in");
      i++;
      timer = setTimeout(step, 1700);
    }, 1100);
  }
  function stop(){ clearTimeout(timer); timer = null; }
  function run(){ if(playing && onScreen && !timer) step(); }

  pauseBtn.onclick = () => {
    playing = !playing; pauseBtn.textContent = playing ? "暫停" : "播放";
    if(playing) run(); else stop();
  };
  demo.querySelector('[data-act="replay"]').onclick = () => {
    stop(); reset(); playing = true; pauseBtn.textContent = "暫停"; run();
  };
  /* 只在捲到看得到的時候播放，省電腦資源 */
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if(onScreen) run(); else stop(); }).observe(demo);
  reset(); cap.innerHTML = `<b>1</b>${steps[0].say}`;
});
