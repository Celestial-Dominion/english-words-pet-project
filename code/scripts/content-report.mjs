// Báo cáo tổng học liệu Thư viện (docs/ENGLISH_CONTENT_PLAYBOOK.md §9): số bài theo cấp, chủ đề/thể loại,
// coverage, thời lượng audio và dung lượng JSON/audio thực đo. Đọc content/ (nguồn) + public/ (bản đã build).
//   node scripts/content-report.mjs          in bảng tổng (+ ghi scripts/out/content-report.json)
//   node scripts/content-report.mjs --topics thêm phân bố chủ đề + thể loại từng cấp
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadLibrary, profileOf, ROOT } from "./lib/content-model.mjs";
import { LEVEL_KEYS, LEVEL_LABEL } from "./lib/en-vocab.mjs";
import { computeCoverage } from "./content-coverage.mjs";

const DATA = join(ROOT, "public", "data", "library");
const AUDIO = join(ROOT, "public", "audio", "library");
const KIND = { reading: "readings", story: "stories", video: "videos" };
const showTopics = process.argv.includes("--topics");

const files = (dir, ext) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)) : []);
const size = (p) => (existsSync(p) ? statSync(p).size : 0);
const levelOfFile = (f) => f.split("-")[1];
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
const kb = (b) => `${Math.round(b / 1024)} KB`;
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");
const tally = (xs) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1]);

const { items, errors } = loadLibrary();
if (errors.length) console.log(`(bỏ qua ${errors.length} lỗi định dạng — chạy content:check)`);
const { rows } = computeCoverage(items);

// thời lượng audio thật (đọc từ JSON đã build: mốc audio của bài / từng chương / video)
const seconds = { reading: new Map(), story: new Map(), video: new Map() };
for (const [type, dir] of Object.entries(KIND)) {
  for (const f of files(join(DATA, dir), ".json")) {
    const d = JSON.parse(readFileSync(join(DATA, dir, f), "utf8"));
    const lv = d.level ?? levelOfFile(f);
    const s =
      type === "reading"
        ? (d.audio?.duration ?? 0)
        : type === "story"
          ? (d.chapters ?? []).reduce((n, c) => n + (c.audio?.duration ?? 0), 0)
          : (d.audio?.duration ?? d.duration ?? 0);
    seconds[type].set(lv, (seconds[type].get(lv) ?? 0) + s);
  }
}

const report = { levels: [], totals: {}, sizes: {}, generated: new Date().toISOString() };
console.log("Cấp  bài đọc truyện (chương) video | từ (R/S/V)            | audio phút R/S/V  | phủ≥1  ≥2     ≥2 loại");
const T = { reading: 0, story: 0, video: 0, chapters: 0, words: { reading: 0, story: 0, video: 0 }, min: { reading: 0, story: 0, video: 0 } };
for (const [b, lv] of LEVEL_KEYS.entries()) {
  const of = (t) => items.filter((m) => m.level === lv && m.type === t);
  const [R, S, V] = [of("reading"), of("story"), of("video")];
  const ch = S.reduce((n, s) => n + s.chapters.length, 0);
  const words = { reading: 0, story: 0, video: 0 };
  for (const m of [...R, ...S, ...V]) words[m.type] += profileOf(m).nWords;
  const min = Object.fromEntries(Object.keys(seconds).map((t) => [t, Math.round((seconds[t].get(lv) ?? 0) / 60)]));
  const cov = rows[b];
  T.reading += R.length;
  T.story += S.length;
  T.video += V.length;
  T.chapters += ch;
  for (const t of Object.keys(words)) {
    T.words[t] += words[t];
    T.min[t] += min[t];
  }
  report.levels.push({
    level: lv,
    readings: R.length,
    stories: S.length,
    chapters: ch,
    videos: V.length,
    words,
    audioMinutes: min,
    coverage: { targets: cov.targets, covered: cov.covered, ctx2: cov.c2, ctx3: cov.c3, weighted: +cov.wcov.toFixed(4), multimodal: cov.multi, allThree: cov.tri },
    topics: tally([...R, ...S].map((m) => m.topic)),
    genres: tally(R.map((m) => m.genre)),
  });
  console.log(
    [
      LEVEL_LABEL[b].padEnd(4),
      String(R.length).padEnd(7),
      `${S.length} (${ch})`.padEnd(15),
      String(V.length).padEnd(5),
      "|",
      `${words.reading}/${words.story}/${words.video}`.padEnd(21),
      "|",
      `${min.reading}/${min.story}/${min.video}`.padEnd(17),
      "|",
      pct(cov.covered, cov.targets).padEnd(6),
      pct(cov.c2, cov.targets).padEnd(6),
      pct(cov.multi, cov.targets),
    ].join(" "),
  );
}
console.log(
  `Tổng ${T.reading} bài đọc · ${T.story} truyện (${T.chapters} chương) · ${T.video} video · ` +
    `${T.words.reading + T.words.story + T.words.video} từ · audio ${T.min.reading + T.min.story + T.min.video} phút (R ${T.min.reading} / S ${T.min.story} / V ${T.min.video})`,
);
report.totals = T;

