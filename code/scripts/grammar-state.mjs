// Checkpoint sản xuất Ngữ pháp → .english-grammar-state.json (không commit). Tính từ file thật (nguồn, bài đã build,
// lỗi kiểm) nên mất ngữ cảnh chỉ cần: đọc docs/ENGLISH_GRAMMAR_PLAYBOOK.md → chạy lệnh này → làm tiếp bài "pending".
// Chạy: node scripts/grammar-state.mjs [--level a1] [--validated a1,a2]   (validated = các cấp đã qua review 3 vòng)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, LEVELS, curriculum, inventory, sourcePaths, buildLesson } from "./lib/grammar-model.mjs";

const arg = (k) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const P = join(ROOT, ".english-grammar-state.json");
const prev = existsSync(P) ? JSON.parse(readFileSync(P, "utf8")) : {};
const C = curriculum();
const paths = sourcePaths();
const idxPath = join(ROOT, "public", "data", "grammar", "index.json");
const built = new Set(existsSync(idxPath) ? JSON.parse(readFileSync(idxPath, "utf8")).lessons.map((l) => l.id) : []);
const failed = [];
for (const id of paths.keys()) if (buildLesson(id, { paths }).errors.length) failed.push(id);
const levelsDone = [...new Set([...(prev.validated ?? []), ...(arg("--validated")?.split(",").filter(Boolean) ?? [])])].filter((x) => LEVELS.includes(x));
const covered = new Set(C.lessons.filter((l) => built.has(l.id)).flatMap((l) => l.pts));
const state = {
  currentLevel: arg("--level") ?? C.lessons.find((l) => !built.has(l.id))?.lv ?? "done",
  planned: Object.fromEntries(LEVELS.map((lv) => [lv, C.lessons.filter((l) => l.lv === lv).length])),
  completed: C.lessons.filter((l) => built.has(l.id)).map((l) => l.id),
  validated: levelsDone,
  pending: C.lessons.filter((l) => !built.has(l.id)).map((l) => l.id),
  failed,
  uncovered: [...inventory().points.values()].filter((p) => !covered.has(p.id)).map((p) => p.id),
};
writeFileSync(P, JSON.stringify(state, null, 1));
console.log(`${state.currentLevel} · xong ${state.completed.length}/${C.lessons.length} · lỗi ${failed.length} · điểm chưa phủ ${state.uncovered.length} · cấp đã duyệt ${levelsDone.join(",") || "—"}`);
