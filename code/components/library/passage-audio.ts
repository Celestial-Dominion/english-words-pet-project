"use client";

// Nghe cả bài/chương bằng MỘT file audio + mốc câu (lib/library PassageAudio): câu đang đọc tô sáng,
// tự cuộn (nhường 4 s khi người dùng tự cuộn), bấm câu để nghe từ câu đó, đổi tốc độ (nhớ qua lần mở).
import { useCallback, useEffect, useRef, useState } from "react";
import { passageAudioUrl, type PassageAudio } from "@/lib/library";
import { stopAudio } from "@/lib/tts";

const SPEEDS = [1, 1.25, 1.5, 0.75];
const RATE_KEY = "en.readRate";

function sentenceAt(starts: number[], t: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= t + 0.02) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export function usePassageAudio(audio: PassageAudio | undefined, domPrefix: string) {
  const el = useRef<HTMLAudioElement | null>(null);
  const [active, setActive] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const activeRef = useRef(-1);
  const lastUser = useRef(0);
  const stopAfter = useRef<number | null>(null);

  useEffect(() => {
    try {
      const r = Number(localStorage.getItem(RATE_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc lựa chọn đã lưu một lần sau mount
      if (SPEEDS.includes(r)) setRate(r);
    } catch {
      /* không có localStorage */
    }
  }, []);

  // Một <audio> cho mỗi track; đổi bài/chương → dừng + tạo lại.
  useEffect(() => {
    if (!audio) return;
    const a = new Audio();
    a.preload = "none";
    a.src = passageAudioUrl(audio);
    el.current = a;
    const onPlay = () => {
      setPlaying(true);
    };
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      setPlaying(false);
      activeRef.current = -1;
      setActive(-1);
    };
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnd);
    return () => {
      a.pause();
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnd);
      el.current = null;
      activeRef.current = -1;
      setActive(-1);
      setPlaying(false);
    };
  }, [audio]);

  useEffect(() => {
    if (el.current) el.current.playbackRate = rate;
  }, [rate, audio]);

  useEffect(() => {
    const mark = () => (lastUser.current = Date.now());
    window.addEventListener("wheel", mark, { passive: true });
    window.addEventListener("touchmove", mark, { passive: true });
    return () => {
      window.removeEventListener("wheel", mark);
      window.removeEventListener("touchmove", mark);
    };
  }, []);

  // Vòng rAF khi đang phát: câu hiện tại theo currentTime.
  useEffect(() => {
    if (!playing || !audio) return;
    let raf = 0;
    const tick = () => {
      const a = el.current;
      if (!a) return;
      const t = a.currentTime;
      if (stopAfter.current !== null && t >= stopAfter.current) {
        stopAfter.current = null;
        a.pause();
      }
      const i = sentenceAt(audio.starts, t);
      if (i !== activeRef.current) {
        activeRef.current = i;
        setActive(i);
        if (i >= 0 && Date.now() - lastUser.current > 4000)
          document.getElementById(`${domPrefix}${i}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, audio, domPrefix]);

  const playFrom = useCallback(
    (i: number, once = false) => {
      const a = el.current;
      if (!a || !audio) return;
      stopAudio();
      const k = Math.max(0, Math.min(audio.starts.length - 1, i));
      a.currentTime = Math.max(0, audio.starts[k] - 0.06);
      stopAfter.current = once ? audio.ends[k] + 0.2 : null;
      activeRef.current = k;
      setActive(k);
      void a.play().catch(() => {});
    },
    [audio],
  );

  const toggle = useCallback(() => {
    const a = el.current;
    if (!a) return;
    stopAfter.current = null;
    if (a.paused) {
      stopAudio();
      if (a.ended || activeRef.current < 0) a.currentTime = 0;
      void a.play().catch(() => {});
    } else a.pause();
  }, []);

  const step = useCallback((d: number) => playFrom(Math.max(0, activeRef.current) + d), [playFrom]);

  const cycleRate = useCallback(() => {
    setRate((r) => {
      const n = SPEEDS[(SPEEDS.indexOf(r) + 1) % SPEEDS.length] ?? 1;
      try {
        localStorage.setItem(RATE_KEY, String(n));
      } catch {
        /* bỏ qua */
      }
      return n;
    });
  }, []);

  return { active, playing, rate, toggle, playFrom, step, cycleRate, available: !!audio };
}
