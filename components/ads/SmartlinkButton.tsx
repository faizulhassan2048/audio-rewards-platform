'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronRight, Clock, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';
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
  const [autoCompleteTriggered, setAutoCompleteTriggered] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoCompleteRef = useRef<NodeJS.Timeout | null>(null);
  const maxRetries = 3;
  const totalSeconds = 15;
  const AUTO_COMPLETE_TIMEOUT = 30000; // ✅ 30 seconds

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoCompleteRef.current) clearTimeout(autoCompleteRef.current);
    };
  }, []);

  // ✅ Auto-complete after 30 seconds if user is stuck
  useEffect(() => {
    if (isClicked && !isTimerComplete && secondsLeft > 0 && !autoCompleteTriggered) {
      autoCompleteRef.current = setTimeout(() => {
        if (!isTimerComplete && secondsLeft > 0) {
          console.log('⏰ Auto-completing smartlink after 30s timeout');
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

  // ✅ Handle tab visibility change
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

  // ✅ Handle Smartlink Click
  const handleClick = () => {
    if (isClicked) return;

    try {
      const newWindow = window.open(smartlinkUrl, '_blank', 'noopener');
      
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
      setAutoCompleteTriggered(false);
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
        <button
          onClick={handleClick}
          className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
        >
          <ExternalLink className="w-5 h-5" />
          {buttonText}
          <ChevronRight className="w-5 h-5" />
        </button>
      ) : !isTimerComplete ? (
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