# Placement Mail Tracker

> Transform messy, unstructured college placement emails into a clean, structured, and trackable opportunity dashboard.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=next.js&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38BDF8?style=flat-square&logo=tailwind-css&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.14-3776AB?style=flat-square&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=flat-square&logo=flask&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)

---

## Overview

College placement cell emails arrive in inconsistent, unstructured formats. Students manually parse through long email threads to find the company name, CTC/stipend, bond details, registration deadline, and application links — with no easy way to track what has already been applied to.

**Placement Mail Tracker** solves this inbox chaos by connecting directly to a student's Gmail account via OAuth, automatically extracting job/internship opportunity details using a **hybrid regex + LLM pipeline**, and displaying them as interactive **boarding-pass ticket cards** on a filterable dashboard.

---

## Key Features

- **Signature Boarding Pass UI**: Opportunities rendered as physical ticket stubs featuring a perforated dashed divider, monospace departure deadlines, and an interactive stamp animation when marking as *Applied*.
- **Claude Brand Aesthetic**: Styled with Anthropic's signature warm paper color palette (`#FAF7F2` canvas, `#D97757` terracotta accent, `#1F1E1B` dark charcoal ink) and modern sans typography (`Inter`).
- **Hybrid Regex + LLM Extraction**:
  - **Stage 1 (Pre-filter)**: Keyword heuristics filter out newsletters, exam notices, and circulars.
  - **Stage 2 (Regex Pass)**: Extracts CTC (`6 LPA`, `₹25,000/month`), registration deadlines, and application links (`forms.gle`, `greenhouse.io`, `lever.co`) instantly for free.
  - **Stage 3 (LLM Fallback)**: Uses LLMs to parse complex natural language fields (company, role, role type, bond) only when needed.
