'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Headphones, CheckCircle, Clock, ArrowLeft } from 'lucide-react'

interface Audio {
  id: string
  title: string
  duration_seconds: number
  reward_coins: number
  category: string
}

interface AudioWithStatus extends Audio {
  is_listened_today: boolean
}

export default function AudioPage() {
  const [audios, setAudios] = useState<AudioWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadAudios()
  }, [])

  const loadAudios = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      // Audios fetch karo
      const { data: audioList } = await supabase
        .from('audios')
        .select('id, title, duration_seconds, reward_coins, category')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      // Aaj ke completed sessions
      const today = new Date().toISOString().split('T')[0]
      const { data: todaySessions } = await supabase
        .from('audio_sessions')
        .select('audio_id')
        .eq('user_id', user.id)
        .eq('reward_granted', true)
        .gte('created_at', `${today}T00:00:00`)

      const listenedIds = new Set((todaySessions || []).map((s: any) => s.audio_id))

      setAudios(
        (audioList || []).map((a: Audio) => ({
          ...a,
          is_listened_today: listenedIds.has(a.id),
        }))
      )
    } catch (e) {
      console.error('Error loading audios:', e)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  // ✅ Progress counter
  const completedCount = audios.filter(a => a.is_listened_today).length
  const totalCount = audios.length
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white pb-10">

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-purple-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-gray-900">Listen & Earn</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-5">

        {/* ✅ Progress Counter */}
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-5 mb-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm text-gray-500">Today's Progress</p>
              {/* ✅ X/10 format */}
              <p className="text-2xl font-bold text-gray-900">
                <span className="text-purple-600">{completedCount}</span>
                <span className="text-gray-400">/{totalCount}</span>
                <span className="text-sm font-normal text-gray-500 ml-2">audios completed</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Coins Available</p>
              <p className="text-xl font-bold text-purple-600">
                🪙 {audios
                  .filter(a => !a.is_listened_today)
                  .reduce((sum, a) => sum + a.reward_coins, 0)}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-purple-600 to-purple-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {completedCount === totalCount && totalCount > 0 && (
            <p className="text-center text-sm text-green-600 font-semibold mt-2">
              🎉 All audios completed for today!
            </p>
          )}
        </div>

        {/* Audio Grid */}
        {audios.length === 0 ? (
          <div className="text-center py-16">
            <Headphones className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">No audio available yet.</p>
            <p className="text-sm text-gray-300">Admin will add audio soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {audios.map((audio) => (
              <Link key={audio.id} href={`/audio/${audio.id}`}>
                <div className={`rounded-2xl border shadow-sm p-4 hover:shadow-md transition-all cursor-pointer ${
                  audio.is_listened_today
                    ? 'bg-green-50 border-green-200 opacity-80'
                    : 'bg-white border-gray-100 hover:border-purple-300'
                }`}>

                  {/* Status badge */}
                  <div className="flex items-center justify-between mb-3">
                    {audio.is_listened_today ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" /> Completed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                        <Headphones className="w-3 h-3" /> Available
                      </span>
                    )}
                    {audio.category && (
                      <span className="text-xs text-gray-400">{audio.category}</span>
                    )}
                  </div>

                  {/* Title — long title fix */}
                  <h3 className="font-semibold text-gray-800 truncate overflow-hidden whitespace-nowrap mb-1" title={audio.title}>
                    {audio.title}
                  </h3>

                  {/* Duration + Reward */}
                  <div className="flex items-center justify-between mt-2">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {formatTime(audio.duration_seconds)}
                    </span>
                    <span className={`text-sm font-bold ${
                      audio.is_listened_today ? 'text-green-600' : 'text-purple-600'
                    }`}>
                      🪙 {audio.reward_coins}
                    </span>
                  </div>

                  {/* Listen button */}
                  {!audio.is_listened_today && (
                    <div className="mt-3 w-full bg-purple-600 text-white text-xs font-semibold text-center py-2 rounded-xl hover:bg-purple-700 transition-colors">
                      Listen & Earn
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
