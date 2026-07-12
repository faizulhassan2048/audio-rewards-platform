'use client';

import { useEffect, useRef, useState } from 'react';

interface AdBannerProps {
  position: 'top' | 'bottom';
  className?: string;
}

// IMPORTANT: Monetag script is loaded globally in layout.tsx
// This component only provides the visual placeholder slots
export default function AdBanner({ position, className = '' }: AdBannerProps) {
  const [adLoaded, setAdLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulate ad loading - replace with actual ad logic
    const timer = setTimeout(() => {
      setAdLoaded(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Different styling for top vs bottom
  const positionStyles = position === 'top' 
    ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200'
    : 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200';

  return (
    <div
      ref={containerRef}
      className={`
        w-full rounded-xl p-2.5 flex items-center justify-center 
        border min-h-[60px] shadow-sm
        ${positionStyles} ${className}
      `}
    >
      {!adLoaded ? (
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-400 border-t-transparent" />
          <span className="text-[10px] text-gray-400">Loading ad...</span>
        </div>
      ) : (
        <div className="text-[10px] text-gray-500 flex items-center gap-3 w-full justify-center">
          <span className="text-base">📢</span>
          <span className="font-medium">
            {position === 'top' ? '📱 Top Banner' : '📱 Bottom Banner'}
          </span>
          <span className="px-2 py-0.5 bg-gray-100 rounded text-[8px] text-gray-500 font-mono">
            320x50
          </span>
          <span className="text-[8px] text-gray-400">
            {position === 'top' ? '▲' : '▼'}
          </span>
        </div>
      )}
    </div>
  );
}