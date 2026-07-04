'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, Wallet, TrendingUp, ArrowDownCircle,
  Headphones, CheckSquare, Users, Gift, Filter
} from 'lucide-react'
import BackButton from '@/components/ui/BackButton'

interface WalletData {
  coin_balance: number
  total_earned: number
  total_withdrawn: number
}

interface Transaction {
  id: string
  type: string
  coins_amount: number
  description: string
  created_at: string
}

type FilterType = 'all' | 'earned' | 'withdrawn'

const TX_META: Record<string, { icon: string; label: string; color: string }> = {
  earn_audio:    { icon: '🎧', label: 'Audio Reward',    color: 'text-green-600' },
  earn_checkin:  { icon: '📅', label: 'Daily Check-in',  color: 'text-blue-600'  },
  earn_task:     { icon: '✅', label: 'Task Reward',     color: 'text-purple-600'},
  earn_referral: { icon: '👥', label: 'Referral Bonus',  color: 'text-pink-600'  },
  earn_bonus:    { icon: '🎁', label: 'Bonus',           color: 'text-yellow-600'},
  admin_add:     { icon: '⭐', label: 'Admin Bonus',     color: 'text-orange-600'},
  withdrawal:    { icon: '💸', label: 'Withdrawal',      color: 'text-red-600'   },
  admin_deduct:  { icon: '➖', label: 'Deduction',       color: 'text-red-600'   },
}

export default function WalletPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => { loadWallet() }, [])

  // Realtime wallet updates
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('wallet-page')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'wallets', filter: `user_id=eq.${userId}`,
      }, (payload: any) => {
        setWallet({
          coin_balance: payload.new.coin_balance,
          total_earned: payload.new.total_earned,
          total_withdrawn: payload.new.total_withdrawn,
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const loadWallet = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: w } = await supabase
        .from('wallets')
        .select('coin_balance, total_earned, total_withdrawn')
        .eq('user_id', user.id)
        .single()

      const { data: txs } = await supabase
        .from('transactions')
        .select('id, type, coins_amount, description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      setWallet(w)
      setTransactions(txs || [])
    } catch {
      toast.error('Error loading wallet')
    } finally {
      setLoading(false)
    }
  }

  const filteredTxs = transactions.filter((tx) => {
    if (filter === 'earned')    return tx.type !== 'withdrawal' && tx.type !== 'admin_deduct'
    if (filter === 'withdrawn') return tx.type === 'withdrawal' || tx.type === 'admin_deduct'
    return true
  })

  const isDebit = (type: string) => type === 'withdrawal' || type === 'admin_deduct'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white pb-10">

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <BackButton />
          <h1 className="font-bold text-gray-900">My Wallet</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-purple-200">
          <p className="text-purple-200 text-sm font-medium uppercase tracking-wider mb-1">Available Balance</p>
          <p className="text-5xl font-bold mb-1">
            {Number(wallet?.coin_balance || 0).toLocaleString()}
          </p>
          <p className="text-purple-200 text-sm">coins</p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="bg-white/15 rounded-xl p-3">
              <p className="text-purple-100 text-xs mb-0.5">Total Earned</p>
              <p className="text-white font-bold text-lg">
                {Number(wallet?.total_earned || 0).toLocaleString()} 🪙
              </p>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <p className="text-purple-100 text-xs mb-0.5">Total Withdrawn</p>
              <p className="text-white font-bold text-lg">
                {Number(wallet?.total_withdrawn || 0).toLocaleString()} 🪙
              </p>
            </div>
          </div>

          <Link
            href="/withdrawal"
            className="mt-4 w-full flex items-center justify-center gap-2 bg-white text-purple-700 font-semibold py-3 rounded-xl hover:bg-purple-50 transition-colors"
          >
            <ArrowDownCircle className="w-4 h-4" />
            Withdraw Coins
          </Link>
        </div>

        {/* Earn More */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Earn More Coins</p>
          <div className="grid grid-cols-3 gap-2">
            <Link href="/audio" className="flex flex-col items-center gap-1.5 p-3 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors">
              <Headphones className="w-6 h-6 text-purple-600" />
              <span className="text-xs font-medium text-purple-700">Listen</span>
            </Link>
            <Link href="/dashboard" className="flex flex-col items-center gap-1.5 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
              <CheckSquare className="w-6 h-6 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Check-in</span>
            </Link>
            <Link href="/referral" className="flex flex-col items-center gap-1.5 p-3 bg-pink-50 rounded-xl hover:bg-pink-100 transition-colors">
              <Users className="w-6 h-6 text-pink-600" />
              <span className="text-xs font-medium text-pink-700">Refer</span>
            </Link>
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow">
          {/* Filter tabs */}
          <div className="flex border-b border-gray-100">
            {(['all', 'earned', 'withdrawn'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                  filter === f
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="divide-y divide-gray-50">
            {filteredTxs.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No transactions yet</p>
              </div>
            ) : (
              filteredTxs.map((tx) => {
                const meta = TX_META[tx.type] || { icon: '🪙', label: tx.type, color: 'text-gray-600' }
                return (
                  <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{meta.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-700 line-clamp-1">
                          {tx.description || meta.label}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(tx.created_at).toLocaleDateString('en-PK', {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${meta.color}`}>
                      {isDebit(tx.type) ? '-' : '+'}{Number(tx.coins_amount).toLocaleString()} 🪙
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>
    </div>
  )
}