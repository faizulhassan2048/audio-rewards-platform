'use client';

import { useEffect, useRef, useState } from 'react';

interface AdBannerProps {
  position: 'top' | 'bottom';
  className?: string;
  // ✅ Unique key for each page/route
  refreshKey?: string;
}

export default function AdBanner({ 
  position, 
  className = '',
  refreshKey = 'default'
}: AdBannerProps) {
  const [adReady, setAdReady] = useState(false);
  const [loadCount, setLoadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptInjected = useRef(false);
  const mountedRef = useRef(true);

  // ✅ Reset state when refreshKey changes (route change)
  useEffect(() => {
    console.log(`🔄 AdBanner [${position}] refreshKey changed:`, refreshKey);
    
    // Reset state for fresh load
    setAdReady(false);
    scriptInjected.current = false;
    setLoadCount(prev => prev + 1);
    
    // Clear container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    
    // Remove existing Monetag scripts
    const existingScripts = document.querySelectorAll(
      `script[data-zone="11270526"]`
    );
    existingScripts.forEach((s) => s.remove());
    
    // Re-inject after small delay
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        injectAd();
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [refreshKey]);

  // ✅ Inject Monetag script
  const injectAd = () => {
    if (scriptInjected.current || !mountedRef.current) return;
    scriptInjected.current = true;

    console.log(`🎬 Injecting Monetag ad [${position}]`);

    // Create container for ad
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      
      const container = document.createElement('div');
      container.id = `monetag-banner-${position}`;
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.minHeight = '60px';
      
      containerRef.current.appendChild(container);
    }

    // ✅ Use Monetag In-Page Push (zone 11270526)
    const script = document.createElement('script');
    script.dataset.zone = '11270526';
    script.src = 'https://nap5k.com/tag.min.js';
    script.async = true;
    
    script.onload = () => {
      console.log(`✅ Monetag ad loaded [${position}]`);
      setAdReady(true);
    };
    
    script.onerror = () => {
      console.error(`❌ Monetag ad failed [${position}]`);
      setAdReady(true);
    };

    document.body.appendChild(script);

    // Fallback timeout
    const timeout = setTimeout(() => {
      if (!adReady && mountedRef.current) {
        console.log(`⏰ Ad load timeout [${position}]`);
        setAdReady(true);
      }
    }, 5000);

    // Store timeout for cleanup
    (script as any)._timeout = timeout;
  };

  // ✅ Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      console.log(`🗑️ AdBanner unmounted [${position}]`);
      
      // Remove scripts
      const scripts = document.querySelectorAll(
        `script[data-zone="11270526"]`
      );
      scripts.forEach((s) => {
        if ((s as any)._timeout) {
          clearTimeout((s as any)._timeout);
        }
        s.remove();
      });
      
      // Clear container
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [position]);

  // ✅ Initial mount
  useEffect(() => {
    if (mountedRef.current && !scriptInjected.current) {
      const timer = setTimeout(injectAd, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={`
        w-full rounded-xl overflow-hidden
        bg-white/50 min-h-[60px] flex items-center justify-center
        border border-gray-100/50
        ${className}
      `}
      data-refresh-count={loadCount}
    >
      {!adReady ? (
        <div className="flex items-center gap-2 text-gray-400">
          <div className="animate-pulse flex gap-1">
            <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse-dot" />
            <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse-dot animation-delay-200" />
            <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse-dot animation-delay-400" />
          </div>
          <span className="text-[10px]">Loading ad...</span>
        </div>
      ) : (
        <div className="w-full h-full" />
      )}
    </div>
  );
}