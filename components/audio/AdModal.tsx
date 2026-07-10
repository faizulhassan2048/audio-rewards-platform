'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface AdModalProps {
  onFinished: () => void;
  rewardCoins: number;
  adDurationSeconds?: number; // default below matches server MIN_AD_SECONDS in ads/verify route
  claiming?: boolean;
  errorMessage?: string | null;
}

export default function AdModal({
  onFinished,
  rewardCoins,
  adDurationSeconds = 45, // 45s — keep this in sync with MIN_AD_SECONDS in ads/verify/route.ts
  claiming = false,
  errorMessage = null,
}: AdModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(adDurationSeconds);
  const [adLoaded, setAdLoaded] = useState(false);
  const [tabWarning, setTabWarning] = useState(false);
  const [backWarning, setBackWarning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const backWarningTimeout = useRef<NodeJS.Timeout | null>(null);

  // ── Countdown — pauses whenever the tab is hidden, so switching tabs
  // can never let the timer run out "for free" in the background.
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return; // frozen while hidden
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

  // ── Back-button trap — while the ad modal is open, pressing back (or a
  // back-swipe gesture) must not be able to leave/skip it. We push an extra
  // history entry and immediately re-push it if the user tries to pop it.
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

  const canContinue = secondsLeft <= 0 && adLoaded;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 sm:p-4">
      <div className="w-full h-full sm:h-auto sm:max-w-sm bg-white sm:rounded-2xl flex flex-col overflow-hidden">

        <div className="flex-1 sm:flex-none sm:aspect-video bg-gradient-to-br from-purple-600 to-indigo-700 flex flex-col items-center justify-center text-white p-6 text-center relative">

          <div id="adsterra-fullscreen" className="w-full h-full flex items-center justify-center">
            {!adLoaded ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/30 border-t-white mx-auto mb-3" />
                <p className="text-sm opacity-80">Loading ad...</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-4xl mb-3">📺</p>
                <p className="text-sm font-medium">Adsterra Full Screen Ad</p>
                <p className="text-xs opacity-70 mt-1">Replace with your Adsterra code</p>
                <div className="mt-3 p-2 bg-white/10 rounded-lg text-xs">
                  <code className="opacity-60">Adsterra Interstitial Code Here</code>
                </div>
              </div>
            )}
          </div>

          <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
            {canContinue ? 'Done' : `${secondsLeft}s`}
          </div>

          {tabWarning && (
            <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-6 text-center">
              <p className="text-sm font-semibold">Come back to this tab — the ad timer is paused until you do.</p>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 border-t border-gray-100">
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
