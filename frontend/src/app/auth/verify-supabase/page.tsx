'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifySupabasePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/auth/verify');
  }, [router]);
  return null;
}
