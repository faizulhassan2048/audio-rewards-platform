'use client';

import { useEffect, useRef, useState } from 'react';

interface AdBannerProps {
  position: 'top' | 'bottom';
  className?: string;
}

export default function AdBanner({ position, className = '' }: AdBannerProps) {
  const [adReady, setAdReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    // ✅ Force re-initialize on mount
    const initAd = () => {
      // Check if Monetag has rendered anything
      const monetagElements = document.querySelectorAll(
        `[data-zone="11270526"], .monetag, [class*="monetag"]`
      );
      
      if (monetagElements.length > 0) {
        setAdReady(true);
        console.log(`✅ Monetag ad detected (${position})`);
      } else {
        // Retry after delay
        setTimeout(() => {
          if (mountedRef.current) {
            const retryElements = document.querySelectorAll(
              `[data-zone="11270526"], .monetag, [class*="monetag"]`
            );
            if (retryElements.length > 0) {
              setAdReady(true);
              console.log(`✅ Monetag ad detected (${position}) after retry`);
            } else {
              // Force ready after 5 seconds
              setAdReady(true);
            }
          }
        }, 3000);
      }
    };

    const timer = setTimeout(initAd, 1500);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, [position]);

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
      <div 
        id={`monetag-banner-${position}`}
        className="w-full h-full flex items-center justify-center"
      >
        {!adReady ? (
          <div className="flex items-center gap-2 text-gray-400">
            <div className="animate-pulse flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse-dot" />
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse-dot animation-delay-200" />
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse-dot animation-delay-400" />
            </div>
            <span className="text-[10px]">Loading ad...</span>
          </div>
        ) : (
          <div className="w-full h-full" />
        )}
      </div>
    </div>
  );
}