'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Headphones, Volume2, AlertCircle, Play, Pause, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import TopBanner from '@/components/ads/TopBanner';
import BottomBanner from '@/components/ads/BottomBanner';
import NativeBanner from '@/components/ads/NativeBanner';
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

interface CompleteResponse {
  error?: string;
  show_ad?: boolean;
  milestone?: number;
  next_audio?: NextAudioRef | null;
  level_complete?: boolean;
  completed_audios?: number;
  total_audios?: number;
}

const safeFetch = async (url: string, options?: RequestInit) => {
  try {
    const res = await fetch(url, { cache: 'no-store', ...options });
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      console.error('JSON parse error for:', url);
      return null;
    }
  } catch {
    return null;
  }
};

export default function AudioPlayerPage() {
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

  // Native banner (shown after EVERY audio completion, not just milestones)
  const [showNativeBanner, setShowNativeBanner] = useState(false);
  const [pendingNextAudio, setPendingNextAudio] = useState<NextAudioRef | null>(null);
  const [pendingNextIndex, setPendingNextIndex] = useState<number>(0);
  const [pendingTotal, setPendingTotal] = useState<number>(15);
  const [pendingLevelComplete, setPendingLevelComplete] = useState(false);
  
  // ✅ REAL countdown for Continue button
  const [continueCountdown, setContinueCountdown] = useState(10);
  const [isNavigatingToNext, setIsNavigatingToNext] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const volumeCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const mountRef = useRef(true);
  const hasNavigatedRef = useRef(false);
  const navigationLockRef = useRef(false);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const currentAudioIdRef = useRef(audioId);

  // Track current audioId + reset per-mount locks
  useEffect(() => {
    currentAudioIdRef.current = audioId;
    navigationLockRef.current = false;
    hasNavigatedRef.current = false;
    setIsNavigatingToNext(false);

    return () => {
      fetchControllerRef.current?.abort();
    };
  }, [audioId]);

  // ✅ FIX 1: Central navigation helper with CLEAR STATE before navigation
  const hardNavigate = (url: string) => {
    if (navigationLockRef.current || isNavigatingToNext) return;
    
    // ✅ CRITICAL: Clear banner state BEFORE navigation
    setShowNativeBanner(false);
    setPendingNextAudio(null);
    setPendingLevelComplete(false);
    setAudioComplete(false);
    
    navigationLockRef.current = true;
    setIsNavigatingToNext(true);
    window.location.replace(url);
  };

  // Tab visibility detection
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

  // Window blur detection
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

  // Volume check (15% minimum)
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

  // ✅ FIX 2: fetchAudio - SEQUENTIAL instead of Promise.all
  useEffect(() => {
    const fetchAudio = async () => {
      fetchControllerRef.current?.abort();
      const controller = new AbortController();
      fetchControllerRef.current = controller;

      // ✅ Reset navigation flag on fresh load
      setIsNavigatingToNext(false);

      try {
        const statusData = await safeFetch('/api/tasks/level/status');

        if (currentAudioIdRef.current !== audioId) {
          console.log('Ignoring stale status response for', audioId);
          return;
        }

        if (!statusData) {
          hardNavigate('/tasks/bronze');
          return;
        }

        if (statusData.level_complete) {
          hardNavigate('/tasks/bronze?complete=true');
          return;
        }

        if (statusData.ad_required) {
          hardNavigate('/tasks/bronze');
          return;
        }

        // ✅ FIX 3: ONLY redirect if this is a 409/Already Completed scenario
        // NOT on every page load
        const isAlreadyCompleted = statusData.completed_audio_ids?.includes(audioId);
        if (isAlreadyCompleted && statusData.current_audio?.id !== audioId) {
          if (statusData.current_audio) {
            const correctIndex = (statusData.completed_audios || 0) + 1;
            hardNavigate(
              `/tasks/audio/${statusData.current_audio.id}?index=${correctIndex}&total=${statusData.total_audios || 15}`
            );
            return;
          }
          hardNavigate('/tasks/bronze');
          return;
        }

        // ✅ If wrong audio (but NOT already completed), redirect
        if (statusData.current_audio?.id !== audioId) {
          if (statusData.current_audio) {
            const correctIndex = (statusData.completed_audios || 0) + 1;
            hardNavigate(
              `/tasks/audio/${statusData.current_audio.id}?index=${correctIndex}&total=${statusData.total_audios || 15}`
            );
            return;
          }
          hardNavigate('/tasks/bronze');
          return;
        }

        const index = statusData.completed_audios + 1;
        const total = statusData.total_audios || 15;

        // ✅ FIX 4: Sequential fetch - session first, then audio
        // Session fetch
        const sessionRes = await fetch('/api/audio/session', {
          method: 'POST',
          cache: 'no-store',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioId }),
        });

        if (currentAudioIdRef.current !== audioId) {
          console.log('Ignoring stale session response for', audioId);
          return;
        }

        let token = null;
        let audioUrl = null;

        if (sessionRes.ok) {
          const sessionText = await sessionRes.text();
          let sessionData: any = {};
          try {
            sessionData = sessionText ? JSON.parse(sessionText) : {};
          } catch {
            console.error('JSON parse error for /api/audio/session');
          }
          token = sessionData.session?.token || null;
          audioUrl = sessionData.session?.audio_url || null;
          setSessionToken(token);
        }

        // ✅ Audio fetch (now sequential)
        const audioRes = await fetch(`/api/tasks/audio/${audioId}`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (currentAudioIdRef.current !== audioId) {
          console.log('Ignoring stale audio response for', audioId);
          return;
        }

        if (audioRes.ok) {
          const audioText = await audioRes.text();
          let data: any = null;
          try {
            data = audioText ? JSON.parse(audioText) : null;
          } catch {
            console.error('JSON parse error for /api/tasks/audio/[id]');
          }
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
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
        console.error('Error fetching audio:', error);
        toast.error('Could not load audio');
        hardNavigate('/tasks/bronze');
      } finally {
        if (currentAudioIdRef.current === audioId) {
          setLoading(false);
        }
      }
    };

    fetchAudio();

    return () => {
      fetchControllerRef.current?.abort();
    };
  }, [audioId]);

  // Preload audio when URL changes
  useEffect(() => {
    if (audio && audioRef.current) {
      audioRef.current.load();
      audioRef.current.currentTime = 0;
      setAudioLoaded(true);
    }
  }, [audio]);

  // Full <audio> element cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
    };
  }, []);

  // Send heartbeat
  const sendHeartbeat = async () => {
    if (!sessionToken || !audioRef.current) return;
    const progressPercent = (audioRef.current.currentTime / audioRef.current.duration) * 100;
    try {
      await fetch('/api/audio/heartbeat', {
        method: 'POST',
        cache: 'no-store',
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

  const handleMilestoneUnlocked = () => {
    if (!milestoneGate || navigationLockRef.current || isNavigatingToNext) return;

    const { levelComplete, nextAudio } = milestoneGate;
    setMilestoneGate(null);

    if (levelComplete || !nextAudio) {
      toast.success('🎉 Level Complete!');
      hardNavigate('/tasks/bronze?complete=true');
      return;
    }

    const nextIndex = (audio?.index || 0) + 1;
    hardNavigate(`/tasks/audio/${nextAudio.id}?index=${nextIndex}&total=${audio?.total || 15}`);
  };

  // ✅ FIX 5: Updated goToNext with proper state clearing
  const goToNext = (
    nextAudio: NextAudioRef | null,
    nextIndex: number,
    total: number,
    levelComplete: boolean
  ) => {
    if (hasNavigatedRef.current || navigationLockRef.current || isNavigatingToNext) return;
    
    // ✅ CRITICAL: Clear ALL banner/audio state BEFORE navigation
    setShowNativeBanner(false);
    setPendingNextAudio(null);
    setPendingLevelComplete(false);
    setAudioComplete(false);
    setIsNavigatingToNext(true);
    
    hasNavigatedRef.current = true;
    navigationLockRef.current = true;

    if (levelComplete || !nextAudio) {
      window.location.replace('/tasks/bronze?complete=true');
      return;
    }

    window.location.replace(`/tasks/audio/${nextAudio.id}?index=${nextIndex}&total=${total}`);
  };

  // Countdown for Continue button
  useEffect(() => {
    if (!showNativeBanner) {
      setContinueCountdown(10);
      return;
    }

    setContinueCountdown(10);
    const interval = setInterval(() => {
      setContinueCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showNativeBanner]);

  const handleNativeBannerComplete = () => {
    goToNext(pendingNextAudio, pendingNextIndex, pendingTotal, pendingLevelComplete);
  };

  const handleBannerTimerDone = () => {};

  // Handle audio complete
  const handleAudioComplete = async () => {
    if (isSubmitting || !mountRef.current || hasNavigatedRef.current || navigationLockRef.current || isNavigatingToNext) return;

    setIsSubmitting(true);
    setAudioComplete(true);

    if (sessionToken) {
      await fetch('/api/audio/heartbeat', {
        method: 'POST',
        cache: 'no-store',
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
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_id: audioId,
          session_token: sessionToken,
        }),
      });

      const text = await res.text();
      let data: CompleteResponse = {};
      try {
        data = text ? (JSON.parse(text) as CompleteResponse) : {};
      } catch {
        console.error('JSON parse error on complete response');
      }

      console.log('Current:', audioId);
      console.log('Next:', data.next_audio?.id);

      if (!res.ok) {
        navigationLockRef.current = false;
        setIsNavigatingToNext(false);

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
        const statusData = await safeFetch('/api/tasks/level/status');
        console.log('Status:', statusData?.current_audio?.id);

        if (statusData?.current_audio && statusData.current_audio.id !== audioId) {
          const correctIndex = (statusData.completed_audios || 0) + 1;
          hardNavigate(
            `/tasks/audio/${statusData.current_audio.id}?index=${correctIndex}&total=${statusData.total_audios || 15}`
          );
        } else {
          hardNavigate('/tasks/bronze');
        }
        return;
      }

      if (data.show_ad) {
        setMilestoneGate({
          milestone: data.milestone || 0,
          nextAudio: data.next_audio || null,
          levelComplete: !!data.level_complete,
        });
        setIsSubmitting(false);
        return;
      }

      const nextIndex = (audio?.index || 0) + 1;
      const total = audio?.total || 15;

      if (data.level_complete) {
        toast.success('🎉 Level Complete!');
        setPendingNextAudio(data.next_audio || null);
        setPendingNextIndex(nextIndex);
        setPendingTotal(total);
        setPendingLevelComplete(true);
        setShowNativeBanner(true);
        setIsSubmitting(false);
        return;
      }

      if (data.next_audio) {
        toast.success(`✅ Audio ${audio?.index || 0}/${total} complete!`);
        console.log('Navigate to next audio');
        setPendingNextAudio(data.next_audio);
        setPendingNextIndex(nextIndex);
        setPendingTotal(total);
        setPendingLevelComplete(false);
        setShowNativeBanner(true);
        setIsSubmitting(false);
        return;
      }

      hardNavigate('/tasks/bronze');

    } catch (error) {
      console.error('Error completing audio:', error);
      toast.error('Network error');
      navigationLockRef.current = false;
      setIsNavigatingToNext(false);
      setIsSubmitting(false);
      setAudioComplete(false);
    }
  };

  // Toggle play/pause
  const togglePlay = async () => {
    if (!audioRef.current || audioComplete || showNativeBanner) return;

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

      await audioRef.current.play().catch(() => {});
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
          <p className="text-gray-500 mb-4">Could not load this audio.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-[#6C63FF] text-white rounded-lg font-semibold hover:bg-[#5a52e0] transition-colors mr-3"
          >
            Retry
          </button>
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

        {showNativeBanner ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 text-center">
            <div className="mb-3">
              <p className="text-sm font-semibold text-green-700">✅ Audio Complete!</p>
              <p className="text-xs text-gray-500 mt-1">
                {continueCountdown > 0 ? `Please wait ${continueCountdown}s...` : 'Ad complete! Tap Continue'}
              </p>
            </div>
            <NativeBanner
              onComplete={handleBannerTimerDone}
              duration={10}
            />
            <button
              onClick={handleNativeBannerComplete}
              disabled={continueCountdown > 0 || isNavigatingToNext}
              className="w-full mt-4 py-3 bg-[#6C63FF] text-white rounded-xl font-semibold hover:bg-[#5a52e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isNavigatingToNext ? 'Loading...' : continueCountdown > 0 ? `Continue (${continueCountdown}s)` : 'Continue'}
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}

        <div className="fixed bottom-16 sm:bottom-20 left-0 right-0 z-40 pointer-events-none">
          <div className="max-w-md mx-auto px-4 pointer-events-auto">
            <BottomBanner />
          </div>
        </div>

      </div>
    </div>
  );
}