'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LevelProgress from '@/components/tasks/LevelProgress';
import LevelCompleteModal from '@/components/tasks/LevelCompleteModal';
import MilestoneAdGate from '@/components/tasks/MilestoneAdGate';
import TopBanner from '@/components/ads/TopBanner';
import BottomBanner from '@/components/ads/BottomBanner';

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

  const pendingClaimRef = useRef(false);
  const isResetting = useRef(false);

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

      // ✅ Auto-claim reward when level complete
      if (statusData.level_complete && !statusData.reward_claimed && !pendingClaimRef.current) {
        pendingClaimRef.current = true;
        await claimReward();
      }

      // ✅ If level complete and reward claimed, auto-reset
      if (statusData.level_complete && statusData.reward_claimed) {
        if (!isResetting.current) {
          isResetting.current = true;
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      }
    } catch (err) {
      console.error('fetchStatus error:', err);
      toast.error('Could not load task progress');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
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
    try {
      const res = await fetch('/api/tasks/level/claim', { method: 'POST' });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        toast.error(data.error || 'Could not claim your reward');
        return;
      }
      if (data.success) {
        setShowComplete(true);
      }
    } catch {
      toast.error('Network error while claiming reward');
    } finally {
      pendingClaimRef.current = false;
    }
  };

  // ✅ Fallback path: user left the audio page mid ad-gate (closed tab,
  // refreshed, pressed back). Status now reports ad_required with no
  // current_audio — show the exact same inline ad-gate here so they're
  // never stuck without a way forward.
  const handleMilestoneUnlocked = async () => {
    await fetchStatus();
  };

  const handleCompleteClose = () => {
    setShowComplete(false);
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  const isMilestone = status?.current_audio
    ? MILESTONES.includes(status.completed_audios + 1)
    : false;

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

        {status?.locked && (
          <div className="bg-white rounded-2xl border border-amber-100 p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-50 flex items-center justify-center text-2xl">
              🥉
            </div>
            <p className="font-semibold text-gray-800 mb-1">Bronze Level Complete!</p>
            <p className="text-sm text-gray-500">
              Next round in <span className="font-bold text-[#6C63FF]">{countdown || '...'}</span>
            </p>
          </div>
        )}

        {/* ✅ Level Complete Card */}
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

        {/* ✅ Fallback inline ad-gate — only shows if the user ended up here
            while an ad was still pending (didn't finish it on the audio page) */}
        {status?.ad_required && status?.milestone && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
            <MilestoneAdGate
              milestone={status.milestone}
              onUnlocked={handleMilestoneUnlocked}
            />
          </div>
        )}

        {/* ✅ Audio Button - Only shown when no ad required and not complete */}
        {!status?.locked && !status?.ad_required && !status?.level_complete && status?.current_audio && (
          <button
            onClick={() => {
              const audio = status.current_audio;
              if (audio) {
                const url = `/tasks/audio/${audio.id}?index=${status.completed_audios + 1}&total=${status.total_audios}`;
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
                  {isMilestone ? '⭐ Milestone Audio' : 'Next Audio'}
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