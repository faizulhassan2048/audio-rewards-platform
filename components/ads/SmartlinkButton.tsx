'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronRight, Clock, ExternalLink, AlertCircle, RefreshCw, Info } from 'lucide-react';
import { toast } from 'sonner';

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
  const [isPaused, setIsPaused] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isError, setIsError] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [autoCompleteTriggered, setAutoCompleteTriggered] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoCompleteRef = useRef<NodeJS.Timeout | null>(null);
  const maxRetries = 3;
  const totalSeconds = 15;
  const AUTO_COMPLETE_TIMEOUT = 30000; // 30 seconds

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoCompleteRef.current) clearTimeout(autoCompleteRef.current);
    };
  }, []);

  // ✅ Auto-complete after 30 seconds — safety net so nobody ever gets
  // permanently stuck here even if the ad or popup misbehaves.
  useEffect(() => {
    if (isClicked && !isTimerComplete && secondsLeft > 0 && !autoCompleteTriggered) {
      autoCompleteRef.current = setTimeout(() => {
        if (!isTimerComplete && secondsLeft > 0) {
          setAutoCompleteTriggered(true);
          setSecondsLeft(0);
          setIsTimerComplete(true);
          if (timerRef.current) clearInterval(timerRef.current);
          toast.success('✅ Ad completed automatically. Continuing...');
        }
      }, AUTO_COMPLETE_TIMEOUT);

      return () => {
        if (autoCompleteRef.current) clearTimeout(autoCompleteRef.current);
      };
    }
  }, [isClicked, isTimerComplete, secondsLeft, autoCompleteTriggered]);

  // ✅ Handle tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        setIsPaused(false);
        if (isClicked && !isTimerComplete && secondsLeft > 0) {
          startTimer();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isClicked, isTimerComplete, secondsLeft]);

  // ✅ Start timer
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (document.hidden) return prev;
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setIsTimerComplete(true);
          if (autoCompleteRef.current) clearTimeout(autoCompleteRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ✅ Check if popup is blocked
  const checkPopupBlocked = (newWindow: Window | null) => {
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      setPopupBlocked(true);
      setIsError(false);
      setShowRetry(false);
      return true;
    }
    return false;
  };

  // ✅ Handle Smartlink Click
  const handleClick = () => {
    if (isClicked) return;

    setPopupBlocked(false);

    try {
      const newWindow = window.open(smartlinkUrl, '_blank', 'noopener');

      if (checkPopupBlocked(newWindow)) {
        return;
      }

      setIsClicked(true);
      setSecondsLeft(totalSeconds);
      setIsTimerComplete(false);
      setIsError(false);
      setShowRetry(false);
      setAutoCompleteTriggered(false);
      startTimer();

    } catch (error) {
      console.error('❌ Error opening smartlink:', error);
      setPopupBlocked(true);
    }
  };

  // ✅ Mobile-friendly fallback: if the popup was blocked, open the ad in
  // THIS tab instead of forcing the user to fiddle with browser settings.
  // We remember that we're mid-ad so that when the user comes back
  // (browser back button), the app can skip straight to the verify step.
  const handleSameTabFallback = () => {
    try {
      sessionStorage.setItem('milestone_ad_pending', '1');
    } catch { /* ignore */ }
    window.location.href = smartlinkUrl;
  };

  // ✅ Handle Retry (popup attempt again)
  const handleRetry = () => {
    if (retryCount >= maxRetries) {
      setIsFallback(true);
      setShowRetry(false);
      setIsError(false);
      setPopupBlocked(false);
      setIsClicked(true);
      setSecondsLeft(0);
      setIsTimerComplete(true);
      toast.info('⏳ Max retries reached. Continuing automatically...', {
        duration: 3000,
      });
      return;
    }

    setRetryCount(prev => prev + 1);
    setIsError(false);
    setShowRetry(false);
    setPopupBlocked(false);
    setIsClicked(false);

    setTimeout(() => {
      handleClick();
    }, 1000);
  };

  // ✅ Handle Fallback
  useEffect(() => {
    if (isFallback) {
      const fallbackTimer = setTimeout(() => {
        onComplete();
      }, 5000);
      return () => clearTimeout(fallbackTimer);
    }
  }, [isFallback, onComplete]);

  // ✅ Handle Continue
  const handleContinue = () => {
    if (isTimerComplete) {
      if (autoCompleteRef.current) clearTimeout(autoCompleteRef.current);
      onComplete();
    }
  };

  const isTimerPaused = isPaused && isClicked && !isTimerComplete && secondsLeft > 0;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  // ✅ Show popup blocked state — with a same-tab fallback, no dead end.
  if (popupBlocked) {
    return (
      <div className={`w-full ${className}`}>
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <span className="font-semibold text-amber-700">Popup Blocked</span>
          </div>
          <p className="text-sm text-amber-600 mb-3">
            No problem — you can continue right here instead.
          </p>
          <button
            onClick={handleSameTabFallback}
            className="w-full py-3 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors flex items-center justify-center gap-2 mb-2"
          >
            <ExternalLink className="w-4 h-4" />
            Continue in This Tab
          </button>
          <button
            onClick={() => { setPopupBlocked(false); handleClick(); }}
            className="w-full py-2 text-amber-700 text-sm font-medium hover:underline flex items-center justify-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try popup again instead
          </button>
        </div>
      </div>
    );
  }

  // ✅ Show error state
  if (isError && showRetry) {
    return (
      <div className={`w-full ${className}`}>
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="font-semibold text-red-700">
              Ad couldn't load. Please try again.
            </span>
          </div>
          <p className="text-xs text-red-500 mb-3">
            {retryCount >= maxRetries
              ? 'Max retries reached. Continuing automatically...'
              : `Attempt ${retryCount + 1}/${maxRetries}`}
          </p>
          {retryCount < maxRetries && (
            <button
              onClick={handleRetry}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Retry ({retryCount + 1}/{maxRetries})
            </button>
          )}
        </div>
      </div>
    );
  }

  // ✅ Show fallback state
  if (isFallback) {
    return (
      <div className={`w-full ${className}`}>
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 text-center animate-pulse">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-600 animate-spin" />
            <span className="font-semibold text-yellow-700">
              Continuing automatically...
            </span>
          </div>
          <p className="text-xs text-yellow-600">
            Please wait 5 seconds
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {!isClicked ? (
        <div>
          {/* Button */}
          <button
            onClick={handleClick}
            className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
          >
            <ExternalLink className="w-5 h-5" />
            <span className="text-sm sm:text-base">{buttonText}</span>
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* ✅ User Instructions */}
          <div className="mt-2.5 bg-blue-50 border border-blue-100 rounded-lg p-2.5">
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-blue-700">📌 How to continue:</p>
                <ul className="text-[10px] text-blue-600 space-y-0.5 mt-0.5">
                  <li>1️⃣ Tap to open ad</li>
                  <li>2️⃣ Wait 15 seconds ⏱️</li>
                  <li>3️⃣ Return to this tab</li>
                  <li>4️⃣ Tap "Continue" ✅</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : !isTimerComplete ? (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-center">
          {/* Timer */}
          <div className="flex items-center justify-center gap-4 mb-2">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle
                  className="text-gray-200"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="transparent"
                  r="28"
                  cx="32"
                  cy="32"
                />
                <circle
                  className="text-amber-600 transition-all duration-1000"
                  strokeWidth="4"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="28"
                  cx="32"
                  cy="32"
                  strokeDasharray={`${(progress / 100) * 175.93} 175.93`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-amber-600">
                {secondsLeft}s
              </span>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-700">
                {isTimerPaused ? '⏸️ Paused' : '⏳ Loading...'}
              </p>
              <p className="text-xs text-gray-500">{Math.round(progress)}% complete</p>
            </div>
          </div>

          {/* ✅ Quick Tips */}
          <div className="bg-white/70 rounded-lg p-2.5 mb-2 text-left">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-700">📌 Quick Tips:</p>
                <ul className="text-[11px] text-gray-600 space-y-0.5 mt-0.5">
                  <li>✅ Stay on this tab</li>
                  <li>✅ Don't close this window</li>
                  <li>✅ {isTimerPaused ? '⚠️ Come back to resume!' : `⏳ ${secondsLeft}s remaining`}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Status Message */}
          {isTimerPaused ? (
            <p className="text-xs text-red-500 font-bold animate-pulse">
              ⚠️ Please come back to this tab! Timer is paused.
            </p>
          ) : (
            <p className="text-xs text-amber-500">
              📱 Stay on this page • Timer pauses if you switch tabs
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={handleContinue}
          className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-3 animate-pulse"
        >
          <span>✅</span>
          {buttonText}
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}