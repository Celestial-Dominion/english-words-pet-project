// Dựng danh sách câu hỏi cho một phiên ôn/học từ dữ liệu từ + ví dụ.
import type { Word, SrsConfig, ReviewRecord } from "./types";
import type { ExampleSentence } from "./data";
import { isLeech, cardStage } from "./srs";
import {
  knownRatio,
  rankByKnown,
  seededShuffle,
  meaningTooSimilar,
  selectDistinctExercises,
  spreadSameWord,
} from "./srs-pure";
import { lookalikeScore } from "./spell";
import { pickQuestionKind } from "./question-mix";

// Các dạng BÀI CHÍNH chấm FSRS. Điền câu là một kind riêng,
// không chấm lịch ôn để mỗi từ chỉ bị chấm đúng một lần trong một lượt.
export type McqMode = "meaning" | "reverse" | "listen";

export interface SentenceLexicon {
  lemmaMap: Readonly<Record<string, string>>;
  wordLevels: Readonly<Record<string, number>>;
}

export type Question =
  | { kind: "learn"; word: Word; graded: false; examples?: ExampleSentence[]; leech?: boolean }
  | {
      kind: "mcq";
      mode: McqMode;
      word: Word;
      graded: true;
      isNew: boolean;
      prompt: string; // meaning/listen: từ Anh · reverse: nghĩa VI
      options: string[];
      answer: number;
      exs?: ExampleSentence[]; // 1-2 câu ví dụ cho thẻ chi tiết SAU khi trả lời
    }
  | {
      kind: "cloze";
      word: Word;
      graded: false;
      options: string[];
      answer: number;
      clozeBefore: string;
      clozeAfter: string;
      clozeVi: string;
      clozeEn: string;
    }
  | {
      // gõ chính tả: nghe audio + đọc nghĩa VI → GÕ lại từ tiếng Anh (chấm FSRS như MCQ).
      // Ra từ thẻ ĐANG BỀN (growing: ≥3 lần gặp / bền ≥7 ngày) trở đi, tỉ trọng tăng khi chín:
      // nhận diện 4 phương án làm người học tưởng mình thuộc, gõ mới lộ.
      kind: "spell";
      word: Word;
      graded: true;
      isNew: boolean;
      vi: string;
      exs?: ExampleSentence[];
    }
  | { kind: "arrange"; word: Word; graded: false; en: string; vi: string; tokens: string[] };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Tách câu thành token để "sắp xếp câu" (giữ dấu câu dính vào từ).
export function tokenize(en: string): string[] {
  return en.trim().split(/\s+/);
}

// Giai đoạn khởi động: chưa đủ vốn từ thì TẮT hẳn bài ghép câu (tránh "đoán mù").
const ARRANGE_MIN_KNOWN = 40;