- **Bring-Your-Own-Key LLM Engine**: Supports **Google Gemini** natively and **OpenRouter** (accessing 300+ models with curated shortlists and `FREE` tier badges). Users supply their own API keys — the app itself never incurs LLM costs.
- **Background Sync Orchestration**: Historical backfill and ongoing incremental sync (via Gmail's `history.list` API) run asynchronously using Python thread pools without blocking the UI.
- **Bank-Grade Security**:
  - Gmail refresh tokens and LLM API keys are encrypted at rest using **Fernet symmetric encryption**.
  - All database access is protected by **Supabase Row Level Security (RLS)** using `auth.uid() = user_id`.

---

## Architecture & Tech Stack

```
                               ┌─────────────────────────┐
                               │   Next.js 14+ Frontend  │
                               │   (App Router, React)   │
                               └────────────┬────────────┘
                                            │ REST API
                               ┌────────────▼────────────┐
                               │   Flask Python Backend  │
                               └──────┬───────────┬──────┘
                                      │           │
           ┌──────────────────────────┴┐         ┌┴──────────────────────────┐
           │ Gmail API (OAuth2 Sync)   │         │ Supabase (Postgres + RLS) │
           └───────────────────────────┘         └───────────────────────────┘
```

### **Frontend**
- **Framework**: Next.js 14+ (App Router), TypeScript
- **Styling**: Tailwind CSS v4 (Claude/Anthropic custom color tokens)
- **Animation**: Framer Motion (staggered grid load, stamp-down micro-interactions)
- **Icons & Toast**: Lucide React, Sonner

### **Backend**
- **Framework**: Python 3.14, Flask, Flask-CORS
- **Database & Auth**: Supabase (PostgreSQL + RLS + JWT Verification via `PyJWT`)
- **Email Service**: `google-api-python-client` (OAuth2, Gmail Readonly Scope, `history.list`)
- **LLM Integrations**: `google-genai` SDK (Gemini 2.0 Flash) & OpenRouter OpenAI-compatible API
- **Encryption**: `cryptography.fernet`

---

## Database Schema

The Postgres database consists of 4 main tables with complete Row Level Security enabled:

```sql
-- 1. Gmail OAuth Tokens & Sync State
email_connections (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    encrypted_refresh_token TEXT NOT NULL,
    gmail_history_id TEXT,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)

-- 2. Encrypted User LLM Keys & Model Selection
llm_keys (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    provider llm_provider_enum NOT NULL, -- 'gemini', 'groq', 'openrouter'
    encrypted_api_key TEXT NOT NULL,
    key_last_four VARCHAR(4) NOT NULL,
    model_id TEXT DEFAULT NULL,           -- OpenRouter model ID selection
    created_at TIMESTAMPTZ
)

-- 3. Extracted Placement Opportunities
opportunities (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    company TEXT,
    role TEXT,
    role_type role_type_enum,            -- 'internship', 'full-time', 'ppo', 'unclear'
    salary_or_stipend TEXT,
    bond TEXT,
    last_date TEXT,
    register_links TEXT[],
    raw_email_ref TEXT NOT NULL,
    extraction_method extraction_method_enum, -- 'regex', 'llm', 'hybrid'
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)

-- 4. Application Status Tracking
applications (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    opportunity_id UUID REFERENCES opportunities(id),
    status application_status_enum NOT NULL, -- 'not_applied', 'applied', 'result_out'
    applied_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
```

---

## Getting Started

### Prerequisites
- **Python 3.10+** (Python 3.14 recommended)
- **Node.js 18+** and `npm`
- A **Supabase** account (Free tier)
- A **Google Cloud Console** project with Gmail API enabled

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/Benfranklinms/mail-parser.git
cd mail-parser
```

---

### Step 2: Set Up Database (Supabase)

1. Create a new project in [Supabase](https://supabase.com/).
2. Go to the **SQL Editor** tab in your Supabase Dashboard.
3. Run the initial schema migration:
   - Copy and execute [migrations/001_initial_schema.sql](file:///Users/benfranklin/Web%20devolpment/Projects/mail%20parser/migrations/001_initial_schema.sql)
4. Run the OpenRouter model selection migration:
   - Copy and execute [migrations/002_add_openrouter_model.sql](file:///Users/benfranklin/Web%20devolpment/Projects/mail%20parser/migrations/002_add_openrouter_model.sql)

---

### Step 3: Configure Google OAuth (Gmail API)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Gmail API**.
3. Configure the **OAuth Consent Screen** with scope: `https://www.googleapis.com/auth/gmail.readonly`.
4. Create **OAuth 2.0 Client ID credentials** (Web application type).
5. Add the redirect URI: `http://localhost:5000/auth/gmail/callback`.

> Need step-by-step help? Check the detailed [SETUP_GUIDE.md](file:///Users/benfranklin/Web%20devolpment/Projects/mail%20parser/SETUP_GUIDE.md).

---

### Step 4: Configure Environment Variables

1. Copy `.env.example` to `.env` in the root folder:

```bash
cp .env.example .env
```

2. Fill in your credentials:

```env
# Flask
FLASK_SECRET_KEY=your-generated-flask-secret
FLASK_ENV=development
FLASK_DEBUG=1

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret

# Fernet Secret Key (Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
FERNET_KEY=your-generated-fernet-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/gmail/callback
```

---

### Step 5: Run the Backend & Frontend

#### 1. Start the Flask Backend (Terminal 1)
```bash
# Create virtual environment & install requirements
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run server
python run.py
```
> Backend runs at: `http://localhost:5000`

#### 2. Start the Next.js Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```
> Frontend runs at: `http://localhost:3000`

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | No | Health check endpoint |
| `POST` | `/auth/gmail/connect` | Yes | Get Google OAuth consent URL |
| `GET` | `/auth/gmail/callback` | No | Google OAuth callback handler |
| `GET` | `/auth/gmail/status` | Yes | Check Gmail connection status |
| `GET` | `/sync/status` | Yes | Poll background sync progress |
| `POST` | `/sync/incremental` | Yes | Trigger incremental Gmail sync |
| `POST` | `/llm-keys` | Yes | Save/encrypt LLM key + model selection |
| `GET` | `/llm-keys` | Yes | List user's saved keys (masked) |
| `GET` | `/llm-keys/openrouter/models` | Yes | Fetch OpenRouter models (cached server-side) |
| `DELETE` | `/llm-keys/:provider` | Yes | Delete a saved LLM key |
| `GET` | `/opportunities` | Yes | List opportunities (search, filter, pagination) |
| `GET` | `/opportunities/:id` | Yes | Get single opportunity details |
| `PATCH` | `/opportunities/:id/status` | Yes | Update application status (`applied`, `not_applied`, `result_out`) |

---

## Testing

Run unit tests for the hybrid extraction pipeline and Fernet encryption module:

```bash
source venv/bin/activate
python -m pytest tests/ -v
```

```
======================== 52 passed in 0.87s =========================
```

---

## Repository Structure

```
mail-parser/
├── app/
│   ├── auth/                # Gmail OAuth & JWT auth middleware
│   ├── db/                  # Supabase client constructors (RLS & service role)
│   ├── llm_keys/            # LLM key management & OpenRouter model endpoints
│   ├── opportunities/       # Opportunities CRUD & status update routes
│   ├── services/            # Gmail, Encryption, LLM providers & Sync Manager
│   ├── sync/                # Background sync polling & trigger routes
│   ├── config.py            # Environment configuration
│   └── __init__.py          # Flask app factory & CORS configuration
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router (Dashboard, Applications, Settings)
│   │   ├── components/      # Boarding Pass OpportunityCard, Navbar, Skeletons
│   │   ├── lib/             # Typed API client with mock fallbacks
│   │   └── types/           # TypeScript interfaces & enums
│   ├── package.json
│   └── tailwind.config.ts
├── migrations/
│   ├── 001_initial_schema.sql
│   └── 002_add_openrouter_model.sql
├── tests/
│   ├── test_encryption.py
│   └── test_extraction.py
├── .env.example
├── README.md
├── SETUP_GUIDE.md
├── requirements.txt
└── run.py
```

---

## License

Private repository — All rights reserved. Built for Placement Mail Tracking.
