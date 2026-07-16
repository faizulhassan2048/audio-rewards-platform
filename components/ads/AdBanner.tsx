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

    // ✅ Adsterra Banner Setup
    if (position === 'top') {
      // TOP BANNER - 300x250
      window.atOptions = {
        key: '8f81182d2c91d217f4889528166429b9',
        format: 'iframe',
        height: 250,
        width: 300,
        params: {},
      };
    } else {
      // BOTTOM BANNER - 320x50
      window.atOptions = {
        key: '28f5a1576733cd52ea49a41963a32c26',
        format: 'iframe',
        height: 50,
        width: 320,
        params: {},
      };
    }

    const script = document.createElement('script');
    if (position === 'top') {
      script.src =
        'https://www.highperformanceformat.com/8f81182d2c91d217f4889528166429b9/invoke.js';
    } else {
      script.src =
        'https://www.highperformanceformat.com/28f5a1576733cd52ea49a41963a32c26/invoke.js';
    }
    script.async = true;

    adRef.current.appendChild(script);

    return () => {
      if (adRef.current) {
        adRef.current.innerHTML = '';
      }
    };
  }, [position]);

  return (
    <div
      ref={adRef}
      className={`w-full flex items-center justify-center rounded-xl overflow-hidden bg-gray-50/50 ${position === 'top' ? 'min-h-[260px]' : 'min-h-[60px]'} ${className}`}
      data-position={position}
    />
  );
}