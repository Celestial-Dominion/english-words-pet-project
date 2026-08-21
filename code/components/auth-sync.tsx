"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { User } from "firebase/auth";
import { LogIn, RefreshCw, LogOut, Check, AlertTriangle } from "lucide-react";
import { firebaseEnabled, watchAuth, googleSignIn, signOutUser } from "@/lib/sync";
import { getSyncStatus, getServerSyncStatus, onSyncStatus, isStale } from "@/lib/sync-status";
import { cn } from "@/lib/utils";

export default function AuthSync() {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const syncedOnce = useRef(false);
  // S6: chỉ báo lỗi đồng bộ — sync hỏng nhiều lần liên tiếp thì hiện chấm đỏ trên avatar,
  // để không âm thầm mất backup nhiều ngày mà không hay.
  const status = useSyncExternalStore(onSyncStatus, getSyncStatus, getServerSyncStatus);

  useEffect(() => watchAuth(setUser), []);

  // Tự đồng bộ 1 lần khi phát hiện đã đăng nhập — HOÃN sau first paint (~2,5s hoặc lúc
  // trình duyệt rảnh) để không tranh mạng/CPU với việc render; sync-data dynamic-import
  // nên Firestore SDK cũng chỉ tải lúc này.
  useEffect(() => {
    if (!user) {
      syncedOnce.current = false;
      return;
    }
    if (syncedOnce.current) return;
    syncedOnce.current = true;
    const run = () => void doSync(user, true);
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 5000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(run, 2500);
    return () => window.clearTimeout(id);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Đẩy sync khi: kết thúc phiên học (event "en:sync") + khi rời/ẩn app (pagehide) —
  // trước đây chỉ sync lúc mở app nên kết quả học nằm kẹt trên máy tới lần mở sau.
  useEffect(() => {
    if (!user) return;
    let t: number | undefined;
    const onRequest = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => void doSync(user, true), 2000); // gộp nhiều yêu cầu gần nhau
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") void doSync(user, true);
    };
    // S3: QUAY LẠI app → kéo thay đổi từ máy khác. Rẻ nhờ fingerprint (không đổi = 1 getDoc).
    // Chặn dội: chỉ chạy nếu lần sync trước đã quá 60s.
    let lastVisibleSync = 0;
    const onShow = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastVisibleSync < 60_000) return;
      lastVisibleSync = Date.now();
      void doSync(user, true);
    };
    window.addEventListener("en:sync", onRequest);
    document.addEventListener("visibilitychange", onHide);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("en:sync", onRequest);
      document.removeEventListener("visibilitychange", onHide);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
      window.removeEventListener("pagehide", onHide);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!firebaseEnabled) return null;

  async function doSync(u: User, auto = false) {
    setBusy(true);
    setMsg(null);
    try {
      const { syncNow } = await import("@/lib/sync-data");
      const r = await syncNow(u.uid);
      // Sync tự động bị bỏ qua (không gì đổi) → im lặng; bấm tay thì vẫn báo.
      if (!(auto && r.skipped)) setMsg(r.skipped ? "Không có gì mới" : `Đã đồng bộ ${r.reviews} thẻ`);
    } catch (e) {
      const { setSyncError } = await import("@/lib/sync-status");
      setSyncError(e instanceof Error ? e.message : "Đồng bộ lỗi");
      setMsg("Đồng bộ lỗi");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <button
        onClick={async () => {
          setBusy(true);
          try {
            await googleSignIn();
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        <LogIn className="size-4" /> Đăng nhập
      </button>
    );
  }

  const initial = (user.displayName || user.email || "?").charAt(0).toUpperCase();
  const warn = isStale(status);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid size-9 place-items-center overflow-hidden rounded-full border bg-primary/10 text-sm font-bold text-primary"
        aria-label={warn ? "Tài khoản — đồng bộ đang lỗi" : "Tài khoản"}
      >
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photoURL} alt="" className="size-full object-cover" />
        ) : (
          initial
        )}
      </button>
      {warn && (
        <span
          className="pointer-events-none absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-background"
          aria-hidden
        />
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-56 rounded-2xl border bg-background p-2 shadow-lg">
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {user.displayName || user.email}
            </div>
            {warn && (
              <div className="mb-1 flex items-start gap-1.5 rounded-lg bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Đồng bộ lỗi {status.failCount} lần.
                  {status.lastOk
                    ? ` Lần cuối thành công: ${new Date(status.lastOk).toLocaleDateString("vi")}.`
                    : " Chưa từng đồng bộ được."}
                </span>
              </div>
            )}
            <button
              onClick={() => doSync(user)}
              disabled={busy}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={cn("size-4", busy && "animate-spin")} /> Đồng bộ ngay
            </button>
            <button
              onClick={async () => {
                setOpen(false);
                await signOutUser();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted"
            >
              <LogOut className="size-4" /> Đăng xuất
            </button>
            {msg && (
              <div className="mt-1 flex items-center gap-1.5 px-2 text-xs text-emerald-600 dark:text-emerald-400">
                <Check className="size-3.5" /> {msg}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
