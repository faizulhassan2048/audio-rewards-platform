'use client';

import { useState, useRef, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Mail, Lock, User, Users } from "lucide-react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useDeviceFingerprint } from "@/lib/hooks/useDeviceFingerprint";

const isDev = process.env.NODE_ENV === 'development';

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const captchaRef = useRef<HCaptcha>(null);
  const { fingerprint } = useDeviceFingerprint();

  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
  });

  const resetCaptcha = () => {
    captchaRef.current?.resetCaptcha();
    setCaptchaToken(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isDev && !captchaToken) {
      toast.error("Please complete the captcha");
      return;
    }

    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    const username = form.username.toLowerCase().trim();
    const usernameRegex = /^[a-z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      toast.error("Username: 3-20 characters, only letters, numbers, underscore");
      return;
    }

    setLoading(true);

    try {
      if (!isDev) {
        const captchaRes = await fetch("/api/auth/verify-captcha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: captchaToken }),
        });
        const captchaData = await captchaRes.json();
        if (!captchaData.success) {
          toast.error("Captcha verification failed. Please try again.");
          resetCaptcha();
          setLoading(false);
          return;
        }
      }

      const refCode = new URLSearchParams(window.location.search).get('ref');

      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: form.fullName.trim(),
            username: username,
            referral_code: refCode || null,
          },
        },
      });

      if (error) {
        // ✅ Detailed error messages
        if (error.message.includes("already registered") || error.message.includes("already been registered")) {
          toast.error("Email already registered. Please login instead.");
        } else if (error.message.includes("Password")) {
          toast.error("Password is too weak. Use at least 6 characters with numbers and letters.");
        } else if (error.message.includes("Username")) {
          toast.error("Username already taken. Please choose another.");
        } else if (error.message.includes("Network") || error.message.includes("fetch")) {
          toast.error("Network error. Please check your internet connection.");
        } else if (error.message.includes("timeout")) {
          toast.error("Request timeout. Please try again.");
        } else if (error.message.includes("invalid")) {
          toast.error("Please enter a valid email address.");
        } else {
          toast.error(error.message);
        }
        resetCaptcha();
        setLoading(false);
        return;
      }

      if (data.user) {
        // ✅ Save device fingerprint after registration
        if (fingerprint) {
          try {
            await fetch("/api/security/device", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fingerprint,
                userAgent: navigator.userAgent,
              }),
            });
          } catch (err) {
            console.log("Device fingerprint save failed:", err);
          }
        }

        if (!data.session) {
          toast.success("✅ Account created! Check your email to verify your account.", {
            duration: 8000,
          });
          router.push("/auth/login?registered=true");
        } else {
          toast.success("Account created! Welcome to YouTask! 🎉");
          router.push("/dashboard");
          router.refresh();
        }
      }

    } catch (err: any) {
      console.error("Register error:", err);
      if (err.message?.includes("Network") || err.message?.includes("fetch")) {
        toast.error("Network error. Please check your internet connection.");
      } else if (err.message?.includes("timeout")) {
        toast.error("Request timeout. Please try again.");
      } else {
        toast.error("Something went wrong. Please try again later.");
      }
    } finally {
      setLoading(false);
      resetCaptcha();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-purple-50/30 p-4">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-purple-600 transition-colors mb-6 group"
        >
          <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </Link>

        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100/50">
          {/* Header with Logo */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <Image 
              src="/logo.png" 
              alt="YouTask" 
              width={40} 
              height={40}
              className="rounded-lg"
            />
            <span className="text-2xl font-bold text-purple-600">YouTask</span>
          </div>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/25">
              <span className="text-2xl">🚀</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
            <p className="text-gray-500 mt-1">Start earning rewards today</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="group">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                <input
                  type="text"
                  placeholder="John Doe"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all bg-gray-50/50 focus:bg-white"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                <input
                  type="text"
                  placeholder="johndoe"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all bg-gray-50/50 focus:bg-white"
                  required
                  disabled={loading}
                  minLength={3}
                  maxLength={20}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1 ml-1">3-20 characters, letters, numbers, underscore only</p>
            </div>

            <div className="group">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all bg-gray-50/50 focus:bg-white"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all bg-gray-50/50 focus:bg-white"
                  required
                  disabled={loading}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {!isDev && (
              <div className="flex justify-center py-2">
                <HCaptcha
                  ref={captchaRef}
                  sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY!}
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => setCaptchaToken(null)}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (!isDev && !captchaToken)}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-purple-400 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-purple-600 hover:text-purple-700 font-semibold hover:underline transition-colors"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}