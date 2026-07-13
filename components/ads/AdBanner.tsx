'use client';

import { useEffect, useRef, useState } from 'react';

interface AdBannerProps {
  position: 'top' | 'bottom';
  className?: string;
  refreshKey?: string;
}

export default function AdBanner({ 
  position, 
  className = '',
  refreshKey = 'default'
}: AdBannerProps) {
  const [adReady, setAdReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptInjected = useRef(false);
  const mountedRef = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ Inject Monetag script
  const injectAd = () => {
    if (scriptInjected.current || !mountedRef.current) return;
    scriptInjected.current = true;

    console.log(`🎬 Injecting Monetag ad [${position}] with key:`, refreshKey);

    // Clear container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      
      const container = document.createElement('div');
      container.id = `monetag-banner-${position}`;
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.minHeight = '60px';
      
      containerRef.current.appendChild(container);
    }

    // Remove any existing Monetag scripts
    const existingScripts = document.querySelectorAll(
      `script[data-zone="11270526"]`
    );
    existingScripts.forEach((s) => s.remove());

    // ✅ Monetag In-Page Push (Zone: 11270526)
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
    timeoutRef.current = setTimeout(() => {
      if (!adReady && mountedRef.current) {
        console.log(`⏰ Ad load timeout [${position}]`);
        setAdReady(true);
      }
    }, 5000);
  };

  // ✅ Refresh when refreshKey changes
  useEffect(() => {
    console.log(`🔄 AdBanner [${position}] REFRESHING with key:`, refreshKey);
    
    // Reset state
    setAdReady(false);
    scriptInjected.current = false;
    
    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Clear container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    
    // Remove existing Monetag scripts
    const existingScripts = document.querySelectorAll(
      `script[data-zone="11270526"]`
    );
    existingScripts.forEach((s) => s.remove());
    
    // Inject fresh ad after delay
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        injectAd();
      }
    }, 200);
    
    return () => {
      clearTimeout(timer);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [refreshKey]);

  // ✅ Initial mount
  useEffect(() => {
    mountedRef.current = true;
    
    if (mountedRef.current && !scriptInjected.current) {
      const timer = setTimeout(injectAd, 300);
      return () => {
        clearTimeout(timer);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      console.log(`🗑️ AdBanner unmounted [${position}]`);
      
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Remove scripts
      const scripts = document.querySelectorAll(
        `script[data-zone="11270526"]`
      );
      scripts.forEach((s) => {
        s.remove();
      });
      
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [position]);

  return (
    <div
      ref={containerRef}
      className={`
        w-full rounded-xl overflow-hidden
        bg-white/50 min-h-[60px] flex items-center justify-center
        border border-gray-100/50
        ${className}
      `}
      data-refresh-key={refreshKey}
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