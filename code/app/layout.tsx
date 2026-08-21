import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Settings } from "lucide-react";
import "./globals.css";
import SwRegister from "@/components/sw-register";
import BottomNav from "@/components/bottom-nav";
import MainNav from "@/components/main-nav";
import LevelChip from "@/components/level-chip";
import { ThemeToggle } from "@/components/theme-toggle";
import AuthSync from "@/components/auth-sync";
import AuthGate from "@/components/auth-gate";
import { StorageAlert } from "@/components/storage-alert";

export const metadata: Metadata = {
  title: "Từ vựng tiếng Anh",
  description:
    "Học từ vựng tiếng Anh trung cấp đến thành thạo (B1–C2) — nghĩa tiếng Việt, phát âm, ôn tập ngắt quãng.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "English", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('en.theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})();`,
          }}
        />
        <SwRegister />
        <AuthGate>
        <header
          className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              {/* Mỏ neo trên nền navy — theme Hải trình, đồng bộ với icon PWA (public/icon.svg) */}
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary shadow-sm">
                <svg viewBox="0 0 36 36" className="size-9" aria-hidden="true">
                  <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" className="text-primary-foreground">
                    <circle cx="18" cy="9" r="2.6" />
                    <path d="M18 11.6 L18 28" />
                    <path d="M12.5 16 L23.5 16" />
                    <path d="M8.5 21.5 C9.5 26.5 13 29 18 29 C23 29 26.5 26.5 27.5 21.5" />
                    <path d="M8.5 21.5 L6.5 24.5 M8.5 21.5 L11.5 23" />
                    <path d="M27.5 21.5 L29.5 24.5 M27.5 21.5 L24.5 23" />
                  </g>
                </svg>
              </span>
              <span className="text-base font-bold tracking-tight">English</span>
            </Link>
            <div className="ml-2 hidden min-w-0 flex-1 md:block">
              <MainNav />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <LevelChip />
              <AuthSync />
              <ThemeToggle />
              <Link
                href="/cai-dat"
                aria-label="Cài đặt"
                className="grid size-9 place-items-center rounded-full border bg-background text-muted-foreground transition-colors hover:text-foreground"
              >
                <Settings className="size-4" />
              </Link>
            </div>
          </div>
        </header>
        <StorageAlert />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-10">
          {children}
        </main>
        <BottomNav />
        </AuthGate>
      </body>
    </html>
  );
}
