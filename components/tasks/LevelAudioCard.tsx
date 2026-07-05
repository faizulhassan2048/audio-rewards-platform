'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Loader2, Check } from 'lucide-react'

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
  onFinished: (audioId: string) => void
}

export default function LevelAudioCard({ audio, index, total, onFinished }: LevelAudioCardProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [loading, setLoading] = useState(true)
  const [playUrl, setPlayUrl] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastValidTime = useRef(0)
  const skipAttempts = useRef(0)
  const finishedRef = useRef(false)

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

    ;(async () => {
      try {
        const res = await fetch('/api/audio/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioId: audio.id }),
        })
        const data = await res.json()
        if (cancelled) return
        setPlayUrl(data?.session?.audio_url || audio.audio_url)
      } catch {
        if (!cancelled) setPlayUrl(audio.audio_url)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [audio.id, audio.audio_url])

  const togglePlay = async () => {
    if (!audioRef.current || loading || finished) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }
    try {
      await audioRef.current.play()
      setIsPlaying(true)
    } catch {
      // user can just press play again
    }
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

    if (pct >= 95 && !finishedRef.current) {
      finishedRef.current = true
      setFinished(true)
      setIsPlaying(false)
      audioRef.current.pause()
      onFinished(audio.id)
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
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-[#6C63FF] bg-[#6C63FF]/10 px-2.5 py-1 rounded-full">
          Audio {index + 1}/{total}
        </span>
        <span className="text-xs text-gray-400">{formatTime(audio.duration_seconds)}</span>
      </div>

      <h3 className="text-base sm:text-lg font-bold text-gray-800 truncate mb-4" title={audio.title}>
        {audio.title}
      </h3>

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

      <div className="flex justify-center">
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
      </div>
    </div>
  )
}