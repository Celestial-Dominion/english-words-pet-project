"use client";

// Registry asset của Video + tải LƯỜI theo bài: bối cảnh / đạo cụ / bong bóng nằm ở các module
// riêng (bg/*, props/*, bubbles/*) → mỗi module là một chunk JS riêng (hash, cache 1 năm);
// mở bài nào chỉ tải đúng asset bài đó dùng. Thêm asset = thêm id ở lib/video-assets.ts + một
// dòng loader ở đây (TypeScript bắt thiếu) + vẽ trong module tương ứng.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { parseBubble, type VideoLesson } from "@/lib/video";
import type { BackgroundId, BubbleId, PropId } from "@/lib/video-assets";
import type { Look } from "./rig";

export interface BgOpts {
  weather?: "rain" | "snow";
}
// Mỗi bối cảnh 3 lớp: `back` (tường, trời…) sau nhân vật, `front` (bàn, quầy, bờ tuyết…) che nửa
// dưới nhân vật, `overlay` (bóng tối khi tắt đèn…) trên cùng. Độ sáng đọc từ biến CSS --lit (0..1).
export interface Background {
  back: (o: BgOpts) => ReactNode;
  front: (o: BgOpts) => ReactNode;
  overlay?: (o: BgOpts) => ReactNode;
}
export type Draw = () => ReactNode;
type Group = { default: Partial<Record<string, Draw>> };
// Bong bóng nhận tham số sau dấu ":" (clock:2:30, person:爷爷…) + ngữ cảnh bài (ngoại hình các vai).
export interface BubbleCtx {
  look(who: string): Look | undefined;
}
export type BubbleDraw = (arg: string, ctx: BubbleCtx) => ReactNode;
type BubbleGroup = { default: Partial<Record<string, BubbleDraw>> };

const BACKGROUNDS: Record<BackgroundId, () => Promise<Background>> = {
  "home-evening": () => import("./bg/home").then((m) => m.homeEvening),
  "home-day": () => import("./bg/home").then((m) => m.homeDay),
  "home-lake": () => import("./bg/home").then((m) => m.homeLake),
  "campus-gate": () => import("./bg/campus-gate").then((m) => m.default),
  "snow-yard": () => import("./bg/snow-yard").then((m) => m.default),
  classroom: () => import("./bg/classroom").then((m) => m.default),
  airport: () => import("./bg/airport").then((m) => m.default),
  park: () => import("./bg/park").then((m) => m.default),
  library: () => import("./bg/library").then((m) => m.default),
  "mountain-night": () => import("./bg/mountain-night").then((m) => m.default),
  supermarket: () => import("./bg/shop").then((m) => m.supermarket),
  hospital: () => import("./bg/hospital").then((m) => m.default),
  office: () => import("./bg/office").then((m) => m.default),
  "sea-dawn": () => import("./bg/sea-dawn").then((m) => m.default),
  kitchen: () => import("./bg/kitchen").then((m) => m.default),
  market: () => import("./bg/market").then((m) => m.default),
  restaurant: () => import("./bg/eatery").then((m) => m.restaurant),
  cafe: () => import("./bg/eatery").then((m) => m.cafe),
  street: () => import("./bg/street").then((m) => m.default),
  train: () => import("./bg/train").then((m) => m.default),
  stage: () => import("./bg/stage").then((m) => m.default),
  car: () => import("./bg/car").then((m) => m.default),
  village: () => import("./bg/village").then((m) => m.village),
  riverside: () => import("./bg/village").then((m) => m.riverside),
  "service-hall": () => import("./bg/service-hall").then((m) => m.default),
};

// Đạo cụ gom theo nhóm (đồ ăn / đồ vật / cây-con vật-đồ lớn) để một bài không tải cả chục chunk nhỏ.
const food = () => import("./props/food") as Promise<Group>;
const things = () => import("./props/things") as Promise<Group>;
const living = () => import("./props/living") as Promise<Group>;
const everyday = () => import("./props/everyday") as Promise<Group>;
const PROPS: Record<PropId, () => Promise<Group>> = {
  noodles: food,
  tea: food,
  milk: food,
  "fish-dish": food,
  "fried-eggs": food,
  scale: food,
  phone: things,
  passport: things,
  notebook: things,
  book: things,
  basketball: things,
  thermometer: things,
  report: things,
  laptop: things,
  camera: things,
  flowers: living,
  wildflowers: living,
  fishbowl: living,
  bike: living,
  puppy: living,
  snowman: living,
  painting: living,
  "fish-net": living,
  "board-bird": living,
  cake: everyday,
  mug: everyday,
  sandwich: everyday,
  pizza: everyday,
  "soccer-ball": everyday,
  microphone: everyday,
  "gift-box": everyday,
  robot: everyday,
  "plant-pot": everyday,
  "water-bottle": everyday,
};

