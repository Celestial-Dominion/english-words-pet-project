#!/bin/sh
# Tải danh sách danh từ riêng tiếng Anh (kaikki pos=name) → out/proper-names.txt.
# Dùng để loại "john", "york", "china"… khỏi bước fill C1/C2 theo tần suất
# (chúng có nghĩa thường hiếm/lóng nhưng tần suất cao vì tên riêng viết hoa).
# Chạy 1 lần; file kết quả nhỏ (~vài MB) nên giữ lại, khỏi tải lại.
set -e
cd "$(dirname "$0")"
curl -s "https://kaikki.org/dictionary/English/pos-name/kaikki.org-dictionary-English-by-pos-name.jsonl" |
  python3 -c "
import json, sys
names = set()
for line in sys.stdin:
    try:
        e = json.loads(line)
    except ValueError:
        continue
    if e.get('lang_code') == 'en':
        names.add(e['word'].lower())
open('out/proper-names.txt', 'w').write('\n'.join(sorted(names)))
print(len(names), 'danh từ riêng -> out/proper-names.txt', file=sys.stderr)
"
