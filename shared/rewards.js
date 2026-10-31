/* =========================================================
   平台共用：學生的收藏與頭像（shared/rewards.js）
   每位學生（以學生代號為準）一筆資料，存在這台電腦的瀏覽器（IndexedDB 資料庫 platform-rewards）：
     {code, avatar, stickers, log}
     avatar：{type:"animal", id:0~11} 卡通動物；或 {type:"photo", data:"data:image/jpeg;base64,..."} 老師上傳的照片（選填）
     stickers：{ocean:[貼紙代號…], space:[…], dino:[…], dessert:[…]}，代號例如 "ocean-03"（見 themes.js 的 codeOf），同一張可以重複
     log：每次得到貼紙的紀錄 {at, tool, session, theme, sticker}（sticker＝貼紙代號）
   2026-10-24 以前存的是「第幾張」的編號（數字），讀進來時自動換成代號。
   同一個網站上的工具都讀得到這份資料，所以之後的數學評量等工具也可以發貼紙。
   需要先載入 shared/themes.js。對外只提供 window.Rewards（見檔案最後）。
   ========================================================= */
(function(){

/* ---------- 1. 卡通動物頭像（12 種，用程式畫，放大也不會模糊） ---------- */
const K = "#2d2a26";
const eyes = (y, dx = 13, r = 5) => `<circle cx="${50-dx}" cy="${y}" r="${r}" fill="${K}"/><circle cx="${50+dx}" cy="${y}" r="${r}" fill="${K}"/>
  <circle cx="${50-dx+1.6}" cy="${y-1.8}" r="1.6" fill="#fff"/><circle cx="${50+dx+1.6}" cy="${y-1.8}" r="1.6" fill="#fff"/>`;
const blush = y => `<ellipse cx="29" cy="${y}" rx="6" ry="3.5" fill="#ff8fa8" opacity=".6"/><ellipse cx="71" cy="${y}" rx="6" ry="3.5" fill="#ff8fa8" opacity=".6"/>`;
const smile = (y, w = 7) => `<path d="M${50-w} ${y} Q50 ${y+w} ${50+w} ${y}" stroke="${K}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
const ANIMALS = [
  {name:"小貓", bg:"#ffe7c2", draw:() => `<path d="M24 40 L22 14 L42 28Z M76 40 L78 14 L58 28Z" fill="#f6a54a" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="50" cy="56" r="30" fill="#f6a54a" stroke="${K}" stroke-width="2.5"/>${eyes(52)}${blush(64)}
    <path d="M47 60 L53 60 L50 64Z" fill="#e2566b"/>${smile(66,5)}<path d="M18 60 L32 62 M18 68 L32 66 M82 60 L68 62 M82 68 L68 66" stroke="${K}" stroke-width="1.8" stroke-linecap="round"/>`},
  {name:"小狗", bg:"#e3f1ff", draw:() => `<circle cx="50" cy="54" r="30" fill="#d9a066" stroke="${K}" stroke-width="2.5"/>
    <path d="M24 34 Q10 40 16 66 Q26 64 30 46Z M76 34 Q90 40 84 66 Q74 64 70 46Z" fill="#8a5a33" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="50" cy="66" rx="14" ry="10" fill="#f3d9b5"/>${eyes(50)}<ellipse cx="50" cy="61" rx="5" ry="3.6" fill="${K}"/>${smile(67,5)}`},
  {name:"小兔", bg:"#fde3ef", draw:() => `<ellipse cx="38" cy="22" rx="7" ry="18" fill="#f7f4ee" stroke="${K}" stroke-width="2.5"/><ellipse cx="62" cy="22" rx="7" ry="18" fill="#f7f4ee" stroke="${K}" stroke-width="2.5"/>
    <ellipse cx="38" cy="24" rx="3" ry="11" fill="#ffb3c7"/><ellipse cx="62" cy="24" rx="3" ry="11" fill="#ffb3c7"/>
    <circle cx="50" cy="60" r="28" fill="#f7f4ee" stroke="${K}" stroke-width="2.5"/>${eyes(56,12,4.5)}${blush(66)}<path d="M47 64 L53 64 L50 67Z" fill="#e2566b"/>${smile(69,4)}`},
  {name:"小熊", bg:"#fff1cf", draw:() => `<circle cx="26" cy="30" r="10" fill="#9b6a43" stroke="${K}" stroke-width="2.5"/><circle cx="74" cy="30" r="10" fill="#9b6a43" stroke="${K}" stroke-width="2.5"/>
    <circle cx="50" cy="55" r="30" fill="#9b6a43" stroke="${K}" stroke-width="2.5"/><ellipse cx="50" cy="66" rx="14" ry="10" fill="#e6c49a"/>${eyes(50)}
    <ellipse cx="50" cy="61" rx="5" ry="3.6" fill="${K}"/>${smile(67,5)}`},
  {name:"熊貓", bg:"#e4f3ec", draw:() => `<circle cx="26" cy="30" r="10" fill="${K}"/><circle cx="74" cy="30" r="10" fill="${K}"/>
    <circle cx="50" cy="55" r="30" fill="#fff" stroke="${K}" stroke-width="2.5"/><ellipse cx="37" cy="52" rx="8" ry="10" fill="${K}" transform="rotate(-20 37 52)"/>
    <ellipse cx="63" cy="52" rx="8" ry="10" fill="${K}" transform="rotate(20 63 52)"/><circle cx="38" cy="51" r="2.6" fill="#fff"/><circle cx="62" cy="51" r="2.6" fill="#fff"/>
    <ellipse cx="50" cy="63" rx="4.5" ry="3.2" fill="${K}"/>${smile(67,5)}${blush(66)}`},
  {name:"企鵝", bg:"#dff3ff", draw:() => `<circle cx="50" cy="52" r="32" fill="#2f3e5c" stroke="${K}" stroke-width="2.5"/>
    <path d="M50 34 Q30 34 28 56 Q30 80 50 80 Q70 80 72 56 Q70 34 50 34Z" fill="#fff"/>${eyes(52,10,4.5)}
    <path d="M43 60 L57 60 L50 68Z" fill="#ffa62b" stroke="${K}" stroke-width="2" stroke-linejoin="round"/>${blush(64)}`},
  {name:"青蛙", bg:"#eaf7d7", draw:() => `<ellipse cx="50" cy="60" rx="34" ry="26" fill="#6cc66a" stroke="${K}" stroke-width="2.5"/>
    <circle cx="33" cy="36" r="12" fill="#6cc66a" stroke="${K}" stroke-width="2.5"/><circle cx="67" cy="36" r="12" fill="#6cc66a" stroke="${K}" stroke-width="2.5"/>
    <circle cx="33" cy="36" r="7" fill="#fff"/><circle cx="67" cy="36" r="7" fill="#fff"/><circle cx="34" cy="37" r="4" fill="${K}"/><circle cx="68" cy="37" r="4" fill="${K}"/>
    <path d="M30 62 Q50 78 70 62" stroke="${K}" stroke-width="2.8" fill="none" stroke-linecap="round"/>${blush(62)}`},
  {name:"狐狸", bg:"#fff0de", draw:() => `<path d="M22 44 L20 12 L44 30Z M78 44 L80 12 L56 30Z" fill="#f08a3c" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M18 46 Q22 26 50 26 Q78 26 82 46 Q78 72 50 86 Q22 72 18 46Z" fill="#f08a3c" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M22 50 Q36 54 50 72 Q64 54 78 50 Q74 72 50 86 Q26 72 22 50Z" fill="#fff6ea"/>${eyes(48,13,4.5)}<ellipse cx="50" cy="72" rx="4.5" ry="3.4" fill="${K}"/>`},
  {name:"貓頭鷹", bg:"#efe6ff", draw:() => `<path d="M24 34 L22 16 L38 28Z M76 34 L78 16 L62 28Z" fill="#8a6748" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="50" cy="55" r="31" fill="#8a6748" stroke="${K}" stroke-width="2.5"/><circle cx="36" cy="50" r="12" fill="#fff" stroke="${K}" stroke-width="2"/>
    <circle cx="64" cy="50" r="12" fill="#fff" stroke="${K}" stroke-width="2"/><circle cx="36" cy="51" r="5.5" fill="${K}"/><circle cx="64" cy="51" r="5.5" fill="${K}"/>
    <path d="M45 62 L55 62 L50 70Z" fill="#ffb13d" stroke="${K}" stroke-width="2" stroke-linejoin="round"/><ellipse cx="50" cy="80" rx="14" ry="5" fill="#d8c3a5"/>`},
  {name:"小雞", bg:"#fff8d6", draw:() => `<path d="M46 22 Q48 12 52 20 Q56 12 56 24" stroke="${K}" stroke-width="2.4" fill="#ffd23f" stroke-linejoin="round"/>
    <circle cx="50" cy="56" r="30" fill="#ffd23f" stroke="${K}" stroke-width="2.5"/>${eyes(52,12,4.5)}
    <path d="M42 60 L58 60 L50 68Z" fill="#ff8a3d" stroke="${K}" stroke-width="2" stroke-linejoin="round"/>${blush(64)}`},
  {name:"小豬", bg:"#ffe4ea", draw:() => `<path d="M24 38 L22 18 L40 30Z M76 38 L78 18 L60 30Z" fill="#f7a3b5" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="50" cy="55" r="30" fill="#f7a3b5" stroke="${K}" stroke-width="2.5"/>${eyes(48,13,4.5)}
    <ellipse cx="50" cy="63" rx="12" ry="8.5" fill="#f58aa1" stroke="${K}" stroke-width="2"/><ellipse cx="46" cy="63" rx="2" ry="3" fill="${K}"/><ellipse cx="54" cy="63" rx="2" ry="3" fill="${K}"/>`},
  {name:"小恐龍", bg:"#e2f6e9", draw:() => `<path d="M30 30 L36 16 L42 28 L48 12 L54 26 L62 14 L66 30Z" fill="#ffb13d" stroke="${K}" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="50" cy="56" r="30" fill="#4fbf8b" stroke="${K}" stroke-width="2.5"/><ellipse cx="50" cy="68" rx="18" ry="10" fill="#c9f0d6"/>${eyes(50)}
    <circle cx="44" cy="66" r="1.6" fill="${K}"/><circle cx="56" cy="66" r="1.6" fill="${K}"/>${smile(70,7)}`}
];
const animalSvg = id => { const a = ANIMALS[id] || ANIMALS[0]; return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="${a.bg}"/>${a.draw()}</svg>`; };

/* ---------- 2. 存在這台電腦的資料 ---------- */
const DB = "platform-rewards", STORE = "kids";
let db = null;
const mem = {};          /* 學生代號 → 資料；打開網頁時全部讀進來 */
function openDb(){
  return new Promise(res => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, {keyPath:"code"});
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    } catch(e){ res(null); }
  });
}
const ready = (async () => {
  db = await openDb(); if(!db) return;
  await new Promise(res => {
    try {
      const q = db.transaction(STORE).objectStore(STORE).getAll();
      q.onsuccess = () => { (q.result || []).forEach(x => mem[x.code] = toCodes(x)); res(); }; q.onerror = () => res();
    } catch(e){ res(); }
  });
})();
function put(x){ mem[x.code] = x; if(!db) return; try { db.transaction(STORE, "readwrite").objectStore(STORE).put(x); } catch(e){} }
function del(code){ delete mem[code]; if(!db) return; try { db.transaction(STORE, "readwrite").objectStore(STORE).delete(code); } catch(e){} }
/* 依代號算出固定的預設動物，沒選過頭像的學生也有卡通角色 */
const defaultAnimal = code => { let h = 0; for(const c of String(code)) h = (h * 31 + c.codePointAt(0)) % 9973; return h % ANIMALS.length; };
const get = code => mem[code] || {code, avatar:{type:"animal", id:defaultAnimal(code)}, stickers:{}, log:[]};
const copy = o => JSON.parse(JSON.stringify(o));
/* 舊資料的貼紙是編號（數字）：換成代號；找不到的編號丟掉 */
function toCodes(x){
  for(const [t, arr] of Object.entries(x.stickers || {}))
    x.stickers[t] = (arr || []).map(v => typeof v === "number" ? Themes.codeOf(t, v) : v).filter(Boolean);
  return x;
}

/* ---------- 3. 頭像 ---------- */
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
function avatarHtml(code){
  const a = get(code).avatar || {};
  if(a.type === "photo" && PHOTO_RE.test(a.data || "")) return `<span class="av"><img src="${a.data}" alt=""></span>`;
  return `<span class="av">${animalSvg(a.type === "animal" ? a.id : defaultAnimal(code))}</span>`;
}
function setAvatar(code, avatar){ const x = copy(get(code)); x.avatar = avatar; put(x); }
/* 照片縮成 200×200 的正方形 JPEG（約 15～25KB），只存在這台電腦 */
async function photoFromFile(file){
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const S = 200, c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d");
    const w = img.naturalWidth, h = img.naturalHeight, m = Math.min(w, h);
    x.fillStyle = "#fff"; x.fillRect(0, 0, S, S);
    x.drawImage(img, (w - m) / 2, (h - m) * 0.3, m, m, 0, 0, S, S);
    return c.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}

/* ---------- 4. 貼紙 ---------- */
/* 這位學生在這個主題已有的貼紙，換成「第幾張」的編號（抽貼紙、貼紙簿用） */
const owned = (code, theme) => (get(code).stickers[theme] || []).map(c => { const f = Themes.findCode(c); return f && f.theme === theme ? f.idx : -1; }).filter(i => i >= 0);
/* 把一張貼紙存進收藏；回傳貼紙編號。info：{tool, session} 記在 log 裡；
   info.idx（第幾張）或 info.sticker（代號）有給時直接用這一張（例如打怪獸開始前就決定好的、平板上抽到的），沒給才在這裡抽 */
function award(code, theme, info){
  info = info || {};
  const x = copy(get(code)), n = Themes.THEMES[theme].stickers.length, f = info.sticker ? Themes.findCode(info.sticker) : null;
  const idx = f && f.theme === theme ? f.idx : Number.isInteger(info.idx) && info.idx >= 0 && info.idx < n ? info.idx : Themes.drawSticker(theme);
  const sticker = Themes.codeOf(theme, idx);
  (x.stickers[theme] ||= []).push(sticker);
  (x.log ||= []).push({at:new Date().toISOString(), tool:info.tool || "", session:info.session || "", theme, sticker});
  put(x);
  return idx;
}
/* 這位學生在這次作答（session）已經拿過貼紙了嗎（匯入平板紀錄時避免重複發） */
const hasSession = (code, session) => !!session && (get(code).log || []).some(l => l.session === session);

/* ---------- 5. 備份、還原、改代號 ---------- */
const exportAll = () => copy(Object.values(mem));
/* 還原：合併而不是覆蓋。貼紙取較多的那份，頭像以這台電腦已有的為準，紀錄去除重複 */
function importAll(list){
  let n = 0;
  for(const y of list || []){
    if(!y || !y.code) continue;
    toCodes(y);
    const x = mem[y.code] ? copy(mem[y.code]) : {code:y.code, stickers:{}, log:[]};
    if(!mem[y.code] && y.avatar) x.avatar = y.avatar;
    /* 重置貼紙之後（resetAll）：比這台電腦的重置更舊的備份，貼紙和記錄不合併（不然重置會被舊備份還原）；
       備份是重置之後才做的，這台電腦現有的貼紙就是重置前的，先清掉再合併 */
    const mine = x.resetAt || "", theirs = y.resetAt || "";
    if(theirs > mine){ x.stickers = {}; x.log = []; x.resetAt = theirs; }
    if(theirs >= mine){
      for(const [t, arr] of Object.entries(y.stickers || {})) if((arr || []).length > (x.stickers[t] || []).length) x.stickers[t] = [...arr];
      const key = l => l.at + l.theme + (l.sticker ?? l.idx);
      const seen = new Set((x.log || []).map(key));
      for(const l of y.log || []) if(!seen.has(key(l))) (x.log ||= []).push(l);
    }
    put(x); n++;
  }
  return n;
}
/* 重置全部貼紙（老師專用，2026-10-31）：每位學生的貼紙和領取記錄清空，頭像保留，並記下重置時間 resetAt。
   codes＝學生名單裡的代號（還沒有收藏資料的學生也要記重置時間）；救不回來 */
function resetAll(codes){
  const at = new Date().toISOString();
  for(const code of new Set([...Object.keys(mem), ...(codes || [])])){
    const x = copy(get(code)); x.stickers = {}; x.log = []; x.resetAt = at; put(x);
  }
  return at;
}
/* 這個時間（作答紀錄的 at）在這位學生重置貼紙之後嗎：重置前的舊平板紀錄匯入時不再補發貼紙 */
const afterReset = (code, at) => { const t = (mem[code] || {}).resetAt; return !t || !at || at > t; };
/* 老師在學生名單改了代號：收藏跟著搬過去 */
function rename(oldCode, newCode){
  if(!mem[oldCode] || mem[newCode]) return;
  const x = copy(mem[oldCode]); x.code = newCode; put(x); del(oldCode);
}

window.Rewards = {
  ready, ANIMALS, animalSvg, avatarHtml, setAvatar, photoFromFile,
  get: code => copy(get(code)), owned, award, hasSession, exportAll, importAll, rename,
  resetAll, afterReset,
  remove: code => del(code),   /* 老師刪除一位學生（識字評量，2026-10-31）：貼紙收藏、頭像、領取記錄全部刪掉，救不回來 */
  saved: () => !!db
};
})();
