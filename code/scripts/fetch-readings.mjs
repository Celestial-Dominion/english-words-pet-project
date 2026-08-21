// Tải bài đọc thô từ nguồn MỞ rồi LỌC theo độ phủ từ vựng của từng cấp.
//   node scripts/fetch-readings.mjs [số bài wiki] [số bài wikinews]
// Nguồn:
//   - Simple English Wikipedia (CC BY-SA) — văn phong đơn giản, hợp B1–B2
//   - Wikinews (CC BY 2.5) — tin ngắn, hợp B2–C1
// Ra: scripts/out/readings-raw.json — [{src, url, title, sentences[], level, coverage}]
// Bước lọc chạy hoàn toàn bằng script (KHÔNG tốn agent): chỉ giữ bài mà ≥X% số từ nằm
// trong bộ từ lũy kế của cấp đó → giải luôn ràng buộc "từ vựng lũy kế" của graded reader.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { progress } from "./lib-progress.mjs";

const HERE = import.meta.dirname;
const DATA = join(HERE, "..", "public", "data");
const OUT = join(HERE, "out");

// `--business N` chỉ lấy Wikinews mảng kinh tế/doanh nghiệp (module Tiếng Anh công việc,
// plan mục 6): kho đọc phổ thông hiện có mới phủ 62% vốn từ BSL, phần thiếu toàn từ tài chính.
const BIZ_ARG = process.argv.find((a) => a.startsWith("--business"));
const BIZ_N = BIZ_ARG ? Number(BIZ_ARG.split("=")[1] ?? process.argv[process.argv.indexOf(BIZ_ARG) + 1] ?? 400) : 0;
// `--it N` — module Tiếng Anh CNTT: bài bách khoa + tin từ các category công nghệ, tag topic "it".
const IT_ARG = process.argv.find((a) => a.startsWith("--it"));
const IT_N = IT_ARG ? Number(IT_ARG.split("=")[1] ?? process.argv[process.argv.indexOf(IT_ARG) + 1] ?? 600) : 0;
const WIKI_N = BIZ_N || IT_N ? 0 : Number(process.argv[2] ?? 2000);
const NEWS_N = BIZ_N || IT_N ? 0 : Number(process.argv[3] ?? 500);

// ---- bộ từ lũy kế theo cấp ----
const levels = JSON.parse(readFileSync(join(DATA, "word-levels.json"), "utf8"));
const lemmaMap = JSON.parse(readFileSync(join(DATA, "lemma-map.json"), "utf8"));

/** Tập từ biết được ở cấp `lv` = bộ nền (0) + mọi cấp ≤ lv. */
function knownAt(lv) {
  const s = new Set();
  for (const [id, l] of Object.entries(levels)) if (l <= lv) s.add(id);
  return s;
}
const KNOWN = { 1: knownAt(1), 2: knownAt(2), 3: knownAt(3), 4: knownAt(4) };

const norm = (w) => w.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, "");
/** Từ này người học cấp lv có biết không? (qua lemma-map để bắt dạng chia) */
function isKnown(word, lv) {
  const w = norm(word);
  if (!w) return true; // dấu câu/số
  if (/^\d/.test(w)) return true;
  const set = KNOWN[lv];
  if (set.has(w)) return true;
  const lemma = lemmaMap[w];
  if (lemma && set.has(lemma)) return true;
  // sở hữu cách / rút gọn
  const base = w.split("'")[0];
  return set.has(base) || (lemmaMap[base] ? set.has(lemmaMap[base]) : false);
}

/** Tỉ lệ từ quen thuộc trong bài (bỏ qua từ viết hoa giữa câu = tên riêng). */
function coverage(sentences, lv) {
  let total = 0, ok = 0;
  for (const s of sentences) {
    const words = s.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const raw = words[i];
      const w = norm(raw);
      if (!w) continue;
      // tên riêng: viết hoa và KHÔNG đứng đầu câu → bỏ qua, người đọc không cần biết
      if (i > 0 && /^[A-Z]/.test(raw) && !/^[A-Z]+$/.test(raw)) continue;
      total++;
      if (isKnown(raw, lv)) ok++;
    }
  }
  return total ? ok / total : 0;
}

