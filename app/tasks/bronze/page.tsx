'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import LevelProgress from '@/components/tasks/LevelProgress'
import LevelAudioCard from '@/components/tasks/LevelAudioCard'
import LevelCompleteModal from '@/components/tasks/LevelCompleteModal'
import AdModal from '@/components/audio/AdModal'
import AdBanner from '@/components/ads/AdBanner'

// Real Monetag Direct Link — opens in a new tab at milestones 5/10.
const MONETAG_DIRECT_LINK_URL = 'https://omg10.com/4/11270543'

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

const REWARD_COINS = 45
const BONUS_COINS = 10 // keep in sync with BONUS_COINS in bonus/claim/route.ts
const AD_MILESTONE_DISPLAY_COINS = REWARD_COINS

export default function BronzeLevelPage() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [showAd, setShowAd] = useState(false)
  const [adMilestone, setAdMilestone] = useState<number | null>(null)
  const [adClaiming, setAdClaiming] = useState(false)
  const [adError, setAdError] = useState<string | null>(null)
  const [showComplete, setShowComplete] = useState(false)
  const [countdown, setCountdown] = useState('')

  const [pendingNextAudio, setPendingNextAudio] = useState<CurrentAudio | null>(null)
  const [awaitingNext, setAwaitingNext] = useState(false)
  // Set when the audio that was just completed was a smartlink milestone
  // (5 or 10). Purely informational — doesn't block anything.
  const [pendingSmartlinkMilestone, setPendingSmartlinkMilestone] = useState<number | null>(null)

  const pendingClaimRef = useRef(false)
  const adSessionStartedRef = useRef(false)
  const submittingAudioRef = useRef<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks/level/status')
      if (res.status === 401) {
        toast.error('Please login to continue')
        setLoading(false)
        return
      }
      const statusData: StatusResponse = await res.json()
      setStatus(statusData)
      setPendingNextAudio(null)
      setAwaitingNext(false)
      setPendingSmartlinkMilestone(null)

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

  const handleAudioFinished = async (audioId: string, sessionToken: string | null) => {
    if (submittingAudioRef.current === audioId) return
    submittingAudioRef.current = audioId
    try {
      const res = await fetch('/api/tasks/level/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_id: audioId, session_token: sessionToken }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'AD_REQUIRED' && data.milestone) {
          setAdMilestone(data.milestone)
          setShowAd(true)
          return
        }
        toast.error(data.error || 'Could not save progress', {
          action: { label: 'Retry', onClick: () => fetchStatus() },
        })
        await fetchStatus()
        return
      }

      const finished = data.completed_audios
      toast.success(
        data.level_complete
          ? `All ${finished} audios complete!`
          : `Audio ${finished}/15 done!`
      )

      if (data.show_ad) {
        // Only fires at the 15th/final audio now — full mandatory ad.
        setAdMilestone(data.milestone)
        setShowAd(true)
      } else if (data.level_complete) {
        await fetchStatus()
      } else if (data.next_audio) {
        setStatus(prev => prev ? { ...prev, completed_audios: finished } : prev)
        setPendingNextAudio(data.next_audio)
        // 5 or 10 → smartlink opens when the user taps "Next Audio" below.
        setPendingSmartlinkMilestone(data.smartlink_milestone || null)
        setAwaitingNext(true)
      } else {
        toast.error('Could not load the next audio. Please refresh.', {
          action: { label: 'Refresh', onClick: () => fetchStatus() },
        })
      }
    } catch {
      toast.error('Network error while saving progress', {
        action: { label: 'Retry', onClick: () => handleAudioFinished(audioId, sessionToken) },
      })
    } finally {
      submittingAudioRef.current = null
    }
  }

  const handleNextAudio = () => {
    // Smartlink milestone (5/10): open the Monetag Direct Link in a new tab
    // first — this is the extra ad revenue placement. It never blocks
    // continuing; the user moves to the next audio the same click
    // regardless of the new tab.
    if (pendingSmartlinkMilestone) {
      window.open(MONETAG_DIRECT_LINK_URL, '_blank')
    }
    if (!pendingNextAudio) {
      fetchStatus()
      return
    }
    setStatus(prev => prev ? { ...prev, current_audio: pendingNextAudio } : prev)
    setPendingNextAudio(null)
    setAwaitingNext(false)
    setPendingSmartlinkMilestone(null)
  }

  useEffect(() => {
    if (showAd && !adSessionStartedRef.current) {
      adSessionStartedRef.current = true
      fetch('/api/tasks/level/ads/start', { method: 'POST' }).catch(() => {})
    }
    if (!showAd) {
      adSessionStartedRef.current = false
    }
  }, [showAd])

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
        await claimReward()
      } else {
        toast.success('Coins locked in! Finish all 15 audios to add them to your wallet.')
      }
      await fetchStatus()
    } catch {
      setAdError('Network error, your progress is safe, just tap Retry.')
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

        <Link href="/tasks" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#6C63FF]">
          <ArrowLeft className="w-4 h-4" /> Back to Levels
        </Link>

        <AdBanner position="top" />

        <LevelProgress
          levelName="Bronze"
          completed={status?.completed_audios || 0}
          total={status?.total_audios || 15}
        />

        {status?.locked && (
          <div className="bg-white rounded-2xl border border-amber-100 p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-50 flex items-center justify-center text-2xl">
              🥉
            </div>
            <p className="font-semibold text-gray-800 mb-1">Bronze Level complete!</p>
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

        {!status?.locked && !showAd && awaitingNext && (
          <div className="bg-white rounded-2xl shadow border border-green-100 p-5 text-center">
            <p className="text-sm font-semibold text-green-700 mb-3">
              Audio complete! Ready for the next one?
            </p>
            <button
              onClick={handleNextAudio}
              className="w-full py-3 rounded-xl bg-[#6C63FF] text-white font-semibold hover:bg-[#5a52e0] transition-colors flex items-center justify-center gap-2"
            >
              Next Audio <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {!status?.locked && !status?.current_audio && !status?.level_complete && !showAd && !awaitingNext && (
          <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 bg-white">
            New audios coming soon. Check back shortly!
          </div>
        )}

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
          bonusCoins={BONUS_COINS}
          onClose={() => { setShowComplete(false); fetchStatus() }}
        />
      )}
    </div>
  )
}