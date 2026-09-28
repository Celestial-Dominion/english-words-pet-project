"use client";

// Đồng hồ audio DÙNG CHUNG cho bài Video và bài Ngữ pháp: một <audio> là đồng hồ duy nhất; vòng requestAnimationFrame
// đọc currentTime → câu đang phát, từ đang đọc; cập nhật từng khung (cảnh, thanh tua, đồng hồ) đi thẳng vào DOM qua
// ref — React chỉ vẽ lại khi đổi câu / đổi từ. Nghe một câu (playOnce), lặp câu, tốc độ, phím tắt (Space/K · ←/→ · R)
// giống nhau ở mọi player.
//
// "Điểm dừng" (gate): nơi gọi khai hàm `gate(i, t)` trả về chỗ phải dừng chờ người học — Video: nói theo / nhập vai
// (tự phát tiếp sau `ms`), Ngữ pháp: "thử nhớ lại" (ms = null → chờ bấm). Điểm đã qua không dừng lại lần nữa cho tới
// khi tua về trước nó; tua tới câu k thì các điểm của câu < k coi như đã qua.
import { useCallback, useEffect, useRef, useState, type RefObject, type SyntheticEvent } from "react";
import { stopAudio } from "@/lib/tts";
import { fmtTime, lineIndexAt, wordAt } from "@/lib/video";

export const SPEEDS = [1, 0.75, 1.25];

export interface TimedLine {
  start: number;
  end: number;
  timing?: [number, number][];
}

export interface Gate {
  key: string; // định danh điểm dừng (vd "shadow:3", "hold:12")
  line: number; // câu gắn với điểm dừng (để biết đã qua hay chưa khi tua)
  kind: string;
  ms: number | null; // tự phát tiếp sau ms; null = chờ người học
}
export interface Held extends Gate {
  at: number; // performance.now() lúc bắt đầu chờ
}

function readRate(key: string | undefined): number | null {
  if (!key) return null;
  try {
    const v = Number(JSON.parse(localStorage.getItem(key) ?? "null"));
    return SPEEDS.includes(v) ? v : null;
  } catch {
    return null;
  }
}
function writeRate(key: string | undefined, v: number) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* không lưu được thì thôi — phiên này vẫn đổi được */
  }
}

