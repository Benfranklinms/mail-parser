"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Sparkles, Mail, Lock, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!password || password.length < 6) {
      toast.error("Please enter your password (min 6 characters)");
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
    } catch {
      toast.error("Failed to sign in");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center mx-auto shadow-md">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">
            Placement Mail Tracker
          </h1>
          <p className="text-xs text-[var(--ink-muted)]">
            Sign in to access your structured placement inbox dashboard.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[var(--surface)] p-8 rounded-2xl border border-[var(--border)] shadow-xs space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--ink)] block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                <input
                  type="email"
                  placeholder="student@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-xl text-xs text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--ink)] block">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-xl text-xs text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-[var(--ink)] text-white text-xs font-semibold hover:bg-[var(--accent)] transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{submitting ? "Signing In..." : "Sign In & Continue"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-[var(--border)] text-center">
            <p className="text-[11px] text-[var(--ink-muted)]">
              Demo account preset: enter your email to enter dashboard.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
