# Placement Mail Tracker — Backend

A Flask backend that connects to a student's college Gmail, automatically extracts placement/internship opportunity details from incoming emails, and exposes them as structured data via REST APIs.

## Features

- **Gmail OAuth Integration** — Readonly access to scan placement-related emails
- **Hybrid Extraction Pipeline** — Regex (free, fast) + LLM fallback (Gemini) for structured data extraction
- **Background Sync** — Backfill historical emails + incremental sync for new ones
- **Bring-Your-Own-Key** — Users supply their own LLM API key; app never pays for LLM calls
- **Row Level Security** — Supabase RLS ensures users only see their own data
- **Encrypted Secrets** — Gmail tokens and API keys encrypted at rest with Fernet

## Tech Stack

- **Backend**: Python, Flask
- **Database**: Supabase (Postgres + Auth + RLS)
- **Email**: Gmail API (OAuth, `history.list` for incremental sync)
- **LLM**: Google Gemini (via `google-generativeai`), extensible to Groq/OpenRouter
- **Encryption**: `cryptography.fernet`

## Extracted Fields

| Field | Type | Example |
|-------|------|---------|
| company | string | "TCS" |
| role | string | "Software Developer" |
| role_type | enum | internship / full-time / ppo / unclear |
| salary_or_stipend | string | "6 LPA", "₹25,000/month" |
| bond | string | "2 years", null |
| last_date | string | "25/12/2025", null |
| register_links | string[] | ["https://forms.gle/abc"] |

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Benfranklinms/mail-parser.git
cd mail-parser
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in all values in .env
```

**Required:**
- Supabase project URL, keys, and JWT secret
- Google OAuth client ID/secret (Gmail API enabled)
- Fernet encryption key (generate with command in `.env.example`)

### 3. Set up database

Run `migrations/001_initial_schema.sql` in your Supabase SQL Editor.

### 4. Run

```bash
python run.py
```

Server starts at `http://localhost:5000`.

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `GET /health` | GET | No | Health check |
| `POST /auth/gmail/connect` | POST | Yes | Start Gmail OAuth flow |
| `GET /auth/gmail/callback` | GET | No | OAuth callback |
| `GET /auth/gmail/status` | GET | Yes | Check Gmail connection status |
| `GET /sync/status` | GET | Yes | Poll sync job progress |
| `POST /sync/incremental` | POST | Yes | Trigger incremental sync |
| `POST /llm-keys` | POST | Yes | Save LLM API key (encrypted) |
| `GET /llm-keys` | GET | Yes | List configured providers (masked) |
| `DELETE /llm-keys/:provider` | DELETE | Yes | Remove an LLM key |
| `GET /opportunities` | GET | Yes | List opportunities (paginated, filterable) |
| `GET /opportunities/:id` | GET | Yes | Get single opportunity |
| `PATCH /opportunities/:id/status` | PATCH | Yes | Update application status |

**Auth** = `Authorization: Bearer <supabase-jwt>` header required.

## Testing

```bash
python -m pytest tests/ -v
```

## Project Structure

```
mail-parser/
├── app/
│   ├── __init__.py              # Flask app factory
│   ├── config.py                # Config from environment
│   ├── auth/
│   │   ├── middleware.py        # JWT verification decorator
│   │   └── routes.py            # Gmail OAuth routes
│   ├── sync/
│   │   └── routes.py            # Sync status + trigger routes
│   ├── opportunities/
│   │   └── routes.py            # Opportunities CRUD routes
│   ├── llm_keys/
│   │   └── routes.py            # LLM key management routes
│   ├── services/
│   │   ├── encryption.py        # Fernet encrypt/decrypt
│   │   ├── gmail.py             # Gmail OAuth + message fetching
│   │   ├── extraction.py        # Hybrid regex+LLM pipeline
│   │   ├── llm_providers.py     # LLM provider interface + Gemini
│   │   └── sync_manager.py      # Background sync orchestration
│   └── db/
│       └── client.py            # Supabase client wrapper
├── migrations/
│   └── 001_initial_schema.sql   # Database schema + RLS policies
├── tests/
│   ├── test_extraction.py       # Extraction pipeline tests
│   └── test_encryption.py       # Encryption utility tests
├── requirements.txt
├── .env.example
└── run.py
```

## License

Private project — not for redistribution.
