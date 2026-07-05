'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { User, Mail, Calendar, LogOut, Copy, Check, Users, Gift } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [referralCode, setReferralCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [referralStats, setReferralStats] = useState({
    total: 0,
    active: 0,
    rewarded: 0,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      // Get referral code
      const { data: referralData } = await supabase
        .from('referrals')
        .select('referral_code')
        .eq('referrer_id', user.id)
        .maybeSingle();

      // Get referral stats
      const { data: referrals } = await supabase
        .from('referrals')
        .select('status')
        .eq('referrer_id', user.id);

      const stats = {
        total: referrals?.length || 0,
        active: referrals?.filter((r: any) => r.status === 'active' || r.status === 'qualified').length || 0,
        rewarded: referrals?.filter((r: any) => r.status === 'rewarded').length || 0,
      };

      setUser({ ...user, ...profile });
      setReferralCode(referralData?.referral_code || user.id);
      setReferralStats(stats);
    } catch (error) {
      console.error('Profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/auth/register?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ✅ No header — BottomNav handles navigation */}

      <div className="max-w-md mx-auto p-4 space-y-4">

        {/* Avatar */}
        <div className="bg-white rounded-2xl shadow p-6 text-center">
          <div className="w-24 h-24 bg-gradient-to-r from-purple-600 to-purple-400 rounded-full flex items-center justify-center mx-auto text-white text-3xl font-bold">
            {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
          </div>
          <h2 className="text-xl font-bold mt-3">{user?.full_name || 'User'}</h2>
          <p className="text-gray-500 text-sm">@{user?.username || 'user'}</p>
          <span className="inline-block mt-1 px-3 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
            {user?.role || 'User'}
          </span>
        </div>

        {/* Info Cards */}
        <div className="bg-white rounded-2xl shadow divide-y divide-gray-100">
          <div className="flex items-center gap-3 p-4">
            <Mail className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Email</p>
              <p className="text-sm font-medium">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Joined</p>
              <p className="text-sm font-medium">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-PK', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                }) : 'Today'}
              </p>
            </div>
          </div>
        </div>

        {/* ✅ Referral Section */}
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-pink-600" />
            <h3 className="font-semibold text-gray-800">Referral Program</h3>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-gray-800">{referralStats.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-600">{referralStats.active}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-purple-600">{referralStats.rewarded}</p>
              <p className="text-xs text-gray-500">Rewarded</p>
            </div>
          </div>

          {/* Referral Link */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
            <input
              type="text"
              value={`${window?.location?.origin || ''}/auth/register?ref=${referralCode}`}
              readOnly
              className="flex-1 bg-transparent text-xs text-gray-600 outline-none truncate"
            />
            <button
              onClick={copyReferralLink}
              className="flex-shrink-0 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            🎁 Share your link and earn <strong className="text-purple-600">50 coins</strong> per referral!
          </p>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-red-100 transition"
        >
          <LogOut className="w-5 h-5" /> Logout
        </button>
      </div>
    </div>
  );
}