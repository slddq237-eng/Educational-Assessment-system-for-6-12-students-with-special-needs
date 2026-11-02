/* =========================================================
   整理變更紀錄（docs/scripts/changelog.js，2026-10-24 加）
   用法：在 repo 最上層執行  node docs/scripts/changelog.js            （印出整張表）
                            node docs/scripts/changelog.js 平板        （只印有「平板」的列）
   做什麼：把舊的分段檔案（docs/changelog/changelog-年-月-日.md 的表格）、2026-10-24～2026-11-02 每個 PR 一個的小檔案（docs/changelog/changes/*.md）、
     和 2026-11-02 起沒有小檔案的 PR（直接從 git 的合併紀錄產生）合成一張依時間排的表。
     小檔案沒有寫 PR 編號（發 PR 前還不知道），這裡從 git 的合併紀錄找出是哪一個 PR；還沒合併的寫「（還沒合併）」。
   為什麼 2026-11-02 起不用再寫小檔：PR 標題和說明已經是紀錄，再寫一個小檔是重複工作（每個 PR 多一個檔案）；
     所以 PR 標題要用一句話寫清楚「改了什麼」，它就是這張表的「改了什麼」欄（docs/changelog/changelog.md「怎麼寫」）。
   為什麼之前改成一個 PR 一個小檔：以前大家都在同一個檔案最後加一列，兩個 PR 同時開就會衝突，
     而且要先發 PR 才知道編號、再推一次補上。
   ========================================================= */
const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const git = cmd => { try { return execSync(cmd, { cwd: root, encoding: 'utf8' }); } catch (e) { return ''; } };
const REPO = 'https://github.com/slddq237-eng/Educational-Assessment-system-for-6-12-students-with-special-needs/pull/';
const rows = [];

/* 1. 舊的分段檔案：表格裡日期開頭的列照抄 */
for (const f of fs.readdirSync(path.join(root, 'docs', 'changelog')).filter(f => /^changelog-\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort()) {
  for (const line of fs.readFileSync(path.join(root, 'docs', 'changelog', f), 'utf8').split('\n')) {
    const m = line.match(/^\| (\d{4}-\d{2}-\d{2}) \|/);
    if (m) rows.push({ date: m[1], line });
  }
}

/* 2. 每個 PR 一個的小檔案：讀出各欄，再從 git 找 PR 編號 */
const field = (s, k) => ((s.match(new RegExp(`^- ${k}：(.*)$`, 'm')) || [])[1] || '').trim();
/* --follow：檔案搬過資料夾（2026-10-24 docs/ 分資料夾）也找得到最早加進來的那次 */
function prOf(file){
  const added = git(`git log --follow --diff-filter=A --format=%H -- "${file}"`).trim().split('\n').pop();
  if (!added) return '';
  /* 加進這個檔案之後，第一個把它合併進來的「Merge pull request #N」 */
  const merges = git(`git log --merges --ancestry-path --format=%s ${added}..HEAD`).trim().split('\n').reverse();
  for (const s of merges) { const m = s.match(/^Merge pull request #(\d+)/); if (m) return m[1]; }
  return '';
}
const dir = path.join(root, 'docs', 'changelog', 'changes');
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}.*\.md$/.test(f)).sort()) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8'), rel = `docs/changelog/changes/${f}`;
  const date = field(s, '日期') || f.slice(0, 10), pr = prOf(rel);
  const what = field(s, '改了什麼') + (pr ? '' : '（**還沒合併**）');
  rows.push({ date, line: `| ${date} | ${pr ? `[#${pr}](${REPO}${pr})` : '—'} | ${field(s, '動到哪裡')} | ${what} | ${field(s, '想法或決定的變化').replace(/^—$/, '')} |` });
}

/* 2b. 沒有寫小檔案的 PR（2026-11-02 起不用再寫小檔）：從 git 的合併紀錄自己產生一列。
   「改了什麼」＝PR 標題（GitHub 的合併紀錄內文第一行；沒有就用合併紀錄的標題），「動到哪裡」由改到的檔案自動整理，
   日期是台灣時間的合併日期。前面（1、2）已經有這個 PR 編號的就不重複加。
   用 execFileSync（不經過命令列），Windows 也不會把 %cd% 這種寫法當成變數。 */
const gitArgs = args => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, TZ: 'Asia/Taipei' } }); } catch (e) { return ''; } };
const seen = new Set();
for (const r of rows) { const m = (r.line.split('|')[2] || '').match(/#(\d+)/); if (m) seen.add(m[1]); }
const AREAS = [
  [/^tools\/literacy\//, '識字評量'], [/^tools\/prep\//, '備課分析'], [/^shared\//, '共用教材與程式'], [/^docs\//, '文件'],
  [/^\.github\//, '自動檢查與審核設定'], [/^(index|about|privacy)\.html$|^(README|CLAUDE)\.md$|^favicon\.svg$/, '首頁與說明頁'],
];
const areasOf = hash => {
  const out = new Set();
  for (const f of gitArgs(['diff', '--name-only', `${hash}^1`, hash]).split('\n').filter(Boolean)) {
    const hit = AREAS.find(([re]) => re.test(f));
    out.add(hit ? hit[1] : '其他');
  }
  return [...out].join('、') || '其他';
};
for (const rec of gitArgs(['log', '--first-parent', '--date=format-local:%Y-%m-%d', '--format=%H%x01%cd%x01%s%x01%b%x02']).split('\x02')) {
  const [hash, date, subject, body = ''] = rec.replace(/^\n/, '').split('\x01');
  if (!hash) continue;
  const merge = subject.match(/^Merge pull request #(\d+)/), squash = subject.match(/\(#(\d+)\)\s*$/);
  const pr = (merge || squash || [])[1];
  if (!pr || seen.has(pr)) continue;
  const title = (merge ? body.trim().split('\n')[0] || subject : subject.replace(/\s*\(#\d+\)\s*$/, '')).replace(/\|/g, '／');
  rows.push({ date, line: `| ${date} | [#${pr}](${REPO}${pr}) | ${areasOf(hash)} | ${title} |  |` });
  seen.add(pr);
}

/* 3. 依日期排（同一天照原本的順序），可以只印有關鍵字的列 */
const key = process.argv[2];
rows.sort((a, b) => a.date.localeCompare(b.date));
console.log('| 日期 | PR | 動到哪裡 | 改了什麼 | 想法或決定的變化 |\n|---|---|---|---|---|');
for (const r of rows) if (!key || r.line.includes(key)) console.log(r.line);
