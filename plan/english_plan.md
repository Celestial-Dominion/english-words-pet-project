# Kế hoạch xây dựng web học từ vựng tiếng Anh B1 → C2 (dựa trên app HSK + app Pháp)

> Tạo một web **riêng** học từ vựng tiếng Anh, tái dùng tối đa kiến trúc + code của 2 app đã chạy ổn:
> **HSK** (`chinese_hsk_words/code`) và **French** (`french_words/code`).
> Người học: **người Việt đã có nền tiếng Anh cơ bản (A1–A2 vững)** → lộ trình đi thẳng từ
> **B1 (trung cấp) đến C2 (thành thạo)**, KHÔNG dạy lại vỡ lòng.
> Nghĩa chính bằng **tiếng Việt**, kèm nghĩa/định nghĩa tiếng Anh (định nghĩa đơn ngữ có giá trị riêng ở B2+).
> **Phạm vi bản đầu (đã chốt 08/08):** học **từ + câu ví dụ + bài đọc/truyện** là chủ yếu.
> Các khoá phụ (phát âm, ngữ pháp) và dạng câu hỏi mới **để sau production** — xem mục 5.

---

## 0. Kết luận nghiên cứu 2 app hiện có

**Code nền để copy là `french_words/code`** — KHÔNG phải app HSK. Lý do: sau 2 đợt san bằng
(13/07 + 16/07/2026, xem `french_words/plan/report.md`), app Pháp đã có **đầy đủ máy trạng thái phiên học
của HSK** (learn-card trước MCQ, recall-first, requeue khi sai, chấm theo tốc độ, undo, nghỉ giữa chặng,
cloze, nghe→chọn nghĩa, hướng hỏi ngược, tổng kết gamify, gợi ý bài đọc) **cộng thêm** những thứ HSK
không có mà tiếng Anh cần y hệt tiếng Pháp:

