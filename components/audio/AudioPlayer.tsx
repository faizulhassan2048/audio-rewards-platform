'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

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
        // Tab switched or browser minimized
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
        setTabWarning(true);
        setPausedBySystem(true);
        setPauseReason('tab_hidden');

        // Stop heartbeat while tab is hidden
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
          heartbeatInterval.current = null;
        }
      } else {
        // User returned to tab
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

        // Give 8 second grace period then pause
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
        if (muteTimer.current) {
          clearTimeout(muteTimer.current);
          muteTimer.current = null;
        }
      }
    }, 3000); // Check every 3 seconds

    return () => {
      if (volumeCheckInterval.current) {
        clearInterval(volumeCheckInterval.current);
        volumeCheckInterval.current = null;
      }
      if (muteTimer.current) {
        clearTimeout(muteTimer.current);
        muteTimer.current = null;
      }
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
        alert(data.error || 'Failed to start session');
        return false;
      }
    } catch {
      alert('Network error. Please try again.');
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
        body: JSON.stringify({
          sessionToken: token,
          progressPercent,
          clientTimestamp: Date.now(),
        }),
      });
    } catch {
      console.log('Heartbeat failed');
    }
  }, [duration]);

  // Start/stop heartbeat based on session + playing state
  useEffect(() => {
    if (isSessionActive && isPlaying) {
      heartbeatInterval.current = setInterval(sendHeartbeat, 10000);
    } else {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
    }
    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
    };
  }, [isSessionActive, isPlaying, sendHeartbeat]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, []);

  // ── Play / Pause ────────────────────────────────────────────────
  const togglePlay = async () => {
    if (!audioRef.current) return;

    // If paused by system, user must fix the issue first
    if (pausedBySystem) {
      if (pauseReason === 'volume_too_low') {
        alert('Please increase volume above 15% to continue earning.');
        return;
      }
      // For tab/window reason, allow resume
      setPausedBySystem(false);
      setPauseReason('');
      setTabWarning(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // Check volume before playing
    if (audioRef.current.volume < 0.15 && !isCompleted) {
      alert('Please keep volume above 15% to earn rewards.');
      audioRef.current.volume = 0.15;
      setVolume(0.15);
      setIsMuted(false);
      audioRef.current.muted = false;
    }

    if (!isSessionActive) {
      const started = await startSession();
      if (!started) return;
    }

    audioRef.current.play();
    setIsPlaying(true);
  };

  // ── Time Update (skip prevention + completion) ─────────────────
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;

    // FEATURE 3: Skip / Fast-forward prevention
    if (current > lastValidTime.current + 1.5) {
      audioRef.current.currentTime = lastValidTime.current;
      skipAttempts.current += 1;
      if (skipAttempts.current >= 3) {
        audioRef.current.pause();
        setIsPlaying(false);
        alert('Too many skip attempts. Session terminated. No reward will be given.');
        setIsSessionActive(false);
        sessionTokenRef.current = null;
      }
      return;
    }

    lastValidTime.current = current;
    setCurrentTime(current);
    setProgress((current / duration) * 100);

    // FEATURE 4: 100% completion
    if (current >= duration * 0.95 && !isCompleted && !isCompletedRef.current) {
      isCompletedRef.current = true;
      setIsCompleted(true);
      setIsPlaying(false);

      const completeAudio = async () => {
        const token = sessionTokenRef.current;
        if (!token) {
          alert('Session error. Please refresh and try again.');
          return;
        }
        try {
          // Final heartbeat at 100%
          await fetch('/api/audio/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionToken: token,
              progressPercent: 100,
              clientTimestamp: Date.now(),
            }),
          });

          await new Promise((resolve) => setTimeout(resolve, 800));

          // Complete API with progressPercent
          const res = await fetch('/api/audio/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionToken: token,
              progressPercent: 100,
            }),
          });

          const data = await res.json();
          if (data.success) {
            alert(`🎉 You earned ${data.reward} coins!\nNew balance: ${data.newBalance} coins`);
            if (onComplete) onComplete();
          } else {
            alert('Failed to get reward: ' + data.error);
            console.error('Complete error:', data);
          }
        } catch {
          alert('Network error. Please try again.');
        }
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
    if (newMuted) {
      setVolumeWarning(true);
    } else {
      setVolumeWarning(false);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = false;
      setIsMuted(false);
    }
    if (val >= 0.15) {
      setVolumeWarning(false);
      setPausedBySystem(false);
      if (pauseReason === 'volume_too_low') setPauseReason('');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ── UI ──────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      >
        <source src={audioUrl} type="audio/mpeg" />
      </audio>

      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-gray-500">Duration: {formatTime(duration)}</p>
        </div>
        <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-bold">
          🪙 {rewardCoins} coins
        </div>
      </div>

      {/* WARNING: Tab switched */}
      {tabWarning && (
        <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
          ⚠️ Audio paused — you left this tab. Return here and press Play to continue earning.
        </div>
      )}

      {/* WARNING: Volume too low */}
      {volumeWarning && (
        <div className="mb-3 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm font-medium">
          🔊 Volume is below 15%. Please increase volume to continue earning.
        </div>
      )}

      {/* Progress Bar — READ ONLY, no seek */}
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
          className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center hover:bg-purple-700 transition-colors"
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>

        <div className="flex items-center gap-2 flex-1">
          <button onClick={toggleMute} className="text-gray-500 hover:text-purple-600">
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-24 h-1 bg-gray-300 rounded-full appearance-none cursor-pointer accent-purple-600"
          />
          {/* Volume % indicator */}
          <span className={`text-xs ${volume < 0.15 || isMuted ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
            {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
          </span>
        </div>

        <div className="text-sm text-gray-500">
          {isCompleted ? '✅ Completed' : `${Math.round(progress)}%`}
        </div>
      </div>

      {/* How to Earn Box */}
      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-xs font-semibold text-amber-800 mb-1">📌 How to Earn:</p>
        <ul className="text-xs text-amber-700 space-y-0.5">
          <li className={`flex items-center gap-1 ${tabWarning ? 'text-red-600 font-bold' : ''}`}>
            {tabWarning ? '❌' : '✅'} Listen without switching tabs
          </li>
          <li className={`flex items-center gap-1 ${volumeWarning ? 'text-red-600 font-bold' : ''}`}>
            {volumeWarning ? '❌' : '✅'} Keep volume above 15%
          </li>
          <li className={`flex items-center gap-1 ${skipAttempts.current >= 1 ? 'text-red-600 font-bold' : ''}`}>
            {skipAttempts.current >= 1 ? '❌' : '✅'} Do not skip or fast-forward
          </li>
          <li className={`flex items-center gap-1 ${isCompleted ? 'text-green-600 font-bold' : ''}`}>
            {isCompleted ? '✅' : '⏳'} Complete 100% of the audio
          </li>
        </ul>
      </div>
    </div>
  );
}