// Token trong câu ghép có "đã biết" không? Bỏ dấu câu; contraction (don't, I'm)
// coi như biết nếu phần TRƯỚC dấu ' đã học (do/I) — phần sau là đuôi rút gọn.
// targetToks: TỪNG token của chính từ đang học — id đa-từ ("used to", "according to",
// 585 id trong bộ từ) phải được so theo từng token, so nguyên chuỗi thì "used"≠"used to"
// và bài ghép câu KHÔNG BAO GIỜ ra cho toàn bộ nhóm từ này.
function tokenKnown(token: string, known: Set<string>, targetToks: Set<string>): boolean {
  const clean = token.toLowerCase().replace(/[^a-z'’-]/g, "");
  if (!clean) return true; // toàn dấu câu/số
  const core = clean.split(/['’]/)[0] || clean;
  return targetToks.has(core) || targetToks.has(clean) || known.has(core) || known.has(clean);
}

// Cận số token của câu ghép — dùng chung với /luyen-tap (đổi một nơi là cả hai theo).
export const ARRANGE_TOKENS = { min: 3, max: 12 } as const;

/** Bản sao câu MCQ với PHƯƠNG ÁN xáo lại (đáp án tính lại theo vị trí mới) — dùng khi chèn
 *  lại thẻ sai trong phiên: giữ nguyên thứ tự thì đáp án đúng (vừa được tô xanh lúc chữa bài)
 *  nằm y chỗ cũ, người học bấm theo TRÍ NHỚ VỊ TRÍ chứ không phải nhớ từ. */
export function reshuffleOptions(q: Question): Question {
  if (q.kind !== "mcq" && q.kind !== "cloze") return q; // spell/learn/arrange không có phương án
  const options = shuffle(q.options);
  return { ...q, options, answer: options.indexOf(q.options[q.answer]) };
}

/** Câu ví dụ đủ "vừa sức" để ra bài ghép: mọi từ (trừ chính từ đang học) đều đã học.
 *  Export cho cả trang Luyện tập tự do (/luyen-tap) dùng chung một luật. */
export function arrangeReady(tokens: string[], known: Set<string> | undefined, target: string): boolean {
  if (!known || known.size < ARRANGE_MIN_KNOWN) return false;
  const targetToks = new Set(target.toLowerCase().split(/\s+/));
  const unknown = tokens.filter((t) => !tokenKnown(t, known, targetToks)).length;
  return unknown === 0 || (tokens.length >= 8 && unknown <= 1); // câu dài cho phép lọt 1 từ lạ
}

// Chuẩn hoá token câu về lemma để "went" được tính là "go", "working" là
// "work". A1–A2 (level 0) là vốn nền của app B1–C2 nên luôn được tính là đã biết.
function sentenceLemmas(en: string, lexicon: SentenceLexicon): string[] {
  const out: string[] = [];
  for (const raw of tokenize(en)) {
    const surface = raw
      .toLowerCase()
      .replace(/^[^a-z'’-]+/u, "")
      .replace(/[^a-z'’-]+$/u, "")
      .replace(/’/g, "'");
    if (!surface || !/[a-z]/.test(surface)) continue;
    const base = surface.split("'")[0] || surface;
    out.push(lexicon.lemmaMap[surface] ?? lexicon.lemmaMap[base] ?? surface);
  }
  return out;
}

/** Tỉ lệ từ đã biết trong một câu, sau khi quy dạng biến hình về lemma. */
export function sentenceKnownRatio(
  en: string,
  learned: ReadonlySet<string>,
  target: string,
  lexicon: SentenceLexicon,
  foundation?: ReadonlySet<string>,
): number {
  const tokens = sentenceLemmas(en, lexicon);
  const targetTokens = new Set(sentenceLemmas(target, lexicon));
  const baseWords = foundation ?? new Set(
    Object.entries(lexicon.wordLevels).filter(([, level]) => level === 0).map(([id]) => id),
  );
  return knownRatio(tokens, learned, targetTokens, baseWords);
}

/** Nghĩa RÚT GỌN cho phương án trắc nghiệm (phần trước dấu ';') — đỡ ngợp. */
export function shortVi(w: Word): string {
  const s = w.meaning_vi.split(";")[0].trim();
  return s || w.meaning_vi;
}

// Phương án nhiễu: ưu tiên CÙNG loại từ (gây nhiễu tốt hơn), không trùng nghĩa nhau — như HSK.
// Nghĩa NA NÁ đáp án (meaningTooSimilar: "yêu; thích" vs "sở thích; yêu thích") cũng bị loại
// ở lượt chặt — câu hỏi mập mờ thì chọn đúng/sai do đoán chứ không do nhớ.
// Khi phương án hiển thị là TỪ tiếng Anh (nghĩa→từ, điền câu): ưu tiên tối đa 2 từ GẦN GIỐNG
// CHÍNH TẢ đáp án (affect/effect, adapt/adopt) — ép đọc kỹ mặt chữ thay vì nhận mẫu chữ đầu
// (bản tiếng Anh của distractor "giống hình" bên HSK; nghĩa vẫn phải khác hẳn mới được nhận).
function pickDistractors(word: Word, pool: Word[], n = 3, wordOptions = false): Word[] {
  const seen = new Set([shortVi(word)]);
  const out: Word[] = [];
  const lookalikes = wordOptions
    ? shuffle(
        pool
          .map((w) => ({ w, s: w.id === word.id || !w.meaning_vi ? 0 : lookalikeScore(word.id, w.id) }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s)
          .slice(0, 4) // nhóm giống nhất, xáo trong nhóm cho biến thiên giữa các phiên
          .map((x) => x.w),
      ).slice(0, 2)
    : [];
  const samePos = shuffle(pool.filter((w) => w.pos === word.pos));
  const rest = shuffle(pool);
  for (const w of [...lookalikes, ...samePos, ...rest]) {
    if (out.length >= n) break;
    if (w.id === word.id || !w.meaning_vi || out.includes(w)) continue;
    const key = shortVi(w);
    if (seen.has(key)) continue;
    if (meaningTooSimilar(w.meaning_vi, word.meaning_vi)) continue;
    seen.add(key);
    out.push(w);
  }
  // pool nhỏ / trùng nghĩa nhiều → lượt 2 nới điều kiện (chỉ cần khác đáp án) cho đủ 4 phương án
  if (out.length < n) {
    for (const w of rest) {
      if (out.length >= n) break;
      if (w.id === word.id || !w.meaning_vi || out.includes(w) || shortVi(w) === shortVi(word)) continue;
      out.push(w);
    }
  }
  return out;
}

/** MCQ nghĩa: hiện từ Anh → chọn nghĩa Việt đúng. */
function meaningFor(word: Word, pool: Word[], isNew: boolean): Question {
  const options = shuffle([shortVi(word), ...pickDistractors(word, pool).map(shortVi)]);
  return { kind: "mcq", mode: "meaning", word, graded: true, isNew, prompt: word.id, options, answer: options.indexOf(shortVi(word)) };
}

/** MCQ ngược: hiện nghĩa Việt → chọn từ Anh đúng. */
function reverseFor(word: Word, pool: Word[], isNew: boolean): Question {
  const options = shuffle([word.id, ...pickDistractors(word, pool, 3, true).map((w) => w.id)]);
  return { kind: "mcq", mode: "reverse", word, graded: true, isNew, prompt: shortVi(word), options, answer: options.indexOf(word.id) };
}

/** MCQ nghe: phát audio từ → chọn nghĩa Việt đúng. */
function listenFor(word: Word, pool: Word[], isNew: boolean): Question {
  const options = shuffle([shortVi(word), ...pickDistractors(word, pool).map(shortVi)]);
  return { kind: "mcq", mode: "listen", word, graded: true, isNew, prompt: word.id, options, answer: options.indexOf(shortVi(word)) };
}

// Tìm vị trí từ (nguyên từ, không phân biệt hoa thường) trong câu ví dụ để khoét chỗ trống.
// Quét TẤT CẢ vị trí xuất hiện, không chỉ vị trí đầu: "art" trong "The artist bought some art."
// có match đầu dính trong "artist" — bỏ qua và quét tiếp mới thấy "art" đứng độc lập ở sau.
function findWordInSentence(en: string, id: string): { before: string; after: string } | null {
  const low = en.toLowerCase();
  const needle = id.toLowerCase();
  const isLetter = (c: string | undefined) => !!c && /[a-z]/i.test(c);
  for (let idx = low.indexOf(needle); idx >= 0; idx = low.indexOf(needle, idx + 1)) {
    if (isLetter(en[idx - 1]) || isLetter(en[idx + id.length])) continue; // dính trong từ khác
    return { before: en.slice(0, idx), after: en.slice(idx + id.length) };
  }
  return null;
}

/** Bài phụ cloze: khoét từ khỏi một câu cụ thể, không chấm FSRS. */
function clozeForSentence(word: Word, sentence: ExampleSentence, pool: Word[]): Question | null {
  const cut = findWordInSentence(sentence.en, word.id);
  if (!cut) return null;
  const options = shuffle([word.id, ...pickDistractors(word, pool, 3, true).map((w) => w.id)]);
  return {
    kind: "cloze", word, graded: false,
    options, answer: options.indexOf(word.id),
    clozeBefore: cut.before, clozeAfter: cut.after, clozeVi: sentence.vi, clozeEn: sentence.en,
  };
}

/** Gõ chính tả: nghe + nghĩa VI → gõ từ. */
function spellFor(word: Word, isNew: boolean): Question {
  return { kind: "spell", word, graded: true, isNew, vi: shortVi(word) };
}

/**
 * Chọn dạng câu hỏi cho một thẻ. Tỉ trọng + việc bật/tắt từng dạng nằm ở lib/question-mix.ts
 * (hàm thuần, có unit test). Ở đây chỉ dựng câu hỏi tương ứng, và lùi về "nhớ lại" khi dạng bốc
 * được không dựng nổi. Điền câu không đi qua hàm này vì là đợt luyện riêng.
 */
function gradedFor(w: Word, pool: Word[], config: SrsConfig, isNew: boolean, rec?: ReviewRecord): Question {
  const recog = () => (config.direction === "vi2en" ? reverseFor(w, pool, isNew) : meaningFor(w, pool, isNew));
  const recall = () => (config.direction === "vi2en" ? meaningFor(w, pool, isNew) : reverseFor(w, pool, isNew));
  if (isNew || !rec || rec.reps <= 0) return recog();

  switch (pickQuestionKind(config, cardStage(rec))) {
    case "recog":
      return recog();
    case "listen":
      return listenFor(w, pool, isNew);
    case "spell":
      return spellFor(w, isNew);
    default:
      return recall();
  }
}

// XÁO TRỘN XEN KẼ (interleaving — như HSK 08/2026): không đi theo khối từng từ
// (học → hỏi → ghép câu liền nhau) mà trộn các đợt giữa MỌI từ trong phiên. Ràng
// buộc duy nhất: đợt "learn" (giới thiệu từ mới/leech) phải đứng TRƯỚC mọi đợt khác
// của chính từ đó — không thể hỏi từ chưa gặp mặt; ngoài ra trộn tự do. Interleaving
// nhớ tốt hơn blocking, và phiên bớt cảm giác lặp (hết cụm 3 câu liền một từ).
// Cách làm: mỗi đợt một khoá ngẫu nhiên, đợt learn nhận khoá NHỎ NHẤT của từ nó.
const SAME_WORD_GAP = 3;

function interleave(groups: Question[][], enabled: boolean): Question[] {
  if (!enabled) return groups.flat();
  const entries: { q: Question; key: number }[] = [];
  for (const g of groups) {
    const keys = g.map(() => Math.random());
    const learnIdx = g.findIndex((q) => q.kind === "learn");
    if (learnIdx >= 0) {
      const minIdx = keys.indexOf(Math.min(...keys));
      [keys[learnIdx], keys[minIdx]] = [keys[minIdx], keys[learnIdx]];
    }
    g.forEach((q, idx) => entries.push({ q, key: keys[idx] }));
  }
  return spreadSameWord(entries.sort((a, b) => a.key - b.key).map((e) => e.q), SAME_WORD_GAP);
}

/**
 * Dựng câu hỏi cho một tập từ trong phiên.
 * Từ MỚI: 1 thẻ "learn" (xem từ + nghĩa + ví dụ, không chấm) TRƯỚC khi kiểm tra —
 * không bị hỏi MCQ trên từ chưa từng thấy.
 * Từ HAY QUÊN (leech, quên ≥4 lần): cũng được 1 thẻ "learn" ôn lại kỹ (kèm ô mẹo nhớ) trước khi hỏi.
 * Mỗi từ: 1 bài chính (chấm FSRS) + clozePerWord câu điền +
 * arrangePerWord câu sắp xếp. Hai loại sau chỉ luyện, không chấm lịch.
 * Các đợt được XEN KẼ giữa các từ (interleave) thay vì đi hết khối một từ mới sang từ kế.
 */
export function buildQuestions(
  words: Word[],
  examplesByWord: Record<string, ExampleSentence[]>,
  pool: Word[],
  config: SrsConfig,
  isNew: boolean,
  records?: Map<string, ReviewRecord>,
  knownIds?: Set<string>,
  lexicon?: SentenceLexicon,
): Question[] {
  const groups: Question[][] = [];
  const clozeCap = config.clozePerWord ?? (config.clozeEnabled !== false ? 1 : 0);
  const arrangeCap = config.arrangePerWord ?? 1;
  const knownMin = config.sentenceKnownMin ?? 0.7;
  const foundation = lexicon
    ? new Set(Object.entries(lexicon.wordLevels).filter(([, level]) => level === 0).map(([id]) => id))
    : undefined;
  for (const w of words) {
    const g: Question[] = [];
    const rec = records?.get(w.id);
    // XOAY VÒNG NGỮ CẢNH (như HSK): xáo câu ví dụ TẤT ĐỊNH theo (từ + số lần ôn) —
    // trong một phiên thứ tự ổn định khi rebuild, mỗi LẦN ÔN sau gặp bộ câu khác
    // (thẻ học, ví dụ sau trả lời, câu khoét cloze, câu ghép đều xoay theo).
    const ex = seededShuffle(examplesByWord[w.id] || [], `${w.id}:${rec?.reps ?? 0}`);
    const ranked = knownIds && lexicon && knownMin > 0
      ? rankByKnown(ex, (s) => sentenceKnownRatio(s.en, knownIds, w.id, lexicon, foundation), knownMin)
      : ex;
    const selected = selectDistinctExercises(
      ranked,
      (s) => s.en,
      (s) => findWordInSentence(s.en, w.id) !== null,
      (s) => {
        const tokens = tokenize(s.en);
        return tokens.length >= ARRANGE_TOKENS.min && tokens.length <= ARRANGE_TOKENS.max;
      },
      clozeCap,
      arrangeCap,
    );
    const clozes = selected.clozeItems
      .map((sentence) => clozeForSentence(w, sentence, pool))
      .filter((question): question is Question => question !== null);
    const clozeSentences = new Set(selected.clozeItems.map((s) => s.en));
    if (isNew) g.push({ kind: "learn", word: w, graded: false, examples: ex.slice(0, 5) });
    else if (isLeech(rec)) g.push({ kind: "learn", word: w, graded: false, examples: ex.slice(0, 5), leech: true });
    const q = gradedFor(w, pool, config, isNew, rec);
    // Câu đã dành cho đợt điền không được lộ trong thẻ đáp án của bài
    // chính. Thà ít ví dụ còn hơn biến đợt điền sau thành chép lại.
    if (q.kind === "mcq" || q.kind === "spell")
      q.exs = ex.filter((s) => !clozeSentences.has(s.en)).slice(0, 2);
    g.push(q);
    g.push(...clozes);

    for (const s of selected.arrangeItems)
      g.push({ kind: "arrange", word: w, graded: false, en: s.en, vi: s.vi, tokens: tokenize(s.en) });
    groups.push(g);
  }
  return interleave(groups, config.interleave !== false);
}
