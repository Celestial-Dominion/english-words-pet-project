// Danh mục id asset dùng chung của Video (thuần, không JSX) — để script kiểm bài
// (scripts/check-content.mjs) và registry trong components/video/* dùng CHUNG một nguồn:
// thêm asset mới = thêm id ở đây + vẽ ở registry tương ứng (TypeScript bắt thiếu).
// Rig/bối cảnh/đạo cụ gốc chuyển từ app HSK (cùng kiến trúc); bỏ asset đặc thù văn hoá Trung Quốc.

export const LOOK_IDS = [
  "mom",
  "boy",
  "girl",
  "grandma",
  "dad",
  "grandpa",
  "man",
  "woman",
  "teenboy",
  "teengirl",
  "parrot",
] as const;
export const OUTFIT_IDS = ["blouse", "tee", "dress", "cardigan", "shirt", "tie", "coat", "uniform", "jacket", "apron", "patient", "plain", "suit"] as const;
export const HAT_IDS = ["cap", "chef", "police", "helmet"] as const;
export const HAIR_IDS = ["bob", "short", "pigtails", "bun", "part", "grandpa", "fringe", "long", "ponytail", "bald", "curly"] as const;
// Bối cảnh có phản ứng với đèn (`lights=on|off` → biến CSS --lit).
export const LIT_BACKGROUND_IDS = ["home-evening", "home-day", "home-lake", "train", "street", "village", "sea-dawn", "stage", "library"];
export const BACKGROUND_IDS = [
  "home-evening",
  "home-day",
  "home-lake",
  "campus-gate",
  "snow-yard",
  "classroom",
  "airport",
  "park",
  "library",
  "mountain-night",
  "supermarket",
  "hospital",
  "office",
  "sea-dawn",
  "kitchen",
  "market",
  "restaurant",
  "cafe",
  "street",
  "train",
  "stage",
  "car",
  "village",
  "riverside",
  "service-hall",
] as const;
export const PROP_IDS = [
  "noodles",
  "flowers",
  "phone",
  "passport",
  "fishbowl",
  "notebook",
  "tea",
  "bike",
  "book",
  "basketball",
  "puppy",
  "snowman",
  "scale",
  "milk",
  "thermometer",
  "painting",
  "wildflowers",
  "report",
  "laptop",
  "fish-dish",
  "camera",
  "fish-net",
  "fried-eggs",
  "board-bird",
  // props/everyday.tsx
  "cake",
  "mug",
  "sandwich",
  "pizza",
  "soccer-ball",
  "microphone",
  "gift-box",
  "robot",
  "plant-pot",
  "water-bottle",
] as const;
export const BUBBLE_IDS = [
  "phone-chat",
  "video-views",
  "metro-map",
  "airplane",
  // có tham số ("id:tham số") — bubbles/generic.tsx
  "clock",
  "number",
  "money",
  "calendar",
  "person",
  "call",
  "photo",
  "message",
] as const;

// Kiểu tham số của bong bóng có tham số (script kiểm bài dùng): time = "H:MM", text = chuỗi ngắn,
// amount = số, who = khoá vai / id preset, whos = 1–3 "ai" cách dấu phẩy, count = số.
export const BUBBLE_ARG: Record<string, "time" | "text" | "amount" | "who" | "whos" | "count"> = {
  clock: "time",
  number: "text",
  money: "amount",
  calendar: "text",
  person: "who",
  call: "who",
  photo: "whos",
  message: "count",
};

export type LookId = (typeof LOOK_IDS)[number];
export type OutfitId = (typeof OUTFIT_IDS)[number];
export type HatId = (typeof HAT_IDS)[number];
export type HairId = (typeof HAIR_IDS)[number];
export type BackgroundId = (typeof BACKGROUND_IDS)[number];
export type PropId = (typeof PROP_IDS)[number];
export type BubbleId = (typeof BUBBLE_IDS)[number];
