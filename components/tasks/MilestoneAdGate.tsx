'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, CheckCircle, ExternalLink, Clock, AlertCircle } from 'lucide-react';

interface MilestoneAdGateProps {
  milestone: number;
  onUnlocked: () => void;
  onClose?: () => void;
}

interface VerifyResponse {
  success?: boolean;
  error?: string;
  message?: string;
}

// Adsterra Direct Link - Opens in new tab
const ADSTERRA_DIRECT_LINK_URL = 'https://www.effectivecpmnetwork.com/cjwanx75u?key=35c37ccabbe40a0330805d114bcb7f5a';

export default function MilestoneAdGate({ 
  milestone, 
  onUnlocked,
  onClose 
}: MilestoneAdGateProps) {
  const [adOpened, setAdOpened] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(15);
  const [isTimerComplete, setIsTimerComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // ✅ Start ad session - Call this BEFORE opening the ad
  const startAdSession = async () => {
    try {
      const res = await fetch('/api/tasks/level/ads/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestone }),
      });
      
      const text = await res.text();
      if (text && text.trim()) {
        try {
          const data = JSON.parse(text);
          console.log('✅ Ad session started:', data);
          return data;
        } catch {
          console.warn('⚠️ Empty or invalid response from /ads/start');
        }
      }
    } catch (error) {
      console.error('❌ Failed to start ad session:', error);
    }
    return null;
  };

  // Open ad and start timer
  const handleOpenAd = async () => {
    setError(null);
    setRetryCount(0);
    
    // ✅ First, start the ad session on server
    setIsSubmitting(true);
    const sessionData = await startAdSession();
    setIsSubmitting(false);
    
    if (!sessionData) {
      setError('Could not start ad session. Please try again.');
      return;
    }
    
    // ✅ Open Direct Link in new tab
    window.open(ADSTERRA_DIRECT_LINK_URL, '_blank', 'noopener');
    setAdOpened(true);
    setSecondsLeft(15);
    setIsTimerComplete(false);

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
  };

  // Auto-verify when timer completes
  useEffect(() => {
    if (isTimerComplete && adOpened && !isVerified && !isSubmitting) {
      handleVerifyAd();
    }
  }, [isTimerComplete, adOpened]);

  // ✅ FIXED: Verify ad completion
  const handleVerifyAd = async () => {
    if (isSubmitting || isVerified) return;
    setIsSubmitting(true);
    setIsVerifying(true);
    setError(null);

    try {
      console.log('📢 Verifying ad for milestone:', milestone);
      
      const res = await fetch('/api/tasks/level/ads/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ milestone }),
      });

      // ✅ Read response as text
      const text = await res.text();
      console.log('📢 Response text:', text);
      
      // ✅ Parse JSON only if there's content
      let data: VerifyResponse = {};
      if (text && text.trim()) {
        try {
          data = JSON.parse(text) as VerifyResponse;
        } catch (parseError) {
          console.error('❌ JSON parse error:', parseError);
          setError('Invalid response from server. Please try again.');
          setIsVerifying(false);
          setIsSubmitting(false);
          return;
        }
      } else {
        console.warn('⚠️ Empty response from server');
        setError('Server returned empty response. Please try again.');
        setIsVerifying(false);
        setIsSubmitting(false);
        return;
      }

      // ✅ Handle 400 error - "Ad was not started"
      if (res.status === 400) {
        console.error('❌ 400 Error:', data);
        setError(data?.error || 'Ad was not started. Please watch the ad first and try again.');
        setIsVerifying(false);
        setIsSubmitting(false);
        
        // ✅ Reset ad state so user can watch again
        setAdOpened(false);
        setSecondsLeft(15);
        setIsTimerComplete(false);
        return;
      }

      if (!res.ok) {
        console.error('❌ API error:', res.status, data);
        setError(data?.error || `Server error (${res.status}). Please try again.`);
        setIsVerifying(false);
        setIsSubmitting(false);
        return;
      }

      // ✅ Success
      setIsVerified(true);
      setIsVerifying(false);
      toast.success('✅ Ad verified! Continuing...');

      setTimeout(() => {
        onUnlocked();
      }, 500);

    } catch (error) {
      console.error('❌ Network error:', error);
      setError('Network error. Please check your connection and try again.');
      setIsVerifying(false);
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Retry function
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setError(null);
    
    if (adOpened && isTimerComplete) {
      // Try verifying again
      handleVerifyAd();
    } else {
      // Start fresh
      setAdOpened(false);
      setSecondsLeft(15);
      setIsTimerComplete(false);
      handleOpenAd();
    }
  };

  const progress = ((15 - secondsLeft) / 15) * 100;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#6C63FF]/10 flex items-center justify-center">
            <ExternalLink className="w-4 h-4 text-[#6C63FF]" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">
              Milestone {milestone}/15
            </h3>
            <p className="text-xs text-gray-500">
              {isVerified ? '✅ Verified!' : 'Complete ad to continue'}
            </p>
          </div>
        </div>
        {isVerified && (
          <div className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            ✓ Done
          </div>
        )}
      </div>

      {/* Ad Display */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 mb-4 border border-purple-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center">
              <span className="text-white text-xl">📢</span>
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">Sponsored Content</p>
              <p className="text-xs text-gray-500">Watch ad to unlock next audio</p>
            </div>
          </div>
          {!adOpened ? (
            <button
              onClick={handleOpenAd}
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-[#6C63FF] text-white rounded-lg text-xs font-semibold hover:bg-[#5a52e0] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Loading...' : 'Watch Ad'}
            </button>
          ) : isVerified ? (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-semibold">Verified</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
              <span className="text-xs font-medium text-amber-600">{secondsLeft}s</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {adOpened && !isVerified && (
          <div className="mt-3">
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1 text-center">
              {isTimerComplete ? '✓ Ad complete!' : `Please wait ${secondsLeft}s...`}
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-red-600">{error}</p>
              <button
                onClick={handleRetry}
                className="mt-1.5 text-xs text-[#6C63FF] font-semibold hover:underline flex items-center gap-1"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Continue Button */}
      {isVerified ? (
        <button
          onClick={onUnlocked}
          className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          Continue to Next Audio
        </button>
      ) : isVerifying ? (
        <button
          disabled
          className="w-full py-3 bg-gray-200 text-gray-500 rounded-xl font-semibold flex items-center justify-center gap-2 cursor-not-allowed"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          Verifying...
        </button>
      ) : adOpened && !isTimerComplete ? (
        <button
          disabled
          className="w-full py-3 bg-gray-200 text-gray-500 rounded-xl font-semibold flex items-center justify-center gap-2 cursor-not-allowed"
        >
          <Clock className="w-4 h-4 animate-pulse" />
          Please wait {secondsLeft}s
        </button>
      ) : (
        <button
          onClick={handleOpenAd}
          disabled={isSubmitting}
          className="w-full py-3 bg-[#6C63FF] text-white rounded-xl font-semibold hover:bg-[#5a52e0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          {isSubmitting ? 'Starting...' : 'Watch Ad to Continue'}
        </button>
      )}

      {/* Footer */}
      <p className="text-[10px] text-gray-400 text-center mt-3">
        Relevant data is sent to Google
      </p>
    </div>
  );
}