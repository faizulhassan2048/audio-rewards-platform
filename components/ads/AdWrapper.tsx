'use client';

import { usePathname } from 'next/navigation';
import AdBanner from './AdBanner';
import NativeBanner from './NativeBanner';
import SmartlinkButton from './SmartlinkButton';

interface AdWrapperProps {
  type: 'top' | 'bottom' | 'native' | 'smartlink';
  className?: string;
  smartlinkUrl?: string;
  onSmartlinkComplete?: () => void;
  buttonText?: string;
}

export default function AdWrapper({
  type,
  className = '',
  smartlinkUrl = '',
  onSmartlinkComplete = () => {},
  buttonText = 'Continue to Next Audio',
}: AdWrapperProps) {
  const pathname = usePathname();

  // ✅ Different key for each route to force refresh
  const key = `${pathname}-${type}`;

  if (type === 'top' || type === 'bottom') {
    return <AdBanner key={key} position={type} className={className} />;
  }

  if (type === 'native') {
    return <NativeBanner key={key} className={className} />;
  }

  if (type === 'smartlink') {
    return (
      <SmartlinkButton
        key={key}
        smartlinkUrl={smartlinkUrl}
        onComplete={onSmartlinkComplete}
        className={className}
        buttonText={buttonText}
      />
    );
  }

  return null;
}


