// Service worker tối giản, AN TOÀN cho bản static export (đồng bộ cách làm với HSK).
// - Điều hướng: MẠNG-TRƯỚC (luôn thấy bản mới ngay sau deploy); offline → trang đã cache (hoặc "/").
// - Tài nguyên tĩnh + data JSON: stale-while-revalidate (mở lại nhanh, tự cập nhật ngầm).
// - KHÔNG cache /audio (hàng chục nghìn MP3 — đã có Cache-Control immutable của trình duyệt)
//   và KHÔNG đụng cross-origin (Firebase online).
//
// Tăng số ở CACHE khi đổi logic file này → bản cũ bị xoá sạch lúc activate.
const CACHE = "en-words-v2";
const PRECACHE = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

// Trần số entry: tên file /_next/static/ có hash theo từng lần build, mà SWR không xoá entry
// cũ bao giờ → cache phình vô hạn theo số lần deploy. Cắt bớt entry vào sớm nhất khi vượt trần.
const MAX_ENTRIES = 260;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function cacheable(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/data/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/manifest.webmanifest"
  );
}

// Trang được cache theo ĐƯỜNG DẪN, bỏ query: /bai-doc?open=xyz và /bai-doc là cùng một
// tài liệu HTML, giữ riêng từng query chỉ làm phình cache.
const pageKey = (url) => url.origin + url.pathname;

async function put(req, res) {
  if (!res || !res.ok) return; // đừng cache 404/500: offline sẽ phục vụ lại đúng trang lỗi đó
  const cache = await caches.open(CACHE);
  await cache.put(req, res);
  const keys = await cache.keys();
  if (keys.length > MAX_ENTRIES) {
    for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) await cache.delete(k);
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return; // bỏ qua cross-origin
  if (url.pathname.startsWith("/audio/")) return; // audio: để HTTP cache của trình duyệt tự lo

  if (req.mode === "navigate") {
    const key = pageKey(url);
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          e.waitUntil(put(key, copy));
          return res;
        })
        .catch(() => caches.match(key).then((m) => m || caches.match("/"))),
    );
    return;
  }

  if (cacheable(url)) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req)
          .then((res) => {
            const copy = res.clone();
            e.waitUntil(put(req, copy));
            return res;
          })
          .catch(() => cached);
        return cached || net;
      }),
    );
  }
});
