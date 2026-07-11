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

// Real Monetag Vignette/Interstitial zone — verbatim from the dashboard.
const MONETAG_INTERSTITIAL_ZONE_ID = '11270537';
const MONETAG_INTERSTITIAL_SCRIPT_SRC = 'https://n6wxm.com/vignette.min.js';

export default function AdModal({
  onFinished,
  rewardCoins,
  adDurationSeconds = 30, // keep in sync with MIN_AD_SECONDS in ads/verify/route.ts
  claiming = false,
  errorMessage = null,
}: AdModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(adDurationSeconds);
  const [adLoaded, setAdLoaded] = useState(false);
  const [tabWarning, setTabWarning] = useState(false);
  const [backWarning, setBackWarning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const backWarningTimeout = useRef<NodeJS.Timeout | null>(null);
  const adContainerRef = useRef<HTMLDivElement>(null);

  // Countdown — pauses whenever the tab is hidden, so switching tabs can
  // never let the timer run out "for free" in the background.
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

  useEffect(() => {
    const handleVisibility = () => {
      setTabWarning(document.visibilityState !== 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Back-button trap — pressing back (or a back-swipe) while the ad is open
  // cannot skip it. We push an extra history entry and re-push it if the
  // user tries to pop it.
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

  useEffect(() => {
    const timer = setTimeout(() => setAdLoaded(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Injects the real Monetag Vignette/Interstitial script — follows
  // Monetag's own recommended pattern (append to <html> or <body>) rather
  // than the local ad-preview container, since that's what their snippet
  // expects (Vignette ads render as their own overlay, not confined to a
  // parent div).
  useEffect(() => {
    const script = document.createElement('script');
    (script as any).dataset.zone = MONETAG_INTERSTITIAL_ZONE_ID;
    script.src = MONETAG_INTERSTITIAL_SCRIPT_SRC;
    const target = [document.documentElement, document.body].filter(Boolean).pop();
    target?.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  const canContinue = secondsLeft <= 0 && adLoaded;

  return (
    // z-[999] + always-centered bounded card (no h-full stretch on mobile) —
    // guarantees the Claim button is always on-screen, never pinned below
    // the fold behind a site's bottom nav bar or mobile browser chrome.
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl flex flex-col overflow-hidden max-h-[92dvh]">

        <div
          ref={adContainerRef}
          className="aspect-video bg-gradient-to-br from-purple-600 to-indigo-700 flex flex-col items-center justify-center text-white p-4 text-center relative shrink-0"
        >
          <div id="monetag-interstitial" className="w-full h-full flex items-center justify-center">
            {!adLoaded ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-9 w-9 border-2 border-white/30 border-t-white mx-auto mb-2" />
                <p className="text-xs opacity-80">Loading ad...</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-3xl mb-2">📺</p>
                <p className="text-sm font-medium">Monetag Interstitial Ad</p>
                <p className="text-xs opacity-70 mt-1">Replace with your Monetag zone code</p>
                <div className="mt-2 p-2 bg-white/10 rounded-lg text-xs">
                  <code className="opacity-60">Monetag Vignette/Interstitial Zone Here</code>
                </div>
              </div>
            )}
          </div>

          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full">
            {canContinue ? 'Done' : `${secondsLeft}s`}
          </div>

          {tabWarning && (
            <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-4 text-center">
              <p className="text-xs font-semibold">Come back to this tab — the ad timer is paused until you do.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {backWarning && (
            <p className="text-xs text-red-600 mb-2 text-center font-semibold">
              You must finish watching this ad to continue.
            </p>
          )}
          {errorMessage ? (
            <p className="text-sm text-red-600 mb-3 text-center font-medium">
              {errorMessage}
            </p>
          ) : (
            <p className="text-sm text-gray-600 mb-3 text-center">
              {canContinue
                ? `Watch complete — claim your ${rewardCoins} coins!`
                : `Reward available in ${secondsLeft}s…`}
            </p>
          )}
          <button
            onClick={onFinished}
            disabled={!canContinue || claiming}
            className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
          >
            {claiming && <Loader2 size={18} className="animate-spin" />}
            {claiming
              ? 'Verifying…'
              : errorMessage
              ? 'Retry Claim'
              : canContinue
              ? `Claim ${rewardCoins} Coins`
              : `Please wait (${secondsLeft}s)`}
          </button>
        </div>
      </div>
    </div>
  );
}