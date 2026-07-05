'use client'

import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'

export default function ConditionalBottomNav() {
  const pathname = usePathname()

  // Hide bottom nav only on the landing page ("/")
  if (pathname === '/') return null

  return <BottomNav />
}
