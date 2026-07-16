'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    atOptions?: any;
  }
}

export default function BottomBanner() {
  const adRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    if (!adRef.current) return;

    // ✅ Delay bottom banner to avoid overwriting top
    const timer = setTimeout(() => {
      if (!adRef.current) return;

      adRef.current.innerHTML = '';

      window.atOptions = {
        key: '28f5a1576733cd52ea49a41963a32c26',
        format: 'iframe',
        height: 50,
        width: 320,
        params: {},
      };

      const script = document.createElement('script');
      script.src = 'https://www.highperformanceformat.com/28f5a1576733cd52ea49a41963a32c26/invoke.js';
      script.async = true;
      adRef.current.appendChild(script);
    }, 3000);

    return () => {
      clearTimeout(timer);
      if (adRef.current) {
        adRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div
      ref={adRef}
      className="w-full flex items-center justify-center rounded-xl overflow-hidden bg-gray-50/50 min-h-[60px]"
      onClick={(e) => e.stopPropagation()}
    />
  );
}