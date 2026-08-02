"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Opportunity, ApplicationStatus } from "@/types";
import { ExternalLink, Calendar, CheckCircle2, Clock, Award, Banknote, Shield, AlertCircle, Tag } from "lucide-react";

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
    slot,
    last_date,
    register_links,
    application_status,
  } = opportunity;

  // Deadline urgency check
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

  const stampConfig = {
    not_applied: {
      label: "NOT APPLIED",
      classes: "text-[var(--ink-muted)] border-[var(--border)] bg-[var(--surface-muted)]",
      icon: Clock,
    },
    applied: {
      label: "APPLIED",
      classes: "text-[var(--success)] border-[var(--success)]/40 bg-[var(--success-bg)]",
      icon: CheckCircle2,
    },
    result_out: {
      label: "RESULT OUT",
      classes: "text-[var(--accent)] border-[var(--accent)]/40 bg-[var(--accent-light)]",
      icon: Award,
    },
  }[application_status];

  const StampIcon = stampConfig.icon;

  const roleTypeConfig = {
    internship: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    "full-time": "bg-[var(--accent-light)] text-[var(--accent)] border-[var(--accent)]/20",
    ppo: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    unclear: "bg-[var(--surface-muted)] text-[var(--ink-muted)] border-[var(--border)]",
  }[role_type || "unclear"];

  return (
    <div className="ticket-container flex flex-col sm:flex-row w-full group claude-card">
      
      {/* LEFT MAIN PANEL */}
      <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between space-y-4">
        <div>
          {/* Header Row: Company Name + Role Type Badge */}
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <h3 className="font-bold text-lg text-[var(--ink)] tracking-tight group-hover:text-[var(--accent)] transition-colors">
              {company || "Unspecified Company"}
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-plex uppercase tracking-wider font-semibold border ${roleTypeConfig}`}>
              {role_type}
            </span>
          </div>

          {/* Role Title */}
          <p className="text-xs font-semibold text-[var(--ink-muted)] mb-3">
            {role || "General Placement Drive"}
          </p>

          {/* Details Pill Grid: Salary, Slot & Bond */}
          <div className="flex flex-wrap gap-2 text-xs">
            {salary_or_stipend && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--surface-muted)] border border-[var(--border)] font-mono-plex font-medium text-[var(--ink)] text-[11px]">
                <Banknote className="w-3 h-3 text-[var(--ink-muted)]" />
                <span>{salary_or_stipend}</span>
              </span>
            )}
            {slot && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--accent-light)] border border-[var(--accent)]/30 font-mono-plex text-[var(--accent)] text-[11px] font-semibold">
                <Tag className="w-3 h-3 text-[var(--accent)]" />
                <span>Slot: {slot}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--surface-muted)] border border-[var(--border)] font-mono-plex text-[var(--ink-muted)] text-[11px]">
              <Shield className="w-3 h-3 text-[var(--ink-muted)]" />
              <span>Bond: {bond || "None"}</span>
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
                  ? "JD Document"
                  : `Link ${idx + 1}`;

              return (
                <a
                  key={idx}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--ink)] text-white hover:bg-[var(--accent)] transition-colors text-xs font-medium shadow-xs"
                >
                  <span>{label}</span>
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
              );
            })
          ) : (
            <span className="text-xs text-[var(--ink-light)] italic">No external links attached</span>
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
      <div className="w-full sm:w-44 bg-[var(--surface-muted)]/50 p-4 sm:p-5 flex flex-row sm:flex-col justify-between items-center text-center border-t sm:border-t-0 border-[var(--border)]">
        
        {/* Monospace Departure / Deadline Time */}
        <div className="text-left sm:text-center">
          <span className="text-[10px] font-mono-plex uppercase tracking-wider text-[var(--ink-muted)] block mb-0.5 font-semibold">
            DEADLINE
          </span>
          <div className="flex items-center gap-1 sm:justify-center">
            <Calendar className={`w-3.5 h-3.5 ${urgent ? "text-[var(--accent)]" : "text-[var(--ink-muted)]"}`} />
            <span
              className={`font-mono-plex text-xs font-semibold ${
                urgent ? "text-[var(--accent)] font-bold animate-pulse" : "text-[var(--ink)]"
              }`}
            >
              {last_date || "N/A"}
            </span>
          </div>
          {urgent && (
            <span className="text-[9px] font-mono-plex text-[var(--accent)] font-bold block mt-0.5 flex items-center justify-center gap-1">
              <AlertCircle className="w-2.5 h-2.5" />
              <span>CLOSING SOON</span>
            </span>
          )}
        </div>

        {/* STAMP BADGE WITH ROTATING CLICK ANIMATION */}
        <motion.button
          onClick={handleStampClick}
          animate={isStamping ? { scale: [1, 1.18, 1], rotate: [0, -4, 0] } : { scale: 1, rotate: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          title="Click to toggle status"
          className={`stamp-badge transition-all hover:scale-105 cursor-pointer shadow-xs ${stampConfig.classes}`}
        >
          <StampIcon className="w-3.5 h-3.5 stroke-[2.2]" />
          <span>{stampConfig.label}</span>
        </motion.button>

      </div>

    </div>
  );
}
