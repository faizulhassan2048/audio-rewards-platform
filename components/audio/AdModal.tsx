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

// ✅ REAL Monetag Vignette/Interstitial zone - Using your exact snippet
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
  const [adLoaded, setAdLoaded] = useState(false);
  const [tabWarning, setTabWarning] = useState(false);
  const [backWarning, setBackWarning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const backWarningTimeout = useRef<NodeJS.Timeout | null>(null);
  const scriptInjected = useRef(false);

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

  // ✅ FIX: Inject Monetag script EXACTLY as provided
  useEffect(() => {
    if (scriptInjected.current) return;
    scriptInjected.current = true;

    console.log('🎬 Injecting Monetag Interstitial script (Zone: 11270537)...');

    // Remove any existing Monetag interstitial scripts to avoid duplicates
    const existingScripts = document.querySelectorAll(
      `script[data-zone="${MONETAG_INTERSTITIAL_ZONE_ID}"]`
    );
    existingScripts.forEach((s) => s.remove());

    // ✅ EXACT Monetag snippet pattern
    const script = document.createElement('script');
    script.dataset.zone = MONETAG_INTERSTITIAL_ZONE_ID;
    script.src = MONETAG_INTERSTITIAL_SCRIPT_SRC;
    script.async = true;
    
    script.onload = () => {
      console.log('✅ Monetag Interstitial script loaded successfully!');
      setAdLoaded(true);
    };
    
    script.onerror = () => {
      console.error('❌ Failed to load Monetag script');
      // Still allow continue after timer
      setAdLoaded(true);
    };

    // Append to body (Monetag recommends this)
    const target = document.body || document.documentElement;
    if (target) {
      target.appendChild(script);
      console.log('📦 Script appended to:', target.tagName);
    }

    // Fallback: If script doesn't load within 5 seconds, force ready
    const timeout = setTimeout(() => {
      if (!adLoaded) {
        console.log('⏰ Script load timeout, forcing ad ready...');
        setAdLoaded(true);
      }
    }, 5000);

    return () => {
      script.remove();
      clearTimeout(timeout);
    };
  }, [adLoaded]);

  const canContinue = secondsLeft <= 0 && adLoaded;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl flex flex-col overflow-hidden max-h-[92dvh]">

        {/* Ad Container - Show real Monetag ad */}
        <div className="aspect-video bg-black flex items-center justify-center relative shrink-0 overflow-hidden">
          
          {!adLoaded ? (
            // Loading state
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/30 border-t-white mx-auto mb-3" />
              <p className="text-sm font-medium">Loading ad...</p>
              <p className="text-xs text-white/50 mt-1">Please wait</p>
            </div>
          ) : (
            // ✅ REAL Monetag Ad Container
            <div 
              id="monetag-interstitial-container" 
              className="w-full h-full bg-black"
            >
              {/* Monetag will render its vignette/interstitial ad here */}
              <div id="monetag-vignette" className="w-full h-full" />
            </div>
          )}

          {/* Timer Badge */}
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm font-mono">
            {canContinue ? '✓ Done' : `${secondsLeft}s`}
          </div>

          {/* Tab Warning */}
          {tabWarning && (
            <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-4 text-center">
              <div className="text-white">
                <p className="text-sm font-semibold">⚠️ Come back to this tab!</p>
                <p className="text-xs text-white/70 mt-1">The ad timer is paused until you return.</p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section */}
        <div className="p-4 border-t border-gray-100 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          
          {backWarning && (
            <p className="text-xs text-red-600 mb-2 text-center font-semibold">
              ⚠️ You must finish watching this ad to continue.
            </p>
          )}
          
          {errorMessage ? (
            <p className="text-sm text-red-600 mb-3 text-center font-medium">
              {errorMessage}
            </p>
          ) : (
            <p className="text-sm text-gray-600 mb-3 text-center">
              {canContinue
                ? `✅ Ad complete — claim your ${rewardCoins} coins!`
                : `⏳ Please wait ${secondsLeft}s for ad to finish...`}
            </p>
          )}
          
          <button
            onClick={onFinished}
            disabled={!canContinue || claiming}
            className="w-full py-3.5 rounded-xl bg-purple-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
          >
            {claiming && <Loader2 size={18} className="animate-spin" />}
            {claiming
              ? 'Verifying...'
              : errorMessage
              ? '🔄 Retry Claim'
              : canContinue
              ? `💰 Claim ${rewardCoins} Coins`
              : `⏳ Please wait (${secondsLeft}s)`}
          </button>
          
          {/* Small note */}
          {!canContinue && !errorMessage && (
            <p className="text-[10px] text-gray-400 text-center mt-2">
              Ad is loading in the background • Do not close this window
            </p>
          )}
        </div>
      </div>
    </div>
  );
}