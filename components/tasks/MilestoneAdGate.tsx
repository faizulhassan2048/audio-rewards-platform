'use client';

import { useEffect, useRef, useState } from 'react';
import NativeBanner from '@/components/ads/NativeBanner';
import SmartlinkButton from '@/components/ads/SmartlinkButton';

const SMARTLINK_URL = 'https://www.effectivecpmnetwork.com/cjwanx75u?key=35c37ccabbe40a0330805d114bcb7f5a';

interface MilestoneAdGateProps {
  milestone: number;
  // Called only after the server has confirmed (via /ads/verify) that the
  // ad was actually watched. Never called just because the local timer ran out.
  onUnlocked: () => void;
}

export default function MilestoneAdGate({ milestone, onUnlocked }: MilestoneAdGateProps) {
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [skipToVerify, setSkipToVerify] = useState(false);

  const startedRef = useRef(false);

  // ✅ Mark the ad-gate as started server-side as soon as this shows up —
  // whether that's right after finishing the milestone audio, or later on
  // the bronze hub page if the user left mid-way and came back.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    fetch('/api/tasks/level/ads/start', { method: 'POST' }).catch(() => {});

    // ✅ If the user was sent to the ad in the SAME tab (popup was blocked)
    // and has now navigated back here, skip straight to the verify step —
    // no need to make them sit through the popup UI again.
    try {
      if (sessionStorage.getItem('milestone_ad_pending') === '1') {
        sessionStorage.removeItem('milestone_ad_pending');
        setSkipToVerify(true);
      }
    } catch { /* sessionStorage unavailable — ignore */ }
  }, []);

  const verify = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch('/api/tasks/level/ads/verify', { method: 'POST' });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok) {
        // ✅ Most likely cause: user clicked through faster than the
        // server's minimum watch time. Retry once automatically after a
        // short wait instead of showing a scary error immediately.
        setVerifyError('Just a moment, confirming your ad...');
        setTimeout(async () => {
          try {
            const retryRes = await fetch('/api/tasks/level/ads/verify', { method: 'POST' });
            if (retryRes.ok) {
              setVerifyError(null);
              onUnlocked();
              return;
            }
            const retryText = await retryRes.text();
            const retryData = retryText ? JSON.parse(retryText) : {};
            setVerifyError(retryData.error || 'Could not verify ad. Please try again.');
          } catch {
            setVerifyError('Network error. Please try again.');
          } finally {
            setVerifying(false);
          }
        }, 6000);
        return;
      }

      onUnlocked();
    } catch {
      setVerifyError('Network error verifying ad. Please try again.');
      setVerifying(false);
      return;
    }
    setVerifying(false);
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