// Ref của <audio>, thanh tua và đồng hồ do component tạo rồi truyền vào (JSX gắn ref trực tiếp).
export function useLessonAudio<L extends TimedLine>({
  lines,
  onFrame,
  gate,
  seekGates,
  onEnded,
  rateKey,
  audioRef,
  rangeRef,
  clockRef,
}: {
  lines: readonly L[];
  onFrame?: (t: number) => void; // tư thế cảnh / bảng theo thời điểm (mỗi khung khi phát, và sau tua/dừng)
  gate?: (i: number, t: number) => Gate | null;
  // tua tới câu k: điểm dừng nào coi như đã qua thêm (Video: bấm đúng lượt của vai mình thì phát luôn câu mẫu)
  seekGates?: (k: number) => string[];
  onEnded?: () => void;
  rateKey?: string; // localStorage — nhớ tốc độ qua lần mở
  audioRef: RefObject<HTMLAudioElement | null>;
  rangeRef?: RefObject<HTMLInputElement | null>;
  clockRef?: RefObject<HTMLSpanElement | null>;
}) {
  const idxRef = useRef(-1);
  const hiRef = useRef(-1);
  const loopRef = useRef<number | null>(null); // câu đang lặp (null = tắt)
  const stopAt = useRef<number | null>(null); // nghe MỘT câu rồi dừng
  const passed = useRef(new Map<string, number>()); // điểm dừng đã qua → câu
  const armedFrom = useRef(0); // điểm dừng của câu < armedFrom coi như đã qua
  const holdTimer = useRef<number | null>(null);
  const dragging = useRef(false); // đang kéo thanh tua → không ghi đè vị trí thumb
  const frame = useRef(onFrame);
  const gateRef = useRef(gate);
  const seekGatesRef = useRef(seekGates);
  const endedRef = useRef(onEnded);
  useEffect(() => {
    frame.current = onFrame;
    gateRef.current = gate;
    seekGatesRef.current = seekGates;
    endedRef.current = onEnded;
  }, [onFrame, gate, seekGates, onEnded]);
  const [idx, setIdx] = useState(-1);
  const [hi, setHi] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [everPlayed, setEverPlayed] = useState(false);
  const [ended, setEnded] = useState(false);
  const [loop, setLoop] = useState(false);
  const [held, setHeld] = useState<Held | null>(null);
  const [rate, setRate] = useState(1);

  // Tốc độ đã lưu (sau mount — tránh lệch SSR).
  useEffect(() => {
    const r = readRate(rateKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc localStorage một lần sau mount
    if (r) setRate(r);
  }, [rateKey]);

  const getTime = useCallback(() => audioRef.current?.currentTime ?? 0, [audioRef]);

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHeld(null);
  }, []);

  const startHold = useCallback(
    (g: Gate) => {
      const el = audioRef.current;
      if (!el) return;
      el.pause();
      passed.current.set(g.key, g.line);
      setHeld({ ...g, at: performance.now() });
      if (g.ms !== null)
        holdTimer.current = window.setTimeout(() => {
          holdTimer.current = null;
          setHeld(null);
          void el.play().catch(() => {});
        }, g.ms);
    },
    [audioRef],
  );

  // Đồng bộ MỌI thứ theo currentTime.
  const sync = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    const t = el.currentTime;
    if (stopAt.current !== null && !el.paused && t >= stopAt.current) {
      stopAt.current = null;
      el.pause();
    }
    const L = loopRef.current;
    if (L !== null && !el.paused && (t >= lines[L].end + 0.35 || lineIndexAt(lines, t) > L)) {
      el.currentTime = Math.max(0, lines[L].start - 0.08);
      return;
    }
    const i = lineIndexAt(lines, t);
    if (!el.paused && stopAt.current === null && L === null && gateRef.current) {
      const g = gateRef.current(i, t);
      if (g && g.line >= armedFrom.current && !passed.current.has(g.key)) {
        startHold(g);
        return;
      }
    }
    if (i !== idxRef.current) {
      idxRef.current = i;
      setIdx(i);
    }
    const c = i >= 0 ? wordAt(lines[i], t) : -1;
    if (c !== hiRef.current) {
      hiRef.current = c;
      setHi(c);
    }
    frame.current?.(t);
    if (rangeRef?.current && !dragging.current) rangeRef.current.value = String(t);
    if (clockRef?.current) clockRef.current.textContent = fmtTime(t);
  }, [lines, audioRef, rangeRef, clockRef, startHold]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      sync();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, sync]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, audioRef]);

  useEffect(() => () => clearHold(), [clearHold]);

  const play = useCallback(() => {
    void audioRef.current?.play().catch(() => {});
  }, [audioRef]);

  // Sang câu k: điểm dừng của câu ≥ k được "làm lại", của câu < k coi như đã qua.
  const rearm = useCallback((k: number) => {
    for (const [key, line] of [...passed.current]) if (line >= k) passed.current.delete(key);
    armedFrom.current = k;
    for (const key of seekGatesRef.current?.(k) ?? []) passed.current.set(key, k);
  }, []);

  const seekLine = useCallback(
    (i: number, once = false) => {
      const el = audioRef.current;
      if (!el || !lines.length) return;
      clearHold();
      const k = Math.max(0, Math.min(lines.length - 1, i));
      stopAt.current = once ? lines[k].end + 0.25 : null;
      rearm(k);
      el.currentTime = Math.max(0, lines[k].start - 0.08);
      if (loopRef.current !== null) loopRef.current = k;
      setEnded(false);
      play();
      sync();
    },
    [lines, play, sync, clearHold, rearm, audioRef],
  );
  const playOnce = useCallback((i: number) => seekLine(i, true), [seekLine]);

  // Bỏ chờ (người học bấm "tiếp" / "xem đáp án") → phát tiếp ngay.
  const resume = useCallback(() => {
    clearHold();
    play();
  }, [clearHold, play]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    stopAt.current = null;
    if (holdTimer.current !== null || held) return resume();
    if (el.paused) {
      if (el.ended) {
        el.currentTime = 0;
        passed.current.clear();
        armedFrom.current = 0;
      }
      play();
    } else el.pause();
  }, [play, held, resume, audioRef]);

  const prev = useCallback(() => {
    const el = audioRef.current;
    const i = idxRef.current;
    if (!el || i < 0) return seekLine(0);
    seekLine(el.currentTime - lines[i].start > 1.2 ? i : i - 1);
  }, [lines, seekLine, audioRef]);
  const next = useCallback(() => seekLine(idxRef.current + 1), [seekLine]);

  // Phím tắt (máy tính): Space/K = phát/dừng, ←/→ = câu trước/sau, R = nghe lại câu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (el?.closest?.("[role=dialog]")) return;
      if (e.key === " " && el?.closest?.("button, a, [role=button]")) return; // nút đang focus tự kích hoạt
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "r") seekLine(Math.max(0, idxRef.current));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, prev, next, seekLine]);

  // Rời trang → dừng hẳn (không phát nền khi đã sang màn khác).
  useEffect(() => {
    const el = audioRef.current;
    return () => el?.pause();
  }, [audioRef]);

  const cycleRate = useCallback(() => {
    const n = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length] ?? 1;
    writeRate(rateKey, n);
    setRate(n);
  }, [rate, rateKey]);
  const setLooping = useCallback((on: boolean) => {
    setLoop(on);
    loopRef.current = on ? Math.max(0, idxRef.current) : null;
  }, []);
  const toggleLoop = useCallback(() => setLooping(!loop), [loop, setLooping]);
  const pause = useCallback(() => audioRef.current?.pause(), [audioRef]);
  // Đổi chế độ luyện (nói theo / nhập vai…): mọi điểm dừng được làm lại từ đầu.
  const resetGates = useCallback(() => {
    clearHold();
    passed.current.clear();
    armedFrom.current = 0;
  }, [clearHold]);

  // Thuộc tính cho <audio> (nguồn + preload do nơi gọi đặt).
  const audioProps = {
    onPlay: () => {
      stopAudio(); // tắt audio khác (từ / câu ví dụ) đang phát
      setPlaying(true);
      setEverPlayed(true);
      setEnded(false);
    },
    onPause: () => {
      setPlaying(false);
      sync();
    },
    onEnded: () => {
      setPlaying(false);
      setEnded(true);
      passed.current.clear();
      armedFrom.current = 0;
      sync();
      endedRef.current?.();
    },
    onSeeked: sync,
    onLoadedMetadata: (e: SyntheticEvent<HTMLAudioElement>) => {
      e.currentTarget.playbackRate = rate;
    },
  };
  // Thuộc tính cho thanh tua <input type="range">.
  const rangeProps = {
    onPointerDown: () => void (dragging.current = true),
    onPointerUp: () => void (dragging.current = false),
    onPointerCancel: () => void (dragging.current = false),
    onInput: (e: SyntheticEvent<HTMLInputElement>) => {
      const el = audioRef.current;
      if (!el) return;
      clearHold();
      el.currentTime = Number(e.currentTarget.value);
      const k = Math.max(0, lineIndexAt(lines, el.currentTime));
      if (loopRef.current !== null) loopRef.current = k;
      rearm(k);
      setEnded(false);
      sync();
    },
  };

  return {
    idx,
    hi,
    playing,
    everPlayed,
    ended,
    loop,
    held,
    rate,
    getTime,
    sync,
    play,
    pause,
    toggle,
    resume,
    seekLine,
    playOnce,
    prev,
    next,
    cycleRate,
    toggleLoop,
    setLooping,
    resetGates,
    audioProps,
    rangeProps,
  };
}
