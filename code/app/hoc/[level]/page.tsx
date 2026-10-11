import { notFound } from "next/navigation";
import { LEVELS } from "@/lib/levels";
import WordBrowser from "@/components/word-browser";

// Static export: 6 cấp A1–C2 (A1 = -1, A2 = 0, B1..C2 = 1..4 — xem lib/levels.ts). Cấp nằm dưới
// cấp bắt đầu của người học vẫn mở được, nhưng chỉ để tra cứu (WordBrowser tự xử).
export function generateStaticParams() {
  return LEVELS.map((l) => ({ level: String(l.level) }));
}

export default async function Page({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const n = Number(level);
  if (!LEVELS.some((l) => l.level === n)) notFound();
  return <WordBrowser level={n} />;
}
