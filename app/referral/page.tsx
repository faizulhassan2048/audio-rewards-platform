'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { 
  ArrowLeft, Copy, Share2, Users, Gift, 
  CheckCircle, Clock, Award, TrendingUp, 
  AlertCircle, Coins, Zap
} from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

interface ReferralStats {
  total: number;
  pending: number;
  qualified: number;
  rewarded: number;
  fraud_banned: number;
  coins_earned: number;
  milestone_coins: number;
  total_earned: number;
}

interface MilestoneInfo {
  next_milestone: number;
  progress_percentage: number;
  referrals_needed: number;
}

interface ReferralHistory {
  id: string;
  referred_user: string;
  status: string;
  reward_coins: number;
  created_at: string;
  fraud_reason?: string | null;
}

export default function ReferralPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [milestones, setMilestones] = useState<MilestoneInfo | null>(null);
  const [history, setHistory] = useState<ReferralHistory[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const response = await fetch('/api/referral');
      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setReferralCode(data.referral_code || '');
      setStats(data.stats);
      setMilestones(data.milestones);
      setHistory(data.history || []);
      
    } catch (error) {
      toast.error('Error loading referral data');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    const link = `${window.location.origin}/?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    const link = `${window.location.origin}/?ref=${referralCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join YouTask',
          text: 'Earn 30 coins by joining! Use my referral link:',
          url: link,
        });
      } catch {
        // User cancelled
      }
    } else {
      copyLink();
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { label: '⏳ Pending (7 days)', color: 'bg-yellow-100 text-yellow-700' },
      qualified: { label: '📋 Qualified', color: 'bg-blue-100 text-blue-700' },
      rewarded: { label: '✅ Rewarded 30 coins', color: 'bg-green-100 text-green-700' },
      fraud_banned: { label: '🚫 Banned', color: 'bg-red-100 text-red-700' },
    };
    return badges[status as keyof typeof badges] || { label: status, color: 'bg-gray-100 text-gray-700' };
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

        {/* Hero Card */}
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
                {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
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
          <p className="text-purple-200 text-sm mt-3 flex items-center gap-1">
            <Zap className="w-4 h-4" />
            Share this code. Both you & friend earn <strong className="text-white">30 coins each!</strong>
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow border border-gray-100 text-center">
            <Users className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-800">{stats?.total || 0}</p>
            <p className="text-xs text-gray-400">Total</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow border border-gray-100 text-center">
            <Clock className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-800">{stats?.pending || 0}</p>
            <p className="text-xs text-gray-400">Pending (7 days)</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow border border-gray-100 text-center">
            <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-800">{stats?.rewarded || 0}</p>
            <p className="text-xs text-gray-400">Rewarded</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow border border-gray-100 text-center">
            <Coins className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-800">{stats?.total_earned || 0}</p>
            <p className="text-xs text-gray-400">Coins Earned</p>
          </div>
        </div>

        {/* Milestone Progress */}
        {milestones && milestones.next_milestone && (
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-600" />
                <span className="font-bold text-gray-800">Milestone Bonus</span>
              </div>
              <span className="text-sm font-semibold text-purple-600">
                {stats?.rewarded || 0} / {milestones.next_milestone}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div
                className="bg-gradient-to-r from-purple-600 to-pink-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${milestones.progress_percentage}%` }}
              />
            </div>
            
            <p className="text-sm text-gray-600 text-center">
              {milestones.referrals_needed > 0 ? (
                <>🎯 {milestones.referrals_needed} more referrals to earn <strong className="text-purple-600">200 coins</strong> bonus!</>
              ) : (
                <>🎉 You reached {milestones.next_milestone} referrals! Bonus earned!</>
              )}
            </p>
          </div>
        )}

        {/* How it Works */}
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
              <p>Friends will sign up using your link</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-purple-100 text-purple-600 font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs">3</span>
              <p>Friends will complete all  tasks for<strong>7 days</strong> daily</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-purple-100 text-purple-600 font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs">4</span>
              <p>🎉 <strong>Both will</strong> get <strong>30 coins</strong> each!</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-green-100 text-green-600 font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs">⭐</span>
              <p>Earn <strong>200 coins bonus</strong> for every 10 successful referrals!</p>
            </div>
          </div>

          {/* Warning */}
          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600">
              ⚠️ <strong>Fraud detection:</strong> Multiple accounts from same device/IP will result in <strong>permanent ban</strong>.
            </p>
          </div>
        </div>

        {/* Referral History */}
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
              {history.map((item) => {
                const badge = getStatusBadge(item.status);
                return (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full ${
                        item.status === 'rewarded' ? 'bg-green-500' :
                        item.status === 'qualified' ? 'bg-blue-500' :
                        item.status === 'fraud_banned' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{item.referred_user}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${badge.color}`}>
                          {badge.label}
                        </span>
                        {item.fraud_reason && (
                          <p className="text-xs text-red-500 mt-0.5">{item.fraud_reason}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      {item.reward_coins > 0 && (
                        <p className="text-sm font-bold text-purple-600">+{item.reward_coins} 🪙</p>
                      )}
                      <p className="text-xs text-gray-400">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}