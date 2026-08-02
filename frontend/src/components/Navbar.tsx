"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Send, Settings, LogOut, Sparkles } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export function Navbar() {
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();

  // Hide navbar on login page or when not authenticated
  if (pathname === "/login" || !isAuthenticated) {
    return null;
  }

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Applications", href: "/applications", icon: Send },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  const userEmail = user?.email || "student@college.edu";
  const initial = userEmail.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center font-bold shadow-sm transition-transform group-hover:scale-105">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-base tracking-tight text-[var(--ink)] leading-tight">
              Placement Mail
            </span>
            <span className="text-[10px] font-mono-plex text-[var(--ink-muted)] tracking-wide">
              Smart Opportunity Tracker
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-[var(--surface-muted)] p-1 rounded-xl border border-[var(--border)]">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs font-semibold"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]/60"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[var(--accent)]" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions: User Menu */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-all text-xs font-medium text-[var(--ink)] shadow-xs"
              aria-label="User menu"
            >
              <div className="w-5 h-5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-bold flex items-center justify-center text-[10px]">
                {initial}
              </div>
              <span className="hidden sm:inline text-xs font-semibold">{userEmail}</span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-2 z-50 animate-in fade-in duration-150">
                <div className="px-4 py-2 border-b border-[var(--border)]">
                  <p className="text-xs font-semibold text-[var(--ink)]">Placement Student</p>
                  <p className="text-[11px] font-mono-plex text-[var(--ink-muted)] truncate">{userEmail}</p>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2 px-4 py-2 text-xs text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                  Account Settings
                </Link>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Mobile Nav Bar */}
      <div className="md:hidden flex border-t border-[var(--border)] px-4 py-2 bg-[var(--surface)] justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 text-xs font-medium py-1.5 px-3 rounded-lg ${
                isActive ? "bg-[var(--accent-light)] text-[var(--accent)] font-semibold" : "text-[var(--ink-muted)]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
