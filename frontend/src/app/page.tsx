"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Opportunity, ApplicationStatus, SyncStatus } from "@/types";
import { api } from "@/lib/api";
import { OpportunityCard } from "@/components/OpportunityCard";
import { OpportunitySkeleton } from "@/components/OpportunitySkeleton";
import { toast } from "sonner";
import { Search, RefreshCw, Sparkles, ArrowRight, Briefcase } from "lucide-react";
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

  // Poll sync status when processing
  useEffect(() => {
    if (!syncStatus || syncStatus.status !== "processing") return;

    const interval = setInterval(async () => {
      try {
        const latest = await api.getSyncStatus();
        setSyncStatus(latest);

        if (latest.status === "completed" || latest.status === "failed") {
          clearInterval(interval);
          setIsSyncing(false);
          loadOpportunities();
          if (latest.status === "completed") {
            toast.success(`Sync finished! Extracted ${latest.extracted || 0} opportunities.`);
          } else {
            toast.error("Sync failed to finish.");
          }
          // Hide progress banner after 2s
          setTimeout(() => setSyncStatus(null), 2000);
        }
      } catch (err) {
        console.error("Error polling sync status:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [syncStatus, loadOpportunities]);

  // Handle Manual Trigger Sync
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    toast.info("Starting email sync...");
    try {
      const res = await api.triggerSync();
      setSyncStatus(res);
      
      // If immediate complete
      if (res.status === "completed") {
        setIsSyncing(false);
        toast.success("Inbox already up to date!");
        loadOpportunities();
        setTimeout(() => setSyncStatus(null), 2000);
      }
    } catch {
      toast.error("Failed to start sync");
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
      applied: "Marked as Applied",
      result_out: "Moved to Result Out",
      not_applied: "Reset to Not Applied",
    };

    toast.success(statusLabels[newStatus] || "Status updated");

    try {
      await api.updateOpportunityStatus(id, newStatus);
    } catch {
      toast.error("Failed to update status on server");
      setOpportunities((prev) =>
        prev.map((o) => (o.id === id ? { ...o, application_status: prevOpp.application_status } : o))
      );
    }
  };

  // Quick stats calculation
  const totalCount = opportunities.length;
  const appliedCount = opportunities.filter((o) => o.application_status === "applied").length;
  const resultCount = opportunities.filter((o) => o.application_status === "result_out").length;

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[var(--border)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            Placement Dashboard
          </h1>
          <p className="text-xs text-[var(--ink-muted)] mt-1">
            Turn unstructured placement cell emails into structured, trackable opportunity cards.
          </p>
        </div>

        {/* Sync Now Button & Quick Stats */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono-plex font-medium text-[var(--ink-muted)] mr-2">
            <span className="px-2.5 py-1 rounded-md bg-[var(--surface-muted)] border border-[var(--border)]">
              {totalCount} Total
            </span>
            <span className="px-2.5 py-1 rounded-md bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success)]/20">
              {appliedCount} Applied
            </span>
            <span className="px-2.5 py-1 rounded-md bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent)]/20">
              {resultCount} Results
            </span>
          </div>

          <button
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-xs font-medium text-[var(--ink)] shadow-xs transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent)] ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Mail"}</span>
          </button>
        </div>
      </div>

      {/* SYNC PROGRESS BAR (IF ACTIVE) */}
      {syncStatus && syncStatus.status === "processing" && (
        <div className="p-4 rounded-xl bg-[var(--accent-light)] border border-[var(--accent)]/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--accent)] animate-pulse" />
            <span className="font-semibold text-[var(--ink)]">
              Scanning placement inbox... ({syncStatus.processed || 0} / {syncStatus.total || 0} emails)
            </span>
          </div>
          <div className="w-full sm:w-48 bg-white rounded-full h-2 overflow-hidden border border-[var(--border)]">
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
      <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--border)] shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              type="text"
              placeholder="Search company or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-xs text-[var(--ink)] placeholder-[var(--ink-light)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Role Filter */}
            <div className="flex items-center gap-1 bg-[var(--surface-muted)] p-1 rounded-lg border border-[var(--border)] text-xs">
              <span className="px-2 text-[10px] font-mono-plex text-[var(--ink-muted)] uppercase font-semibold">Role:</span>
              {[
                { label: "All", value: "all" },
                { label: "Internship", value: "internship" },
                { label: "Full-time", value: "full-time" },
                { label: "PPO", value: "ppo" },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setRoleType(item.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    roleType === item.value
                      ? "bg-[var(--surface)] text-[var(--ink)] font-semibold shadow-xs"
                      : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-[var(--surface-muted)] p-1 rounded-lg border border-[var(--border)] text-xs">
              <span className="px-2 text-[10px] font-mono-plex text-[var(--ink-muted)] uppercase font-semibold">Status:</span>
              {[
                { label: "All", value: "all" },
                { label: "Not Applied", value: "not_applied" },
                { label: "Applied", value: "applied" },
                { label: "Result", value: "result_out" },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setStatus(item.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    status === item.value
                      ? "bg-[var(--surface)] text-[var(--ink)] font-semibold shadow-xs"
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
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10 text-center max-w-md mx-auto my-8 space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center mx-auto">
            <Briefcase className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-[var(--ink)]">
            No Opportunities Found
          </h2>
          <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
            {search || roleType !== "all" || status !== "all"
              ? "No opportunities match your current filter criteria. Try resetting search filters."
              : "Connect your college placement Gmail account to extract placement drives, packages, and deadlines automatically."}
          </p>
          <div className="pt-2">
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--ink)] text-white hover:bg-[var(--accent)] transition-colors text-xs font-semibold shadow-xs"
            >
              <span>Connect Gmail Account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}
