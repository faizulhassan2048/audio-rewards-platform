import { Trophy } from 'lucide-react'

interface LevelProgressProps {
  levelName?: string
  completed: number
  total: number
}

export default function LevelProgress({ levelName = 'Bronze', completed, total }: LevelProgressProps) {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#6C63FF]/10">
            <Trophy className="w-4 h-4 text-[#6C63FF]" />
          </span>
          <h2 className="text-lg font-bold text-gray-800">{levelName} Level</h2>
        </div>
        <span className="text-xs font-semibold text-[#6C63FF] bg-[#6C63FF]/10 px-2.5 py-1 rounded-full whitespace-nowrap">
          {completed}/{total} Audios
        </span>
      </div>
      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#6C63FF] rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}