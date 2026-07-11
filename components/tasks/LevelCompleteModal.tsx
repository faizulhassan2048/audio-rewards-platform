'use client'

import { useState } from 'react'
import { PartyPopper, Coins, Gift, Loader2 } from 'lucide-react'

// TODO: replace with your real Monetag Direct Link URL — keep this the
// SAME url as MONETAG_DIRECT_LINK_URL in app/tasks/bronze/page.tsx.
const MONETAG_DIRECT_LINK_URL = 'https://YOUR_MONETAG_DIRECT_LINK_HERE'

interface LevelCompleteModalProps {
  rewardCoins: number
  bonusCoins: number
  onClose: () => void
}

export default function LevelCompleteModal({ rewardCoins, bonusCoins, onClose }: LevelCompleteModalProps) {
  const [bonusState, setBonusState] = useState<'idle' | 'claiming' | 'claimed' | 'error'>('idle')
  const [bonusError, setBonusError] = useState<string | null>(null)

  const handleClaimBonus = async () => {
    // Opens the Monetag Direct Link — this is where the extra ad revenue
    // comes from. Whether the user actually engages with it or not, we
    // still credit the bonus on click (it's an opt-in bonus, not a gate).
    window.open(MONETAG_DIRECT_LINK_URL, '_blank')
    setBonusState('claiming')
    setBonusError(null)
    try {
      const res = await fetch('/api/tasks/level/bonus/claim', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setBonusError(data.error || 'Could not claim bonus')
        setBonusState('error')
        return
      }
      setBonusState('claimed')
    } catch {
      setBonusError('Network error — you can try again')
      setBonusState('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#6C63FF]/10 flex items-center justify-center">
          <PartyPopper className="w-8 h-8 text-[#6C63FF]" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Bronze Level Complete!</h2>
        <p className="text-sm text-gray-500 mb-4">You listened to all 15 audios. Great job!</p>

        <div className="flex items-center justify-center gap-2 bg-[#6C63FF]/10 rounded-xl py-3 mb-3">
          <Coins className="w-5 h-5 text-[#6C63FF]" />
          <span className="font-bold text-[#6C63FF]">+{rewardCoins} coins added</span>
        </div>

        {/* Optional bonus — entirely separate from the reward above, which
            is already guaranteed and already in the wallet regardless of
            what happens here. */}
        {bonusState === 'claimed' ? (
          <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-xl py-3 mb-4">
            <Gift className="w-5 h-5 text-green-600" />
            <span className="font-bold text-green-700">+{bonusCoins} bonus coins added!</span>
          </div>
        ) : (
          <button
            onClick={handleClaimBonus}
            disabled={bonusState === 'claiming'}
            className="w-full mb-4 py-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 text-amber-700 font-semibold hover:bg-amber-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {bonusState === 'claiming' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Gift className="w-4 h-4" />
            )}
            {bonusState === 'claiming' ? 'Claiming bonus…' : `Optional: Claim +${bonusCoins} Bonus`}
          </button>
        )}
        {bonusState === 'error' && (
          <p className="text-xs text-red-500 -mt-3 mb-4">{bonusError} — you can still tap Done, your {rewardCoins} coins are safe.</p>
        )}

        <p className="text-xs text-gray-400 mb-5">Come back tomorrow at midnight for the next round.</p>
        <button
          onClick={onClose}
          className="w-full py-3 bg-[#6C63FF] text-white rounded-xl font-semibold hover:bg-[#5a52e0] transition"
        >
          Done
        </button>
      </div>
    </div>
  )
}