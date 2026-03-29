"""
All environment variables in one place.
Copy .env.example → .env and fill in your values.
"""

import os

# JWT
JWT_SECRET    = os.getenv("JWT_SECRET", "inkingi-dev-secret-CHANGE-IN-PROD")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 12

# Database (set in .env for production)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./inkingi.db")

# App
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")  # development | production
