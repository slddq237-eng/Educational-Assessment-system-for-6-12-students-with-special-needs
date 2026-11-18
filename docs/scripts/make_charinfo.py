"""
產生 shared/char-info.js（docs/scripts/make_charinfo.py，2026-11-18 加）：課本「寫字生字」的筆劃數和部首，練習簿「看」下面的欄位用。

來源：教育部《重編國語辭典修訂本》，用 g0v 整理的 json（https://github.com/g0v/moedict-data 的 dict-revised.json.xz，解壓縮後約 75 MB）。
  授權：創用 CC 姓名標示－禁止改作 臺灣 3.0 版（辭典本文著作權屬教育部；教育部解釋：限制的是文字資料本身，不限制格式轉換與後續應用）。
  我們只取每個字的「筆劃數」和「部首」兩個欄位，內容原樣不改；頁面要標出處（見 docs/materials/data-sources.md）。
用法：python3 docs/scripts/make_charinfo.py dict-revised.json
  課本新增生字後再跑一次。只收課本各冊 `"write"` 欄的字（約 2,100 字），檔案約 20 KB。
手動補充（辭典裡沒有單字條目的字，筆劃數、部首用 Unicode Unihan 對照，並和部件筆劃數相加確認）：鷸＝23 劃、鳥部（矞 12＋鳥 11）。
格式：CHAR_INFO["晴"] = "12日"（前面是筆劃數，後面是部首）。
"""
import glob, json, re, sys

MANUAL = {"鷸": (23, "鳥")}
d = json.load(open(sys.argv[1], encoding="utf-8"))
m = {}
for e in d:
    t = e["title"]
    if len(t) == 1 and t not in m:
        m[t] = (e["stroke_count"], e["radical"].strip())
m.update(MANUAL)
chars = []
for f in sorted(glob.glob("shared/lessons*.js")):
    for x in re.findall(r'"write":"([^"]*)"', open(f, encoding="utf-8").read()):
        for c in x:
            if "㐀" <= c <= "鿿" and c not in chars:
                chars.append(c)
miss = [c for c in chars if c not in m]
if miss:
    print("缺少：", "".join(miss))
out = {c: f"{m[c][0]}{m[c][1]}" for c in chars if c in m}
js = ("/* =========================================================\n"
      "   課本寫字生字的筆劃數和部首（自動產生，不要手改；重新產生：python3 docs/scripts/make_charinfo.py dict-revised.json）\n"
      "   來源：教育部《重編國語辭典修訂本》（創用 CC 姓名標示－禁止改作 臺灣 3.0 版），每個字只取筆劃數、部首，原樣不改；鷸是手動補充（見 make_charinfo.py）。\n"
      "   格式：字 → \"筆劃數部首\"，例如 \"12日\"。出處與授權見 docs/materials/data-sources.md。\n"
      "   ========================================================= */\n"
      "const CHAR_INFO = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
open("shared/char-info.js", "w", encoding="utf-8").write(js)
print(len(out), "字", len(js.encode()) // 1024, "KB")
