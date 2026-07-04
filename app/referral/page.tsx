'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { 
  ArrowLeft, Copy, Share2, Users, Gift, 
  CheckCircle, Clock, Award, TrendingUp 
} from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

interface ReferralStats {
  total: number;
  pending: number;
  qualified: number;
  rewarded: number;
  total_earned: number;
}

interface ReferralHistory {
  id: string;
  referred_user: string;
  status: string;
  reward_coins: number;
  created_at: string;
}

export default function ReferralPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [history, setHistory] = useState<ReferralHistory[]>([]);

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data: userData } = await supabase
        .from('users')
        .select('referral_code')
        .eq('id', user.id)
        .single();

      if (userData?.referral_code) {
        setReferralCode(userData.referral_code);
      }

      const { data: referrals } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id);

      if (referrals) {
        const stats = {
          total: referrals.length,
          pending: referrals.filter(r => r.status === 'pending').length,
          qualified: referrals.filter(r => r.status === 'qualified').length,
          rewarded: referrals.filter(r => r.status === 'rewarded').length,
          total_earned: referrals.reduce((sum, r) => sum + (r.reward_coins || 0), 0),
        };
        setStats(stats);

        const historyData = await Promise.all(
          referrals.map(async (ref) => {
            const { data: referredUser } = await supabase
              .from('users')
              .select('full_name, username')
              .eq('id', ref.referred_id)
              .single();
            return {
              id: ref.id,
              referred_user: referredUser?.full_name || referredUser?.username || 'Unknown',
              status: ref.status,
              reward_coins: ref.reward_coins || 0,
              created_at: ref.created_at,
            };
          })
        );
        setHistory(historyData);
      }
    } catch (error) {
      toast.error('Error loading referral data');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    const link = `${window.location.origin}/?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Referral link copied!');
  };

  const shareLink = async () => {
    const link = `${window.location.origin}/?ref=${referralCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join YouTask',
          text: 'Earn rewards by listening to audio! Use my referral link:',
          url: link,
        });
      } catch {
        // User cancelled
      }
    } else {
      copyLink();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white pb-10">

      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <BackButton />
          <h1 className="font-bold text-gray-900">Refer & Earn</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        <div className="bg-gradient-to-br from-purple-600 to-purple-400 rounded-2xl p-6 text-white shadow-xl shadow-purple-200">
          <p className="text-purple-200 text-sm font-medium">Your Referral Code</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-4xl font-bold tracking-wider">{referralCode || '------'}</p>
            <div className="flex gap-2">
              <button
                onClick={copyLink}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title="Copy link"
              >
                <Copy className="w-5 h-5" />
              </button>
              <button
                onClick={shareLink}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title="Share"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
          <p className="text-purple-200 text-sm mt-3">
            Share this code with friends. You both earn rewards! 🎉
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow border border-gray-100 text-center">
            <Users className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-800">{stats?.total || 0}</p>
            <p className="text-xs text-gray-400">Total</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow border border-gray-100 text-center">
            <Clock className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-800">{stats?.pending || 0}</p>
            <p className="text-xs text-gray-400">Pending</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow border border-gray-100 text-center">
            <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-800">{stats?.qualified || 0}</p>
            <p className="text-xs text-gray-400">Qualified</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow border border-gray-100 text-center">
            <Gift className="w-5 h-5 text-pink-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-800">{stats?.total_earned || 0}</p>
            <p className="text-xs text-gray-400">Earned</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            How it Works
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-3">
              <span className="bg-purple-100 text-purple-600 font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs">1</span>
              <p>Share your unique referral link with friends</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-purple-100 text-purple-600 font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs">2</span>
              <p>Friend signs up using your link</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-purple-100 text-purple-600 font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs">3</span>
              <p>Friend listens to their first audio completely</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-purple-100 text-purple-600 font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs">4</span>
              <p>🎉 You get <strong>50 coins</strong> & Friend gets <strong>25 coins</strong></p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-400" />
            Referral History
          </h3>
          {history.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No referrals yet</p>
              <p className="text-xs text-gray-300">Share your link to start earning!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      item.status === 'rewarded' ? 'bg-green-500' :
                      item.status === 'qualified' ? 'bg-blue-500' : 'bg-yellow-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-gray-700">{item.referred_user}</p>
                      <p className="text-xs text-gray-400 capitalize">{item.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {item.reward_coins > 0 && (
                      <p className="text-sm font-bold text-purple-600">+{item.reward_coins} 🪙</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
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