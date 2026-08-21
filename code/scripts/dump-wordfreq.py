# Xuất tần suất wordfreq (Zipf) cho pipeline node: top N từ tiếng Anh + mọi headword CEFR.
# Chạy: python3 scripts/dump-wordfreq.py  ->  scripts/out/wordfreq-en.tsv (word \t zipf)
import csv
import os
import sys

from wordfreq import top_n_list, zipf_frequency

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

words = set(top_n_list("en", 60000))

# Thêm mọi headword từ CEFR-J + Octanove (kể cả đa từ) để từ nào cũng có điểm zipf.
for fname in ("cefrj-a1b2.csv", "octanove-c1c2.csv"):
    path = os.path.join(HERE, fname)
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            head = (row.get("headword") or "").strip()
            for variant in head.split("/"):
                v = variant.strip().lower()
                if v:
                    words.add(v)

with open(os.path.join(OUT, "wordfreq-en.tsv"), "w", encoding="utf-8") as f:
    for w in sorted(words):
        f.write(f"{w}\t{zipf_frequency(w, 'en'):.3f}\n")

print(f"OK: {len(words)} từ -> scripts/out/wordfreq-en.tsv", file=sys.stderr)
