import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import ConditionalBottomNav from "@/components/nav/ConditionalBottomNav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "YouTask",
  description: "Earn rewards by listening to audio",
  icons: {
    icon: "/logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* ✅ Global Monetag script yahan se hata diya gaya hai.
            Ab ad sirf jahan <AdBanner /> component call hoga wahi load hoga
            (Tasks, Bronze, aur jahan bhi tum aage add karo) */}

        <main className="pb-20 sm:pb-24">
          {children}
        </main>
        
        <ConditionalBottomNav />
        <Toaster position="top-right" richColors closeButton />
        <SpeedInsights />
      </body>
    </html>
  );
}