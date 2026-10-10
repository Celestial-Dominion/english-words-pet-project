import SettingsPanel from "@/components/settings-panel";

// Trang giữ lại cho đường dẫn cũ /cai-dat — nội dung y hệt ngăn Cài đặt (nút ⚙️ trên topbar).
export default function CaiDatPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Cài đặt</h1>
      <SettingsPanel />
    </div>
  );
}
