'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Mail, Lock, User, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useDeviceFingerprint } from "@/lib/hooks/useDeviceFingerprint";
import { Turnstile } from "@marsidev/react-turnstile";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const { fingerprint } = useDeviceFingerprint();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
  });

  // ✅ Get referral code from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref) {
        console.log('🔑 Referral Code captured:', ref);
        setReferralCode(ref);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    if (!captchaToken) {
      toast.error("Please complete the captcha verification.");
      return;
    }

    setLoading(true);

    try {
      // ✅ Verify captcha token first
      const captchaRes = await fetch("/api/verify-captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: captchaToken }),
      });

      const captchaData = await captchaRes.json();

      if (!captchaData.success) {
        toast.error("Captcha verification failed. Please try again.");
        setCaptchaToken(null);
        setLoading(false);
        return;
      }

      console.log('🔑 Referral Code from state:', referralCode);

      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: form.fullName.trim(),
            username: username,
            referral_code: referralCode || null,
          },
        },
      });

      console.log('📤 SignUp data:', { 
        email: form.email.trim(), 
        username, 
        referral_code: referralCode || null 
      });

      if (error) {
        console.error('❌ Signup error:', error);
        
        // ✅ Extract error message properly
        let errorMessage = '';
        
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error.message) {
          errorMessage = error.message;
        } else {
          errorMessage = JSON.stringify(error);
        }
        
        console.log('📝 Error message:', errorMessage);

        // ✅ Check for specific errors
        if (errorMessage.includes("already registered") || errorMessage.includes("already been registered")) {
          toast.error("❌ Email already registered. Please login instead.");
        } else if (errorMessage.includes("Password") || errorMessage.toLowerCase().includes("password")) {
          toast.error("❌ Password is too weak. Use at least 6 characters.");
        } else if (errorMessage.includes("Username") || errorMessage.toLowerCase().includes("username")) {
          toast.error("❌ Username already taken. Please choose another.");
        } else if (errorMessage.includes("Network") || errorMessage.includes("fetch") || errorMessage.includes("network")) {
          toast.error("❌ Network error. Please check your internet connection.");
        } else if (errorMessage.includes("timeout")) {
          toast.error("❌ Request timeout. Please try again.");
        } else if (errorMessage.includes("invalid") || errorMessage.includes("Invalid")) {
          toast.error("❌ Please enter a valid email address.");
        } else {
          // ✅ Show actual error message (not empty object)
          const displayMessage = errorMessage && errorMessage !== '{}' && errorMessage !== '[]' 
            ? errorMessage 
            : 'Something went wrong. Please try again.';
          toast.error("❌ " + displayMessage);
        }
        
        setLoading(false);
        return;
      }

      if (data.user) {
        console.log('✅ User created:', data.user.id);
        console.log('📊 Meta data:', data.user.user_metadata);

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
      
      // ✅ Extract error message properly
      let errorMsg = '';
      
      if (typeof err === 'string') {
        errorMsg = err;
      } else if (err.message) {
        errorMsg = err.message;
      } else {
        errorMsg = JSON.stringify(err);
      }
      
      console.log('📝 Catch error:', errorMsg);
      
      if (errorMsg.includes("Network") || errorMsg.includes("fetch")) {
        toast.error("❌ Network error. Please check your internet connection.");
      } else if (errorMsg.includes("timeout")) {
        toast.error("❌ Request timeout. Please try again.");
      } else {
        const displayMsg = errorMsg && errorMsg !== '{}' && errorMsg !== '[]' 
          ? errorMsg 
          : 'Something went wrong. Please try again.';
        toast.error("❌ " + displayMsg);
      }
    } finally {
      setLoading(false);
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
          <div className="flex items-center justify-center gap-2 mb-6">
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

            {/* ✅ Turnstile Captcha */}
            <div className="flex justify-center">
              <Turnstile
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                onSuccess={(token) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken(null)}
                options={{ theme: "auto" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !captchaToken}
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