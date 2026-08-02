import {
  Opportunity,
  OpportunitiesResponse,
  SyncStatus,
  GmailConnectionStatus,
  LLMKeyInfo,
  OpenRouterModelsResponse,
  ApplicationStatus,
  RoleType,
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

// Mock data for preview/demo fallback
const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: "opp-1",
    user_id: "user-123",
    company: "Google",
    role: "Software Engineering Intern",
    role_type: "internship",
    salary_or_stipend: "₹1,25,000/month",
    bond: "None",
    last_date: "15/08/2026",
    register_links: [
      "https://careers.google.com/jobs/results/12345",
      "https://forms.gle/googleInternship2026",
    ],
    raw_email_ref: "msg-101",
    extraction_method: "hybrid",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    application_status: "not_applied",
    applied_at: null,
  },
  {
    id: "opp-2",
    user_id: "user-123",
    company: "Tata Consultancy Services",
    role: "Ninja / Digital Developer",
    role_type: "full-time",
    salary_or_stipend: "7.0 LPA",
    bond: "2 years",
    last_date: "05/08/2026", // Close deadline (within 3 days)
    register_links: ["https://forms.gle/tcsDigitalDrive2026"],
    raw_email_ref: "msg-102",
    extraction_method: "regex",
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    application_status: "applied",
    applied_at: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: "opp-3",
    user_id: "user-123",
    company: "Zomato",
    role: "Product Management Intern",
    role_type: "ppo",
    salary_or_stipend: "₹45,000/month",
    bond: "None",
    last_date: "20/08/2026",
    register_links: [
      "https://unstop.com/o/zomato-pm-drive",
      "https://docs.google.com/forms/d/e/zomato",
    ],
    raw_email_ref: "msg-103",
    extraction_method: "llm",
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    application_status: "not_applied",
    applied_at: null,
  },
  {
    id: "opp-4",
    user_id: "user-123",
    company: "Microsoft",
    role: "SDE 1 (Campus Hiring)",
    role_type: "full-time",
    salary_or_stipend: "18.5 LPA",
    bond: "1 year",
    last_date: "03/08/2026", // Imminent deadline
    register_links: ["https://careers.microsoft.com/us/en/job/98765"],
    raw_email_ref: "msg-104",
    extraction_method: "hybrid",
    created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 72).toISOString(),
    application_status: "result_out",
    applied_at: new Date(Date.now() - 3600000 * 60).toISOString(),
  },
  {
    id: "opp-5",
    user_id: "user-123",
    company: "Atlassian",
    role: "Frontend Developer Trainee",
    role_type: "internship",
    salary_or_stipend: "₹85,000/month",
    bond: "None",
    last_date: "28/08/2026",
    register_links: ["https://jobs.lever.co/atlassian/intern"],
    raw_email_ref: "msg-105",
    extraction_method: "regex",
    created_at: new Date(Date.now() - 3600000 * 96).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 96).toISOString(),
    application_status: "not_applied",
    applied_at: null,
  },
];

let inMemoryOpportunities = [...MOCK_OPPORTUNITIES];

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("supabase_token") || "demo-jwt-token";
  return { Authorization: `Bearer ${token}` };
}

