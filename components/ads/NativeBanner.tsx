'use client';

import { useEffect, useRef, useState } from 'react';

interface NativeBannerProps {
  onComplete?: () => void;
  duration?: number;
  className?: string;
}

export default function NativeBanner({ 
  onComplete, 
  duration = 5,
  className = '' 
}: NativeBannerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ Load native ad
  useEffect(() => {
    const loadNativeAd = () => {
      try {
        const script = document.createElement('script');
        script.dataset.zone = '11270526';
        script.src = 'https://nap5k.com/tag.min.js';
        script.async = true;
        
        const target = containerRef.current;
        if (target) {
          target.appendChild(script);
          setIsLoaded(true);
        }
      } catch (error) {
        console.error('Native banner load error:', error);
        setIsLoaded(true); // Continue even if ad fails
      }
    };

    const timer = setTimeout(loadNativeAd, 100);
    return () => clearTimeout(timer);
  }, []);

  // ✅ Timer for auto-navigation
  useEffect(() => {
    if (!isLoaded) return;

    setSecondsLeft(duration);
    
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // ✅ Call onComplete when timer finishes
          if (onComplete) {
            onComplete();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isLoaded, duration, onComplete]);

  return (
    <div 
      ref={containerRef}
      className={`w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-4 ${className}`}
    >
      {!isLoaded ? (
        <div className="flex items-center justify-center gap-2 min-h-[60px]">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-400 border-t-transparent" />
          <span className="text-sm text-gray-400">Loading ad...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Native Ad Container */}
          <div id="native-ad-container" className="w-full min-h-[60px]" />
          
          {/* Timer */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              📢 Continuing in {secondsLeft}s...
            </p>
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-1000"
                style={{ width: `${((duration - secondsLeft) / duration) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}