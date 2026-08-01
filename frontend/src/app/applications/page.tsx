"use client";

import { useState, useEffect } from "react";
import { Opportunity, ApplicationStatus } from "@/types";
import { api } from "@/lib/api";
import { OpportunityCard } from "@/components/OpportunityCard";
import { OpportunitySkeleton } from "@/components/OpportunitySkeleton";
import { toast } from "sonner";
import { CheckCircle2, Award, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ApplicationsPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await api.getOpportunities();
        // Filter out "not_applied"
        setOpportunities(res.data.filter((o) => o.application_status !== "not_applied"));
      } catch {
        toast.error("Failed to load applications");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleStatusChange = async (id: string, newStatus: ApplicationStatus) => {
    setOpportunities((prev) =>
      prev
        .map((o) => (o.id === id ? { ...o, application_status: newStatus } : o))
        .filter((o) => o.application_status !== "not_applied")
    );

    toast.success("Application status updated!");

    try {
      await api.updateOpportunityStatus(id, newStatus);
    } catch {
      toast.error("Failed to update status on server");
    }
  };

  const appliedOpps = opportunities.filter((o) => o.application_status === "applied");
  const resultOpps = opportunities.filter((o) => o.application_status === "result_out");

  return (
    <div className="space-y-8">
      
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <h1 className="font-fraunces-display text-3xl font-bold tracking-tight text-[var(--ink)]">
            Application Tracker
          </h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1">
            Track and manage your submitted placement drives and result announcements.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono-plex font-semibold">
          <span className="px-3 py-1.5 rounded-lg bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success)]/30">
            {appliedOpps.length} APPLIED
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30">
            {resultOpps.length} RESULTS OUT
          </span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <OpportunitySkeleton />
          <OpportunitySkeleton />
        </div>
      ) : opportunities.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-12 text-center max-w-md mx-auto my-12 space-y-4">
          <div className="w-14 h-14 rounded-full bg-[var(--success-bg)] text-[var(--success)] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="font-fraunces-display text-2xl font-bold text-[var(--ink)]">
            No Tracked Applications Yet
          </h2>
          <p className="text-xs text-[var(--ink-muted)]">
            Click the stamp badge on any opportunity card on your Dashboard to mark it as Applied.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--ink)] text-[var(--surface)] text-xs font-semibold hover:bg-[var(--accent)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          
          {/* SECTION 1: APPLIED */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold font-fraunces-display text-[var(--ink)]">
              <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
              <span>Applied Opportunities ({appliedOpps.length})</span>
            </div>

            {appliedOpps.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {appliedOpps.map((opp) => (
                  <OpportunityCard key={opp.id} opportunity={opp} onStatusChange={handleStatusChange} />
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-[var(--border)] text-center text-xs text-[var(--ink-muted)]">
                No active applications in progress.
              </div>
            )}
          </div>

          {/* SECTION 2: RESULT OUT */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold font-fraunces-display text-[var(--ink)]">
              <Award className="w-4 h-4 text-[var(--accent)]" />
              <span>Results & Decision Updates ({resultOpps.length})</span>
            </div>

            {resultOpps.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {resultOpps.map((opp) => (
                  <OpportunityCard key={opp.id} opportunity={opp} onStatusChange={handleStatusChange} />
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-[var(--border)] text-center text-xs text-[var(--ink-muted)]">
                No results declared yet.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
