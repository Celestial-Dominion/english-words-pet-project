// Build thư viện học liệu: content/**.txt → public/data/library/** (docs/ENGLISH_CONTENT_PLAYBOOK.md §10).
//   node scripts/build-content.mjs [--force] [--prune]
// 1) kiểm (lỗi → dừng, trừ --force); 2) JSON từng bài + chỉ mục + word-refs; 3) manifest audio
// scripts/out/content-audio.json cho build-content-audio.py; 4) ghép mốc thời gian audio đã có
// (scripts/.content-audio/{key}.json). --prune: xoá JSON/MP3/timing không còn dùng.
// Quy trình đủ: npm run content:build  (= build → audio → build lại để ghép mốc).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runChecks } from "./check-content.mjs";
import { profileOf, ROOT } from "./lib/content-model.mjs";
import { LEVEL_KEYS, loadVocab, ipaOf } from "./lib/en-vocab.mjs";
import { SPEC, NARRATOR, minutesOf } from "./lib/content-spec.mjs";
import { lineTokens } from "../lib/video.ts";

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const PRUNE = args.includes("--prune");
const OUT = join(ROOT, "public", "data", "library");
const AUDIO = join(ROOT, "public", "audio", "library");
const TIMING = join(ROOT, "scripts", ".content-audio");
const MANIFEST = join(ROOT, "scripts", "out", "content-audio.json");

const sha = (s) => createHash("sha1").update(s).digest("hex");
const writeJson = (p, o) => writeFileSync(p, JSON.stringify(o));
for (const d of ["readings", "stories", "videos", "word-refs"]) mkdirSync(join(OUT, d), { recursive: true });
mkdirSync(TIMING, { recursive: true });

const { items, report, libErr } = runChecks();
const errs = [...libErr, ...[...report].flatMap(([id, r]) => r.e.map((e) => `${id}: ${e}`))];
if (errs.length) {
  console.log(errs.slice(0, 40).map((e) => "✗ " + e).join("\n"));
  console.log(`${errs.length} lỗi${FORCE ? " — --force: vẫn build" : " — dừng (npm run content:check để xem đủ)"}`);
  if (!FORCE) process.exit(1);
}

const v = loadVocab();
const band = (id) => v.band.get(id);
const cleanIpa = (w) => ipaOf(w);
const meaning = (id) => String(v.words.get(id)?.meaning_vi ?? "").trim();

// ---- audio: key theo nội dung + giọng; mốc có sẵn thì ghép ----
const jobs = [];
function passageJob(out, sentences, paras, level) {
  const job = { kind: "passage", voice: NARRATOR, rate: SPEC[level].rate, paras: paras.map((p, i) => sentences.slice(p, paras[i + 1] ?? sentences.length).map((s) => s.en)) };
  const key = sha(JSON.stringify(job)).slice(0, 16);
  jobs.push({ key, out, ...job });
  return key;
}
function timingOf(key) {
  const p = join(TIMING, `${key}.json`);
  if (!existsSync(p)) return null;
  const t = JSON.parse(readFileSync(p, "utf8"));
  return existsSync(join(AUDIO, t.file)) ? t : null;
}
const passageAudio = (key) => {
  const t = timingOf(key);
  return t ? { src: `/audio/library/${t.file}`, v: t.v, duration: t.duration, starts: t.starts, ends: t.ends } : undefined;
};

// Từ trọng tâm: từ ĐÚNG cấp bài có trong bài, theo thứ tự xuất hiện (tối đa 20).
function focusOf(m) {
  const out = [];
  for (const lemma of profileOf(m).counts.keys()) {
    if (band(lemma) !== m.band || out.length >= 20) continue;
    const w = v.words.get(lemma);
    if (!w) continue;
    out.push({ id: lemma, ipa: cleanIpa(lemma), vi: meaning(lemma) });
  }
  return out;
}

