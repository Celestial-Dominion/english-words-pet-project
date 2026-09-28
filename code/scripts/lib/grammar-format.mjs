// Định dạng nguồn bài Ngữ pháp (content/grammar/{cấp}/{id}.txt) — gọn để viết tay, không thoát ký tự như JSON.
// Chi tiết + ví dụ: docs/ENGLISH_GRAMMAR_PLAYBOOK.md §7. Hàm ở đây CHỈ tách cấu trúc (dòng → bước); ý nghĩa, bảng,
// audio, kiểm nội dung là việc của grammar-model.mjs.
//
//   === present-simple                 ← id = tên file
//   sum: …  · form: công thức | nghĩa  · cast: mia leo · bg: kitchen · prop: mug x=900
//   words: work, live · gloss: … · names: Hanoi
//   (dòng trống)
//   #hook                               ← mở phần (SECTION_IDS); #practice = bài tập
//   > Lời giảng tiếng Việt, tiếng Anh chen giữa trong [[…]].
//   - English sentence with {target|k}. | Nghĩa Việt || ghi chú      ← câu ví dụ (bảng mới)
//   + …                                  ← câu ví dụ giữ bảng hiện tại (trục thời gian, cặp, bảng…)
//   mia: Hi! I'm Mia. | Chào! [happy wave]                          ← hội thoại (vai trong cast)
//   f: Chủ ngữ + [am / is / are] + tính từ || chú thích ·  f2: …   ← công thức (chip [..] = tiếng Anh)
//   vs: EN | VI || nhãn                  ← cặp đối chiếu (các dòng vs liền nhau = một bảng)
//   x: câu sai => câu đúng | VI >> lời giải thích                    ← lỗi thường gặp
//   ? Câu hỏi tiếng Việt => English answer | VI                      ← thử nhớ lại (tự dừng)
//   tl: -2..0 have lived | đã sống (tới giờ) · tl: now | bây giờ · tl: ~-1 was cooking | đang nấu
//   mv: You are a student . => Are you a student ?                  ← di chuyển từ
//   th: … | … · tb: … | … | …           ← bảng (th = hàng tiêu đề)
//   pron: I am | I'm | aɪm              ← phát âm (dạng viết | dạng nói | IPA)
//   rank: best | EN | VI                 ← tự nhiên hay không (best · ok · odd · bad)
//   // ghi chú — bỏ qua
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

export class GrammarFormatError extends Error {}

export const STEP_KEYS = ["f", "f2", "vs", "x", "tl", "mv", "th", "tb", "pron", "rank"];
export const EX_KINDS = ["fill", "contrast", "type", "choice", "natural", "fix", "transform", "order", "listen"];
const HEADER_KEYS = ["sum", "form", "cast", "bg", "prop", "words", "gloss", "names", "note"];
const MULTI = new Set(["form", "prop"]);

/** Mọi file nguồn bài: content/grammar/{a1…c2}/*.txt → [{ id, level, path }]. */
export function listGrammarSources(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const lv of ["a1", "a2", "b1", "b2", "c1", "c2"]) {
    const d = join(dir, lv);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).sort()) if (f.endsWith(".txt")) out.push({ id: basename(f, ".txt"), level: lv, path: join(d, f) });
  }
  return out;
}

/** "EN | VI" → { en, vi } (null nếu sai). Chỉ tách ở " | " đầu tiên. */
export function splitEnVi(s) {
  const k = s.indexOf(" | ");
  if (k < 0) return null;
  const en = s.slice(0, k).trim();
  const vi = s.slice(k + 3).trim();
  if (!en || !vi) return null;
  return { en, vi };
}

// " || " tách phần phụ (ghi chú / nhãn / lời giải thích) ở cuối dòng.
export function splitTail(s) {
  const k = s.indexOf(" || ");
  return k < 0 ? [s.trim(), ""] : [s.slice(0, k).trim(), s.slice(k + 4).trim()];
}

