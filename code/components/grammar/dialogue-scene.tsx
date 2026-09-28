"use client";

// Cảnh hội thoại trong bài Ngữ pháp = TÁI DÙNG sân khấu Video (components/video/scene.tsx): dựng một bài Video "ảo" từ
// các câu hội thoại (người nói + mốc thời gian trong track của bài) → nhân vật, bối cảnh, nhép miệng theo đường bao âm
// lượng, quay mặt về người nói, biểu cảm / cử chỉ / đạo cụ… y như Video. Tải lười (chỉ bài có hội thoại mới kéo module).
import { useImperativeHandle, useMemo, useRef, type Ref } from "react";
import type { GrammarLesson } from "@/lib/grammar";
import type { Expression, Gesture, VideoLesson } from "@/lib/video";
import { preloadScene } from "@/components/video/assets";
import { Scene, type SceneHandle } from "@/components/video/scene";

export function dialogueLesson(l: GrammarLesson): { video: VideoLesson; map: Map<number, number> } {
  const map = new Map<number, number>(); // beat → câu trong bài ảo
  const lines: VideoLesson["lines"] = [];
  l.beats.forEach((b, i) => {
    if (b.k === "e" && b.who) {
      map.set(i, lines.length);
      lines.push({
        speaker: b.who,
        en: b.en,
        vi: b.vi,
        ...(b.ipa ? { ipa: b.ipa } : {}),
        start: b.start,
        end: b.end,
        ...(b.ann?.expression ? { expression: b.ann.expression as Expression } : {}),
        ...(b.ann?.gesture ? { gesture: b.ann.gesture as Gesture } : {}),
        ...(b.ann?.react ? { react: b.ann.react as Record<string, Expression> } : {}),
        ...(b.ann?.prop ? { prop: b.ann.prop } : {}),
        ...(b.ann?.bubble ? { thoughtBubble: b.ann.bubble } : {}),
        ...(b.timing ? { timing: b.timing } : {}),
      });
    }
  });
  const video: VideoLesson = {
    id: `g-${l.id}`,
    level: l.lv,
    n: 0,
    title: { en: l.en, vi: l.t },
    summary: "",
    scene: { background: l.bg ?? "classroom", ...(l.props?.length ? { props: l.props } : {}) },
    cast: Object.fromEntries(
      Object.entries(l.cast ?? {}).map(([k, c]) => [k, { name: c.name, look: c.look, style: c.style as never, x: c.x, from: c.from, until: c.until, ...(c.call ? { call: c.call } : {}) }]),
    ),
    lines,
    words: [],
    audio: l.audio,
  };
  return { video, map };
}

export function preloadDialogue(l: GrammarLesson): void {
  if (l.cast && l.beats.some((b) => b.k === "e" && b.who)) void preloadScene(dialogueLesson(l).video).catch(() => {});
}

export default function DialogueScene({ lesson, idx, getTime, ref }: { lesson: GrammarLesson; idx: number; getTime: () => number; ref?: Ref<SceneHandle> }) {
  const { video, map } = useMemo(() => dialogueLesson(lesson), [lesson]);
  // câu hội thoại gần nhất đã tới (đang ở lời giảng xen giữa hội thoại → giữ câu trước)
  let vi = -1;
  for (let i = idx; i >= 0; i--) {
    const k = map.get(i);
    if (k !== undefined) {
      vi = k;
      break;
    }
  }
  const scene = useRef<SceneHandle>(null);
  useImperativeHandle(ref, () => ({ update: (t: number) => scene.current?.update(t) }), []);
  return <Scene ref={scene} lesson={video} idx={vi} getTime={getTime} />;
}
