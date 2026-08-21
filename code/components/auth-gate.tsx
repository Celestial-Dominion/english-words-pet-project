"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { LogIn, ShieldAlert, Copy } from "lucide-react";
import { firebaseEnabled, ALLOWED_UIDS, isAllowed } from "@/lib/firebase";
import { watchAuth, googleSignIn, signOutUser } from "@/lib/sync";

const LAST_UID_KEY = "en.lastUid";

// Chặn toàn bộ app sau đăng nhập Google. Nếu đặt NEXT_PUBLIC_OWNER_UID (1 hoặc nhiều UID,
// ngăn cách bằng dấu phẩy) → chỉ những tài khoản đó vào được.
// RENDER LẠC QUAN: lần trước đã đăng nhập hợp lệ (localStorage) → hiện app NGAY, kiểm tra
// auth chạy nền; chỉ phủ màn đăng nhập khi xác định thật sự chưa đăng nhập.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [optimistic, setOptimistic] = useState(false);
  const [e2e, setE2e] = useState(false);

  useEffect(() => {
    // Đồng bộ với API TRÌNH DUYỆT (navigator, localStorage) — không có lúc SSR nên bắt buộc
    // đọc trong effect; đây đúng là ngoại lệ "subscribe to external system" của rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (process.env.NODE_ENV !== "production" && navigator.webdriver) setE2e(true);
    try {
      const last = localStorage.getItem(LAST_UID_KEY);
      if (last && isAllowed(last)) setOptimistic(true);
    } catch {
      /* bỏ qua */
    }
    return watchAuth((u) => {
      setUser(u);
      setReady(true);
      try {
        if (u && isAllowed(u.uid)) localStorage.setItem(LAST_UID_KEY, u.uid);
        else localStorage.removeItem(LAST_UID_KEY);
      } catch {
        /* bỏ qua */
      }
    });
  }, []);

  // Chưa cấu hình Firebase → chạy offline bình thường (không chặn).
  if (!firebaseEnabled) return <>{children}</>;

  // E2E (Playwright chạy dev): bỏ qua chặn đăng nhập — CHỈ ngoài production.
  // (đặt trong state để server/client render lần đầu giống nhau, tránh hydration mismatch)
  if (e2e) return <>{children}</>;

  // Đang xác định trạng thái đăng nhập: lần trước OK → hiện app luôn (đỡ màn "Đang tải…").
  if (!ready) {
    if (optimistic) return <>{children}</>;
    return <div className="grid min-h-dvh place-items-center text-muted-foreground">Đang tải…</div>;
  }

  // Chưa đăng nhập → màn hình đăng nhập.
  if (!user) {
    return (
      <Center>
        {/* Mỏ neo — cùng hình với logo header và icon PWA (public/icon.svg) */}
        <div className="grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <svg viewBox="0 0 36 36" className="size-16" aria-hidden="true">
            <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <circle cx="18" cy="9" r="2.6" />
              <path d="M18 11.6 L18 28" />
              <path d="M12.5 16 L23.5 16" />
              <path d="M8.5 21.5 C9.5 26.5 13 29 18 29 C23 29 26.5 26.5 27.5 21.5" />
              <path d="M8.5 21.5 L6.5 24.5 M8.5 21.5 L11.5 23" />
              <path d="M27.5 21.5 L29.5 24.5 M27.5 21.5 L24.5 23" />
            </g>
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-bold">Từ vựng tiếng Anh</h1>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Ứng dụng riêng — đăng nhập bằng Google để vào và đồng bộ tiến độ.
        </p>
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
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
        >
          <LogIn className="size-5" /> Đăng nhập bằng Google
        </button>
      </Center>
    );
  }

  // Đã đăng nhập nhưng KHÔNG phải chủ sở hữu → từ chối.
  if (!isAllowed(user.uid)) {
    return (
      <Center>
        <div className="grid size-16 place-items-center rounded-2xl bg-destructive/15 text-destructive">
          <ShieldAlert className="size-8" />
        </div>
        <h1 className="mt-4 text-xl font-bold">Không có quyền truy cập</h1>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Đây là ứng dụng riêng. Tài khoản <b>{user.email}</b> không được phép.
        </p>
        <button
          onClick={() => signOutUser()}
          className="mt-6 rounded-2xl border px-6 py-3 font-medium hover:bg-muted"
        >
          Đăng xuất
        </button>
      </Center>
    );
  }

  // Chưa khoá → cho vào nhưng nhắc lấy UID để khoá.
  return (
    <>
      {!ALLOWED_UIDS.length && <OwnerHint uid={user.uid} />}
      {children}
    </>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-4 text-center">
      {children}
    </div>
  );
}

// Banner hiện UID (chỉ khi chưa khoá) để chủ copy rồi đặt vào NEXT_PUBLIC_OWNER_UID.
function OwnerHint({ uid }: { uid: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
      <div className="font-medium text-amber-700 dark:text-amber-300">⚠ App chưa khoá theo tài khoản</div>
      <div className="mt-1 text-muted-foreground">UID của bạn (đặt vào NEXT_PUBLIC_OWNER_UID để khoá app):</div>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(uid).then(() => setCopied(true));
        }}
        className="mt-1.5 flex w-full items-center gap-2 rounded-lg bg-background px-2.5 py-2 font-mono text-xs"
      >
        <Copy className="size-3.5 shrink-0" />
        <span className="truncate">{uid}</span>
        {copied && <span className="ml-auto shrink-0 text-emerald-600 dark:text-emerald-400">đã copy</span>}
      </button>
    </div>
  );
}
