import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      href="/projects"
      planned={["التبرعات لكل مشروع", "توزيع كل مشروع على القنوات", "الزيارات ونسبة التحويل لصفحة المشروع"]}
    />
  );
}