const order = (type) => {
  const list = items.filter((m) => m.type === type);
  const out = [];
  for (const lv of LEVEL_KEYS) list.filter((m) => m.level === lv).forEach((m, i) => out.push({ m, n: i + 1 }));
  return out;
};
const readings = order("reading");
const stories = order("story");
const videosAll = order("video");

// ---- Video: dựng lesson (audio ghép nếu đã build) ----
const storyN = new Map(stories.map(({ m, n }) => [m.id, n]));
const byId = new Map(items.map((m) => [m.id, m]));
const videoDocs = [];
for (const { m } of videosAll) {
  const cast = {};
  for (const [id, c] of Object.entries(m.cast)) {
    cast[id] = { name: c.name, look: c.look, x: c.x, ...(c.style ? { style: c.style } : {}), ...(c.from !== undefined ? { from: c.from } : {}), ...(c.until !== undefined ? { until: c.until } : {}), ...(c.call ? { call: c.call } : {}) };
  }
  const vrate = SPEC[m.level].video.rate;
  const job = {
    kind: "video",
    lines: m.lines.map((l) => ({
      voices: (Array.isArray(l.speaker) ? l.speaker : [l.speaker]).map((sp) => ({ voice: m.cast[sp].voice, rate: m.cast[sp].rate ?? vrate, pitch: m.cast[sp].pitch ?? "+0Hz" })),
      text: l.en,
      words: lineTokens(l.en).filter((t) => t.w >= 0).map((t) => t.t),
      same: false,
      ...(l.pause !== undefined ? { pause: l.pause } : {}),
    })),
  };
  job.lines.forEach((l, i) => (l.same = i > 0 && JSON.stringify(m.lines[i].speaker) === JSON.stringify(m.lines[i - 1].speaker)));
  const key = sha(JSON.stringify(job)).slice(0, 16);
  jobs.push({ key, out: `videos/${m.id}.mp3`, ...job });
  const t = timingOf(key);
  const lines = m.lines.map((l, i) => {
    const toks = lineTokens(l.en).filter((x) => x.w >= 0);
    const ipa = toks.map((x) => {
      const lw = x.t.toLowerCase();
      const o = l.ipaOverride?.[lw];
      if (o && o !== "=") return o;
      return cleanIpa(x.t);
    });
    const line = {
      speaker: l.speaker,
      en: l.en,
      vi: l.vi,
      ipa,
      start: t?.lines[i]?.start ?? 0,
      end: t?.lines[i]?.end ?? 0,
      ...(l.expression ? { expression: l.expression } : {}),
      ...(l.gesture ? { gesture: l.gesture } : {}),
      ...(l.react ? { react: l.react } : {}),
      ...(l.prop ? { prop: l.prop } : {}),
      ...(l.thoughtBubble ? { thoughtBubble: l.thoughtBubble } : {}),
      ...(l.visual ? { visual: l.visual } : {}),
      ...(t?.lines[i]?.timing ? { timing: t.lines[i].timing } : {}),
    };
    return line;
  });
  const words = m.words.map((w) => {
    if (w.free) return { en: w.en, ipa: lineTokens(w.en).filter((x) => x.w >= 0).map((x) => cleanIpa(x.t)).filter(Boolean).join(" "), vi: w.vi, ...(w.note ? { note: w.note } : {}) };
    return { id: w.en, en: w.en, ipa: cleanIpa(w.en), vi: meaning(w.en), level: band(w.en), ...(w.note ? { note: w.note } : {}) };
  });
  const focus = m.focus
    ? {
        title: m.focus.title,
        pattern: m.focus.pattern,
        explain: m.focus.explain,
        keys: m.focus.keys,
        lines: m.lines.map((l, i) => (m.focus.keys.some((k) => l.en.toLowerCase().includes(k.toLowerCase())) ? i : -1)).filter((i) => i >= 0),
        ...(m.focus.note ? { note: m.focus.note } : {}),
      }
    : undefined;
  const st = byId.get(m.source);
  const lesson = {
    id: m.id,
    level: m.level,
    n: storyN.get(m.source) ?? 999,
    title: m.title,
    summary: m.summary,
    ...(st ? { source: { type: "story", id: st.id, level: st.level, title: st.title } } : {}),
    scene: { background: m.scene.background, ...(m.scene.weather ? { weather: m.scene.weather } : {}), props: m.scene.props.map((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== "line"))) },
    cast,
    lines,
    words,
    ...(focus ? { focus } : {}),
    ...(t ? { audio: { src: `/audio/library/${t.file}`, v: t.v, duration: t.duration, fps: t.fps, mouth: t.mouth } } : {}),
  };
  videoDocs.push({ m, lesson, ready: !!t });
}
const videos = videoDocs.filter((x) => x.ready).sort((a, b) => a.m.band - b.m.band || a.lesson.n - b.lesson.n);
const readyVideo = new Set(videos.map((x) => x.m.id));

