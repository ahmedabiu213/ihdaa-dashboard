import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      href="/donations"
      planned={["سجل كامل للتبرعات مع البحث", "مصدر كل تبرع وحملته وإعلانه", "تصدير CSV"]}
    />
  );
}
