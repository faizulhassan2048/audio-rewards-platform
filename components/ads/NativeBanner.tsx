'use client';

import { useEffect, useRef, useState } from 'react';

interface NativeBannerProps {
  onComplete?: () => void;
  duration?: number;
  className?: string;
}

// ✅ Adsterra Native Banner - Dashboard ID 30276726
const NATIVE_ZONE_ID = '30276726';
const NATIVE_SCRIPT_URL = 'https://nap5k.com/tag.min.js';

export default function NativeBanner({ 
  onComplete, 
  duration = 5,
  className = '' 
}: NativeBannerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [adError, setAdError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const scriptLoadedRef = useRef(false);

  // ✅ Load native ad
  useEffect(() => {
    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    const loadNativeAd = () => {
      try {
        // ✅ Check if container exists
        if (!containerRef.current) {
          console.warn('⚠️ Native banner container not found');
          setIsLoaded(true);
          return;
        }

        // ✅ Clear any existing content
        containerRef.current.innerHTML = '';

        // ✅ Create container for ad
        const adContainer = document.createElement('div');
        adContainer.id = `native-ad-${NATIVE_ZONE_ID}`;
        adContainer.className = 'w-full min-h-[60px] flex items-center justify-center';
        containerRef.current.appendChild(adContainer);

        // ✅ Create and load script
        const script = document.createElement('script');
        script.dataset.zone = NATIVE_ZONE_ID;
        script.src = NATIVE_SCRIPT_URL;
        script.async = true;
        script.onload = () => {
          console.log('✅ Native banner loaded successfully');
          setIsLoaded(true);
        };
        script.onerror = () => {
          console.error('❌ Native banner failed to load');
          setAdError(true);
          setIsLoaded(true); // Continue even if ad fails
        };

        // ✅ Append script to container
        containerRef.current.appendChild(script);

        // ✅ Fallback: if script doesn't load in 5 seconds, continue
        const fallbackTimer = setTimeout(() => {
          if (!isLoaded) {
            console.warn('⚠️ Native banner loading timeout');
            setIsLoaded(true);
          }
        }, 5000);

        return () => clearTimeout(fallbackTimer);

      } catch (error) {
        console.error('❌ Native banner error:', error);
        setAdError(true);
        setIsLoaded(true);
      }
    };

    // ✅ Load after small delay
    const timer = setTimeout(loadNativeAd, 500);
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
      className={`w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-4 ${className}`}
    >
      {!isLoaded ? (
        <div className="flex items-center justify-center gap-2 min-h-[60px]">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-400 border-t-transparent" />
          <span className="text-sm text-gray-400">Loading ad...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* ✅ Native Ad Container */}
          <div 
            ref={containerRef} 
            className="w-full min-h-[60px] flex items-center justify-center"
          />
          
          {/* ✅ Timer */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              📢 {adError ? 'Ad loading...' : `Continuing in ${secondsLeft}s...`}
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