'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

export default function SearchParamsHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      toast.success('Account created! Please log in.', { duration: 5000 });
    }
    if (searchParams.get('verified') === 'true') {
      toast.success('Email verified! You can now log in.', { duration: 4000 });
    }
  }, [searchParams]);

  return null;
}

