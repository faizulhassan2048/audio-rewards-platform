'use client';

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
        }
      );

      if (error) {
        toast.error(error.message);
        return;
      }

      // Success
      setSent(true);
      toast.success("Reset email sent! Check your inbox.");

    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Success State ──────────────────────────────────────────────
  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-purple-50/30 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100/50 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Sent!</h1>
            <p className="text-gray-500 mb-2">
              Password reset link sent to:
            </p>
            <p className="font-semibold text-purple-600 mb-6">{email}</p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm text-amber-800 font-semibold mb-1">📌 Next Steps:</p>
              <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
                <li>Check your email inbox</li>
                <li>Click the reset link in the email</li>
                <li>Create your new password</li>
              </ol>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              Didn't receive the email? Check spam folder or
            </p>
            <button
              onClick={() => setSent(false)}
              className="text-purple-600 hover:text-purple-700 font-semibold text-sm hover:underline"
            >
              Try again with different email
            </button>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <Link
                href="/auth/login"
                className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-purple-600 transition-colors"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Form State ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-purple-50/30 p-4">
      <div className="w-full max-w-md">

        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-purple-600 transition-colors mb-6 group"
        >
          <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
          Back to Login
        </Link>

        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100/50">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/25">
              <span className="text-2xl">🔐</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Forgot Password?</h1>
            <p className="text-gray-500 mt-1">
              Enter your email and we'll send a reset link
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="group">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
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
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-purple-400 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? (
                <>
                  <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending Reset Link...
                </>
              ) : (
                <>
                  Send Reset Link
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            Remember your password?{" "}
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
