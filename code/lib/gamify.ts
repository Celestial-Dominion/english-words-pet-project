// Gamification — theme cấp bậc Hải quân Hoàng gia Anh ("Hải trình"). Logic thuần (không phụ thuộc DB).

// XP cộng khi hành động (giữ tinh thần +3/+5/+2 của app HSK).
export const XP = { newWord: 5, review: 3, practice: 2, perfectSession: 20 } as const;

// 21 cấp bậc Hải quân Hoàng gia Anh, thăng theo SỐ TỪ ĐÃ HỌC (ngưỡng giãn trên thang ~9.8k).
export interface Rank {
  en: string;
  vi: string;
  minWords: number;
}
export const RANKS: Rank[] = [
  { en: "Seaman", vi: "Thủy thủ", minWords: 0 },
  { en: "Able Seaman", vi: "Thủy thủ chuyên nghiệp", minWords: 20 },
  { en: "Leading Hand", vi: "Hạ sĩ", minWords: 50 },
  { en: "Petty Officer", vi: "Trung sĩ", minWords: 100 },
  { en: "Chief Petty Officer", vi: "Thượng sĩ", minWords: 175 },
  { en: "Warrant Officer 2", vi: "Chuẩn úy 2", minWords: 275 },
  { en: "Warrant Officer 1", vi: "Chuẩn úy 1", minWords: 400 },
  { en: "Midshipman", vi: "Học viên sĩ quan", minWords: 560 },
  { en: "Sub-Lieutenant", vi: "Thiếu úy", minWords: 760 },
  { en: "Lieutenant", vi: "Trung úy", minWords: 1000 },
  { en: "Lieutenant Commander", vi: "Thiếu tá", minWords: 1300 },
  { en: "Commander", vi: "Trung tá", minWords: 1700 },
  { en: "Captain", vi: "Đại tá", minWords: 2200 },
  { en: "Commodore", vi: "Phó đề đốc", minWords: 2800 },
  { en: "Rear Admiral", vi: "Chuẩn đô đốc", minWords: 3500 },
  { en: "Vice Admiral", vi: "Phó đô đốc", minWords: 4400 },
  { en: "Admiral", vi: "Đô đốc", minWords: 5500 },
  { en: "Admiral of the Fleet", vi: "Thủy sư đô đốc", minWords: 6800 },
  { en: "First Sea Lord", vi: "Đệ nhất Hải khanh", minWords: 8000 },
  { en: "Lord High Admiral", vi: "Đại đô đốc", minWords: 9000 },
  { en: "Master and Commander of the Seven Seas", vi: "Chúa tể Thất Hải", minWords: 9800 },
];

export interface RankProgress {
  index: number;
  rank: Rank;
  next?: Rank;
  toNext: number; // số từ còn thiếu để lên cấp (0 nếu đã max)
  progress: number; // 0..1 trong khoảng cấp hiện tại → cấp sau
}

export function rankForWords(words: number): RankProgress {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) if (words >= RANKS[i].minWords) index = i;
  const rank = RANKS[index];
  const next = RANKS[index + 1];
  if (!next) return { index, rank, toNext: 0, progress: 1 };
  const span = next.minWords - rank.minWords;
  const done = words - rank.minWords;
  return { index, rank, next, toNext: next.minWords - words, progress: Math.min(1, done / span) };
}

