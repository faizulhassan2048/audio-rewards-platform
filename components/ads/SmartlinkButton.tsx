'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, Clock, ExternalLink } from 'lucide-react';

interface SmartlinkButtonProps {
  smartlinkUrl: string;
  onComplete: () => void;
  className?: string;
  buttonText?: string;
}

export default function SmartlinkButton({
  smartlinkUrl,
  onComplete,
  className = '',
  buttonText = 'Continue to Next Audio',
}: SmartlinkButtonProps) {
  const [isClicked, setIsClicked] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(15);
  const [isTimerComplete, setIsTimerComplete] = useState(false);

  const handleClick = () => {
    if (isClicked) return;

    // ✅ Open Smartlink in new tab
    window.open(smartlinkUrl, '_blank', 'noopener');

    setIsClicked(true);
    setSecondsLeft(15);
    setIsTimerComplete(false);

    // ✅ Start timer
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsTimerComplete(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // ✅ Cleanup timer on unmount
    return () => clearInterval(timer);
  };

  const handleContinue = () => {
    if (isTimerComplete) {
      onComplete();
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {!isClicked ? (
        // ✅ Initial Button
        <button
          onClick={handleClick}
          className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
        >
          <ExternalLink className="w-5 h-5" />
          {buttonText}
          <ChevronRight className="w-5 h-5" />
        </button>
      ) : !isTimerComplete ? (
        // ✅ Timer Running State
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
            <span className="font-semibold text-amber-700">
              Please complete the ad in the new tab
            </span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl font-bold text-amber-600">{secondsLeft}s</span>
            <div className="flex-1 max-w-[200px] h-2 bg-amber-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-1000 rounded-full"
                style={{ width: `${((15 - secondsLeft) / 15) * 100}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-amber-500 mt-2">
            ⚠️ Don't close this window • Timer pauses if you switch tabs
          </p>
        </div>
      ) : (
        // ✅ Timer Complete - Continue Button
        <button
          onClick={handleContinue}
          className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-3 animate-pulse"
        >
          ✅ Continue to Next Audio
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}