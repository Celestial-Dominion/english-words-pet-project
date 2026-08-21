// Gắn nhãn TỪ VỰNG CÔNG VIỆC cho bộ từ. Ba lớp, vì không lớp nào một mình đủ:
//
//  1. BSL 1.01 (Business Service List, Browne & Culligan — CC BY-SA 4.0)
//     https://www.newgeneralservicelist.com/business-service-list
//     BSL được thiết kế để DÙNG KÈM NGSL nên nó cố tình BỎ các từ phổ thông; hệ quả là
//     "budget, revenue, profit, contract, market, supplier" không có trong BSL.
//  2. Độ đặc trưng theo CORPUS: từ xuất hiện trong kho bài đọc kinh tế của app dày hơn hẳn
//     trong kho phổ thông (lift ≥ 3, ≥5 lần) → lấp đúng phần lõi mà BSL bỏ.
//  3. Trừ từ NGOÀI LĨNH VỰC: BSL dựng từ corpus BÁO CHÍ kinh tế nên kéo theo cả vốn từ tội
//     phạm/chiến sự/thể thao ("rape", "assault", "ceasefire", "baseball"). Người học lọc
//     "Tiếng Anh công việc" mà thấy "rape" thì nhãn đó hỏng.
//
// Ra: public/data/topics/business.json + scripts/out/bsl-missing.json
// Chạy: node scripts/build-business.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const HERE = import.meta.dirname;
const OUT = join(HERE, "out");
const DATA = join(HERE, "..", "public", "data");
const SLUGS = ["foundation", "b1", "b2", "c1", "c2"];

const words = SLUGS.flatMap((s) => JSON.parse(readFileSync(join(DATA, "words", `${s}.json`), "utf8")));
const byId = new Map(words.map((w) => [w.id, w]));
const lemmaMap = JSON.parse(readFileSync(join(DATA, "lemma-map.json"), "utf8"));
const toLemma = (w) => (byId.has(w) ? w : lemmaMap[w] && byId.has(lemmaMap[w]) ? lemmaMap[w] : null);

// ---- 1. BSL ----
const bslLines = readFileSync(join(OUT, "bsl-101-lemmatized.txt"), "utf8").split(/\r?\n/).filter(Boolean);
const bslHeads = [...new Set(bslLines.map((l) => l.split(",")[0].trim().toLowerCase()).filter(Boolean))];
const fromBsl = new Set();
const missing = [];
for (const h of bslHeads) {
  const id = toLemma(h);
  if (id) fromBsl.add(id);
  else missing.push(h);
}