const objects = () => import("./bubbles/objects") as Promise<BubbleGroup>;
const generic = () => import("./bubbles/generic") as Promise<BubbleGroup>;
const BUBBLES: Record<BubbleId, () => Promise<BubbleGroup>> = {
  clock: generic,
  number: generic,
  money: generic,
  calendar: generic,
  person: generic,
  call: generic,
  photo: generic,
  message: generic,
  "phone-chat": objects,
  "video-views": objects,
  "metro-map": objects,
  airplane: objects,
};

export interface SceneAssets {
  bg: Background;
  props: Record<string, Draw>;
  bubbles: Record<string, BubbleDraw>;
  callBgs: Record<string, Background>; // bối cảnh sau lưng người ở đầu dây (cast.call.bg)
}

// Cache cấp module: đã tải một lần thì mở lại bài (hoặc bài khác cùng asset) vẽ ngay, không nháy.
const done = new Map<string, unknown>();
const pending = new Map<string, Promise<void>>();

function need(lesson: VideoLesson): [string, () => Promise<unknown>][] {
  const out: [string, () => Promise<unknown>][] = [];
  const bg = lesson.scene.background as BackgroundId;
  out.push([`bg:${bg}`, BACKGROUNDS[bg]]);
  for (const b of new Set(Object.values(lesson.cast).map((c) => c.call?.bg as BackgroundId | undefined)))
    if (b && b !== bg) out.push([`bg:${b}`, BACKGROUNDS[b]]);
  for (const p of new Set((lesson.scene.props ?? []).map((x) => x.id as PropId)))
    out.push([`prop:${p}`, () => PROPS[p]().then((m) => m.default[p])]);
  for (const b of new Set(lesson.lines.map((l) => l.thoughtBubble && (parseBubble(l.thoughtBubble).id as BubbleId)).filter(Boolean) as BubbleId[]))
    out.push([`bubble:${b}`, () => BUBBLES[b]().then((m) => m.default[b])]);
  return out;
}

function load([key, f]: [string, () => Promise<unknown>]): Promise<void> {
  if (done.has(key)) return Promise.resolve();
  let p = pending.get(key);
  if (!p) {
    p = f().then((v) => void done.set(key, v));
    pending.set(key, p);
    p.catch(() => pending.delete(key)); // lỗi mạng → lần sau thử lại
  }
  return p;
}

function assemble(lesson: VideoLesson): SceneAssets {
  const props: Record<string, Draw> = {};
  const bubbles: Record<string, BubbleDraw> = {};
  const callBgs: Record<string, Background> = {};
  for (const p of lesson.scene.props ?? []) props[p.id] = done.get(`prop:${p.id}`) as Draw;
  for (const l of lesson.lines)
    if (l.thoughtBubble) {
      const { id } = parseBubble(l.thoughtBubble);
      bubbles[id] = done.get(`bubble:${id}`) as BubbleDraw;
    }
  for (const c of Object.values(lesson.cast)) if (c.call?.bg) callBgs[c.call.bg] = done.get(`bg:${c.call.bg}`) as Background;
  return { bg: done.get(`bg:${lesson.scene.background}`) as Background, props, bubbles, callBgs };
}

// Bắt đầu tải asset của bài càng sớm càng tốt (gọi ngay khi có lesson JSON).
export function preloadScene(lesson: VideoLesson): Promise<void> {
  return Promise.all(need(lesson).map(load)).then(() => {});
}

// null khi còn đang tải (lần đầu); đã có trong cache thì trả ngay trong lần vẽ đầu.
export function useSceneAssets(lesson: VideoLesson): SceneAssets | null {
  const keys = useMemo(() => need(lesson), [lesson]);
  const ready = keys.every(([k]) => done.has(k));
  const [, setTick] = useState(0);
  useEffect(() => {
    if (ready) return;
    let alive = true;
    preloadScene(lesson)
      .then(() => alive && setTick((n) => n + 1))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lesson, ready]);
  return useMemo(() => (ready ? assemble(lesson) : null), [ready, lesson]);
}
