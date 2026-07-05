'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListTodo, Wallet, User } from 'lucide-react';

const navItems = [
  { name: 'Home', href: '/dashboard', icon: Home },  // ✅ Changed from '/' to '/dashboard'
  { name: 'Tasks', href: '/tasks', icon: ListTodo },
  { name: 'Wallet', href: '/wallet', icon: Wallet },
  { name: 'Profile', href: '/profile', icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Hide on auth pages
  const authPages = ['/auth/login', '/auth/register', '/auth/callback'];
  if (authPages.includes(pathname)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-1 sm:px-4 z-50">
      <div className="max-w-md mx-auto flex justify-around items-center h-16 sm:h-20">
        {navItems.map(({ name, href, icon: Icon }) => {
          const isActive = pathname === href || 
            (href !== '/' && pathname?.startsWith(href));
          
          return (
            <Link
              key={name}
              href={href}
              className={`flex flex-col items-center justify-center px-3 py-1 rounded-lg transition-all duration-200 min-w-[56px] ${
                isActive 
                  ? 'text-purple-600' 
                  : 'text-gray-500 hover:text-purple-400'
              }`}
            >
              <Icon 
                size={24} 
                className={`transition-all duration-200 ${
                  isActive ? 'scale-110' : ''
                }`}
              />
              <span className={`text-[10px] font-medium mt-1 transition-all duration-200 ${
                isActive ? 'text-purple-600' : 'text-gray-500'
              }`}>
                {name}
              </span>
              {isActive && (
                <span className="absolute -top-0.5 w-6 h-1 bg-purple-600 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}