// ---- series (ladder) ----
const series = new Map();
for (const { m } of readings) if (m.series) (series.get(m.series.id) ?? series.set(m.series.id, []).get(m.series.id)).push(m);
for (const list of series.values()) list.sort((a, b) => a.series.order - b.series.order);
const link = (m) => m && { id: m.id, level: m.level, title_en: m.title.en };

// ---- ghi Reading ----
const wrote = { readings: new Set(), stories: new Set(), videos: new Set() };
const rIndex = [];
for (const { m, n } of readings) {
  const p = profileOf(m);
  const key = passageJob(`readings/${m.id}.mp3`, m.sentences, m.paras, m.level);
  const s = m.series ? series.get(m.series.id) : null;
  const k = s ? s.indexOf(m) : -1;
  const doc = {
    id: m.id,
    level: m.level,
    n,
    title: m.title,
    topic: m.topic,
    genre: m.genre,
    words: p.nWords,
    min: minutesOf(p.nWords, m.level),
    paras: m.paras,
    sentences: m.sentences.map(({ en, vi }) => ({ en, vi })),
    focus: focusOf(m),
    ...(s ? { series: { id: m.series.id, order: k + 1, count: s.length, ...(s[k - 1] ? { prev: link(s[k - 1]) } : {}), ...(s[k + 1] ? { next: link(s[k + 1]) } : {}) } } : {}),
    ...(passageAudio(key) ? { audio: passageAudio(key) } : {}),
  };
  writeJson(join(OUT, "readings", `${m.id}.json`), doc);
  wrote.readings.add(m.id);
  rIndex.push({ id: m.id, level: m.level, n, title_en: m.title.en, title_vi: m.title.vi, topic: m.topic, genre: m.genre, words: doc.words, min: doc.min, ...(m.series ? { series: m.series.id } : {}) });
}

// ---- ghi Story ----
const sIndex = [];
for (const { m, n } of stories) {
  const p = profileOf(m);
  const chapters = m.chapters.map((c, i) => {
    const key = passageJob(`stories/${m.id}-${i + 1}.mp3`, c.sentences, c.paras, m.level);
    const a = passageAudio(key);
    return { title: c.title, paras: c.paras, sentences: c.sentences.map(({ en, vi }) => ({ en, vi })), ...(a ? { audio: a } : {}) };
  });
  const vid = readyVideo.has(m.video) ? byId.get(m.video) : null;
  const doc = {
    id: m.id,
    level: m.level,
    n,
    title: m.title,
    topic: m.topic,
    summary: m.summary,
    words: p.nWords,
    min: minutesOf(p.nWords, m.level),
    chapters,
    focus: focusOf(m),
    ...(vid ? { video: { id: vid.id, title: vid.title } } : {}),
  };
  writeJson(join(OUT, "stories", `${m.id}.json`), doc);
  wrote.stories.add(m.id);
  sIndex.push({ id: m.id, level: m.level, n, title_en: m.title.en, title_vi: m.title.vi, topic: m.topic, summary: m.summary, chapters: chapters.length, words: doc.words, min: doc.min, ...(vid ? { video: vid.id } : {}) });
}

