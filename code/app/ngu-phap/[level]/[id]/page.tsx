import { GrammarPlayer } from "@/components/grammar/grammar-player";
import { grammarIndex, toRef } from "@/lib/grammar-server";

// Sinh tĩnh mọi bài trong chỉ mục; nội dung bài (JSON ?v=hash) + audio tải phía client khi mở. Liên kết (tiên quyết,
// dễ nhầm, liên quan, câu trong Thư viện, bài tiếp) tính lúc build từ chỉ mục — JSON bài không phải build lại khi đổi.
export function generateStaticParams() {
  return grammarIndex().lessons.map((l) => ({ level: l.lv, id: l.id }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ level: string; id: string }> }) {
  const { id } = await params;
  const l = grammarIndex().lessons.find((x) => x.id === id);
  return { title: l ? `${l.t} · Ngữ pháp` : "Ngữ pháp" };
}

export default async function GrammarLessonPage({ params }: { params: Promise<{ level: string; id: string }> }) {
  const { id } = await params;
  const { lessons } = grammarIndex();
  const i = lessons.findIndex((l) => l.id === id);
  const l = lessons[i];
  const byId = new Map(lessons.map((x) => [x.id, x]));
  const refs = (ids: string[] = []) => ids.map((x) => byId.get(x)).filter((m) => !!m).map((m) => toRef(m!));
  const nx = lessons[i + 1];
  return (
    <GrammarPlayer
      id={id}
      v={l?.v ?? ""}
      links={{ next: nx ? toRef(nx) : undefined, pre: refs(l?.pre), vs: refs(l?.vs), rel: refs(l?.rel), corpus: l?.corpus ?? [] }}
    />
  );
}
