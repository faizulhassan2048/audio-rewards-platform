'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    atOptions?: any;
  }
}

export default function TopBanner() {
  const adRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    if (!adRef.current) return;

    adRef.current.innerHTML = '';

    window.atOptions = {
      key: '8f81182d2c91d217f4889528166429b9',
      format: 'iframe',
      height: 250,
      width: 300,
      params: {},
    };

    const script = document.createElement('script');
    script.src = 'https://www.highperformanceformat.com/8f81182d2c91d217f4889528166429b9/invoke.js';
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
      className="w-full flex items-center justify-center rounded-xl overflow-hidden bg-gray-50/50 min-h-[260px]"
    />
  );
}