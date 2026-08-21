// Bản .mjs của lib/levels.ts cho script node (node không import trực tiếp .ts).
// PHẢI khớp lib/levels.ts.
export const levelSlug = (level) =>
  ({ 0: "foundation", 1: "b1", 2: "b2", 3: "c1", 4: "c2" })[level] ?? "b1";

export const EXAMPLE_SHARDS = 8;
export function exampleShardOf(id) {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  return h % EXAMPLE_SHARDS;
}
