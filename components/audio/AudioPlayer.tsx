'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, Loader2 } from 'lucide-react';

interface AudioPlayerProps {
  audioId: string;
  audioUrl: string;
  title: string;
  duration: number;
  rewardCoins: number;
  onComplete?: () => void;
}

export default function AudioPlayer({
  audioId,
  audioUrl,
  title,
  duration,
  rewardCoins,
  onComplete,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);

  // Audio loading states
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState(false);

  // ✅ NEW: Reward claimed state with cooldown info
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [cooldownInfo, setCooldownInfo] = useState<{
    nextAvailable?: Date;
    days?: number;
  }>({});

  // Warning states
  const [tabWarning, setTabWarning] = useState(false);
  const [volumeWarning, setVolumeWarning] = useState(false);
  const [pausedBySystem, setPausedBySystem] = useState(false);
  const [pauseReason, setPauseReason] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastValidTime = useRef(0);
  const skipAttempts = useRef(0);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const volumeCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const muteTimer = useRef<NodeJS.Timeout | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const isCompletedRef = useRef(false);

  // ── FEATURE 1: Tab Switch / Visibility Detection ───────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!isSessionActive || isCompletedRef.current) return;
      if (document.visibilityState === 'hidden') {
        audioRef.current?.pause();
        setIsPlaying(false);
        setTabWarning(true);
        setPausedBySystem(true);
        setPauseReason('tab_hidden');
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
          heartbeatInterval.current = null;
        }
      } else {
        setTabWarning(false);
      }
    };

    const handleWindowBlur = () => {
      if (!isSessionActive || isCompletedRef.current) return;
      if (audioRef.current && isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        setPausedBySystem(true);
        setPauseReason('window_blur');
        setTabWarning(true);
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
          heartbeatInterval.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isSessionActive, isPlaying]);

  // ── FEATURE 2: Volume Enforcement (min 15%) ────────────────────
  useEffect(() => {
    if (!isSessionActive) return;
    volumeCheckInterval.current = setInterval(() => {
      if (!audioRef.current || isCompletedRef.current) return;
      const isBelowMin = audioRef.current.volume < 0.15 || audioRef.current.muted;
      if (isBelowMin) {
        setVolumeWarning(true);
        if (!muteTimer.current) {
          muteTimer.current = setTimeout(() => {
            if (audioRef.current) {
              const stillLow = audioRef.current.volume < 0.15 || audioRef.current.muted;
              if (stillLow && !isCompletedRef.current) {
                audioRef.current.pause();
                setIsPlaying(false);
                setPausedBySystem(true);
                setPauseReason('volume_too_low');
              }
            }
            muteTimer.current = null;
          }, 8000);
        }
      } else {
        setVolumeWarning(false);
        if (muteTimer.current) { clearTimeout(muteTimer.current); muteTimer.current = null; }
      }
    }, 3000);
    return () => {
      if (volumeCheckInterval.current) { clearInterval(volumeCheckInterval.current); volumeCheckInterval.current = null; }
      if (muteTimer.current) { clearTimeout(muteTimer.current); muteTimer.current = null; }
    };
  }, [isSessionActive]);

  // ── Session Start ──────────────────────────────────────────────
  const startSession = async () => {
    try {
      const res = await fetch('/api/audio/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioId }),
      });
      const data = await res.json();
      if (data.success) {
        sessionTokenRef.current = data.session.token;
        setIsSessionActive(true);
        if (audioRef.current && data.session.audio_url) {
          audioRef.current.src = data.session.audio_url;
        }
        return true;
      } else {
        setAudioError(data.error || 'Failed to start session');
        return false;
      }
    } catch {
      setAudioError('Network error. Please try again.');
      return false;
    }
  };

  // ── Heartbeat ──────────────────────────────────────────────────
  const sendHeartbeat = useCallback(async () => {
    const token = sessionTokenRef.current;
    if (!token || !audioRef.current) return;
    const progressPercent = (audioRef.current.currentTime / duration) * 100;
    try {
      await fetch('/api/audio/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: token, progressPercent, clientTimestamp: Date.now() }),
      });
    } catch { console.log('Heartbeat failed'); }
  }, [duration]);

  useEffect(() => {
    if (isSessionActive && isPlaying) {
      heartbeatInterval.current = setInterval(sendHeartbeat, 10000);
    } else {
      if (heartbeatInterval.current) { clearInterval(heartbeatInterval.current); heartbeatInterval.current = null; }
    }
    return () => {
      if (heartbeatInterval.current) { clearInterval(heartbeatInterval.current); heartbeatInterval.current = null; }
    };
  }, [isSessionActive, isPlaying, sendHeartbeat]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, []);

  // ── Play / Pause ────────────────────────────────────────────────
  const togglePlay = async () => {
    if (!audioRef.current || audioLoading) return;

    if (pausedBySystem) {
      if (pauseReason === 'volume_too_low') {
        alert('Please increase volume above 15% to continue earning.');
        return;
      }
      setPausedBySystem(false);
      setPauseReason('');
      setTabWarning(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (audioRef.current.volume < 0.15 && !isCompleted) {
      audioRef.current.volume = 0.15;
      setVolume(0.15);
      setIsMuted(false);
      audioRef.current.muted = false;
    }

    if (!isSessionActive) {
      setAudioLoading(true);
      const started = await startSession();
      setAudioLoading(false);
      if (!started) return;
    }

    try {
      await audioRef.current.play();
      setIsPlaying(true);
      setAudioError(null);
    } catch (err: any) {
      setAudioError('Could not play audio. Try again.');
      setIsPlaying(false);
    }
  };

  // ── Retry handler ────────────────────────────────────────────
  const handleRetry = () => {
    setAudioError(null);
    setAudioReady(false);
    setIsSessionActive(false);
    sessionTokenRef.current = null;
    if (audioRef.current) {
      audioRef.current.load();
    }
  };

  // ── Time Update ─────────────────────────────────────────────────
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;

    if (current > lastValidTime.current + 1.5) {
      audioRef.current.currentTime = lastValidTime.current;
      skipAttempts.current += 1;
      if (skipAttempts.current >= 3) {
        audioRef.current.pause();
        setIsPlaying(false);
        alert('Too many skip attempts. Session terminated.');
        setIsSessionActive(false);
        sessionTokenRef.current = null;
      }
      return;
    }

    lastValidTime.current = current;
    setCurrentTime(current);
    setProgress((current / duration) * 100);

    // ✅ 100% completion — reward sirf ek baar
    if (current >= duration * 0.95 && !isCompleted && !isCompletedRef.current && !rewardClaimed) {
      isCompletedRef.current = true;
      setIsCompleted(true);
      setIsPlaying(false);

      const completeAudio = async () => {
        const token = sessionTokenRef.current;
        if (!token) { alert('Session error. Please refresh.'); return; }
        try {
          await fetch('/api/audio/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token, progressPercent: 100, clientTimestamp: Date.now() }),
          });
          await new Promise(r => setTimeout(r, 800));

          const res = await fetch('/api/audio/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token, progressPercent: 100 }),
          });
          const data = await res.json();
          
          // ✅ Handle 409 - Already claimed with cooldown
          if (res.status === 409 && data.error === 'Already claimed') {
            setRewardClaimed(true);
            if (data.next_available) {
              const nextTime = new Date(data.next_available);
              const formattedDate = nextTime.toLocaleDateString('en-PK', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
              setCooldownInfo({
                nextAvailable: nextTime,
                days: data.cooldown_days
              });
              alert(`⏳ Already claimed! Available again: ${formattedDate}`);
            } else {
              alert('✅ Already claimed this audio!');
            }
            if (onComplete) onComplete();
            return;
          }

          if (data.success) {
            setRewardClaimed(true);
            alert(`🎉 You earned ${data.reward} coins!\nNew balance: ${data.newBalance} coins`);
            if (onComplete) onComplete();
          } else {
            alert('Failed to get reward: ' + data.error);
          }
        } catch { alert('Network error. Please try again.'); }
      };

      completeAudio();
    }
  };

  // ── Volume Controls ────────────────────────────────────────────
  const toggleMute = () => {
    if (!audioRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audioRef.current.muted = newMuted;
    setVolumeWarning(newMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) { audioRef.current.volume = val; audioRef.current.muted = false; setIsMuted(false); }
    if (val >= 0.15) { setVolumeWarning(false); setPausedBySystem(false); if (pauseReason === 'volume_too_low') setPauseReason(''); }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  // ── UI ──────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
      {/* Audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        onLoadStart={() => { setAudioLoading(true); setAudioError(null); }}
        onCanPlay={() => { setAudioLoading(false); setAudioReady(true); }}
        onWaiting={() => setAudioLoading(true)}
        onPlaying={() => setAudioLoading(false)}
        onError={() => {
          setAudioLoading(false);
          setAudioError('Audio failed to load. Please try again.');
          setIsPlaying(false);
        }}
        preload="none"
      >
        <source src={audioUrl} type="audio/mpeg" />
      </audio>

      {/* Header */}
      <div className="flex justify-between items-start mb-4 gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold truncate overflow-hidden whitespace-nowrap" title={title}>
            {title}
          </h2>
          <p className="text-sm text-gray-500">Duration: {formatTime(duration)}</p>
        </div>
        <div className="flex-shrink-0 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-bold">
          🪙 {rewardCoins}
        </div>
      </div>

      {/* Tab Warning */}
      {tabWarning && (
        <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
          ⚠️ Audio paused — you left this tab. Press Play to continue earning.
        </div>
      )}

      {/* Volume Warning */}
      {volumeWarning && (
        <div className="mb-3 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm font-medium">
          🔊 Volume below 15%. Please increase to continue earning.
        </div>
      )}

      {/* Audio Error with Retry */}
      {audioError && (
        <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm font-medium">{audioError}</p>
          <button
            onClick={handleRetry}
            className="mt-1 flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-semibold"
          >
            <RotateCcw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* ✅ Reward Claimed badge with cooldown info */}
      {rewardClaimed && (
        <div className="mb-3 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 text-sm font-semibold">
            ✅ Reward claimed! Coins added to your wallet.
          </p>
          {cooldownInfo.nextAvailable && (
            <p className="text-xs text-green-600 mt-1">
              ⏳ Next available: {cooldownInfo.nextAvailable.toLocaleDateString('en-PK', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
              {cooldownInfo.days && ` (${cooldownInfo.days} day${cooldownInfo.days > 1 ? 's' : ''} cooldown)`}
            </p>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className="relative w-full h-2 bg-gray-200 rounded-full mb-2 cursor-default select-none">
        <div
          className="h-full bg-purple-600 rounded-full transition-all duration-300 pointer-events-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between text-sm text-gray-500 mb-4">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          disabled={!!audioError && !isSessionActive}
          className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {audioLoading
            ? <Loader2 size={20} className="animate-spin" />
            : isPlaying
            ? <Pause size={24} />
            : <Play size={24} />
          }
        </button>

        <div className="flex items-center gap-2 flex-1">
          <button onClick={toggleMute} className="text-gray-500 hover:text-purple-600">
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <input
            type="range" min="0" max="1" step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-24 h-1 bg-gray-300 rounded-full appearance-none cursor-pointer accent-purple-600"
          />
          <span className={`text-xs ${volume < 0.15 || isMuted ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
            {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
          </span>
        </div>

        <div className="text-sm text-gray-500 font-medium">
          {isCompleted ? '✅ Done' : `${Math.round(progress)}%`}
        </div>
      </div>

      {/* How to Earn */}
      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-xs font-semibold text-amber-800 mb-1">📌 How to Earn:</p>
        <ul className="text-xs text-amber-700 space-y-0.5">
          <li className={tabWarning ? 'text-red-600 font-bold' : ''}>
            {tabWarning ? '❌' : '✅'} Listen without switching tabs
          </li>
          <li className={volumeWarning ? 'text-red-600 font-bold' : ''}>
            {volumeWarning ? '❌' : '✅'} Keep volume above 15%
          </li>
          <li className={skipAttempts.current >= 1 ? 'text-red-600 font-bold' : ''}>
            {skipAttempts.current >= 1 ? '❌' : '✅'} Do not skip or fast-forward
          </li>
          <li className={isCompleted ? 'text-green-600 font-bold' : ''}>
            {isCompleted ? '✅' : '⏳'} Complete 100% of the audio
          </li>
          {rewardClaimed && cooldownInfo.days && (
            <li className="text-purple-600 font-bold">
              🔄 Cooldown: {cooldownInfo.days} day{cooldownInfo.days > 1 ? 's' : ''} between claims
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}