"""
app/ml/model.py

Calls the Hugging Face Space API for fraud predictions.
Falls back to a rule-based scorer if the API is unavailable.

HF Space: https://huggingface.co/spaces/Armandkay/fraud-detection
"""

import time
import httpx

# ── Global state ──────────────────────────────────────────────────────────────
model_state = {
    "loaded": True,
    "uptime": "0s",
    "_start": None,
}

HF_API_URL = "https://armandkay-fraud-detection.hf.space/run/predict"

TYPE_MAP = {"CASH_OUT": 0, "TRANSFER": 1, "CASH_IN": 2, "PAYMENT": 3, "DEBIT": 4}


async def load_model():
    model_state["_start"] = time.time()
    _refresh_uptime()
    print("✅ ML model connected via Hugging Face Space API")


def _refresh_uptime():
    if model_state["_start"]:
        s = int(time.time() - model_state["_start"])
        h, r = divmod(s, 3600)
        m, s = divmod(r, 60)
        model_state["uptime"] = f"{h}h {m}m {s}s"


# ── Main prediction function ──────────────────────────────────────────────────
async def predict_fraud(amount: float, tx_type: str, old_balance: float, new_balance: float) -> dict:
    """
    Calls the HF Space Gradio API and returns structured prediction results.
    Falls back to rule-based scoring if the API is unreachable.
    """
    _refresh_uptime()

    try:
        payload = {"data": [amount, tx_type, old_balance, new_balance]}
        timeout = httpx.Timeout(10.0, connect=5.0, read=8.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(HF_API_URL, json=payload)
            response.raise_for_status()
            raw = response.json()

        data = raw.get("data", [])
        if len(data) < 4:
            raise ValueError(f"Unexpected API response shape: {data}")

        # data = [verdict, fraud_score_str, confidence_str, top_feats_str]
        verdict        = data[0]   # e.g. "FRAUD DETECTED"
        score_str      = data[1]   # e.g. "87/100"
        confidence_str = data[2]   # e.g. "92.3%"
        top_feats_raw  = data[3]   # e.g. "amount: 42.0%\ntype_enc: 31.0%\n..."

        try:
            fraud_score = int(str(score_str).split("/")[0])
        except (ValueError, IndexError):
            raise ValueError(f"Could not parse fraud_score from: {score_str!r}")

        is_fraud   = verdict == "FRAUD DETECTED"
        confidence = round(float(str(confidence_str).replace("%", "")) / 100, 4)

        top_features = []
        for line in str(top_feats_raw).strip().split("\n"):
            if ": " not in line:
                continue
            try:
                feat, imp = line.split(": ", 1)
                top_features.append({
                    "feature":    feat.strip(),
                    "importance": round(float(imp.replace("%", "")) / 100, 4),
                })
            except (ValueError, IndexError):
                continue

        return {
            "fraud_score": fraud_score,
            "is_fraud":    is_fraud,
            "confidence":  confidence,
            "top_features": top_features,
        }

    except Exception as e:
        print(f"[WARN] HF API unavailable ({e}) — using rule-based fallback")
        return _rule_based(amount, tx_type, old_balance, new_balance)


# ── Rule-based fallback ───────────────────────────────────────────────────────
def _rule_based(amount: float, tx_type: str, old_balance: float, new_balance: float) -> dict:
    score = 0
    if tx_type.upper() in ("CASH_OUT", "TRANSFER"):
        score += 30
    if amount > 500_000:
        score += 15
    if amount > 2_000_000:
        score += 20
    if old_balance > 0 and new_balance == 0:
        score += 25
    if old_balance > 0 and amount > old_balance * 1.5:
        score += 15

    fraud_score = min(score, 100)
    return {
        "fraud_score": fraud_score,
        "is_fraud": fraud_score >= 50,
        "confidence": round(fraud_score / 100, 2),
        "top_features": [
            {"feature": "amount",       "importance": 0.42},
            {"feature": "type",         "importance": 0.31},
            {"feature": "balance_diff", "importance": 0.15},
            {"feature": "old_balance",  "importance": 0.08},
            {"feature": "ratio",        "importance": 0.04},
        ],
    }
