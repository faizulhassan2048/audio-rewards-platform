'use client';

import { useEffect, useRef, useState } from 'react';

interface AdBannerProps {
  position: 'top' | 'bottom';
  className?: string;
}

// Monetag In-Page Push Zone (already loaded in layout.tsx)
// This component now shows the actual ad container

export default function AdBanner({ position, className = '' }: AdBannerProps) {
  const [adReady, setAdReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Wait for Monetag script to load and render
    const checkAd = () => {
      // Check if Monetag has rendered anything
      const monetagElements = document.querySelectorAll(
        `[data-zone="11270526"], .monetag, [class*="monetag"]`
      );
      
      if (monetagElements.length > 0) {
        setAdReady(true);
        console.log('✅ Monetag ad detected');
      } else {
        // Retry after delay
        setTimeout(checkAd, 1000);
      }
    };

    // Start checking after 2 seconds
    const timer = setTimeout(checkAd, 2000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`
        w-full rounded-xl overflow-hidden
        bg-white/50 min-h-[60px] flex items-center justify-center
        border border-gray-100/50
        ${className}
      `}
    >
      {/* ✅ Monetag In-Page Push renders here */}
      <div 
        id={`monetag-banner-${position}`}
        className="w-full h-full flex items-center justify-center"
      >
        {!adReady ? (
          // Loading state - subtle and clean
          <div className="flex items-center gap-2 text-gray-400">
            <div className="animate-pulse flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animation-delay-200" />
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animation-delay-400" />
            </div>
            <span className="text-[10px]">Loading ad...</span>
          </div>
        ) : (
          // ✅ Ad will render here automatically via Monetag
          <div className="w-full h-full" />
        )}
      </div>
    </div>
  );
}