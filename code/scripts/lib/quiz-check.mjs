// Kiểm câu hỏi đọc hiểu (content/quiz/**.txt) — docs/ENGLISH_CONTENT_PLAYBOOK.md §8b.
// Luật (✗ = lỗi chặn build, ! = cảnh báo):
//   ✗ 3–4 câu / bài đọc hoặc chương; mỗi câu đúng 4 phương án, đúng MỘT dòng "+"; phương án không trùng;
//     câu hỏi kết bằng "?"; có giải thích (>) chứa ít nhất một «trích dẫn» NGUYÊN VĂN câu trong bài/chương đó;
//     từ của câu hỏi + phương án ≤ cấp bài (từ/tên/thuật ngữ đã có trong bài — với truyện: các chương đã đọc — thì
//     được dùng lại); độ dài câu hỏi / phương án ≤ mốc cấp; không "All/None of the above" (giao diện xáo phương án).
//   ! dịch câu hỏi không kết bằng "?", giải thích không có dấu tiếng Việt, đáp án đúng dài hẳn các phương án khác.
import { profile } from "./en-vocab.mjs";
import { SPEC } from "./content-spec.mjs";

const VI_LETTERS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
// phương án trỏ tới phương án khác ("All of the above", "None of these") vô nghĩa khi thứ tự bị xáo
const BANNED = /\bof the above\b|\ball the above\b|^(all|none|both|neither) of (these|them|the options)\W*$/i;
const words = (s) => s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
const normQ = (s) =>
  String(s)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const normOpt = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const tokenSet = (sentences) => new Set(sentences.flatMap((s) => s.en.toLowerCase().replace(/’/g, "'").match(/[a-z]+(?:'[a-z]+)*/g) ?? []));

/** «…» trong giải thích. */
export function quotesOf(why) {
  return [...String(why).matchAll(/«([^»]+)»/g)].map((m) => m[1].trim());
}

/** Trích dẫn có nằm nguyên văn trong một câu (hoặc hai câu liền nhau) của đoạn? */
export function quoteFound(quote, sentences) {
  const q = normQ(quote);
  if (!q) return false;
  const s = sentences.map((x) => normQ(x.en));
  for (let i = 0; i < s.length; i++) {
    if (s[i].includes(q)) return true;
    if (i + 1 < s.length && `${s[i]} ${s[i + 1]}`.includes(q)) return true;
  }
  return false;
}

// Đoạn mà câu hỏi bám vào: bài đọc = cả bài; truyện = chương n (trích dẫn) + các chương 1..n (từ được dùng lại).
function scopeOf(m, ch) {
  if (m.type === "reading") return { own: m.sentences, seen: m.sentences };
  const k = ch - 1;
  return { own: m.chapters[k]?.sentences ?? [], seen: m.chapters.slice(0, k + 1).flatMap((c) => c.sentences) };
}

const SEEN = new WeakMap();
function seenLemmas(m, ch, seen) {
  let byCh = SEEN.get(m);
  if (!byCh) SEEN.set(m, (byCh = new Map()));
  const key = ch ?? 0;
  if (!byCh.has(key)) {
    const p = profile(
      seen.map((s) => s.en),
      { names: m.names, level: m.band },
    );
    byCh.set(key, { lemmas: new Set(p.counts.keys()), tokens: tokenSet(seen) });
  }
  return byCh.get(key);
}

/**
 * Kiểm một block câu hỏi của item m (ch = số chương 1-based cho truyện). Trả {e:[], w:[], stats}.
 * stats.longest = số câu mà đáp án đúng dài hẳn (≥ 1,3×) mọi phương án sai — thống kê theo cấp.
 */
export function checkQuizBlock(block, m) {
  const e = [];
  const w = [];
  const stats = { questions: block.questions.length, longest: 0 };
  const at = block.ch ? `hỏi ch${block.ch}` : "hỏi";
  if (m.type === "story" && (block.ch < 1 || block.ch > m.chapters.length)) {
    e.push(`${at}: truyện chỉ có ${m.chapters.length} chương`);
    return { e, w, stats };
  }
  const spec = SPEC[m.level].quiz;
  const n = block.questions.length;
  if (n < 3 || n > 4) e.push(`${at}: ${n} câu hỏi (cần 3–4)`);
  const { own, seen } = scopeOf(m, block.ch);
  const allowed = seenLemmas(m, block.ch, seen);
  const qTexts = new Set();
  block.questions.forEach((q, i) => {
    const where = `${at} câu ${i + 1} (dòng ${q.line})`;
    const qn = normOpt(q.q.en);
    if (qTexts.has(qn)) e.push(`${where}: câu hỏi lặp`);
    qTexts.add(qn);
    if (!/\?\s*$/.test(q.q.en)) e.push(`${where}: câu hỏi phải kết bằng "?"`);
    if (!/\?\s*$/.test(q.q.vi)) w.push(`${where}: dịch câu hỏi nên kết bằng "?"`);
    if (q.opts.length !== 4) e.push(`${where}: ${q.opts.length} phương án (cần đúng 4)`);
    const ok = q.opts.filter((o) => o.ok).length;
    if (ok !== 1) e.push(`${where}: ${ok} phương án đúng (cần đúng 1 dòng "+")`);
    const keys = q.opts.map((o) => normOpt(o.en));
    if (new Set(keys).size !== keys.length) e.push(`${where}: phương án trùng nhau`);
    if (keys.includes(qn)) e.push(`${where}: phương án trùng câu hỏi`);
    for (const o of q.opts) if (BANNED.test(o.en)) e.push(`${where}: không dùng "${o.en}" (phương án được xáo)`);
    // độ dài theo cấp
    const qw = words(q.q.en);
    if (qw > spec.q) e.push(`${where}: câu hỏi ${qw} từ (mốc ≤ ${spec.q})`);
    for (const o of q.opts) {
      const ow = words(o.en);
      if (ow > spec.opt) e.push(`${where}: phương án "${o.en.slice(0, 40)}" ${ow} từ (mốc ≤ ${spec.opt})`);
      if (!VI_LETTERS.test(o.vi) && ow > 2 && !/^[\d\s.,:%$€£-]+$/.test(o.vi)) w.push(`${where}: dịch phương án "${o.vi}" không có dấu tiếng Việt?`);
    }
    // giải thích + trích dẫn nguyên văn
    if (!q.why) e.push(`${where}: thiếu giải thích (dòng "> …")`);
    else {
      if (!VI_LETTERS.test(q.why.replace(/«[^»]*»/g, ""))) w.push(`${where}: giải thích nên viết tiếng Việt`);
      const qs = quotesOf(q.why);
      if (!qs.length) e.push(`${where}: giải thích phải trích «nguyên văn» câu trong ${m.type === "story" ? "chương" : "bài"}`);
      for (const x of qs) if (!quoteFound(x, own)) e.push(`${where}: trích dẫn không khớp nguyên văn ${m.type === "story" ? `chương ${block.ch}` : "bài"}: «${x.slice(0, 60)}»`);
    }
    // từ vựng: ≤ cấp bài, hoặc đã có trong bài/chương đã đọc, tên riêng, thuật ngữ khai gloss:
    const p = profile([q.q.en, ...q.opts.map((o) => o.en)], { names: m.names, level: m.band });
    const over = p.over.filter((o) => !o.mwe && !allowed.lemmas.has(o.lemma) && !allowed.tokens.has(o.t.toLowerCase()) && !m.gloss.has(o.lemma) && !m.gloss.has(o.t.toLowerCase()));
    if (over.length) e.push(`${where}: từ vượt cấp ${[...new Set(over.map((o) => o.t))].join(" ")}`);
    const unk = [...new Set(p.unknown)].filter((t) => !allowed.tokens.has(t.toLowerCase().replace(/'s$/, "")) && !m.gloss.has(t.toLowerCase()));
    if (unk.length) e.push(`${where}: từ ngoài từ điển / tên chưa khai ${unk.join(" ")}`);
    // đáp án đúng dài hẳn các phương án sai → đoán được không cần đọc
    const right = q.opts.find((o) => o.ok);
    const wrong = q.opts.filter((o) => !o.ok);
    if (right && wrong.length && right.en.length >= 1.3 * Math.max(...wrong.map((o) => o.en.length)) && right.en.length > 12) stats.longest++;
  });
  return { e, w, stats };
}

/**
 * Kiểm toàn bộ câu hỏi so với thư viện. items = model (loadLibrary), quiz = loadQuizzes().
 * Trả { perItem: Map<id,{e,w}>, libErr, libWarn, coverage: {lv: {r, rAll, ch, chAll}} }.
 */
export function checkQuizzes(items, quiz, { requireQuiz = false } = {}) {
  const perItem = new Map();
  const R = (id) => {
    if (!perItem.has(id)) perItem.set(id, { e: [], w: [] });
    return perItem.get(id);
  };
  const libErr = [...quiz.errors];
  const libWarn = [];
  const byId = new Map(items.map((m) => [m.id, m]));
  for (const d of quiz.dupes) libErr.push(`câu hỏi khai 2 lần: ${d.key} (${d.a.file}:${d.a.line} · ${d.b.file}:${d.b.line})`);
  const longest = new Map(); // level → [longest, total]
  for (const [key, b] of quiz.blocks) {
    const m = byId.get(b.id);
    if (!m || m.type === "video") {
      libErr.push(`${b.file}:${b.line}: câu hỏi cho bài/truyện không tồn tại: ${key}`);
      continue;
    }
    const { e, w, stats } = checkQuizBlock(b, m);
    R(m.id).e.push(...e);
    R(m.id).w.push(...w);
    const s = longest.get(m.level) ?? [0, 0];
    longest.set(m.level, [s[0] + stats.longest, s[1] + stats.questions]);
  }
  const coverage = {};
  for (const m of items) {
    if (m.type === "video") continue;
    const c = (coverage[m.level] ??= { r: 0, rAll: 0, ch: 0, chAll: 0 });
    if (m.type === "reading") {
      c.rAll++;
      if (quiz.blocks.has(m.id)) c.r++;
      else if (requireQuiz) R(m.id).e.push("chưa có câu hỏi đọc hiểu (content/quiz/…)");
    } else {
      m.chapters.forEach((_, k) => {
        c.chAll++;
        if (quiz.blocks.has(`${m.id}#${k + 1}`)) c.ch++;
        else if (requireQuiz) R(m.id).e.push(`chương ${k + 1} chưa có câu hỏi đọc hiểu`);
      });
    }
  }
  for (const [lv, [a, t]] of longest) if (t >= 40 && a / t > 0.3) libWarn.push(`${lv} câu hỏi: ${a}/${t} câu có đáp án đúng dài hẳn phương án sai (> 30%) — cân lại độ dài phương án`);
  return { perItem, libErr, libWarn, coverage };
}
