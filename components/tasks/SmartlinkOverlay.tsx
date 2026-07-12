'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Clock, AlertCircle } from 'lucide-react';

interface SmartlinkOverlayProps {
  onComplete: () => void;
  onClose: () => void;
  durationSeconds?: number;
  message?: string;
}

export default function SmartlinkOverlay({
  onComplete,
  onClose,
  durationSeconds = 15,
  message = 'Please stay on this page while the ad loads...',
}: SmartlinkOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const [isComplete, setIsComplete] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  // Timer - pauses when tab is hidden
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') {
        setTabHidden(true);
        return;
      }
      setTabHidden(false);
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsComplete(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Prevent back button
  useEffect(() => {
    window.history.pushState({ smartlinkGuard: true }, '');
    
    const handlePopState = () => {
      window.history.pushState({ smartlinkGuard: true }, '');
      // Show warning
      setTabHidden(true);
      setTimeout(() => setTabHidden(false), 2000);
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Prevent scroll on body
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleManualClose = () => {
    if (isComplete) {
      onComplete();
      onClose();
    }
  };

  // Calculate progress
  const progress = ((durationSeconds - secondsLeft) / durationSeconds) * 100;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              <h3 className="font-bold text-sm">Smartlink Ad</h3>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 px-2.5 py-1 rounded-full text-xs font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>{secondsLeft}s</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
              {isComplete ? (
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-purple-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </div>
          </div>

          {/* Message */}
          <div className="text-center">
            {tabHidden ? (
              <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-xl">
                <AlertCircle className="w-4 h-4" />
                <p className="text-sm font-medium">Please come back to this tab!</p>
              </div>
            ) : isComplete ? (
              <div className="space-y-1">
                <p className="font-semibold text-gray-800 text-lg">✓ Ready to continue!</p>
                <p className="text-sm text-gray-500">Your smartlink ad is complete.</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-semibold text-gray-800">{message}</p>
                <p className="text-sm text-gray-500">Stay on this page for {secondsLeft} seconds</p>
                {tabHidden && (
                  <p className="text-xs text-amber-600 font-medium mt-2">
                    ⚠️ Timer paused! Please return to this tab.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={handleManualClose}
            disabled={!isComplete}
            className={`
              w-full py-3.5 rounded-xl font-bold text-white transition-all duration-200
              ${isComplete 
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]' 
                : 'bg-gray-300 cursor-not-allowed opacity-50'
              }
            `}
          >
            {isComplete ? 'Continue →' : `Please wait ${secondsLeft}s`}
          </button>

          {/* Small note */}
          {!isComplete && (
            <p className="text-[10px] text-gray-400 text-center">
              Don't close this window • Ad is loading in background
            </p>
          )}
        </div>
      </div>
    </div>
  );
}