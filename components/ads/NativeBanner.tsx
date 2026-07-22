'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface NativeBannerProps {
  onComplete?: () => void;
  duration?: number;
  className?: string;
}

// ✅ Adsterra Native Banner - Dashboard key d59bba32d33c1da2bf3fbeeacf85538a
const NATIVE_KEY = 'd59bba32d33c1da2bf3fbeeacf85538a';
const NATIVE_SCRIPT_URL = `https://pl30377225.effectivecpmnetwork.com/${NATIVE_KEY}/invoke.js`;
const NATIVE_CONTAINER_ID = `container-${NATIVE_KEY}`;

// ✅ Fallback Ad (if native doesn't load)
const FALLBACK_AD_URL = 'https://www.effectivecpmnetwork.com/cjwanx75u?key=35c37ccabbe40a0330805d114bcb7f5a';

export default function NativeBanner({ 
  onComplete, 
  duration = 5,
  className = '' 
}: NativeBannerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [adError, setAdError] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const scriptLoadedRef = useRef(false);

  // ✅ Load native ad
  useEffect(() => {
    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    const showFallbackAd = () => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';

      const fallbackDiv = document.createElement('div');
      fallbackDiv.className = 'w-full p-2 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200';
      fallbackDiv.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl">📢</span>
            <div>
              <p class="text-xs font-semibold text-gray-700">Sponsored</p>
              <p class="text-[10px] text-gray-500">Complete ad to continue</p>
            </div>
          </div>
          <a href="${FALLBACK_AD_URL}" target="_blank" 
             class="px-3 py-1 bg-[#6C63FF] text-white rounded-lg text-xs font-semibold hover:bg-[#5a52e0] transition-colors">
            Watch Ad
          </a>
        </div>
      `;
      containerRef.current.appendChild(fallbackDiv);
      setIsLoaded(true);
    };

    const loadNativeAd = () => {
      try {
        if (!containerRef.current) {
          // Container should always be mounted now, but guard just in case
          console.warn('⚠️ Native banner container not found, retrying...');
          setTimeout(loadNativeAd, 200);
          return;
        }

        containerRef.current.innerHTML = '';

        // ✅ Create container for ad - ID must EXACTLY match Adsterra's expected container
        const adContainer = document.createElement('div');
        adContainer.id = NATIVE_CONTAINER_ID;
        adContainer.className = 'w-full min-h-[60px] flex items-center justify-center';
        containerRef.current.appendChild(adContainer);

        // ✅ Create and load script (matches Adsterra dashboard snippet exactly)
        const script = document.createElement('script');
        script.src = NATIVE_SCRIPT_URL;
        script.async = true;
        script.setAttribute('data-cfasync', 'false');
        script.onload = () => {
          console.log('✅ Native banner loaded successfully');
          setIsLoaded(true);
        };
        script.onerror = () => {
          console.error('❌ Native banner failed to load, using fallback');
          setAdError(true);
          setUsingFallback(true);
          showFallbackAd();
        };

        containerRef.current.appendChild(script);

      } catch (error) {
        console.error('❌ Native banner error:', error);
        setAdError(true);
        setUsingFallback(true);
        showFallbackAd();
      }
    };

    const startTimer = setTimeout(loadNativeAd, 500);

    // ✅ Fallback: if script doesn't load within 5s of starting the load
    const fallbackTimer = setTimeout(() => {
      setIsLoaded((current) => {
        if (!current) {
          console.warn('⚠️ Native banner loading timeout, using fallback');
          setAdError(true);
          setUsingFallback(true);
          showFallbackAd();
        }
        return current;
      });
    }, 5500);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(fallbackTimer);
    };
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
      <div className="space-y-3">
        {/* ✅ Native Ad Container - ALWAYS mounted so the script can find it */}
        <div className="relative w-full min-h-[60px]">
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-400 border-t-transparent" />
              <span className="text-sm text-gray-400">Loading ad...</span>
            </div>
          )}
          <div 
            ref={containerRef} 
            className="w-full min-h-[60px] flex items-center justify-center"
          />
        </div>

        {/* ✅ Timer */}
        {isLoaded && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {usingFallback ? '📢 Click ad to continue...' : `📢 Continuing in ${secondsLeft}s...`}
            </p>
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-1000"
                style={{ width: `${((duration - secondsLeft) / duration) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}