// dung lượng thực đo: JSON từng bài + chỉ mục (tải lúc mở trang) + audio (tải khi bấm nghe)
console.log("\nDung lượng   JSON (TB/bài · lớn nhất)            audio (TB/file · lớn nhất)");
for (const dir of Object.values(KIND)) {
  const js = files(join(DATA, dir), ".json").map((f) => size(join(DATA, dir, f)));
  const au = files(join(AUDIO, dir), ".mp3").map((f) => size(join(AUDIO, dir, f)));
  const sum = (a) => a.reduce((n, x) => n + x, 0);
  const row = { json: sum(js), jsonFiles: js.length, jsonMax: Math.max(0, ...js), audio: sum(au), audioFiles: au.length, audioMax: Math.max(0, ...au) };
  report.sizes[dir] = row;
  console.log(
    `${dir.padEnd(12)} ${mb(row.json).padEnd(8)} ${js.length} file (${kb(row.json / (js.length || 1))} · ${kb(row.jsonMax)})`.padEnd(46) +
      ` ${mb(row.audio).padEnd(9)} ${au.length} file (${kb(row.audio / (au.length || 1))} · ${kb(row.audioMax)})`,
  );
}
const idx = ["readings-index.json", "stories-index.json", "videos-index.json"].map((f) => size(join(DATA, f)));
const refs = files(join(DATA, "word-refs"), ".json").map((f) => size(join(DATA, "word-refs", f)));
report.sizes.indexes = idx.reduce((n, x) => n + x, 0);
report.sizes.wordRefs = refs.reduce((n, x) => n + x, 0);
console.log(`chỉ mục     ${kb(report.sizes.indexes)} (3 file) · word-refs ${kb(report.sizes.wordRefs)} (${refs.length} shard, TB ${kb(report.sizes.wordRefs / (refs.length || 1))})`);
for (const [lv] of LEVEL_KEYS.entries()) {
  const key = LEVEL_KEYS[lv];
  const au = Object.values(KIND).reduce((n, dir) => n + files(join(AUDIO, dir), ".mp3").filter((f) => levelOfFile(f) === key).reduce((s, f) => s + size(join(AUDIO, dir, f)), 0), 0);
  report.levels[lv].audioBytes = au;
}
console.log(`audio theo cấp: ${report.levels.map((l) => `${l.level.toUpperCase()} ${mb(l.audioBytes)}`).join(" · ")}`);

if (showTopics)
  for (const l of report.levels) {
    console.log(`\n${l.level.toUpperCase()} chủ đề (${l.topics.length}): ${l.topics.map(([k, n]) => `${k} ${n}`).join(" · ")}`);
    console.log(`   thể loại: ${l.genres.map(([k, n]) => `${k} ${n}`).join(" · ")}`);
  }

mkdirSync(join(ROOT, "scripts", "out"), { recursive: true });
writeFileSync(join(ROOT, "scripts", "out", "content-report.json"), JSON.stringify(report, null, 1));
console.log("\n(ghi scripts/out/content-report.json)");
