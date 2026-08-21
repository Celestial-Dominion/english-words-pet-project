// Nhãn từ loại (part-of-speech) tiếng Việt cho các mã trong dữ liệu tiếng Anh.
const POS_VI: Record<string, string> = {
  n: "danh từ",
  npr: "danh từ riêng",
  v: "động từ",
  vaux: "trợ động từ", // be, have, do, will…
  "phr-v": "cụm động từ", // give up, look forward to
  idiom: "thành ngữ",
  adj: "tính từ",
  adv: "phó từ",
  prep: "giới từ",
  conj: "liên từ",
  pron: "đại từ",
  det: "hạn định từ", // the, a, this, my…
  num: "số từ",
  intj: "thán từ",
  abbr: "viết tắt",
  phr: "cụm cố định", // "of course", "at least"
};

export function posLabel(code: string): string {
  return POS_VI[code] ?? code;
}
