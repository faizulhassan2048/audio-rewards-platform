'use client';

import { useEffect, useRef, useState } from 'react';

interface AdBannerProps {
  position: 'top' | 'bottom';
  className?: string;
}

// Real Monetag banner zone — verbatim from the Monetag dashboard.
const MONETAG_BANNER_ZONE_ID = '11270526';
const MONETAG_BANNER_SCRIPT_SRC = 'https://nap5k.com/tag.min.js';

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

  // Injects the real Monetag banner script — follows Monetag's own
  // recommended pattern (append to <html> or <body>, whichever exists)
  // rather than a local container, since that's what their snippet expects.
  useEffect(() => {
    const script = document.createElement('script');
    (script as any).dataset.zone = MONETAG_BANNER_ZONE_ID;
    script.src = MONETAG_BANNER_SCRIPT_SRC;
    const target = [document.documentElement, document.body].filter(Boolean).pop();
    target?.appendChild(script);
    return () => {
      script.remove();
    };
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