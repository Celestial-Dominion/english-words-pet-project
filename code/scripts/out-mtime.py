#!/usr/bin/env python3
# Sau `npm run build`: đặt lại thời điểm sửa (mtime) của file trong out/ chép từ public/ về đúng như bản gốc.
# Next chép public/ → out/ với mtime mới, mà bộ nhớ đệm băm của firebase-tools (.firebase/hosting.*.cache)
# khoá theo mtime → mỗi lần deploy phải băm lại ~3 GB audio. Giữ mtime gốc thì chỉ file thật sự đổi mới phải băm.
#   python3 scripts/out-mtime.py
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PUB, OUT = os.path.join(ROOT, "public"), os.path.join(ROOT, "out")
if not os.path.isdir(OUT):
    sys.exit("không có out/ — chạy npm run build trước")

done = skip = 0
for d, _, files in os.walk(PUB):
    rel = os.path.relpath(d, PUB)
    for f in files:
        src, dst = os.path.join(d, f), os.path.join(OUT, rel, f)
        try:
            s, o = os.stat(src), os.stat(dst)
        except FileNotFoundError:
            continue
        if s.st_size != o.st_size:  # out/ có bản khác (vd trang sinh ra trùng tên) → để nguyên
            skip += 1
            continue
        if int(o.st_mtime) != int(s.st_mtime):
            os.utime(dst, ns=(s.st_atime_ns, s.st_mtime_ns))
            done += 1
print(f"out-mtime: giữ mtime gốc cho {done} file (lệch cỡ {skip})")
