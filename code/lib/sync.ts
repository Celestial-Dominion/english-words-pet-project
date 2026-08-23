// Đăng nhập Google — KHÔNG import tĩnh firebase/auth (chỉ import type, bị xoá khi build).
// SDK auth chỉ được dynamic-import khi gọi hàm → first-load không chứa Firebase.
import type { User } from "firebase/auth";
import { getFbAuth, firebaseEnabled } from "./firebase";

export function watchAuth(cb: (user: User | null) => void): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  void (async () => {
    const [auth, { onAuthStateChanged }] = await Promise.all([getFbAuth(), import("firebase/auth")]);
    if (!auth) {
      cb(null);
      return;
    }
    if (!cancelled) unsub = onAuthStateChanged(auth, cb);
  })();
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export async function googleSignIn(): Promise<User | null> {
  const [auth, { GoogleAuthProvider, signInWithPopup }] = await Promise.all([getFbAuth(), import("firebase/auth")]);
  if (!auth) return null;
  const res = await signInWithPopup(auth, new GoogleAuthProvider());
  return res.user;
}

export async function signOutUser(): Promise<void> {
  const [auth, { signOut }] = await Promise.all([getFbAuth(), import("firebase/auth")]);
  if (auth) await signOut(auth);
}

export { firebaseEnabled };

/** Yêu cầu đồng bộ nền (gộp debounce ở AuthSync) — gọi sau khi kết thúc phiên học/ôn. */
export function requestSync(): void {
  try {
    window.dispatchEvent(new Event("en:sync"));
  } catch {
    /* bỏ qua (SSR) */
  }
}

/** Sự kiện "vừa KÉO dữ liệu máy khác về" (sync-data phát sau khi merge xong).
 *  Mọi nơi hiển thị số liệu (số đến hạn, thống kê, nhiệm vụ ngày…) phải nghe sự kiện này
 *  và ĐỌC LẠI DB — không thì bấm "Đồng bộ ngay" xong con số trên màn vẫn là số cũ. */
export const SYNC_MERGED_EVENT = "en:sync-merged";
export function onSyncMerged(cb: () => void): () => void {
  window.addEventListener(SYNC_MERGED_EVENT, cb);
  return () => window.removeEventListener(SYNC_MERGED_EVENT, cb);
}
