'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import AudioPlayer from '@/components/audio/AudioPlayer';

export default function AudioPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const [audio, setAudio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadAudio();
  }, []);

  const loadAudio = async () => {
    const { data } = await supabase
      .from('audios')
      .select('*')
      .eq('id', params.id)
      .single();
    
    setAudio(data);
    setLoading(false);
  };

  const handleComplete = () => {
    alert('🎉 Audio completed! Reward will be credited.');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading audio...</p>
        </div>
      </div>
    );
  }

  if (!audio) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Audio not found</h1>
        <Link href="/audio" className="text-purple-600 hover:underline mt-4 inline-block">
          ← Back to audio list
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8">
      {/* Back Button */}
      <Link
        href="/audio"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-purple-600 transition-colors mb-6"
      >
        <ArrowLeft size={20} />
        Back to audio list
      </Link>

      {/* Audio Player */}
      <AudioPlayer
        audioId={audio.id}        // ✅ YEH LINE ADD KI
        audioUrl={audio.audio_url}
        title={audio.title}
        duration={audio.duration_seconds}
        rewardCoins={audio.reward_coins}
        onComplete={handleComplete}
      />

      {/* Info Box */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-bold text-yellow-800">📌 How to Earn:</h3>
        <ul className="list-disc ml-4 mt-2 text-sm text-yellow-700 space-y-1">
          <li>Listen without switching tabs</li>
          <li>Keep volume above 15%</li>
          <li>Do not skip or fast-forward</li>
          <li>Complete 100% of the audio</li>
        </ul>
      </div>
    </div>
  );
}