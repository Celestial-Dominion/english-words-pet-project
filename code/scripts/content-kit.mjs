// Bộ công cụ soạn học liệu nhắm từ thiếu (docs/ENGLISH_CONTENT_PLAYBOOK.md §15–§16). Đếm "bài" như §15: số bài đọc /
// truyện / video KHÁC NHAU ở cấp ≤ L chứa lemma.
//
//   node scripts/content-kit.mjs need <cấp> [k=5] [N=150] [--re <regex nghĩa EN/VI>] [--min c]
//        từ của danh sách cấp đang gặp < k bài (gần ngưỡng trước — rẻ nhất để đẩy qua), kèm số bài + nghĩa Việt;
//        --re lọc theo trường nghĩa để gom một bài theo cụm chủ đề; --min bỏ từ đang gặp < c bài
//   node scripts/content-kit.mjs dens <id|đoạn-tên-file>… [--k 5]
//        mỗi bài: số chữ, câu TB, mật độ đúng cấp, vượt cấp, ngoài từ điển, và các từ "thiếu" (< k bài KHÁC) bài đó phủ
//   node scripts/content-kit.mjs names <cấp>
//        tên riêng đã dùng ở ≥ 2 truyện của cấp (bộ kiểm cảnh báo nếu dùng thêm) — tránh khai lại
import { loadLibrary, profileOf } from "./lib/content-model.mjs";
import { LEVEL_KEYS, LEVEL_LABEL, loadVocab, targetWords } from "./lib/en-vocab.mjs";
import { SPEC } from "./lib/content-spec.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const pos = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const [cmd, ...rest] = pos;
const v = loadVocab();
const { items, errors } = loadLibrary();
if (errors.length) console.log(`LỖI ĐỊNH DẠNG (${errors.length}):\n${errors.slice(0, 5).join("\n")}`);
const prof = new Map(items.map((m) => [m.id, profileOf(m)]));
const occ = new Map(); // lemma → [item]
for (const m of items) for (const k of prof.get(m.id).counts.keys()) (occ.get(k) ?? occ.set(k, []).get(k)).push(m);
const ctx = (lemma, band, except) => (occ.get(lemma) ?? []).filter((m) => m.band <= band && m !== except).length;
const vi = (w) => String(v.words.get(w)?.meaning_vi ?? "").split(/[;,]/)[0].slice(0, 18);

if (cmd === "need") {
  const b = LEVEL_KEYS.indexOf(rest[0]);
  const k = Number(rest[1] ?? 5);
  const N = Number(rest[2] ?? 150);
  const re = opt("--re") ? new RegExp(opt("--re"), "i") : null;
  const min = Number(opt("--min", 0));
  const list = targetWords(b)
    .map((w, rank) => ({ w, rank, c: ctx(w, b) }))
    .filter((x) => x.c < k && x.c >= min)
    .filter((x) => !re || re.test(x.w) || re.test(v.words.get(x.w)?.meaning_vi ?? ""))
    .sort((a, b) => b.c - a.c || a.rank - b.rank);
  const by = new Map();
  for (const x of list) (by.get(x.c) ?? by.set(x.c, []).get(x.c)).push(x);
  console.log(`${LEVEL_LABEL[b]}: ${list.length} từ < ${k} bài${re ? ` khớp /${re.source}/` : ""}`);
  let shown = 0;
  for (const [c, xs] of by) {
    if (shown >= N) break;
    const part = xs.slice(0, N - shown);
    shown += part.length;
    console.log(`[${c} bài · ${xs.length}] ${part.map((x) => `${x.w}=${vi(x.w)}`).join(" · ")}`);
  }
} else if (cmd === "dens") {
  const k = Number(opt("--k", 5));
  let tot = 0;
  for (const m of items.filter((m) => rest.some((a) => m.id === a || m.file.includes(a)))) {
    const p = prof.get(m.id);
    const dens = p.nScored ? p.bands[m.band] / p.nScored : 0;
    const over = [...new Set(p.over.filter((o) => !o.mwe).map((o) => `${o.t}(${LEVEL_LABEL[o.band]})`))];
    const overRate = p.nScored ? p.over.filter((o) => !o.mwe).length / p.nScored : 0;
    const unk = [...new Set(p.unknown)].filter((t) => !m.gloss.has(t.toLowerCase()));
    const own = [...p.counts.keys()].filter((x) => v.band.get(x) === m.band);
    const gap = own.filter((x) => ctx(x, m.band, m) < k);
    tot += gap.length;
    const sAvg = p.nWords / Math.max(1, m.sentences.length);
    const minD = (m.type === "story" ? 0.6 : 1) * SPEC[m.level].density;
    console.log(
      `${m.id} ${p.nWords} từ · câu TB ${sAvg.toFixed(1)} · đúng cấp ${(dens * 100).toFixed(1)}%${dens < minD ? ` (<${(minD * 100).toFixed(1)}!)` : ""} · vượt ${(overRate * 100).toFixed(1)}%${overRate > SPEC[m.level].over ? "!" : ""} · thiếu<${k} ${gap.length}/${own.length}`,
    );
    if (over.length) console.log(`   vượt: ${over.join(" ")}`);
    if (unk.length) console.log(`   ngoài TĐ: ${unk.join(" ")}`);
  }
  console.log(`Tổng lượt phủ từ thiếu: ${tot}`);
} else if (cmd === "names") {
  const b = LEVEL_KEYS.indexOf(rest[0]);
  const cnt = new Map();
  for (const m of items.filter((m) => m.band === b && m.type === "story")) for (const n of m.names) cnt.set(n, (cnt.get(n) ?? 0) + 1);
  console.log([...cnt].filter(([, c]) => c >= 2).map(([n, c]) => `${n.replace("^", "")}×${c}`).join(" "));
} else {
  console.log("dùng: content-kit.mjs need|dens|names …");
  process.exit(1);
}
