// Ánh xạ từ/câu → file audio MP3 tải sẵn (edge-tts, giọng en-US-AriaNeural).
// Frontend và build script DÙNG CHUNG các hàm này để tên file luôn khớp.
import type { Word } from "./types";
import { audioName, hashLong } from "./slug";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Chuỗi để ĐỌC một từ: đọc nguyên lemma (kể cả đa từ "give up"). */
export function wordSpoken(w: Word): string {
  return w.id;
}

/** Tên file audio của một từ (không kèm thư mục): "give up" → "give-up-xxxx.mp3". */
export function wordAudioFile(w: Word): string {
  return `${audioName(wordSpoken(w))}.mp3`;
}

/**
 * Tên file audio của một câu (hash dài chống trùng).
 * `sp` = chỉ số vai nói trong hội thoại: vai 1 đọc bằng GIỌNG NAM nên phải là file khác.
 * Hậu tố "-m" chỉ thêm cho vai 1 → 42.700 file audio cũ giữ nguyên tên, không phải build lại.
 */
export function sentenceAudioFile(en: string, sp = 0): string {
  return `${hashLong(en)}${sp ? "-m" : ""}.mp3`;
}

/** URL phát audio của một từ. */
export function wordAudioUrl(w: Word): string {
  return `${BASE}/audio/words/${wordAudioFile(w)}`;
}

/** URL phát audio của một câu (truyền `sp` khi là lượt thoại của vai thứ 2). */
export function sentenceAudioUrl(en: string, sp = 0): string {
  return `${BASE}/audio/sentences/${sentenceAudioFile(en, sp)}`;
}

// ---- Phát audio: MỘT tiếng tại một thời điểm ----
// Dùng chung cho cả app: trước đây mỗi component tự `new Audio().play()`, nên bấm loa liên tiếp
// ở thẻ từ là chồng tiếng lên nhau.
let currentAudio: HTMLAudioElement | null = null;

/** Phát một file audio, dừng file đang phát (nếu có). Lỗi tải file được nuốt (audio là phụ trợ). */
export function playAudio(url: string): HTMLAudioElement {
  stopAudio();
  const a = new Audio(url);
  currentAudio = a;
  a.play().catch(() => {});
  return a;
}

export function stopAudio(): void {
  try {
    currentAudio?.pause();
  } catch {
    /* trình duyệt có thể ném khi audio chưa sẵn sàng */
  }
  currentAudio = null;
}
