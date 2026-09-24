// Quy tắc làm sạch dùng CHUNG cho lúc tải nguồn, ráp dữ liệu và QA. Tách riêng để sửa
// pipeline một lần là cả dữ liệu hiện tại lẫn những đợt fetch sau đều cùng hành vi.

const SENTENCE_STARTERS = new Set([
  "A", "An", "The", "This", "That", "These", "Those", "It", "He", "She", "They", "We", "I",
  "There", "However", "Meanwhile", "But", "In", "On", "At", "For", "As", "After", "Before",
  "When", "While", "According",
]);

// Từ thường đứng NGAY SAU U.S./E.U./A.J.… trong cùng một cụm danh từ. Không gộp mọi câu
// kết thúc bằng U.S. vì "outside the U.S. Microsoft…" là hai câu thật sự.
const MULTI_INITIAL_CONTINUATIONS = new Set([
  "Affairs", "Army", "Congressman", "Court", "Customs", "Department", "District", "Dollar",
  "Environmental", "Federal", "Geological", "Government", "Harris", "House", "Libertarian",
  "Marshals", "Maxx", "Military", "Morgan", "MQ-1", "National", "Navy", "Open", "President",
  "President-Elect", "Rep", "Representative", "Roark", "Securities", "Senate", "Senator",
  "Secretary", "Supreme", "Treasury", "Wright",
]);

// Các trường hợp trông giống tên đệm ("X.") nhưng thật ra là ký hiệu kết thúc câu.
const INITIAL_PREFIX_EXCLUSIONS = new Set(["Model", "Part", "Simulator", "Unit", "War"]);

