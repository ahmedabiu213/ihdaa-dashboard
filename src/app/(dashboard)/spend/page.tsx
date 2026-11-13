import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      href="/spend"
      planned={["إدخال الإنفاق اليومي لكل منصة", "رفع ملف CSV من مدير الإعلانات", "مراجعة وتعديل ما تم إدخاله"]}
    />
  );
}