// ---- 2. độ đặc trưng theo corpus bài đọc ----
const MIN_HITS = 5;
const MIN_LIFT = 3;
const bizCount = new Map();
const genCount = new Map();
let bizTotal = 0;
let genTotal = 0;
for (const lv of ["b1", "b2", "c1", "c2"]) {
  const p = join(DATA, "readings", `${lv}.json`);
  if (!existsSync(p)) continue;
  for (const d of JSON.parse(readFileSync(p, "utf8"))) {
    const isBiz = d.topic === "business";
    for (const s of d.sentences) {
      for (const raw of s.en.toLowerCase().match(/[a-z']+/g) ?? []) {
        const id = toLemma(raw);
        if (!id) continue;
        if (isBiz) {
          bizCount.set(id, (bizCount.get(id) ?? 0) + 1);
          bizTotal++;
        } else {
          genCount.set(id, (genCount.get(id) ?? 0) + 1);
          genTotal++;
        }
      }
    }
  }
}
const fromCorpus = new Set();
for (const [id, c] of bizCount) {
  if (c < MIN_HITS) continue;
  if ((byId.get(id)?.level ?? 0) < 1) continue; // bỏ từ nền A1–A2 (the, yes, get…)
  const lift = (c / bizTotal) / (((genCount.get(id) ?? 0) + 1) / genTotal);
  if (lift >= MIN_LIFT) fromCorpus.add(id);
}

// ---- 3. trừ từ ngoài lĩnh vực ----
// CHỈ xét nghĩa CHÍNH (nghĩa đầu). Quét mọi nghĩa thì rụng oan: "developer" có nghĩa phụ
// "thuốc tráng phim", "campus" có nghĩa phụ nhắc nhà thờ.
const OFF_TOPIC =
  /\b(crime|criminal|murder|rape|assault|robbery|weapon|gun|bomb|soldier|army|militar|troops|\bwar\b|combat|ceasefire|terroris|religio|church|priest|pray|animal|bird|fish|insect|plant|flower|\btree\b|disease|virus|symptom|muscle|planet|galaxy|molecule|chemical|football|soccer|tennis|athlete|\bsport|\bmusic|\bsong\b|album|\bmovie|\bfilm\b|\bactor|poem|novel)/i;
// Lọc lần 2 theo NGHĨA TIẾNG VIỆT: định nghĩa kaikki của "rape"/"gang" không chứa từ khoá nào
// ở trên, nhưng nghĩa Việt thì gọi thẳng tên lĩnh vực.
// CẢNH BÁO: \b của JS tính theo ASCII nên "cá\b" khớp luôn trong "một cách chính xác"
// (ranh giới rơi vào giữa "á" và "c"). Phải dùng lookaround \p{L} với cờ u, và tránh các
// token quá ngắn dễ nằm lọt trong từ khác.
const OFF_TOPIC_VI = new RegExp(
  "(?<!\\p{L})(hiếp dâm|cưỡng hiếp|tội phạm|giết người|vũ khí|quân đội|binh lính|chiến tranh|ngừng bắn|khủng bố|băng nhóm|tôn giáo|nhà thờ|giáo sĩ|tu sĩ|cầu nguyện|thần thoại|axit|phân tử|hành tinh|thiên hà|côn trùng|bóng đá|quần vợt|vận động viên|ca khúc|bài hát|bộ phim|diễn viên|bài thơ|tiểu thuyết|biểu tình|ly khai|đảo chính|buôn lậu)(?!\\p{L})",
  "iu",
);
// Vài từ lọt cả hai lưới nhưng rõ ràng không phải tiếng Anh công việc.
const STOP = new Set(["casino", "convict", "lottery", "halo", "podcast", "tanker", "crude", "spill", "yes", "morale", "acid", "myth", "solar", "circuit", "commander", "senator", "parliament"]);
// Từ công việc LÕI mà cả BSL lẫn corpus đều bỏ sót (BSL bỏ vì trùng NGSL; corpus bài đọc là
// tin tức nên không phản ánh tiếng Anh văn phòng hằng ngày).
const CORE = [
  "budget", "market", "asset", "negotiate", "customer", "employee", "employer", "staff", "manager",
  "department", "meeting", "agenda", "deadline", "schedule", "salary", "wage", "hire", "recruit",
  "interview", "contract", "invoice", "payment", "refund", "discount", "order", "delivery",
  "warehouse", "stock", "brand", "campaign", "target", "forecast", "quarter", "annual", "proposal",
  "quote", "deal", "launch", "product", "service", "quality", "complaint", "warranty", "supplier",
  "client", "profit", "loss", "revenue", "cost", "expense", "tax", "fee", "loan", "debt", "interest",
  "invest", "investor", "share", "board", "director", "colleague", "team", "project", "task",
  "report", "presentation", "email", "office", "workplace", "overtime", "promotion", "resign",
  "retire", "training", "performance", "feedback", "policy", "procedure", "approval", "sign",
  "deadline", "priority", "workload", "shift", "leave", "benefit", "insurance", "pension",
];
const offTopic = (id) => {
  const w = byId.get(id);
  return STOP.has(id) || OFF_TOPIC.test((w?.meaning_en ?? [])[0] ?? "") || OFF_TOPIC_VI.test(w?.meaning_vi ?? "");
};

const fromCore = new Set(CORE.filter((id) => byId.has(id)));
const ids = [...new Set([...fromBsl, ...fromCorpus, ...fromCore])].filter((id) => !offTopic(id)).sort();

mkdirSync(join(DATA, "topics"), { recursive: true });
writeFileSync(
  join(DATA, "topics", "business.json"),
  JSON.stringify(
    {
      source:
        "Business Service List 1.01 by Browne, C. & Culligan, B. (CC BY-SA 4.0) + từ đặc trưng rút từ kho bài đọc kinh tế của app",
      ids,
    },
    null,
    0,
  ),
);
writeFileSync(join(OUT, "bsl-missing.json"), JSON.stringify(missing, null, 1));

const byLevel = {};
for (const id of ids) byLevel[byId.get(id).level] = (byLevel[byId.get(id).level] ?? 0) + 1;
const dropped = [...new Set([...fromBsl, ...fromCorpus, ...fromCore])].filter(offTopic);
console.error(
  `Nhãn công việc: ${ids.length} từ (BSL ${fromBsl.size} + corpus ${fromCorpus.size} + lõi ${fromCore.size}, loại ngoài lĩnh vực ${dropped.length})`,
);
console.error(
  `Theo cấp: nền ${byLevel[0] ?? 0} · B1 ${byLevel[1] ?? 0} · B2 ${byLevel[2] ?? 0} · C1 ${byLevel[3] ?? 0} · C2 ${byLevel[4] ?? 0} · BSL chưa có trong bộ: ${missing.length}`,
);
console.error(`Loại: ${dropped.slice(0, 15).join(", ")}${dropped.length > 15 ? "…" : ""}`);