// Tokenizer thường cắt ngay sau a.m./p.m., trong khi múi giờ hoặc ngày vẫn thuộc cùng câu.
// Chỉ gộp các mẫu tiếp nối đủ rõ để giữ nguyên những ranh giới thật như
// "at 3 a.m. At another office…".
const TIME_CONTINUATION = /^(?:[A-Z]{2,5}\b|(?:West Africa|Central European|Central Standard|Eastern Standard|Pacific Daylight|Tongan|Sydney|local)\s+[Tt]ime\b|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\b|(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(?:morning|afternoon|evening|night)\b)/;

const isTimeContinuation = (previous, current) =>
  /\b\d{1,2}(?::\d{2})?\s*[ap]\.m\.$/i.test(previous) && TIME_CONTINUATION.test(current);

const firstWord = (sentence) => sentence.match(/^["'“‘(]*([A-Z][A-Za-z0-9'’-]*)/)?.[1] ?? "";

/** Hai mẩu này có phải một câu bị tokenizer tách nhầm không? */
export function shouldMergeReadingSentences(previous, current) {
  const prev = String(previous ?? "").trim();
  const next = String(current ?? "").trim();
  if (!prev || !next) return false;
  if (/^[a-z]/.test(next)) return true;

  const nextWord = firstWord(next);
  if (!nextWord) return false;

  if (isTimeContinuation(prev, next)) return true;

  // Mr. Smith / Dr. Jones / St. Louis / Mt. Everest.
  if (/\b(?:Mr|Mrs|Ms|Dr|Prof|St|Mt)\.$/.test(prev) && !SENTENCE_STARTERS.has(nextWord)) return true;

  // Ernest W. Burgess / John F. Kennedy, nhưng không "World War I. It…" hay "Model T. The…".
  const singleInitial = prev.match(/\b([A-Z][a-z]+)\s+[A-Z]\.$/);
  if (
    singleInitial &&
    !INITIAL_PREFIX_EXCLUSIONS.has(singleInitial[1]) &&
    !SENTENCE_STARTERS.has(nextWord)
  ) return true;

  // U.S. Senator / U.S. Department / A.J. Wright…
  if (/\b(?:[A-Z]\.){2,}$/.test(prev) && MULTI_INITIAL_CONTINUATIONS.has(nextWord)) return true;

  return false;
}

/** Gộp mảng câu tiếng Anh thô sau khi tokenizer đã tách theo dấu câu. */
export function mergeEnglishSentences(sentences) {
  const out = [];
  for (const raw of sentences) {
    const sentence = String(raw ?? "").trim();
    if (!sentence) continue;
    const previous = out[out.length - 1];
    if (previous && shouldMergeReadingSentences(previous, sentence)) out[out.length - 1] = `${previous} ${sentence}`;
    else out.push(sentence);
  }
  return out;
}

/** Gộp EN/VI cùng lúc để hai ngôn ngữ không bao giờ lệch chỉ số. */
export function mergeReadingPairs(pairs) {
  const out = [];
  for (const pair of pairs) {
    const previous = out[out.length - 1];
    if (previous && shouldMergeReadingSentences(previous.en, pair.en)) {
      const timeContinuation = isTimeContinuation(previous.en, pair.en);
      previous.en = `${previous.en} ${pair.en}`;
      // Bản dịch máy coi mẩu "10:30 a.m." là hết câu và tự thêm dấu chấm. Khi mẩu sau
      // chỉ là múi giờ/ngày tiếp nối, bỏ dấu câu giả để không thành "10 giờ sáng. EST".
      const previousVi = timeContinuation
        ? previous.vi.replace(/\.\s*$/, "")
        : previous.vi;
      previous.vi = `${previousVi} ${pair.vi}`;
    } else {
      out.push({ ...pair });
    }
  }
  return out;
}

const IMAGE_PREFIX_EN = /^(?:File:)?[^.!?]{1,180}\.(?:jpe?g|png|gif|svg)\s+/i;
const IMAGE_PREFIX_VI = /^(?:(?:Tập tin|File):)?[^.!?]{1,180}\.(?:jpe?g|png|gif|svg)\s+/i;
const LONE_FILE_LABEL = /^(?:File|Tập tin):[^.]*\.?$/i;
const LONE_CAPTION_FRAGMENT = /^[A-Z]\.$/;
const SOURCES_SUFFIX = /\s*==\s*(?:Sources|Nguồn)\s*==.*$/i;
const WIKI_LINK_TEMPLATE = /\{w\|([^}]+)\}\}/g;

/** Bỏ markup Wikimedia lọt vào extract nhưng giữ HTML minh hoạ thật trong bài dạy về HTML. */
export function cleanReadingSourceText(value, language = "en") {
  let text = String(value ?? "").trim();
  text = text.replace(language === "vi" ? IMAGE_PREFIX_VI : IMAGE_PREFIX_EN, "");
  text = text.replace(SOURCES_SUFFIX, "");
  text = text.replace(WIKI_LINK_TEMPLATE, "$1");
  if (LONE_FILE_LABEL.test(text) || LONE_CAPTION_FRAGMENT.test(text)) return "";
  if (language === "vi") {
    text = text.replace(
      /\b(sáng|chiều|tối|trưa)\.\s+(?=(?:[A-Z]{2,5}\b|giờ\s+(?:địa phương|chuẩn|miền)|Giờ\s+(?:địa phương|chuẩn|miền)))/g,
      "$1 ",
    );
  }
  return text.replace(/\s{2,}/g, " ").trim();
}

export function hasReadingSourceNoise(value) {
  const text = String(value ?? "");
  return /^(?:(?:File|Tập tin):)?[^.!?]{1,180}\.(?:jpe?g|png|gif|svg)\s+|==\s*(?:Sources|Nguồn)\s*==|\{w\|[^}]+\}\}/i.test(text);
}

const STYLED_TITLE_PREFIX = /^(?:eBay|xAI)\b/;
const LOWER_VI_INITIAL = /^[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/u;
const STYLED_SENTENCE_PREFIX = /^(?:iPhone|iPad|iPod|iOS|eBay|xAI|macOS|µCLinux|α-Amylase)(?=\s|[.,:;!?)]|$)/u;
const LOWER_VI_SENTENCE_INITIAL = /^([\s“”"'‘’(\[]*)([a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ])/u;

/** Chuẩn hoá tiêu đề tiếng Việt về sentence case, nhưng giữ nguyên tên thương hiệu cách điệu. */
export function normalizeReadingTitle(value) {
  const title = String(value ?? "").trim();
  if (!title || STYLED_TITLE_PREFIX.test(title)) return title;
  return title.replace(LOWER_VI_INITIAL, (letter) => letter.toLocaleUpperCase("vi-VN"));
}

/** Viết hoa đầu câu VI sau khi bỏ dateline, nhưng giữ cách viết thương hiệu/sản phẩm. */
export function normalizeReadingSentence(value) {
  const sentence = String(value ?? "").trim();
  const visible = sentence.replace(/^[\s“”"'‘’(\[]+/, "");
  if (!sentence || STYLED_SENTENCE_PREFIX.test(visible)) return sentence;
  return sentence.replace(
    LOWER_VI_SENTENCE_INITIAL,
    (_, punctuation, letter) => `${punctuation}${letter.toLocaleUpperCase("vi-VN")}`,
  );
}