// ---- tách câu ----
// Viết tắt có dấu chấm ("U.S.", "Dr.", "Mt.") KHÔNG được coi là hết câu → che tạm bằng
// ký tự thay thế rồi khôi phục sau khi tách.
const ABBR = /\b(?:[A-Z]\.(?:[A-Z]\.)+|Mr|Mrs|Ms|Dr|Prof|St|Mt|Jr|Sr|vs|etc|approx|Inc|Ltd|Co|No|Fig|Ave|Rd)\./g;
function splitSentences(text) {
  const masked = text.replace(/\s+/g, " ").replace(ABBR, (m) => m.replace(/\./g, "\u0001"));
  return masked
    .split(/(?<=[.!?])\s+(?=[A-Z"'“])/)
    .map((s) => s.replace(/\u0001/g, ".").trim())
    .filter(Boolean);
}

// ---- tải ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wikimedia yêu cầu User-Agent nhận dạng được và KHÔNG bắn dồn dập — giãn nhịp + retry
// khi bị chặn (429/503) để không bị cắt giữa chừng.
const UA = "english-words-study-app/1.0 (personal learning project; contact via GitHub)";
let lastCall = 0;
async function api(base, params, attempt = 0) {
  const wait = 2500 - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const url = `${base}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) {
    if (attempt < 6) {
      await sleep(5000 * (attempt + 1));
      return api(base, params, attempt + 1);
    }
    throw new Error(`${res.status} ${url}`);
  }
  return res.json();
}

// Chủ đề đời sống (tinh thần "25 chủ đề" của truyện HSK) — bài random của Wikipedia phần lớn
// là tiểu sử/địa danh vô danh, đọc chán; lấy theo category cho nội dung đáng đọc.
const WIKI_CATEGORIES = [
  "Foods", "Drinks", "Animals", "Plants", "Sports", "Music", "Films", "Books",
  "Weather", "Human_body", "Health", "Education", "Transport", "Technology",
  "Computers", "Space", "Earth", "Environment", "Culture", "Holidays",
  "Clothing", "Buildings", "Games", "Occupations", "Family",
  // Đợt 2 (11/08/2026): 25 chủ đề đầu đã vét gần cạn — chạy thêm chỉ ra vài bài mới. Các
  // category dưới đây đã dò tồn tại và đủ bài trên Simple Wikipedia (≥10 bài hoặc subcategory).
  "Fruits", "Vegetables", "Meat", "Cooking", "Tea", "Coffee", "Rice",
  "Mammals", "Birds", "Fish", "Insects", "Trees", "Flowers",
  "Cities", "Countries", "Geography", "History", "Languages", "Religion", "Mathematics",
];

const BAD_TITLE = /^(List of|Index of|Timeline|Category:|File:|Template:|Wikipedia:|Help:|Special:|Portal:)/i;

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Bài + subcategory trực thuộc một category. */
async function categoryMembers(base, cat, limit = 500) {
  const d = await api(base, {
    action: "query", list: "categorymembers", cmtitle: `Category:${cat}`,
    cmnamespace: "0|14", cmlimit: String(limit),
  });
  const members = d.query?.categorymembers ?? [];
  return {
    pages: members.filter((m) => m.ns === 0).map((m) => m.title).filter((t) => !BAD_TITLE.test(t)),
    subs: members.filter((m) => m.ns === 14).map((m) => m.title.replace(/^Category:/, "")),
  };
}

/**
 * Lấy tiêu đề bài theo chủ đề, ĐỆ QUY 1 TẦNG vào subcategory — nhiều category gốc
 * ("Foods", "Sports") gần như chỉ chứa subcategory, không đệ quy thì chỉ lấy được vài bài.
 */
async function categoryTitles(base, n) {
  const per = Math.ceil(n / WIKI_CATEGORIES.length);
  const out = [];
  const seen = new Set();
  const catBar = progress(WIKI_CATEGORIES.length, "quét chủ đề");
  for (const cat of WIKI_CATEGORIES) {
    const got = [];
    try {
      const root = await categoryMembers(base, cat);
      got.push(...root.pages);
      // chưa đủ → moi thêm từ các subcategory (xáo để mỗi lần chạy ra bộ khác nhau)
      for (const sub of shuffle(root.subs)) {
        if (got.length >= per) break;
        try {
          const child = await categoryMembers(base, sub, 200);
          got.push(...child.pages);
        } catch { /* subcategory lỗi → bỏ qua */ }
      }
    } catch (e) {
      console.error(`  bỏ category ${cat}: ${e.message}`);
    }
    for (const t of shuffle(got).slice(0, per)) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    catBar.tick(1, `${cat} +${got.length} · tổng ${out.length}`);
  }
  catBar.done(`${out.length} tiêu đề từ ${WIKI_CATEGORIES.length} chủ đề`);
  return out.slice(0, n);
}

/** Wikinews: lấy bài mới nhất (tin thời sự, ngôn ngữ báo chí — hợp B2/C1). */
async function recentTitles(base, n) {
  const out = [];
  let cont;
  while (out.length < n) {
    const d = await api(base, {
      action: "query", list: "categorymembers", cmtitle: "Category:Published",
      cmnamespace: "0", cmlimit: "500", cmsort: "timestamp", cmdir: "desc",
      ...(cont ? { cmcontinue: cont } : {}),
    });
    const got = (d.query?.categorymembers ?? []).map((x) => x.title).filter((t) => !BAD_TITLE.test(t));
    if (!got.length) break;
    out.push(...got);
    cont = d.continue?.cmcontinue;
    if (!cont) break;
  }
  return out.slice(0, n);
}

/** Wikinews theo CHỦ ĐỀ kinh tế/doanh nghiệp (cho module Tiếng Anh công việc). */
// Wikinews chỉ có MỘT category kinh tế thật sự đông bài (đã kiểm: ~vài nghìn bài, phải phân
// trang); các tên khác (Finance, Banking, Companies…) không tồn tại trên wiki này.
const NEWS_BIZ_CATEGORIES = ["Economy and business"];
async function businessTitles(base, n) {
  const per = Math.ceil(n / NEWS_BIZ_CATEGORIES.length);
  const out = [];
  const seen = new Set();
  const bar = progress(NEWS_BIZ_CATEGORIES.length, "chủ đề business");
  for (const cat of NEWS_BIZ_CATEGORIES) {
    const got = [];
    let cont;
    try {
      while (got.length < per) {
        const d = await api(base, {
          action: "query", list: "categorymembers", cmtitle: `Category:${cat}`,
          cmnamespace: "0", cmlimit: "500", cmsort: "timestamp", cmdir: "desc",
          ...(cont ? { cmcontinue: cont } : {}),
        });
        const page = (d.query?.categorymembers ?? []).map((x) => x.title).filter((t) => !BAD_TITLE.test(t));
        if (!page.length) break;
        got.push(...page);
        cont = d.continue?.cmcontinue;
        if (!cont) break;
      }
    } catch (e) {
      console.error(`  bỏ category ${cat}: ${e.message}`);
    }
    for (const t of shuffle(got).slice(0, per)) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    bar.tick(1, `${cat} +${got.length} · tổng ${out.length}`);
  }
  bar.done(`${out.length} tiêu đề business`);
  return out.slice(0, n);
}

// ---- Module Tiếng Anh CNTT ----
// Category đã dò tồn tại + đủ bài (11/08/2026). Simple Wikipedia: bài bách khoa nền tảng;
// Wikinews Computing/Internet: tin công nghệ (ngôn ngữ báo chí, hợp B2+).
const IT_WIKI_CATEGORIES = [
  "Computer_science", "Software", "Internet", "Websites", "Video_games",
  "Operating_systems", "Programming_languages", "Artificial_intelligence",
  "Computer_hardware", "Mobile_phones", "Computer_security", "Databases", "Web_browsers",
];
const NEWS_IT_CATEGORIES = ["Computing", "Internet"];

/** Tiêu đề bài IT trên Simple Wikipedia (đệ quy 1 tầng subcategory như categoryTitles). */
async function itWikiTitles(base, n) {
  const per = Math.ceil(n / IT_WIKI_CATEGORIES.length);
  const out = [];
  const seen = new Set();
  const bar = progress(IT_WIKI_CATEGORIES.length, "chủ đề IT (wiki)");
  for (const cat of IT_WIKI_CATEGORIES) {
    const got = [];
    try {
      const root = await categoryMembers(base, cat);
      got.push(...root.pages);
      for (const sub of shuffle(root.subs)) {
        if (got.length >= per) break;
        try {
          const child = await categoryMembers(base, sub, 200);
          got.push(...child.pages);
        } catch { /* subcategory lỗi → bỏ qua */ }
      }
    } catch (e) {
      console.error(`  bỏ category ${cat}: ${e.message}`);
    }
    for (const t of shuffle(got).slice(0, per)) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    bar.tick(1, `${cat} +${got.length} · tổng ${out.length}`);
  }
  bar.done(`${out.length} tiêu đề IT wiki`);
  return out.slice(0, n);
}

/** Tin công nghệ trên Wikinews (mới nhất trước, phân trang như businessTitles). */
async function itNewsTitles(base, n) {
  const per = Math.ceil(n / NEWS_IT_CATEGORIES.length);
  const out = [];
  const seen = new Set();
  const bar = progress(NEWS_IT_CATEGORIES.length, "chủ đề IT (news)");
  for (const cat of NEWS_IT_CATEGORIES) {
    const got = [];
    let cont;
    try {
      while (got.length < per) {
        const d = await api(base, {
          action: "query", list: "categorymembers", cmtitle: `Category:${cat}`,
          cmnamespace: "0", cmlimit: "500", cmsort: "timestamp", cmdir: "desc",
          ...(cont ? { cmcontinue: cont } : {}),
        });
        const page = (d.query?.categorymembers ?? []).map((x) => x.title).filter((t) => !BAD_TITLE.test(t));
        if (!page.length) break;
        got.push(...page);
        cont = d.continue?.cmcontinue;
        if (!cont) break;
      }
    } catch (e) {
      console.error(`  bỏ category ${cat}: ${e.message}`);
    }
    for (const t of shuffle(got).slice(0, per)) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    bar.tick(1, `${cat} +${got.length} · tổng ${out.length}`);
  }
  bar.done(`${out.length} tiêu đề IT news`);
  return out.slice(0, n);
}

/** Lấy phần mở đầu (plaintext) của tối đa 20 bài mỗi lượt. */
async function extracts(base, titles) {
  const d = await api(base, {
    action: "query", prop: "extracts", explaintext: "1", exintro: "1",
    exsectionformat: "plain", titles: titles.join("|"),
  });
  return (d.query?.pages ?? []).filter((p) => p.extract).map((p) => ({ title: p.title, text: p.extract }));
}

async function harvest(base, srcName, count, urlOf, getTitles, onBatch) {
  process.stderr.write(`  ${srcName}: đang lấy danh sách bài…\n`);
  const titles = await getTitles(base, count);
  const docs = [];
  let skipped = 0;
  const p = progress(titles.length, srcName);
  for (let i = 0; i < titles.length; i += 20) {
    const chunk = titles.slice(i, i + 20);
    const batch = [];
    try {
      for (const d of await extracts(base, chunk)) {
        batch.push({ src: srcName, url: urlOf(d.title), title: d.title, sentences: splitSentences(d.text) });
      }
    } catch {
      skipped += chunk.length;
    }
    docs.push(...batch);
    // Lưu ngay từng lô: mỗi lượt gọi API cách nhau 2,5s nên một đợt tải kéo dài hàng chục phút.
    // Không checkpoint thì máy ngủ / lệnh bị kill là mất trắng công tải.
    if (batch.length) onBatch?.(batch);
    p.tick(chunk.length, `lấy được ${docs.length}${skipped ? ` · lỗi ${skipped}` : ""}`);
  }
  p.done(`${docs.length} bài${skipped ? ` (bỏ ${skipped} do lỗi mạng)` : ""}`);
  return docs;
}

// ---- chấm cấp + lọc ----
const MIN_SENT = 6, MAX_SENT = 16;
const THRESHOLD = { 1: 0.955, 2: 0.94, 3: 0.925, 4: 0.90 }; // cấp cao cho phép lạ nhiều hơn

function grade(doc) {
  const sentences = doc.sentences.slice(0, MAX_SENT);
  if (sentences.length < MIN_SENT) return null;
  // câu quá dài/quá ngắn → bỏ (khó đọc hoặc là mẩu vụn)
  const lens = sentences.map((s) => s.split(/\s+/).length);
  if (lens.some((n) => n > 40) || lens.some((n) => n < 4)) return null;
  // gán vào cấp THẤP NHẤT mà bài vẫn đạt ngưỡng độ phủ
  for (const lv of [1, 2, 3, 4]) {
    const cov = coverage(sentences, lv);
    if (cov >= THRESHOLD[lv]) return { ...doc, sentences, level: lv, coverage: Number(cov.toFixed(4)) };
  }
  return null;
}

const PATH = join(OUT, "readings-raw.json");

/** Gộp bài mới vào kho trên đĩa (tích luỹ qua nhiều lần chạy, khử trùng theo url). */
function saveInto(docs, topic) {
  const fresh = docs.map(grade).filter(Boolean).map((d) => (topic ? { ...d, topic } : d));
  const old = existsSync(PATH) ? JSON.parse(readFileSync(PATH, "utf8")) : [];
  const byUrl = new Map(old.map((d) => [d.url, d]));
  let added = 0;
  let retagged = 0;
  for (const d of fresh) {
    const cur = byUrl.get(d.url);
    if (!cur) {
      byUrl.set(d.url, d);
      added++;
    } else if (topic && !cur.topic) {
      // Bài đã nằm trong kho từ đợt fetch tổng (không nhãn) nay xuất hiện lại trong category
      // chuyên đề → GẮN NHÃN cho bản cũ (giữ nguyên bản dịch/level đã có).
      cur.topic = topic;
      retagged++;
    }
  }
  const all = [...byUrl.values()].sort((a, b) => a.level - b.level || b.coverage - a.coverage);
  writeFileSync(PATH, JSON.stringify(all, null, 1));
  return { added, retagged, total: all.length };
}

const main = async () => {
  if (BIZ_N) {
    console.error(`Tải ${BIZ_N} bài Wikinews mảng kinh tế/doanh nghiệp…`);
    const biz = await harvest("https://en.wikinews.org/w/api.php", "wikinews", BIZ_N,
      (t) => `https://en.wikinews.org/wiki/${encodeURIComponent(t.replace(/ /g, "_"))}`, businessTitles);
    const s = saveInto(biz, "business");
    const kept = JSON.parse(readFileSync(PATH, "utf8"));
    const byLevel = {};
    for (const d of kept.filter((x) => x.topic === "business")) byLevel[d.level] = (byLevel[d.level] ?? 0) + 1;
    console.error(`Tải ${biz.length} bài → +${s.added} mới · kho ${s.total} bài (business: ${kept.filter((x) => x.topic === "business").length})`);
    console.error(`Business theo cấp: ${[1, 2, 3, 4].map((l) => `${["", "B1", "B2", "C1", "C2"][l]}=${byLevel[l] ?? 0}`).join(" ")}`);
    return;
  }
  if (IT_N) {
    console.error(`Tải module CNTT: ${IT_N} bài wiki + ${IT_N} tin Wikinews…`);
    let itAdded = 0;
    let itRetagged = 0;
    const saveIt = (batch) => {
      const s = saveInto(batch, "it");
      itAdded += s.added;
      itRetagged += s.retagged;
    };
    // src PHẢI là "simplewiki"/"wikinews" đúng nguyên văn — prep-reading-batches chia pool và
    // reader chọn nhãn ghi công nguồn đều so sánh chuỗi này; phân biệt chuyên đề nằm ở `topic`.
    await harvest("https://simple.wikipedia.org/w/api.php", "simplewiki", IT_N,
      (t) => `https://simple.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_"))}`, itWikiTitles, saveIt);
    await harvest("https://en.wikinews.org/w/api.php", "wikinews", IT_N,
      (t) => `https://en.wikinews.org/wiki/${encodeURIComponent(t.replace(/ /g, "_"))}`, itNewsTitles, saveIt);
    const kept = JSON.parse(readFileSync(PATH, "utf8"));
    const it = kept.filter((x) => x.topic === "it");
    const byLevel = {};
    for (const d of it) byLevel[d.level] = (byLevel[d.level] ?? 0) + 1;
    console.error(`+${itAdded} bài mới · gắn nhãn lại ${itRetagged} bài sẵn có · kho ${kept.length} (IT: ${it.length})`);
    console.error(`IT theo cấp: ${[1, 2, 3, 4].map((l) => `${["", "B1", "B2", "C1", "C2"][l]}=${byLevel[l] ?? 0}`).join(" ")}`);
    return;
  }
  console.error(`Tải ${WIKI_N} bài Simple Wikipedia + ${NEWS_N} bài Wikinews…`);
  // CHECKPOINT sau MỖI LÔ 20 bài — chạy cả tiếng mà đứt giữa chừng thì vẫn giữ được phần đã tải.
  let added = 0;
  const save = (batch) => {
    added += saveInto(batch).added;
  };
  const wiki = await harvest("https://simple.wikipedia.org/w/api.php", "simplewiki", WIKI_N,
    (t) => `https://simple.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_"))}`, categoryTitles, save);
  console.error(`  ✓ simplewiki xong: ${wiki.length} bài tải về`);

  const news = await harvest("https://en.wikinews.org/w/api.php", "wikinews", NEWS_N,
    (t) => `https://en.wikinews.org/wiki/${encodeURIComponent(t.replace(/ /g, "_"))}`, recentTitles, save);

  const raw = [...wiki, ...news];
  const kept = JSON.parse(readFileSync(PATH, "utf8"));
  const byLevel = {};
  for (const d of kept) byLevel[d.level] = (byLevel[d.level] ?? 0) + 1;

  console.error(`Tải ${raw.length} bài → +${added} bài mới · kho hiện có ${kept.length} bài`);
  console.error(`Theo cấp: ${[1, 2, 3, 4].map((l) => `${["", "B1", "B2", "C1", "C2"][l]}=${byLevel[l] ?? 0}`).join(" ")}`);
  if (!existsSync(join(OUT, "readings-raw.json"))) process.exitCode = 1;
};

await main();
