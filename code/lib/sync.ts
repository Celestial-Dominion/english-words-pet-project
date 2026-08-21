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
