// Thẻ từ → bài Ngữ pháp dạy từ đó như một dạng đích (must, although, used to…): public/data/grammar/word-refs.json
// (vài KB, build-grammar.mjs sinh từ chip tiếng Anh trên bảng công thức). Tải lười một lần khi mở thẻ từ đầu tiên.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export type GrammarWordRef = [id: string, lv: string, title: string];
let refs: Promise<Record<string, GrammarWordRef[]>> | null = null;

export function grammarRefsFor(lemma: string): Promise<GrammarWordRef[]> {
  refs ??= fetch(`${BASE}/data/grammar/word-refs.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, GrammarWordRef[]>>) : {}))
    .catch(() => {
      refs = null; // lỗi mạng → lần sau thử lại
      return {};
    });
  return refs.then((m) => m[lemma] ?? []);
}
