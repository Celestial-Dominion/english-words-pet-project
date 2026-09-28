#!/usr/bin/env python3
"""CMUdict (giọng Mỹ) → IPA General American cho lớp phát âm của học liệu (transcript Video, từ trọng tâm).

Vì sao: IPA trong bộ từ của app trộn nguồn (kaikki) nên nhiều từ cơ bản sai/không phải GA (does /doʊz/,
are /ɛəɹ/, where /ˈweː/, dog /dɒɡ/). CMUdict là từ điển phát âm Mỹ chuẩn (cùng hệ với giọng TTS en-US),
có cả dạng biến hình và rút gọn. Chỉ dùng lúc build; app không tải file này.

  scripts/.venv-tts/bin/python scripts/build-cmu-ipa.py   →  scripts/out/cmu-ipa.tsv  (từ \t ipa1 \t ipa2 …)

ARPAbet → IPA: AH0 ə · AH1/2 ʌ · ER0 ɚ · ER1/2 ɝ; trọng âm ˈ/ˌ đặt trước PHỤ ÂM ĐẦU của âm tiết (tách âm tiết
theo nguyên tắc phụ âm đầu dài nhất hợp lệ); từ một âm tiết không đánh trọng âm (như từ điển học tập).
"""
import os
import re

import cmudict

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out", "cmu-ipa.tsv")

V = {"AA": "ɑ", "AE": "æ", "AO": "ɔ", "AW": "aʊ", "AY": "aɪ", "EH": "ɛ", "EY": "eɪ", "IH": "ɪ", "IY": "i", "OW": "oʊ", "OY": "ɔɪ", "UH": "ʊ", "UW": "u"}
C = {"B": "b", "CH": "tʃ", "D": "d", "DH": "ð", "F": "f", "G": "ɡ", "HH": "h", "JH": "dʒ", "K": "k", "L": "l", "M": "m", "N": "n", "NG": "ŋ", "P": "p", "R": "ɹ", "S": "s", "SH": "ʃ", "T": "t", "TH": "θ", "V": "v", "W": "w", "Y": "j", "Z": "z", "ZH": "ʒ"}
# Phụ âm đầu âm tiết hợp lệ trong tiếng Anh (ARPAbet).
ONSETS = {tuple(x.split()) for x in """
P B T D K G F V TH DH S Z SH ZH HH CH JH M N L R W Y
P L|P R|P Y|B L|B R|B Y|T R|T W|D R|D W|K L|K R|K W|K Y|G L|G R|G W|F L|F R|F Y|TH R|TH W|SH R|V Y|M Y|HH Y|N Y
S P|S T|S K|S M|S N|S L|S W|S F|S P L|S P R|S T R|S K R|S K W|S K Y|S P Y
""".replace("\n", "|").split("|") if x.strip()}
ONSETS |= {(x,) for x in C}
ONSETS.discard(("NG",))


def vowel(p):
    base = re.sub(r"\d", "", p)
    s = p[-1] if p[-1].isdigit() else ""
    if base == "AH":
        return ("ə" if s == "0" else "ʌ"), s
    if base == "ER":
        return ("ɚ" if s == "0" else "ɝ"), s
    return V[base], s


def to_ipa(phones):
    nuclei = [i for i, p in enumerate(phones) if p[-1].isdigit()]
    if not nuclei:
        return "".join(C.get(p, "") for p in phones)
    # ranh giới âm tiết: trước phụ âm đầu dài nhất hợp lệ của mỗi âm tiết (từ âm tiết thứ 2)
    starts = [0]
    for a, b in zip(nuclei, nuclei[1:]):
        cons = phones[a + 1:b]
        k = len(cons)
        while k > 0 and tuple(cons[len(cons) - k:]) not in ONSETS:
            k -= 1
        starts.append(b - k)
    marks = {}
    if len(nuclei) > 1:
        for st, n in zip(starts, nuclei):
            s = phones[n][-1]
            if s in "12":
                marks[st] = "ˈ" if s == "1" else "ˌ"
    out = []
    for i, p in enumerate(phones):
        if i in marks:
            out.append(marks[i])
        out.append(vowel(p)[0] if p[-1].isdigit() else C[p])
    return "".join(out)


def main():
    d = cmudict.dict()
    n = 0
    with open(OUT, "w", encoding="utf-8") as fh:
        for w in sorted(d):
            if not re.fullmatch(r"[a-z][a-z'.-]*", w):
                continue
            ipas = []
            for pr in d[w]:
                x = to_ipa(pr)
                if x not in ipas:
                    ipas.append(x)
            fh.write(w + "\t" + "\t".join(ipas) + "\n")
            n += 1
    print(f"{n} từ → {os.path.relpath(OUT)}")


if __name__ == "__main__":
    main()
