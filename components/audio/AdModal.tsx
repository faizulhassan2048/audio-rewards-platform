'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface AdModalProps {
  onFinished: () => void;
  rewardCoins: number;
  adDurationSeconds?: number;
  claiming?: boolean;
  errorMessage?: string | null;
}

// ✅ REAL Monetag Vignette/Interstitial zone
const MONETAG_INTERSTITIAL_ZONE_ID = '11270537';
const MONETAG_INTERSTITIAL_SCRIPT_SRC = 'https://n6wxm.com/vignette.min.js';

export default function AdModal({
  onFinished,
  rewardCoins,
  adDurationSeconds = 30,
  claiming = false,
  errorMessage = null,
}: AdModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(adDurationSeconds);
  const [adReady, setAdReady] = useState(false);
  const [tabWarning, setTabWarning] = useState(false);
  const [backWarning, setBackWarning] = useState(false);
  const [adStartError, setAdStartError] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const backWarningTimeout = useRef<NodeJS.Timeout | null>(null);
  const adContainerRef = useRef<HTMLDivElement>(null);
  const scriptInjected = useRef(false);
  const adStarted = useRef(false);

  // ✅ NEW: Call ads/start when modal mounts
  useEffect(() => {
    if (!adStarted.current) {
      adStarted.current = true;
      console.log('🎬 Starting ad session...');
      
      fetch('/api/tasks/level/ads/start', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('✅ Ad session started:', data.milestone);
          setAdStartError(null);
        } else {
          console.error('❌ Ad start failed:', data.error);
          setAdStartError(data.error || 'Failed to start ad');
        }
      })
      .catch(err => {
        console.error('Ad start error:', err);
        setAdStartError('Network error starting ad');
      });
    }
  }, []);

  // Countdown — pauses when tab is hidden
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Tab visibility warning
  useEffect(() => {
    const handleVisibility = () => {
      setTabWarning(document.visibilityState !== 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Back-button trap
  useEffect(() => {
    window.history.pushState({ adGuard: true }, '');
    const handlePopState = () => {
      window.history.pushState({ adGuard: true }, '');
      setBackWarning(true);
      if (backWarningTimeout.current) clearTimeout(backWarningTimeout.current);
      backWarningTimeout.current = setTimeout(() => setBackWarning(false), 2500);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (backWarningTimeout.current) clearTimeout(backWarningTimeout.current);
    };
  }, []);

  // ✅ Inject Monetag script
  useEffect(() => {
    if (scriptInjected.current || !adContainerRef.current) return;
    scriptInjected.current = true;

    console.log('🎬 Injecting Monetag Interstitial script (Zone: 11270537)...');

    // Clear container
    adContainerRef.current.innerHTML = '';

    // ✅ Create container for Monetag
    const container = document.createElement('div');
    container.id = 'monetag-interstitial-container';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    
    adContainerRef.current.appendChild(container);

    // ✅ Monetag script
    const script = document.createElement('script');
    script.dataset.zone = MONETAG_INTERSTITIAL_ZONE_ID;
    script.src = MONETAG_INTERSTITIAL_SCRIPT_SRC;
    script.async = true;
    
    script.onload = () => {
      console.log('✅ Monetag ad loaded!');
      setAdReady(true);
    };
    
    script.onerror = () => {
      console.error('❌ Monetag ad failed to load');
      setAdReady(true);
    };

    // Append script to container
    container.appendChild(script);

    // Fallback timeout
    const timeout = setTimeout(() => {
      if (!adReady) {
        console.log('⏰ Ad load timeout, forcing ready...');
        setAdReady(true);
      }
    }, 8000);

    return () => {
      clearTimeout(timeout);
      if (adContainerRef.current) {
        adContainerRef.current.innerHTML = '';
      }
    };
  }, [adReady]);

  const canContinue = secondsLeft <= 0 && adReady;

  // Show error if ad start failed
  if (adStartError) {
    return (
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Ad Error</h3>
          <p className="text-sm text-gray-600 mb-4">{adStartError}</p>
          <button
            onClick={onFinished}
            className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-0">
      {/* ✅ Full Screen Ad Container */}
      <div className="w-full h-full bg-black relative flex items-center justify-center">
        
        {/* Ad Container */}
        <div 
          ref={adContainerRef}
          className="w-full h-full flex items-center justify-center"
        >
          {!adReady ? (
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-400" />
              <p className="text-sm font-medium">Loading ad...</p>
              <p className="text-xs text-white/50 mt-1">Please wait</p>
            </div>
          ) : null}
        </div>

        {/* Timer Badge - Top Right */}
        <div className="absolute top-4 right-4 bg-black/60 text-white text-sm px-3 py-1.5 rounded-full backdrop-blur-sm font-mono z-10">
          {canContinue ? '✓ Done' : `${secondsLeft}s`}
        </div>

        {/* Tab Warning */}
        {tabWarning && (
          <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-4 text-center z-20">
            <div className="text-white">
              <p className="text-lg font-semibold">⚠️ Come back to this tab!</p>
              <p className="text-sm text-white/70 mt-2">The ad timer is paused until you return.</p>
            </div>
          </div>
        )}

        {/* Back Warning */}
        {backWarning && (
          <div className="absolute bottom-20 left-0 right-0 text-center z-20">
            <p className="text-red-500 text-sm font-semibold bg-black/70 py-2 px-4 inline-block rounded-full">
              ⚠️ You must finish watching this ad to continue.
            </p>
          </div>
        )}
      </div>

      {/* ✅ Bottom Claim Button - Overlay on ad */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-10">
        <div className="max-w-sm mx-auto">
          {errorMessage ? (
            <p className="text-sm text-red-400 mb-3 text-center font-medium">
              {errorMessage}
            </p>
          ) : (
            <p className="text-sm text-white/80 mb-3 text-center">
              {canContinue
                ? `✅ Ad complete — claim your ${rewardCoins} coins!`
                : `⏳ Please wait ${secondsLeft}s for ad to finish...`}
            </p>
          )}
          
          <button
            onClick={onFinished}
            disabled={!canContinue || claiming}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-lg"
          >
            {claiming && <Loader2 size={22} className="animate-spin" />}
            {claiming
              ? 'Verifying...'
              : errorMessage
              ? '🔄 Retry Claim'
              : canContinue
              ? `💰 Claim ${rewardCoins} Coins`
              : `⏳ Please wait (${secondsLeft}s)`}
          </button>
          
          {!canContinue && !errorMessage && (
            <p className="text-[10px] text-white/40 text-center mt-2">
              Ad is loading in the background • Do not close this window
            </p>
          )}
        </div>
      </div>
    </div>
  );
}