'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Trophy, Medal, Crown, Star } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

interface LeaderboardUser {
  id: string;
  full_name: string;
  username: string;
  total_earned: number;
  rank: number;
}

type Period = 'daily' | 'weekly' | 'monthly';

export default function LeaderboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [period, setPeriod] = useState<Period>('weekly');
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [period]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get date range
      const now = new Date();
      let startDate = new Date();
      if (period === 'daily') {
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'weekly') {
        startDate.setDate(now.getDate() - 7);
      } else {
        startDate.setMonth(now.getMonth() - 1);
      }

      // Get top users from transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('user_id, coins_amount')
        .eq('type', 'earn_audio')
        .gte('created_at', startDate.toISOString());

      // Aggregate earnings by user
      const earnings: Record<string, number> = {};
      transactions?.forEach(tx => {
        earnings[tx.user_id] = (earnings[tx.user_id] || 0) + tx.coins_amount;
      });

      // Get user details
      const userIds = Object.keys(earnings);
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, full_name, username')
          .in('id', userIds);

        const leaderboard = usersData?.map(u => ({
          ...u,
          total_earned: earnings[u.id] || 0,
        })) || [];

        leaderboard.sort((a, b) => b.total_earned - a.total_earned);
        const ranked = leaderboard.slice(0, 10).map((u, i) => ({ ...u, rank: i + 1 }));
        setUsers(ranked);

        // Find user's rank
        if (user) {
          const userData = leaderboard.find(u => u.id === user.id);
          if (userData) {
            const rank = leaderboard.findIndex(u => u.id === user.id) + 1;
            setUserRank(rank > 10 ? rank : null);
          } else {
            setUserRank(null);
          }
        }
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Leaderboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-700" />;
    return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-gray-400">#{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white pb-10">

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <BackButton />
          <h1 className="font-bold text-gray-900">Leaderboard</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5">

        {/* Period Tabs */}
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-1 mb-5 flex">
          {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-colors capitalize ${
                period === p
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* User Rank Card */}
        {userRank && (
          <div className="bg-gradient-to-br from-purple-600 to-purple-400 rounded-2xl p-5 text-white shadow-xl shadow-purple-200 mb-5">
            <p className="text-purple-200 text-sm">Your Rank</p>
            <p className="text-4xl font-bold">#{userRank}</p>
            <p className="text-purple-200 text-sm mt-1">
              {userRank <= 10 ? 'You\'re in the top 10! 🎉' : 'Keep going to reach top 10!'}
            </p>
          </div>
        )}

        {/* Leaderboard List */}
        <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="font-semibold text-gray-700">Top Earners</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <Star className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No earnings yet</p>
              <p className="text-xs text-gray-300">Listen to audio to appear here!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    {getRankIcon(user.rank)}
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {user.full_name || user.username}
                      </p>
                      <p className="text-xs text-gray-400">@{user.username}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-purple-600">
                      {user.total_earned} 🪙
                    </p>
                    <p className="text-xs text-gray-400">earned</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
