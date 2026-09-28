// Dữ liệu rig THUẦN (không JSX) của Video: ngoại hình nhân vật + hình học sân khấu.
// Dùng chung cho vẽ (character.tsx, bối cảnh) và tính tư thế (pose.ts).
// Toạ độ nhân vật: gốc (0,0) = giữa eo (khuất sau mép che phía trước), trục y hướng xuống,
// nhân vật vẽ nhìn sang PHẢI (nhìn trái = lật ngang cả người).
import type { CastMember } from "@/lib/video";
import type { BackgroundId, HairId, HatId, LookId, OutfitId } from "@/lib/video-assets";

export type HairStyle = HairId;

export interface Look {
  kind?: "bird"; // mặc định người; "bird" = vẹt trong lồng (parrot.tsx)
  hair: HairStyle;
  outfit: OutfitId;
  scale: number; // cỡ trong cảnh 1600×900
  headY: number; // tâm đầu (đầu bán kính ~100)
  shoulderY: number;
  shoulderW: number; // nửa bề ngang vai
  waistW: number;
  armLen: number; // vai → tâm bàn tay
  armW: number;
  sleeve: number; // 0..1 phần tay áo (ngắn tay < 1)
  skin: string;
  skinShade: string;
  hairColor: string;
  top: string; // màu áo
  topShade: string;
  collar: string;
  iris: string;
  accent: string; // màu nhãn người nói trong transcript
  glasses?: boolean;
  hat?: HatId;
  scarf?: string;
}

const SKIN = "#F6D2B5";
const SKIN_SHADE = "#E9B896";
const base = { skin: SKIN, skinShade: SKIN_SHADE, sleeve: 1 };

export const LOOKS: Record<LookId, Look> = {
  mom: {
    ...base,
    hair: "bob",
    outfit: "blouse",
    scale: 0.98,
    headY: -385,
    shoulderY: -250,
    shoulderW: 118,
    waistW: 96,
    armLen: 236,
    armW: 34,
    hairColor: "#3A2723",
    top: "#E07B5F",
    topShade: "#C8654B",
    collar: "#FFF7EE",
    iris: "#5A3B2E",
    accent: "#D9694C",
  },
  boy: {
    ...base,
    hair: "short",
    outfit: "tee",
    scale: 0.92,
    headY: -318,
    shoulderY: -190,
    shoulderW: 96,
    waistW: 84,
    armLen: 188,
    armW: 30,
    sleeve: 0.42,
    hairColor: "#26232B",
    top: "#4F8FD8",
    topShade: "#3C77BD",
    collar: "#3C77BD",
    iris: "#3B2A24",
    accent: "#3F7FCB",
  },
  girl: {
    ...base,
    hair: "pigtails",
    outfit: "dress",
    scale: 0.88,
    headY: -284,
    shoulderY: -160,
    shoulderW: 84,
    waistW: 80,
    armLen: 162,
    armW: 28,
    sleeve: 0.4,
    hairColor: "#2B2327",
    top: "#F08FB0",
    topShade: "#DC7398",
    collar: "#FFFFFF",
    iris: "#3B2A24",
    accent: "#D8628C",
  },
  grandma: {
    ...base,
    hair: "bun",
    outfit: "cardigan",
    scale: 0.9,
    headY: -372,
    shoulderY: -240,
    shoulderW: 112,
    waistW: 96,
    armLen: 226,
    armW: 34,
    hairColor: "#C9C6CF",
    top: "#8C7BC2",
    topShade: "#7666AD",
    collar: "#F3EEFF",
    iris: "#4A3A33",
    accent: "#7D6BB8",
    glasses: true,
  },
  dad: {
    ...base,
    hair: "part",
    outfit: "shirt",
    scale: 1,
    headY: -400,
    shoulderY: -262,
    shoulderW: 128,
    waistW: 108,
    armLen: 246,
    armW: 38,
    hairColor: "#2A2226",
    top: "#5E9E7A",
    topShade: "#4B8765",
    collar: "#EAF6EE",
    iris: "#4A3328",
    accent: "#3F8A62",
  },
  grandpa: {
    ...base,
    hair: "grandpa",
    outfit: "cardigan",
    scale: 0.94,
    headY: -382,
    shoulderY: -248,
    shoulderW: 120,
    waistW: 102,
    armLen: 234,
    armW: 36,
    hairColor: "#D9D6DD",
    top: "#8A7A64",
    topShade: "#75664F",
    collar: "#F4EFE4",
    iris: "#4A3A33",
    accent: "#8A6D45",
  },
  man: {
    ...base,
    hair: "fringe",
    outfit: "plain",
    scale: 0.98,
    headY: -394,
    shoulderY: -258,
    shoulderW: 122,
    waistW: 100,
    armLen: 240,
    armW: 36,
    hairColor: "#221E20",
    top: "#3A8E8B",
    topShade: "#2D7673",
    collar: "#2D7673",
    iris: "#3B2A24",
    accent: "#2A8683",
  },
  woman: {
    ...base,
    hair: "long",
    outfit: "plain",
    scale: 0.95,
    headY: -380,
    shoulderY: -248,
    shoulderW: 108,
    waistW: 90,
    armLen: 226,
    armW: 31,
    hairColor: "#2E2226",
    top: "#E9A23B",
    topShade: "#D18B28",
    collar: "#D18B28",
    iris: "#4A3328",
    accent: "#C98314",
  },
  teenboy: {
    ...base,
    hair: "short",
    outfit: "uniform",
    scale: 0.95,
    headY: -360,
    shoulderY: -228,
    shoulderW: 108,
    waistW: 92,
    armLen: 214,
    armW: 32,
    hairColor: "#1F1C22",
    top: "#2F62B0",
    topShade: "#244F92",
    collar: "#FFFFFF",
    iris: "#3B2A24",
    accent: "#2F62B0",
  },
  teengirl: {
    ...base,
    hair: "ponytail",
    outfit: "uniform",
    scale: 0.92,
    headY: -344,
    shoulderY: -214,
    shoulderW: 98,
    waistW: 86,
    armLen: 202,
    armW: 30,
    hairColor: "#2A2024",
    top: "#D65A7E",
    topShade: "#BE4468",
    collar: "#FFFFFF",
    iris: "#3B2A24",
    accent: "#C84C74",
  },
  // Vẹt trong lồng: headY = tâm đầu so với đáy lồng (đặt trên mặt bàn); các số đo tay không dùng.
  parrot: {
    ...base,
    kind: "bird",
    hair: "short",
    outfit: "plain",
    scale: 1.3,
    headY: -196,
    shoulderY: -150,
    shoulderW: 40,
    waistW: 40,
    armLen: 60,
    armW: 20,
    hairColor: "#2F9E4F",
    top: "#3FAE5A",
    topShade: "#2F9147",
    collar: "#F6D24A",
    iris: "#2A1D1A",
    accent: "#2F9147",
  },
};

