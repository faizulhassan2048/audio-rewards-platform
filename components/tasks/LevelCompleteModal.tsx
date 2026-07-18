'use client';

import { useState, useEffect } from 'react';
import { PartyPopper, Coins, Gift, Loader2, Clock } from 'lucide-react';

// ✅ Adsterra Direct Link
const ADSTERRA_DIRECT_LINK_URL = 'https://www.effectivecpmnetwork.com/cjwanx75u?key=35c37ccabbe40a0330805d114bcb7f5a';

interface LevelCompleteModalProps {
  rewardCoins: number;
  bonusCoins: number;
  onClose: () => void;
}

export default function LevelCompleteModal({ 
  rewardCoins, 
  bonusCoins, 
  onClose 
}: LevelCompleteModalProps) {
  const [bonusState, setBonusState] = useState<'idle' | 'claiming' | 'claimed' | 'error'>('idle');
  const [bonusError, setBonusError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(15);
  const [isTimerComplete, setIsTimerComplete] = useState(false);
  const [directLinkOpened, setDirectLinkOpened] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Handle Bonus Claim
  const handleClaimBonus = () => {
    if (bonusState === 'claimed') return;
    
    window.open(ADSTERRA_DIRECT_LINK_URL, '_blank', 'noopener');
    setDirectLinkOpened(true);
    setBonusState('claiming');
    setBonusError(null);
    
    setSecondsLeft(15);
    setIsTimerComplete(false);
    
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsTimerComplete(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Claim bonus after timer completes
  useEffect(() => {
    if (isTimerComplete && bonusState === 'claiming') {
      claimBonus();
    }
  }, [isTimerComplete]);

  const claimBonus = async () => {
    try {
      const res = await fetch('/api/tasks/level/bonus/claim', { method: 'POST' });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        setBonusError(data.error || 'Could not claim bonus');
        setBonusState('error');
        return;
      }
      setBonusState('claimed');
    } catch {
      setBonusError('Network error — you can try again');
      setBonusState('error');
    }
  };

  // ✅ Handle close with debounce to prevent double click
  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const progress = ((15 - secondsLeft) / 15) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl animate-fade-in">
        
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#6C63FF]/10 flex items-center justify-center">
          <PartyPopper className="w-8 h-8 text-[#6C63FF]" />
        </div>
        
        <h2 className="text-xl font-bold text-gray-800 mb-2">🎉 Bronze Level Complete!</h2>
        <p className="text-sm text-gray-500 mb-4">You listened to all 15 audios. Great job!</p>

        {/* Main Reward */}
        <div className="flex items-center justify-center gap-2 bg-[#6C63FF]/10 rounded-xl py-3 mb-4">
          <Coins className="w-5 h-5 text-[#6C63FF]" />
          <span className="font-bold text-[#6C63FF]">+{rewardCoins} coins added</span>
        </div>

        {/* Optional Bonus */}
        {bonusState === 'claimed' ? (
          <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-xl py-3 mb-4">
            <Gift className="w-5 h-5 text-green-600" />
            <span className="font-bold text-green-700">+{bonusCoins} bonus coins added!</span>
          </div>
        ) : bonusState === 'claiming' ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl py-3 mb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
              <span className="font-semibold text-amber-700">Ad loading... {secondsLeft}s</span>
            </div>
            <div className="w-full max-w-[200px] mx-auto h-1.5 bg-amber-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-amber-600 mt-1.5">
              Please complete the ad in the new tab
            </p>
          </div>
        ) : bonusState === 'error' ? (
          <div className="mb-4">
            <p className="text-xs text-red-500">{bonusError}</p>
            <button
              onClick={handleClaimBonus}
              className="mt-2 text-sm text-[#6C63FF] font-semibold hover:underline"
            >
              Try Again
            </button>
          </div>
        ) : (
          <button
            onClick={handleClaimBonus}
            className="w-full mb-4 py-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 text-amber-700 font-semibold hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
          >
            <Gift className="w-4 h-4" />
            Optional: Claim +{bonusCoins} Bonus
          </button>
        )}

        <p className="text-xs text-gray-400 mb-5">Come back tomorrow at midnight for the next round.</p>
        
        <button
          onClick={handleClose}
          disabled={isClosing}
          className="w-full py-3 bg-[#6C63FF] text-white rounded-xl font-semibold hover:bg-[#5a52e0] transition disabled:opacity-50"
        >
          {isClosing ? 'Closing...' : 'Done'}
        </button>
      </div>
    </div>
  );
}