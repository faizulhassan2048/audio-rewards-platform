'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, PlayCircle, AlertCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LevelProgress from '@/components/tasks/LevelProgress';
import LevelCompleteModal from '@/components/tasks/LevelCompleteModal';
import TopBanner from '@/components/ads/TopBanner';
import BottomBanner from '@/components/ads/BottomBanner';
import AdModal from '@/components/audio/AdModal';

interface StatusResponse {
  locked: boolean;
  locked_until?: string;
  level_complete?: boolean;
  reward_claimed?: boolean;
  ad_required?: boolean;
  milestone?: number | null;
  level_name: string;
  completed_audios: number;
  total_audios: number;
  current_audio?: {
    id: string;
    title: string;
    audio_url: string;
    thumbnail_url?: string | null;
    duration_seconds: number;
    index: number;
  } | null;
}

const REWARD_COINS = 45;
const BONUS_COINS = 10;
const MILESTONES = [5, 10, 15];

export default function BronzeLevelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [showAd, setShowAd] = useState(false);
  const [adMilestone, setAdMilestone] = useState<number | null>(null);
  const [adClaiming, setAdClaiming] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);
  const [isProcessingAd, setIsProcessingAd] = useState(false);
  const [rewardProcessing, setRewardProcessing] = useState(false);

  const pendingClaimRef = useRef(false);
  const isResetting = useRef(false);
  const fetchInterval = useRef<NodeJS.Timeout | null>(null);
  const mountRef = useRef(true);

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

  const fetchStatus = useCallback(async () => {
    if (!mountRef.current) return;
    
    try {
      const statusData = await safeFetch('/api/tasks/level/status');
      
      if (!statusData) {
        console.warn('⚠️ No status data received');
        return;
      }

      if (statusData.error) {
        if (statusData.error === 'Unauthorized') {
          toast.error('Please login to continue');
          setLoading(false);
          return;
        }
        console.error('Status API error:', statusData.error);
        return;
      }

      setStatus(statusData);

      // ✅ Check if level is complete and reward claimed
      if (statusData.level_complete && statusData.reward_claimed) {
        // ✅ Show completion modal
        if (!showComplete && !isResetting.current) {
          setShowComplete(true);
        }
        setLoading(false);
        return;
      }

      // ✅ If ad_required is true, show AdModal
      if (statusData.ad_required && statusData.milestone) {
        setAdMilestone(statusData.milestone);
        setShowAd(true);
        setAdError(null);
        setLoading(false);
        return;
      }

      // ✅ Clear ad state if no ad required
      if (showAd) {
        setShowAd(false);
        setAdMilestone(null);
      }

      // ✅ Auto-claim reward when level complete (only once)
      if (statusData.level_complete && !statusData.reward_claimed && !pendingClaimRef.current && !rewardProcessing) {
        pendingClaimRef.current = true;
        setRewardProcessing(true);
        await claimReward();
        setRewardProcessing(false);
      }

    } catch (err) {
      console.error('fetchStatus error:', err);
      toast.error('Could not load task progress');
    } finally {
      setLoading(false);
    }
  }, [showAd, showComplete]);

  useEffect(() => {
    mountRef.current = true;
    fetchStatus();

    // ✅ Cleanup
    return () => {
      mountRef.current = false;
      if (fetchInterval.current) {
        clearInterval(fetchInterval.current);
        fetchInterval.current = null;
      }
    };
  }, [fetchStatus]);

  useEffect(() => {
    if (!status?.locked || !status.locked_until) return;
    const tick = () => {
      const diff = new Date(status.locked_until!).getTime() - Date.now();
      if (diff <= 0) { setCountdown(''); fetchStatus(); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${h}h ${m}m`);
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [status?.locked, status?.locked_until, fetchStatus]);

  const claimReward = async () => {
    if (pendingClaimRef.current) return;
    
    try {
      const data = await safeFetch('/api/tasks/level/claim', { method: 'POST' });
      
      if (!data) {
        toast.error('Could not claim your reward');
        return;
      }
      
      if (data.success) {
        setShowComplete(true);
        toast.success('🎉 Level Complete! Reward claimed!');
        // ✅ Don't reload immediately, let modal handle it
      }
    } catch {
      toast.error('Network error while claiming reward');
    } finally {
      pendingClaimRef.current = false;
    }
  };

  const handleCompleteClose = () => {
    setShowComplete(false);
    // ✅ Reload after modal closes to reset level
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  // ✅ Handle Ad Complete with debounce
  const handleAdClaim = async () => {
    if (isProcessingAd) {
      console.log('⏳ Ad already processing, please wait...');
      return;
    }

    setAdClaiming(true);
    setAdError(null);
    setIsProcessingAd(true);

    try {
      const data = await safeFetch('/api/tasks/level/ads/verify', { method: 'POST' });

      if (!data) {
        setAdError('Could not verify ad. Please try again.');
        setIsProcessingAd(false);
        setAdClaiming(false);
        return;
      }

      if (data.alreadyUnlocked || data.alreadyProcessed) {
        // ✅ Already processed, just update UI
        setShowAd(false);
        setAdMilestone(null);
        await fetchStatus();
        setIsProcessingAd(false);
        setAdClaiming(false);
        return;
      }

      if (!data.success) {
        setAdError(data.error || 'Could not verify ad. Please try again.');
        setIsProcessingAd(false);
        setAdClaiming(false);
        return;
      }

      // ✅ Success - close ad and refresh status
      setShowAd(false);
      setAdMilestone(null);

      if (data.isFinalMilestone) {
        toast.success('🎉 Level Complete! Claiming reward...');
        await claimReward();
      } else {
        toast.success('✅ Ad complete! Continue to next audio.');
      }

      // ✅ Wait before fetching status
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchStatus();

    } catch (error) {
      console.error('Ad claim error:', error);
      setAdError('Network error, your progress is safe, just tap Retry.');
    } finally {
      setAdClaiming(false);
      setIsProcessingAd(false);
    }
  };

  const handleManualAdRetry = () => {
    setShowAd(true);
    setAdError(null);
    setAdMilestone(status?.milestone || null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6C63FF]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white px-4 py-6 pb-32">
      <div className="max-w-md mx-auto space-y-4">

        <Link href="/tasks" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#6C63FF]">
          <ArrowLeft className="w-4 h-4" /> Back to Levels
        </Link>

        <TopBanner />

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
          <LevelProgress
            levelName="Bronze"
            completed={status?.completed_audios || 0}
            total={status?.total_audios || 15}
          />
        </div>

        {/* ✅ Level Complete - Show appropriate message */}
        {status?.level_complete && status?.reward_claimed && !showComplete && (
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-bold text-green-800 text-lg">🎉 Level Complete!</h3>
            <p className="text-sm text-green-700 mt-1">
              {status.completed_audios}/{status.total_audios} audios completed
            </p>
            <button
              onClick={handleCompleteClose}
              className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {/* ✅ AD REQUIRED CARD */}
        {status?.ad_required && !showAd && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-yellow-100 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <h3 className="font-bold text-yellow-800 text-lg">📢 Ad Required</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Complete the ad to unlock Audio {status.completed_audios + 1}
            </p>
            <p className="text-xs text-yellow-600 mt-2">
              ⏳ Progress saved: {status.completed_audios}/{status.total_audios} audios completed
            </p>
            <button
              onClick={handleManualAdRetry}
              className="mt-4 px-6 py-2 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors"
            >
              🔄 Show Ad
            </button>
          </div>
        )}

        {/* ✅ Audio Button - Only when no ad required and not complete */}
        {!status?.locked && !status?.ad_required && !status?.level_complete && status?.current_audio && (
          <button
            onClick={() => {
              const audio = status.current_audio;
              if (audio) {
                const isMilestone = MILESTONES.includes(status.completed_audios + 1);
                const url = `/tasks/audio/${audio.id}?index=${status.completed_audios + 1}&total=${status.total_audios}&milestone=${isMilestone}`;
                window.location.href = url;
              }
            }}
            className="w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#6C63FF] to-purple-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <PlayCircle className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm text-gray-500">
                  {MILESTONES.includes(status.completed_audios + 1) ? '⭐ Milestone Audio' : 'Next Audio'}
                </p>
                <h3 className="font-bold text-gray-800">
                  Audio {status.completed_audios + 1}/{status.total_audios}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Tap to start listening
                </p>
              </div>
              <span className="text-sm font-medium text-[#6C63FF]">
                {status.completed_audios + 1}/{status.total_audios}
              </span>
            </div>
          </button>
        )}

        {!status?.locked && !status?.ad_required && !status?.current_audio && !status?.level_complete && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-500">Loading next audio...</p>
          </div>
        )}

        <div className="fixed bottom-16 sm:bottom-20 left-0 right-0 z-40 pointer-events-none">
          <div className="max-w-md mx-auto px-4 pointer-events-auto">
            <BottomBanner />
          </div>
        </div>

      </div>

      {/* ✅ AD MODAL */}
      {showAd && (
        <AdModal
          onFinished={handleAdClaim}
          rewardCoins={adMilestone === 15 ? REWARD_COINS : 0}
          claiming={adClaiming}
          errorMessage={adError}
          key={`ad-${adMilestone}-${Date.now()}`}
        />
      )}

      {/* ✅ LEVEL COMPLETE MODAL */}
      {showComplete && (
        <LevelCompleteModal
          rewardCoins={REWARD_COINS}
          bonusCoins={BONUS_COINS}
          onClose={handleCompleteClose}
          key={`complete-${Date.now()}`}
        />
      )}
    </div>
  );
}