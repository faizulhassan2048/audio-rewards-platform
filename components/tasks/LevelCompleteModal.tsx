'use client'

import { PartyPopper, Coins } from 'lucide-react'

interface LevelCompleteModalProps {
  rewardCoins: number
  onClose: () => void
}

export default function LevelCompleteModal({ rewardCoins, onClose }: LevelCompleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#6C63FF]/10 flex items-center justify-center">
          <PartyPopper className="w-8 h-8 text-[#6C63FF]" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">🎉 Bronze Level Complete!</h2>
        <p className="text-sm text-gray-500 mb-4">You listened to all 15 audios. Great job!</p>
        <div className="flex items-center justify-center gap-2 bg-[#6C63FF]/10 rounded-xl py-3 mb-5">
          <Coins className="w-5 h-5 text-[#6C63FF]" />
          <span className="font-bold text-[#6C63FF]">+{rewardCoins} coins added</span>
        </div>
        <p className="text-xs text-gray-400 mb-5">🔄 Come back in 24 hours for the next round.</p>
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