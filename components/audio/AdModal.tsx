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
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const adContainerRef = useRef<HTMLDivElement>(null);
  const scriptInjected = useRef(false);

  // Countdown - pauses on tab switch
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
      setTimeout(() => setBackWarning(false), 2500);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ✅ Inject Monetag script
  useEffect(() => {
    if (scriptInjected.current || !adContainerRef.current) return;
    scriptInjected.current = true;

    console.log('🎬 Injecting Monetag Interstitial...');

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
    script.dataset.zone = '11270537';
    script.src = 'https://n6wxm.com/vignette.min.js';
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
  }, []);

  const canContinue = secondsLeft <= 0;

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