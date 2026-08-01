export type RoleType = "internship" | "full-time" | "ppo" | "unclear";

export type ApplicationStatus = "not_applied" | "applied" | "result_out";

export type ExtractionMethod = "regex" | "llm" | "hybrid";

export interface Opportunity {
  id: string;
  user_id: string;
  company: string | null;
  role: string | null;
  role_type: RoleType;
  salary_or_stipend: string | null;
  bond: string | null;
  last_date: string | null;
  register_links: string[];
  raw_email_ref: string;
  extraction_method: ExtractionMethod;
  created_at: string;
  updated_at: string;
  application_status: ApplicationStatus;
  applied_at: string | null;
}

export interface OpportunitiesResponse {
  data: Opportunity[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface SyncStatus {
  job_id?: string;
  type?: "backfill" | "incremental";
  status: "processing" | "completed" | "failed" | "no_jobs" | "already_running";
  total?: number;
  processed?: number;
  extracted?: number;
  filtered?: number;
  errors?: number;
  started_at?: string;
  completed_at?: string | null;
  message?: string;
}

export interface GmailConnectionStatus {
  connected: boolean;
  last_synced_at?: string | null;
  connected_at?: string | null;
}

export interface LLMKeyInfo {
  provider: "gemini" | "groq" | "openrouter";
  key_hint: string;
  model_id?: string | null;
  created_at: string;
  supported: boolean;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  is_free: boolean;
}

export interface OpenRouterModelsResponse {
  curated: OpenRouterModel[];
  all: OpenRouterModel[];
}
