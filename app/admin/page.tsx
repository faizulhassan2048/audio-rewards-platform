'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Users, Headphones, Wallet, TrendingUp, LogOut } from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalAudios: number;
  totalEarnings: number;
  pendingWithdrawals: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!userData || userData.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      setUser(user);
      await loadStats();
    } catch {
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    const [usersRes, audiosRes, walletsRes, withdrawalsRes] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('audios').select('id', { count: 'exact', head: true }),
      supabase.from('wallets').select('total_earned'),
      supabase.from('withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    setStats({
      totalUsers: usersRes.count || 0,
      totalAudios: audiosRes.count || 0,
      totalEarnings: walletsRes.data?.reduce((sum, w) => sum + (w.total_earned || 0), 0) || 0,
      pendingWithdrawals: withdrawalsRes.count || 0,
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-purple-600">Admin Panel</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-red-600 border rounded-lg hover:border-red-200"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-500">Total Users</p>
                <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center gap-3">
              <Headphones className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-500">Total Audios</p>
                <p className="text-2xl font-bold">{stats?.totalAudios || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-500">Total Earnings</p>
                <p className="text-2xl font-bold">{stats?.totalEarnings || 0} 🪙</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center gap-3">
              <Wallet className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-sm text-gray-500">Pending Withdrawals</p>
                <p className="text-2xl font-bold">{stats?.pendingWithdrawals || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Menu */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin/users" className="bg-white rounded-2xl shadow p-6 hover:shadow-lg transition text-center">
            <Users className="w-12 h-12 text-purple-600 mx-auto mb-2" />
            <h3 className="font-semibold">User Management</h3>
            <p className="text-sm text-gray-500">View, block, delete users</p>
          </Link>
          <Link href="/admin/audio" className="bg-white rounded-2xl shadow p-6 hover:shadow-lg transition text-center">
            <Headphones className="w-12 h-12 text-blue-600 mx-auto mb-2" />
            <h3 className="font-semibold">Audio Management</h3>
            <p className="text-sm text-gray-500">Upload, edit, delete audios</p>
          </Link>
          <Link href="/admin/withdrawals" className="bg-white rounded-2xl shadow p-6 hover:shadow-lg transition text-center">
            <Wallet className="w-12 h-12 text-orange-600 mx-auto mb-2" />
            <h3 className="font-semibold">Withdrawals</h3>
            <p className="text-sm text-gray-500">Approve or reject requests</p>
          </Link>
        </div>
      </div>
    </div>
  );
}