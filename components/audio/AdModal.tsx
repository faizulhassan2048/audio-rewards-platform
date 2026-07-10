'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface AdModalProps {
  onFinished: () => void; // now expected to be async — parent awaits verify/claim
  rewardCoins: number;
  adDurationSeconds?: number;
  claiming?: boolean;
  errorMessage?: string | null;
}

export default function AdModal({
  onFinished,
  rewardCoins,
  adDurationSeconds = 15,
  claiming = false,
  errorMessage = null,
}: AdModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(adDurationSeconds);
  const [adLoaded, setAdLoaded] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
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

  // Simulate ad load
  useEffect(() => {
    const timer = setTimeout(() => setAdLoaded(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const canContinue = secondsLeft <= 0 && adLoaded;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 sm:p-4">
      <div className="w-full h-full sm:h-auto sm:max-w-sm bg-white sm:rounded-2xl flex flex-col overflow-hidden">

        {/* ── ADSTERRA FULL SCREEN AD PLACEHOLDER ── */}
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
            {canContinue ? '✅ Done' : `${secondsLeft}s`}
          </div>
        </div>
        {/* ── END ADSTERRA ── */}

        <div className="p-4 sm:p-5 border-t border-gray-100">
          {errorMessage ? (
            <p className="text-sm text-red-600 mb-3 text-center font-medium">
              ⚠️ {errorMessage}
            </p>
          ) : (
            <p className="text-sm text-gray-600 mb-3 text-center">
              {canContinue
                ? `🎉 Watch complete — claim your 🪙 ${rewardCoins} coins!`
                : `⏳ Reward available in ${secondsLeft}s…`}
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
