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
        {/* Monetag In-Page Push - Loaded once globally */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Only load if not already loaded
                if (!window.__monetagLoaded) {
                  window.__monetagLoaded = true;
                  var s = document.createElement('script');
                  s.dataset.zone = '11270526';
                  s.src = 'https://nap5k.com/tag.min.js';
                  var target = document.documentElement || document.body;
                  if (target) target.appendChild(s);
                }
              })();
            `,
          }}
        />

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