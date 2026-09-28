// Build Ngữ pháp: content/grammar → public/data/grammar/** (docs/ENGLISH_GRAMMAR_PLAYBOOK.md §9–10).
//   node scripts/build-grammar.mjs [--force] [--prune] [--quiet]
// 1) kiểm curriculum + nguồn (lỗi → bỏ bài đó; curriculum hỏng → dừng, trừ --force)
// 2) manifest audio scripts/out/grammar-audio.json (key = hash phần ĐỌC → sửa nghĩa/bài tập không phải TTS lại)
// 3) ghép mốc thời gian đã có (scripts/.grammar-audio/{key}.json) → lessons/{id}.json (chỉ bài đã có audio mới xuất bản)
// 4) index.json (trang tĩnh đọc lúc build) + word-refs.json (thẻ từ → bài ngữ pháp, client tải lười)
// Quy trình đủ: npm run grammar:build  (= build → audio → build lại --prune).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, GDIR, AUDIO_VERSION, LEVELS, curriculum, sourcePaths, buildLesson, checkCurriculum, lessonRelations, corpus, findRe } from "./lib/grammar-model.mjs";
import { loadVocab, lemmaOf, bandOfKey } from "./lib/en-vocab.mjs";
import { loadGrammarSource } from "./lib/grammar-format.mjs";

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const PRUNE = args.includes("--prune");
const QUIET = args.includes("--quiet");
const OUT = join(ROOT, "public", "data", "grammar");
const LES = join(OUT, "lessons");
const AUDIO = join(ROOT, "public", "audio", "grammar");
const TIMING = join(ROOT, "scripts", ".grammar-audio");
const MANIFEST = join(ROOT, "scripts", "out", "grammar-audio.json");
for (const d of [LES, TIMING, join(ROOT, "scripts", "out")]) mkdirSync(d, { recursive: true });
const sha = (s) => createHash("sha1").update(s).digest("hex");
// Mốc từ thiếu (TTS đọc gộp số “500”, “1010”… nên không khớp được từ) → nội suy theo độ dài chữ giữa mốc trước và
// mốc sau (hoặc đầu / cuối đoạn), để chữ sáng theo giọng không bị kẹt ở từ cuối có mốc.
function fillTiming(timing, words, start, end) {
  if (!words || timing.length >= words.length) return timing;
  const at = new Map(timing);
  const out = [];
  for (let i = 0; i < words.length; ) {
    if (at.has(i)) {
      out.push([i, at.get(i)]);
      i++;
      continue;
    }
    let k = i;
    while (k < words.length && !at.has(k)) k++;
    const p = out.length ? out[out.length - 1] : null;
    const from = p ? p[0] : i;
    const t0 = p ? p[1] : start;
    const t1 = k < words.length ? at.get(k) : end;
    const len = (j) => Math.max(1, String(words[j]).length);
    const total = Array.from({ length: k - from }, (_, j) => len(from + j)).reduce((a, b) => a + b, 0);
    let acc = p ? len(from) : 0;
    for (let j = i; j < k; j++) {
      out.push([j, Math.round((t0 + ((t1 - t0) * acc) / total) * 1000) / 1000]);
      acc += len(j);
    }
    i = k;
  }
  return out;
}

const curErr = checkCurriculum();
if (curErr.length) {
  console.log(curErr.slice(0, 30).map((e) => "✗ " + e).join("\n"));
  console.log(`${curErr.length} lỗi curriculum${FORCE ? " — --force: vẫn build" : " — dừng (node scripts/check-grammar.mjs)"}`);
  if (!FORCE) process.exit(1);
}