// ---- Huy hiệu ----
export interface Stats {
  words: number; // số từ đã đưa vào học
  xp: number;
  streak: number; // chuỗi ngày liên tiếp
  reads: number; // số bài đọc/truyện đã đọc
  reviews: number; // tổng lượt ôn (mọi ngày)
  correct: number; // tổng lượt trả lời đúng
  activeDays: number; // tổng số ngày có học
  matured: number; // số từ nhớ bền (FSRS stability ≥ 21 ngày)
  maxDayReviews: number; // lượt ôn cao nhất trong 1 ngày
  weekend: boolean; // từng học cuối tuần
  byLevel: Record<number, number>; // số từ đã học theo cấp
  // ---- nhóm "năng lực" (thưởng việc KHÓ, không phải việc NHIỀU) + kỷ lục/tái xuất ----
  redeemedLeeches: number; // từ HAY QUÊN đã thuần phục: quên ≥4 lần mà VẪN đạt nhớ bền
  maxCombo: number; // chuỗi trả lời đúng liên tiếp dài nhất trong một phiên
  longestStreak: number; // chuỗi ngày dài nhất TỪNG đạt (kỷ lục, không mất khi đứt)
  comebackDays: number; // quãng nghỉ dài nhất (ngày) mà sau đó ĐÃ quay lại học
  perfectDay: boolean; // từng có ngày ≥20 lượt ôn không sai câu nào
}

// ---- Huy hiệu theo NHÓM nhiều bậc (như HSK) ----
// Mỗi nhóm có 1 chỉ số + danh sách ngưỡng (tier); mỗi tier = 1 huy hiệu.
export interface BadgeGroup {
  group: string;
  name: string; // tên nhóm (theme hải quân)
  desc: string; // mô tả ngắn
  lore: string; // lời dẫn
  icon: string; // emoji đại diện
  metric: keyof Pick<
    Stats,
    "words" | "streak" | "xp" | "reviews" | "correct" | "reads" | "activeDays" | "matured" | "maxDayReviews" | "redeemedLeeches" | "maxCombo" | "longestStreak"
  >;
  unit: string;
  tiers: number[];
}

