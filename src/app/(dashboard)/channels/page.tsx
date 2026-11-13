import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      href="/channels"
      planned={["الإنفاق والتبرعات والعائد لكل منصة", "مقارنة أرقام المتجر بما تذكره المنصة", "اتجاه يومي لكل قناة"]}
    />
  );
}
