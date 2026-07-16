'use client';

import { useEffect, useRef } from 'react';

interface NativeBannerProps {
  className?: string;
}

export default function NativeBanner({ className = '' }: NativeBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // ✅ Clear previous content
    containerRef.current.innerHTML = '';

    // ✅ Create container for native ad
    const container = document.createElement('div');
    container.id = 'container-d59bba32d33c1da2bf3fbeeacf85538a';
    container.style.width = '100%';
    container.style.minHeight = '260px';

    // ✅ Create script
    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src =
      'https://pl30377225.effectivecpmnetwork.com/d59bba32d33c1da2bf3fbeeacf85538a/invoke.js';

    containerRef.current.appendChild(container);
    container.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full flex items-center justify-center rounded-xl overflow-hidden bg-gray-50/50 min-h-[260px] ${className}`}
    />
  );
}

