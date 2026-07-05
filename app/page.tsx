'use client';

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

export default function Home() {
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref');

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <Image 
              src="/logo.png" 
              alt="YouTask" 
              width={40} 
              height={40}
              className="rounded-lg"
              style={{ width: 'auto', height: 'auto' }}
              priority
            />
            <span className="text-2xl font-bold text-purple-600">YouTask</span>
          </Link>
          <div className="space-x-4">
            <Link href="/auth/login" className="text-gray-600 hover:text-gray-900">
              Login
            </Link>
            <Link 
              href="/auth/register" 
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold mb-6">
          Listen. <span className="text-purple-600">Earn.</span> Withdraw.
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Earn real rewards by listening to audio content.
        </p>

        {/* ✅ Yeh 4 buttons hain — Listen button yahan change karna hai */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
          
          {/* ✅ Listen Button — /audio se /tasks karein */}
          <Link href="/tasks">
            <div className="bg-white p-4 rounded-xl shadow hover:shadow-md transition cursor-pointer">
              <div className="text-3xl mb-2">🎧</div>
              <p className="font-semibold text-gray-800">Listen</p>
              <p className="text-xs text-gray-500">Earn coins</p>
            </div>
          </Link>

          <Link href="/wallet">
            <div className="bg-white p-4 rounded-xl shadow hover:shadow-md transition cursor-pointer">
              <div className="text-3xl mb-2">💰</div>
              <p className="font-semibold text-gray-800">Wallet</p>
              <p className="text-xs text-gray-500">Balance</p>
            </div>
          </Link>

          <Link href="/profile">
            <div className="bg-white p-4 rounded-xl shadow hover:shadow-md transition cursor-pointer">
              <div className="text-3xl mb-2">👥</div>
              <p className="font-semibold text-gray-800">Refer</p>
              <p className="text-xs text-gray-500">Earn more</p>
            </div>
          </Link>

          <Link href="/leaderboard">
            <div className="bg-white p-4 rounded-xl shadow hover:shadow-md transition cursor-pointer">
              <div className="text-3xl mb-2">🏆</div>
              <p className="font-semibold text-gray-800">Rank</p>
              <p className="text-xs text-gray-500">Top earners</p>
            </div>
          </Link>

        </div>

        <Link href={`/auth/register${refCode ? `?ref=${refCode}` : ''}`}>
          <button className="px-8 py-4 bg-purple-600 text-white rounded-lg text-lg hover:bg-purple-700">
            Get Started Free
          </button>
        </Link>
      </section>
    </main>
  );
}