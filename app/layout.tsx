import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Main content with bottom padding for nav */}
        <main className="pb-20 sm:pb-24">
          {children}
        </main>
        
        {/* Bottom Navigation - hidden on landing page */}
        <ConditionalBottomNav />
        
        <Toaster position="top-right" richColors closeButton />
        <SpeedInsights />
      </body>
    </html>
  );
}