// ---- ghi Video (chỉ bài đã có audio) ----
const vIndex = [];
for (const { m, lesson } of videos) {
  writeJson(join(OUT, "videos", `${m.id}.json`), lesson);
  wrote.videos.add(m.id);
  vIndex.push({
    id: m.id,
    level: m.level,
    n: lesson.n,
    title: m.title,
    summary: m.summary,
    duration: lesson.audio.duration,
    lines: lesson.lines.length,
    cast: Object.keys(lesson.cast).length,
    ...(lesson.source ? { story: lesson.source.id } : {}),
    ...(lesson.focus ? { focus: lesson.focus.title } : {}),
  });
}

writeJson(join(OUT, "readings-index.json"), rIndex);
writeJson(join(OUT, "stories-index.json"), sIndex);
writeJson(join(OUT, "videos-index.json"), vIndex);

// ---- word-refs: lemma → "r12 s3 v5" (vị trí trong chỉ mục), tối đa 12, cấp thấp trước ----
const SHARDS = 8;
const shardOf = (id) => {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  return h % SHARDS;
};
const refs = new Map();
const addRefs = (m, code) => {
  for (const lemma of profileOf(m).counts.keys()) {
    if (!v.band.has(lemma)) continue;
    if (!refs.has(lemma)) refs.set(lemma, []);
    refs.get(lemma).push([m.band, code]);
  }
};
rIndex.forEach((r, i) => addRefs(byId.get(r.id), `r${i}`));
sIndex.forEach((s, i) => addRefs(byId.get(s.id), `s${i}`));
vIndex.forEach((x, i) => addRefs(byId.get(x.id), `v${i}`));
const shards = Array.from({ length: SHARDS }, () => ({ n: [rIndex.length, sIndex.length, vIndex.length], w: {} }));
for (const [lemma, list] of refs) {
  // ưu tiên: mỗi loại ít nhất 1 (nếu có), rồi cấp thấp trước
  list.sort((a, b) => a[0] - b[0]);
  const pick = [];
  for (const k of ["v", "s", "r"]) {
    const x = list.find((e) => e[1][0] === k);
    if (x) pick.push(x);
  }
  for (const e of list) if (pick.length < 12 && !pick.includes(e)) pick.push(e);
  pick.sort((a, b) => a[0] - b[0]);
  shards[shardOf(lemma)].w[lemma] = pick.map((e) => e[1]).join(" ");
}
shards.forEach((s, i) => writeJson(join(OUT, "word-refs", `${i}.json`), s));

// ---- manifest audio ----
mkdirSync(join(ROOT, "scripts", "out"), { recursive: true });
writeJson(MANIFEST, jobs);
const missing = jobs.filter((j) => !timingOf(j.key));

// ---- dọn ----
if (PRUNE) {
  let n = 0;
  for (const [dir, keep] of Object.entries(wrote))
    for (const f of readdirSync(join(OUT, dir))) if (f.endsWith(".json") && !keep.has(f.slice(0, -5))) {
        rmSync(join(OUT, dir, f));
        n++;
      }
  const outs = new Set(jobs.map((j) => j.out));
  for (const dir of ["readings", "stories", "videos"]) {
    const d = join(AUDIO, dir);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d))
      if (!outs.has(`${dir}/${f}`)) {
        rmSync(join(d, f));
        n++;
      }
  }
  const keys = new Set(jobs.map((j) => j.key));
  for (const f of readdirSync(TIMING))
    if (!keys.has(f.replace(/\.json$/, ""))) {
      rmSync(join(TIMING, f));
      n++;
    }
  console.log(`dọn ${n} file không còn dùng`);
}

console.log(
  `thư viện: ${rIndex.length} reading · ${sIndex.length} story · ${vIndex.length}/${videosAll.length} video có audio · audio thiếu ${missing.length}/${jobs.length} track`,
);