| Thứ app Pháp có sẵn | Vì sao tiếng Anh dùng lại được nguyên xi |
|---|---|
| Hệ cấp **CEFR A1–C2** (`lib/levels.ts`, 6 cấp) | Tiếng Anh cũng chia theo CEFR — chỉ đổi cấu hình cấp (mục 1.2) |
| **IPA + audio MP3 thật** thay pinyin | Giữ nguyên pattern; đổi giọng edge-tts sang tiếng Anh |
| `lib/slug.ts` (ASCII hoá tên file audio) | Tiếng Anh gần như toàn ASCII nhưng vẫn giữ (dấu nháy trong id đa từ: *don't*) |
| `lemma-map.json` (dạng biến hình → lemma) | Tiếng Anh cũng biến hình: *went→go*, *studies→study*, *better→good* |
| Examples **shard 8 mảnh/cấp** + `loadExamplesForWords` | Giữ nguyên — đã giải bài toán màn ôn nạp file lớn |
| Sync Firestore "1 doc + chunks" (fingerprint skip), dynamic-import Firebase, render lạc quan | Giữ mô hình (nhanh nhất trong 2 app) **NHƯNG còn 6 khoảng trống so với HSK — app Anh phải bù, xem mục 3.8** |
| SW v6 (HTML mạng-trước, static/data SWR, không cache audio) | Giữ nguyên |
| Khung khoá học có tiến độ (`/phat-am`, `/ngu-phap` + `progress-local.ts`) | **Giữ khung trong code, chưa dùng** — nội dung khoá phụ để sau production (mục 3.6) |

Các quyết định kiến trúc **giữ nguyên 100%** (đã chứng minh qua 2 app): Next.js static export +
TypeScript + Tailwind; IndexedDB (Dexie) là nguồn sự thật, offline-first, PWA; `ts-fsrs` giữ **config
chặt** (`request_retention 0.97`, `maximum_interval 120d`, learning steps phút→giờ→12h); Học từ mới
tách riêng Ôn tập; audio 100% MP3 build sẵn bằng edge-tts **một giọng duy nhất**; Firebase Auth +
Firestore chỉ để sync; Firebase Hosting; chi phí **$0/tháng**; routes tiếng Việt; mobile-first ~390px.

### Bỏ hẳn (đặc thù tiếng Pháp)
- **Giống từ** (le/la, un/une): field `gender`, câu hỏi chọn giống, đọc audio kèm mạo từ — tiếng Anh không có.
- **Chia động từ 6 ngôi × 4 thì** (`conjugations/{lemma}.json`, tab chia động từ): thay bằng bảng
  **động từ bất quy tắc** gọn hơn nhiều (mục 3.3).
- **Khoá phát âm vỡ lòng 14 bài** (bảng chữ cái, liaison, elision…): người học đã B1 — thay bằng khoá
  **phát âm nâng cao cho người Việt** ngắn hơn, không chặn lộ trình (mục 3.6).
- **Lộ trình khởi động theo chủ đề** (`lib/starter.ts` ~60 từ A1 cụ thể): sinh ra để cứu người học từ
  số 0 khỏi 30 từ chức năng đầu A1 — B1 không gặp vấn đề này, xoá.
- Xử lý **elision/liaison** trong lemma-map (`l'école`, `au/du`): thay bằng xử lý **contraction** tiếng Anh
  (*don't, I'm, it's, won't*) — cùng chỗ code, khác bảng quy tắc.

### Thêm mới (đặc thù tiếng Anh, xếp theo độ quan trọng)
1. **Phrasal verbs là thẻ từ hạng nhất** (mục 1.5) — đặc sản tiếng Anh B1–C2 (*give up, look forward to,
   put up with*). Id đa từ, có thẻ FSRS riêng, ví dụ riêng, lọc riêng trong word-browser. Bài đọc
   **tag sẵn cụm đa từ lúc build** (tái dùng kinh nghiệm tách từ longest-match của app HSK).
2. **Họ từ (word family)** — *decide → decision → decisive → decisively*: khối "Họ từ" trong word-detail,
   link chéo giữa các thẻ. Word formation là kỹ năng thi B2–C2 (FCE/CAE Use of English).
3. **Động từ bất quy tắc** — bảng `V1 – V2 – V3 (– V-ing, -s)` trong word-detail (thay tab chia động từ Pháp);
   các dạng này cũng vào `lemma-map` để reader tra được *went→go*.
4. **Collocations** — 3–5 cụm hay đi kèm mỗi từ (*heavy rain*, *make a decision*, *bitterly disappointed*) —
   hiển thị trong word-detail; nguồn: agent sinh + QA (như nghĩa VI).
5. **Nhãn register** — `formal / informal / academic / literary / slang / dated` — sống còn ở C1/C2
   (biết từ nhưng dùng sai văn cảnh). Lấy từ tags của Wiktionary (kaikki), hiển thị badge cạnh nghĩa.
6. **Anh–Mỹ**: id chuẩn hoá **chính tả Mỹ** (*color*), biến thể Anh (*colour*) đưa vào `forms` + `search`
   để gõ kiểu nào cũng tra được; IPA lưu bản khớp giọng TTS đã chọn.
7. **Từ điển nền A1–A2 (chỉ tra cứu, không học)** — mục 1.4, quyết định thiết kế quan trọng nhất của
   phần dữ liệu: bài đọc B1 đầy từ A1–A2 (*the, make, people*), reader phải tra được nhưng KHÔNG được
   đẩy chúng vào hàng đợi học.

---

## 1. Nguồn từ vựng B1–C2 (TRỌNG TÂM)

Tiếng Anh **không có chuẩn kiểu HSK**, nhưng khác tiếng Pháp: nguồn CEFR cho tiếng Anh **nhiều và tốt
hơn hẳn** (Oxford/Cambridge đã làm sẵn việc gán cấp). Vấn đề chính là **giấy phép**: các danh mục tốt
nhất (Oxford 5000, EVP) không cho phân phối lại dữ liệu thô. Giải pháp giống app Pháp: **xương sống là
tần suất + các danh mục mở**, danh mục thương mại chỉ dùng **đối chiếu khi gán cấp** (kết quả gán cấp là
sản phẩm dẫn xuất tổng hợp từ nhiều nguồn — không ship nguyên văn danh mục nào).

### 1.1. Nguồn dữ liệu

| Nguồn | Cung cấp | Vai trò | Giấy phép |
|---|---|---|---|
| **kaikki.org (Wiktextract, English)** | IPA (RP + GA), POS, nghĩa EN, **forms** (bất quy tắc, số nhiều), register tags, **phrasal verbs có entry riêng**, derived terms | **Xương sống enrich** (như `kaikki-fr.jsonl` đã làm) | CC BY-SA |
| **wordfreq** (thư viện Python, R. Speer) | Tần suất Zipf trộn sẵn nhiều corpus (phụ đề, sách, wiki, báo) | **Xương sống tần suất** — thay thế công thức trộn tay 0.6 phim + 0.4 sách của app Pháp | MIT (data CC) |
| **FrequencyWords / OpenSubtitles** (`en_50k.txt` — cùng nguồn `fr_50k.txt` đã dùng) | Tần suất khẩu ngữ | Đối trọng văn nói, tái dùng script cũ | CC BY-SA |
| **NGSL 1.2** (~2.800 từ lõi, Browne et al.) + **NAWL** (~960 từ học thuật) | Lõi từ vựng đã kiểm chứng sư phạm | NGSL ≈ ranh giới **từ điển nền A1–A2/đầu B1**; NAWL bơm vào B2–C1 | CC BY 3.0 |
| **PHaVE List** (150 phrasal verbs phổ biến nhất + nghĩa chính, Garnier & Schmitt) | Phrasal verbs theo tần suất | Lõi bộ phrasal verbs B1–B2 | Tự do (học thuật) |
| **Kelly list (English)** ~9k từ gán CEFR A1–C2 + **CEFR-J Wordlist** ~7.8k từ A1–B2 + **EFLLex** (phân bố CEFR theo giáo trình EFL) | Gán cấp CEFR máy-đọc-được | Nguồn gán cấp **mở** chính | Nghiên cứu/CC |
| **Oxford 3000/5000** (A1–C1) & **EVP — English Vocabulary Profile** (A1–C2, có cả phrases) | Gán cấp CEFR "chuẩn công nghiệp" | **Chỉ đối chiếu / sanity-check** phần biên khi các nguồn mở bất đồng — không redistribute | © OUP / © Cambridge |
| **BSL — Business Service List 1.01** (~1.700 từ, Browne & Culligan) | Vốn từ tiếng Anh công việc đã kiểm chứng bằng corpus 64 triệu từ (BSL + NGSL phủ ~97% văn bản business) | Nhãn **chủ đề công việc** cho bộ từ (mục 6) | CC BY-SA 4.0 |
| **AGID (SCOWL)** | Toàn bộ dạng biến hình tiếng Anh | Bổ sung `lemma-map` (phòng kaikki thiếu) | Mở |
| **WordNet** (+ derivational links) | Quan hệ họ từ, synonyms | Sinh khối "Họ từ" + câu hỏi synonym C1/C2 | Princeton (mở) |

> Nghĩa **tiếng Việt**: như 2 app trước — không có nguồn mở đạt chất lượng → **agent dịch + agent QA
> 2 lớp**, spot-check theo cấp trước khi build audio. Vẫn là hạng mục tốn công nhất của Phase E1.
> Điểm nhẹ hơn app Pháp: nghĩa EN lấy thẳng từ kaikki/Wiktionary không phải sinh.

### 1.2. Chia cấp đề xuất (mirror `lib/levels.ts` — 4 cấp học + 1 bộ nền)

| Cấp | Nhãn UI | Số từ | Tương đương | Tiêu chí chọn |
|---|---|---|---|---|
| 0 | Nền tảng (chỉ tra cứu) | ~2.200 | A1–A2 | NGSL lõi ∩ Oxford A1/A2 — vào từ điển + lemma-map, **không vào lộ trình học** (mục 1.4) |
| 1 | B1 · Trung cấp | ~2.000 | FCE ngưỡng dưới / IELTS 4.5–5.5 | Đồng thuận CEFR B1 (≥2 nguồn) + top tần suất còn lại + ~150 phrasal verbs lõi (PHaVE) |
| 2 | B2 · Trung cao | ~2.500 | FCE / IELTS 5.5–6.5 | Đồng thuận B2 + NAWL phần phổ thông + ~150 phrasal verbs |
| 3 | C1 · Cao cấp | ~3.000 | CAE / IELTS 7.0–8.0 | Đồng thuận C1 + NAWL còn lại + tần suất sách + ~100 phrasal verbs/idioms |
| 4 | C2 · Thành thạo | ~2.300 | CPE / IELTS 8.5+ | Phần còn lại của top ~12k lemma hữu dụng: từ văn viết, học thuật, literary, idioms |

Tổng **~9.800 từ học** + 2.200 nền = **~12.000 entry từ điển** — cùng cỡ 10.969 (HSK) và 11.000 (Pháp)
→ mọi giả định hiệu năng/kích thước dữ liệu/audio giữ nguyên.

> Số cấp học giảm từ 6 → 4: `lib/levels.ts` là config-driven nên chỉ đổi mảng `LEVELS`; UI grid cấp,
> màu accent, progress theo cấp tự khớp. Bộ nền lưu `foundation.json` — KHÔNG phải một "level".

### 1.3. Quy tắc gán cấp (script `build-level-assign.mjs` + agent duyệt phần biên)

1. Đơn vị là **lemma** (danh từ số ít, động từ nguyên thể) + **phrasal verb đa từ** là lemma riêng.
   Mỗi lemma xuất hiện đúng 1 cấp.
2. Loại khỏi lộ trình học: lemma thuộc bộ nền (NGSL lõi / đồng thuận A1–A2). Đây là khác biệt lớn nhất
   so với pipeline Pháp — có thêm bước **trừ tập nền**.
3. Ưu tiên gán: đồng thuận CEFR từ ≥2 nguồn mở (Kelly, CEFR-J, EFLLex) → nếu bất đồng, đối chiếu
   Oxford/EVP → còn lại xếp theo **percentile tần suất wordfreq** vào cấp còn chỗ.
4. Từ đa nghĩa xếp theo nghĩa phổ biến nhất (*run* = chạy ở B–, nghĩa "điều hành" ghi trong meanings);
   nghĩa nâng cao KHÔNG tách thẻ.
5. Validate như app Pháp: từ cấp N không "cơ bản hơn" đại trà cấp N−1 (percentile tần suất, cảnh báo
   lệch >2 band để duyệt tay).

### 1.4. Từ điển nền A1–A2 — quyết định thiết kế quan trọng

- **Vào**: `words-index.json`, `lemma-map.json`, word-detail (tra được từ reader và ô tìm kiếm),
  có audio từ.
- **Không vào**: hàng đợi học từ mới, thống kê tiến độ theo cấp, mục tiêu gamify.
- Word-browser có tab "Nền tảng" ẩn dưới cùng để duyệt khi tò mò; mỗi từ có nút "Học từ này" cho
  ngoại lệ (thêm thủ công vào hàng đợi) — phòng khi người học hổng vài từ A2.
- Validator bài đọc: từ nền **luôn được phép** ở mọi cấp bài đọc (whitelist vĩnh viễn).

### 1.5. Schema `Word` mới (`lib/types.ts`)

```ts
export interface Word {
  id: string;             // lemma chính tả Mỹ, có thể đa từ ("give up")
  ipa: string;            // /ˈwɔːtɚ/ — bản khớp giọng TTS đã chốt
  pos: string[];          // n, v, adj, adv, phr-v, idiom… (lib/pos.ts mới)
  irregular?: {           // chỉ động từ bất quy tắc
    past: string;         // went
    participle: string;   // gone
  };
  plural?: string;        // chỉ danh từ bất quy tắc (child → children)
  variants?: string[];    // chính tả Anh ("colour"), dạng viết khác
  register?: string[];    // formal | informal | academic | literary | slang | dated
  family?: string[];      // họ từ: id các lemma cùng gốc có trong bộ từ
  collocations?: string[]; // "make a decision", "heavy rain" (3–5 cụm)
  meaning_vi: string;
  meaning_en: string[];   // nghĩa/định nghĩa EN từ Wiktionary
  level: number;          // 0 = nền, 1..4 = B1..C2
  frequency: number;      // hạng tần suất wordfreq
  forms?: string[];       // mọi dạng biến hình để tra ngược (goes, went, gone, going)
  search: string;         // chuỗi thường-hoá (gồm cả variants) để tìm kiếm
}
```

Trường bỏ so với Pháp: `gender`, `verb_group`. Trường thêm: `irregular`, `variants`, `register`,
`family`, `collocations`.

---

## 2. Kiến trúc dữ liệu tĩnh (mirror `public/data/` của app Pháp)

```
public/data/
  words/b1.json … c2.json      # 4 cấp học, format Word mới
  words/foundation.json        # MỚI: bộ nền A1–A2 (tra cứu)
  words-index.json             # id -> [ipa, meaning_vi] (gồm cả nền)
  word-levels.json             # id -> level (0..4)
  lemma-map.json               # dạng biến hình/contraction/variant -> lemma
  examples/…                   # ≥2 câu/từ (mục tiêu 3 cho B1–B2), shard 8 mảnh/cấp như app Pháp
  readings/… + readings-index  # bài đọc theo cấp (E5 gộp luôn truyện vào đây — không có stories/)
public/audio/
  words/{slug}.mp3             # "give up" → "give-up"; slug.ts xử lý nháy/khoảng trắng
  sentences/{hash}.mp3         # đặt tên theo hash câu, dùng cho cả ví dụ lẫn câu trong bài đọc
```

### 2.1. Âm thanh — edge-tts giọng Anh
- **Một giọng duy nhất, ĐÃ CHỐT (08/08): `en-US-AriaNeural`** (nữ, Mỹ, tự nhiên) — dùng cho toàn bộ
  từ / câu / bài đọc / truyện, không giọng phụ (bài học xương máu từ app HSK: đổi giọng giữa chừng =
  build lại toàn bộ).
- IPA hiển thị **bản General American (GA)** từ kaikki, khớp giọng đã chốt.
- Scripts copy từ `build-audio.py` của app Pháp (đã hợp nhất, resume được), đổi voice + bỏ logic mạo từ.
- Ước lượng: ~12k từ + ~25–30k câu + passages ≈ **~1 GB** (app Pháp: 955 MB) — hosting tĩnh chịu được.

### 2.2. Câu ví dụ
- Tối thiểu **2 câu/từ**, mục tiêu **3 câu** cho B1–B2 (cấp học chính). Agent sinh + QA ngữ pháp/tự
  nhiên/bản dịch — pipeline `prep-*-batches.mjs` → `merge-*.mjs` giữ nguyên.
- KHÔNG ràng buộc từ vựng theo cấp cho ví dụ (giữ quyết định của cả 2 app: chỉ bài đọc/truyện ràng buộc).
- Câu ví dụ C1/C2 nên thể hiện **register** của từ (từ academic đặt trong câu academic).

### 2.3. Bài đọc & truyện (graded readers)
- Ràng buộc **từ vựng lũy kế theo cấp** (nền + B1 cho bài B1; nền + B1 + B2 cho bài B2…), validator
  chạy trên **lemma** qua `lemma-map`.
- B1 bắt đầu được với bài 6–10 câu (dài hơn A1 Pháp — người học đã đọc được), C1/C2 dạng bài báo/luận ngắn.
- Chủ đề đa dạng theo nguyên tắc 25 chủ đề của truyện HSK; thêm tỉ trọng **email/công sở/thuyết trình**
  (tiếng Anh đi làm) và **văn phong báo chí/học thuật** ở C1/C2.
- Truyện nhiều chương từ B1 (như app Pháp). Mục tiêu ban đầu: ~40 bài đọc/cấp + 3–4 truyện, bổ sung dần.
- Token bài đọc tag sẵn **cụm đa từ** lúc build: `{ w: "gave", wordId: "give" }` thường, và
  `{ w: "gave up", wordId: "give up", mw: true }` khi khớp phrasal verb (longest-match có kiểm tra
  tân ngữ chen giữa: *gave it up* → tag rời từng token, vẫn tra được *give up* qua word-detail).

---

## 3. Điều chỉnh code (delta so với `french_words/code`)

### 3.1. Giữ nguyên gần như 100%
`lib/db.ts`, `lib/srs.ts` (đổi type), `lib/review-session.ts` + `components/review-runner.tsx` (máy
trạng thái phiên học — tài sản lớn nhất), `sentence-arrange.tsx` (trật tự từ tiếng Anh quan trọng —
giữ), `lib/gamify.ts` (chỉ thay bảng cấp bậc), `lib/sync*.ts`, `progress-local.ts`, `suggest.ts`,
`bottom-nav`, `level-grid`, `home-stats`, dashboard tiến độ + heatmap, PWA/sw v6, theme, auth-gate
render lạc quan, `cai-dat`.

### 3.2. Sửa vừa
- `lib/types.ts` (schema mục 1.5), `lib/levels.ts` (4 cấp B1–C2 + bộ nền), `lib/pos.ts` (thêm
  `phr-v`, `idiom`), `lib/data.ts` (foundation.json), `lib/slug.ts` (nháy + khoảng trắng trong id đa từ).
- `word-detail.tsx`: bỏ tab chia động từ + khối giống/số nhiều Pháp → thay bằng: bảng **V1–V2–V3**
  (nếu bất quy tắc), khối **Họ từ** (link chéo), khối **Collocations**, badge **register**, biến thể
  Anh–Mỹ. Giữ: ví dụ + audio + "Gặp lại trong ngữ cảnh" + mẹo nhớ + "Đã biết rồi".
- `word-browser.tsx`: cột IPA giữ nguyên; thêm bộ lọc **"Phrasal verbs"**; search thường-hoá gồm variants.
- `reader.tsx` / `story-reader.tsx`: bấm-tra qua lemma-map (contraction *don't→do*, possessive *'s*,
  dạng bất quy tắc); token đa từ render như một cụm bấm được.
- Trắc nghiệm: **bỏ** câu hỏi chọn giống un/une. Bộ câu hỏi = đúng bộ app Pháp còn lại (MCQ, cloze,
  nghe→chọn nghĩa, hướng ngược VI→EN, sắp xếp câu) **+ gõ chính tả** (bổ sung 09/08, ngay sau khi
  production chạy). Synonym/paraphrase vẫn dời sang sau (mục 5, "Để dành").
- `hoc-extras.tsx` / trang chủ: bỏ CTA khoá phát âm vỡ lòng + starter; CTA người mới = "Bắt đầu B1".

### 3.3. Bảng động từ bất quy tắc (thay conjugations/)
~200 động từ, dữ liệu nằm ngay trong `Word.irregular` (không cần file lazy-load riêng như Pháp —
nhỏ hơn nhiều). Word-detail hiện `go – went – gone`; các dạng vào lemma-map + câu hỏi cloze có thể
khoét dạng V2/V3 trong câu ví dụ (đọc hiểu thì quá khứ).

### 3.4. `lemma-map.json`
Sinh từ kaikki forms + AGID, lọc về lemma trong bộ từ (gồm nền). Bổ sung: contraction
(*I'm, don't, won't, it's* — tách 2 lemma khi bấm), possessive, biến thể chính tả Anh. Ước lượng
~50–70k entry → giữ cơ chế tách file/lazy-load của app Pháp nếu vượt ngưỡng.

### 3.5. Gamification — theme cấp bậc Hải quân Hoàng gia Anh
Giữ nguyên toàn bộ logic (XP, huy hiệu, thăng cấp theo số từ đã học), thay 21 cấp bậc Lục quân Pháp
bằng **21 cấp bậc Royal Navy**, thấp → cao (giãn ngưỡng trên thang ~9.800 từ học):

1. Seaman (Thủy thủ) → 2. Able Seaman (Thủy thủ chuyên nghiệp) → 3. Leading Hand (Hạ sĩ) →
4. Petty Officer (Trung sĩ) → 5. Chief Petty Officer (Thượng sĩ) → 6. Warrant Officer 2 (Chuẩn úy 2) →
7. Warrant Officer 1 (Chuẩn úy 1) → 8. Midshipman (Học viên sĩ quan) → 9. Sub-Lieutenant (Thiếu úy) →
10. Lieutenant (Trung úy) → 11. Lieutenant Commander (Thiếu tá) → 12. Commander (Trung tá) →
13. Captain (Đại tá) → 14. Commodore (Phó đề đốc) → 15. Rear Admiral (Chuẩn đô đốc) →
16. Vice Admiral (Phó đô đốc) → 17. Admiral (Đô đốc) → 18. Admiral of the Fleet (Thủy sư đô đốc) →
19–21. dải danh dự: First Sea Lord → Lord High Admiral → **Master and Commander of the Seven Seas**.

UI hiển thị **tên Anh + nghĩa Việt** ("Commander · Trung tá") — bảng cấp bậc tự thân là từ vựng.
Route `/tu-luyen` đổi nhãn thành **"Hải trình"**. (Phương án thay thế nếu không thích quân hàm:
thang quý tộc Anh Commoner → … → Monarch, 12 mốc — cần giãn lại ngưỡng nhiều hơn.)

### 3.6. Hai khoá phụ — ĐỂ SAU PRODUCTION (đã chốt 08/08: chưa làm)
Khung course + tiến độ (`progress-local.ts`, pattern `/phat-am`, `/ngu-phap` của app Pháp) **giữ
nguyên trong code** nhưng bản đầu KHÔNG có nội dung, KHÔNG hiện trên nav. Khi nào cần, bổ sung không
đụng kiến trúc:
- *Phát âm nâng cao cho người Việt* (~8–10 bài): trọng âm, âm cuối -s/-ed, cặp tối thiểu ship/sheep,
  weak forms, nối âm.
- *Ngữ pháp B1–C2* (~15–20 bài): điều kiện, bị động nâng cao, đảo ngữ, mệnh đề quan hệ rút gọn…

### 3.7. Routes (bản đầu — chốt lại sau E5/E3)
`/hoc` (lưới cấp + tra nhanh toàn app), `/hoc/[level]` với **level 0 = bộ nền A1–A2**,
`/on-tap`, `/bai-doc` (hub đọc), `/tien-do`, `/tu-luyen` ("Hải trình"), `/cai-dat`.
Khác dự kiến ban đầu: **không có `/doc` và `/truyen` riêng** — E5 đã gộp truyện vào bài đọc nên
`/bai-doc` là hub đọc duy nhất. Vẫn **trừ** `/phat-am` và `/ngu-phap` (để dành, mục 3.6).

> Hệ quả của việc gộp: `public/data/stories*` rỗng đã xoá (09/08); cơ chế sync **vị trí đọc
> theo chương (S2)** vẫn giữ nguyên trong code + test nhưng **chưa có UI nào ghi vào** vì bài đọc
> hiện là văn bản một mạch. Khi nào làm truyện nhiều chương thì chỉ cần gọi `setStoryChapter`.

### 3.8. Đồng bộ Firebase — bù khoảng trống app Pháp chưa làm so với HSK

Đối chiếu code thật hai app (`french_words/code/lib/sync-data.ts` — 264 dòng, vs
`chinese_hsk_words/code/lib/sync.ts` — 634 dòng + `sync-merge.ts` thuần có unit test):
app Pháp **đã** sync reviews (chunks), daily, bài đã đọc, XP, mẹo nhớ, tiến độ khoá, config (LWW),
freeze/chuỗi — có fingerprint skip (không gì đổi → chỉ 1 getDoc) và sync khi mở app / kết thúc phiên /
ẩn app. Nhưng còn **6 khoảng trống** so với HSK, app Anh xử lý như sau:

| # | Khoảng trống (Pháp thiếu, HSK có) | Hậu quả nếu không bù | Cách bù ở app Anh | Khi nào |
|---|---|---|---|---|
| S1 | ~~Counter gamify + huy hiệu không lên cloud~~ — **KHÔNG áp dụng** (kiểm chứng 08/08) | — | App này **suy huy hiệu/gamify từ `reviews + daily + reads + xp`** (đều đã sync) chứ không lưu counter riêng như HSK → không có gì để mất | ✅ n/a |
| S2 ✅ | **Vị trí đọc truyện chỉ nằm localStorage** (HSK sync `stories/*` per-doc, LWW theo updatedAt) | Đọc dở chương 3 trên điện thoại, mở máy tính lại về chương 1 | Đưa `{storyId, chapter, updatedAt}` vào user-doc, merge LWW | **E7** |
| S3 ✅ | **Không pull khi QUAY LẠI app** — chỉ sync lúc mở / kết thúc phiên / ẩn app (`visibilitychange → hidden`), không có chiều `→ visible` (HSK `startAutoSync` có) | Tab máy tính mở sẵn cả ngày không bao giờ thấy tiến độ vừa ôn trên điện thoại | Thêm handler `visible/focus` gọi `doSync` — rẻ nhờ fingerprint: không gì đổi chỉ tốn 1 getDoc | **E7** |
| S4 | **Realtime khi app đang mở** (HSK `startRealtimeSync` — onSnapshot reviews) | 2 thiết bị cùng mở không thấy nhau ngay (phải chờ mốc sync kế) | onSnapshot trên user-doc (1 listener — rẻ hơn mô hình HSK); chỉ đáng làm nếu S3 chưa đủ | Để dành |
| S5 | **Push lẻ trong phiên** (HSK `pushReview` mỗi lần chấm + `pushDaily` debounce 5s) | App bị kill giữa phiên dài → kết quả chưa lên cloud (vẫn an toàn trong IndexedDB, chỉ mất khi mất máy) | `requestSync` debounce thêm mỗi ~20 thẻ trong phiên | Để dành |
| S6 ✅ | **Không có chỉ báo lỗi sync** (HSK có `sync-status.ts` + indicator trên header) | Sync hỏng âm thầm nhiều ngày, tưởng đã có backup | Port `sync-status.ts` + chấm đỏ trên menu tài khoản | **E7** |

Kèm 2 việc kỹ thuật khi port:
- **Tách merge thuần ra `lib/sync-merge.ts`** như HSK: các hàm merge của app Pháp hiện nằm lẫn trong
  `sync-data.ts` (dính Firestore, không unit-test được). Tách mergeReviews / mergeDaily / mergeReads /
  mergeNotes / mergeGamifyStats thành hàm thuần + port bộ unit test sẵn có của HSK.
- **Giữ mô hình "1 doc + chunks"** (quyết định có cân nhắc từ app Pháp — ít lượt đọc hơn per-record
  của HSK), ghi nhận trade-off: 1 thay đổi nhỏ → ghi lại toàn bộ chunks; và để mắt trần
  **1 MB/doc Firestore** khi ReviewRecord phình (bộ ~10k thẻ ÷ 1.500/chunk hiện an toàn).

---

## 4. Phases (mirror F0–F7 — local trước, deploy sau)

| Phase | Tên | Nội dung chính | DoD |
|---|---|---|---|
| **E0** ✅ | Khởi tạo *(xong 08/08)* | Copy `french_words/code` → `english_words/code`; gỡ module Pháp (gender, conjugations, starter, nội dung + nav của phonics/ngữ pháp Pháp); đổi branding/theme màu (navy + mỏ neo); `LEVELS` 4 cấp; **làm luôn bảng cấp Royal Navy** (kéo từ E6 lên — app mới chưa có user, đổi id an toàn) | ✅ `next build` sạch · app chạy với 30 từ B1 mẫu (đủ schema mới) · nghiệm thu trên browser: learn-card → recall-first → MCQ → requeue, modal chặn thoát, word-detail phrasal verb "give up", search, DB `english-words`, key `en.*` |
| **E1** ✅ | Dữ liệu từ vựng *(xong 08/08)* | Nguồn: Wiktextract (kaikki) + wordfreq + **CEFR-J A1–B2 + Octanove C1–C2** (thay NGSL/Kelly/EFLLex — máy-đọc-được, CC BY-SA); `build-words-stage1.mjs` (gán cấp + enrich + lọc rác) → `fill-ipa.mjs` → agent dịch VI + collocations → `check-vi.mjs` → `build-assemble.mjs` | ✅ **12.410 từ**: nền 2.289 · B1 2.276 · B2 2.558 · C1 2.997 · C2 2.290 · **425 thẻ `phr-v`** (B1 140 · B2 146 · C1 92 · C2 47) trong tổng **585 thẻ đa từ** · 100% có nghĩa VI + collocations (trừ bộ nền) · lemma-map **29.107 dạng** · họ từ **4.380 liên kết / 3.839 từ** (làm ở E3) · **IPA phủ 97,2%** (còn thiếu 342: B1 17 · B2 49 · C1 116 · C2 152 — kaikki không có, audio vẫn đủ 100%) · nghĩa EN đã **đi theo con trỏ** thay vì bày "past participle of…" (416 thẻ được sửa) · nhãn `phr-v` đã lọc lại 09/08 bằng `isPhrasalVerb()`: bắt buộc có tiểu từ/giới từ đứng sau **và** nghĩa động từ phải là nghĩa chính (không phải "dạng của…") → *full stop, air conditioning, used to, ought to, heads up* trả về đúng từ loại |
| **E2** ✅ | Ví dụ + audio *(xong 08/08)* | Agent sinh 3 câu/từ; edge-tts `en-US-AriaNeural` cho từ + câu | ✅ **30.363 câu ví dụ** (B1 6.828 · B2 7.674 · C1 8.991 · C2 6.870), QA `check-ex.mjs` sạch 100% · **audio 12.411 file từ + ~30k file câu**, 0 lỗi |
| **E3** ✅ | UI học & tra *(xong 09/08)* | word-browser/word-detail bản Anh (V1-V2-V3, họ từ, collocations, register, lọc phrasal verbs); search variants; foundation tra cứu | ✅ khối **Họ từ** bấm được (điều hướng trong modal, có nút quay lại) trên **4.380 liên kết / 3.844 từ** — luật sinh mới trong `build-assemble.mjs` (hậu tố + kiểm chứng bằng định nghĩa EN, chặn *legal→leg*, *quotation→quota*) · bộ lọc **Phrasal verbs** (B1: 140, đã lọc nhiễu nhãn ở E1) · **bộ nền A1–A2 duyệt được** ở `/hoc/0` (không CTA học, không tính tiến độ, vẫn "Học từ này" thủ công) · search variants đã có sẵn trong `search` |
| **E4** ✅ | SRS + ôn tập *(xong 09/08)* | Nối FSRS config chặt; đủ bộ câu hỏi Pháp (trừ giống từ) + **gõ chính tả** | ✅ FSRS `request_retention 0.97` / `maximum_interval 120` / steps `1m·10m·1h·12h` · bộ câu hỏi meaning · reverse · cloze · listen · sắp xếp câu (đã bỏ giống từ) · E2E chạy **trọn 1 vòng học mới → tổng kết → thẻ vào hàng đợi → ôn sớm trọn vòng** · ✅ **gõ chính tả** (`lib/spell.ts` + `components/spell-card.tsx`): nghe + nghĩa VI → gõ lại từ, chịu lệch 1 ký tự, chỉ ra ở thẻ ĐÃ CHÍN với tỉ trọng 25%, tắt/bật trong Cài đặt. Synonym C1/C2 vẫn **để sau production** (mục 5) |
| **E5** ✅ | Bài đọc *(xong 09/08)* | **Đổi cách làm**: thay vì agent tự viết, lấy từ **nguồn mở** (Simple Wikipedia CC BY-SA + Wikinews CC BY 2.5), lọc tự động theo độ phủ từ vựng lũy kế, dịch bằng **API Google (0 token)**. Gộp truyện vào bài đọc. | ✅ **994 bài · 9.959 câu** (B1 85 · B2 278 · C1 423 · C2 208) · QA `check-readings.mjs` sạch · audio đủ 100% · tiếng Anh là văn bản bản ngữ THẬT |
| **E6** ✅ | Gamify + E2E *(xong 08/08, mở rộng 09/08)* | Bảng cấp Royal Navy ("Hải trình"); Playwright các luồng chính | ✅ **18/18 E2E pass** (thêm: bấm-tra từ trong bài đọc, gõ chính tả) · **71 unit test** (`sync-merge` 20 + `sync 2 thiết bị & trạng thái sync` 16 + `logic & gõ chính tả` 35) · `npm run check` xanh (typecheck + lint + test) |
| **E7** ✅ | Triển khai + đồng bộ *(xong 09/08)* | Firebase project mới + Hosting + Auth/Firestore rules 1 UID; bù khoảng trống sync (mục 3.8); tách `sync-merge.ts` thuần + unit test | ✅ **code xong**: S2 vị trí truyện đã sync · S3 pull khi quay lại app · S6 chỉ báo lỗi sync · `sync-merge.ts` thuần + 20 test · build tĩnh 838MB sạch · [DEPLOY.md](../code/DEPLOY.md) · ✅ **PRODUCTION: https://english-words-pet.web.app** · project `english-words-pet` · khoá 2 UID (mở rộng cơ chế owner 1→N tài khoản) · ✅ **nghiệm thu logic 2 máy tự động** (`test-sync-2devices.mjs`, 11 ca: hội tụ 2 chiều, S2 LWW, S3 kéo khi remote đổi, S6 trạng thái lỗi, tombstone, chunk 1.500, "không đổi → 1 getDoc") — `fingerprint`/`fpEq`/`mergeSnapshots` đã tách sang `sync-merge.ts` để test chạy trên code thật · ⬜ còn **nghiệm thu I/O thật**: đăng nhập cùng tài khoản trên 2 thiết bị theo bảng mục 6 [DEPLOY.md](../code/DEPLOY.md) (không tự động hoá được) |

**Cột mốc & chiến lược "làm dần"**: chỉ cần **B1 hoàn chỉnh** (từ + ví dụ + audio + ~40 bài đọc) là
bắt đầu học thật ngay sau E5 — B2/C1/C2 bổ sung dần không chặn việc học (người học đứng ở B1).
Nghiệm thu mobile-first **~390px** như 2 app trước.

**Trạng thái 09/08/2026**: E0–E7 **đã xong hết**. Việc còn lại duy nhất nằm ngoài tầm tự động hoá
là **nghiệm thu đồng bộ I/O thật trên 2 thiết bị** (mục 6 của DEPLOY.md) — phải đăng nhập tay.
Ngoài ra chỉ còn danh sách "để dành sau production" ở mục 5.

---

## 5. Rủi ro & quyết định

### Rủi ro

| Rủi ro | Hướng xử lý |
|---|---|
| Oxford/EVP không redistribute được | Xương sống = tần suất wordfreq + Kelly/CEFR-J/EFLLex/NGSL (đều mở); Oxford/EVP chỉ đối chiếu phần biên, output là tổng hợp dẫn xuất |
| Đa nghĩa tiếng Anh cực nặng (*run, set, get*) | Thẻ theo lemma, nghĩa phổ biến nhất là chính; nghĩa phụ trong meanings + ví dụ đa ngữ cảnh; KHÔNG tách thẻ |
| Đồng tự khác âm (*read* hiện tại/quá khứ, *record* n/v) | Chọn phát âm nghĩa chính cho audio/IPA; ghi chú trong word-detail; chấp nhận không hoàn hảo |
| Phrasal verb tách rời trong câu (*gave it up*) | Tag build-time chỉ khớp liền kề; dạng tách vẫn tra được từng từ; validator không bắt buộc khớp cụm |
| Ranh giới nền/B1 sai (người học hổng từ A2) | Nút "Học từ này" trên mọi từ nền + spot-check ranh giới bằng agent trước khi chốt |
| Nghĩa VI/collocations sinh bằng agent sai | QA 2 lớp + spot-check theo cấp trước khi build audio (đã thành quy trình chuẩn qua 2 app) |
| C2 không có danh mục chuẩn | Như app Pháp: "top tần suất còn lại", nhãn "Thành thạo", không hứa chuẩn CPE |
| Copy nguyên sync app Pháp mà quên khoảng trống so với HSK (mất huy hiệu/vị trí truyện khi đổi máy) | Checklist S1–S6 (mục 3.8) nằm trong DoD của E7; bắt buộc nghiệm thu trên 2 thiết bị trước khi coi E7 là xong |

### Đã chốt (08/08/2026)
1. **Code nền**: copy từ `french_words/code` (không phải app HSK).
2. **Cấp học**: 4 cấp B1–C2 (~9.800 từ) + bộ nền A1–A2 (~2.200 từ, chỉ tra cứu).
3. **Phrasal verbs** là thẻ hạng nhất, phân bố vào các cấp.
4. **Giọng TTS**: Mỹ — **`en-US-AriaNeural`**, một giọng duy nhất; IPA bản General American.
5. **Phạm vi bản đầu**: học **từ + câu + bài đọc/truyện**. Không thêm dạng câu hỏi mới,
   không khoá phát âm, không khoá ngữ pháp.
6. **Theme gamify**: cấp bậc Hải quân Hoàng gia Anh, route "Hải trình".
7. **Repo**: `english_words/code` (thư mục hiện tại).

### Để dành sau production (không nằm trong E0–E7)
- ~~Dạng câu hỏi **gõ chính tả**~~ — **đã làm 09/08**, xem E4.
- Dạng câu hỏi **synonym/paraphrase** cho C1/C2 (nguồn WordNet).
- Khoá **phát âm nâng cao cho người Việt** (~8–10 bài) — khung course đã sẵn trong code.
- Khoá **ngữ pháp B1–C2** (~15–20 bài) — khung course đã sẵn trong code.
- Sync **realtime khi app đang mở** (S4, mục 3.8) và **push lẻ trong phiên** (S5) — hai khoảng trống
  sync mức thấp, chỉ làm nếu sau khi dùng thật thấy cần.

---

## 6. Module Tiếng Anh công việc (thêm 09/08/2026)

Nguồn tham chiếu **chủ đề** là các khoá business English thương mại (Business English Pod và tương tự)
— chỉ lấy **cách chia chủ đề**, KHÔNG lấy nội dung: bài học/transcript/audio của họ có bản quyền,
app này chạy public nên chép vào là vi phạm. Nội dung tự dựng từ nguồn mở + agent, đúng như E1–E5.

### 6.1. Nhánh từ vựng (XONG 09/08)

- Xương sống: **BSL 1.01** (CC BY-SA 4.0). Đối chiếu với bộ từ hiện có rồi **bổ sung phần thiếu**:
  kết quả **1.730/1.754 từ BSL** đã nằm trong bộ và được gắn nhãn
  (nền 117 · B1 306 · B2 457 · C1 589 · C2 261). 24 từ còn lại là tiền tố/dạng ghép
  (*non-, pre-, sub-, multi-*) hoặc dạng chia của từ đã có → cố tình bỏ.
- **187 từ công việc mới** được nạp vào bộ từ (B2 24 · C1 52 · C2 111): lấy dữ liệu Wiktionary lẻ
  từ kaikki.org (`fetch-kaikki-words.mjs` — 223 từ, 417 entry), gán cấp theo tần suất
  (≥4.0 → B2 · ≥3.2 → C1 · còn lại C2) và **không bao giờ hạ xuống B1** để lộ trình phổ thông
  giữ nguyên. Kèm 200 nghĩa VI + collocations, **600 câu ví dụ**, **800 file audio** mới.
  Bộ từ: 12.410 → **12.597**; câu ví dụ: 30.324 → **30.924**.
- Lưu ở `public/data/topics/business.json` (16KB, **tải lười** khi người dùng thật sự lọc) chứ không
  nhét vào từng `Word` — ai không dùng thì không tốn byte nào.
- UI: bộ lọc **"Tiếng Anh công việc"** trong word-browser + badge **💼 công việc** trong thẻ từ.
- Ghi công CC BY-SA: mục **📚 Nguồn dữ liệu** mới ở trang Cài đặt (ghi cả kaikki, CEFR-J/Octanove,
  wordfreq, Wikipedia/Wikinews — trước giờ app chưa ghi nguồn ở đâu cả).

### 6.2. Nhánh bài đọc + hội thoại (XONG 09/08)

**Vì sao chia hai nhánh**: đo thực tế cho thấy kho đọc phổ thông chỉ phủ **62%** vốn từ BSL
(651 từ chưa từng xuất hiện, gần như toàn từ tài chính/kế toán). 25 bài hội thoại ≈ 350 câu ≈
3,5% kho đọc — không đủ để phủ từ. Nên tách: **bài đọc lo phủ từ, hội thoại lo ngôn ngữ nói.**

| Nhánh | Kết quả |
|---|---|
| **Bài đọc kinh tế (Wikinews)** | `fetch-readings.mjs --business=N` lấy Category "Economy and business" (category duy nhất còn sống trên Wikinews), lọc theo độ phủ từ vựng, dịch máy qua pipeline E5 (**0 token**). Kho đọc **994 → 1.446 bài**. Phủ vốn từ BSL: **62% → 79%** |
| **Hội thoại công việc** | **60 bài** tự biên soạn (B1 15 · B2 20 · C1 25), **610 lượt thoại**, EN + VI đều do agent viết (nội dung dạy chính, KHÔNG dùng máy dịch). Nguồn ở `scripts/dialogues/*.json`, ráp chung vào readings để dùng lại reader/audio/đánh dấu đã đọc |
| **Reader 2 vai** | `ReadingSentence.sp` + `ReadingDoc.speakers`; bong bóng lệch trái/phải, tên vai trên mỗi lượt |
| **Giọng thứ 2** | `en-US-GuyNeural` cho vai 1. Tên file thêm hậu tố `-m` → **không đụng** 42.700 file audio cũ. `build-audio.py` nhận `voice` theo từng mục manifest |
| **Ghi công nguồn** | Reader hiện dòng "Nguồn: Wikinews — CC BY 2.5" ở cuối bài đọc mở (trước đây **chưa có ở đâu**, dù giấy phép bắt buộc); hội thoại ghi rõ do dự án biên soạn |
| **Lọc trong hub đọc** | 3 tab: Tất cả · 💼 Công việc · 💬 Hội thoại |

### 6.3. Còn lại (chưa làm)

| Việc | Ghi chú |
|---|---|
| **Cụm chức năng tra cứu riêng** | Hiện các cụm ("I'm afraid that's outside our budget") nằm trong hội thoại; chưa có bảng tra theo chức năng giao tiếp |
| **Khung khoá học** | Dùng lại `progress-local.ts` + pattern `/phat-am`, `/ngu-phap` đang để trống (mục 3.6) — hội thoại hiện nằm trong hub đọc, chưa thành "khoá" có lộ trình |
| **360 từ BSL chưa gặp trong bài đọc** | Còn 21% vốn từ business chưa xuất hiện trong kho đọc; cần thêm bài chuyên ngành hẹp hơn |

---

## 7. Đợt rà soát toàn diện + sửa lỗi (11/08/2026)

Review toàn bộ project (nội dung · tính năng/UI · code · bảo mật) rồi sửa. Không đổi kiến trúc —
chỉ vá lỗi, dọn nợ và bổ sung nội dung.

### 7.1. Dữ liệu — từ vựng

| Việc | Kết quả |
|---|---|
| **Động từ bất quy tắc sai hệ thống** | Nguồn Wiktionary bịa dạng (`set→setted`, `hit→het`, `put` thiếu hẳn) và gán nhãn bất quy tắc cho ~600 động từ QUY TẮC. Sửa: `irregular` 919 → **339 thẻ** (thêm 69, sửa 18, bỏ nhãn ở 70 từ không phải động từ + 579 động từ quy tắc), xoá **275 dạng bịa** khỏi `forms`. Lớp zero-change (put/set/cut/read/cost…) và come-type (come/become/run) giờ đúng |
| **lemma-map trỏ sai từ** | Xoá **748 entry** (29.566 → 28.818): 456 mapping kiểu `is→i`, `book→bake`, `they→it`, `news→new` (bấm-tra trong bài đọc nhảy sai từ), 20 dạng máy bịa, 272 khoá mồ côi. Giữ nguyên 38 dạng bất quy tắc thật |
| **IPA lẫn hai kiểu bọc** | kaikki trả cả `/ˈwɔːtɚ/` (âm vị) lẫn `[tʰu̟(ː)]` (phiên âm hẹp) — 126 từ dùng ngoặc vuông, đứng cạnh nhau trong danh sách trông như lỗi. Chuẩn hoá hết về `/…/` (`scripts/fix-ipa-format.mjs`, luật cũng vào `build-assemble.mjs`) |
| **Từ thô tục không có nhãn** | `jerk off`, `bitch`, `horny`, `fag` — nghĩa chính là thô tục/miệt thị mà không nhãn nào, người học tưởng từ trung tính. Thêm register `vulgar`/`offensive` (+ nhãn VI trong word-detail). Cố ý KHÔNG gắn cho `screw`/`bang`/`hell`/`damn`/`prick` vì nghĩa thường dùng của chúng bình thường |
| **Luật dọn vào thẳng pipeline** | `scripts/fix-irregular.mjs` + `scripts/clean-lemma-map.mjs`, được `build-assemble.mjs` gọi → build lại không đẻ rác lần nữa |

### 7.2. Dữ liệu — bài đọc

| Việc | Kết quả |
|---|---|
| **Gỡ bài không phù hợp** | **16 bài** (khiêu dâm, vandalism từ nguồn, bạo lực đồ hoạ, bài quá trừu tượng ở B1) + `scripts/readings-blocklist.json` **chặn vĩnh viễn** — `prep-reading-batches.mjs` và `build-readings.mjs` đều lọc, nên fetch lại cũng không quay về. Bài xả súng ở B1 đẩy lên B2 |
| **Dịch máy sai nghĩa** | Sửa **646 câu/tiêu đề**: đợt cũ 334 (trên 288 bài) + đợt bài mới 312 (107 tiêu đề · 205 câu). Nặng nhất luôn là TIÊU ĐỀ: `Commodore 64`→"Hàng hóa 64", `Burns Night`→"Đêm bỏng", `Merguez`→"sáp nhập", `Superpower`→"Siêu năng lực", `Confederate States`→"Liên bang Hoa Kỳ" (ngược nghĩa). Còn ước 5–8% câu giữa bài chưa rà |
| **Lệch song ngữ EN–VI** | Bản VI mang theo dateline mà câu EN đã cắt → 115 bài lệch + 36 bài mở đầu bằng dấu phẩy. Regex cũ hụt hẳn nhóm "Chủ nhật" và dạng `d/m/y`; sửa xong còn **0** |
| **Ký tự vô hình** | Xoá U+200B/200C/200D/FEFF/00AD ở 214 bài + thêm bước strip vào `build-readings.mjs` |
| **Ngày đăng tin** | 51% tin Wikinews đã hơn 10 năm mà UI không nói. Trích ngày từ dateline → `ReadingDoc.date`, reader hiện "Tin gốc đăng ngày d/m/yyyy" |
| **Bổ sung nội dung** | **20 hội thoại C2** tự biên soạn (271 lượt, C2 trước đây = 0) + fetch thêm ~185 bài (mở rộng 25 → 45 category Simple Wikipedia). Kho đọc **1.410 → 1.615 bài** (b1 113 · b2 476 · c1 698 · c2 328) · audio phủ **100%** (47.357 câu + 12.597 từ) |
| **fetch-readings resume được** | Checkpoint sau mỗi lô 20 bài thay vì chỉ lưu ở cuối — đợt tải kéo dài hàng chục phút, đứt giữa chừng không còn mất trắng |

### 7.3. Code — lỗi làm MẤT dữ liệu học (nghiêm trọng nhất)

| # | Lỗi | Cách sửa |
|---|---|---|
| 1 | **Race sync ghi đè câu trả lời**: `syncNow` đọc snapshot → đi mạng vài giây → `bulkPut` đè thẳng lên DB. Trả lời thẻ trong khoảng đó là mất VĨNH VIỄN (fingerprint sau đó khớp nên không tự lành) | Đọc lại ngay TRONG transaction rồi merge tiếp bằng đúng luật hội tụ của sync (`lib/sync-data.ts`) + 2 unit test mô phỏng thao tác chen giữa lúc chờ mạng |
| 2 | **Nhập backup "Gộp" không phải merge**: UI hứa "bản mới hơn thắng" nhưng bản trong TỆP luôn thắng → nhập backup cũ là tiến độ thụt lùi rồi bị sync đẩy lên cloud | `importData` đi qua `mergeReviews/mergeDaily/mergeReads/mergeNotes/mergeGamify` (`lib/db.ts`) |
| 3 | **`doSync` chạy chồng**: `focus`/`visibilitychange`/`pagehide` gọi thẳng, hai lượt song song ghi đè `saveState` của nhau | Gộp lượt gọi vào promise đang chạy, có thì chạy thêm đúng 1 lượt nữa |

### 7.4. Code — còn lại

- **Chấm tốc độ cho bài gõ chính tả** dùng ngưỡng của MCQ (3,5s/9s) → gõ đúng trong 12s vẫn bị FSRS
  chấm *Khó*. Thêm mode `spell` (8s/20s) trong `srs-pure.ts`.
- **Fetch hụt → treo vô hạn**: offline vào cấp chưa cache thì "Đang tải…" mãi mãi; phiên ôn dựng 0 câu
  thì `ReviewRunner` trả `null` = màn hình trắng KHÔNG thoát được (effect chặn Back đã pushState).
  Cả ba đường đều có lối ra + nút thử lại.
- **Hiệu năng**: mở thẻ từ tải **4MB** bài đọc để dựng khối "Gặp lại trong ngữ cảnh" → thay bằng chỉ mục
  `public/data/word-readings/{0..7}.json` (~30KB/shard, `scripts/build-word-readings.mjs`);
  `loadWords` không cache → mỗi lần mở phiên parse lại 1,3–1,7MB; `progressSummary` quét 12k thẻ và bị
  3 component gọi mỗi lần điều hướng → cache 1,5s, mọi hàm ghi tự xoá cache; bỏ **`words-index.json`
  868KB** khỏi deploy (không nơi nào đọc).
- **Service worker**: cache không bao giờ dọn (mọi `/_next/static/<hash>` của mọi lần deploy nằm lại
  vĩnh viễn) và cache cả response lỗi → bump `en-words-v2`, chỉ cache khi `res.ok`, trang cache theo
  đường dẫn (bỏ query), trần 260 entry.
- **Sót từ app Pháp**: icon **tháp Eiffel** ở màn đăng nhập (màn hình đầu tiên trên production!) → mỏ neo;
  tệp backup tên `french-words-backup-*.json` → `english-words-*`; `class FrDB` → `EnglishWordsDB`.
- **Số từ mỗi cấp** trong `lib/levels.ts` là số DỰ KIẾN của kế hoạch (B1 2.000) trong khi data có 2.276 →
  thanh tiến độ đầy 100% lúc còn 276 từ chưa học. Sửa theo data thật + test khoá lại để không lệch nữa.
- Bài đọc **bị đánh dấu "đã đọc" ngay khi mở** → chỉ đánh dấu khi đọc tới cuối bài (IntersectionObserver).
- Khác: `recordAnswer`/`undoAnswer` gộp vào một transaction; freeze chuỗi được tặng lại sau khi chuỗi đứt;
  `longestStreak` an toàn DST; tiến độ header không tụt lùi khi gặp thẻ requeue; audio dùng chung một
  hàm `playAudio` (bấm liên tiếp không chồng tiếng); "nghe cả bài" bỏ qua câu lỗi thay vì dừng cả bài;
  word-detail cắt còn 2 nghĩa EN; `e2e/` được type-check.

### 7.5. Bảo mật

Không có lỗ hổng nghiêm trọng (rules khoá UID đúng, không lộ secret, không có đường XSS, PII tối thiểu).
Đã vá phần còn lại: nâng `next` 16.2.10 → **16.3.0** (0 lỗ hổng ở nhánh production, trước là 4 high);
thêm **security headers** vào `firebase.json` (CSP, nosniff, Referrer-Policy, Permissions-Policy,
frame-ancestors); **validate dữ liệu ghi** trong `firestore.rules` (`hasOnly` + giới hạn kiểu/số chunk);
**lọc schema dữ liệu kéo từ cloud** (`sanitize*` trong `sync-merge.ts`) để doc hỏng/bị sửa tay không
làm abort transaction Dexie và chết đồng bộ vĩnh viễn; chặn khoá `__proto__` từ remote.

### 7.6. Test

**71 → 98 unit test** (sync-merge 31 · sync 2 thiết bị 23 · logic 44) và **18 → 28 E2E**.
Bổ sung đúng chỗ trước đây không có lưới: race sync, lọc dữ liệu cloud hỏng, ngưỡng chấm bài gõ,
số từ mỗi cấp khớp data, đánh dấu đã đọc, chỉ mục từ→bài, ngày đăng tin.

### 7.7. Module Tiếng Anh CNTT (thêm 11/08/2026, cùng đợt)

Tab **💻 CNTT** trong hub đọc — một lối vào duy nhất gom mọi nội dung IT (bài đọc + hội thoại),
chia theo cấp như phần còn lại của app.

| Nhánh | Kết quả |
|---|---|
| **Bài đọc** | `fetch-readings.mjs --it=N`: 13 category IT của Simple Wikipedia (Computer_science, Software, Internet, Video_games, Operating_systems, AI, Computer_security…) + Wikinews Computing/Internet. **338 bài tag `topic:"it"`** (321 mới + 17 bài sẵn có được gắn lại nhãn qua cơ chế retag trong `saveInto`) |
| **Hội thoại IT** | **24 bài · 303 lượt** tự biên soạn (B1→C2 mỗi cấp 6): standup, code review, phỏng vấn, system design, postmortem, tech debt, SLA, rò rỉ dữ liệu, build-vs-buy, due diligence M&A. Thuật ngữ (deploy, endpoint, rollback…) giữ tiếng Anh trong bản VI như dân IT Việt nói thật |
| **Dịch máy** | Google `translate_a/single` bị chặn 429 giữa chừng → thêm 2 fallback vào `translate-readings.mjs`: `clients5` và **trang mobile `translate.google.com/m`** (giữ được ranh giới dòng nên vẫn dịch cả bài trong 1 request — đây là đường chạy chính của đợt này) |
| **Kỹ thuật** | Nhãn topic đọc từ `readings-raw.json` làm nguồn chuẩn lúc build (bài đã dịch từ trước vẫn nhận nhãn mới, không phải re-batch); src chuẩn hoá `simplewiki`/`wikinews` (nhãn ghi công nguồn + chia pool dịch đều so sánh chuỗi này) |
| **QA sau dịch** | Agent rà 100% tiêu đề + câu đầu của 320 bài IT: sửa **93 tiêu đề** (`GParted`→"đã chia tay", `Secure Shell`→"Vỏ an toàn", `Fork bomb`→"Bom nĩa"…) + **106 câu** ("Nhà thờ Khoa học"→"Giáo hội Scientology", "Tiêm SQL"→"SQL injection"…); chặn thêm **8 bài** (người lớn, xúi tự hại, spam, trích dẫn tục) |
| **Kho sau đợt này** | **1.955 bài** (b1 132 · b2 571 · c1 858 · c2 394) · IT 352 (đọc 328 + hội thoại 24) · hội thoại 104 · audio 50.769 câu phủ 100% |

### 7.8. Còn nợ

- Ước **5–8% câu dịch máy** giữa bài (chủ yếu C1/C2) chưa rà tay.
- Kho B1 vẫn mỏng nhất (113/1.615 bài) — category Simple Wikipedia đã vét gần cạn ở ngưỡng phủ
  từ vựng 95,5% (đợt fetch cuối chỉ ra thêm 12 bài B1); muốn thêm phải mở nguồn khác hoặc tự viết.
- Sync realtime (S4) và push lẻ trong phiên (S5) vẫn để dành như mục 5.
