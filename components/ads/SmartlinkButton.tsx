'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronRight, Clock, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';

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
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const maxRetries = 3;
  const totalSeconds = 15;

  // ✅ Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ✅ Handle tab visibility change - PAUSE timer when user switches tab
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
        // Resume timer if not complete
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
        if (document.hidden) {
          // ✅ Pause if tab is hidden
          return prev;
        }
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setIsTimerComplete(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ✅ Handle Smartlink Click
  const handleClick = () => {
    if (isClicked) return;

    try {
      // ✅ Open Smartlink in new tab
      const newWindow = window.open(smartlinkUrl, '_blank', 'noopener');
      
      // ✅ If popup blocked or ad blocker detected
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        console.warn('⚠️ Popup blocked or ad blocker detected');
        setIsError(true);
        setShowRetry(true);
        return;
      }

      setIsClicked(true);
      setSecondsLeft(totalSeconds);
      setIsTimerComplete(false);
      setIsError(false);
      setShowRetry(false);
      startTimer();

    } catch (error) {
      console.error('❌ Error opening smartlink:', error);
      setIsError(true);
      setShowRetry(true);
    }
  };

  // ✅ Handle Retry
  const handleRetry = () => {
    if (retryCount >= maxRetries) {
      // ✅ After max retries, use fallback - auto-complete
      setIsFallback(true);
      setShowRetry(false);
      setIsError(false);
      setIsClicked(true);
      setSecondsLeft(0);
      setIsTimerComplete(true);
      return;
    }

    setRetryCount(prev => prev + 1);
    setIsError(false);
    setShowRetry(false);
    setIsClicked(false);
    
    // ✅ Auto-retry after 2 seconds
    setTimeout(() => {
      handleClick();
    }, 1000);
  };

  // ✅ Handle Fallback - Auto complete after 5 seconds
  useEffect(() => {
    if (isFallback) {
      const fallbackTimer = setTimeout(() => {
        onComplete();
      }, 5000);
      return () => clearTimeout(fallbackTimer);
    }
  }, [isFallback, onComplete]);

  // ✅ Handle Continue after timer complete
  const handleContinue = () => {
    if (isTimerComplete) {
      onComplete();
    }
  };

  // ✅ Check if timer should be paused
  const isTimerPaused = isPaused && isClicked && !isTimerComplete && secondsLeft > 0;

  // ✅ Calculate progress
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  // ✅ Show error state with retry
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

  // ✅ Show fallback state (after max retries)
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

  // ✅ Show error state with retry
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
              {isTimerPaused ? '⏸️ Timer paused!' : 'Please complete the ad in the new tab'}
            </span>
          </div>
          
          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl font-bold text-amber-600">{secondsLeft}s</span>
            <div className="flex-1 max-w-[200px] h-2 bg-amber-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-1000 rounded-full"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </div>
          
          {/* ✅ Timer Paused Warning */}
          {isTimerPaused && (
            <p className="text-xs text-red-500 mt-2 font-bold animate-pulse">
              ⚠️ Please come back to this tab! Timer is paused.
            </p>
          )}
          
          {!isTimerPaused && (
            <p className="text-xs text-amber-500 mt-2">
              ⚠️ Don't close this window • Timer pauses if you switch tabs
            </p>
          )}
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