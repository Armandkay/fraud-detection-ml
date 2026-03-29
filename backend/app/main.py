"""
Inkingi Shield — FastAPI Backend
Real-time ML Fraud Detection for Rwanda's Financial Ecosystem
BSc Software Engineering Capstone · Armand Kayiranga · 2026
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import init_db, run_migrations
from app.ml.model import load_model, model_state
from app.routers import auth, alerts, transactions, customers, stats, predict, analysts, partners, email_router, webhook


# ── Startup / shutdown ────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Inkingi Shield API starting...")
    await init_db()          # create tables if they don't exist
    await run_migrations()   # add new columns to existing tables
    await load_model()       # load ML model into memory
    print("✅ Ready.")
    yield
    print("🛑 Shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Inkingi Shield API",
    description="Real-time ML fraud detection for Rwanda's financial institutions",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://inkingi-shield-frontend.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,          prefix="/auth",              tags=["Auth"])
app.include_router(alerts.router,        prefix="/api/alerts",        tags=["Alerts"])
app.include_router(transactions.router,  prefix="/api/transactions",  tags=["Transactions"])
app.include_router(customers.router,     prefix="/api/customers",     tags=["Customers"])
app.include_router(stats.router,         prefix="/api/stats",         tags=["Stats"])
app.include_router(predict.router,       prefix="/api/predict",       tags=["Predict"])
app.include_router(analysts.router,      prefix="/api/analysts",      tags=["Analysts"])
app.include_router(partners.router,      prefix="/api/partners",      tags=["Partners"])
app.include_router(email_router.router,  prefix="/api/email",         tags=["Email"])
app.include_router(webhook.router,       prefix="/api/webhook/transactions", tags=["Webhook"])


# ── Health check (no auth required) ──────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {
        "status": "ok",
        "model":   "loaded" if model_state["loaded"] else "fallback",
        "version": "1.0.0",
        "uptime":  model_state.get("uptime", "0s"),
    }
