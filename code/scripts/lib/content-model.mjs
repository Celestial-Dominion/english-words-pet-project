// Nạp toàn bộ nguồn học liệu (content/**.txt) → model chuẩn hoá cho check / coverage / build.
// Lỗi CẤU TRÚC (không đọc được) gom vào `errors` kèm file:dòng; lỗi NỘI DUNG để check-content lo.
import { join } from "node:path";
import { existsSync } from "node:fs";
import { listSources, parseFile, parseProse, parseChapters, parseDialogue, parseKv, splitPair, parseQuizFile, FormatError } from "./content-format.mjs";
import { profile, bandOfKey } from "./en-vocab.mjs";
import { EXPRESSIONS, GESTURES } from "../../lib/video.ts";

export const ROOT = join(import.meta.dirname, "..", "..");
export const CONTENT = join(ROOT, "content");
// Chỉ ba thư mục này là nguồn Thư viện — content/grammar (Ngữ pháp) và content/quiz (câu hỏi) có định dạng riêng.
export const LIBRARY_DIRS = ["readings", "stories", "videos"];
export const QUIZ_DIR = join(CONTENT, "quiz");

const list = (s) =>
  String(s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
// Thuật ngữ khai gloss: (được phép vượt cấp) — cụm nhiều từ tách thành từng từ.
const glossSet = (arr) => new Set(arr.flatMap((x) => [x, ...x.split(/\s+/)]).map((x) => x.toLowerCase()).filter(Boolean));
// Tên riêng: tên viết hoa ("Airport Road", "Leo") chỉ khớp token VIẾT HOA (khoá "^từ") — "the airport"
// thường vẫn là từ vựng; mục viết thường ("pho", "hola") khớp mọi kiểu chữ.
const nameSet = (arr) => {
  const out = new Set();
  for (const x of arr)
    for (const part of x.split(/[\s-]+/).filter(Boolean)) {
      const low = part.toLowerCase();
      out.add(/[A-Z]/.test(part) ? `^${low}` : low);
    }
  return out;
};

function num(v) {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/** Chú thích cuối lượt thoại → trường của VideoLine. */
export function parseAnnotations(ann, castIds) {
  const out = {};
  const bad = [];
  for (const tok of ann.split(/\s+/).filter(Boolean)) {
    if (EXPRESSIONS.includes(tok)) out.expression = tok;
    else if (GESTURES.includes(tok)) out.gesture = tok;
    else if (tok.startsWith("@")) out.prop = tok.slice(1);
    else if (tok.startsWith("~")) out.thoughtBubble = tok.slice(1);
    else if (/^pause=/.test(tok)) out.pause = Number(tok.slice(6));
    else if (/^lights=(on|off)$/.test(tok)) (out.visual ??= {}).lights = tok.slice(7);
    else if (/^fade=/.test(tok)) (out.visual ??= {}).fade = Number(tok.slice(5));
    else if (/^ipa=/.test(tok)) {
      out.ipaOverride ??= {};
      for (const pair of tok.slice(4).split(",")) {
        const k = pair.indexOf(":");
        if (k < 1) bad.push(tok);
        else out.ipaOverride[pair.slice(0, k).toLowerCase()] = pair.slice(k + 1);
      }
    } else if (/^[a-z][a-z0-9_]*:[a-z]+$/.test(tok) && castIds.has(tok.split(":")[0]) && EXPRESSIONS.includes(tok.split(":")[1])) {
      const [who, e] = tok.split(":");
      (out.react ??= {})[who] = e;
    } else bad.push(tok);
  }
  return { fields: out, bad };
}

// Nguồn mở (bài phỏng theo): "source: Tên gốc | tác giả, tuyển tập (năm)" + license: + source-url:.
function sourceOf(h) {
  if (!h.source && !h.license && !h["source-url"]) return undefined;
  const p = splitPair(h.source ?? "");
  return { title: p?.en ?? String(h.source ?? "").trim(), credit: p?.vi ?? "", license: h.license ?? "", url: h["source-url"] ?? "", raw: h.source ?? "" };
}
const seriesOf = (h) => {
  if (!h.series) return undefined;
  const [sid, sord] = String(h.series).split(/\s+/);
  return { id: sid, order: Number(sord) };
};

function normReading(it, fail) {
  const h = it.header;
  const title = splitPair(h.title ?? "");
  if (!title) fail(it.line, `thiếu/sai title "EN | VI"`);
  const { paras, sentences } = parseProse(it.body, fail);
  return {
    ...base(it),
    title,
    topic: h.topic,
    genre: h.genre,
    series: seriesOf(h),
    source: sourceOf(h),
    names: nameSet(list(h.names)),
    gloss: glossSet(list(h.gloss)),
    paras,
    sentences,
  };
}

function normStory(it, fail) {
  const h = it.header;
  const title = splitPair(h.title ?? "");
  if (!title) fail(it.line, `thiếu/sai title "EN | VI"`);
  const chapters = parseChapters(it.body, fail);
  return {
    ...base(it),
    title,
    topic: h.topic,
    genre: h.genre ?? "narrative",
    summary: h.summary ?? "",
    series: seriesOf(h),
    source: sourceOf(h),
    names: nameSet(list(h.names)),
    gloss: glossSet(list(h.gloss)),
    chapters,
    sentences: chapters.flatMap((c) => c.sentences),
    video: it.id.replace(/^st-/, "vd-"),
  };
}

function normVideo(it, fail) {
  const h = it.header;
  const title = splitPair(h.title ?? "");
  if (!title) fail(it.line, `thiếu/sai title "EN | VI"`);
  const cast = {};
  for (const { value, line } of h.cast ?? []) {
    const kv = parseKv(value);
    const key = kv._[0];
    if (!key || !/^[a-z][a-z0-9_]*$/.test(key)) fail(line, `cast: thiếu khoá vai chữ thường`);
    if (cast[key]) fail(line, `cast lặp: ${key}`);
    const style = {};
    for (const [k, v] of Object.entries(kv)) {
      if (!k.startsWith("style.")) continue;
      const sk = k.slice(6);
      style[sk] = v === "true" ? true : v === "false" ? false : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
    }
    cast[key] = {
      name: { en: kv.name ?? "", vi: kv.vi ?? kv.name ?? "" },
      look: kv.look,
      x: num(kv.x),
      voice: kv.voice,
      rate: kv.rate,
      pitch: kv.pitch,
      from: num(kv.from),
      until: num(kv.until),
      ...(kv._.includes("call") || kv["call.bg"] ? { call: kv["call.bg"] ? { bg: kv["call.bg"] } : {} } : {}),
      ...(Object.keys(style).length ? { style } : {}),
      line,
    };
  }
  const props = [];
  for (const { value, line } of h.prop ?? []) {
    const kv = parseKv(value);
    props.push({
      id: kv._[0],
      x: num(kv.x),
      ...(kv.y !== undefined ? { y: num(kv.y) } : {}),
      ...(kv._.includes("back") ? { back: true } : {}),
      ...(kv.scale !== undefined ? { scale: num(kv.scale) } : {}),
      ...(kv.from !== undefined ? { from: num(kv.from) } : {}),
      ...(kv.until !== undefined ? { until: num(kv.until) } : {}),
      line,
    });
  }
  const [background, weather] = String(h.scene ?? "").split(/\s+/);
  const castIds = new Set(Object.keys(cast));
  const lines = parseDialogue(it.body, fail).map((l) => {
    const { fields, bad } = parseAnnotations(l.ann, castIds);
    return { ...l, ...fields, badAnn: bad };
  });
  // words: "lemma; lemma (ghi chú); cụm tự do = nghĩa"
  const words = String(h.words ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const eq = s.indexOf("=");
      if (eq > 0) return { en: s.slice(0, eq).trim(), vi: s.slice(eq + 1).trim(), free: true };
      const m = /^(.*?)\s*\((.*)\)$/.exec(s);
      return m ? { en: m[1].trim(), note: m[2].trim() } : { en: s };
    });
  return {
    ...base(it),
    title,
    source: h.source,
    summary: h.summary ?? "",
    scene: { background, ...(weather ? { weather } : {}), props },
    cast,
    names: nameSet([...list(h.names), ...Object.values(cast).map((c) => c.name.en)]),
    gloss: glossSet(list(h.gloss)),
    words,
    focus: h.focus
      ? {
          title: h.focus,
          pattern: h.pattern ?? "",
          explain: h.explain ?? "",
          keys: String(h.keys ?? "")
            .split(" / ")
            .map((s) => s.trim())
            .filter(Boolean),
          note: h.note,
        }
      : undefined,
    lines,
    sentences: lines.map((l) => ({ en: l.en, vi: l.vi, line: l.line })),
  };
}

function base(it) {
  return { id: it.id, type: it.type, level: it.level, band: bandOfKey(it.level), file: it.file, line: it.line, header: it.header };
}

/** Nạp thư viện. Trả { items, errors } — items giữ thứ tự file (thứ tự trong cấp = thứ tự viết). */
export function loadLibrary(dir = CONTENT) {
  const items = [];
  const errors = [];
  if (!existsSync(dir)) return { items, errors };
  const files = LIBRARY_DIRS.map((d) => join(dir, d))
    .filter((d) => existsSync(d))
    .flatMap((d) => listSources(d));
  for (const f of files) {
    let parsed;
    try {
      parsed = parseFile(f, ROOT);
    } catch (e) {
      if (e instanceof FormatError) {
        errors.push(e.message);
        continue;
      }
      throw e;
    }
    for (const it of parsed) {
      const fail = (line, msg) => {
        throw new FormatError(`${it.file}:${line}: [${it.id}] ${msg}`);
      };
      try {
        const m = it.type === "reading" ? normReading(it, fail) : it.type === "story" ? normStory(it, fail) : normVideo(it, fail);
        items.push(m);
      } catch (e) {
        if (e instanceof FormatError) errors.push(e.message);
        else throw e;
      }
    }
  }
  return { items, errors };
}

/**
 * Nạp câu hỏi đọc hiểu (content/quiz/**.txt). Trả { blocks, errors }; khoá block: "id" (bài đọc) hoặc
 * "id#n" (chương n, 1-based) — trùng khoá thì block sau ghi vào `dupes`.
 */
export function loadQuizzes(dir = QUIZ_DIR) {
  const blocks = new Map();
  const errors = [];
  const dupes = [];
  if (!existsSync(dir)) return { blocks, errors, dupes };
  for (const f of listSources(dir)) {
    let parsed;
    try {
      parsed = parseQuizFile(f, ROOT);
    } catch (e) {
      if (e instanceof FormatError) {
        errors.push(e.message);
        continue;
      }
      throw e;
    }
    for (const b of parsed) {
      const key = b.ch ? `${b.id}#${b.ch}` : b.id;
      if (blocks.has(key)) dupes.push({ key, a: blocks.get(key), b });
      else blocks.set(key, b);
    }
  }
  return { blocks, errors, dupes };
}

const PROFILE = new WeakMap();
/** Hồ sơ từ vựng của item (cache). */
export function profileOf(m) {
  let p = PROFILE.get(m);
  if (!p) {
    p = profile(
      m.sentences.map((s) => s.en),
      { names: m.names, level: m.band },
    );
    // Từ khai `gloss:` (thuật ngữ cần thiết, có chú giải) không tính là vượt cấp.
    p.over = p.over.filter((o) => !m.gloss.has(o.lemma) && !m.gloss.has(o.t.toLowerCase()));
    PROFILE.set(m, p);
  }
  return p;
}

export const wordsOf = (m) => profileOf(m).nWords;
