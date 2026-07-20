'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock, ChevronRight } from 'lucide-react';
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

  const safeFetch = async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, options);
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
      if (!data) {
        console.warn('⚠️ No status data received');
        return;
      }
      setStatus(data);
      if (data.level_complete && data.reward_claimed) {
        setShowComplete(true);
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

        {/* Header */}
        <div className="text-center py-2">
          <h1 className="text-2xl font-bold text-gray-800">🥈 Silver Level</h1>
          <p className="text-sm text-gray-500">Complete all paragraphs to earn rewards</p>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Progress</span>
            <span className="text-sm font-medium text-[#6C63FF]">
              {status?.completed_paragraphs || 0}/{TOTAL_PARAGRAPHS}
            </span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#6C63FF] rounded-full transition-all duration-500"
              style={{
                width: `${((status?.completed_paragraphs || 0) / TOTAL_PARAGRAPHS) * 100}%`
              }}
            />
          </div>
        </div>

        {/* Level Complete */}
        {showComplete && (
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
        )}

        {/* Start/Continue Button */}
        {!showComplete && (
          <button
            onClick={() => {
              if (status?.current_paragraph) {
                const p = status.current_paragraph;
                router.push(
                  `/tasks/silver/${p.id}?number=${p.paragraph_number}&total=${TOTAL_PARAGRAPHS}`
                );
              } else {
                toast.info('Loading next paragraph...');
                fetchStatus();
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
                  Paragraph {status?.completed_paragraphs && status.completed_paragraphs < TOTAL_PARAGRAPHS
                    ? status.completed_paragraphs + 1
                    : 1}/{TOTAL_PARAGRAPHS}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Fill in the missing word to continue
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </button>
        )}

        <BottomBanner />

      </div>
    </div>
  );
}