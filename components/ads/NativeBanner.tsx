'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface NativeBannerProps {
  onComplete?: () => void;
  duration?: number;
  className?: string;
}

// ✅ Adsterra Native Banner - Dashboard ID 30276726
const NATIVE_ZONE_ID = '30276726';
const NATIVE_SCRIPT_URL = 'https://nap5k.com/tag.min.js';

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

    const loadNativeAd = () => {
      try {
        if (!containerRef.current) {
          console.warn('⚠️ Native banner container not found');
          setIsLoaded(true);
          return;
        }

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
          console.error('❌ Native banner failed to load, using fallback');
          setAdError(true);
          setUsingFallback(true);
          // ✅ Show fallback ad
          showFallbackAd();
        };

        containerRef.current.appendChild(script);

        // ✅ Fallback: if script doesn't load in 5 seconds
        const fallbackTimer = setTimeout(() => {
          if (!isLoaded) {
            console.warn('⚠️ Native banner loading timeout, using fallback');
            setAdError(true);
            setUsingFallback(true);
            showFallbackAd();
          }
        }, 5000);

        return () => clearTimeout(fallbackTimer);

      } catch (error) {
        console.error('❌ Native banner error:', error);
        setAdError(true);
        setUsingFallback(true);
        showFallbackAd();
      }
    };

    // ✅ Show fallback ad
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
              {usingFallback ? '📢 Click ad to continue...' : `📢 Continuing in ${secondsLeft}s...`}
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