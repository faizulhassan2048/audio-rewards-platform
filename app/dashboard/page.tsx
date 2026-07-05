'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'
import {
  Headphones, Wallet, LogOut, TrendingUp, Gift,
  Clock, CheckCircle, Circle, ArrowRight, Star,
  Zap, Flame, Calendar, Trophy, Home, Users, User
} from 'lucide-react'

interface DashboardData {
  user_id: string
  username: string
  full_name: string
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

interface StreakData {
  claimed: boolean
  current_streak: number
  longest_streak: number
  total_checkins: number
  next_reward: number
}

export default function DashboardPage() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const abortControllerRef = useRef<AbortController | null>(null)

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [streak, setStreak] = useState<StreakData | null>(null)
  const [checkinLoading, setCheckinLoading] = useState(false)
  const [showCoinAnim, setShowCoinAnim] = useState(false)
  
  // Stats
  const [referralCount, setReferralCount] = useState(0)
  const [earnings7d, setEarnings7d] = useState(0)

  useEffect(() => {
    loadDashboard()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Realtime wallet
  useEffect(() => {
    if (!data?.user_id) return
    const channel = supabase
      .channel('dashboard-wallet')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'wallets', filter: `user_id=eq.${data.user_id}`,
      }, (payload: any) => {
        setData((prev) => prev ? {
          ...prev,
          coin_balance: payload.new.coin_balance,
          total_earned: payload.new.total_earned,
        } : prev)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [data?.user_id])

  const loadDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      abortControllerRef.current = new AbortController()
      const timeoutId = setTimeout(() => abortControllerRef.current?.abort(), 8000)

      const [profileRes, walletRes, txRes, streakRes] = await Promise.all([
        supabase.from('users').select('username, full_name').eq('id', user.id).single(),
        supabase.from('wallets').select('coin_balance, total_earned, total_withdrawn').eq('user_id', user.id).single(),
        supabase.from('transactions')
          .select('id, type, coins_amount, description, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        fetch(`/api/checkin?user_id=${user.id}`, { 
          signal: abortControllerRef.current.signal,
        }).then(r => r.json()).catch(() => null),
      ])

      clearTimeout(timeoutId)

      setData({
        user_id: user.id,
        username: profileRes.data?.username || '',
        full_name: profileRes.data?.full_name || '',
        coin_balance: walletRes.data?.coin_balance || 0,
        total_earned: walletRes.data?.total_earned || 0,
        total_withdrawn: walletRes.data?.total_withdrawn || 0,
      })
      setTransactions(txRes.data || [])
      setStreak(streakRes)

      // Load referral count
      const { count: referrals } = await supabase
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_id', user.id)
        .eq('status', 'rewarded')

      setReferralCount(referrals || 0)

      // Load 7 days earnings
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { data: earningsData } = await supabase
        .from('transactions')
        .select('coins_amount')
        .eq('user_id', user.id)
        .gte('created_at', sevenDaysAgo.toISOString())
        .neq('type', 'withdrawal')

      const totalEarnings = earningsData?.reduce((sum, tx) => sum + tx.coins_amount, 0) || 0
      setEarnings7d(totalEarnings)

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request timeout')
      } else {
        toast.error('Error loading dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCheckin = async () => {
    if (!data?.user_id || streak?.claimed || checkinLoading) return
    setCheckinLoading(true)
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: data.user_id }),
      })
      const result = await res.json()

      if (result.success) {
        setStreak((prev) => prev ? {
          ...prev,
          claimed: true,
          current_streak: result.current_streak,
          longest_streak: result.longest_streak,
        } : prev)
        setData((prev) => prev ? {
          ...prev,
          coin_balance: result.new_balance,
        } : prev)

        setShowCoinAnim(true)
        setTimeout(() => setShowCoinAnim(false), 2000)

        if (result.is_milestone) {
          toast.success(`🏆 Milestone! Day ${result.current_streak} streak! +${result.coins_earned} coins!`, { duration: 5000 })
        } else {
          toast.success(`✅ Check-in done! +${result.coins_earned} coins earned!`)
        }
        // Reload stats after check-in
        await loadDashboard()
      } else {
        toast.error(result.error || 'Check-in failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setCheckinLoading(false)
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const txIcon = (type: string) => ({
    earn_audio: '🎧', earn_task: '✅', earn_referral: '👥',
    earn_checkin: '📅', withdrawal: '💸', admin_add: '🎁',
  }[type] || '🪙')

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
    </div>
  )

  // ✅ Navigation items with Tasks → /tasks
  const navItems = [
    { href: '/dashboard', icon: Home, label: 'Home' },
    { href: '/tasks', icon: Headphones, label: 'Tasks' },  // ✅ /audio → /tasks
    { href: '/referral', icon: Users, label: 'Referrals' },
    { href: '/profile', icon: User, label: 'Profile' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white pb-28">

      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Image 
              src="/logo.png" 
              alt="YouTask" 
              width={32} 
              height={32}
              className="rounded-lg"
              style={{ width: 'auto', height: 'auto' }}
              priority
            />
            <div>
              <p className="font-semibold text-gray-900 leading-tight">{data?.full_name || data?.username}</p>
              <p className="text-xs text-gray-400">@{data?.username}</p>
            </div>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg hover:border-red-200 transition-all"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">

        {/* Balance */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-400 text-white rounded-2xl p-5 shadow-lg shadow-purple-200 relative overflow-hidden">
          {showCoinAnim && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-4xl animate-bounce">🪙</span>
            </div>
          )}
          <p className="text-purple-100 text-xs uppercase tracking-wider">Balance</p>
          <p className="text-4xl font-bold mt-1">{Number(data?.coin_balance || 0).toLocaleString()}</p>
          <p className="text-purple-200 text-xs mt-0.5">coins</p>
        </div>

        {/* Earned / Wallet / Refer & Earn */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow border border-gray-100">
            <p className="text-gray-400 text-xs uppercase tracking-wider">Earned</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{Number(data?.total_earned || 0).toLocaleString()}</p>
            <p className="text-green-500 text-xs mt-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> All time</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow border border-gray-100">
            <Link href="/wallet" className="block h-full">
              <p className="text-gray-400 text-xs uppercase tracking-wider">Wallet</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{Number(data?.total_withdrawn || 0).toLocaleString()}</p>
              <p className="text-blue-500 text-xs mt-1 flex items-center gap-1"><Wallet className="w-3 h-3" /> Withdrawn</p>
            </Link>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow border border-gray-100">
            <Link href="/referral" className="block h-full">
              <p className="text-gray-400 text-xs uppercase tracking-wider">Refer</p>
              <p className="text-2xl font-bold text-gray-800 mt-1 flex items-center gap-1">
                <Users className="w-5 h-5 text-pink-500" />
              </p>
              <p className="text-pink-500 text-xs mt-1 flex items-center gap-1"><Gift className="w-3 h-3" /> Refer & Earn</p>
            </Link>
          </div>
        </div>

        {/* Stats Card - Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow border border-gray-100">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              <p className="text-2xl font-bold">{referralCount}</p>
            </div>
            <p className="text-xs text-gray-500">Active Referrals</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow border border-gray-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <p className="text-2xl font-bold">{earnings7d}</p>
            </div>
            <p className="text-xs text-gray-500">Earned (7 days)</p>
          </div>
        </div>

        {/* Daily Check-in Card */}
        <div className={`rounded-2xl p-5 shadow border transition-all ${
          streak?.claimed
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
            : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Flame className={`w-5 h-5 ${streak?.current_streak ? 'text-orange-500' : 'text-gray-400'}`} />
                <h3 className="font-bold text-gray-800">Daily Check-in</h3>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-2xl font-bold text-orange-500">{streak?.current_streak || 0}</span>
                  <span className="text-sm text-gray-500">day streak</span>
                </div>
                {streak?.longest_streak ? (
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Trophy className="w-3 h-3" /> Best: {streak.longest_streak}
                  </div>
                ) : null}
              </div>

              <div className="flex gap-2 mb-3">
                {[
                  { day: 7, reward: 50, icon: '🌟' },
                  { day: 14, reward: 100, icon: '💎' },
                  { day: 30, reward: 500, icon: '👑' },
                ].map((m) => (
                  <div key={m.day} className={`flex-1 rounded-lg p-1.5 text-center text-xs border ${
                    (streak?.current_streak || 0) >= m.day
                      ? 'bg-green-100 border-green-300 text-green-700'
                      : 'bg-white/70 border-gray-200 text-gray-400'
                  }`}>
                    <div>{m.icon}</div>
                    <div className="font-semibold">Day {m.day}</div>
                    <div>+{m.reward}</div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500">
                {streak?.claimed
                  ? '✅ Claimed today! Come back tomorrow.'
                  : `Claim now → +${streak?.next_reward || 10} coins`}
              </p>
            </div>

            <button
              onClick={handleCheckin}
              disabled={streak?.claimed || checkinLoading}
              className={`flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-2xl font-semibold text-sm transition-all ${
                streak?.claimed
                  ? 'bg-green-100 text-green-600 border-2 border-green-300 cursor-default'
                  : checkinLoading
                  ? 'bg-purple-100 text-purple-400 cursor-wait'
                  : 'bg-gradient-to-br from-purple-600 to-purple-400 text-white shadow-lg shadow-purple-200 hover:scale-105 active:scale-95'
              }`}
            >
              {checkinLoading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : streak?.claimed ? (
                <>
                  <CheckCircle className="w-7 h-7 mb-1" />
                  <span className="text-xs">Done</span>
                </>
              ) : (
                <>
                  <Calendar className="w-7 h-7 mb-1" />
                  <span className="text-xs">Check In</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ✅ Quick Actions — Listen button → /tasks */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { href: '/tasks', icon: <Headphones className="w-6 h-6 text-purple-500" />, label: 'Listen', sub: 'Earn coins' },
            { href: '/wallet', icon: <Wallet className="w-6 h-6 text-green-500" />, label: 'Wallet', sub: 'Balance' },
            { href: '/referral', icon: <Gift className="w-6 h-6 text-pink-500" />, label: 'Refer', sub: 'Earn more' },
            { href: '/leaderboard', icon: <Star className="w-6 h-6 text-yellow-500" />, label: 'Rank', sub: 'Top earners' },
          ].map((item) => (
            <Link key={item.href} href={item.href}
              className="bg-white rounded-2xl p-3 shadow border border-gray-100 hover:border-purple-300 hover:shadow-md transition-all text-center group">
              <div className="flex justify-center mb-1.5 group-hover:scale-110 transition-transform">{item.icon}</div>
              <p className="text-xs font-semibold text-gray-700">{item.label}</p>
              <p className="text-xs text-gray-400 hidden sm:block">{item.sub}</p>
            </Link>
          ))}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" /> Recent Activity
            </h3>
            <Link href="/wallet" className="text-xs text-purple-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No activity yet — start earning!</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{txIcon(tx.type)}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-700 line-clamp-1">{tx.description}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(tx.created_at).toLocaleDateString('en-PK', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${
                    tx.type === 'withdrawal' ? 'text-red-500' : 'text-green-600'
                  }`}>
                    {tx.type === 'withdrawal' ? '-' : '+'}{tx.coins_amount} 🪙
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Bottom Navigation with Active State */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
        <div className="flex justify-around items-center h-16 max-w-4xl mx-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <div className={`flex flex-col items-center py-1 transition-colors ${
                  isActive ? 'text-purple-600' : 'text-gray-400 hover:text-purple-600'
                }`}>
                  <item.icon className={`w-6 h-6 ${isActive ? 'text-purple-600' : 'text-gray-400'}`} />
                  <span className={`text-xs font-medium ${isActive ? 'text-purple-600' : 'text-gray-400'}`}>
                    {item.label}
                  </span>
                  {isActive && (
                    <div className="w-1 h-1 bg-purple-600 rounded-full mt-0.5" />
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </nav>

    </div>
  )
}