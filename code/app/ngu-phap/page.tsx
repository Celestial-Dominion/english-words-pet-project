import Link from "next/link";
import { GrammarContinue, GrammarLevelGrid, type HubItem } from "@/components/grammar/grammar-hub";
import { grammarIndex } from "@/lib/grammar-server";

export const metadata = { title: "Ngữ pháp · Từ vựng tiếng Anh" };

export default function GrammarHubPage() {
  const { cats, lessons } = grammarIndex();
  const items: HubItem[] = lessons.map((l) => [l.id, l.lv, l.n, l.t, l.en]);
  const counts: Record<string, { lessons: number; min: number }> = {};
  for (const l of lessons) {
    const c = (counts[l.lv] ??= { lessons: 0, min: 0 });
    c.lessons++;
    c.min += l.dur / 60;
  }
  for (const c of Object.values(counts)) c.min = Math.round(c.min);
  const byCat = Object.entries(cats)
    .map(([id, name]) => [id, name, lessons.filter((l) => l.cat === id).length] as const)
    .filter(([, , n]) => n > 0);
  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Ngữ pháp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lộ trình ngữ pháp A1 → C2, {lessons.length} bài. Mỗi bài là một video giảng giải có bảng minh hoạ, trục thời gian, ví dụ đời
          thường, hội thoại, lỗi hay gặp và phần luyện tập — học theo thứ tự hoặc chọn theo chủ đề.
        </p>
      </div>
      <GrammarContinue items={items} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Theo cấp</h2>
        <GrammarLevelGrid counts={counts} items={items} />
      </section>
      {byCat.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Theo chủ đề</h2>
          <div className="flex flex-wrap gap-2">
            {byCat.map(([id, name, n]) => (
              <Link key={id} href={`/ngu-phap/chu-de/${id}`} className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted">
                {name}
                <span className="text-xs text-muted-foreground tabular-nums">{n}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
