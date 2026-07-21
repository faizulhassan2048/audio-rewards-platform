'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Headphones, Volume2, AlertCircle, Play, Pause, Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import TopBanner from '@/components/ads/TopBanner';
import BottomBanner from '@/components/ads/BottomBanner';
import MilestoneAdGate from '@/components/tasks/MilestoneAdGate';

interface AudioData {
  id: string;
  title: string;
  audio_url: string;
  thumbnail_url?: string | null;
  duration_seconds: number;
  index: number;
  total: number;
}

interface NextAudioRef {
  id: string;
  title: string;
  audio_url: string;
  thumbnail_url?: string | null;
  duration_seconds: number;
}

interface MilestoneGateState {
  milestone: number;
  nextAudio: NextAudioRef | null;
  levelComplete: boolean;
}

const safeFetch = async (url: string, options?: RequestInit) => {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
};

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
  const [tabWarning, setTabWarning] = useState(false);
  const [volumeWarning, setVolumeWarning] = useState(false);
  const [pausedBySystem, setPausedBySystem] = useState(false);
  const [milestoneGate, setMilestoneGate] = useState<MilestoneGateState | null>(null);
  
  // ✅ NEW: Next button states
  const [nextAudioData, setNextAudioData] = useState<NextAudioRef | null>(null);
  const [showNextButton, setShowNextButton] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const volumeCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const mountRef = useRef(true);

  // ✅ Tab visibility detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (audioRef.current && isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
          setTabWarning(true);
          setPausedBySystem(true);
          toast.warning('⏸️ Audio paused! Please stay on this tab to earn rewards.', {
            duration: 3000,
          });
        }
      } else {
        setTabWarning(false);
        setPausedBySystem(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying]);

  // ✅ Window blur detection
  useEffect(() => {
    const handleBlur = () => {
      if (audioRef.current && isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        setTabWarning(true);
        setPausedBySystem(true);
      }
    };

    const handleFocus = () => {
      setTabWarning(false);
      setPausedBySystem(false);
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isPlaying]);

  // ✅ Volume check (15% minimum)
  useEffect(() => {
    volumeCheckInterval.current = setInterval(() => {
      if (!audioRef.current || audioComplete) return;
      const isBelowMin = audioRef.current.volume < 0.15 || audioRef.current.muted;
      if (isBelowMin) {
        setVolumeWarning(true);
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
          setPausedBySystem(true);
          toast.warning('🔊 Volume too low! Please increase volume above 15% to continue.', {
            duration: 3000,
          });
        }
      } else {
        setVolumeWarning(false);
      }
    }, 3000);
    return () => {
      if (volumeCheckInterval.current) clearInterval(volumeCheckInterval.current);
    };
  }, [isPlaying, audioComplete]);

  // ✅ Fetch audio with auto-redirect on refresh
  useEffect(() => {
    const fetchAudio = async () => {
      try {
        // ✅ First check status
        const statusData = await safeFetch('/api/tasks/level/status');

        if (!statusData) {
          router.replace('/tasks/bronze');
          return;
        }

        // ✅ If level complete
        if (statusData?.level_complete) {
          router.replace('/tasks/bronze?complete=true');
          return;
        }

        // ✅ If ad required
        if (statusData?.ad_required) {
          router.replace('/tasks/bronze');
          return;
        }

        // ✅ Check if this audio is already completed
        const completedIds = statusData.completed_audio_ids || [];
        if (completedIds.includes(audioId)) {
          console.log('⚠️ Audio already completed, redirecting to next...');
          const nextAudioId = statusData.audio_ids?.[statusData.completed_audios];
          if (nextAudioId) {
            const nextIndex = (statusData.completed_audios || 0) + 1;
            router.replace(
              `/tasks/audio/${nextAudioId}?index=${nextIndex}&total=${statusData.total_audios || 15}`
            );
            return;
          }
          router.replace('/tasks/bronze');
          return;
        }

        // ✅ If wrong audio, redirect
        if (statusData?.current_audio?.id !== audioId) {
          if (statusData?.current_audio) {
            const correctIndex = (statusData.completed_audios || 0) + 1;
            router.replace(
              `/tasks/audio/${statusData.current_audio.id}?index=${correctIndex}&total=${statusData.total_audios || 15}`
            );
            return;
          }
          router.replace('/tasks/bronze');
          return;
        }

        const index = statusData.completed_audios + 1;
        const total = statusData.total_audios || 15;

        // ✅ Fetch audio data
        const [sessionRes, audioRes] = await Promise.all([
          fetch('/api/audio/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioId }),
          }),
          fetch(`/api/tasks/audio/${audioId}`),
        ]);

        let token = null;
        let audioUrl = null;

        if (sessionRes.ok) {
          const sessionText = await sessionRes.text();
          const sessionData = sessionText ? JSON.parse(sessionText) : {};
          token = sessionData.session?.token || null;
          audioUrl = sessionData.session?.audio_url || null;
          setSessionToken(token);
        }

        if (audioRes.ok) {
          const audioText = await audioRes.text();
          const data = audioText ? JSON.parse(audioText) : null;
          if (data) {
            setAudio({ ...data, index, total });
          }
        } else if (audioUrl) {
          setAudio({
            id: audioId,
            title: `Audio ${index}`,
            audio_url: audioUrl,
            duration_seconds: 0,
            index,
            total,
          });
        }
      } catch (error) {
        console.error('Error fetching audio:', error);
        toast.error('Could not load audio');
        router.replace('/tasks/bronze');
      } finally {
        setLoading(false);
      }
    };

    fetchAudio();
  }, [audioId, router]);

  // Preload audio when URL changes
  useEffect(() => {
    if (audio && audioRef.current) {
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
          clientTimestamp: Date.now(),
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

  // ✅ Handle audio complete - UPDATED with Next button flow
  const handleAudioComplete = async () => {
    if (isSubmitting || !mountRef.current) return;
    setIsSubmitting(true);
    setAudioComplete(true);

    if (sessionToken) {
      await fetch('/api/audio/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          progressPercent: 100,
          clientTimestamp: Date.now(),
        }),
      }).catch(() => {});
    }

    try {
      const res = await fetch('/api/tasks/level/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_id: audioId,
          session_token: sessionToken,
        }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      // ✅ Handle "Already completed"
      if (data.alreadyCompleted || data.error === 'Already completed') {
        toast.info('⏩ Already completed!');
        setIsSubmitting(false);
        return;
      }

      if (!res.ok) {
        if (data.error === 'AD_REQUIRED') {
          toast.info('📢 Complete ad to continue');
          setMilestoneGate({
            milestone: data.milestone || 5,
            nextAudio: data.next_audio || null,
            levelComplete: !!data.level_complete,
          });
          setIsSubmitting(false);
          return;
        }
        toast.error(data.error || 'Could not save progress');
        setIsSubmitting(false);
        return;
      }

      // ✅ Milestone hit - Show ad gate
      if (data.show_ad) {
        setMilestoneGate({
          milestone: data.milestone,
          nextAudio: data.next_audio || null,
          levelComplete: !!data.level_complete,
        });
        setIsSubmitting(false);
        return;
      }

      // ✅ Level complete
      if (data.level_complete) {
        toast.success('🎉 Level Complete!');
        setIsSubmitting(false);
        // ✅ Show complete state with Next button
        return;
      }

      // ✅ ✅ ✅ FIX: Don't auto-navigate - just show Next button
      if (data.next_audio) {
        // ✅ Store next audio in state for manual navigation
        setNextAudioData({
          id: data.next_audio.id,
          title: data.next_audio.title || `Audio ${(audio?.index || 0) + 1}`,
          audio_url: data.next_audio.audio_url,
          thumbnail_url: data.next_audio.thumbnail_url || null,
          duration_seconds: data.next_audio.duration_seconds || 0,
        });
        setShowNextButton(true);
        toast.success(`✅ Audio ${audio?.index || 0}/${audio?.total || 15} complete!`);
        setIsSubmitting(false);
        return;
      }

      // ✅ No next audio - go to bronze
      setIsSubmitting(false);
      
    } catch (error) {
      console.error('Error completing audio:', error);
      toast.error('Network error');
      setIsSubmitting(false);
      setAudioComplete(false);
    }
  };

  // ✅ Handle milestone ad gate completion
  const handleMilestoneUnlocked = () => {
    if (!milestoneGate) return;

    const { levelComplete, nextAudio } = milestoneGate;
    setMilestoneGate(null);

    if (levelComplete) {
      toast.success('🎉 Level Complete!');
      router.replace('/tasks/bronze?complete=true');
      return;
    }

    if (nextAudio) {
      const nextIndex = (audio?.index || 0) + 1;
      toast.success('🎯 Ad complete! Loading next audio...');
      
      setTimeout(() => {
        router.replace(
          `/tasks/audio/${nextAudio.id}?index=${nextIndex}&total=${audio?.total || 15}`
        );
      }, 500);
      return;
    }

    // ✅ Fallback: fetch status and navigate
    const fetchAndNavigate = async () => {
      try {
        const statusData = await safeFetch('/api/tasks/level/status');
        if (statusData?.current_audio) {
          const nextIndex = (statusData.completed_audios || 0) + 1;
          router.replace(
            `/tasks/audio/${statusData.current_audio.id}?index=${nextIndex}&total=${statusData.total_audios || 15}`
          );
        } else {
          router.replace('/tasks/bronze');
        }
      } catch {
        router.replace('/tasks/bronze');
      }
    };

    fetchAndNavigate();
  };

  // ✅ Handle Next Audio button click
  const handleNextAudio = () => {
    if (!nextAudioData) {
      // ✅ Fallback: fetch status
      const fetchAndNavigate = async () => {
        try {
          const statusData = await safeFetch('/api/tasks/level/status');
          if (statusData?.current_audio) {
            const nextIndex = (statusData.completed_audios || 0) + 1;
            router.replace(
              `/tasks/audio/${statusData.current_audio.id}?index=${nextIndex}&total=${statusData.total_audios || 15}`
            );
          } else {
            router.replace('/tasks/bronze');
          }
        } catch {
          router.replace('/tasks/bronze');
        }
      };
      fetchAndNavigate();
      return;
    }

    const nextIndex = (audio?.index || 0) + 1;
    setShowNextButton(false);
    setNextAudioData(null);
    
    router.replace(
      `/tasks/audio/${nextAudioData.id}?index=${nextIndex}&total=${audio?.total || 15}`
    );
  };

  // Toggle play/pause
  const togglePlay = async () => {
    if (!audioRef.current || audioComplete) return;

    if (pausedBySystem) {
      setPausedBySystem(false);
      setTabWarning(false);
      setVolumeWarning(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    try {
      if (audioRef.current.volume < 0.15) {
        audioRef.current.volume = 0.15;
        setVolumeWarning(false);
      }

      await audioRef.current.play();
      setIsPlaying(true);
      setTabWarning(false);
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
          <p className="text-gray-500 mb-4">Loading next audio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white px-4 py-6 pb-32">
      <div className="max-w-md mx-auto">

        <div className="mb-3">
          <TopBanner />
        </div>

        <Link
          href="/tasks/bronze"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#6C63FF] mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Level
        </Link>

        {(tabWarning || volumeWarning) && (
          <div className={`mb-3 px-4 py-2 rounded-lg text-sm font-medium ${
            tabWarning ? 'bg-red-50 border border-red-200 text-red-700' : ''
          } ${volumeWarning ? 'bg-yellow-50 border border-yellow-200 text-yellow-700' : ''}`}>
            {tabWarning && '⚠️ Audio paused! Please stay on this tab.'}
            {volumeWarning && '🔊 Volume too low! Please increase above 15%.'}
          </div>
        )}

        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-gray-500">
            Audio <span className="font-semibold text-gray-700">{audio.index}</span> of <span className="font-semibold text-gray-700">{audio.total}</span>
          </span>
          <span className="font-medium text-[#6C63FF]">
            {Math.round(progress)}%
          </span>
        </div>

        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-gradient-to-r from-[#6C63FF] to-purple-500 transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">

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

            {audioComplete && (
              <div className="absolute bottom-3 left-3 bg-green-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                ✅ Complete
              </div>
            )}
          </div>

          <h2 className="text-lg font-bold text-gray-800 text-center mb-3">
            {audio.title || `Audio ${audio.index}`}
          </h2>

          <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
            <span>{formatTime(currentTime)}</span>
            <span className="text-gray-300">|</span>
            <span>{formatTime(duration)}</span>
          </div>

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

          <div className="mt-4 space-y-1.5 text-xs bg-gray-50 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-gray-600">
              <AlertCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span>Stay on this tab while listening</span>
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

          {milestoneGate && (
            <div className="mt-4">
              <MilestoneAdGate
                milestone={milestoneGate.milestone}
                onUnlocked={handleMilestoneUnlocked}
              />
            </div>
          )}

          {/* ✅ UPDATED: Audio Complete with Next Button */}
          {audioComplete && !milestoneGate && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm font-semibold text-green-700">✅ Audio Complete!</p>
              </div>
              
              {showNextButton ? (
                <button
                  onClick={handleNextAudio}
                  className="w-full mt-2 py-3 bg-[#6C63FF] text-white rounded-xl font-semibold hover:bg-[#5a52e0] transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  Next Audio
                </button>
              ) : isSubmitting ? (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                  <p className="text-xs text-green-600">Saving progress...</p>
                </div>
              ) : (
                <p className="text-xs text-green-600">Loading next audio...</p>
              )}
            </div>
          )}

          {!isPlaying && !audioComplete && audioLoaded && (
            <button
              onClick={togglePlay}
              className="mt-4 w-full py-3 bg-[#6C63FF] text-white rounded-xl font-semibold hover:bg-[#5a52e0] transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Play Audio
            </button>
          )}

          {!audioLoaded && !audioComplete && (
            <div className="mt-4 w-full py-3 bg-gray-200 text-gray-500 rounded-xl font-semibold flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading audio...
            </div>
          )}
        </div>

        <div className="fixed bottom-16 sm:bottom-20 left-0 right-0 z-40 pointer-events-none">
          <div className="max-w-md mx-auto px-4 pointer-events-auto">
            <BottomBanner />
          </div>
        </div>

      </div>
    </div>
  );
}