export const BADGE_GROUPS: BadgeGroup[] = [
  {
    group: "words", name: "Chiêu binh", desc: "Số từ đã học", icon: "🎖️",
    lore: "Mỗi từ thuộc lòng là một thủy thủ gia nhập thủy thủ đoàn. Quân số càng đông, hạm đội Anh ngữ càng mạnh.",
    metric: "words", unit: "từ", tiers: [10, 25, 50, 100, 250, 500, 1000, 2000, 3500, 5000, 7000, 8500, 9800],
  },
  {
    group: "streak", name: "Trực chiến", desc: "Chuỗi ngày liên tiếp", icon: "🔥",
    lore: "Người lính giỏi không rời vị trí. Mỗi ngày học liên tục giữ cho ngọn lửa kỷ luật cháy mãi — nghỉ một ngày là chuỗi đứt.",
    metric: "streak", unit: "ngày", tiers: [3, 7, 14, 30, 60, 100, 150, 180, 270, 365, 500, 730],
  },
  {
    group: "xp", name: "Quân công", desc: "Tổng điểm XP", icon: "✨",
    lore: "Chiến công tích lũy từ mỗi câu trả lời đúng. XP càng cao, quân hàm càng gần.",
    metric: "xp", unit: "XP", tiers: [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 200000],
  },
  {
    group: "reviews", name: "Thao luyện", desc: "Tổng lượt ôn", icon: "⚔️",
    lore: "Thao trường đổ mồ hôi, chiến trường bớt đổ máu. Mỗi lượt ôn là một buổi rèn quân.",
    metric: "reviews", unit: "lượt", tiers: [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000],
  },
  {
    group: "correct", name: "Thiện xạ", desc: "Số lượt trả lời đúng", icon: "🎯",
    lore: "Bắn trúng mục tiêu — mỗi câu đúng là một phát ăn điểm. Tay nghề càng cao, tỉ lệ trúng càng dày.",
    metric: "correct", unit: "câu", tiers: [50, 200, 500, 1000, 2500, 5000, 10000, 25000, 50000],
  },
  {
    group: "matured", name: "Cựu binh", desc: "Từ nhớ bền (dài hạn)", icon: "🏅",
    lore: "Từ đã in sâu vào trí nhớ dài hạn (ổn định ≥ 3 tuần) — không phải nhớ tạm rồi quên. Đây mới là vốn từ THẬT.",
    metric: "matured", unit: "từ", tiers: [25, 100, 300, 800, 2000, 4000, 7000, 9800],
  },
  {
    group: "maxday", name: "Tổng lực", desc: "Lượt ôn nhiều nhất trong 1 ngày", icon: "⚡",
    lore: "Có những ngày xông trận không ngơi tay. Kỷ lục số lượt ôn trong một ngày cho thấy khí thế tổng lực.",
    metric: "maxDayReviews", unit: "lượt/ngày", tiers: [25, 50, 100, 150, 200, 300, 500],
  },
  {
    group: "reads", name: "Quân báo", desc: "Bài đọc & truyện hoàn thành", icon: "📖",
    lore: "Đọc để thấy từ sống trong văn cảnh thật. Đọc nhiều, hiểu sâu, nắm tình hình như xem tình báo.",
    metric: "reads", unit: "bài", tiers: [3, 10, 25, 50, 76],
  },
  {
    group: "days", name: "Nhật ký hành quân", desc: "Tổng số ngày học", icon: "🗓️",
    lore: "Đếm số ngày bạn ra thao trường. Đường dài mới biết ngựa hay — góp ngày thành chiến dịch.",
    metric: "activeDays", unit: "ngày", tiers: [3, 10, 30, 60, 100, 200, 300, 365, 500, 730],
  },
  // ---- nhóm NĂNG LỰC: thưởng việc khó (SDT — competence bền hơn khối lượng) ----
  {
    group: "kraken", name: "Săn Kraken", desc: "Từ hay quên đã thuần phục", icon: "🐙",
    lore: "Kraken là con quái nuốt tàu — từ quên đi quên lại 4 lần trở lên. Kéo được nó lên boong và giữ cho NHỚ BỀN mới là chiến tích thật của thủy thủ.",
    metric: "redeemedLeeches", unit: "từ", tiers: [1, 5, 15, 30, 60, 100, 200],
  },
  {
    group: "combo", name: "Loạt pháo", desc: "Chuỗi trả lời đúng liên tiếp dài nhất", icon: "💥",
    lore: "Loạt pháo mạn thuyền nổ không ngắt nhịp. Chuỗi câu đúng liên tiếp trong một phiên — sai một phát là nạp đạn lại từ đầu.",
    metric: "maxCombo", unit: "câu", tiers: [10, 20, 35, 50, 75, 100],
  },
  {
    group: "voyage", name: "Viễn dương", desc: "Chuỗi ngày dài nhất từng đạt", icon: "🧭",
    lore: "Hải trình dài nhất từng đi trọn — kỷ lục đã lập thì KHÔNG mất, kể cả khi chuyến sau phải quay về cảng sớm. Đứt chuỗi hôm nay không xoá được chuyến viễn dương hôm qua.",
    metric: "longestStreak", unit: "ngày", tiers: [7, 14, 30, 60, 100, 180, 365, 730],
  },
];

// Huy hiệu "Chiến dịch": hoàn thành (học hết) từng cấp CEFR.
export const CAMPAIGN_BADGES = [
  { id: "camp-1", level: 1, cefr: "B1", need: 2000 },
  { id: "camp-2", level: 2, cefr: "B2", need: 2500 },
  { id: "camp-3", level: 3, cefr: "C1", need: 3000 },
  { id: "camp-4", level: 4, cefr: "C2", need: 2300 },
];

