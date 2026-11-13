import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      href="/utm"
      planned={["اختيار المنصة والمشروع", "روابط بمعرّفات الحملة والإعلان التلقائية", "سجل الروابط المُنشأة"]}
    />
  );
}
