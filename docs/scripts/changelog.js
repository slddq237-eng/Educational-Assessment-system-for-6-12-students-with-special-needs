/* =========================================================
   整理變更紀錄（docs/scripts/changelog.js，2026-10-24 加）
   用法：在 repo 最上層執行  node docs/scripts/changelog.js            （印出整張表）
                            node docs/scripts/changelog.js 平板        （只印有「平板」的列）
   做什麼：把舊的分段檔案（docs/changelog-年-月-日.md 的表格）和 2026-10-24 起每個 PR 一個的小檔案（docs/changes/*.md）
     合成一張依時間排的表。小檔案沒有寫 PR 編號（發 PR 前還不知道），這裡從 git 的合併紀錄找出是哪一個 PR；
     還沒合併的寫「（還沒合併）」。
   為什麼改成一個 PR 一個小檔：以前大家都在同一個檔案最後加一列，兩個 PR 同時開就會衝突，
     而且要先發 PR 才知道編號、再推一次補上（docs/changelog.md「怎麼寫」）。
   ========================================================= */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const git = cmd => { try { return execSync(cmd, { cwd: root, encoding: 'utf8' }); } catch (e) { return ''; } };
const REPO = 'https://github.com/slddq237-eng/Educational-Assessment-system-for-6-12-students-with-special-needs/pull/';
const rows = [];

/* 1. 舊的分段檔案：表格裡日期開頭的列照抄 */
for (const f of fs.readdirSync(path.join(root, 'docs')).filter(f => /^changelog-\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort()) {
  for (const line of fs.readFileSync(path.join(root, 'docs', f), 'utf8').split('\n')) {
    const m = line.match(/^\| (\d{4}-\d{2}-\d{2}) \|/);
    if (m) rows.push({ date: m[1], line });
  }
}

/* 2. 每個 PR 一個的小檔案：讀出各欄，再從 git 找 PR 編號 */
const field = (s, k) => ((s.match(new RegExp(`^- ${k}：(.*)$`, 'm')) || [])[1] || '').trim();
function prOf(file){
  const added = git(`git log --diff-filter=A --format=%H -- "${file}"`).trim().split('\n').pop();
  if (!added) return '';
  /* 加進這個檔案之後，第一個把它合併進來的「Merge pull request #N」 */
  const merges = git(`git log --merges --ancestry-path --format=%s ${added}..HEAD`).trim().split('\n').reverse();
  for (const s of merges) { const m = s.match(/^Merge pull request #(\d+)/); if (m) return m[1]; }
  return '';
}
const dir = path.join(root, 'docs', 'changes');
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}.*\.md$/.test(f)).sort()) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8'), rel = `docs/changes/${f}`;
  const date = field(s, '日期') || f.slice(0, 10), pr = prOf(rel);
  const what = field(s, '改了什麼') + (pr ? '' : '（**還沒合併**）');
  rows.push({ date, line: `| ${date} | ${pr ? `[#${pr}](${REPO}${pr})` : '—'} | ${field(s, '動到哪裡')} | ${what} | ${field(s, '想法或決定的變化').replace(/^—$/, '')} |` });
}

/* 3. 依日期排（同一天照原本的順序），可以只印有關鍵字的列 */
const key = process.argv[2];
rows.sort((a, b) => a.date.localeCompare(b.date));
console.log('| 日期 | PR | 動到哪裡 | 改了什麼 | 想法或決定的變化 |\n|---|---|---|---|---|');
for (const r of rows) if (!key || r.line.includes(key)) console.log(r.line);