export const api = {
  // Opportunities List
  async getOpportunities(filters?: {
    role_type?: string;
    status?: string;
    search?: string;
  }): Promise<OpportunitiesResponse> {
    try {
      const params = new URLSearchParams();
      if (filters?.role_type && filters.role_type !== "all") {
        params.append("role_type", filters.role_type);
      }
      if (filters?.status && filters.status !== "all") {
        params.append("status", filters.status);
      }

      const res = await fetch(`${API_BASE_URL}/opportunities?${params.toString()}`, {
        headers: getAuthHeader(),
      });

      if (!res.ok) throw new Error("Failed to fetch opportunities");
      const data: OpportunitiesResponse = await res.json();
      
      if (filters?.search) {
        const query = filters.search.toLowerCase();
        data.data = data.data.filter(
          (o) =>
            o.company?.toLowerCase().includes(query) ||
            o.role?.toLowerCase().includes(query)
        );
      }
      return data;
    } catch {
      // Fallback to mock data if backend not running or unauthenticated
      let filtered = [...inMemoryOpportunities];
      if (filters?.role_type && filters.role_type !== "all") {
        filtered = filtered.filter((o) => o.role_type === filters.role_type);
      }
      if (filters?.status && filters.status !== "all") {
        filtered = filtered.filter((o) => o.application_status === filters.status);
      }
      if (filters?.search) {
        const query = filters.search.toLowerCase();
        filtered = filtered.filter(
          (o) =>
            o.company?.toLowerCase().includes(query) ||
            o.role?.toLowerCase().includes(query)
        );
      }
      return {
        data: filtered,
        pagination: {
          page: 1,
          per_page: 20,
          total: filtered.length,
          total_pages: 1,
        },
      };
    }
  },

  // Update Status
  async updateOpportunityStatus(
    id: string,
    status: ApplicationStatus
  ): Promise<{ status: ApplicationStatus }> {
    try {
      const res = await fetch(`${API_BASE_URL}/opportunities/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error("Failed to update status");
      const data = await res.json();
      return { status: data.status };
    } catch {
      // Update mock fallback state
      inMemoryOpportunities = inMemoryOpportunities.map((o) =>
        o.id === id
          ? {
              ...o,
              application_status: status,
              applied_at: status === "applied" ? new Date().toISOString() : o.applied_at,
            }
          : o
      );
      return { status };
    }
  },

  // Gmail Connection Status
  async getGmailStatus(): Promise<GmailConnectionStatus> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/gmail/status`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Failed to fetch Gmail status");
      return await res.json();
    } catch {
      return {
        connected: true,
        last_synced_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        connected_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      };
    }
  },

  // Initiate Gmail OAuth
  async connectGmail(params?: { start_date?: string; sender_filter?: string }): Promise<{ auth_url: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/gmail/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(params || {}),
      });
      if (!res.ok) throw new Error("Failed to initialize Gmail OAuth");
      return await res.json();
    } catch {
      return { auth_url: "https://accounts.google.com/o/oauth2/v2/auth?mock=true" };
    }
  },

  // Sync Status Polling
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const res = await fetch(`${API_BASE_URL}/sync/status`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Failed to fetch sync status");
      return await res.json();
    } catch {
      return {
        status: "completed",
        total: 24,
        processed: 24,
        extracted: 18,
        filtered: 6,
        errors: 0,
        completed_at: new Date().toISOString(),
      };
    }
  },

  // Trigger Sync (Incremental or Backfill with start_date)
  async triggerSync(params?: { start_date?: string }): Promise<SyncStatus> {
    try {
      const res = await fetch(`${API_BASE_URL}/sync/trigger`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(params || {}),
      });
      if (!res.ok) throw new Error("Failed to trigger sync");
      return await res.json();
    } catch {
      return {
        job_id: "mock-job-99",
        status: "processing",
        total: 5,
        processed: 0,
      };
    }
  },

  // Save LLM Key
  async saveLLMKey(params: {
    provider: "gemini" | "groq" | "openrouter";
    api_key: string;
    model_id?: string;
  }): Promise<{ message: string; key_hint: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/llm-keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save API key");
      }
      return await res.json();
    } catch (e: any) {
      if (e.message) throw e;
      return {
        message: `API key saved for ${params.provider}`,
        key_hint: `****${params.api_key.slice(-4)}`,
      };
    }
  },

  // Get Configured LLM Keys
  async getLLMKeys(): Promise<{ data: LLMKeyInfo[] }> {
    try {
      const res = await fetch(`${API_BASE_URL}/llm-keys`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Failed to fetch LLM keys");
      return await res.json();
    } catch {
      return {
        data: [
          {
            provider: "gemini",
            key_hint: "****98a2",
            created_at: new Date().toISOString(),
            supported: true,
          },
        ],
      };
    }
  },

  // Delete LLM Key
  async deleteLLMKey(provider: string): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/llm-keys/${provider}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
    } catch {
      // Mock fallback
    }
  },

  // Get OpenRouter Models List
  async getOpenRouterModels(): Promise<OpenRouterModelsResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/llm-keys/openrouter/models`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Failed to fetch OpenRouter models");
      return await res.json();
    } catch {
      return {
        curated: [
          { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", is_free: false },
          { id: "meta-llama/llama-3.1-8b-instruct:free", name: "Llama 3.1 8B Instruct", is_free: true },
          { id: "google/gemma-2-9b-it:free", name: "Gemma 2 9B IT", is_free: true },
          { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", is_free: false },
        ],
        all: [
          { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", is_free: false },
          { id: "meta-llama/llama-3.1-8b-instruct:free", name: "Llama 3.1 8B Instruct", is_free: true },
          { id: "google/gemma-2-9b-it:free", name: "Gemma 2 9B IT", is_free: true },
          { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", is_free: false },
          { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1", is_free: true },
          { id: "mistralai/mistral-7b-instruct:free", name: "Mistral 7B Instruct", is_free: true },
          { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", is_free: false },
        ],
      };
    }
  },
};
