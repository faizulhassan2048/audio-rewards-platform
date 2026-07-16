'use client';

import { useEffect, useRef } from 'react';

interface AdBannerProps {
  position: 'top' | 'bottom';
  className?: string;
}

declare global {
  interface Window {
    atOptions?: any;
  }
}

export default function AdBanner({ position, className = '' }: AdBannerProps) {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adRef.current) return;

    // ✅ Clear previous ad
    adRef.current.innerHTML = '';

    // ✅ Adsterra Banner Setup (300x250)
    window.atOptions = {
      key: '8f81182d2c91d217f4889528166429b9',
      format: 'iframe',
      height: 250,
      width: 300,
      params: {},
    };

    const script = document.createElement('script');
    script.src =
      'https://www.highperformanceformat.com/8f81182d2c91d217f4889528166429b9/invoke.js';
    script.async = true;

    adRef.current.appendChild(script);

    return () => {
      if (adRef.current) {
        adRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div
      ref={adRef}
      className={`w-full flex items-center justify-center rounded-xl overflow-hidden bg-gray-50/50 min-h-[260px] ${className}`}
      data-position={position}
    />
  );
}


