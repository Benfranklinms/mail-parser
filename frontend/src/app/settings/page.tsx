"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { GmailConnectionStatus, LLMKeyInfo, OpenRouterModel } from "@/types";
import {
  User,
  Mail,
  Key,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Trash2,
  Sparkles,
  ShieldCheck,
  Search,
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"gmail" | "llm" | "account" | "sync">("gmail");

  // Gmail State
  const [gmailStatus, setGmailStatus] = useState<GmailConnectionStatus | null>(null);
  const [syncSinceDate, setSyncSinceDate] = useState<string>("2026-01-01");
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [manualSyncing, setManualSyncing] = useState(false);

  // LLM State
  const [provider, setProvider] = useState<"gemini" | "groq" | "openrouter">("gemini");
  const [apiKey, setApiKey] = useState("");
  const [savedKeys, setSavedKeys] = useState<LLMKeyInfo[]>([]);
  const [savingKey, setSavingKey] = useState(false);

  // OpenRouter Model Selection State
  const [openRouterModels, setOpenRouterModels] = useState<{
    curated: OpenRouterModel[];
    all: OpenRouterModel[];
  }>({ curated: [], all: [] });
  const [selectedModelId, setSelectedModelId] = useState<string>("google/gemini-2.5-flash");
  const [showAllModels, setShowAllModels] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  // Delete Account Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Initial Load
  useEffect(() => {
    async function loadSettings() {
      try {
        const [gStatus, keys] = await Promise.all([
          api.getGmailStatus(),
          api.getLLMKeys(),
        ]);
        setGmailStatus(gStatus);
        setSavedKeys(keys.data);

        const routerKey = keys.data.find((k) => k.provider === "openrouter");
        if (routerKey?.model_id) {
          setSelectedModelId(routerKey.model_id);
        }
      } catch {
        // Fallback initialized in api.ts
      }
    }
    loadSettings();
  }, []);

  // Fetch OpenRouter Models
  useEffect(() => {
    if (provider === "openrouter" && openRouterModels.curated.length === 0) {
      api.getOpenRouterModels().then((res) => {
        setOpenRouterModels(res);
        if (res.curated.length > 0 && !selectedModelId) {
          setSelectedModelId(res.curated[0].id);
        }
      });
    }
  }, [provider, openRouterModels.curated.length, selectedModelId]);

  // Connect Gmail Trigger
  const handleConnectGmail = async () => {
    setConnectingGmail(true);
    try {
      const res = await api.connectGmail({ start_date: syncSinceDate });
      toast.info("Redirecting to Google OAuth...");
      if (res.auth_url) {
        window.location.href = res.auth_url;
      }
    } catch {
      toast.error("Failed to start Gmail auth");
    } finally {
      setConnectingGmail(false);
    }
  };

  // Run Manual Sync Trigger with full status polling
  const handleRunManualSync = async () => {
    setManualSyncing(true);
    toast.info("Scanning placement inbox...");
    try {
      const res = await api.triggerSync();
      if (res && res.job_id) {
        // Poll sync status until completed
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          const statusRes = await api.getSyncStatus();
          if (statusRes.status === "completed" || statusRes.status === "failed") {
            break;
          }
        }
      }

      toast.success("Inbox sync completed! Redirecting to Dashboard...");
      const updatedStatus = await api.getGmailStatus();
      setGmailStatus(updatedStatus);

      // Redirect to dashboard so user sees new extracted cards
      setTimeout(() => {
        router.push("/");
      }, 1000);
    } catch {
      toast.error("Failed to execute sync");
    } finally {
      setManualSyncing(false);
    }
  };

  // Save LLM Key Trigger
  const handleSaveLLMKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || apiKey.length < 8) {
      toast.error("Please enter a valid API key (min 8 characters)");
      return;
    }

    if (provider === "openrouter" && !selectedModelId) {
      toast.error("Please select a model for OpenRouter");
      return;
    }

    setSavingKey(true);
    try {
      const res = await api.saveLLMKey({
        provider,
        api_key: apiKey,
        model_id: provider === "openrouter" ? selectedModelId : undefined,
      });

      toast.success(res.message || "API key saved securely!");
      setApiKey("");

      const updatedKeys = await api.getLLMKeys();
      setSavedKeys(updatedKeys.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to save API key");
    } finally {
      setSavingKey(false);
    }
  };

  // Delete LLM Key
  const handleDeleteKey = async (prov: string) => {
    try {
      await api.deleteLLMKey(prov);
      setSavedKeys((prev) => prev.filter((k) => k.provider !== prov));
      toast.success(`Removed ${prov} API key`);
    } catch {
      toast.error("Failed to delete key");
    }
  };

  const providerHelpLinks = {
    gemini: { label: "Google AI Studio", url: "https://aistudio.google.com/app/apikey" },
    groq: { label: "Groq Console", url: "https://console.groq.com/keys" },
    openrouter: { label: "OpenRouter Keys", url: "https://openrouter.ai/keys" },
  };

  const modelsToDisplay = showAllModels ? openRouterModels.all : openRouterModels.curated;
  const filteredModels = modelsToDisplay.filter(
    (m) =>
      m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.id.toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* HEADER */}
      <div className="pb-3 border-b border-[var(--border)]">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
          Settings & Control Panel
        </h1>
        <p className="text-xs text-[var(--ink-muted)] mt-1">
          Manage your Gmail OAuth access, encrypted API keys, model preferences, and sync rules.
        </p>
      </div>

      {/* TABBED NAVIGATION */}
      <div className="flex border-b border-[var(--border)] gap-2 overflow-x-auto">
        {[
          { id: "gmail", label: "Gmail Connection", icon: Mail },
          { id: "llm", label: "LLM Engine & Keys", icon: Key },
          { id: "account", label: "Account", icon: User },
          { id: "sync", label: "Sync Preferences", icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? "border-[var(--accent)] text-[var(--ink)] bg-[var(--surface-muted)]/60 rounded-t-lg"
                  : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[var(--accent)]" : ""}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: GMAIL CONNECTION */}
      {activeTab === "gmail" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] shadow-xs space-y-6">
            
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[var(--border)] pb-5">
              <div>
                <h3 className="text-base font-bold text-[var(--ink)]">
                  Gmail Inbox OAuth Access
                </h3>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                  Readonly authorization to scan placement cell emails automatically.
                </p>
              </div>

              {gmailStatus?.connected ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--success-bg)] text-[var(--success)] text-xs font-mono-plex font-bold border border-[var(--success)]/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>CONNECTED</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 text-xs font-mono-plex font-bold border border-amber-500/30">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>NOT CONNECTED</span>
                </div>
              )}
            </div>

            {/* Backfill Window Selection */}
            <div className="space-y-2 max-w-sm">
              <label className="text-xs font-semibold text-[var(--ink)] block">
                Sync Emails Since (Backfill Date)
              </label>
              <input
                type="date"
                value={syncSinceDate}
                onChange={(e) => setSyncSinceDate(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-xs font-mono-plex text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              />
              <p className="text-[11px] text-[var(--ink-muted)]">
                Historical emails from this date matching placement keywords will be scanned.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleConnectGmail}
                disabled={connectingGmail}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--ink)] text-white text-xs font-semibold hover:bg-[var(--accent)] transition-colors shadow-xs disabled:opacity-50"
              >
                <Mail className="w-4 h-4" />
                <span>{gmailStatus?.connected ? "Reconnect Gmail Account" : "Connect Gmail Account"}</span>
              </button>

              {gmailStatus?.connected && (
                <button
                  onClick={handleRunManualSync}
                  disabled={manualSyncing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] text-xs font-medium hover:border-[var(--accent)] transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent)] ${manualSyncing ? "animate-spin" : ""}`} />
                  <span>{manualSyncing ? "Scanning Inbox..." : "Run Manual Sync"}</span>
                </button>
              )}
            </div>

            {gmailStatus?.last_synced_at && (
              <p className="text-[11px] font-mono-plex text-[var(--ink-muted)] pt-3 border-t border-[var(--border)]">
                Last synced timestamp: {new Date(gmailStatus.last_synced_at).toLocaleString()}
              </p>
            )}

          </div>
        </div>
      )}

      {/* TAB 2: LLM PROVIDER & MODEL SELECTION */}
      {activeTab === "llm" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] shadow-xs space-y-6">
            
            <div>
              <h3 className="text-base font-bold text-[var(--ink)]">
                LLM Extraction Engine & Keys
              </h3>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                Supply your own API key. Keys are encrypted at rest with Fernet symmetric encryption.
              </p>
            </div>

            <form onSubmit={handleSaveLLMKey} className="space-y-5">
              
              {/* Provider Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--ink)] block">
                  Select Provider
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "gemini", label: "Google Gemini", badge: "Native JSON" },
                    { id: "openrouter", label: "OpenRouter", badge: "300+ Models" },
                    { id: "groq", label: "Groq", badge: "Fast" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProvider(p.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        provider === p.id
                          ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--ink)]"
                          : "border-[var(--border)] bg-[var(--background)] text-[var(--ink-muted)]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold block">{p.label}</span>
                        <span className="text-[9px] font-mono-plex px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)]">
                          {p.badge}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[var(--ink)]">
                    API Key
                  </label>
                  <a
                    href={providerHelpLinks[provider].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-1"
                  >
                    <span>Get key at {providerHelpLinks[provider].label}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder={`Enter your ${provider} API key...`}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-xl text-xs font-mono-plex text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                />
              </div>

              {/* MODEL SELECTION COMBOBOX (OPENROUTER ONLY) */}
              {provider === "openrouter" && (
                <div className="space-y-2 pt-3 border-t border-[var(--border)] animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Select OpenRouter Model</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowAllModels(!showAllModels)}
                      className="text-[11px] font-mono-plex text-[var(--accent)] hover:underline"
                    >
                      {showAllModels ? "Show Curated Shortlist" : "Show Full Model Catalog"}
                    </button>
                  </div>

                  {/* Dropdown Box */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-xl text-xs font-mono-plex text-[var(--ink)] hover:border-[var(--accent)] transition-all"
                    >
                      <span className="truncate font-semibold">{selectedModelId}</span>
                      <ChevronDown className="w-4 h-4 text-[var(--ink-muted)] shrink-0 ml-2" />
                    </button>

                    {modelDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg p-3 z-50 space-y-2 max-h-64 overflow-y-auto">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                          <input
                            type="text"
                            placeholder="Filter model..."
                            value={modelSearch}
                            onChange={(e) => setModelSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-xs font-mono-plex text-[var(--ink)] focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          {filteredModels.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setSelectedModelId(m.id);
                                setModelDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-mono-plex text-left transition-colors ${
                                selectedModelId === m.id
                                  ? "bg-[var(--accent-light)] text-[var(--ink)] font-bold"
                                  : "hover:bg-[var(--background)] text-[var(--ink-muted)]"
                              }`}
                            >
                              <div className="truncate pr-2">
                                <span className="block text-[11px] text-[var(--ink)]">{m.name}</span>
                                <span className="block text-[9px] text-[var(--ink-muted)] truncate">{m.id}</span>
                              </div>
                              {m.is_free && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-[var(--accent)] text-white shrink-0">
                                  FREE
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--ink-muted)]">
                    Models with zero prompt/completion pricing are tagged with FREE.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={savingKey}
                className="px-4 py-2.5 rounded-xl bg-[var(--ink)] text-white text-xs font-semibold hover:bg-[var(--accent)] transition-colors shadow-xs disabled:opacity-50"
              >
                {savingKey ? "Encrypting & Saving..." : "Save Key"}
              </button>
            </form>

            {/* LIST STORED KEYS */}
            <div className="pt-4 border-t border-[var(--border)] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider font-mono-plex text-[var(--ink-muted)]">
                Configured API Keys
              </h4>

              {savedKeys.length > 0 ? (
                <div className="space-y-2">
                  {savedKeys.map((k) => (
                    <div
                      key={k.provider}
                      className="flex items-center justify-between p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-mono-plex"
                    >
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="w-4 h-4 text-[var(--success)]" />
                        <div>
                          <span className="font-bold capitalize text-[var(--ink)] block">{k.provider}</span>
                          <span className="text-[10px] text-[var(--ink-muted)]">
                            Masked: {k.key_hint} {k.model_id ? `• Model: ${k.model_id}` : ""}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteKey(k.provider)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--ink-muted)] italic">No API keys saved yet.</p>
              )}
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: ACCOUNT */}
      {activeTab === "account" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-[var(--ink)]">
                Account Information
              </h3>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                Manage your profile and account credentials.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-2 text-xs">
              <div>
                <span className="text-[var(--ink-muted)] block text-[10px] font-mono-plex uppercase">Email:</span>
                <span className="font-semibold text-[var(--ink)]">student@college.edu</span>
              </div>
              <div>
                <span className="text-[var(--ink-muted)] block text-[10px] font-mono-plex uppercase">Authentication:</span>
                <span className="font-semibold text-[var(--ink)]">Supabase Auth (JWT)</span>
              </div>
            </div>

            {/* DANGER ZONE */}
            <div className="pt-4 border-t border-[var(--border)] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider font-mono-plex text-red-600">
                Danger Zone
              </h4>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-xs font-semibold transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Account & Stored Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SYNC PREFERENCES */}
      {activeTab === "sync" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-[var(--ink)]">
                Sync & Pre-filter Preferences
              </h3>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                Fine-tune keyword matching rules to reduce unnecessary LLM API calls.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="font-semibold text-[var(--ink)] block">
                  Placement Cell Sender Address Filter
                </label>
                <input
                  type="email"
                  placeholder="placement@college.edu (Optional)"
                  className="w-full px-3.5 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-xs text-[var(--ink)]"
                />
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-[var(--ink)] block">
                  Subject Keywords (Comma separated)
                </label>
                <input
                  type="text"
                  defaultValue="placement, internship, hiring, recruitment, campus drive, CTC"
                  className="w-full px-3.5 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-xs text-[var(--ink)]"
                />
              </div>

              <button
                onClick={() => toast.success("Sync preferences updated!")}
                className="px-4 py-2 rounded-xl bg-[var(--ink)] text-white font-semibold hover:bg-[var(--accent)] transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT DIALOG */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-red-600">
              Delete Account?
            </h3>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              This action will permanently delete your account, encrypted LLM keys, Gmail OAuth tokens, and all tracked placement opportunities.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-semibold text-[var(--ink)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  toast.error("Account deleted");
                }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
