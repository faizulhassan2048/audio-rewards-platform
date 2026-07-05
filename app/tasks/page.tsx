'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'
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
  const pendingClaimRef = useRef(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks/level/status')
      const data = await res.json()
      console.log('Status response:', data)
      setStatus(data)

      if (data.level_complete && !data.reward_claimed && !pendingClaimRef.current) {
        pendingClaimRef.current = true
        await claimReward()
      }
    } catch (error) {
      console.error('Error fetching status:', error)
      toast.error('Could not load task progress')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Countdown while locked
  useEffect(() => {
    if (!status?.locked || !status.locked_until) return
    const tick = () => {
      const diff = new Date(status.locked_until!).getTime() - Date.now()
      if (diff <= 0) {
        setCountdown('')
        fetchStatus()
        return
      }
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      setCountdown(`${hours}h ${mins}m`)
    }
    tick()
    const interval = setInterval(tick, 60000)
    return () => clearInterval(interval)
  }, [status?.locked, status?.locked_until, fetchStatus])

  const claimReward = async () => {
    try {
      const res = await fetch('/api/tasks/level/claim', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setShowComplete(true)
      }
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
      if (!data.success) {
        toast.error(data.error || 'Could not save progress')
        return
      }

      const finishedCount = data.completed_audios
      toast.success(
        data.level_complete
          ? `✅ Audio ${finishedCount} completed!`
          : `✅ Audio ${finishedCount} completed! Audio ${finishedCount + 1} ready.`
      )

      if (data.show_ad) {
        setShowAd(true)
      } else if (data.level_complete) {
        await fetchStatus()
      } else {
        setStatus((prev) => prev ? {
          ...prev,
          completed_audios: finishedCount,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6C63FF]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white px-4 py-6 pb-24">
      <div className="max-w-md mx-auto space-y-3">

        {/* ✅ TOP BANNER AD */}
        <AdBanner position="top" />

        <LevelProgress
          levelName="Bronze"
          completed={status?.completed_audios || 0}
          total={status?.total_audios || 9}
        />

        {status?.locked && (
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#6C63FF]/10 flex items-center justify-center">
              <Lock className="w-6 h-6 text-[#6C63FF]" />
            </div>
            <p className="font-semibold text-gray-800 mb-1">🔄 Bronze Level completed!</p>
            <p className="text-sm text-gray-500">Come back in {countdown || '...'}</p>
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
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-6 text-center text-sm text-gray-500">
            No audios available for this level right now. Please check back later.
          </div>
        )}

        {/* ✅ BOTTOM BANNER AD */}
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