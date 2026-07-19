'use client';

import { useEffect, useRef, useState } from 'react';
import NativeBanner from '@/components/ads/NativeBanner';
import SmartlinkButton from '@/components/ads/SmartlinkButton';
import { toast } from 'sonner';

const SMARTLINK_URL = 'https://www.effectivecpmnetwork.com/cjwanx75u?key=35c37ccabbe40a0330805d114bcb7f5a';

interface MilestoneAdGateProps {
  milestone: number;
  onUnlocked: () => void;
}

// ✅ Safe JSON fetch helper
const safeFetch = async (url: string, options?: RequestInit) => {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    if (!text) {
      console.warn('⚠️ Empty response from:', url);
      return null;
    }
    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error('❌ JSON parse error for:', url, parseError);
      console.log('Response text:', text.substring(0, 200));
      return null;
    }
  } catch (error) {
    console.error('❌ Fetch error for:', url, error);
    return null;
  }
};

export default function MilestoneAdGate({ milestone, onUnlocked }: MilestoneAdGateProps) {
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [skipToVerify, setSkipToVerify] = useState(false);
  const [isVerifyingAd, setIsVerifyingAd] = useState(false);

  const startedRef = useRef(false);
  const verifyInProgress = useRef(false);

  // ✅ Mark the ad-gate as started server-side
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    
    safeFetch('/api/tasks/level/ads/start', { method: 'POST' }).catch(() => {});

    try {
      if (sessionStorage.getItem('milestone_ad_pending') === '1') {
        sessionStorage.removeItem('milestone_ad_pending');
        setSkipToVerify(true);
      }
    } catch { /* sessionStorage unavailable */ }
  }, []);

  // ✅ Verify with debounce to prevent duplicate calls
  const verify = async () => {
    // ✅ Prevent multiple simultaneous verify calls
    if (verifyInProgress.current) {
      console.log('⏳ Verify already in progress, skipping...');
      return;
    }
    
    verifyInProgress.current = true;
    setVerifying(true);
    setVerifyError(null);

    try {
      console.log('🔍 Verifying ad for milestone:', milestone);
      
      // ✅ First verify the ad
      const data = await safeFetch('/api/tasks/level/ads/verify', { method: 'POST' });

      if (!data) {
        setVerifyError('Could not verify ad. Please try again.');
        verifyInProgress.current = false;
        setVerifying(false);
        return;
      }

      // ✅ If already unlocked or success
      if (data.alreadyUnlocked || data.alreadyProcessed || data.success) {
        toast.success('✅ Ad verified!');
        
        // ✅ IMPORTANT: Wait for database to commit before proceeding
        await new Promise(resolve => setTimeout(resolve, 800));
        
        setVerifying(false);
        verifyInProgress.current = false;
        onUnlocked();
        return;
      }

      // ✅ Not enough time? Retry after delay
      if (!data.success) {
        setVerifyError('Just a moment, confirming your ad...');
        
        // ✅ Retry after 5 seconds
        setTimeout(async () => {
          try {
            console.log('🔄 Retrying verify...');
            const retryData = await safeFetch('/api/tasks/level/ads/verify', { method: 'POST' });
            
            if (retryData?.success || retryData?.alreadyUnlocked) {
              setVerifyError(null);
              toast.success('✅ Ad verified!');
              await new Promise(resolve => setTimeout(resolve, 500));
              verifyInProgress.current = false;
              setVerifying(false);
              onUnlocked();
              return;
            }
            
            setVerifyError(retryData?.error || 'Could not verify ad. Please try again.');
          } catch (err) {
            console.error('Retry verify error:', err);
            setVerifyError('Network error. Please try again.');
          } finally {
            verifyInProgress.current = false;
            setVerifying(false);
          }
        }, 5000);
        return;
      }
    } catch (error) {
      console.error('Verify error:', error);
      setVerifyError('Network error verifying ad. Please try again.');
      verifyInProgress.current = false;
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-t border-gray-200 pt-4">
        <p className="text-sm font-semibold text-purple-600 text-center mb-2">
          ⭐ Milestone {milestone}/15 — complete an ad to continue
        </p>
        <NativeBanner />
      </div>

      {skipToVerify ? (
        <button
          onClick={verify}
          disabled={verifying || isVerifyingAd}
          className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-60"
        >
          {verifying ? '⏳ Verifying...' : '✅ I completed the ad — Continue'}
        </button>
      ) : (
        <SmartlinkButton
          smartlinkUrl={SMARTLINK_URL}
          onComplete={verify}
          buttonText={verifying ? '⏳ Verifying...' : 'Continue to Next Audio'}
        />
      )}

      {verifyError && (
        <p className="text-xs text-red-500 text-center">{verifyError}</p>
      )}
    </div>
  );
}