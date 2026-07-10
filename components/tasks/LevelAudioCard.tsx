'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Loader2, Check, Volume2, VolumeX } from 'lucide-react'

interface LevelAudio {
  id: string
  title: string
  audio_url: string
  thumbnail_url?: string | null
  duration_seconds: number
}

interface LevelAudioCardProps {
  audio: LevelAudio
  index: number
  total: number
  // sessionToken is passed back up so the server route can verify this
  // specific playback actually happened, instead of trusting audio_id alone.
  onFinished: (audioId: string, sessionToken: string | null) => void
}

export default function LevelAudioCard({ audio, index, total, onFinished }: LevelAudioCardProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [loading, setLoading] = useState(true)
  const [playUrl, setPlayUrl] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)

  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [volumeWarning, setVolumeWarning] = useState(false)
  const [tabWarning, setTabWarning] = useState(false)
  const [pausedBySystem, setPausedBySystem] = useState(false)
  const [pauseReason, setPauseReason] = useState('')

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastValidTime = useRef(0)
  const skipAttempts = useRef(0)
  const finishedRef = useRef(false)
  const sessionTokenRef = useRef<string | null>(null)
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null)
  const volumeCheckInterval = useRef<NodeJS.Timeout | null>(null)
  const muteTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFinished(false)
    finishedRef.current = false
    lastValidTime.current = 0
    skipAttempts.current = 0
    setProgress(0)
    setCurrentTime(0)
    setIsPlaying(false)
    setPlayUrl(null)
    sessionTokenRef.current = null
    setTabWarning(false)
    setVolumeWarning(false)
    setPausedBySystem(false)
    setPauseReason('')

    ;(async () => {
      try {
        const res = await fetch('/api/audio/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioId: audio.id }),
        })
        const data = await res.json()
        if (cancelled) return
        sessionTokenRef.current = data?.session?.token || null
        setPlayUrl(data?.session?.audio_url || audio.audio_url)
      } catch {
        if (!cancelled) setPlayUrl(audio.audio_url)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [audio.id, audio.audio_url])

  // ── Tab switch / window blur — pause and force the user to resume manually.
  // This is what stops "leave the tab open in background while it silently finishes".
  useEffect(() => {
    const handleVisibility = () => {
      if (finishedRef.current) return
      if (document.visibilityState === 'hidden') {
        audioRef.current?.pause()
        setIsPlaying(false)
        setTabWarning(true)
        setPausedBySystem(true)
        setPauseReason('tab_hidden')
      } else {
        setTabWarning(false)
      }
    }
    const handleBlur = () => {
      if (finishedRef.current) return
      if (audioRef.current && isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
        setTabWarning(true)
        setPausedBySystem(true)
        setPauseReason('window_blur')
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleBlur)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
    }
  }, [isPlaying])

  // ── Minimum volume enforcement (15%) — same rule as the standalone player.
  useEffect(() => {
    volumeCheckInterval.current = setInterval(() => {
      if (!audioRef.current || finishedRef.current) return
      const isBelowMin = audioRef.current.volume < 0.15 || audioRef.current.muted
      if (isBelowMin) {
        setVolumeWarning(true)
        if (!muteTimer.current) {
          muteTimer.current = setTimeout(() => {
            if (audioRef.current) {
              const stillLow = audioRef.current.volume < 0.15 || audioRef.current.muted
              if (stillLow && !finishedRef.current) {
                audioRef.current.pause()
                setIsPlaying(false)
                setPausedBySystem(true)
                setPauseReason('volume_too_low')
              }
            }
            muteTimer.current = null
          }, 8000)
        }
      } else {
        setVolumeWarning(false)
        if (muteTimer.current) { clearTimeout(muteTimer.current); muteTimer.current = null }
      }
    }, 3000)
    return () => {
      if (volumeCheckInterval.current) { clearInterval(volumeCheckInterval.current); volumeCheckInterval.current = null }
      if (muteTimer.current) { clearTimeout(muteTimer.current); muteTimer.current = null }
    }
  }, [])

  // ── Heartbeat — this is what lets the server verify real listening time
  // (via audio_sessions.progress_percent / created_at), instead of trusting
  // a bare "audio_id" sent from the client with no proof of playback.
  const sendHeartbeat = useCallback(async () => {
    const token = sessionTokenRef.current
    if (!token || !audioRef.current) return
    const progressPercent = (audioRef.current.currentTime / audio.duration_seconds) * 100
    try {
      await fetch('/api/audio/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: token, progressPercent, clientTimestamp: Date.now() }),
      })
    } catch { /* non-fatal */ }
  }, [audio.duration_seconds])

  useEffect(() => {
    if (isPlaying) {
      heartbeatInterval.current = setInterval(sendHeartbeat, 8000)
    } else if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current)
      heartbeatInterval.current = null
    }
    return () => {
      if (heartbeatInterval.current) { clearInterval(heartbeatInterval.current); heartbeatInterval.current = null }
    }
  }, [isPlaying, sendHeartbeat])

  const togglePlay = async () => {
    if (!audioRef.current || loading || finished) return

    if (pausedBySystem) {
      if (pauseReason === 'volume_too_low') {
        alert('Please increase volume above 15% to continue earning.')
        return
      }
      setPausedBySystem(false)
      setPauseReason('')
      setTabWarning(false)
    }

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }
    if (audioRef.current.volume < 0.15) {
      audioRef.current.volume = 0.15
      setVolume(0.15)
      setIsMuted(false)
      audioRef.current.muted = false
    }
    try {
      await audioRef.current.play()
      setIsPlaying(true)
    } catch {
      // user can just press play again
    }
  }

  const toggleMute = () => {
    if (!audioRef.current) return
    const newMuted = !isMuted
    setIsMuted(newMuted)
    audioRef.current.muted = newMuted
    setVolumeWarning(newMuted)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (audioRef.current) { audioRef.current.volume = val; audioRef.current.muted = false; setIsMuted(false) }
    if (val >= 0.15) { setVolumeWarning(false); setPausedBySystem(false); if (pauseReason === 'volume_too_low') setPauseReason('') }
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current || finishedRef.current) return
    const current = audioRef.current.currentTime

    if (current > lastValidTime.current + 1.5) {
      audioRef.current.currentTime = lastValidTime.current
      skipAttempts.current += 1
      if (skipAttempts.current >= 3) {
        audioRef.current.pause()
        setIsPlaying(false)
        alert('Too many skip attempts. Please restart.')
        skipAttempts.current = 0
      }
      return
    }

    lastValidTime.current = current
    setCurrentTime(current)
    const pct = (current / audio.duration_seconds) * 100
    setProgress(pct)
  }

  // Only the real "ended" event marks completion — no early 90/95% threshold.
  const handleEnded = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    setFinished(true)
    setIsPlaying(false)
    setProgress(100)
    if (heartbeatInterval.current) { clearInterval(heartbeatInterval.current); heartbeatInterval.current = null }
    // Final heartbeat so the server sees 100% progress before /complete is called.
    if (sessionTokenRef.current) {
      fetch('/api/audio/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: sessionTokenRef.current, progressPercent: 100, clientTimestamp: Date.now() }),
      }).catch(() => {}).finally(() => {
        onFinished(audio.id, sessionTokenRef.current)
      })
    } else {
      onFinished(audio.id, null)
    }
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100">
      <audio
        ref={audioRef}
        src={playUrl || undefined}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />

      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-[#6C63FF] bg-[#6C63FF]/10 px-2.5 py-1 rounded-full">
          Audio {index + 1}/{total}
        </span>
        <span className="text-xs text-gray-400">{formatTime(audio.duration_seconds)}</span>
      </div>

      <h3 className="text-base sm:text-lg font-bold text-gray-800 truncate mb-3" title={audio.title}>
        {audio.title}
      </h3>

      {tabWarning && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium">
          Audio paused, you left this tab. Press Play to continue earning.
        </div>
      )}
      {volumeWarning && (
        <div className="mb-3 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-xs font-medium">
          Volume below 15 percent. Please increase to continue earning.
        </div>
      )}

      <div className="w-full h-2 bg-gray-200 rounded-full mb-2">
        <div
          className="h-full bg-[#6C63FF] rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 mb-5">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(audio.duration_seconds)}</span>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          onClick={togglePlay}
          disabled={loading || finished}
          className="w-14 h-14 flex items-center justify-center bg-[#6C63FF] text-white rounded-full hover:bg-[#5a52e0] transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={24} className="animate-spin" />
          ) : finished ? (
            <Check size={26} />
          ) : isPlaying ? (
            <Pause size={26} />
          ) : (
            <Play size={26} />
          )}
        </button>

        <button onClick={toggleMute} className="text-gray-500 hover:text-[#6C63FF] flex-shrink-0">
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <input
          type="range" min="0" max="1" step="0.01"
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="w-24 h-1 bg-gray-300 rounded-full appearance-none cursor-pointer accent-[#6C63FF]"
        />
        <span className={`text-xs flex-shrink-0 ${volume < 0.15 || isMuted ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
          {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
        </span>
      </div>

      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <ul className="text-xs text-amber-700 space-y-0.5">
          <li className={tabWarning ? 'text-red-600 font-bold' : ''}>
            {tabWarning ? 'x' : 'ok'} Listen without switching tabs
          </li>
          <li className={volumeWarning ? 'text-red-600 font-bold' : ''}>
            {volumeWarning ? 'x' : 'ok'} Keep volume above 15%
          </li>
          <li className={skipAttempts.current >= 1 ? 'text-red-600 font-bold' : ''}>
            {skipAttempts.current >= 1 ? 'x' : 'ok'} Do not skip or fast-forward
          </li>
        </ul>
      </div>
    </div>
  )
}
