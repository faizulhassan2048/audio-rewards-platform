'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { User, Mail, Calendar, LogOut, Copy, Check, Users, Gift, Settings, Edit, Lock } from 'lucide-react';
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

  // Settings states
  const [showSettings, setShowSettings] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updating, setUpdating] = useState(false);

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
      setNewName(profile?.full_name || '');
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

  // Update Name
  const handleUpdateName = async () => {
    if (!newName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: newName })
        .eq('id', user.id);

      if (error) throw error;

      setUser({ ...user, full_name: newName });
      toast.success('Name updated successfully!');
      setShowNameModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update name');
    } finally {
      setUpdating(false);
    }
  };

  // Update Password
  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setUpdating(true);
    try {
      // First, re-authenticate with current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        toast.error('Current password is incorrect');
        setUpdating(false);
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success('Password updated successfully!');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setUpdating(false);
    }
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

        {/* Settings Panel */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-800">Settings</span>
            </div>
            <span className="text-gray-400 text-sm">{showSettings ? '▲' : '▼'}</span>
          </button>

          {showSettings && (
            <div className="border-t border-gray-100 divide-y divide-gray-100">
              {/* Change Name */}
              <button
                onClick={() => setShowNameModal(true)}
                className="w-full flex items-center gap-3 p-4 hover:bg-purple-50 transition"
              >
                <Edit className="w-5 h-5 text-purple-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-800">Change Name</p>
                  <p className="text-xs text-gray-400">Update your full name</p>
                </div>
              </button>

              {/* Reset Password */}
              <button
                onClick={() => setShowPasswordModal(true)}
                className="w-full flex items-center gap-3 p-4 hover:bg-purple-50 transition"
              >
                <Lock className="w-5 h-5 text-purple-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-800">Reset Password</p>
                  <p className="text-xs text-gray-400">Update your password</p>
                </div>
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-4 hover:bg-red-50 transition"
              >
                <LogOut className="w-5 h-5 text-red-600" />
                <div className="text-left">
                  <p className="font-medium text-red-600">Logout</p>
                  <p className="text-xs text-gray-400">Sign out of your account</p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Referral Section */}
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
      </div>

      {/* Change Name Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h3 className="text-xl font-bold mb-2">Change Name</h3>
            <p className="text-sm text-gray-500 mb-4">Update your full name</p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter full name"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowNameModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateName}
                disabled={updating}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition disabled:opacity-50"
              >
                {updating ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h3 className="text-xl font-bold mb-2">Reset Password</h3>
            <p className="text-sm text-gray-500 mb-4">Update your account password</p>
            <div className="space-y-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePassword}
                disabled={updating}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition disabled:opacity-50"
              >
                {updating ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}