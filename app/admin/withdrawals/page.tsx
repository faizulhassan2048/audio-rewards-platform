'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Wallet, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Withdrawal {
  id: string;
  user_id: string;
  amount_coins: number;
  amount_pkr: number;
  method: string;
  account_number: string;
  account_name: string;
  status: string;
  created_at: string;
  user: {
    username: string;
    full_name: string;
    email: string;
  };
}

export default function AdminWithdrawalsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [filter, setFilter] = useState('all');

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

      await loadWithdrawals();
    } catch {
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadWithdrawals = async () => {
    try {
      let query = supabase
        .from('withdrawals')
        .select('*, user:users(username, full_name, email)')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setWithdrawals(data || []);
    } catch (error) {
      toast.error('Error loading withdrawals');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await supabase
        .from('withdrawals')
        .update({ status })
        .eq('id', id);

      toast.success(`Withdrawal ${status}`);
      await loadWithdrawals();
    } catch {
      toast.error('Update failed');
    }
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
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-purple-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Withdrawal Management</h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {['all', 'pending', 'approved', 'rejected', 'processing', 'paid'].map((status) => (
            <button
              key={status}
              onClick={() => { setFilter(status); loadWithdrawals(); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === status
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Withdrawals List */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          {withdrawals.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="w-12 h-12 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No withdrawal requests</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {withdrawals.map((w) => (
                <div key={w.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold">
                          {w.user?.full_name?.charAt(0) || w.user?.username?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {w.user?.full_name || w.user?.username || 'Unknown User'}
                          </p>
                          <p className="text-sm text-gray-500">{w.user?.email}</p>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Amount:</span>
                          <span className="font-semibold ml-1">{w.amount_coins} 🪙</span>
                        </div>
                        <div>
                          <span className="text-gray-500">PKR:</span>
                          <span className="font-semibold ml-1">Rs. {w.amount_pkr}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Method:</span>
                          <span className="font-semibold ml-1">{w.method}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Account:</span>
                          <span className="font-semibold ml-1">{w.account_number}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(w.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full capitalize ${
                        w.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        w.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                        w.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        w.status === 'paid' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {w.status}
                      </span>
                      {w.status === 'pending' && (
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => updateStatus(w.id, 'approved')}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => updateStatus(w.id, 'rejected')}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
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