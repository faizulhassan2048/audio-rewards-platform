'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    topAtOptions?: any;
  }
}

export default function TopBanner() {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adRef.current) return;

    // ✅ Clear previous ad
    adRef.current.innerHTML = '';

    // ✅ Use TOP specific variable
    window.topAtOptions = {
      key: '8f81182d2c91d217f4889528166429b9',
      format: 'iframe',
      height: 250,
      width: 300,
      params: {},
    };

    // ✅ Create script that uses topAtOptions
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        var atOptions = window.topAtOptions || window.atOptions;
        var script = document.createElement('script');
        script.src = 'https://www.highperformanceformat.com/${window.topAtOptions.key}/invoke.js';
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
      className="w-full flex items-center justify-center rounded-xl overflow-hidden bg-gray-50/50 min-h-[260px]"
    />
  );
}