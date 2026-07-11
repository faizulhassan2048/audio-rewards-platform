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

// This was the actual cause of "zoomed out on mobile but fine on laptop".
// Without a viewport export, mobile browsers assume the page was built for
// a ~980px desktop layout and shrink everything to fit — resizing a
// desktop browser window never reproduces this, which is why it looked
// fine there. maximumScale/userScalable here also disable pinch-zoom.
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