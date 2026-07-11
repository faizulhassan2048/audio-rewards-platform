'use client';

import { useEffect, useRef, useState } from 'react';

interface AdBannerProps {
  position: 'top' | 'bottom';
  className?: string;
}

// TODO: Once you have a Monetag account, replace ZONE_ID below with your
// real banner/in-page-push zone ID from the Monetag dashboard.
const MONETAG_BANNER_ZONE_ID = 'YOUR_MONETAG_ZONE_ID';

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

  // Injects the real Monetag script tag once you fill in the zone ID above.
  // Left inactive (early-return) while the zone ID is still the placeholder,
  // so nothing broken loads in the meantime.
  useEffect(() => {
    if (MONETAG_BANNER_ZONE_ID === 'YOUR_MONETAG_ZONE_ID') return;
    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement('script');
    script.async = true;
    // ⚠️ Replace with the exact <script> src Monetag gives you for this
    // banner zone — the URL format varies by account/zone type, so copy it
    // verbatim from your Monetag dashboard rather than guessing it here.
    script.src = `https://YOUR_MONETAG_SCRIPT_DOMAIN/tag.min.js`;
    script.setAttribute('data-zone', MONETAG_BANNER_ZONE_ID);
    container.appendChild(script);

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