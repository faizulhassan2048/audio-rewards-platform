'use client';

import { useEffect, useRef, useState } from 'react';

interface AdModalProps {
  onFinished: () => void;
  rewardCoins: number;
  /** Ad length in seconds before "Continue" becomes clickable */
  adDurationSeconds?: number;
}

// Simple in-house countdown ad. Swap the contents of the
// "AD CREATIVE GOES HERE" block below for a real network call
// (Google AdSense rewarded ad, AdMob, etc.) — keep the
// countdown/onFinished wiring the same so the reward flow
// still fires only after the ad has actually been shown.
export default function AdModal({ onFinished, rewardCoins, adDurationSeconds = 15 }: AdModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(adDurationSeconds);
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

  const canContinue = secondsLeft <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 sm:p-4">
      <div className="w-full h-full sm:h-auto sm:max-w-sm bg-white sm:rounded-2xl flex flex-col overflow-hidden">
        {/* ── AD CREATIVE GOES HERE ── */}
        <div className="flex-1 sm:flex-none sm:aspect-video bg-gradient-to-br from-purple-600 to-indigo-700 flex flex-col items-center justify-center text-white p-6 text-center">
          <p className="text-sm uppercase tracking-wide opacity-80 mb-2">Advertisement</p>
          <p className="text-lg font-semibold">Your rewarded ad goes here</p>
          <p className="text-xs opacity-70 mt-2">
            Replace this block with your ad network's rewarded-ad embed/SDK call.
          </p>
        </div>
        {/* ── END AD CREATIVE ── */}

        <div className="p-4 sm:p-5 border-t border-gray-100">
          <p className="text-sm text-gray-600 mb-3 text-center">
            {canContinue
              ? `Watch complete — claim your 🪙 ${rewardCoins} coins!`
              : `Reward available in ${secondsLeft}s…`}
          </p>
          <button
            onClick={onFinished}
            disabled={!canContinue}
            className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors"
          >
            {canContinue ? `Claim ${rewardCoins} Coins` : `Please wait (${secondsLeft}s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
