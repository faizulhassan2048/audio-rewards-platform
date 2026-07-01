'use client';

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Mail, Lock } from "lucide-react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useDeviceFingerprint } from "@/lib/hooks/useDeviceFingerprint";

const isDev = process.env.NODE_ENV === 'development';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const captchaRef = useRef<HCaptcha>(null);
  const { fingerprint } = useDeviceFingerprint();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      toast.success("Account created! Please log in.", { duration: 5000 });
    }
    if (searchParams.get("verified") === "true") {
      toast.success("Email verified! You can now log in.", { duration: 4000 });
    }
  }, [searchParams]);

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

    setLoading(true);

    try {
      // Captcha verify — dev mein skip
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

      // Supabase login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          toast.error("Please verify your email first. Check your inbox.", { duration: 6000 });
        } else if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password.");
        } else {
          toast.error(error.message);
        }
        resetCaptcha();
        return;
      }

      if (data.user) {
        // ✅ Save device fingerprint after login
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

        toast.success("Welcome back! 🎉");
        router.push("/dashboard");
        router.refresh();
      }

    } catch (err) {
      console.error("Login error:", err);
      toast.error("Something went wrong. Please try again.");
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
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/25">
              <span className="text-2xl">👋</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome Back</h1>
            <p className="text-gray-500 mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="group">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all bg-gray-50/50 focus:bg-white"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="group">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all bg-gray-50/50 focus:bg-white"
                  required
                  disabled={loading}
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

            {/* hCaptcha — sirf production mein */}
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

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-gray-600 group-hover:text-gray-900 transition-colors">Remember me</span>
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-purple-600 hover:text-purple-700 hover:underline transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading || (!isDev && !captchaToken)}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-purple-400 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Signing In...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            Don't have an account?{" "}
            <Link
              href="/auth/register"
              className="text-purple-600 hover:text-purple-700 font-semibold hover:underline transition-colors"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}