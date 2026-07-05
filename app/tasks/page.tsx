'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/server';
import AudioPlayer from '@/components/audio/AudioPlayer';

interface Audio {
  id: string;
  title: string;
  audio_url: string;
  duration: number;
  reward_coins: number;
}

// This is a client component
function TasksList({ initialAudios }: { initialAudios: Audio[] }) {
  const [selectedAudio, setSelectedAudio] = useState<Audio | null>(null);

  if (initialAudios.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl">
        <p className="text-gray-500">No tasks available right now</p>
        <p className="text-sm text-gray-400 mt-1">Check back later for new audio</p>
      </div>
    );
  }

  if (selectedAudio) {
    return (
      <div>
        <button
          onClick={() => setSelectedAudio(null)}
          className="mb-4 text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
        >
          ← Back to tasks
        </button>
        <AudioPlayer
          audioId={selectedAudio.id}
          audioUrl={selectedAudio.audio_url}
          title={selectedAudio.title}
          duration={selectedAudio.duration}
          rewardCoins={selectedAudio.reward_coins}
          onComplete={() => {
            // Refresh or handle completion
            setSelectedAudio(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {initialAudios.map((audio) => (
        <div key={audio.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-800 truncate">{audio.title}</h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-500">
                  ⏱️ {formatDuration(audio.duration)}
                </span>
                <span className="text-xs font-medium text-purple-600">
                  🪙 {audio.reward_coins} coins
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedAudio(audio)}
              className="px-4 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-full hover:bg-purple-700 transition-colors whitespace-nowrap"
            >
              Listen
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Server component
export default async function TasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Tasks</h1>
        <p className="text-gray-500">Please login to view tasks</p>
      </div>
    );
  }

  const { data: audios } = await supabase
    .from('audios')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-md mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold mb-6">🎧 Available Tasks</h1>
      <TasksList initialAudios={audios || []} />
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}