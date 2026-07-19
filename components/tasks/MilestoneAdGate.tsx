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

  const startedRef = useRef(false);

  // ✅ Mark the ad-gate as started server-side
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    
    safeFetch('/api/tasks/level/ads/start', { method: 'POST' }).catch(() => {});

    // ✅ Same-tab fallback: user came back from ad
    try {
      if (sessionStorage.getItem('milestone_ad_pending') === '1') {
        sessionStorage.removeItem('milestone_ad_pending');
        setSkipToVerify(true);
      }
    } catch { /* sessionStorage unavailable */ }
  }, []);

  const verify = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const data = await safeFetch('/api/tasks/level/ads/verify', { method: 'POST' });

      if (!data) {
        setVerifyError('Could not verify ad. Please try again.');
        setVerifying(false);
        return;
      }

      if (data.alreadyUnlocked || data.alreadyProcessed || data.success) {
        toast.success('✅ Ad verified! Continuing...');
        onUnlocked();
        setVerifying(false);
        return;
      }

      // ✅ Not enough time? Retry automatically after 6 seconds
      if (!data.success) {
        setVerifyError('Just a moment, confirming your ad...');
        setTimeout(async () => {
          try {
            const retryData = await safeFetch('/api/tasks/level/ads/verify', { method: 'POST' });
            if (retryData?.success) {
              setVerifyError(null);
              toast.success('✅ Ad verified! Continuing...');
              onUnlocked();
              return;
            }
            setVerifyError(retryData?.error || 'Could not verify ad. Please try again.');
          } catch {
            setVerifyError('Network error. Please try again.');
          } finally {
            setVerifying(false);
          }
        }, 6000);
        return;
      }
    } catch {
      setVerifyError('Network error verifying ad. Please try again.');
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
          disabled={verifying}
          className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-60"
        >
          {verifying ? 'Verifying...' : '✅ I completed the ad — Continue'}
        </button>
      ) : (
        <SmartlinkButton
          smartlinkUrl={SMARTLINK_URL}
          onComplete={verify}
          buttonText={verifying ? 'Verifying...' : 'Continue to Next Audio'}
        />
      )}

      {verifyError && (
        <p className="text-xs text-red-500 text-center">{verifyError}</p>
      )}
    </div>
  );
}