// Dịch máy bản nháp tiếng Việt cho học liệu (docs/ENGLISH_CONTENT_PLAYBOOK.md §16) — người soạn chỉ viết tiếng Anh,
// máy điền tiếng Việt, người soạn đọc soát rồi sửa đúng dòng sai (xưng hô, thuật ngữ, giọng Bắc).
//
//   node scripts/content-mt.mjs fill <file>…   điền " | VI" cho mọi dòng còn thiếu trong bài đọc / truyện / câu hỏi:
//        · bài đọc, truyện: dòng câu, "title: EN", "## Chương EN", "summary: EN" (chưa có dấu tiếng Việt)
//        · câu hỏi: "? EN", "+ EN", "- EN"; "> ~cụm từ" → "> Bài đọc: «câu chứa cụm từ»" / "> Chương N: «…»"
//          (câu có ngoặc kép thì chỉ trích phần lời thoại chứa cụm từ). File câu hỏi phải điền SAU file bài.
//        Tên nhân vật: thêm dòng "// mt: Hippo=Hà Mã; Rabbit=Thỏ" trong file → thay tên trong câu tiếng Anh TRƯỚC khi gửi máy
//        (máy giữ nguyên tên Việt), để cả bài gọi nhân vật thống nhất. "// mt-vi: anh ấy=>cậu; Anh ấy=>Cậu" → thay trong bản
//        dịch SAU khi máy trả (xưng hô theo vai). File câu hỏi tự đọc cả hai dòng này từ file bài cùng tên.
//   node scripts/content-mt.mjs stub <file>…   như fill nhưng KHÔNG gọi máy: điền " | ~" (giữ chỗ) để chạy check-content ngay
//        trên bản tiếng Anh; "fill" sau đó dịch mọi dòng " | ~".
//   node scripts/content-mt.mjs vi <file>…     in "số-dòng|VI" của các dòng có bản dịch — để đọc soát cho gọn
//   node scripts/content-mt.mjs fix <file>     đọc stdin "số-dòng|VI mới" → thay phần tiếng Việt của đúng dòng đó
//
// Dịch bằng Google Translate (endpoint web công khai, không cần khoá) — mỗi lô ≤ 4.500 ký tự, các dòng nối bằng "\n"
// để máy thấy ngữ cảnh cả đoạn; lệch số dòng thì dịch lại từng dòng. Bản máy luôn phải đọc soát: hay sai xưng hô
// ("bạn", "anh ấy"), đổi số chữ thành số ("eleven" → "11"), dùng từ miền Nam ("chén", "trái").
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { tmpdir } from "node:os";
import { loadLibrary, ROOT } from "./lib/content-model.mjs";

const [cmd, ...files] = process.argv.slice(2);
const VI_MARK = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Giãn cách ≥ 3 giây giữa các lần gọi (kể cả giữa các lần chạy lệnh) để không bị chặn; bị chặn (429 / trang "Sorry")
// thì DỪNG ngay — không đổi endpoint, không thử dồn dập; chờ rồi chạy lại sau (bài vẫn để " | ~").
const STAMP = join(tmpdir(), "content-mt.stamp");
async function gtx(text) {
  let last = 0;
  try {
    last = Number(readFileSync(STAMP, "utf8")) || 0;
  } catch {}
  const wait = last + Number(process.env.CONTENT_MT_GAP ?? 3000) - Date.now();
  if (wait > 0) await sleep(wait);
  writeFileSync(STAMP, String(Date.now()));
  const res = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ q: text }),
  });
  if (res.status === 429) throw new Error("GIỚI HẠN: máy dịch đang chặn (429) — để nguyên ' | ~', chạy lại sau");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  return d[0].map((x) => x[0] ?? "").join("");
}

// Làm sạch bản máy: ngoặc kép cong → thẳng, khoảng trắng thừa, dấu câu dính.
function tidy(vi) {
  return vi
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Dịch danh sách câu (giữ thứ tự). Lô lệch số dòng → chia đôi; dòng máy trả nguyên tiếng Anh → để "~". */
async function translateChunk(chunk) {
  const got = (await gtx(chunk.join("\n"))).split("\n");
  if (got.length === chunk.length) return got.map(tidy);
  if (chunk.length === 1) return [tidy(got.join(" "))];
  const h = Math.ceil(chunk.length / 2);
  return [...(await translateChunk(chunk.slice(0, h))), ...(await translateChunk(chunk.slice(h)))];
}
export async function translateLines(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    let j = i;
    let len = 0;
    while (j < lines.length && (j === i || len + lines[j].length + 1 <= 4500)) len += lines[j++].length + 1;
    out.push(...(await translateChunk(lines.slice(i, j))));
    i = j;
  }
  return out.map((v, k) => (/[a-z]{3}/i.test(lines[k]) && v.toLowerCase() === lines[k].trim().toLowerCase() ? "~" : v));
}

