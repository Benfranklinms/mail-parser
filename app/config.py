"""
Placement Mail Tracker — App configuration.

Reads all settings from environment variables with validation.
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Application configuration from environment variables."""

    # --- Flask ---
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "dev-secret-key-change-me")
    ENV = os.environ.get("FLASK_ENV", "development")
    DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"

    # --- Supabase ---
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")
    SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")

    # --- Encryption ---
    FERNET_KEY = os.environ.get("FERNET_KEY")

    # --- Google OAuth ---
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
    GOOGLE_REDIRECT_URI = os.environ.get(
        "GOOGLE_REDIRECT_URI", "http://localhost:5000/auth/gmail/callback"
    )

    # --- Gmail search defaults ---
    PLACEMENT_KEYWORDS = [
        "placement",
        "internship",
        "hiring",
        "recruitment",
        "job opportunity",
        "campus drive",
        "walk-in",
        "off-campus",
        "on-campus",
    ]

    @classmethod
    def validate(cls):
        """Validate that all required environment variables are set.

        Raises ValueError with a clear message listing all missing variables.
        """
        required = {
            "SUPABASE_URL": cls.SUPABASE_URL,
            "SUPABASE_ANON_KEY": cls.SUPABASE_ANON_KEY,
            "SUPABASE_SERVICE_ROLE_KEY": cls.SUPABASE_SERVICE_ROLE_KEY,
            "SUPABASE_JWT_SECRET": cls.SUPABASE_JWT_SECRET,
            "FERNET_KEY": cls.FERNET_KEY,
            "GOOGLE_CLIENT_ID": cls.GOOGLE_CLIENT_ID,
            "GOOGLE_CLIENT_SECRET": cls.GOOGLE_CLIENT_SECRET,
        }

        missing = [name for name, value in required.items() if not value]

        if missing:
            raise ValueError(
                f"Missing required environment variables: {', '.join(missing)}. "
                f"Copy .env.example to .env and fill in your values."
            )
