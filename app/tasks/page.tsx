'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Lock, ChevronDown, ChevronUp } from 'lucide-react'
import LevelProgress from '@/components/tasks/LevelProgress'
import LevelAudioCard from '@/components/tasks/LevelAudioCard'
import LevelCompleteModal from '@/components/tasks/LevelCompleteModal'
import AdModal from '@/components/audio/AdModal'
import AdBanner from '@/components/ads/AdBanner'
import { createClient } from '@/lib/supabase/client'

interface CurrentAudio {
  id: string
  title: string
  audio_url: string
  thumbnail_url?: string | null
  duration_seconds: number
}

interface StatusResponse {
  locked: boolean
  locked_until?: string
  level_complete?: boolean
  reward_claimed?: boolean
  level_name: string
  completed_audios: number
  total_audios: number
  current_audio?: CurrentAudio | null
}

const REWARD_COINS = 45

export default function TasksPage() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [showAd, setShowAd] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [countdown, setCountdown] = useState('')
  const [firstWithdrawalDone, setFirstWithdrawalDone] = useState(false)
  const [bronzeExpanded, setBronzeExpanded] = useState(true) // ✅ expand/collapse state for Bronze card
  const pendingClaimRef = useRef(false)

  const fetchStatus = useCallback(async () => {
    try {
      // ✅ FIX: user_id properly fetch karo
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast.error('Please login to continue')
        setLoading(false)
        return
      }

      const [statusRes, withdrawalRes] = await Promise.all([
        fetch('/api/tasks/level/status'),
        fetch(`/api/withdrawal?user_id=${user.id}`), // ✅ FIX: correct API path + user_id
      ])

      const statusData = await statusRes.json()
      const withdrawalData = await withdrawalRes.json()

      setStatus(statusData)

      // First paid withdrawal check
      const paid = (withdrawalData.withdrawals || []).some(
        (w: any) => w.status === 'paid'
      )
      setFirstWithdrawalDone(paid)

      if (statusData.level_complete && !statusData.reward_claimed && !pendingClaimRef.current) {
        pendingClaimRef.current = true
        await claimReward()
      }
    } catch (err) {
      console.error('fetchStatus error:', err)
      toast.error('Could not load task progress')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  // Countdown timer
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

  const claimReward = async () => {
    try {
      const res = await fetch('/api/tasks/level/claim', { method: 'POST' })
      const data = await res.json()
      if (data.success) setShowComplete(true)
    } catch {
      toast.error('Could not claim reward')
    } finally {
      pendingClaimRef.current = false
    }
  }

  const handleAudioFinished = async (audioId: string) => {
    try {
      const res = await fetch('/api/tasks/level/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_id: audioId }),
      })
      const data = await res.json()
      if (!data.success) { toast.error(data.error || 'Could not save progress'); return }

      const finished = data.completed_audios
      toast.success(
        data.level_complete
          ? `🎉 All ${finished} audios complete! Reward coming...`
          : `✅ Audio ${finished}/15 done!`
      )

      if (data.show_ad) {
        setShowAd(true)
      } else if (data.level_complete) {
        await fetchStatus()
      } else {
        setStatus(prev => prev ? {
          ...prev,
          completed_audios: finished,
          current_audio: data.next_audio,
        } : prev)
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleAdFinished = async () => {
    setShowAd(false)
    await fetchStatus()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6C63FF]" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white px-4 py-6 pb-24">
      <div className="max-w-md mx-auto space-y-3">

        {/* TOP BANNER */}
        <AdBanner position="top" />

        {/* BRONZE LEVEL — clickable card, expands to reveal audio content inside */}
        <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
          <button
            type="button"
            onClick={() => setBronzeExpanded(prev => !prev)}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between px-1 pt-1">
              <div className="flex-1">
                <LevelProgress
                  levelName="Bronze"
                  completed={status?.completed_audios || 0}
                  total={status?.total_audios || 15}
                />
              </div>
              {bronzeExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400 mr-3 shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400 mr-3 shrink-0" />
              )}
            </div>
          </button>

          {bronzeExpanded && (
            <div className="px-3 pb-3">
              {status?.locked && (
                <div className="bg-white rounded-2xl border border-amber-100 p-6 text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-50 flex items-center justify-center text-2xl">
                    🥉
                  </div>
                  <p className="font-semibold text-gray-800 mb-1">🔄 Bronze Level complete!</p>
                  <p className="text-sm text-gray-500">
                    Next round in <span className="font-bold text-[#6C63FF]">{countdown || '...'}</span>
                  </p>
                </div>
              )}

              {!status?.locked && status?.current_audio && (
                <LevelAudioCard
                  audio={status.current_audio}
                  index={status.completed_audios}
                  total={status.total_audios}
                  onFinished={handleAudioFinished}
                />
              )}

              {!status?.locked && !status?.current_audio && !status?.level_complete && (
                <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                  New audios coming soon. Check back shortly! 🎧
                </div>
              )}
            </div>
          )}
        </div>

        {/* SILVER LEVEL */}
        <LockedLevel
          icon="🥈"
          name="Silver Level"
          unlocked={firstWithdrawalDone}
          lockReason="Complete your first withdrawal to unlock Silver"
          bg="bg-gray-50"
          border="border-gray-200"
        />

        {/* GOLD LEVEL */}
        <LockedLevel
          icon="🥇"
          name="Gold Level"
          unlocked={firstWithdrawalDone}
          lockReason="Complete your first withdrawal to unlock Gold"
          bg="bg-yellow-50"
          border="border-yellow-200"
        />

        {/* BOTTOM BANNER */}
        <AdBanner position="bottom" />

      </div>

      {showAd && (
        <AdModal onFinished={handleAdFinished} rewardCoins={0} />
      )}

      {showComplete && (
        <LevelCompleteModal
          rewardCoins={REWARD_COINS}
          onClose={() => { setShowComplete(false); fetchStatus() }}
        />
      )}
    </div>
  )
}

// Locked Level Card
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
            <p className="text-xs text-green-600 font-semibold">🔓 Unlocked — Coming Soon</p>
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
          <Lock className="w-5 h-5 text-gray-500" />
        </div>
        <p className="text-xs font-semibold text-gray-600 text-center px-6">
          {lockReason}
        </p>
      </div>
    </div>
  )
}
