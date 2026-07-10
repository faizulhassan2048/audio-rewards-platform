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
  ad_required?: boolean
  milestone?: number | null
  level_name: string
  completed_audios: number
  total_audios: number
  current_audio?: CurrentAudio | null
}

const REWARD_COINS = 45 // final wallet credit — keep this in sync with claim/route.ts
const AD_MILESTONE_DISPLAY_COINS = REWARD_COINS // what the "Claim" button shows at every milestone

export default function TasksPage() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [showAd, setShowAd] = useState(false)
  const [adMilestone, setAdMilestone] = useState<number | null>(null)
  const [adClaiming, setAdClaiming] = useState(false)
  const [adError, setAdError] = useState<string | null>(null)
  const [showComplete, setShowComplete] = useState(false)
  const [countdown, setCountdown] = useState('')
  const [firstWithdrawalDone, setFirstWithdrawalDone] = useState(false)
  const [bronzeExpanded, setBronzeExpanded] = useState(true)
  const pendingClaimRef = useRef(false)
  const adSessionStartedRef = useRef(false)

  const fetchStatus = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast.error('Please login to continue')
        setLoading(false)
        return
      }

      const [statusRes, withdrawalRes] = await Promise.all([
        fetch('/api/tasks/level/status'),
        fetch(`/api/withdrawals?user_id=${user.id}`),
      ])

      const statusData: StatusResponse = await statusRes.json()
      const withdrawalData = await withdrawalRes.json()

      setStatus(statusData)

      const paid = (withdrawalData.withdrawals || []).some(
        (w: any) => w.status === 'paid'
      )
      setFirstWithdrawalDone(paid)

      // Server says an ad gate is open — this fires on first load AND on every
      // refresh/tab-reopen, so the gate can never be skipped by reloading.
      if (statusData.ad_required && statusData.milestone) {
        setAdMilestone(statusData.milestone)
        setShowAd(true)
        setAdError(null)
      } else {
        setShowAd(false)
        setAdMilestone(null)
      }

      if (statusData.level_complete && !statusData.reward_claimed && !pendingClaimRef.current) {
        pendingClaimRef.current = true
        await claimReward()
      }
    } catch (err) {
      console.error('fetchStatus error:', err)
      toast.error('Could not load task progress', {
        action: { label: 'Retry', onClick: () => fetchStatus() },
      })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Final wallet credit — unchanged mechanics, just surfaced with a retry toast.
  const claimReward = async () => {
    try {
      const res = await fetch('/api/tasks/level/claim', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not claim your reward', {
          action: { label: 'Retry', onClick: () => claimReward() },
        })
        return
      }
      if (data.success) setShowComplete(true)
    } catch {
      toast.error('Network error while claiming reward', {
        action: { label: 'Retry', onClick: () => claimReward() },
      })
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

      if (!res.ok) {
        // e.g. AD_REQUIRED (409) if user somehow tried to advance with a gate
        // still open, or 409 out-of-order — either way, re-sync from server
        // instead of trusting local state.
        if (data.error === 'AD_REQUIRED' && data.milestone) {
          setAdMilestone(data.milestone)
          setShowAd(true)
          return
        }
        toast.error(data.error || 'Could not save progress', {
          action: { label: 'Retry', onClick: () => handleAudioFinished(audioId) },
        })
        return
      }

      const finished = data.completed_audios
      toast.success(
        data.level_complete
          ? `🎉 All ${finished} audios complete!`
          : `✅ Audio ${finished}/15 done!`
      )

      if (data.show_ad) {
        setAdMilestone(data.milestone)
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
      toast.error('Network error while saving progress', {
        action: { label: 'Retry', onClick: () => handleAudioFinished(audioId) },
      })
    }
  }

  // Start the server-verified ad session as soon as the modal is actually shown.
  useEffect(() => {
    if (showAd && !adSessionStartedRef.current) {
      adSessionStartedRef.current = true
      fetch('/api/tasks/level/ads/start', { method: 'POST' }).catch(() => {
        // non-fatal — /ads/verify will just fail with a clear error if this never ran
      })
    }
    if (!showAd) {
      adSessionStartedRef.current = false
    }
  }, [showAd])

  // Called when the user taps "Claim X Coins" inside the ad modal.
  // Milestone 5/10 → unlocks the gate only, wallet untouched.
  // Milestone 15   → unlocks the gate AND triggers the real wallet credit.
  const handleAdClaim = async () => {
    setAdClaiming(true)
    setAdError(null)
    try {
      const res = await fetch('/api/tasks/level/ads/verify', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setAdError(data.error || 'Could not verify ad. Please try again.')
        return
      }

      setShowAd(false)
      setAdMilestone(null)

      if (data.isFinalMilestone) {
        // Level's 15/15 ad just got verified — now actually credit the wallet.
        await claimReward()
      } else {
        toast.success(
          `✅ 15 coins locked in! Finish all 15 audios to add them to your wallet.`
        )
      }
      await fetchStatus()
    } catch {
      setAdError('Network error — your progress is safe, just tap Retry.')
    } finally {
      setAdClaiming(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6C63FF]" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white px-4 py-6 pb-32">
      <div className="max-w-md mx-auto space-y-3">

        <AdBanner position="top" />

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

              {!status?.locked && !showAd && status?.current_audio && (
                <LevelAudioCard
                  audio={status.current_audio}
                  index={status.completed_audios}
                  total={status.total_audios}
                  onFinished={handleAudioFinished}
                />
              )}

              {!status?.locked && !status?.current_audio && !status?.level_complete && !showAd && (
                <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                  New audios coming soon. Check back shortly! 🎧
                </div>
              )}
            </div>
          )}
        </div>

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

      {showAd && (
        <AdModal
          onFinished={handleAdClaim}
          rewardCoins={AD_MILESTONE_DISPLAY_COINS}
          claiming={adClaiming}
          errorMessage={adError}
        />
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
          <Lock className="w-5 h-5 text-gray-900" />
        </div>
        <p className="text-xs font-semibold text-gray-600 text-center px-6">
          {lockReason}
        </p>
      </div>
    </div>
  )
}
