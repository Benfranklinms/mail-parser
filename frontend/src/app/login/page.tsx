"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [submitting, setSubmitting] = useState(false);
  const { loginWithGoogle } = useAuth();

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    try {
      await loginWithGoogle();
      toast.success("Signed in with Google!");
    } catch {
      toast.error("Failed to sign in with Google");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center mx-auto shadow-md">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">
            Placement Mail Tracker
          </h1>
          <p className="text-xs text-[var(--ink-muted)] max-w-xs mx-auto leading-relaxed">
            Automatically extract placement & internship opportunities directly from your college Gmail inbox.
          </p>
        </div>

        {/* Google-Only Sign In Card */}
        <div className="bg-[var(--surface)] p-8 rounded-2xl border border-[var(--border)] shadow-xs space-y-6 text-center">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[var(--ink)]">
              Student Sign In
            </h2>
            <p className="text-xs text-[var(--ink-muted)]">
              Sign in with your Google / College account to continue.
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={submitting}
            className="w-full py-3.5 px-4 rounded-xl bg-[var(--ink)] text-white text-xs font-semibold hover:bg-[var(--accent)] transition-all shadow-xs flex items-center justify-center gap-3 disabled:opacity-50 group"
          >
            {/* SVG Google Logo */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{submitting ? "Signing in with Google..." : "Continue with Google"}</span>
            <ArrowRight className="w-4 h-4 text-white/70 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <p className="text-[11px] font-mono-plex text-[var(--ink-muted)] pt-2">
            Separate consent requested for Gmail inbox read access.
          </p>
        </div>

      </div>
    </div>
  );
}
