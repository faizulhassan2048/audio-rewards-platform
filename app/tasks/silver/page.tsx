'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import TopBanner from '@/components/ads/TopBanner';
import BottomBanner from '@/components/ads/BottomBanner';

interface StatusResponse {
  locked: boolean;
  level_complete?: boolean;
  reward_claimed?: boolean;
  completed_paragraphs: number;
  total_paragraphs: number;
  current_paragraph?: {
    id: string;
    paragraph_number: number;
    content: string;
    missing_word: string;
  } | null;
}

const REWARD_COINS = 45;
const TOTAL_PARAGRAPHS = 15;

export default function SilverLevelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const safeFetch = async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, { cache: 'no-store', ...options });
      const text = await res.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  };

  const fetchStatus = useCallback(async () => {
    try {
      const data = await safeFetch('/api/tasks/silver/status');
      console.log('📊 Silver status:', data);
      
      if (!data) {
        console.warn('⚠️ No status data received');
        setLoading(false);
        return;
      }
      
      setStatus(data);
      
      if (data.level_complete && !data.reward_claimed) {
        setShowComplete(true);
      } else {
        setShowComplete(false);
      }
    } catch (err) {
      console.error('fetchStatus error:', err);
      toast.error('Could not load progress');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleCompleteClose = () => {
    setShowComplete(false);
    router.push('/tasks');
  };

  const handleClaimReward = async () => {
    if (isClaiming) return;
    setIsClaiming(true);

    try {
      const res = await fetch('/api/tasks/silver/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok) {
        toast.error(data.error || 'Could not claim reward');
        setIsClaiming(false);
        return;
      }

      if (data.success || data.alreadyClaimed) {
        toast.success('🎉 +45 coins added!');
        setShowComplete(false);
        await fetchStatus();
      }
    } catch (error) {
      console.error('Claim error:', error);
      toast.error('Network error');
    } finally {
      setIsClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6C63FF]" />
      </div>
    );
  }

  if (status?.level_complete && status?.reward_claimed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white px-4 py-6 pb-32">
        <div className="max-w-md mx-auto space-y-4">

          <Link href="/tasks" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#6C63FF]">
            <ArrowLeft className="w-4 h-4" /> Back to Levels
          </Link>

          <TopBanner />

          <div className="text-center py-2">
            <h1 className="text-2xl font-bold text-gray-800">🥈 Silver Level</h1>
            <p className="text-sm text-gray-500">Complete all paragraphs to earn rewards</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Progress</span>
              <span className="text-sm font-medium text-green-600">
                ✅ {status.completed_paragraphs}/{TOTAL_PARAGRAPHS}
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-3xl">🥈</span>
            </div>
            <h3 className="font-bold text-green-800 text-lg">🎉 Silver Level Complete!</h3>
            <p className="text-sm text-green-700 mt-1">+{REWARD_COINS} coins added!</p>
            <button
              onClick={handleCompleteClose}
              className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Continue
            </button>
          </div>

          <BottomBanner />

        </div>
      </div>
    );
  }

  if (status?.level_complete && !status?.reward_claimed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white px-4 py-6 pb-32">
        <div className="max-w-md mx-auto space-y-4">

          <Link href="/tasks" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#6C63FF]">
            <ArrowLeft className="w-4 h-4" /> Back to Levels
          </Link>

          <TopBanner />

          <div className="text-center py-2">
            <h1 className="text-2xl font-bold text-gray-800">🥈 Silver Level</h1>
            <p className="text-sm text-gray-500">Complete all paragraphs to earn rewards</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Progress</span>
              <span className="text-sm font-medium text-green-600">
                ✅ {status.completed_paragraphs}/{TOTAL_PARAGRAPHS}
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="text-3xl">🎁</span>
            </div>
            <h3 className="font-bold text-amber-800 text-lg">🎉 Level Complete!</h3>
            <p className="text-sm text-amber-700 mt-1">Claim your +{REWARD_COINS} coins reward!</p>
            <button
              onClick={handleClaimReward}
              disabled={isClaiming}
              className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {isClaiming ? 'Claiming...' : '💰 Claim Reward'}
            </button>
          </div>

          <BottomBanner />

        </div>
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

        <div className="text-center py-2">
          <h1 className="text-2xl font-bold text-gray-800">🥈 Silver Level</h1>
          <p className="text-sm text-gray-500">Complete all paragraphs to earn rewards</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Progress</span>
            <span className="text-sm font-medium text-[#6C63FF]">
              {status?.completed_paragraphs ?? 0}/{TOTAL_PARAGRAPHS}
            </span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#6C63FF] rounded-full transition-all duration-500"
              style={{
                width: `${((status?.completed_paragraphs ?? 0) / TOTAL_PARAGRAPHS) * 100}%`
              }}
            />
          </div>
        </div>

        {status?.current_paragraph && (
          <button
            onClick={() => {
              const p = status.current_paragraph;
              if (p) {
                router.push(
                  `/tasks/silver/${p.id}?number=${p.paragraph_number}&total=${TOTAL_PARAGRAPHS}`
                );
              }
            }}
            className="w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-gray-400 to-gray-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="text-3xl">📝</span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm text-gray-500">
                  {status?.completed_paragraphs === 0 ? 'Start Level' : 'Continue'}
                </p>
                <h3 className="font-bold text-gray-800">
                  {/* ✅ FIXED: Line 304 error */}
                  Paragraph {((status?.completed_paragraphs ?? 0) + 1)}/{TOTAL_PARAGRAPHS}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Fill in the missing word to continue
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </button>
        )}

        {!status?.current_paragraph && (status?.completed_paragraphs ?? 0) < TOTAL_PARAGRAPHS && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-center">
            <p className="text-sm text-yellow-700">Loading next paragraph...</p>
            <button
              onClick={() => fetchStatus()}
              className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        <BottomBanner />

      </div>
    </div>
  );
}