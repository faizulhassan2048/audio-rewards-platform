'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    bottomAtOptions?: any;
  }
}

export default function BottomBanner() {
  const adRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    if (!adRef.current) return;

    // ✅ Clear previous ad
    adRef.current.innerHTML = '';

    // ✅ Use BOTTOM specific variable
    window.bottomAtOptions = {
      key: '28f5a1576733cd52ea49a41963a32c26',
      format: 'iframe',
      height: 50,
      width: 320,
      params: {},
    };

    // ✅ Create script that uses bottomAtOptions
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        var atOptions = window.bottomAtOptions || window.atOptions;
        var script = document.createElement('script');
        script.src = 'https://www.highperformanceformat.com/${window.bottomAtOptions.key}/invoke.js';
        script.async = true;
        document.currentScript.parentNode.insertBefore(script, document.currentScript);
      })();
    `;
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
      className="w-full flex items-center justify-center rounded-xl overflow-hidden bg-gray-50/50 min-h-[60px]"
      onClick={(e) => e.stopPropagation()}
    />
  );
}