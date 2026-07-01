'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Audio {
  id: string
  title: string
  duration_seconds: number
  reward_coins: number
  category: string
}

export default function AudioPage() {
  const [audios, setAudios] = useState<Audio[]>([])
  const supabase = createClient()

  useEffect(() => {
    loadAudios()
  }, [])

  const loadAudios = async () => {
    const { data } = await supabase
      .from('audios')
      .select('id, title, duration_seconds, reward_coins, category')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    
    if (data) setAudios(data)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Earn Coins — Listen to Audio</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {audios.map((audio) => (
          <Link key={audio.id} href={`/audio/${audio.id}`}>
            <div className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition">
              <h3 className="font-semibold truncate">{audio.title}</h3>
              <p className="text-sm text-gray-500">{audio.duration_seconds}s</p>
              <p className="text-purple-600 font-bold">🪙 {audio.reward_coins} coins</p>
              <span className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                Available
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}