// Huy hiệu đặc biệt (điều kiện đơn, tính từ dữ liệu sẵn có).
export interface SpecialBadge {
  id: string;
  name: string;
  icon: string;
  hint: string;
  test: (s: Stats) => boolean;
}
export const SPECIAL_BADGES: SpecialBadge[] = [
  { id: "sp-first", name: "Khai hỏa", icon: "🚩", hint: "Học từ đầu tiên", test: (s) => s.words >= 1 },
  { id: "sp-week", name: "Tuần lễ vàng", icon: "🗓️", hint: "Chuỗi 7 ngày liên tiếp", test: (s) => s.streak >= 7 },
  { id: "sp-weekend", name: "Cuối tuần chăm", icon: "📅", hint: "Học vào T7/CN", test: (s) => s.weekend },
  { id: "sp-100words", name: "Đại đội", icon: "💯", hint: "Học được 100 từ", test: (s) => s.words >= 100 },
  { id: "sp-multi", name: "Đa binh chủng", icon: "🎏", hint: "Có từ đã học ở cả 6 cấp", test: (s) => [1, 2, 3, 4, 5, 6].every((l) => (s.byLevel[l] ?? 0) > 0) },
  { id: "sp-half", name: "Nửa chặng đường", icon: "⛰️", hint: "Học được 5.500 từ", test: (s) => s.words >= 5500 },
  { id: "sp-elite", name: "Tinh nhuệ", icon: "🎗️", hint: "1.000 từ nhớ bền", test: (s) => s.matured >= 1000 },
  { id: "sp-century", name: "Bách chiến", icon: "🛡️", hint: "≥100 lượt ôn trong 1 ngày", test: (s) => s.maxDayReviews >= 100 },
  { id: "sp-blitz", name: "Cuồng phong", icon: "🌪️", hint: "≥250 lượt ôn trong 1 ngày", test: (s) => s.maxDayReviews >= 250 },
  { id: "sp-persist", name: "Trường kỳ", icon: "🏔️", hint: "Học đủ 100 ngày (tổng)", test: (s) => s.activeDays >= 100 },
  { id: "sp-sharp", name: "Thần xạ", icon: "🎯", hint: "5.000 câu trả lời đúng", test: (s) => s.correct >= 5000 },
  { id: "sp-allcamp", name: "Toàn thắng", icon: "🏆", hint: "Hoàn thành cả 6 chiến dịch CEFR", test: (s) => CAMPAIGN_BADGES.every((c) => (s.byLevel[c.level] ?? 0) >= c.need) },
  { id: "sp-marechal", name: "Thống chế", icon: "👑", hint: "Học trọn toàn bộ 11.000 từ", test: (s) => s.words >= 11000 },
  // ---- chào người quay lại: thưởng việc TRỞ LẠI thay vì chỉ phạt việc đứt chuỗi ----
  { id: "sp-comeback", name: "Tái xuất", icon: "🌅", hint: "Quay lại học sau ≥3 ngày nghỉ", test: (s) => s.comebackDays >= 3 },
  { id: "sp-storm", name: "Trở về từ bão", icon: "⛵", hint: "Quay lại học sau ≥14 ngày nghỉ", test: (s) => s.comebackDays >= 14 },
  { id: "sp-flawless", name: "Ngày toàn thắng", icon: "🎯", hint: "Một ngày ≥20 lượt ôn không sai câu nào", test: (s) => s.perfectDay },
];