const C = curriculum();
const paths = sourcePaths();
const REL = lessonRelations();
const jobs = [];
const done = []; // { lesson, meta, json, v }
let failed = 0;
for (const l of C.lessons) {
  if (!paths.has(l.id)) continue;
  const r = buildLesson(l.id, { paths });
  if (r.errors.length) {
    failed++;
    console.log(`✗ ${l.id}: ${r.errors.length} lỗi — node scripts/check-grammar.mjs ${l.id}`);
    continue;
  }
  const plan = r.tts.map((t) => ({ gap: t.gap, parts: t.parts, ...(t.words ? { words: t.words } : {}), ...(t.cues.length ? { cues: t.cues } : {}) }));
  const key = sha(JSON.stringify({ v: AUDIO_VERSION, plan })).slice(0, 16);
  jobs.push({ id: l.id, key, out: `grammar/${l.id}.mp3`, beats: plan });
  const tp = join(TIMING, `${key}.json`);
  if (!existsSync(tp) || !existsSync(join(AUDIO, `${l.id}.mp3`))) continue;
  const t = JSON.parse(readFileSync(tp, "utf8"));
  const lesson = r.lesson;
  lesson.beats.forEach((b, i) => {
    const x = t.beats[i];
    b.start = x.start;
    b.end = x.end;
    if (b.k === "e" && x.timing) b.timing = fillTiming(x.timing, plan[i]?.words, x.start, x.end);
    if (b.k === "n" && x.cues) b.cues = x.cues;
  });
  lesson.audio = { src: `/audio/grammar/${l.id}.mp3`, v: t.v, duration: t.duration, fps: t.fps, mouth: t.mouth };
  // thứ tự khoá cố định: sec, b, start, end trước
  const json = JSON.stringify(lesson);
  done.push({ lesson, meta: r.meta, json, v: sha(json).slice(0, 10), warns: r.warns });
}
writeFileSync(MANIFEST, JSON.stringify(jobs));

