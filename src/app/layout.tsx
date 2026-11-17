import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { DirectionProvider } from "@/components/ui/direction";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-sans",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "لوحة جمعية إهداء",
  description: "متابعة تبرعات جمعية إهداء لكل قناة ومشروع",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${plexArabic.variable} h-full antialiased`}>
      <body className="min-h-full">
        <DirectionProvider dir="rtl">
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster position="top-center" dir="rtl" />
          </TooltipProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}
