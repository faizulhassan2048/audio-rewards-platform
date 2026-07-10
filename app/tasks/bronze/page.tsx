'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import LevelProgress from '@/components/tasks/LevelProgress'
import LevelAudioCard from '@/components/tasks/LevelAudioCard'
import LevelCompleteModal from '@/components/tasks/LevelCompleteModal'
import AdModal from '@/components/audio/AdModal'
import AdBanner from '@/components/ads/AdBanner'

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
  const pendingClaimRef = useRef(false)
  const adSessionStartedRef = useRef(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks/level/status', { cache: 'no-store' })
      if (res.status === 401) {
        toast.error('Please login to continue')
        setLoading(false)
        return
      }
      const statusData: StatusResponse = await res.json()
      setStatus(statusData)

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
      const res = await fetch('/api/tasks/level/claim', { method: 'POST', cache: 'no-store' })
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

  // sessionToken now travels with the audio_id so the server can verify
  // real playback (see complete/route.ts) instead of trusting the id alone.
  const handleAudioFinished = async (audioId: string, sessionToken: string | null) => {
    try {
      const res = await fetch('/api/tasks/level/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_id: audioId, session_token: sessionToken }),
        cache: 'no-store',
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'AD_REQUIRED' && data.milestone) {
          setAdMilestone(data.milestone)
          setShowAd(true)
          return
        }
        // "Audio out of order or already completed" / "Audio already completed"
        // means the client's local view of progress has drifted from the
        // server (e.g. a duplicate request after a refresh). Retrying with
        // the SAME audioId would just fail again — instead, resync from the
        // server so the correct current audio is shown.
        if (
          data.error === 'Audio out of order or already completed' ||
          data.error === 'Audio already completed'
        ) {
          toast.error('Progress had drifted — reloading your current audio…')
          await fetchStatus()
          return
        }
        toast.error(data.error || 'Could not save progress', {
          action: { label: 'Retry', onClick: () => handleAudioFinished(audioId, sessionToken) },
        })
        return
      }

      const finished = data.completed_audios
      toast.success(
        data.level_complete
          ? `All ${finished} audios complete!`
          : `Audio ${finished}/15 done!`
      )

      if (data.show_ad) {
        setAdMilestone(data.milestone)
        setShowAd(true)
      } else if (data.level_complete) {
        await fetchStatus()
      } else if (data.next_audio) {
        setStatus(prev => prev ? {
          ...prev,
          completed_audios: finished,
          current_audio: data.next_audio,
        } : prev)
      } else {
        // Shouldn't normally happen, but if the server didn't hand back a
        // next audio for some reason, don't leave the UI stuck silently —
        // tell the user why and resync.
        toast.error('Could not load the next audio. Refreshing your progress…', {
          action: { label: 'Retry', onClick: () => fetchStatus() },
        })
        await fetchStatus()
      }
    } catch {
      toast.error('Network error while saving progress', {
        action: { label: 'Retry', onClick: () => handleAudioFinished(audioId, sessionToken) },
      })
    }
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
        toast.success('15 coins locked in! Finish all 15 audios to add them to your wallet.')
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

        {!status?.locked && !status?.current_audio && !status?.level_complete && !showAd && (
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
          adDurationSeconds={30}
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