// Chú thích cuối dòng "[happy nod ipa=used:just pause=0.8]" → { body, ann } (ann = chuỗi bên trong, có thể rỗng).
export function splitAnn(s) {
  const m = /\s*\[([^[\]]*)\]\s*$/.exec(s);
  if (!m || /\[\[/.test(s.slice(m.index))) return { body: s.trim(), ann: "" };
  return { body: s.slice(0, m.index).trim(), ann: m[1].trim() };
}

/** Phương án "a / b* / c" → { o: [...], a: [chỉ số đúng] }. Dấu * cuối phương án = đáp án đúng. */
export function parseOptions(s) {
  const o = [];
  const a = [];
  for (const raw of s.split(" / ")) {
    const t = raw.trim();
    if (!t) continue;
    if (t.endsWith("*")) {
      a.push(o.length);
      o.push(t.slice(0, -1).trim());
    } else o.push(t);
  }
  return { o, a };
}

/**
 * Đọc một file nguồn → { id, header, steps: [{ n, kind, … }], ex: [{ n, kind, … }] }.
 * kind của bước: sec · narr · line (+keep) · talk · step (key: f, vs, x, …) · quiz.
 */
export function parseGrammarSource(text, file = "") {
  const lines = text.replace(/\r/g, "").split("\n");
  const fail = (n, msg) => {
    throw new GrammarFormatError(`${file}:${n}: ${msg}`);
  };
  let id = null;
  const header = {};
  const steps = [];
  const ex = [];
  let inHeader = false;
  let inPractice = false;
  lines.forEach((raw, i) => {
    const n = i + 1;
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || line.trimStart().startsWith("//")) {
      if (!line.trim()) inHeader = false;
      return;
    }
    const head = /^===\s+(\S+)\s*$/.exec(line);
    if (head) {
      if (id) fail(n, "mỗi file chỉ một bài (=== thứ hai)");
      id = head[1];
      inHeader = true;
      return;
    }
    if (!id) fail(n, "thiếu dòng '=== id' ở đầu file");
    if (inHeader) {
      const m = /^([a-z]+):\s*(.*)$/.exec(line);
      if (m && HEADER_KEYS.includes(m[1])) {
        if (MULTI.has(m[1])) (header[m[1]] ??= []).push({ value: m[2], n });
        else if (header[m[1]] !== undefined) fail(n, `header lặp: ${m[1]}`);
        else header[m[1]] = m[2];
        return;
      }
      inHeader = false;
    }
    const sec = /^#([a-z]+)\s*$/.exec(line);
    if (sec) {
      if (sec[1] === "practice") inPractice = true;
      else {
        if (inPractice) fail(n, "phần bài giảng phải đứng trước #practice");
        steps.push({ n, kind: "sec", sec: sec[1] });
      }
      return;
    }
    if (inPractice) {
      const m = /^([a-z]+):\s*(.*)$/.exec(line);
      if (!m || !EX_KINDS.includes(m[1])) fail(n, `bài tập lạ (cần ${EX_KINDS.join(" | ")}): ${line.slice(0, 60)}`);
      ex.push({ n, kind: m[1], body: m[2].trim() });
      return;
    }
    if (line.startsWith("> ")) return steps.push({ n, kind: "narr", text: line.slice(2).trim() });
    if (line.startsWith("- ") || line.startsWith("+ ")) return steps.push({ n, kind: "line", keep: line[0] === "+", body: line.slice(2).trim() });
    if (line.startsWith("? ")) return steps.push({ n, kind: "quiz", body: line.slice(2).trim() });
    const m = /^([a-z][a-z0-9-]*):\s*(.*)$/.exec(line);
    if (m) {
      if (STEP_KEYS.includes(m[1])) return steps.push({ n, kind: "step", key: m[1], body: m[2].trim() });
      return steps.push({ n, kind: "talk", who: m[1], body: m[2].trim() });
    }
    fail(n, `dòng không hiểu: ${line.slice(0, 70)}`);
  });
  if (!id) fail(1, "file rỗng");
  return { id, header, steps, ex };
}

export function loadGrammarSource(path) {
  return parseGrammarSource(readFileSync(path, "utf8"), path.replace(/^.*content\//, "content/"));
}

// ---- mảnh nhỏ dùng chung ----

// "I {am|k} {tired|c}." → { text: "I am tired.", hl: [[2,4,"k"],[5,10,"c"]] } (vai mặc định k).
export function parseMarks(raw) {
  const hl = [];
  let s = "";
  let last = 0;
  for (const m of raw.matchAll(/\{([^{}|]+)(?:\|([a-z]))?\}/g)) {
    s += raw.slice(last, m.index);
    hl.push([s.length, s.length + m[1].length, m[2] ?? "k"]);
    s += m[1];
    last = m.index + m[0].length;
  }
  s += raw.slice(last);
  return { text: s, hl };
}

// Lời giảng: "Ta dùng [[am]] với [[I]]." → [{v:"Ta dùng "},{e:"am"},{v:" với "},{e:"I"},{v:"."}]
export function parseNarr(text) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    if (m.index > last) parts.push({ v: text.slice(last, m.index) });
    parts.push({ e: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ v: text.slice(last) });
  return parts.filter((p) => (p.v !== undefined ? p.v.length : p.e.length));
}

// Mốc trục thời gian: "-2..0 have lived | đã sống" · "~-1 was cooking | …" · "now | bây giờ" · "0 now".
export function parseTimeMark(body) {
  const [left, vi] = (() => {
    const k = body.indexOf(" | ");
    return k < 0 ? [body.trim(), ""] : [body.slice(0, k).trim(), body.slice(k + 3).trim()];
  })();
  const m = /^(~)?(now|-?\d+(?:\.\d+)?)(?:\.\.(-?\d+(?:\.\d+)?))?(?:\s+(.*))?$/.exec(left);
  if (!m) return null;
  const now = m[2] === "now";
  const at = now ? 0 : Number(m[2]);
  const to = m[3] !== undefined ? Number(m[3]) : undefined;
  const label = (m[4] ?? (now ? "now" : "")).trim();
  if (!label) return null;
  return { at, ...(to !== undefined ? { to } : {}), label, ...(vi ? { vi } : {}), ...(now ? { now: 1 } : {}), ...(m[1] ? { wave: 1 } : {}) };
}

// "You are a student ." → ["You","are","a","student","."] (dấu câu dính cuối từ tách riêng).
export function moveTokens(s) {
  return s
    .trim()
    .split(/\s+/)
    .flatMap((t) => {
      const m = /^(.*?[^.,!?;:])([.,!?;:]+)$/.exec(t);
      return m ? [m[1], m[2]] : [t];
    })
    .filter(Boolean);
}
