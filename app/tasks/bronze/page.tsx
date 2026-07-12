'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LevelProgress from '@/components/tasks/LevelProgress';
import LevelCompleteModal from '@/components/tasks/LevelCompleteModal';
import AdModal from '@/components/audio/AdModal';
import AdBanner from '@/components/ads/AdBanner';
import SmartlinkOverlay from '@/components/tasks/SmartlinkOverlay';

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

export default function BronzeLevelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [showAd, setShowAd] = useState(false);
  const [adMilestone, setAdMilestone] = useState<number | null>(null);
  const [adClaiming, setAdClaiming] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [showSmartlink, setShowSmartlink] = useState(false);
  const [smartlinkMilestone, setSmartlinkMilestone] = useState<number | null>(null);

  const pendingClaimRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks/level/status');
      if (res.status === 401) {
        toast.error('Please login to continue');
        setLoading(false);
        return;
      }
      const statusData: StatusResponse = await res.json();
      setStatus(statusData);

      // Check if ad required
      if (statusData.ad_required && statusData.milestone) {
        setAdMilestone(statusData.milestone);
        setShowAd(true);
        setAdError(null);
      } else {
        setShowAd(false);
        setAdMilestone(null);
      }

      // Check if level complete
      if (statusData.level_complete && !statusData.reward_claimed && !pendingClaimRef.current) {
        pendingClaimRef.current = true;
        await claimReward();
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

  // Check for smartlink or ad from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const smartlink = params.get('smartlink');
    const ad = params.get('ad');
    
    if (smartlink) {
      setSmartlinkMilestone(parseInt(smartlink));
      setShowSmartlink(true);
    }
    
    if (ad) {
      setAdMilestone(parseInt(ad));
      setShowAd(true);
    }
  }, []);

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
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not claim your reward');
        return;
      }
      if (data.success) setShowComplete(true);
    } catch {
      toast.error('Network error while claiming reward');
    } finally {
      pendingClaimRef.current = false;
    }
  };

  const handleAdClaim = async () => {
    setAdClaiming(true);
    setAdError(null);
    try {
      const res = await fetch('/api/tasks/level/ads/verify', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setAdError(data.error || 'Could not verify ad. Please try again.');
        return;
      }

      setShowAd(false);
      setAdMilestone(null);

      if (data.isFinalMilestone) {
        await claimReward();
      } else {
        toast.success('Coins locked in!');
      }
      await fetchStatus();
    } catch {
      setAdError('Network error, your progress is safe, just tap Retry.');
    } finally {
      setAdClaiming(false);
    }
  };

  const handleSmartlinkComplete = () => {
    setShowSmartlink(false);
    setSmartlinkMilestone(null);
    fetchStatus();
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

        {/* Back Button */}
        <Link href="/tasks" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#6C63FF]">
          <ArrowLeft className="w-4 h-4" /> Back to Levels
        </Link>

        {/* Top Ad */}
        <AdBanner position="top" />

        {/* Level Progress */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
          <LevelProgress
            levelName="Bronze"
            completed={status?.completed_audios || 0}
            total={status?.total_audios || 15}
          />
        </div>

        {/* Locked Status */}
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

        {/* Current Audio - Play Button */}
        {!status?.locked && status?.current_audio && !showAd && (
          <button
            onClick={() => {
              const audio = status.current_audio;
              if (audio) {
                router.push(`/tasks/audio/${audio.id}?index=${status.completed_audios + 1}&total=${status.total_audios}`);
              }
            }}
            className="w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#6C63FF] to-purple-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <PlayCircle className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm text-gray-500">Next Audio</p>
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

        {/* No Audio Available */}
        {!status?.locked && !status?.current_audio && !status?.level_complete && !showAd && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-500">Loading next audio...</p>
          </div>
        )}

        {/* Bottom Ad */}
        <div className="fixed bottom-16 sm:bottom-20 left-0 right-0 z-40 px-4">
          <div className="max-w-md mx-auto">
            <AdBanner position="bottom" />
          </div>
        </div>
      </div>

      {/* Smartlink Overlay */}
      {showSmartlink && (
        <SmartlinkOverlay
          onComplete={handleSmartlinkComplete}
          onClose={() => setShowSmartlink(false)}
          durationSeconds={15}
          message={`🎯 ${smartlinkMilestone === 5 ? 'Great progress! Unlock audio 6' : 'Halfway there! Unlock audio 11'}`}
        />
      )}

      {/* Full Ad Modal */}
      {showAd && (
        <AdModal
          onFinished={handleAdClaim}
          rewardCoins={REWARD_COINS}
          claiming={adClaiming}
          errorMessage={adError}
        />
      )}

      {/* Level Complete Modal */}
      {showComplete && (
        <LevelCompleteModal
          rewardCoins={REWARD_COINS}
          bonusCoins={BONUS_COINS}
          onClose={() => { setShowComplete(false); fetchStatus(); }}
        />
      )}
    </div>
  );
}