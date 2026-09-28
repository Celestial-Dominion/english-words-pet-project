// Coverage từ vựng của học liệu theo cấp (docs/ENGLISH_CONTENT_PLAYBOOK.md §4).
//   node scripts/content-coverage.mjs                 bảng tổng theo cấp (+ ghi scripts/out/coverage.json)
//   node scripts/content-coverage.mjs --gaps b1 [N]   N từ đích B1 CHƯA gặp + từ mới gặp 1 ngữ cảnh (theo tần suất)
//   node scripts/content-coverage.mjs --topics b1     phân bố chủ đề / thể loại / độ dài của cấp
// Ngữ cảnh = một bài đọc / một truyện / một video (không tính chương riêng — cách đếm thận trọng).
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadLibrary, profileOf, ROOT } from "./lib/content-model.mjs";
import { LEVEL_KEYS, LEVEL_LABEL, targetWords, weightOf, loadVocab } from "./lib/en-vocab.mjs";

const MOD = { reading: "R", story: "S", video: "V" };

export function computeCoverage(items) {
  const v = loadVocab();
  // lemma → { R:Set(id), S:Set, V:Set } theo cấp của item
  const occ = LEVEL_KEYS.map(() => new Map());
  const anyLevel = new Map(); // lemma → Set(band) mọi cấp
  for (const m of items) {
    const p = profileOf(m);
    for (const lemma of p.counts.keys()) {
      const map = occ[m.band];
      if (!map.has(lemma)) map.set(lemma, { R: new Set(), S: new Set(), V: new Set() });
      map.get(lemma)[MOD[m.type]].add(m.id);
      if (!anyLevel.has(lemma)) anyLevel.set(lemma, new Set());
      anyLevel.get(lemma).add(m.band);
    }
  }
  const rows = [];
  for (let b = 0; b < LEVEL_KEYS.length; b++) {
    const targets = targetWords(b);
    const W = targets.reduce((s, t) => s + weightOf(t), 0);
    const r = { level: LEVEL_KEYS[b], targets: targets.length, items: {}, covered: 0, c2: 0, c3: 0, wcov: 0, R: 0, S: 0, V: 0, multi: 0, tri: 0, lib: 0, lib2: 0 };
    for (const t of ["reading", "story", "video"]) r.items[t] = items.filter((m) => m.band === b && m.type === t).length;
    let wsum = 0;
    for (const t of targets) {
      const o = occ[b].get(t);
      const ctx = o ? o.R.size + o.S.size + o.V.size : 0;
      if (ctx >= 1) {
        r.covered++;
        wsum += weightOf(t);
      }
      if (ctx >= 2) r.c2++;
      if (ctx >= 3) r.c3++;
      if (o?.R.size) r.R++;
      if (o?.S.size) r.S++;
      if (o?.V.size) r.V++;
      const mods = o ? [o.R.size, o.S.size, o.V.size].filter(Boolean).length : 0;
      if (mods >= 2) r.multi++;
      if (mods === 3) r.tri++;
      // library-wide: gặp ở cấp này hoặc cao hơn
      if ([...(anyLevel.get(t) ?? [])].some((x) => x >= b)) r.lib++;
      // ≥2 ngữ cảnh ở cấp này HOẶC cao hơn (từ cấp thấp được gặp lại ở học liệu cấp trên)
      let n2 = 0;
      for (let bb = b; bb < LEVEL_KEYS.length && n2 < 2; bb++) {
        const oo = occ[bb].get(t);
        if (oo) n2 += oo.R.size + oo.S.size + oo.V.size;
      }
      if (n2 >= 2) r.lib2++;
    }
    r.wcov = W ? wsum / W : 0;
    rows.push(r);
  }
  return { rows, occ, v };
}

const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const args = process.argv.slice(2);
  const { items, errors } = loadLibrary();
  if (errors.length) console.log(`(bỏ qua ${errors.length} lỗi định dạng — chạy content:check)`);
  const { rows, occ } = computeCoverage(items);

  if (args[0] === "--gaps") {
    const lv = args[1];
    const b = LEVEL_KEYS.indexOf(lv);
    const n = Number(args[2] ?? 300);
    const targets = targetWords(b);
    const miss = targets.filter((t) => !occ[b].has(t));
    const once = targets.filter((t) => {
      const o = occ[b].get(t);
      return o && o.R.size + o.S.size + o.V.size === 1;
    });
    console.log(`${LEVEL_LABEL[b]}: ${miss.length} từ chưa gặp, ${once.length} từ mới 1 ngữ cảnh (sắp theo tần suất)`);
    console.log(`\nCHƯA GẶP (${Math.min(n, miss.length)}):\n${miss.slice(0, n).join(", ")}`);
    console.log(`\n1 NGỮ CẢNH (${Math.min(n, once.length)}):\n${once.slice(0, n).join(", ")}`);
    process.exit(0);
  }
  if (args[0] === "--topics") {
    const lv = args[1];
    const list = items.filter((m) => m.level === lv);
    for (const type of ["reading", "story"]) {
      const l = list.filter((m) => m.type === type);
      if (!l.length) continue;
      const count = (f) => {
        const c = new Map();
        for (const m of l) c.set(f(m), (c.get(f(m)) ?? 0) + 1);
        return [...c].sort((a, b) => b[1] - a[1]).map(([k, x]) => `${k} ${x}`).join(" · ");
      };
      const words = l.map((m) => profileOf(m).nWords).sort((a, b) => a - b);
      console.log(`${lv} ${type} (${l.length}): từ min ${words[0]} · trung vị ${words[words.length >> 1]} · max ${words[words.length - 1]}`);
      console.log(`  chủ đề: ${count((m) => m.topic)}`);
      console.log(`  thể loại: ${count((m) => m.genre)}`);
    }
    process.exit(0);
  }

  console.log("Cấp  bài(R/S/V)   từ đích  phủ≥1    ≥2      ≥3      trọng số  R      S      V      ≥2 loại  cả 3   | cấp≥: phủ  ≥2");
  for (const r of rows) {
    const it = `${r.items.reading}/${r.items.story}/${r.items.video}`;
    console.log(
      [
        LEVEL_LABEL[LEVEL_KEYS.indexOf(r.level)].padEnd(4),
        it.padEnd(12),
        String(r.targets).padEnd(8),
        pct(r.covered, r.targets).padEnd(8),
        pct(r.c2, r.targets).padEnd(7),
        pct(r.c3, r.targets).padEnd(7),
        `${(r.wcov * 100).toFixed(1)}%`.padEnd(9),
        pct(r.R, r.targets).padEnd(6),
        pct(r.S, r.targets).padEnd(6),
        pct(r.V, r.targets).padEnd(6),
        pct(r.multi, r.targets).padEnd(8),
        pct(r.tri, r.targets).padEnd(6),
        "|",
        pct(r.lib, r.targets).padEnd(6),
        pct(r.lib2, r.targets),
      ].join(" "),
    );
  }
  mkdirSync(join(ROOT, "scripts", "out"), { recursive: true });
  writeFileSync(join(ROOT, "scripts", "out", "coverage.json"), JSON.stringify(rows, null, 1));
}
