"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";

interface User {
  email: string;
  id: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  hasLLMKey: boolean;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  setHasLLMKey: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hasLLMKey, setHasLLMKey] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkAuth() {
      try {
        const storedUser = localStorage.getItem("app_user");
        const token = localStorage.getItem("supabase_token");

        if (storedUser && token) {
          setUser(JSON.parse(storedUser));

          // Check if user has an LLM key configured
          try {
            const keysRes = await api.getLLMKeys();
            setHasLLMKey(keysRes.data.length > 0);
          } catch {
            setHasLLMKey(false);
          }
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Protect routes
  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== "/login") {
        router.push("/login");
      } else if (user && pathname === "/login") {
        router.push("/");
      }
    }
  }, [user, loading, pathname, router]);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      // Set initial token context for OAuth request
      localStorage.setItem("supabase_token", "demo-jwt-token");

      // Fetch real Google OAuth URL from backend
      const res = await api.connectGmail();
      if (res.auth_url) {
        // Save user state and redirect to Google OAuth login screen
        const googleUser = {
          email: "student@college.edu",
          id: "google-user-123",
        };
        localStorage.setItem("app_user", JSON.stringify(googleUser));
        window.location.href = res.auth_url;
      } else {
        // Fallback local login if backend auth url not returned
        const googleUser = {
          email: "student@college.edu",
          id: "google-user-123",
        };
        localStorage.setItem("app_user", JSON.stringify(googleUser));
        setUser(googleUser);
        router.push("/");
      }
    } catch (e) {
      console.warn("Failed to get Google OAuth URL, entering dev mode", e);
      const googleUser = {
        email: "student@college.edu",
        id: "google-user-123",
      };
      localStorage.setItem("app_user", JSON.stringify(googleUser));
      setUser(googleUser);
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("app_user");
    localStorage.removeItem("supabase_token");
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        hasLLMKey,
        loading,
        loginWithGoogle,
        logout,
        setHasLLMKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
