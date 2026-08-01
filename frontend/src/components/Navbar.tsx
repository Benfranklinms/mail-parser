"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { Mail, LayoutDashboard, Send, Settings, User, LogOut } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Applications", href: "/applications", icon: Send },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 flex items-center justify-center transition-transform group-hover:scale-105">
            <Mail className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <span className="font-fraunces-display text-xl font-bold tracking-tight text-[var(--ink)] block leading-none">
              Placement Mail
            </span>
            <span className="font-mono-plex text-[10px] uppercase tracking-widest text-[var(--ink-muted)] block mt-0.5">
              Tracker & Stub Engine
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-[var(--background)] p-1 rounded-lg border border-[var(--border)]">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm font-semibold border border-[var(--border)]"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]/50"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[var(--accent)]" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions: Theme Toggle & User Menu */}
        <div className="flex items-center gap-4">
          <ThemeToggle />

          {/* User Avatar Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 rounded-full hover:bg-[var(--background)] transition-colors border border-[var(--border)]"
              aria-label="User menu"
            >
              <div className="w-7 h-7 rounded-full bg-[var(--ink)] text-[var(--surface)] flex items-center justify-center text-xs font-semibold">
                S
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2 border-b border-[var(--border)]">
                  <p className="text-xs font-semibold text-[var(--ink)]">Student User</p>
                  <p className="text-[11px] font-mono-plex text-[var(--ink-muted)] truncate">student@college.edu</p>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2 px-4 py-2 text-xs text-[var(--ink)] hover:bg-[var(--background)] transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                  Account Settings
                </Link>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    alert("Signed out");
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors text-left"
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
              className={`flex flex-col items-center gap-1 text-[10px] font-medium py-1 px-3 rounded-md ${
                isActive ? "text-[var(--accent)] font-semibold" : "text-[var(--ink-muted)]"
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
