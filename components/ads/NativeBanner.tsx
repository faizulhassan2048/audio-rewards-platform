'use client';

import { useEffect, useRef, useState } from 'react';

interface NativeBannerProps {
  position?: 'top' | 'bottom' | 'inline';
  className?: string;
}

export default function NativeBanner({ position = 'inline', className = '' }: NativeBannerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ✅ Native banner script load
    const loadNativeAd = () => {
      try {
        // ✅ Monetag Native Banner Zone
        const script = document.createElement('script');
        script.dataset.zone = '11270526'; // Your native zone ID
        script.src = 'https://nap5k.com/tag.min.js';
        script.async = true;
        
        const target = containerRef.current;
        if (target) {
          target.appendChild(script);
          setIsLoaded(true);
        }
      } catch (error) {
        console.error('Native banner load error:', error);
      }
    };

    // ✅ Load after component mounts
    const timer = setTimeout(loadNativeAd, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`w-full min-h-[60px] bg-white/50 rounded-xl border border-gray-100/50 flex items-center justify-center ${className}`}
    >
      {!isLoaded ? (
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-400 border-t-transparent" />
          <span className="text-[10px] text-gray-400">Loading native ad...</span>
        </div>
      ) : (
        <div id="native-ad-container" className="w-full" />
      )}
    </div>
  );
}