// Khởi tạo Firebase (client, LƯỜI HOÀN TOÀN) — không import tĩnh SDK nào ở top-level
// để first-load không chứa cả firebase/app lẫn firebase/auth (~330KB). Mọi SDK chỉ được
// dynamic-import khi thật sự cần (kiểm tra đăng nhập nền / bấm đăng nhập / đồng bộ).
// Config web Firebase là CÔNG KHAI theo thiết kế; bảo mật đến từ Auth + Firestore Rules.
import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(config.apiKey && config.projectId);

// UID được phép vào app — hỗ trợ NHIỀU tài khoản, ngăn cách bằng dấu phẩy.
// Để trống = cho phép mọi tài khoản đã đăng nhập (tiện lúc mới setup để lấy UID);
// điền vào sau khi những người cần dùng đã đăng nhập xong để khoá lại.
export const ALLOWED_UIDS: string[] = (process.env.NEXT_PUBLIC_OWNER_UID ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Chưa khoá (danh sách rỗng) → ai cũng vào được; đã khoá → phải nằm trong danh sách. */
export const isAllowed = (uid: string | null | undefined): boolean =>
  !ALLOWED_UIDS.length || (!!uid && ALLOWED_UIDS.includes(uid));

let appPromise: Promise<FirebaseApp | null> | null = null;
let authPromise: Promise<Auth | null> | null = null;

/** App Firebase dùng chung (dynamic-import firebase/app lần đầu gọi). */
export function getFbApp(): Promise<FirebaseApp | null> {
  if (!firebaseEnabled || typeof window === "undefined") return Promise.resolve(null);
  if (!appPromise) {
    appPromise = import("firebase/app").then(({ getApps, initializeApp }) => getApps()[0] ?? initializeApp(config));
  }
  return appPromise;
}

/** Auth dùng chung (dynamic-import firebase/auth lần đầu gọi). */
export function getFbAuth(): Promise<Auth | null> {
  if (!firebaseEnabled || typeof window === "undefined") return Promise.resolve(null);
  if (!authPromise) {
    authPromise = Promise.all([getFbApp(), import("firebase/auth")]).then(([app, { getAuth }]) =>
      app ? getAuth(app) : null,
    );
  }
  return authPromise;
}
