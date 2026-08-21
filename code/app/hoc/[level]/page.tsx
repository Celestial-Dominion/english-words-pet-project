import { notFound } from "next/navigation";
import { LEVELS, FOUNDATION } from "@/lib/levels";
import WordBrowser from "@/components/word-browser";

// Static export: 4 cấp học B1–C2 + bộ nền A1–A2 (level 0, chỉ tra cứu).
const BROWSABLE = [FOUNDATION, ...LEVELS];

export function generateStaticParams() {
  return BROWSABLE.map((l) => ({ level: String(l.level) }));
}

export default async function Page({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const n = Number(level);
  if (!BROWSABLE.some((l) => l.level === n)) notFound();
  return <WordBrowser level={n} />;
}
