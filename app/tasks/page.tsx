'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, ChevronRight } from 'lucide-react'
import LevelProgress from '@/components/tasks/LevelProgress'
import AdWrapper from '@/components/ads/AdWrapper'
import { createClient } from '@/lib/supabase/client'

interface StatusResponse {
  locked: boolean
  locked_until?: string
  level_complete?: boolean
  reward_claimed?: boolean
  completed_audios: number
  total_audios: number
}

const TASKS_CACHE_KEY = 'tasks_cache'

export default function TasksHubPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [firstWithdrawalDone, setFirstWithdrawalDone] = useState(false)
  const [countdown, setCountdown] = useState('')

  const fetchStatus = useCallback(async (isBackgroundRefresh = false) => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const [statusRes, withdrawalRes] = await Promise.all([
        fetch('/api/tasks/level/status'),
        fetch(`/api/withdrawals?user_id=${user.id}`),
      ])
      const statusData: StatusResponse = await statusRes.json()
      const withdrawalData = await withdrawalRes.json()
      setStatus(statusData)
      const paid = (withdrawalData.withdrawals || []).some((w: any) => w.status === 'paid')
      setFirstWithdrawalDone(paid)

      try {
        sessionStorage.setItem(TASKS_CACHE_KEY, JSON.stringify({
          status: statusData,
          firstWithdrawalDone: paid,
        }))
      } catch { /* non-fatal */ }
    } catch (err) {
      if (!isBackgroundRefresh) console.error('fetchStatus error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let hadCache = false
    try {
      const cached = sessionStorage.getItem(TASKS_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        setStatus(parsed.status)
        setFirstWithdrawalDone(parsed.firstWithdrawalDone)
        setLoading(false)
        hadCache = true
      }
    } catch { /* corrupt/missing cache — fall back to normal spinner load */ }

    fetchStatus(hadCache)
  }, [fetchStatus])

  useEffect(() => {
    if (!status?.locked || !status.locked_until) return
    const tick = () => {
      const diff = new Date(status.locked_until!).getTime() - Date.now()
      if (diff <= 0) { setCountdown(''); fetchStatus(); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setCountdown(`${h}h ${m}m`)
    }
    tick()
    const interval = setInterval(tick, 60000)
    return () => clearInterval(interval)
  }, [status?.locked, status?.locked_until, fetchStatus])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6C63FF]" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white px-4 py-6 pb-32">
      <div className="max-w-md mx-auto space-y-4">

        {/* ✅ TOP AD */}
        <AdWrapper type="top" />

        {/* Header */}
        <div className="text-center py-2">
          <h1 className="text-2xl font-bold text-gray-800">🏆 Your Tasks</h1>
          <p className="text-sm text-gray-500">Complete levels to earn rewards</p>
        </div>

        {/* Bronze Level */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 hover:shadow-xl transition-shadow">
          <button
            type="button"
            onClick={() => { if (!status?.locked) router.push('/tasks/bronze') }}
            className="w-full text-left flex items-center justify-between disabled:cursor-default"
            disabled={!!status?.locked}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🥉</span>
                <h3 className="font-bold text-gray-800">Bronze Level</h3>
                {!status?.locked && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    Active
                  </span>
                )}
                {status?.locked && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    Locked
                  </span>
                )}
              </div>
              <LevelProgress
                levelName=""
                completed={status?.completed_audios || 0}
                total={status?.total_audios || 15}
              />
            </div>
            {!status?.locked && (
              <ChevronRight className="w-5 h-5 text-gray-400 ml-3 shrink-0" />
            )}
          </button>
          
          {status?.locked && status.locked_until && (
            <div className="mt-3 pt-3 border-t border-amber-100 text-center">
              <p className="text-sm text-gray-500">
                ⏳ Bronze complete — next round in{' '}
                <span className="font-bold text-[#6C63FF]">{countdown || '...'}</span>
              </p>
            </div>
          )}
        </div>

        {/* Silver & Gold Levels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SilverLevel unlocked={firstWithdrawalDone} />
          <GoldLevel unlocked={firstWithdrawalDone} />
        </div>

        {/* ✅ BOTTOM AD */}
        <AdWrapper type="bottom" />
      </div>
    </div>
  )
}

function SilverLevel({ unlocked }: { unlocked: boolean }) {
  if (unlocked) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 hover:shadow-xl transition-shadow">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-3xl mb-2">
            🥈
          </div>
          <h4 className="font-bold text-gray-800 text-sm">Silver Level</h4>
          <p className="text-[10px] text-green-600 font-semibold mt-0.5">✅ Unlocked</p>
          <div className="w-full mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-gray-300 to-gray-400 rounded-full" style={{ width: '0%' }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">Coming Soon</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-dashed border-gray-300 p-4 relative overflow-hidden">
      <div className="absolute inset-0 backdrop-blur-[1px] bg-white/30" />
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-white/70 flex items-center justify-center text-3xl mb-2 opacity-40">
          🥈
        </div>
        <h4 className="font-bold text-gray-400 text-sm">Silver Level</h4>
        <div className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center mt-2">
          <Lock className="w-4 h-4 text-gray-400" />
        </div>
        <p className="text-[10px] text-gray-400 mt-2 max-w-[120px]">
          Complete withdrawal to unlock
        </p>
      </div>
    </div>
  )
}

function GoldLevel({ unlocked }: { unlocked: boolean }) {
  if (unlocked) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-yellow-200 p-4 hover:shadow-xl transition-shadow">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-100 to-yellow-200 flex items-center justify-center text-3xl mb-2">
            🥇
          </div>
          <h4 className="font-bold text-gray-800 text-sm">Gold Level</h4>
          <p className="text-[10px] text-green-600 font-semibold mt-0.5">✅ Unlocked</p>
          <div className="w-full mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-yellow-300 to-yellow-500 rounded-full" style={{ width: '0%' }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">Coming Soon</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl border-2 border-dashed border-yellow-300 p-4 relative overflow-hidden">
      <div className="absolute inset-0 backdrop-blur-[1px] bg-white/30" />
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-white/70 flex items-center justify-center text-3xl mb-2 opacity-40">
          🥇
        </div>
        <h4 className="font-bold text-gray-400 text-sm">Gold Level</h4>
        <div className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center mt-2">
          <Lock className="w-4 h-4 text-gray-400" />
        </div>
        <p className="text-[10px] text-gray-400 mt-2 max-w-[120px]">
          Complete withdrawal to unlock
        </p>
      </div>
    </div>
  )
}





