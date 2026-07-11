'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, ChevronRight } from 'lucide-react'
import LevelProgress from '@/components/tasks/LevelProgress'
import AdBanner from '@/components/ads/AdBanner'
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

      // Cache a snapshot so the NEXT time this page mounts, we can paint
      // instantly from cache instead of showing a blank spinner while
      // network requests are in flight.
      try {
        sessionStorage.setItem(TASKS_CACHE_KEY, JSON.stringify({
          status: statusData,
          firstWithdrawalDone: paid,
        }))
      } catch { /* sessionStorage can fail in private mode — non-fatal */ }
    } catch (err) {
      if (!isBackgroundRefresh) console.error('fetchStatus error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Hydrate instantly from the cached snapshot (if any) so this page
    // paints immediately instead of showing a blank spinner on every
    // visit — the fresh network request below still runs in the
    // background and silently replaces this data when it arrives.
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
      <div className="max-w-md mx-auto space-y-3">

        <AdBanner position="top" />

        <button
          type="button"
          onClick={() => { if (!status?.locked) router.push('/tasks/bronze') }}
          className="w-full text-left bg-white rounded-2xl shadow border border-gray-100 p-1 flex items-center justify-between hover:shadow-md transition-shadow disabled:cursor-default"
          disabled={!!status?.locked}
        >
          <div className="flex-1">
            <LevelProgress
              levelName="Bronze"
              completed={status?.completed_audios || 0}
              total={status?.total_audios || 15}
            />
          </div>
          {!status?.locked && <ChevronRight className="w-5 h-5 text-gray-400 mr-3 shrink-0" />}
        </button>

        {status?.locked && (
          <div className="bg-white rounded-2xl border border-amber-100 p-4 text-center -mt-1">
            <p className="text-sm text-gray-500">
              Bronze complete — next round in <span className="font-bold text-[#6C63FF]">{countdown || '...'}</span>
            </p>
          </div>
        )}

        <LockedLevel
          icon="🥈"
          name="Silver Level"
          unlocked={firstWithdrawalDone}
          lockReason="Complete your first withdrawal to unlock Silver"
          bg="bg-gray-50"
          border="border-gray-200"
        />

        <LockedLevel
          icon="🥇"
          name="Gold Level"
          unlocked={firstWithdrawalDone}
          lockReason="Complete your first withdrawal to unlock Gold"
          bg="bg-yellow-50"
          border="border-yellow-200"
        />

        <AdBanner position="bottom" />
      </div>
    </div>
  )
}

function LockedLevel({
  icon, name, unlocked, lockReason, bg, border
}: {
  icon: string
  name: string
  unlocked: boolean
  lockReason: string
  bg: string
  border: string
}) {
  if (unlocked) {
    return (
      <div className={`bg-white rounded-2xl shadow border ${border} p-5`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="font-bold text-gray-800">{name}</h3>
            <p className="text-xs text-green-600 font-semibold">Unlocked — Coming Soon</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${bg} rounded-2xl border ${border} p-5 relative overflow-hidden`}>
      <div className="absolute inset-0 backdrop-blur-[1px] bg-white/40 rounded-2xl z-10" />
      <div className="opacity-30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <h3 className="font-bold text-gray-800">{name}</h3>
          </div>
          <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full">0/15 Audios</span>
        </div>
        <div className="w-full h-2.5 bg-gray-200 rounded-full" />
      </div>
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2">
        <div className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center">
          <Lock className="w-5 h-5 text-gray-900" />
        </div>
        <p className="text-xs font-semibold text-gray-600 text-center px-6">
          {lockReason}
        </p>
      </div>
    </div>
  )
}