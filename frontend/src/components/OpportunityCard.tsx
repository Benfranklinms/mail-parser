"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Opportunity, ApplicationStatus } from "@/types";
import { ExternalLink, Calendar, ShieldAlert, CheckCircle2, Clock, Award } from "lucide-react";

interface OpportunityCardProps {
  opportunity: Opportunity;
  onStatusChange: (id: string, newStatus: ApplicationStatus) => void;
}

export function OpportunityCard({ opportunity, onStatusChange }: OpportunityCardProps) {
  const [isStamping, setIsStamping] = useState(false);

  const {
    id,
    company,
    role,
    role_type,
    salary_or_stipend,
    bond,
    last_date,
    register_links,
    application_status,
  } = opportunity;

  // Deadline urgency check (within 3 days or past)
  const isUrgent = () => {
    if (!last_date) return false;
    try {
      const parts = last_date.split("/");
      let d: Date;
      if (parts.length === 3) {
        d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      } else {
        d = new Date(last_date);
      }
      const now = new Date();
      const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 3600 * 24));
      return diffDays <= 3 && diffDays >= -1;
    } catch {
      return false;
    }
  };

  const urgent = isUrgent();

  // Cycle status on stamp click
  const handleStampClick = () => {
    setIsStamping(true);
    setTimeout(() => setIsStamping(false), 220);

    const statusCycle: Record<ApplicationStatus, ApplicationStatus> = {
      not_applied: "applied",
      applied: "result_out",
      result_out: "not_applied",
    };

    onStatusChange(id, statusCycle[application_status]);
  };

  // Stamp badge styling map
  const stampConfig = {
    not_applied: {
      label: "NOT APPLIED",
      classes: "text-[var(--ink-muted)] border-[var(--ink-muted)]/40 bg-[var(--background)]",
      icon: Clock,
    },
    applied: {
      label: "APPLIED",
      classes: "text-[var(--success)] border-[var(--success)] bg-[var(--success-bg)]",
      icon: CheckCircle2,
    },
    result_out: {
      label: "RESULT OUT",
      classes: "text-[var(--accent)] border-[var(--accent)] bg-[var(--accent)]/10",
      icon: Award,
    },
  }[application_status];

  const StampIcon = stampConfig.icon;

  const roleTypeBadgeClass = {
    internship: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    "full-time": "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    ppo: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    unclear: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
  }[role_type || "unclear"];

  return (
    <div className="ticket-container flex flex-col sm:flex-row w-full group">
      
      {/* LEFT MAIN PANEL */}
      <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between space-y-4">
        <div>
          {/* Header Row: Company Name + Role Type Badge */}
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="font-fraunces-display text-xl font-bold text-[var(--ink)] tracking-tight group-hover:text-[var(--accent)] transition-colors">
              {company || "Unspecified Company"}
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-plex uppercase tracking-wider font-semibold border ${roleTypeBadgeClass}`}>
              {role_type}
            </span>
          </div>

          {/* Role Title */}
          <p className="text-sm font-semibold text-[var(--ink-muted)] mb-3">
            {role || "General Opportunity"}
          </p>

          {/* Details Pill Grid: Salary & Bond */}
          <div className="flex flex-wrap gap-2 text-xs">
            {salary_or_stipend && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[var(--background)] border border-[var(--border)] font-mono-plex font-medium text-[var(--ink)]">
                💰 {salary_or_stipend}
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[var(--background)] border border-[var(--border)] font-mono-plex text-[var(--ink-muted)]">
              🔒 Bond: {bond || "None"}
            </span>
          </div>
        </div>

        {/* Action Buttons: Links */}
        <div className="pt-2 flex flex-wrap items-center gap-2">
          {register_links && register_links.length > 0 ? (
            register_links.map((link, idx) => {
              const label =
                link.includes("forms.gle") || link.includes("docs.google.com/forms")
                  ? "Application Form"
                  : link.includes("careers") || link.includes("job")
                  ? "JD Link"
                  : `Link ${idx + 1}`;

              return (
                <a
                  key={idx}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--ink)] text-[var(--surface)] hover:bg-[var(--accent)] transition-colors text-xs font-medium"
                >
                  <span>{label}</span>
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
              );
            })
          ) : (
            <span className="text-xs text-[var(--ink-muted)] italic">No direct links attached</span>
          )}
        </div>
      </div>

      {/* PERFORATION SEPARATOR WITH NOTCHES */}
      <div className="relative hidden sm:block w-px my-2">
        <div className="perforation-line" />
        <div className="ticket-notch-top -left-[6px]" />
        <div className="ticket-notch-bottom -left-[6px]" />
      </div>

      {/* Mobile Horizontal Divider */}
      <div className="sm:hidden border-t border-dashed border-[var(--border)] relative w-full">
        <div className="absolute -top-[7px] -left-[7px] w-[14px] h-[14px] bg-[var(--background)] rounded-full border border-[var(--border)]" />
        <div className="absolute -top-[7px] -right-[7px] w-[14px] h-[14px] bg-[var(--background)] rounded-full border border-[var(--border)]" />
      </div>

      {/* RIGHT STUB PANEL */}
      <div className="w-full sm:w-44 bg-[var(--background)]/40 p-4 sm:p-5 flex flex-row sm:flex-col justify-between items-center text-center border-t sm:border-t-0 border-[var(--border)]">
        
        {/* Monospace Departure / Deadline Time */}
        <div className="text-left sm:text-center">
          <span className="text-[10px] font-mono-plex uppercase tracking-wider text-[var(--ink-muted)] block mb-0.5">
            DEPARTURE / DEADLINE
          </span>
          <div className="flex items-center gap-1 sm:justify-center">
            <Calendar className={`w-3.5 h-3.5 ${urgent ? "text-amber-600 dark:text-amber-400" : "text-[var(--ink-muted)]"}`} />
            <span
              className={`font-mono-plex text-xs font-semibold ${
                urgent ? "text-amber-600 dark:text-amber-400 font-bold animate-pulse" : "text-[var(--ink)]"
              }`}
            >
              {last_date || "N/A"}
            </span>
          </div>
          {urgent && (
            <span className="text-[9px] font-mono-plex text-amber-600 dark:text-amber-400 block mt-0.5">
              ⚠️ CLOSING SOON
            </span>
          )}
        </div>

        {/* STAMP BADGE WITH ROTATING CLICK ANIMATION */}
        <motion.button
          onClick={handleStampClick}
          animate={isStamping ? { scale: [1, 1.18, 1], rotate: [0, -4, 0] } : { scale: 1, rotate: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          title="Click to update status"
          className={`stamp-badge transition-all hover:scale-105 cursor-pointer ${stampConfig.classes}`}
        >
          <StampIcon className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{stampConfig.label}</span>
        </motion.button>

      </div>

    </div>
  );
}
