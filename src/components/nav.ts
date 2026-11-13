import {
  BarChart3, Banknote, FolderHeart, Link2, Megaphone, PlugZap, ReceiptText, Share2,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; description: string };

export const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "التقارير",
    items: [
      { href: "/", label: "نظرة عامة", icon: BarChart3, description: "التبرعات والإنفاق والعائد لكل القنوات" },
      { href: "/channels", label: "القنوات", icon: Share2, description: "أداء كل منصة إعلانية" },
      { href: "/campaigns", label: "الحملات", icon: Megaphone, description: "الحملات والمجموعات والإعلانات" },
      { href: "/projects", label: "المشاريع", icon: FolderHeart, description: "التبرعات لكل مشروع وقناة" },
      { href: "/donations", label: "التبرعات", icon: ReceiptText, description: "سجل التبرعات ومصدر كل تبرع" },
    ],
  },
  {
    label: "الأدوات",
    items: [
      { href: "/utm", label: "روابط UTM", icon: Link2, description: "إنشاء روابط موحّدة للإعلانات" },
      { href: "/spend", label: "الإنفاق اليدوي", icon: Banknote, description: "إدخال الإنفاق أو رفع ملف CSV" },
      { href: "/settings", label: "الربط والمزامنة", icon: PlugZap, description: "ربط المنصات وحالة المزامنة" },
    ],
  },
];

export const ALL_NAV = NAV.flatMap((g) => g.items);
