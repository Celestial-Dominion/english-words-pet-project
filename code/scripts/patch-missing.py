# Vá những từ bị rớt dữ liệu kaikki (tháng/thứ viết hoa, ca lẻ như "mouse" noun):
# tải per-word JSONL từ kaikki.org, trích cùng format filter-kaikki.py, APPEND vào
# out/kaikki-filtered.jsonl. Danh sách từ lấy từ stdin (mỗi dòng một từ).
# Chạy: node -e '...' | python3 scripts/patch-missing.py
import json
import os
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DST = os.path.join(HERE, "out", "kaikki-filtered.jsonl")

KEEP_POS = {"noun", "verb", "adj", "adv", "prep", "conj", "pron", "det", "num", "intj", "particle", "phrase", "prep_phrase", "name"}

def fetch(word):
    w = word.replace(" ", "_")
    urls = []
    for form in (w, w.capitalize(), w.upper() if len(w) <= 4 else w):
        path = f"{form[0]}/{form[:2]}/{form}.jsonl"
        url = f"https://kaikki.org/dictionary/English/meaning/{path}"
        if url not in urls:
            urls.append(url)
    for url in urls:
        try:
            with urllib.request.urlopen(url, timeout=15) as r:
                return r.read().decode("utf-8")
        except Exception:
            continue
    return None

words = [line.strip() for line in sys.stdin if line.strip()]
patched, failed = 0, []
with open(DST, "a", encoding="utf-8") as fout:
    for word in words:
        body = fetch(word)
        if not body:
            failed.append(word)
            continue
        wrote = False
        for line in body.splitlines():
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                continue
            if e.get("lang_code") != "en" or (e.get("pos") or "") not in KEEP_POS:
                continue
            senses = [{"g": (s.get("glosses") or s.get("raw_glosses") or [])[:2], "tags": (s.get("tags") or [])[:8]} for s in (e.get("senses") or [])[:6]]
            sounds = [{"ipa": s["ipa"], "tags": s.get("tags") or []} for s in (e.get("sounds") or [])[:12] if s.get("ipa")]
            forms = [{"f": f["form"], "tags": (f.get("tags") or [])[:6]} for f in (e.get("forms") or [])[:40] if f.get("form")]
            # ghi id THƯỜNG HOÁ về từ gốc trong bộ (April -> april) để stage1 khớp
            fout.write(json.dumps({"w": word, "pos": e["pos"], "senses": senses, "sounds": sounds, "forms": forms}, ensure_ascii=False) + "\n")
            wrote = True
        if wrote:
            patched += 1
        else:
            failed.append(word)
        time.sleep(0.15)  # lịch sự với kaikki.org

print(f"Vá được {patched}/{len(words)} từ; thất bại: {', '.join(failed[:20])}", file=sys.stderr)
