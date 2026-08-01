"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-12 h-6 rounded-full bg-[var(--border)] opacity-50" />;
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        isDark ? "bg-[#1E293B]" : "bg-[#E2E8F0]"
      }`}
      aria-label="Toggle dark mode"
      role="switch"
      aria-checked={isDark}
    >
      <span className="sr-only">Toggle theme</span>
      <span
        className={`pointer-events-none flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          isDark ? "translate-x-6 bg-[#0F172A] text-[var(--accent)]" : "translate-x-0 bg-white text-[var(--ink)]"
        }`}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 fill-current text-[var(--accent)]" />
        ) : (
          <Sun className="h-3.5 w-3.5 fill-current text-[var(--accent)]" />
        )}
      </span>
    </button>
  );
}
