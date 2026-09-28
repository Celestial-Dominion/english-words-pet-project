// Kiểm Ngữ pháp (docs/ENGLISH_GRAMMAR_PLAYBOOK.md §10): curriculum ↔ inventory ↔ nguồn bài, trước khi build audio.
// Chạy: node scripts/check-grammar.mjs [id…] [--level a1] [--quiet] [--coverage] [--corpus]
//   (không id = mọi bài đã có nguồn)
//   --coverage  độ phủ inventory theo cấp (điểm · trọng số ưu tiên · cặp đối chiếu), bài chưa có nguồn
//   --corpus    tần suất mẫu trong Bài đọc · Truyện · Video theo cấp + probe mẫu chưa thuộc bài nào (cần soát)
// LỖI (exit 1): curriculum hỏng, nguồn sai cấu trúc / thiếu trường / vai lạ / bài tập sai / heteronym chưa khai IPA.
// CẢNH BÁO: từ vượt cấp, câu dài, thiếu phần, câu lặp, mở bài / hội thoại lặp khuôn giữa các bài…
import { curriculum, inventory, sourcePaths, buildLesson, checkCurriculum, corpus, findRe, LEVELS } from "./lib/grammar-model.mjs";

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const li = args.indexOf("--level");
const level = li >= 0 ? args[li + 1] : null;
const want = args.filter((a, i) => !a.startsWith("--") && !(li >= 0 && i === li + 1));
const C = curriculum();
const { points: P, probes } = inventory();
const paths = sourcePaths();
let bad = 0;

// ---------- curriculum ----------
const curErr = checkCurriculum();
for (const id of paths.keys()) if (!C.byId.has(id)) curErr.push(`nguồn không có trong curriculum: ${id}`);
if (curErr.length) {
  console.log("== curriculum");
  for (const e of curErr) console.log("  ✗ " + e);
  bad += curErr.length;
}

// ---------- nguồn bài ----------
const pick = (want.length ? want : C.lessons.filter((l) => paths.has(l.id)).map((l) => l.id)).filter((id) => !level || C.byId.get(id)?.lv === level);
const built = [];
let clean = 0;
for (const id of pick) {
  const r = buildLesson(id, { paths });
  if (r.lesson && !r.errors.length) built.push(r);
  bad += r.errors.length;
  if (!r.errors.length && !r.warns.length) clean++;
  if (flag("--quiet") && !r.errors.length && !r.warns.length) continue;
  const m = C.byId.get(id);
  const nE = r.lesson ? r.lesson.beats.filter((b) => b.k === "e").length : 0;
  const nN = r.lesson ? r.lesson.beats.filter((b) => b.k === "n").length : 0;
  const chars = r.lesson ? r.lesson.beats.reduce((s, b) => s + (b.k === "n" ? b.parts.map((p) => p.v ?? p.e).join("").length : b.en.length), 0) : 0;
  console.log(`\n== ${id} (${m?.lv?.toUpperCase() ?? "?"} · ${nE} câu Anh · ${nN} lời giảng · ${r.lesson?.ex.length ?? 0} bài tập · ~${Math.round(chars / 14 / 6) / 10} phút)`);
  for (const e of r.errors) console.log("  ✗ " + e);
  for (const w of r.warns) console.log("  ? " + w);
  if (!r.errors.length && !r.warns.length) console.log("  ✓ sạch");
}

// ---------- chống khuôn giữa các bài (cùng cấp) ----------
if (built.length > 1) {
  const qc = [];
  const firstWords = (s, n) => s.toLowerCase().replace(/[^a-zà-ỹđ0-9\s]/gu, " ").split(/\s+/).filter(Boolean).slice(0, n).join(" ");
  for (const lv of LEVELS) {
    const list = built.filter((r) => r.meta.lv === lv);
    if (list.length < 3) continue;
    const cap = Math.max(2, Math.ceil(list.length * 0.15));
    const group = (label, keyOf) => {
      const g = new Map();
      for (const r of list) {
        const k = keyOf(r);
        if (!k) continue;
        g.set(k, [...(g.get(k) ?? []), r.lesson.id]);
      }
      for (const [k, ids] of g) if (ids.length > cap) qc.push(`${lv.toUpperCase()}: ${label} "${k}" lặp ${ids.length} bài (${ids.slice(0, 5).join(", ")})`);
    };
    group("mở bài", (r) => {
      const b = r.lesson.beats[0];
      return b ? firstWords(b.k === "n" ? b.parts.map((p) => p.v ?? p.e).join("") : b.en, 3) : "";
    });
    group("câu thoại đầu", (r) => {
      const b = r.lesson.beats.find((x) => x.k === "e" && x.who);
      return b ? firstWords(b.en, 3) : "";
    });
    group("kiểu mở đầu", (r) => {
      const t = r.lesson.boards[r.lesson.beats[0]?.b]?.type;
      return t === "scene" ? "" : t; // mở bằng hội thoại là bình thường; chỉ đếm kiểu khác
    });
    group("lời tóm tắt", (r) => {
      const b = [...r.lesson.beats].reverse().find((x) => x.k === "n");
      return b ? firstWords(b.parts.map((p) => p.v ?? p.e).join(""), 3) : "";
    });
  }
  // câu ví dụ trùng giữa các bài (mọi cấp)
  const seen = new Map();
  for (const r of built)
    for (const b of r.lesson.beats)
      if (b.k === "e" && !b.bad && b.sec !== "recall") {
        const k = b.en.toLowerCase();
        if (seen.has(k) && seen.get(k) !== r.lesson.id) qc.push(`câu trùng giữa ${seen.get(k)} và ${r.lesson.id}: "${b.en}"`);
        else seen.set(k, r.lesson.id);
      }
  if (qc.length) {
    console.log("\n== chống khuôn");
    for (const x of qc) console.log("  ? " + x);
  }
}
if (pick.length) console.log(`\n${pick.length} bài · ${clean} sạch · ${bad} lỗi`);