// ---- Flatten thành từng huy hiệu để hiển thị ----
export interface Badge {
  id: string;
  group: string;
  groupName: string;
  name: string; // vd "Chiêu binh V"
  icon: string;
  hint: string; // ngưỡng cần đạt
  earned: boolean;
  value: number; // giá trị hiện tại của chỉ số
  threshold: number; // ngưỡng của tier
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export interface BadgeGroupView {
  group: string;
  name: string;
  desc: string;
  lore: string;
  icon: string;
  earned: number;
  total: number;
  next?: { threshold: number; value: number; unit: string }; // tier kế tiếp chưa đạt
  badges: Badge[];
}

export function badgeGroups(s: Stats): BadgeGroupView[] {
  const views = BADGE_GROUPS.map((g) => {
    const value = s[g.metric] as number;
    const badges: Badge[] = g.tiers.map((t, i) => ({
      id: `${g.group}-${i}`,
      group: g.group,
      groupName: g.name,
      name: `${g.name} ${ROMAN[i]}`,
      icon: g.icon,
      hint: `${t.toLocaleString("vi")} ${g.unit}`,
      earned: value >= t,
      value,
      threshold: t,
    }));
    const earned = badges.filter((b) => b.earned).length;
    const nextTier = g.tiers.find((t) => value < t);
    return {
      group: g.group,
      name: g.name,
      desc: g.desc,
      lore: g.lore,
      icon: g.icon,
      earned,
      total: badges.length,
      next: nextTier ? { threshold: nextTier, value, unit: g.unit } : undefined,
      badges,
    };
  });

  // nhóm Chiến dịch (theo cấp)
  const campBadges: Badge[] = CAMPAIGN_BADGES.map((c) => {
    const learned = s.byLevel[c.level] ?? 0;
    return {
      id: c.id,
      group: "campaign",
      groupName: "Chiến dịch",
      name: `Chiến dịch ${c.cefr}`,
      icon: "🏴",
      hint: `Học hết ${c.need.toLocaleString("vi")} từ cấp ${c.cefr}`,
      earned: learned >= c.need,
      value: learned,
      threshold: c.need,
    };
  });
  views.push({
    group: "campaign", name: "Chiến dịch", desc: "Chinh phục từng cấp CEFR",
    lore: "Mỗi cấp là một chiến dịch. Học hết từ vựng của cấp = cắm cờ chiến thắng.",
    icon: "🏴",
    earned: campBadges.filter((b) => b.earned).length,
    total: campBadges.length,
    next: undefined,
    badges: campBadges,
  });

  // nhóm Đặc biệt
  const spBadges: Badge[] = SPECIAL_BADGES.map((b) => ({
    id: b.id,
    group: "special",
    groupName: "Chiến tích",
    name: b.name,
    icon: b.icon,
    hint: b.hint,
    earned: b.test(s),
    value: 0,
    threshold: 0,
  }));
  views.push({
    group: "special", name: "Chiến tích", desc: "Cột mốc đặc biệt",
    lore: "Những dấu ấn riêng trên đường binh nghiệp.",
    icon: "🌟",
    earned: spBadges.filter((b) => b.earned).length,
    total: spBadges.length,
    next: undefined,
    badges: spBadges,
  });

  return views;
}

export function badgeTotals(s: Stats): { earned: number; total: number } {
  const gs = badgeGroups(s);
  return {
    earned: gs.reduce((a, g) => a + g.earned, 0),
    total: gs.reduce((a, g) => a + g.total, 0),
  };
}

// ---- NHIỆM VỤ NGÀY ----
// Cơ chế giữ chân chính (goal-gradient: mục tiêu nhỏ + thanh tiến độ gần đích kéo người
// học làm nốt; kinh nghiệm Duolingo: daily quests giữ chân mạnh hơn mọi loại huy hiệu).
// Mỗi ngày 3 nhiệm vụ, chọn TẤT ĐỊNH theo chuỗi ngày — mọi thiết bị thấy cùng một bộ.
// Tiến độ tính từ dữ liệu ĐÃ đồng bộ (daily + reads); trạng thái "đã nhận thưởng" nằm ở
// gamify.questsDone (khoá "YYYY-MM-DD:qid", union-merge — hai máy không cộng XP kép).

/** Số liệu TRONG NGÀY dùng chấm nhiệm vụ — đều lấy từ bảng đã sync. */
export interface DayMetrics {
  reviews: number; // lượt ôn hôm nay (daily.reviews)
  newCount: number; // từ mới hôm nay (daily.newCount)
  correct: number; // câu đúng hôm nay (reviews - again)
  again: number; // câu sai hôm nay
  reads: number; // bài đọc đánh dấu xong hôm nay
}

export interface QuestDef {
  id: string;
  name: string; // tên ngắn (hiện trên thẻ nhiệm vụ)
  icon: string;
  metric: "reviews" | "newCount" | "correct" | "reads" | "accuracy";
  target: number; // ngưỡng cần đạt (accuracy: % đúng tối thiểu, cần ≥10 lượt)
  xp: number; // thưởng khi hoàn thành
}

// Kho nhiệm vụ — mỗi metric vài mức để ngày nặng ngày nhẹ (đỡ đơn điệu).
// XP thưởng cỡ 3–8 lượt ôn (XP.review=3) — đáng bõ nhưng không lấn át XP học thật.
export const QUEST_POOL: QuestDef[] = [
  { id: "on15", name: "Ôn 15 thẻ", icon: "⚔️", metric: "reviews", target: 15, xp: 10 },
  { id: "on30", name: "Ôn 30 thẻ", icon: "⚔️", metric: "reviews", target: 30, xp: 20 },
  { id: "on50", name: "Ôn 50 thẻ", icon: "🌊", metric: "reviews", target: 50, xp: 30 },
  { id: "moi3", name: "Học 3 từ mới", icon: "✨", metric: "newCount", target: 3, xp: 12 },
  { id: "moi5", name: "Học 5 từ mới", icon: "✨", metric: "newCount", target: 5, xp: 18 },
  { id: "dung12", name: "Trả lời đúng 12 câu", icon: "🎯", metric: "correct", target: 12, xp: 10 },
  { id: "dung25", name: "Trả lời đúng 25 câu", icon: "🎯", metric: "correct", target: 25, xp: 18 },
  { id: "doc1", name: "Đọc xong 1 bài", icon: "📖", metric: "reads", target: 1, xp: 15 },
  { id: "sac90", name: "Chuẩn xác ≥90% (≥10 thẻ)", icon: "🧭", metric: "accuracy", target: 90, xp: 25 },
];

// Xáo tất định theo seed (fnv-1a + xorshift) — BẢN RIÊNG tự chứa: file này được unit-test
// bằng node strip-types, không import tương đối giá trị runtime được (luật như srs-pure).
function questShuffle<T>(arr: T[], seedStr: string): T[] {
  let h = 2166136261;
  for (let k = 0; k < seedStr.length; k++) {
    h ^= seedStr.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
  const s = [...arr];
  for (let k = s.length - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1));
    [s[k], s[j]] = [s[j], s[k]];
  }
  return s;
}

