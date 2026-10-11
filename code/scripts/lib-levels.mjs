// Bản .mjs của lib/levels.ts cho script node (node không import trực tiếp .ts).
// PHẢI khớp lib/levels.ts.
// A1 (-1) và A2 (0) dùng CHUNG foundation.json — vòng lặp theo FILE chỉ cần duyệt 0..4.
export const levelSlug = (level) =>
  ({ [-1]: "foundation", 0: "foundation", 1: "b1", 2: "b2", 3: "c1", 4: "c2" })[level] ?? "b1";

export const EXAMPLE_SHARDS = 8;
export function exampleShardOf(id) {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  return h % EXAMPLE_SHARDS;
}
