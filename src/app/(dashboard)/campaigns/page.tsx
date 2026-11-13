import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      href="/campaigns"
      planned={["الحملات ثم المجموعات ثم الإعلانات", "الإنفاق والتبرعات وتكلفة التبرع لكل إعلان", "سناب شات أولًا ثم بقية المنصات"]}
    />
  );
}
