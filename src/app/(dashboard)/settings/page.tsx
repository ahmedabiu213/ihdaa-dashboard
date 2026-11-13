import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      href="/settings"
      planned={["ربط سناب شات وتيك توك وميتا", "سكربت إعلانات قوقل", "سكربت التتبع وWebhook سلة", "حالة آخر مزامنة"]}
    />
  );
}