// ---- nhận dạng dòng cần dịch ----
const isMeta = (t) => /^(\/\/|===|names:|gloss:|topic:|genre:|series:|source:|license:|source-url:|focus:|words:|level:)/.test(t);

function plan(lines, kind) {
  // → [{i, en, put(vi) → dòng mới}]
  const jobs = [];
  let inHeader = false;
  lines.forEach((raw, i) => {
    const t = raw.trimEnd();
    if (/^===\s/.test(t)) {
      inHeader = true;
      return;
    }
    if (inHeader && !t.trim()) {
      inHeader = false;
      return;
    }
    if (!t.trim() || isMeta(t)) return;
    const stubbed = / \| ~$/.test(t);
    const base = stubbed ? t.replace(/ \| ~$/, "") : t;
    if (kind === "quiz") {
      const m = /^([?+-]) (.*)$/.exec(base);
      if (m && !m[2].includes(" | ")) jobs.push({ i, en: m[2], put: (vi) => `${m[1]} ${m[2]} | ${vi}` });
      return;
    }
    if (stubbed) {
      const m = /^(title: |## )?(.*)$/.exec(base);
      jobs.push({ i, en: m[2], put: (vi) => `${m[1] ?? ""}${m[2]} | ${vi}` });
      return;
    }
    let m;
    if (/^summary:\s*~\s/.test(t)) {
      jobs.push({ i, en: t.replace(/^summary:\s*~\s*/, ""), put: (vi) => `summary: ${vi}` });
    } else if ((m = /^title:\s*(.*)$/.exec(t))) {
      if (!m[1].includes(" | ")) jobs.push({ i, en: m[1], put: (vi) => `title: ${m[1]} | ${vi}` });
    } else if ((m = /^summary:\s*(.*)$/.exec(t))) {
      if (!VI_MARK.test(m[1])) jobs.push({ i, en: m[1], put: (vi) => `summary: ${vi}` });
    } else if ((m = /^## (.*)$/.exec(t))) {
      if (!m[1].includes(" | ")) jobs.push({ i, en: m[1], put: (vi) => `## ${m[1]} | ${vi}` });
    } else if (!inHeader && !t.includes(" | ") && !/^[a-z][a-z-]*:/.test(t)) {
      jobs.push({ i, en: t.trim(), put: (vi) => `${t.trim()} | ${vi}` });
    }
  });
  return jobs;
}

// ---- câu hỏi: "> ~cụm" → trích nguyên văn câu trong bài / chương ----
let LIB = null;
function quoteFor(id, ch, phrase) {
  LIB ??= new Map(loadLibrary().items.map((m) => [m.id, m]));
  const m = LIB.get(id);
  if (!m) throw new Error(`không thấy bài ${id} (điền file bài trước, hoặc bài chưa đúng định dạng)`);
  const sents = ch ? m.chapters?.[ch - 1]?.sentences : m.sentences;
  if (!sents) throw new Error(`${id}: không có chương ${ch}`);
  const low = phrase.toLowerCase();
  const hit = sents.filter((s) => s.en.toLowerCase().includes(low));
  if (!hit.length) throw new Error(`${id}${ch ? " ch." + ch : ""}: không câu nào chứa "${phrase}"`);
  let q = hit[0].en;
  if (q.includes('"')) {
    const parts = [...q.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    const inQ = parts.find((p) => p.toLowerCase().includes(low));
    if (inQ) q = inQ.replace(/[,]$/, "");
    else
      q = q
        .split('"')
        .filter((_, k) => k % 2 === 0)
        .map((x) => x.trim())
        .find((x) => x.toLowerCase().includes(low)) ?? phrase;
  }
  return `> ${ch ? `Chương ${ch}` : "Bài đọc"}: «${q.trim()}»`;
}

function expandQuotes(lines) {
  let id = null;
  let ch = 0;
  const errs = [];
  const out = lines.map((t) => {
    const h = /^===\s+(\S+)(?:\s+(\d+))?\s*$/.exec(t);
    if (h) {
      id = h[1];
      ch = h[2] ? Number(h[2]) : 0;
      return t;
    }
    const q = /^>\s*~(.+)$/.exec(t);
    if (!q) return t;
    try {
      return quoteFor(id, ch, q[1].trim());
    } catch (e) {
      errs.push(e.message);
      return t;
    }
  });
  return { out, errs };
}

// "// mt: A=B; C=D" (trong file bài; file câu hỏi dùng chung với file bài cùng tên) → [[re, vi]]
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function nameMap(lines, key = "mt", sep = "=") {
  const out = [];
  for (const l of lines) {
    const m = new RegExp(`^//\\s*${key}:\\s*(.*)$`).exec(l);
    if (!m) continue;
    for (const pair of m[1].split(";")) {
      const [en, vi] = pair.split(sep).map((x) => x?.trim());
      if (en && vi) out.push([key === "mt" ? new RegExp(`\\b${esc(en)}\\b`, "g") : new RegExp(`(?<![\\p{L}])${esc(en)}(?![\\p{L}])`, "gu"), vi]);
    }
  }
  return out;
}

async function fill(file, stub = false) {
  const kind = /\/quiz\//.test(file) ? "quiz" : "text";
  let lines = readFileSync(file, "utf8").replace(/\r/g, "").split("\n");
  const jobs = plan(lines, kind);
  if (jobs.length) {
    let src = lines;
    if (kind === "quiz")
      for (const t of [file.replace("/quiz/", "/stories/"), file.replace("/quiz/", "/readings/")]) {
        try {
          src = src.concat(readFileSync(t, "utf8").split("\n"));
        } catch {}
      }
    const names = nameMap(src);
    const post = nameMap(src, "mt-vi", "=>");
    const vi = stub
      ? jobs.map(() => "~")
      : (await translateLines(jobs.map((j) => names.reduce((s, [re, v]) => s.replace(re, v), j.en)))).map((v) =>
          post.reduce((s, [re, r]) => s.replace(re, r), v),
        );
    jobs.forEach((j, k) => (lines[j.i] = /^summary:/.test(lines[j.i]) && vi[k] === "~" ? `summary: ~ ${j.en}` : j.put(vi[k])));
  }
  let errs = [];
  if (kind === "quiz") ({ out: lines, errs } = expandQuotes(lines));
  writeFileSync(file, lines.join("\n"));
  // ngoặc kép lẻ trên dòng → báo để sửa tay (bộ kiểm yêu cầu chẵn)
  const odd = jobs.filter((j) => ((lines[j.i].match(/"/g) ?? []).length % 2 === 1)).map((j) => j.i + 1);
  const left = lines.filter((l) => / \| ~$|^summary: ~ /.test(l)).length;
  console.log(`${relative(ROOT, file)}: ${stub ? "giữ chỗ" : "dịch"} ${jobs.length} dòng${left && !stub ? ` · còn ${left} dòng "~" (máy trả nguyên văn — dịch tay)` : ""}${odd.length ? ` · ngoặc kép lẻ ở dòng ${odd.join(", ")}` : ""}${errs.length ? `\n  LỖI trích: ${errs.join("\n  LỖI trích: ")}` : ""}`);
}

function show(file) {
  const lines = readFileSync(file, "utf8").split("\n");
  const out = [`# ${relative(ROOT, file)}`];
  lines.forEach((t, i) => {
    if (/^summary:/.test(t)) out.push(`${i + 1}|${t.slice(8).trim()}`);
    else if (/^>/.test(t)) return;
    else if (t.includes(" | ") && !isMeta(t)) out.push(`${i + 1}|${t.slice(t.indexOf(" | ") + 3)}`);
  });
  console.log(out.join("\n"));
}

async function fix(file) {
  const input = readFileSync(0, "utf8");
  const lines = readFileSync(file, "utf8").split("\n");
  let n = 0;
  for (const row of input.split("\n")) {
    const m = /^(\d+)\|(.*)$/.exec(row.trim());
    if (!m) continue;
    const i = Number(m[1]) - 1;
    const t = lines[i];
    if (t === undefined) throw new Error(`dòng ${m[1]} không có`);
    if (/^summary:/.test(t)) lines[i] = `summary: ${m[2].trim()}`;
    else if (t.includes(" | ")) lines[i] = `${t.slice(0, t.indexOf(" | "))} | ${m[2].trim()}`;
    else throw new Error(`dòng ${m[1]} chưa có bản dịch: ${t.slice(0, 60)}`);
    n++;
  }
  writeFileSync(file, lines.join("\n"));
  console.log(`${relative(ROOT, file)}: sửa ${n} dòng`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const paths = files.map((f) => resolve(f));
  if (cmd === "fill" || cmd === "stub")
    for (const f of paths) {
      try {
        await fill(f, cmd === "stub");
      } catch (e) {
        console.log(`${relative(ROOT, f)}: ${e.message}`);
        if (String(e.message).startsWith("GIỚI HẠN")) process.exit(2);
      }
    }
  else if (cmd === "vi") paths.forEach(show);
  else if (cmd === "fix") await fix(paths[0]);
  else {
    console.log("dùng: content-mt.mjs fill|vi|fix <file>…");
    process.exit(1);
  }
}