// Ngoại hình thật của một vai = preset + biến thể trang phục (style) của bài.
export function lookOf(c: Pick<CastMember, "look" | "style">): Look {
  const l = LOOKS[c.look as LookId];
  return c.style ? { ...l, ...(c.style as Partial<Look>) } : l;
}

// Vai (điểm xoay tay) trong toạ độ nhân vật; side = -1 trái / +1 phải.
export function shoulderOf(look: Look, side: -1 | 1): { x: number; y: number } {
  return { x: side * (look.shoulderW - 22), y: look.shoulderY + 26 };
}

export interface Stage {
  baseY: number; // eo nhân vật (khuất sau mép che phía trước)
  tableTop: number; // mặt bàn / mép che — đạo cụ đứng lên đây
}

const TABLE: Stage = { baseY: 718, tableTop: 712 };
export const STAGES: Record<BackgroundId, Stage> = {
  "home-evening": TABLE,
  "home-day": TABLE,
  "home-lake": TABLE,
  "campus-gate": { baseY: 730, tableTop: 708 },
  "snow-yard": { baseY: 730, tableTop: 716 },
  classroom: TABLE,
  airport: { baseY: 730, tableTop: 700 },
  park: { baseY: 730, tableTop: 712 },
  library: TABLE,
  "mountain-night": { baseY: 730, tableTop: 716 },
  supermarket: { baseY: 724, tableTop: 704 },
  hospital: { baseY: 724, tableTop: 704 },
  office: TABLE,
  "sea-dawn": { baseY: 736, tableTop: 716 },
  kitchen: { baseY: 724, tableTop: 698 },
  market: { baseY: 726, tableTop: 704 },
  restaurant: TABLE,
  cafe: { baseY: 724, tableTop: 694 },
  street: { baseY: 730, tableTop: 712 },
  train: { baseY: 724, tableTop: 712 },
  stage: { baseY: 740, tableTop: 730 },
  car: { baseY: 730, tableTop: 700 },
  village: { baseY: 730, tableTop: 716 },
  riverside: { baseY: 730, tableTop: 690 },
  "service-hall": { baseY: 724, tableTop: 694 },
};

// Tâm đạo cụ (để tay chỉ vào) — đạo cụ cao ~ 60–300 đơn vị.
export const PROP_CENTER_H: Record<string, number> = {
  noodles: 55,
  flowers: 120,
  phone: 70,
  passport: 40,
  fishbowl: 80,
  notebook: 30,
  tea: 40,
  bike: 150,
  book: 60,
  basketball: 50,
  puppy: 70,
  snowman: 140,
  scale: 70,
  milk: 60,
  thermometer: 40,
  painting: 200,
  wildflowers: 80,
  report: 50,
  laptop: 70,
  "fish-dish": 30,
  camera: 45,
  "fish-net": 45,
  "fried-eggs": 25,
  "board-bird": 120,
  cake: 70,
  mug: 40,
  sandwich: 35,
  pizza: 60,
  "soccer-ball": 52,
  microphone: 210,
  "gift-box": 55,
  robot: 110,
  "plant-pot": 90,
  "water-bottle": 70,
};
