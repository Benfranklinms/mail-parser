"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Opportunity, ApplicationStatus, SyncStatus } from "@/types";
import { api } from "@/lib/api";
import { OpportunityCard } from "@/components/OpportunityCard";
import { OpportunitySkeleton } from "@/components/OpportunitySkeleton";
import { toast } from "sonner";
import { Search, RefreshCw, Filter, Sparkles, Mail, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Filters state
  const [roleType, setRoleType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // Load Opportunities
  const loadOpportunities = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getOpportunities({
        role_type: roleType,
        status: status,
        search: search,
      });
      setOpportunities(res.data);
    } catch {
      toast.error("Failed to load placement opportunities");
    } finally {
      setLoading(false);
    }
  }, [roleType, status, search]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  // Handle Manual Trigger Sync
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    toast.info("Starting email sync...");
    try {
      const res = await api.triggerSync();
      setSyncStatus(res);
      toast.success("Incremental sync triggered successfully!");
      setTimeout(() => loadOpportunities(), 3000);
    } catch {
      toast.error("Failed to start sync");
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Status Update
  const handleStatusChange = async (id: string, newStatus: ApplicationStatus) => {
    const prevOpp = opportunities.find((o) => o.id === id);
    if (!prevOpp) return;

    // Optimistic UI Update
    setOpportunities((prev) =>
      prev.map((o) => (o.id === id ? { ...o, application_status: newStatus } : o))
    );

    const statusLabels: Record<ApplicationStatus, string> = {
      applied: "Marked as Applied! 🚀",
      result_out: "Moved to Result Out 🏆",
      not_applied: "Reset to Not Applied ⏱️",
    };

    toast.success(statusLabels[newStatus] || "Status updated");

    try {
      await api.updateOpportunityStatus(id, newStatus);
    } catch {
      toast.error("Failed to update status on server");
      // Revert on error
      setOpportunities((prev) =>
        prev.map((o) => (o.id === id ? { ...o, application_status: prevOpp.application_status } : o))
      );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[var(--border)]">
        <div>
          <h1 className="font-fraunces-display text-3xl font-bold tracking-tight text-[var(--ink)]">
            Placement Dashboard
          </h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1">
            Turn unstructured placement emails into trackable boarding pass tickets.
          </p>
        </div>

        {/* Sync Now Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--ink)] shadow-sm hover:shadow transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent)] ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing Inbox..." : "Sync Mail Now"}</span>
          </button>
        </div>
      </div>

      {/* SYNC PROGRESS BAR (IF SYNC ACTIVE) */}
      {syncStatus && syncStatus.status === "processing" && (
        <div className="p-4 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--accent)] animate-pulse" />
            <span className="font-semibold text-[var(--ink)]">
              Email extraction in progress... ({syncStatus.processed || 0} / {syncStatus.total || 0} emails)
            </span>
          </div>
          <div className="w-full sm:w-48 bg-[var(--background)] rounded-full h-2 overflow-hidden border border-[var(--border)]">
            <div
              className="bg-[var(--accent)] h-full transition-all duration-300"
              style={{
                width: `${
                  syncStatus.total ? Math.min(100, Math.round(((syncStatus.processed || 0) / syncStatus.total) * 100)) : 20
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* FILTER BAR */}
      <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--border)] shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              type="text"
              placeholder="Search by company or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-xs text-[var(--ink)] placeholder-[var(--ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Role Filter */}
            <div className="flex items-center gap-1.5 bg-[var(--background)] p-1 rounded-lg border border-[var(--border)] text-xs">
              <span className="px-2 text-[11px] font-mono-plex text-[var(--ink-muted)] uppercase">Role:</span>
              {[
                { label: "All", value: "all" },
                { label: "Internship", value: "internship" },
                { label: "Full-time", value: "full-time" },
                { label: "PPO", value: "ppo" },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setRoleType(item.value)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    roleType === item.value
                      ? "bg-[var(--surface)] text-[var(--ink)] font-semibold shadow-sm border border-[var(--border)]"
                      : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-[var(--background)] p-1 rounded-lg border border-[var(--border)] text-xs">
              <span className="px-2 text-[11px] font-mono-plex text-[var(--ink-muted)] uppercase">Status:</span>
              {[
                { label: "All", value: "all" },
                { label: "Not Applied", value: "not_applied" },
                { label: "Applied", value: "applied" },
                { label: "Result", value: "result_out" },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setStatus(item.value)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    status === item.value
                      ? "bg-[var(--surface)] text-[var(--ink)] font-semibold shadow-sm border border-[var(--border)]"
                      : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* OPPORTUNITIES GRID / STAGGER ANIMATION */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <OpportunitySkeleton />
          <OpportunitySkeleton />
          <OpportunitySkeleton />
          <OpportunitySkeleton />
        </div>
      ) : opportunities.length > 0 ? (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.04,
              },
            },
          }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {opportunities.map((opp) => (
            <motion.div
              key={opp.id}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
              }}
            >
              <OpportunityCard opportunity={opp} onStatusChange={handleStatusChange} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        /* EMPTY STATE */
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-12 text-center max-w-lg mx-auto my-8 space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8" />
          </div>
          <h2 className="font-fraunces-display text-2xl font-bold text-[var(--ink)]">
            No Placement Opportunities Found
          </h2>
          <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
            {search || roleType !== "all" || status !== "all"
              ? "No opportunities match your current search and filter selections. Try clearing your filters."
              : "Connect your placement cell Gmail account to automatically extract job drives and deadlines into your personal ticket stub board."}
          </p>
          <div className="pt-2">
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--ink)] text-[var(--surface)] hover:bg-[var(--accent)] transition-colors text-xs font-semibold shadow-md"
            >
              <span>Connect Gmail Account</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}