// ---------- độ phủ ----------
if (flag("--coverage")) {
  const have = new Set(built.map((r) => r.lesson.id));
  const owner = new Map();
  for (const l of C.lessons) for (const p of l.pts) if (!owner.has(p)) owner.set(p, l.id);
  console.log(`\n# Độ phủ inventory (${P.size} điểm · ${C.lessons.length} bài)`);
  for (const lv of LEVELS) {
    const pts = [...P.values()].filter((p) => p.lv === lv);
    const lessons = C.lessons.filter((l) => l.lv === lv);
    const done = lessons.filter((l) => have.has(l.id));
    const ptsDone = new Set(done.flatMap((l) => l.pts));
    const w = (arr) => arr.reduce((s, p) => s + (4 - p.pri), 0);
    const cov = pts.filter((p) => ptsDone.has(p.id));
    console.log(
      `${lv.toUpperCase()}: ${pts.length} điểm · ${lessons.length} bài (${done.length} sạch) · điểm có bài dạy ${cov.length}/${pts.length} · theo ưu tiên ${Math.round((w(cov) / Math.max(1, w(pts))) * 100)}%`,
    );
    const missing = lessons.filter((l) => !have.has(l.id));
    if (missing.length && missing.length < lessons.length) console.log(`  chưa xong: ${missing.map((l) => l.id).join(" ")}`);
  }
  const pairs = [...P.values()].flatMap((p) => p.vs.map((q) => [p.id, q]));
  const ok = pairs.filter(([a, b]) => have.has(owner.get(a)) && have.has(owner.get(b)));
  console.log(`Cặp đối chiếu: ${ok.length}/${pairs.length} đã có bài ở cả hai phía`);
  const contrast = C.lessons.filter((l) => l.kind === "contrast");
  console.log(`Bài đối chiếu: ${contrast.filter((l) => have.has(l.id)).length}/${contrast.length}`);
}

// ---------- corpus ----------
if (flag("--corpus")) {
  const cp = corpus();
  console.log(`\n# Corpus: ${cp.length} câu (Bài đọc · Truyện · Video)`);
  const have = new Set(built.map((r) => r.lesson.id));
  const rows = [];
  for (const l of C.lessons) {
    const re = findRe(l.find);
    if (!re) continue;
    const band = LEVELS.indexOf(l.lv);
    const byLv = LEVELS.map((lv) => cp.filter((x) => x.level === lv && re.test(x.en)).length);
    const below = byLv.slice(0, band).reduce((a, b) => a + b, 0);
    rows.push({ l, byLv, total: byLv.reduce((a, b) => a + b, 0), below });
  }
  rows.sort((a, b) => b.total - a.total);
  console.log("Mẫu gặp nhiều nhất: " + rows.slice(0, 20).map((r) => `${r.l.id}(${r.total})`).join(" "));
  const early = rows.filter((r) => LEVELS.indexOf(r.l.lv) >= 2 && r.below >= 40 && r.below > r.total * 0.5);
  if (early.length) console.log("Hay gặp ở cấp THẤP hơn bài (cân nhắc dạy sớm hơn / regex quá rộng): " + early.map((r) => `${r.l.lv}:${r.l.id}(${r.below}/${r.total})`).join(" "));
  const notYet = rows.filter((r) => !have.has(r.l.id) && r.total >= 25);
  if (notYet.length) console.log("Hay gặp trong corpus mà CHƯA có bài sạch: " + notYet.map((r) => `${r.l.lv}:${r.l.id}(${r.total})`).join(" "));
  const zero = rows.filter((r) => r.total === 0);
  if (zero.length) console.log("Không thấy trong corpus (regex sai hoặc mẫu hiếm): " + zero.map((r) => r.l.id).join(" "));
  const pr = probes.map((p) => {
    const re = new RegExp(p.find, "u");
    const hits = cp.filter((x) => re.test(x.en));
    return { p, n: hits.length, lv: LEVELS.map((lv) => hits.filter((h) => h.level === lv).length).join("/"), ex: hits[0]?.en };
  });
  pr.sort((a, b) => b.n - a.n);
  console.log("Probe (mẫu cần soát — đã có bài dạy chưa?):");
  for (const x of pr) console.log(`  ${x.n.toString().padStart(4)}  ${x.p.id.padEnd(20)} ${x.lv.padEnd(18)} ${x.p.note}${x.ex ? ` — “${x.ex.slice(0, 70)}”` : ""}`);
}

process.exit(bad ? 1 : 0);
