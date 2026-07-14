'use client';

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { createClient } from '@/lib/supabase/client';
import { Shield, FileText, Mail } from 'lucide-react';

function HomeContent() {
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref');

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
    };

    checkUser();
  }, [supabase]);

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
              priority
            />
            <span className="text-2xl font-bold text-purple-600">
              YouTask
            </span>
          </Link>

          <div className="space-x-4">
            <Link
              href="/auth/login"
              className="text-gray-600 hover:text-gray-900"
            >
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

        <Link
          href={
            isLoggedIn
              ? "/dashboard"
              : `/auth/register${refCode ? `?ref=${refCode}` : ''}`
          }
        >
          <button className="px-8 py-4 bg-purple-600 text-white rounded-lg text-lg hover:bg-purple-700">
            {isLoggedIn ? "Go to Dashboard" : "Get Started Free"}
          </button>
        </Link>

        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap justify-center gap-6 text-sm text-gray-500">
          <Link
            href="/privacy-policy"
            className="flex items-center gap-1.5 hover:text-purple-600 transition-colors"
          >
            <Shield className="w-4 h-4" />
            Privacy Policy
          </Link>

          <Link
            href="/terms"
            className="flex items-center gap-1.5 hover:text-purple-600 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Terms of Service
          </Link>

          <a
            href="mailto:awaisealtaf@gmail.com"
            className="flex items-center gap-1.5 hover:text-purple-600 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Contact
          </a>
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}