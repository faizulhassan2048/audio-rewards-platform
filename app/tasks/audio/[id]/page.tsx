'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Headphones, Volume2, AlertCircle, Play, Pause, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import AdBanner from '@/components/ads/AdBanner';

interface AudioData {
  id: string;
  title: string;
  audio_url: string;
  thumbnail_url?: string | null;
  duration_seconds: number;
  index: number;
  total: number;
}

export default function AudioPlayerPage() {
  const router = useRouter();
  const params = useParams();
  const audioId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [audio, setAudio] = useState<AudioData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioComplete, setAudioComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  // ✅ Unique refresh key for this audio page
  const refreshKey = `audio-${audioId}`;

  // Fetch audio data and create session - PARALLEL
  useEffect(() => {
    const fetchAudio = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const index = parseInt(params.get('index') || '1');
        const total = parseInt(params.get('total') || '15');

        // ✅ Parallel fetch - faster loading
        const [sessionRes, audioRes] = await Promise.all([
          fetch('/api/audio/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioId }),
          }),
          fetch(`/api/tasks/audio/${audioId}`),
        ]);

        // Session token
        let token = null;
        let audioUrl = null;
        
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          token = sessionData.session?.token || null;
          audioUrl = sessionData.session?.audio_url || null;
          setSessionToken(token);
        }

        // Audio data
        if (audioRes.ok) {
          const data = await audioRes.json();
          setAudio({
            ...data,
            index: index,
            total: total
          });
        } else if (audioUrl) {
          // Fallback
          setAudio({
            id: audioId,
            title: `Audio ${index}`,
            audio_url: audioUrl,
            duration_seconds: 0,
            index: index,
            total: total
          });
        }
      } catch (error) {
        console.error('Error fetching audio:', error);
        toast.error('Could not load audio');
      } finally {
        setLoading(false);
      }
    };

    fetchAudio();
  }, [audioId, router]);

  // Preload audio when URL changes
  useEffect(() => {
    if (audio && audioRef.current) {
      // ✅ Preload audio
      audioRef.current.load();
      setAudioLoaded(true);
    }
  }, [audio]);

  // Send heartbeat
  const sendHeartbeat = async () => {
    if (!sessionToken || !audioRef.current) return;
    const progressPercent = (audioRef.current.currentTime / audioRef.current.duration) * 100;
    try {
      await fetch('/api/audio/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionToken, 
          progressPercent, 
          clientTimestamp: Date.now() 
        }),
      });
    } catch { /* non-fatal */ }
  };

  // Start/stop heartbeat
  useEffect(() => {
    if (isPlaying && sessionToken) {
      heartbeatInterval.current = setInterval(sendHeartbeat, 8000);
    } else if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
    return () => {
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    };
  }, [isPlaying, sessionToken]);

  // Handle audio complete
  const handleAudioComplete = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setAudioComplete(true);
    
    // Send final heartbeat
    if (sessionToken) {
      await fetch('/api/audio/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionToken, 
          progressPercent: 100, 
          clientTimestamp: Date.now() 
        }),
      }).catch(() => {});
    }
    
    try {
      const res = await fetch('/api/tasks/level/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          audio_id: audioId,
          session_token: sessionToken
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (data.error === 'AD_REQUIRED') {
          toast.info('📢 Complete ad to continue');
          router.push(`/tasks/bronze?ad=${data.milestone}`);
          return;
        }
        toast.error(data.error || 'Could not save progress');
        setIsSubmitting(false);
        setAudioComplete(false);
        return;
      }

      // Check if level complete (audio 15)
      if (data.level_complete) {
        toast.success('🎉 Level Complete!');
        setTimeout(() => {
          router.push('/tasks/bronze?complete=true');
        }, 1500);
        return;
      }

      // Check if milestone reached (5 or 10) - Smartlink
      if (data.smartlink_milestone) {
        toast.info(`📢 Smartlink ad required for audio ${data.smartlink_milestone}`);
        setTimeout(() => {
          router.push(`/tasks/bronze?smartlink=${data.smartlink_milestone}&next=${data.next_audio?.id || ''}`);
        }, 1500);
        return;
      }

      // Normal: Go to next audio
      if (data.next_audio) {
        const nextIndex = (audio?.index || 0) + 1;
        toast.success(`✅ Audio ${audio?.index || 0}/${audio?.total || 15} complete!`);
        setTimeout(() => {
          // ✅ Route change → Ad will auto-refresh
          router.push(`/tasks/audio/${data.next_audio.id}?index=${nextIndex}&total=${audio?.total || 15}`);
        }, 1000);
      } else {
        router.push('/tasks/bronze');
      }
    } catch (error) {
      console.error('Error completing audio:', error);
      toast.error('Network error');
      setIsSubmitting(false);
      setAudioComplete(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle play/pause
  const togglePlay = async () => {
    if (!audioRef.current || audioComplete) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Play error:', error);
      toast.error('Could not play audio');
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
        <Loader2 className="w-10 h-10 text-[#6C63FF] animate-spin" />
      </div>
    );
  }

  if (!audio) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Audio not found</p>
          <Link href="/tasks/bronze" className="text-[#6C63FF] hover:underline">
            Back to Level
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white px-4 py-6 pb-32">
      <div className="max-w-md mx-auto">

        {/* ✅ TOP AD - Unique key for route-based refresh */}
        <div className="mb-3">
          <AdBanner 
            key={`top-${audioId}`}
            position="top" 
            refreshKey={`${refreshKey}-top`}
          />
        </div>

        {/* Back Button */}
        <Link 
          href="/tasks/bronze" 
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#6C63FF] mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Level
        </Link>

        {/* Progress Info */}
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-gray-500">
            Audio <span className="font-semibold text-gray-700">{audio.index}</span> of <span className="font-semibold text-gray-700">{audio.total}</span>
          </span>
          <span className="font-medium text-[#6C63FF]">
            {Math.round(progress)}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-5">
          <div 
            className="h-full bg-gradient-to-r from-[#6C63FF] to-purple-500 transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Audio Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
          
          {/* Thumbnail/Artwork */}
          <div className="aspect-video bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl mb-4 flex items-center justify-center relative overflow-hidden">
            {audio.thumbnail_url ? (
              <img 
                src={audio.thumbnail_url} 
                alt={audio.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center">
                <Headphones className="w-14 h-14 text-purple-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400 font-medium">Audio {audio.index}</p>
              </div>
            )}
            
            {/* Play/Pause Overlay Button */}
            <button
              onClick={togglePlay}
              disabled={audioComplete}
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group"
            >
              <div className="w-16 h-16 rounded-full bg-white/90 shadow-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                {audioComplete ? (
                  <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-8 h-8 text-[#6C63FF]" />
                ) : (
                  <Play className="w-8 h-8 text-[#6C63FF] ml-1" />
                )}
              </div>
            </button>

            {/* Audio Complete Badge */}
            {audioComplete && (
              <div className="absolute bottom-3 left-3 bg-green-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                ✅ Complete
              </div>
            )}
          </div>

          {/* Title */}
          <h2 className="text-lg font-bold text-gray-800 text-center mb-3">
            {audio.title || `Audio ${audio.index}`}
          </h2>

          {/* Time Display */}
          <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
            <span>{formatTime(currentTime)}</span>
            <span className="text-gray-300">|</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* ✅ Audio Player - with preload */}
          <audio
            ref={audioRef}
            src={audio.audio_url}
            preload="auto"
            className="hidden"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={(e) => {
              const target = e.target as HTMLAudioElement;
              setCurrentTime(target.currentTime);
              const pct = (target.currentTime / target.duration) * 100;
              setProgress(Math.min(pct, 100));
            }}
            onLoadedMetadata={(e) => {
              const target = e.target as HTMLAudioElement;
              setDuration(target.duration);
            }}
            onEnded={handleAudioComplete}
            onCanPlay={() => setAudioLoaded(true)}
          />

          {/* Instructions */}
          <div className="mt-4 space-y-1.5 text-xs bg-gray-50 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-gray-600">
              <AlertCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span>Listen without switching tabs</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Volume2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span>Keep volume above 15%</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <AlertCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span>Do not skip or fast-forward</span>
            </div>
          </div>

          {/* Audio Complete Status */}
          {audioComplete && (
            <div className="mt-4 space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-center">
                <p className="text-sm font-semibold text-green-700">✅ Audio Complete!</p>
                <p className="text-xs text-green-600">Moving to next audio...</p>
              </div>
            </div>
          )}

          {/* Play Button (if not started) */}
          {!isPlaying && !audioComplete && audioLoaded && (
            <button
              onClick={togglePlay}
              className="mt-4 w-full py-3 bg-[#6C63FF] text-white rounded-xl font-semibold hover:bg-[#5a52e0] transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Play Audio
            </button>
          )}

          {/* Loading state for audio */}
          {!audioLoaded && !audioComplete && (
            <div className="mt-4 w-full py-3 bg-gray-200 text-gray-500 rounded-xl font-semibold flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading audio...
            </div>
          )}
        </div>

        {/* ✅ BOTTOM AD - Unique key for route-based refresh */}
        <div className="fixed bottom-16 sm:bottom-20 left-0 right-0 z-40 px-4">
          <div className="max-w-md mx-auto">
            <AdBanner 
              key={`bottom-${audioId}`}
              position="bottom" 
              refreshKey={`${refreshKey}-bottom`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}