import os

from dotenv import load_dotenv

load_dotenv()

SSLCOMMERZ_STORE_ID = os.getenv("SSLCOMMERZ_STORE_ID", "").strip()
SSLCOMMERZ_STORE_PASSWORD = os.getenv("SSLCOMMERZ_STORE_PASSWORD", "").strip()
SSLCOMMERZ_MODE = os.getenv("SSLCOMMERZ_MODE", "sandbox").strip().lower()
SSLCOMMERZ_BASE_URL = (
    "https://securepay.sslcommerz.com"
    if SSLCOMMERZ_MODE == "live"
    else "https://sandbox.sslcommerz.com"
)
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
PUBLIC_API_URL = os.getenv("PUBLIC_API_URL", "http://localhost:8000").rstrip("/")
DELIVERY_FEE_BDT = os.getenv("DELIVERY_FEE_BDT", "0.00")
# Unpaid online-payment orders release their reserved stock after this many minutes.
PAYMENT_WINDOW_MINUTES = int(os.getenv("PAYMENT_WINDOW_MINUTES", "30"))


def sslcommerz_configured() -> bool:
    return bool(SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD)