// ---------- liên kết corpus ----------
const cp = corpus();
const builtIds = new Set(done.map((d) => d.lesson.id));
const MAXW = { a1: 14, a2: 16, b1: 22, b2: 26, c1: 32, c2: 36 };
function corpusLinks(meta) {
  const re = findRe(meta.find);
  if (!re) return [];
  const band = LEVELS.indexOf(meta.lv);
  const maxBand = Math.max(band, 1) + (band <= 1 ? 1 : 0);
  const hits = cp.filter((x) => x.band <= maxBand && re.test(x.en) && x.en.split(/\s+/).length >= 4 && x.en.split(/\s+/).length <= MAXW[meta.lv] && !/["“”]/.test(x.en));
  hits.sort((a, b) => Math.abs(a.band - band) - Math.abs(b.band - band) || b.focus - a.focus || a.en.length - b.en.length);
  const out = [];
  for (const type of ["video", "story", "reading"]) {
    const h = hits.find((x) => x.type === type && !out.some((o) => o.id === x.id));
    if (h) out.push(h);
  }
  for (const h of hits) if (out.length < 3 && !out.includes(h) && !out.some((o) => o.id === h.id)) out.push(h);
  return out.slice(0, 3).map(({ type, id, level, title, en }) => ({ type, id, level, title, en }));
}
// học liệu → bài ngữ pháp nổi bật trong đó (≤3): mẫu gặp ≥2 lần (video: 1 lần trong câu trọng tâm), cấp bài ≤ cấp học
// liệu và không thấp hơn quá 2 cấp; ưu tiên cấp gần, nhiều lần gặp.
function contentMap() {
  const byItem = new Map();
  for (const x of cp) byItem.set(x.id, [...(byItem.get(x.id) ?? []), x]);
  const res = new Map([...builtIds].map((id) => [id, findRe(C.byId.get(id).find)]).filter(([, r]) => r));
  const out = {};
  for (const [cid, sents] of byItem) {
    const band = sents[0].band;
    const scored = [];
    for (const [lid, re] of res) {
      const lb = LEVELS.indexOf(C.byId.get(lid).lv);
      if (lb > band || lb < band - 2) continue;
      const hit = sents.filter((s) => re.test(s.en));
      const focus = hit.filter((s) => s.focus).length;
      if (hit.length < 2 && !focus) continue;
      scored.push([lid, (hit.length + focus * 3) * (1 + (lb - band + 2) * 0.6)]);
    }
    scored.sort((a, b) => b[1] - a[1]);
    if (scored.length) out[cid] = scored.slice(0, 3).map(([id]) => id);
  }
  return out;
}

// ---------- chỉ mục ----------
const ref = (id) => builtIds.has(id);
const index = {
  cats: C.cats,
  lessons: done.map(({ lesson, meta, v }) => {
    const rel = REL.get(lesson.id);
    const corpusL = corpusLinks(meta);
    return {
      id: lesson.id,
      lv: lesson.lv,
      n: lesson.n,
      cat: lesson.cat,
      t: lesson.t,
      en: lesson.en,
      ...(lesson.reg ? { reg: lesson.reg } : {}),
      ...(lesson.kind ? { kind: lesson.kind } : {}),
      sum: lesson.sum,
      dur: lesson.audio.duration,
      ex: lesson.ex.length,
      v,
      pre: rel.pre.filter(ref),
      vs: rel.vs.filter(ref),
      rel: rel.rel.filter(ref),
      ...(corpusL.length ? { corpus: corpusL } : {}),
    };
  }),
  content: contentMap(),
};
for (const d of done) writeFileSync(join(LES, `${d.lesson.id}.json`), d.json);
writeFileSync(join(OUT, "index.json"), JSON.stringify(index));

// ---------- thẻ từ → bài ngữ pháp: từ khoá = chip tiếng Anh trên bảng công thức (dạng đích của bài) ----------
const V = loadVocab();
const wordRefs = {};
const GENERIC = new Set(["v", "v-ing", "v3", "to v", "noun", "adj"]);
for (const d of done) {
  const src = loadGrammarSource(paths.get(d.lesson.id).path);
  const chips = src.steps
    .filter((s) => s.kind === "step" && (s.key === "f" || s.key === "f2"))
    .flatMap((s) => [...s.body.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]))
    .flatMap((c) => c.split(/\s*[/,]\s*/))
    .map((c) => c.toLowerCase().replace(/[.…?!]+$/g, "").trim())
    .filter((c) => c && !GENERIC.has(c) && /^[a-z' -]+$/.test(c));
  const lemmas = new Set();
  for (const c of chips) {
    if (V.band.has(c)) lemmas.add(c);
    else if (!c.includes(" ")) {
      const l = lemmaOf(c);
      if (l) lemmas.add(l.lemma);
    }
  }
  for (const lm of lemmas) (wordRefs[lm] ??= []).push([d.lesson.id, d.lesson.lv, d.lesson.t]);
}
for (const k of Object.keys(wordRefs)) wordRefs[k] = wordRefs[k].slice(0, 4);
writeFileSync(join(OUT, "word-refs.json"), JSON.stringify(wordRefs));

// ---------- dọn ----------
if (PRUNE) {
  let n = 0;
  for (const f of readdirSync(LES)) if (f.endsWith(".json") && !builtIds.has(f.slice(0, -5))) (rmSync(join(LES, f)), n++);
  const outs = new Set(jobs.map((j) => `${j.id}.mp3`));
  if (existsSync(AUDIO)) for (const f of readdirSync(AUDIO)) if (!outs.has(f)) (rmSync(join(AUDIO, f)), n++);
  const keys = new Set(jobs.map((j) => j.key));
  for (const f of readdirSync(TIMING)) if (!keys.has(f.replace(/\.json$/, ""))) (rmSync(join(TIMING, f)), n++);
  console.log(`dọn ${n} file không còn dùng`);
}

const missing = jobs.filter((j) => !builtIds.has(j.id));
const kb = done.reduce((s, d) => s + d.json.length, 0) / 1024;
if (!QUIET) for (const d of done) if (d.warns.length) console.log(`? ${d.lesson.id}: ${d.warns.length} cảnh báo`);
console.log(
  `ngữ pháp: ${done.length}/${C.lessons.length} bài xuất bản · ${failed} lỗi · audio thiếu ${missing.length}${missing.length ? ` (${missing.map((j) => j.id).slice(0, 8).join(" ")}${missing.length > 8 ? "…" : ""})` : ""} · JSON ${kb.toFixed(0)} KB · ${Object.keys(index.content).length} học liệu có liên kết`,
);
void GDIR;
void bandOfKey;
