import os
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY environment variable is missing")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
ACCESS_TOKEN_EXPIRE = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
if ENVIRONMENT == "production" and len(SECRET_KEY) < 32:
    raise RuntimeError("JWT_SECRET_KEY must contain at least 32 characters in production.")
COOKIE_SECURE = os.getenv(
    "COOKIE_SECURE",
    "true" if ENVIRONMENT == "production" else "false",
).lower() == "true"

if ENVIRONMENT == "production" and not COOKIE_SECURE:
    raise RuntimeError("COOKIE_SECURE must be true in production.")

CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
if ENVIRONMENT == "production" and not os.getenv("CORS_ORIGINS"):
    raise RuntimeError("Set CORS_ORIGINS to the deployed frontend origin in production.")
if "*" in CORS_ORIGINS:
    raise RuntimeError("CORS_ORIGINS cannot contain '*' when credentialed cookies are enabled.")
