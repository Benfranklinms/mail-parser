"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { OpenRouterModel } from "@/types";
import { Key, Sparkles, ChevronDown, Search, ExternalLink, ShieldCheck } from "lucide-react";

export function LLMKeyModal() {
  const { hasLLMKey, setHasLLMKey, isAuthenticated } = useAuth();
  const [provider, setProvider] = useState<"gemini" | "groq" | "openrouter">("gemini");
  const [apiKey, setApiKey] = useState("");
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

  // Fetch OpenRouter Models if provider is openrouter
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

  if (!isAuthenticated || hasLLMKey) {
    return null;
  }

  const handleSave = async (e: React.FormEvent) => {
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
      await api.saveLLMKey({
        provider,
        api_key: apiKey,
        model_id: provider === "openrouter" ? selectedModelId : undefined,
      });

      toast.success("API key saved securely!");
      setHasLLMKey(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to save API key");
    } finally {
      setSavingKey(false);
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="space-y-2">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center">
            <Key className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-[var(--ink)]">
            Setup Your LLM API Key
          </h2>
          <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
            To extract structured placement details from emails, please add your LLM API key. Keys are encrypted at rest with Fernet symmetric encryption.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-5">
          
          {/* Select Provider */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--ink)] block">
              Select Provider
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { id: "gemini", label: "Google Gemini", badge: "Free Tier" },
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
                  <span className="text-xs font-bold block">{p.label}</span>
                  <span className="text-[9px] font-mono-plex text-[var(--ink-muted)] block mt-0.5">
                    {p.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-1.5">
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
              required
            />
          </div>

          {/* OpenRouter Model Combobox */}
          {provider === "openrouter" && (
            <div className="space-y-2 pt-2 border-t border-[var(--border)]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Select Model</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAllModels(!showAllModels)}
                  className="text-[11px] font-mono-plex text-[var(--accent)] hover:underline"
                >
                  {showAllModels ? "Show Shortlist" : "Show All Models"}
                </button>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-xl text-xs font-mono-plex text-[var(--ink)] hover:border-[var(--accent)]"
                >
                  <span className="truncate font-semibold">{selectedModelId}</span>
                  <ChevronDown className="w-4 h-4 text-[var(--ink-muted)] shrink-0 ml-2" />
                </button>

                {modelDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg p-2.5 z-50 space-y-2 max-h-56 overflow-y-auto">
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
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={savingKey}
            className="w-full py-3 rounded-xl bg-[var(--ink)] text-white text-xs font-semibold hover:bg-[var(--accent)] transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{savingKey ? "Encrypting Key..." : "Save Key & Continue to Dashboard"}</span>
          </button>
        </form>

      </div>
    </div>
  );
}
