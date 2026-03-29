# Inkingi Shield — Real-Time Fraud Detection for Rwanda

**BSc Software Engineering Capstone Project · Armand Kayiranga · 2026**

Inkingi Shield is a full-stack fraud detection platform built for Rwanda's financial ecosystem. It connects a fraud scoring service hosted on Hugging Face Spaces with a FastAPI backend and a React 19 frontend, giving financial institutions real-time fraud scoring, analyst dashboards, and a partner onboarding pipeline.

> *"Inkingi" means pillar or foundation in Kinyarwanda — the thing that holds everything up.*

---

## Live Demo

- **Website & Dashboard**: [inkingi-shield-frontend.onrender.com](https://inkingi-shield-frontend.onrender.com)
- **Backend API**: [inkingi-shield-api.onrender.com](https://inkingi-shield-api.onrender.com)
- **Fraud Scoring Service (Hugging Face)**: [armandkay/fraud-detection](https://huggingface.co/spaces/Armandkay/fraud-detection)
- - **Video**: https://drive.google.com/file/d/1FCw0kDWXeRhdGRlOqx9JNuSHe69Br81R/view?usp=sharing

Use access code **DEMO2026** on the dashboard login page to explore without an analyst account.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Inkingi Shield                          │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Frontend   │◄──►│   Backend    │◄──►│ Scoring API  │  │
│  │  React 19    │    │   FastAPI    │    │  HF Spaces   │  │
│  │  Vite / JS   │    │  SQLAlchemy  │    │  Gradio API  │  │
│  │  face-api.js │    │  SQLite/PG   │    │ RandomForest │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│   Render (Static)     Render (Web Svc)    Hugging Face      │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

### Public Website
- Marketing landing page built for Rwanda's financial institutions
- Partner inquiry form with automatic email notifications (Formspree + Gmail SMTP)
- Fully mobile-responsive design
- MoMo Data Analyzer — paste MTN MoMo SMS or USSD history and get instant fraud scores

### Analyst Dashboard
- **Face recognition login** via face-api.js (TinyFaceDetector + FaceRecognitionNet)
- Real-time fraud alert queue with risk scores (0–100)
- Block / Clear transactions with one click — full audit trail
- Transaction history, customer profiles, and analytics
- Multi-institution support — each institution sees only their own data
- Risk factor breakdown shown per alert so analysts understand every decision
- Pattern detection: structuring/smurfing, velocity anomaly, large transfer flags
- MoMo Data Analyzer tab for batch-scoring pasted transaction history

### Admin Portal
- Partner pipeline management (New → Under Review → Approved → Onboarded → Active)
- Analyst enrollment with biometric photo upload
- Automatic status-change emails (Gmail SMTP)
- Self-enrollment for admin biometric login
- MoMo Analysis tab for reviewing imported transaction data
- API Integration section — institutions can connect programmatically via webhook

### Fraud Scoring Service
- Random Forest classifier trained on PaySim mobile money data
- Calibrated for Rwandan transaction behaviour (CASH_OUT, TRANSFER patterns)
- Sub-200ms scoring via Hugging Face Spaces API
- Rule-based fallback if the API is unreachable

### Institution Webhook API
- `POST /api/webhook/transactions` — banks submit transaction arrays and receive fraud scores
- Authenticated via API key, returns score and risk level per transaction
- Accepts up to 500 transactions per request

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, face-api.js (vladmandic CDN) |
| Backend | FastAPI, SQLAlchemy 2.0, aiosqlite, asyncpg |
| Auth | JWT (python-jose, HS256, 12h expiry) + face biometrics |
| Database | SQLite (local), PostgreSQL (Render production) |
| Scoring | scikit-learn Random Forest, hosted on Hugging Face Spaces via Gradio |
| Email | Gmail SMTP (smtplib) + Formspree |
| Deployment | Render Blueprint (frontend + backend), Hugging Face Spaces (scoring) |

---

## Project Structure

```
fraud-detection-ml/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py             # App entry point, lifespan, CORS
│   │   ├── config.py           # JWT secret, DB URL, environment
│   │   ├── database.py         # Async SQLAlchemy setup + migrations
│   │   ├── models/             # SQLAlchemy ORM models
│   │   │   ├── transaction.py
│   │   │   ├── customer.py
│   │   │   ├── alert.py
│   │   │   ├── analyst.py
│   │   │   └── partner.py
│   │   ├── routers/            # API route handlers
│   │   │   ├── auth.py         # JWT login, face login
│   │   │   ├── alerts.py       # Alert queue + batch import
│   │   │   ├── transactions.py
│   │   │   ├── customers.py
│   │   │   ├── stats.py
│   │   │   ├── predict.py
│   │   │   ├── analysts.py
│   │   │   ├── partners.py
│   │   │   ├── webhook.py      # Institution API webhook
│   │   │   └── email_router.py # Gmail SMTP endpoint
│   │   ├── services/
│   │   │   ├── auth_service.py # JWT generation + verification
│   │   │   └── seed.py         # DB seeding
│   │   └── ml/
│   │       └── model.py        # Calls HF Spaces API + fallback
│   ├── requirements.txt
│   └── runtime.txt
├── frontend/                   # React 19 SPA
│   ├── src/
│   │   ├── App.jsx             # Full application (single-file architecture)
│   │   ├── main.jsx
│   │   └── index.css           # Global styles + responsive media queries
│   ├── index.html
│   └── package.json
├── huggingface/                # Fraud scoring service (deployed to HF Spaces)
│   ├── app.py                  # Gradio API serving the fraud model
│   └── requirements.txt
├── notebook/
│   └── Inkingi_Shield_Fraud_Detection.ipynb  # Training notebook
├── render.yaml                 # Render Blueprint (deploys both services)
└── runtime.txt                 # Python 3.12 for Render
```

---

## Local Development

### Prerequisites
- Python 3.12
- Node.js 18+

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend will be available at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at `http://localhost:5173`.

### Environment Variables

Create `backend/.env`:

```env
JWT_SECRET=your-secret-key
DATABASE_URL=sqlite+aiosqlite:///./inkingi.db
ENVIRONMENT=development
EMAIL_FROM=your-gmail@gmail.com
EMAIL_PASS=your-gmail-app-password
WEBHOOK_API_KEY=your-webhook-key
```

---

## API Reference

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/health` | System status | None |
| `POST` | `/auth/login` | JWT login (analyst ID) | None |
| `POST` | `/auth/face-login` | Face descriptor login | None |
| `GET` | `/api/alerts` | Fraud alert queue | JWT |
| `POST` | `/api/alerts/import` | Batch-import MoMo alerts | JWT |
| `PATCH` | `/api/alerts/{id}` | Block / Clear an alert | JWT |
| `GET` | `/api/transactions` | Transaction history | JWT |
| `GET` | `/api/customers` | Customer profiles | JWT |
| `GET` | `/api/stats` | Dashboard statistics | JWT |
| `POST` | `/api/predict` | Score a single transaction | JWT |
| `GET` | `/api/analysts` | List analysts | JWT |
| `POST` | `/api/analysts` | Add analyst | JWT |
| `POST` | `/api/analysts/{id}/enroll-face` | Enroll face descriptor | JWT |
| `GET` | `/api/partners` | Active partners | JWT |
| `POST` | `/api/partners` | Submit partner inquiry | None |
| `GET` | `/api/partners/requests` | All partner requests | JWT |
| `PATCH` | `/api/partners/{id}/status` | Update pipeline status | JWT |
| `POST` | `/api/email` | Send email via Gmail SMTP | None |
| `POST` | `/api/webhook/transactions` | Score transactions via API key | API Key |

---

## Deployment

The project uses a Render Blueprint (`render.yaml`) that automatically provisions both services:

- **inkingi-shield-api** — Python web service running FastAPI
- **inkingi-shield-frontend** — Static site built with Vite

Set the following environment variables on the Render backend service:

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | Any strong random string |
| `DATABASE_URL` | Render PostgreSQL connection string |
| `EMAIL_FROM` | Gmail address |
| `EMAIL_PASS` | Gmail App Password (16 characters) |
| `ENVIRONMENT` | `production` |
| `WEBHOOK_API_KEY` | API key for the institution webhook |

---

## Fraud Scoring

The fraud scoring service is a **Random Forest classifier** trained on the **PaySim** dataset — a simulation of mobile money transactions based on real financial behaviour patterns.

**Input features:**
- Transaction amount
- Transaction type (CASH_OUT, TRANSFER, CASH_IN, PAYMENT, DEBIT)
- Account balance before and after the transaction

**Output:**
- Fraud score (0–100)
- Binary prediction (fraud / not fraud)
- Confidence percentage
- Top contributing risk factors

The service is hosted as a **Gradio API on Hugging Face Spaces** and called by the FastAPI backend. If the API is unreachable, a rule-based fallback scorer activates automatically.

---

---

## Testing Results

All tests were run against the **live deployed API** at `https://inkingi-shield-api.onrender.com` using curl. The frontend is live at `https://inkingi-shield-frontend.onrender.com`.

### Test 1 — System Health Check
```
GET https://inkingi-shield-api.onrender.com/health
→ {"status":"ok","model":"loaded","version":"1.0.0","uptime":"0h 0m 0s"}
```
Confirms the API is running and the fraud scoring service is connected.

---

### Test 2 — Analyst Authentication (JWT)
```
POST https://inkingi-shield-api.onrender.com/auth/login
Body: {"analyst_id":"AK-001","password":"demo"}
→ {"token":"eyJhbGci...","analyst":{"id":"AK-001","name":"Armand Kayiranga","institution":"MTN Rwanda"}}
```
JWT issued successfully. Token is used in all subsequent requests via `Authorization: Bearer`.

---

### Test 3 — Dashboard Statistics
```
GET https://inkingi-shield-api.onrender.com/api/stats
→ {"totalTx":10,"fraudDetected":5,"amountProtected":"RWF 2M","falsePositiveRate":"20.0%",
   "txChange":"+12%","fraudChange":"+4%","amountChange":"+18%"}
```
Stats endpoint returns live aggregate data scoped to the analyst's institution.

---

### Test 4 — Low-Risk Transaction Score
```
POST https://inkingi-shield-api.onrender.com/api/predict
Body: {"amount":2500,"transaction_type":"PAYMENT","old_balance":50000,"new_balance":47500}
→ {"fraud_score":0,"is_fraud":false,"confidence":0.0,
   "top_features":[{"feature":"amount","importance":0.42},{"feature":"type","importance":0.31},...]}
```
Small routine PAYMENT with no balance anomaly → score 0, not fraud. Correct result.

---

### Test 5 — High-Risk Transaction Score (full balance drain)
```
POST https://inkingi-shield-api.onrender.com/api/predict
Body: {"amount":980000,"transaction_type":"CASH_OUT","old_balance":980000,"new_balance":0}
→ {"fraud_score":70,"is_fraud":true,"confidence":0.7,"top_features":[...]}
```
Large CASH_OUT that fully drains the account → score 70, flagged as fraud. Correct result.

---

### Test 6 — Medium-Risk Transaction Score (partial drain)
```
POST https://inkingi-shield-api.onrender.com/api/predict
Body: {"amount":150000,"transaction_type":"TRANSFER","old_balance":200000,"new_balance":50000}
→ {"fraud_score":30,"is_fraud":false,"confidence":0.3}
```
TRANSFER with some balance remaining → score 30, not flagged. Sits between the two extremes as expected.

---

### Test 7 — Edge Case: Zero Amount CASH_IN
```
POST https://inkingi-shield-api.onrender.com/api/predict
Body: {"amount":0,"transaction_type":"CASH_IN","old_balance":0,"new_balance":0}
→ {"fraud_score":0,"is_fraud":false,"confidence":0.0}
```
Zero-value deposit → score 0. No crash or unexpected behaviour on boundary input.

---

### Test 8 — Webhook API: Batch Scoring, Valid Key
```
POST https://inkingi-shield-api.onrender.com/api/webhook/transactions?api_key=ik-demo-key-2026
Body: {"institution":"BK Rwanda","transactions":[
  {"id":"TXN-001","amount":5000,"type":"PAYMENT","old_balance":100000,"new_balance":95000},
  {"id":"TXN-002","amount":750000,"type":"CASH_OUT","old_balance":750000,"new_balance":0},
  {"id":"TXN-003","amount":1200,"type":"CASH_IN","old_balance":20000,"new_balance":21200}
]}

→ {"scored":3,"institution":"BK Rwanda","results":[
    {"id":"TXN-001","fraud_score":0,"is_fraud":false,"level":"LOW"},
    {"id":"TXN-002","fraud_score":70,"is_fraud":true,"level":"HIGH"},
    {"id":"TXN-003","fraud_score":0,"is_fraud":false,"level":"LOW"}
  ]}
```
Three transactions submitted. The CASH_OUT that drains the account is correctly flagged HIGH; the others are LOW. All three returned in one response.

---

### Test 9 — Webhook API: Invalid Key (Security Check)
```
POST https://inkingi-shield-api.onrender.com/api/webhook/transactions?api_key=wrong-key
→ {"detail":"Invalid api_key"}   HTTP 401
```
Confirms the webhook rejects unauthorized requests.

---

### Test 10 — Alert Queue (Institution-Scoped)
```
GET https://inkingi-shield-api.onrender.com/api/alerts?limit=5
Authorization: Bearer <token>   (analyst: AK-001, institution: MTN Rwanda)
→ Returns 6 alerts with scores: 92 (CRITICAL), 74 (HIGH), 58 (MEDIUM), 31 (LOW), 85 (HIGH), 67 (HIGH)
  Each alert includes: customer name, phone, device, risk reason, block/clear status
```
Confirms the alert queue returns prioritized, annotated results scoped to the analyst's institution.

---

### Test 11 — Transaction History
```
GET https://inkingi-shield-api.onrender.com/api/transactions?limit=5
→ 10 transactions returned. Statuses: flagged, clear, blocked.
  Score range: 9 (Sandrine Ineza, Merchant Pay) to 92 (Jean Pierre Habimana, MoMo)
```
Transaction history shows correctly mixed statuses and score values across channels (MoMo, Bank Transfer, POS).

---

### Test 12 — Customer Profiles (Risk Tiers)
```
GET https://inkingi-shield-api.onrender.com/api/customers?limit=3
→ CUST-001: riskScore 78, status "high-risk", 3 flags
  CUST-002: riskScore 42, status "medium-risk", 1 flag
  CUST-004: riskScore 18, status "low-risk",   0 flags
```
Three distinct risk tiers returned correctly. Customer profiles include transaction count, total volume, and flag history.

---

### Test 13 — Protected Route Without Token
```
GET https://inkingi-shield-api.onrender.com/api/alerts   (no Authorization header)
→ {"detail":"Not authenticated"}   HTTP 403
```
All protected routes reject requests with no token, confirming JWT middleware is active.

---

### Test 14 — Webhook: Multi-Institution Batch (Equity Bank Rwanda)
```
POST https://inkingi-shield-api.onrender.com/api/webhook/transactions?api_key=ik-demo-key-2026
Body: {"institution":"Equity Bank Rwanda","transactions":[
  {"id":"EQ-001","amount":50000,"type":"PAYMENT","old_balance":500000,"new_balance":450000},
  {"id":"EQ-002","amount":2000000,"type":"TRANSFER","old_balance":2000000,"new_balance":0},
  {"id":"EQ-003","amount":300,"type":"CASH_IN","old_balance":1000,"new_balance":1300},
  {"id":"EQ-004","amount":1500000,"type":"CASH_OUT","old_balance":1500000,"new_balance":0}
]}

→ {"scored":4,"institution":"Equity Bank Rwanda","results":[
    {"id":"EQ-001","fraud_score":0,"level":"LOW"},
    {"id":"EQ-002","fraud_score":70,"level":"HIGH"},
    {"id":"EQ-003","fraud_score":0,"level":"LOW"},
    {"id":"EQ-004","fraud_score":70,"level":"HIGH"}
  ]}
```
Same scoring logic applies regardless of which institution submits. The two full-drain transactions are flagged; the routine ones are not.

---

### UI Tests (Live Site — https://inkingi-shield-frontend.onrender.com)

UI-1: MoMo SMS parse

<img width="602" height="332" alt="image" src="https://github.com/user-attachments/assets/d9966c47-cc9c-449c-bfa7-33219310437a" />

UI-2: MoMo USSD parse

<img width="607" height="339" alt="image" src="https://github.com/user-attachments/assets/d05d7b58-e7eb-452f-ae93-b24b207ee542" />

UI-3: Face biometric login — analyst registers face, logs in

<img width="947" height="405" alt="image" src="https://github.com/user-attachments/assets/16419736-82d3-4975-8ec7-8b91505e925e" />

<img width="960" height="451" alt="image" src="https://github.com/user-attachments/assets/83861bfd-0d8a-4cc9-9980-d471025227d8" />

UI-4: Block a HIGH alert, confirm it moves to resolved

<img width="672" height="308" alt="image" src="https://github.com/user-attachments/assets/0257708f-439c-4fd1-81db-1517713dd351" />

<img width="749" height="332" alt="image" src="https://github.com/user-attachments/assets/3d292bcb-9faf-49e0-bd29-7f3ba1862d4b" />

UI-5: Submit a partner inquiry form

<img width="959" height="509" alt="image" src="https://github.com/user-attachments/assets/226186d8-14cd-4563-b2bc-935ae759278a" />

UI-6: Admin partner pipeline

<img width="960" height="506" alt="image" src="https://github.com/user-attachments/assets/1ed224da-dbc5-43ca-8f79-01e1c768ce18" />

UI-7: API Integration tab:

<img width="958" height="512" alt="image" src="https://github.com/user-attachments/assets/547d22ec-a99c-4f49-bf31-58f4307148eb" />

<img width="943" height="401" alt="image" src="https://github.com/user-attachments/assets/09acb5c5-f8a9-4921-bcbd-4245559d1230" />

---

## Analysis

### Objectives vs Outcomes

The project proposal set out to build a fraud detection platform for Rwanda's financial institutions covering four objectives: real-time scoring, analyst workflow tools, institution onboarding, and programmatic integration.

**Real-time scoring** was achieved. The fraud scoring service runs on Hugging Face Spaces and returns results in under 200ms. A rule-based fallback activates automatically if the remote API is unavailable, so the system never goes blind.

**Analyst workflow** was delivered in full. Analysts log in with an ID and password or via face recognition, see a prioritised alert queue with risk scores and explanations, and can block or clear transactions. Each action is institution-scoped — MTN Rwanda analysts only see MTN Rwanda data.

**Institution onboarding** was partially delivered. The partner request pipeline (New → Under Review → Approved → Onboarded → Active) is live in the admin portal. Automatic status-change emails fire at each stage. What is not yet built is automated account provisioning — an admin still manually creates the analyst account after approving a partner.

**Programmatic integration** exceeded the original scope. The institution webhook (`POST /api/webhook/transactions`) allows any external system to submit transaction arrays and receive scored results back. This was marked as future work in the proposal and was shipped as part of the build.

The MoMo Data Analyzer was not in the original proposal but was added as a direct response to Rwanda's mobile money context. It parses MTN MoMo SMS messages and USSD exports and scores each transaction, giving individuals and compliance teams a way to review their own transaction history without API access.

The one area that fell short of the proposal was model training depth. The classifier was trained on the PaySim dataset rather than real Rwandan transaction data, which limits how well it generalises to local patterns. The fallback scorer compensates with hardcoded rules for common fraud patterns (CASH_OUT balance drain, high velocity), but a dataset from a real institution would improve accuracy significantly.

---

## Discussion

### Why the milestones mattered

The build was structured around four milestones: backend foundation, analyst dashboard, admin portal, and external integration. Each one unlocked the next.

Starting with the backend meant that every feature built on top of it — authentication, alerts, scoring, the webhook — had a consistent data layer from the beginning. SQLAlchemy models with async SQLite for local development and PostgreSQL for production meant no rewrites between environments.

The analyst dashboard milestone forced clarity on what an analyst actually needs: not a raw data table, but a prioritised queue with enough context to make a decision quickly. The risk reason field (`"IP mismatch + new device + 4.2× avg amount"`) turned out to be one of the most valuable parts of the UI — without it, a score of 92 means nothing to a human reviewer.

The admin portal milestone created the boundary between institution users and the platform operator. Without this separation, there is no partner pipeline, no enrolment workflow, and no way to onboard a real institution safely.

The webhook was the final milestone and the one that makes the platform actually useful to a bank. A browser dashboard requires an analyst to be logged in and looking at a screen. A webhook means fraud scoring happens the moment a transaction is submitted, regardless of whether anyone is watching.

### Face recognition tradeoffs

Face recognition login via face-api.js works in the browser without any server-side processing, which keeps the implementation simple. The tradeoff is that it depends on lighting, camera quality, and device performance. On a modern laptop with good lighting it is reliable. On older hardware or in poor light it fails silently. For a production deployment, a fallback to OTP or a hardware key would be needed.

### Single-file frontend

Keeping the entire React app in one file (`App.jsx`) made early development fast and avoided build complexity. At ~4,300 lines it is now large enough that adding a new feature requires careful reading before touching anything. The right next step would be to split it into component files, but that refactor was out of scope for this project.

---

## Recommendations

### For financial institutions considering this platform

Start with the webhook integration rather than the dashboard. The webhook requires no UI changes on your side — you POST your transaction data and receive scores back. Once you have confidence in the scores, the analyst dashboard gives your compliance team the interface to act on flagged transactions.

Test the system against your own transaction data as early as possible. The current model was trained on simulated data. Real performance numbers will differ, and you need to know your false positive rate before deploying to a live environment.

### For future development

**Real training data** — Partner with one institution to obtain anonymised transaction records. Retrain the classifier on local data. This single change would improve detection accuracy more than any other improvement.

**Automated onboarding** — When an admin approves a partner request, the system should automatically provision an analyst account and send credentials. Currently an admin has to do this manually as a second step.

**Audit logging** — Every block and clear action is currently stored in the alert status field. A dedicated audit log table with timestamps, analyst IDs, and before/after states would be needed for regulatory compliance.

**Webhook rate limiting** — The current webhook accepts up to 500 transactions per request with no rate limiting per API key. In production, per-key rate limiting and a request queue would prevent abuse and protect the scoring service.

**MoMo Analyzer offline mode** — The MoMo Analyzer currently calls the remote scoring service for each parsed transaction. Adding a local scoring option would make it usable without internet access, which matters in areas with unreliable connectivity.

---

## Author

**Armand Kayiranga**
BSc Software Engineering — African Leadership University
Capstone Project, 2026

---

## License

MIT License
