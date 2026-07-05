'use client';

import { useEffect, useRef, useState } from 'react';

interface AdBannerProps {
  position: 'top' | 'bottom';
  className?: string;
}

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
            Adsterra {position === 'top' ? 'Top' : 'Bottom'} Banner
          </span>
          <span className="w-16 h-6 bg-gray-200/50 rounded flex items-center justify-center text-[8px] text-gray-500">
            728x90
          </span>
          
          {/* ⚠️ REPLACE THIS WITH YOUR ADSTERRA BANNER CODE */}
          <div className="hidden" id={`adsterra-banner-${position}`}>
            <script
              type="text/javascript"
              dangerouslySetInnerHTML={{
                __html: `
                  atOptions = {
                    'key' : 'YOUR_BANNER_KEY_HERE',
                    'format' : 'iframe',
                    'height' : 90,
                    'width' : 728,
                    'params' : {}
                  };
                `
              }}
            />
            <script
              type="text/javascript"
              src="//www.highperformanceformat.com/YOUR_BANNER_KEY_HERE/invoke.js"
              async
            />
          </div>
        </div>
      )}
    </div>
  );
}