"""
Placement Mail Tracker — Entry point.

Run with: python run.py
"""

import os
from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    try:
        app.run(
            host="0.0.0.0",
            port=port,
            debug=app.config.get("DEBUG", True),
        )
    except OSError:
        print(f"\n[INFO] Port {port} is occupied (likely by macOS AirPlay Receiver). Switching to port 5001...\n")
        app.run(
            host="0.0.0.0",
            port=5001,
            debug=app.config.get("DEBUG", True),
        )