/** 3 nhiệm vụ của một ngày — tất định theo chuỗi ngày, mỗi metric tối đa 1 nhiệm vụ
 *  (không ra cả "ôn 15" lẫn "ôn 30" cùng ngày). */
export function dailyQuests(dateStr: string, pool: QuestDef[] = QUEST_POOL): QuestDef[] {
  const out: QuestDef[] = [];
  const usedMetric = new Set<string>();
  for (const q of questShuffle(pool, `quest:${dateStr}`)) {
    if (usedMetric.has(q.metric)) continue;
    usedMetric.add(q.metric);
    out.push(q);
    if (out.length >= 3) break;
  }
  return out;
}

export interface QuestProgress {
  def: QuestDef;
  value: number; // giá trị hiện tại (accuracy: % đúng, 0 khi chưa đủ 10 lượt)
  done: boolean;
}

export function questProgress(def: QuestDef, m: DayMetrics): QuestProgress {
  if (def.metric === "accuracy") {
    const pct = m.reviews >= 10 ? Math.floor((m.correct / m.reviews) * 100) : 0;
    return { def, value: pct, done: m.reviews >= 10 && pct >= def.target };
  }
  const value = m[def.metric];
  return { def, value, done: value >= def.target };
}

/** Khoá "đã nhận thưởng" của một nhiệm vụ trong ngày. */
export const questKey = (dateStr: string, id: string): string => `${dateStr}:${id}`;

/** Dọn khoá cũ hơn `keepDays` — bảng questsDone không phình vô hạn. */
export function pruneQuestKeys(keys: string[], today: string, keepDays = 14): string[] {
  const cutoff = new Date(today + "T00:00:00");
  cutoff.setDate(cutoff.getDate() - keepDays);
  return keys.filter((k) => {
    const d = new Date(k.slice(0, 10) + "T00:00:00");
    return !Number.isNaN(d.getTime()) && d >= cutoff;
  });
}
