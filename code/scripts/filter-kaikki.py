# Lọc kaikki-en.jsonl.gz (Wiktextract tiếng Anh, ~500MB gz) xuống chỉ những entry cần:
#  - từ đơn nằm trong tập ứng viên (CEFR headwords + top tần suất wordfreq)
#  - phrasal verb 2 token: "verb + particle" có tần suất đủ cao
# Giữ field tối thiểu: word, pos, senses(glosses/tags), sounds(ipa/tags), forms(form/tags).
# Chạy: python3 scripts/filter-kaikki.py  ->  scripts/out/kaikki-filtered.jsonl
import csv
import gzip
import json
import os
import re
import sys

from wordfreq import zipf_frequency

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

# ---- tập ứng viên từ đơn ----
candidates = set()
for fname in ("cefrj-a1b2.csv", "octanove-c1c2.csv"):
    with open(os.path.join(HERE, fname), newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            for variant in (row.get("headword") or "").split("/"):
                v = variant.strip().lower()
                if v:
                    candidates.add(v)

ALPHA = re.compile(r"^[a-z][a-z'-]*$")
with open(os.path.join(OUT, "wordfreq-en.tsv"), encoding="utf-8") as f:
    rows = [line.rstrip("\n").split("\t") for line in f]
freq_sorted = sorted(((w, float(z)) for w, z in rows), key=lambda x: -x[1])
top_single = [w for w, _ in freq_sorted if ALPHA.match(w)][:30000]
candidates.update(top_single)

PARTICLES = {
    "up", "down", "out", "off", "on", "in", "over", "away", "back", "through",
    "along", "around", "across", "by", "forward", "after", "into", "with", "to",
    "about", "ahead", "apart", "aside", "behind", "together",
}
TWO_TOKEN = re.compile(r"^[a-z][a-z'-]* [a-z]+$")

KEEP_POS = {
    "noun", "verb", "adj", "adv", "prep", "conj", "pron", "det", "num", "intj",
    "particle", "phrase", "prep_phrase",
}

kept = 0
scanned = 0
pv_seen = set()
WORD_RE = re.compile(r'"word":\s*"([^"]+)"')
dst = os.path.join(OUT, "kaikki-filtered.jsonl")
# --stdin: đọc gzip từ stdin (stream thẳng từ curl, khỏi ghi file 2.8GB ra đĩa)
if "--stdin" in sys.argv:
    fin_ctx = gzip.open(sys.stdin.buffer, "rt", encoding="utf-8")
else:
    fin_ctx = gzip.open(os.path.join(HERE, "kaikki-en.jsonl.gz"), "rt", encoding="utf-8")
with fin_ctx as fin, open(dst, "w", encoding="utf-8") as fout:
    for line in fin:
        scanned += 1
        if scanned % 500000 == 0:
            print(f"  ... quét {scanned} dòng, giữ {kept}", file=sys.stderr)
        # pre-filter rẻ: lấy word bằng regex, loại sớm 95%+ dòng không cần parse JSON
        m = WORD_RE.search(line, 0, 300)
        if m:
            quick = m.group(1).lower()
            if quick not in candidates and not (" " in quick and TWO_TOKEN.match(quick)):
                continue
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if e.get("lang_code") != "en":
            continue
        w = e.get("word") or ""
        wl = w.lower()
        pos = e.get("pos") or ""
        if pos not in KEEP_POS:
            continue

        keep = False
        if wl in candidates and w == wl:  # từ đơn, bỏ dạng viết hoa (danh từ riêng)
            keep = True
        elif pos == "verb" and TWO_TOKEN.match(wl) and w == wl:
            head, tail = wl.split(" ")
            if tail in PARTICLES:
                if wl not in pv_seen:
                    pv_seen.add(wl)
                if zipf_frequency(wl, "en") >= 3.2:
                    keep = True
        if not keep:
            continue

        senses = []
        for s in (e.get("senses") or [])[:6]:
            glosses = s.get("glosses") or s.get("raw_glosses") or []
            senses.append({"g": glosses[:2], "tags": (s.get("tags") or [])[:8]})
        sounds = []
        for snd in (e.get("sounds") or [])[:12]:
            if snd.get("ipa"):
                sounds.append({"ipa": snd["ipa"], "tags": snd.get("tags") or []})
        forms = []
        for fm in (e.get("forms") or [])[:40]:
            if fm.get("form"):
                forms.append({"f": fm["form"], "tags": (fm.get("tags") or [])[:6]})
        fout.write(json.dumps({"w": w, "pos": pos, "senses": senses, "sounds": sounds, "forms": forms}, ensure_ascii=False) + "\n")
        kept += 1

print(f"OK: quét {scanned} dòng, giữ {kept} entry -> scripts/out/kaikki-filtered.jsonl", file=sys.stderr)
