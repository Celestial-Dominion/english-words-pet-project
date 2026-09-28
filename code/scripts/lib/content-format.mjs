// Định dạng nguồn học liệu (content/**.txt) — gọn để viết tay, không phải thoát ký tự như JSON.
//
//   === rd-b1-why-cities-flood          ← id: rd- bài đọc · st- truyện · vd- video; sau đó là cấp
//   title: Why Cities Flood | Vì sao thành phố bị ngập
//   topic: cities
//   genre: explanation
//   (dòng trống)
//   When heavy rain falls, … | Khi mưa lớn …     ← mỗi dòng một câu "EN | VI"
//   (dòng trống = sang đoạn mới)
//
// Truyện: "## Tên chương EN | Tên chương VI" mở chương. Video: "tom: EN | VI [chú thích]", người nói
// là khoá trong `cast:`; "tom+anna:" = đồng thanh. Dòng bắt đầu "//" là ghi chú, bị bỏ qua.
// Chi tiết trường: docs/ENGLISH_CONTENT_PLAYBOOK.md, docs/ENGLISH_VIDEO_PLAYBOOK.md.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { LEVEL_KEYS } from "./en-vocab.mjs";

export const TYPE_OF_PREFIX = { rd: "reading", st: "story", vd: "video" };
const ID_RE = /^(rd|st|vd)-(a1|a2|b1|b2|c1|c2)-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MULTI = new Set(["cast", "prop"]);

export class FormatError extends Error {}

/** Mọi file .txt dưới dir (đệ quy), sắp theo đường dẫn. */
export function listSources(dir) {
  const out = [];
  const walk = (d) => {
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith(".txt")) out.push(p);
    }
  };
  walk(dir);
  return out;
}

// "EN | VI" → {en, vi}; sai định dạng → null.
export function splitPair(s) {
  const k = s.indexOf(" | ");
  if (k < 0) return null;
  const en = s.slice(0, k).trim();
  const vi = s.slice(k + 3).trim();
  if (!en || !vi || vi.includes(" | ")) return null;
  return { en, vi };
}

// key=value (value có thể "trong ngoặc kép") + từ đơn (cờ).
export function parseKv(s) {
  const out = { _: [] };
  for (const m of s.matchAll(/([A-Za-z_.][\w.-]*)=("([^"]*)"|\S+)|(\S+)/g)) {
    if (m[4] !== undefined) out._.push(m[4]);
    else out[m[1]] = m[3] !== undefined ? m[3] : m[2];
  }
  return out;
}

/**
 * Đọc một file nguồn → [{id, type, level, header, body:[{line, text}], file, line}].
 * Không kiểm nội dung (việc của check-content), chỉ bắt lỗi cấu trúc.
 */
export function parseFile(path, root = process.cwd()) {
  const rel = relative(root, path);
  const lines = readFileSync(path, "utf8").replace(/\r/g, "").split("\n");
  const items = [];
  let cur = null;
  let inHeader = false;
  const fail = (n, msg) => {
    throw new FormatError(`${rel}:${n}: ${msg}`);
  };
  lines.forEach((raw, i) => {
    const n = i + 1;
    const line = raw.replace(/\s+$/, "");
    if (line.startsWith("//")) return;
    const head = /^===\s+(\S+)\s*$/.exec(line);
    if (head) {
      const id = head[1];
      if (!ID_RE.test(id)) fail(n, `id sai dạng: ${id} (rd|st|vd)-(a1…c2)-chữ-thường`);
      const [pre, level] = id.split("-");
      cur = { id, type: TYPE_OF_PREFIX[pre], level, header: {}, body: [], file: rel, line: n };
      items.push(cur);
      inHeader = true;
      return;
    }
    if (!cur) {
      if (line.trim()) fail(n, "nội dung trước dòng === id");
      return;
    }
    if (inHeader) {
      if (!line.trim()) {
        inHeader = false;
        return;
      }
      const kv = /^([a-z][a-z-]*):\s*(.*)$/.exec(line);
      if (!kv) {
        // Không có dòng trống sau header → coi như bắt đầu thân bài.
        inHeader = false;
      } else {
        const [, k, v] = kv;
        if (MULTI.has(k)) (cur.header[k] ??= []).push({ value: v, line: n });
        else {
          if (k in cur.header) fail(n, `trường lặp: ${k}`);
          cur.header[k] = v;
        }
        return;
      }
    }
    // names:/gloss: được phép đặt cả ở cuối bài (tiện khi viết) — gộp vào header.
    const late = /^(names|gloss):\s*(.*)$/.exec(line);
    if (late) {
      cur.header[late[1]] = [cur.header[late[1]], late[2]].filter(Boolean).join(", ");
      return;
    }
    cur.body.push({ line: n, text: line });
  });
  return items;
}

/** Thân bài đọc/chương → {paras: [chỉ số câu đầu đoạn], sentences: [{en, vi, line}]}. */
export function parseProse(body, fail) {
  const sentences = [];
  const paras = [];
  let fresh = true;
  for (const { line, text } of body) {
    if (!text.trim()) {
      fresh = true;
      continue;
    }
    const p = splitPair(text);
    if (!p) fail(line, `câu phải dạng "EN | VI": ${text.slice(0, 60)}`);
    if (fresh) paras.push(sentences.length);
    fresh = false;
    sentences.push({ ...p, line });
  }
  return { paras, sentences };
}

/** Thân truyện → chương [{title:{en,vi}, paras, sentences}]. */
export function parseChapters(body, fail) {
  const chapters = [];
  let buf = null;
  const flush = () => {
    if (buf) chapters.push({ title: buf.title, line: buf.line, ...parseProse(buf.body, fail) });
  };
  for (const b of body) {
    const m = /^##\s+(.*)$/.exec(b.text);
    if (m) {
      flush();
      const t = splitPair(m[1]);
      if (!t) fail(b.line, `tên chương phải dạng "## EN | VI"`);
      buf = { title: t, line: b.line, body: [] };
      continue;
    }
    if (!buf) {
      if (b.text.trim()) fail(b.line, "truyện phải mở bằng một dòng ## chương");
      continue;
    }
    buf.body.push(b);
  }
  flush();
  return chapters;
}

const SPEAKER_RE = /^([a-z][a-z0-9_]*(?:\+[a-z][a-z0-9_]*)*):\s+(.*)$/;

/**
 * Thân video → lượt thoại [{speaker, en, vi, ann, line}]. ann = chuỗi trong [...] cuối dòng
 * (biểu cảm, cử chỉ, @đạo-cụ, ~bong-bóng, ai:biểu-cảm, pause=, lights=, fade=, ipa=).
 */
export function parseDialogue(body, fail) {
  const out = [];
  for (const { line, text } of body) {
    if (!text.trim()) continue;
    const m = SPEAKER_RE.exec(text);
    if (!m) fail(line, `lượt thoại phải dạng "vai: EN | VI [chú thích]": ${text.slice(0, 60)}`);
    let rest = m[2];
    let ann = "";
    const a = /\s*\[([^\]]*)\]\s*$/.exec(rest);
    if (a) {
      ann = a[1].trim();
      rest = rest.slice(0, a.index);
    }
    const p = splitPair(rest);
    if (!p) fail(line, `lượt thoại thiếu " | " giữa EN và VI`);
    const sp = m[1].split("+");
    out.push({ speaker: sp.length > 1 ? sp : sp[0], ...p, ann, line });
  }
  return out;
}

export function levelIndex(key) {
  return LEVEL_KEYS.indexOf(key);
}
