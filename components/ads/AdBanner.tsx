'use client';

import { useEffect, useRef, useState } from 'react';

interface AdBannerProps {
  position: 'top' | 'bottom';
  className?: string;
}

// NOTE: the actual Monetag In-Page Push script (zone 11270526) is loaded
// ONCE, globally, in app/layout.tsx — not here. "In-Page Push" is a
// push-notification-style ad unit that manages its own on-screen position
// itself; it isn't a classic banner tied to a specific <div>. Loading its
// script once per <AdBanner> instance (we render two: top + bottom) made
// Monetag inject the same widget twice, both landing in the same spot —
// which is exactly the "both show at top" bug. This component is now just
// the visual placeholder card for your own top/bottom layout slots.
export default function AdBanner({ position, className = '' }: AdBannerProps) {
  const [adLoaded, setAdLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulate ad loading
    const timer = setTimeout(() => {
      setAdLoaded(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full bg-white/50 rounded-xl p-1.5 flex items-center justify-center border border-gray-100/50 min-h-[50px] ${className}`}
    >
      {!adLoaded ? (
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-400 border-t-transparent" />
          <span className="text-[10px] text-gray-400">Loading ad...</span>
        </div>
      ) : (
        <div className="text-[10px] text-gray-400 flex items-center gap-2 w-full justify-center">
          <span>📢</span>
          <span className="font-medium text-gray-500">
            Monetag {position === 'top' ? 'Top' : 'Bottom'} Banner
          </span>
          <span className="w-16 h-6 bg-gray-200/50 rounded flex items-center justify-center text-[8px] text-gray-500">
            728x90
          </span>
        </div>
      )}
    </div>
  );
}