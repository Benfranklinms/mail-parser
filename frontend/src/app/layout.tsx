import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { Navbar } from "@/components/Navbar";
import { AuthProvider } from "@/context/AuthContext";
import { LLMKeyModal } from "@/components/LLMKeyModal";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const ibmMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Placement Mail Tracker",
  description: "Transform noisy placement cell emails into a clean, trackable opportunity dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${ibmMono.variable}`}>
      <body className="bg-[var(--background)] text-[var(--ink)] antialiased min-h-screen flex flex-col font-sans">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <LLMKeyModal />
          <Toaster position="bottom-right" richColors />
        </AuthProvider>
      </body>
    </html>
  );
}
