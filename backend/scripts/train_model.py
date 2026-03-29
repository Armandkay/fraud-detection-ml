"""
Train the Inkingi Shield fraud detection model.

Dataset: PaySim (synthetic mobile money transactions)
Algorithm: Random Forest with class balancing
Output: app/ml/model.pkl

Usage:
    cd backend
    python scripts/train_model.py

The script searches the data/ folder automatically so you don't need
to rename the CSV file. Just drop it in data/ and run.
"""

import sys
import os
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix

DATA_DIR   = Path("data")
MODEL_PATH = Path("app/ml/model.pkl")


def find_csv() -> Path:
    """Find the PaySim CSV regardless of what it was named."""
    candidates = list(DATA_DIR.glob("*.csv"))
    if not candidates:
        print("\n  ERROR: No CSV file found in the data/ folder.")
        print("  Steps to fix:")
        print("    1. Move your PaySim CSV into backend/data/")
        print("    2. Run this script again\n")
        sys.exit(1)
    for c in candidates:
        if "paysim" in c.name.lower() or "PS_2017" in c.name:
            return c
    return candidates[0]


def load_and_inspect(path: Path) -> pd.DataFrame:
    print(f"\n  Loading {path.name} ...")
    t0 = time.time()
    df = pd.read_csv(path)
    print(f"  Done in {time.time()-t0:.1f}s")
    print(f"  Total rows  : {len(df):,}")
    print(f"  Fraud cases : {df['isFraud'].sum():,}  ({df['isFraud'].mean()*100:.3f}%)")

    required = {"type", "amount", "oldbalanceOrg", "newbalanceOrig", "isFraud"}
    missing  = required - set(df.columns)
    if missing:
        print(f"\n  ERROR: Missing columns: {missing}")
        sys.exit(1)
    return df


def build_features(df: pd.DataFrame):
    """
    Six features that consistently perform well on PaySim.
    Must stay in sync with app/ml/model.py — any change here
    needs the same change there or predictions will be wrong.

    amount_ratio catches the classic fraud pattern where someone
    sends more than their balance shows — a near-impossible
    transaction in real banking that almost always means fraud.
    """
    type_map = {"CASH_OUT": 0, "TRANSFER": 1, "CASH_IN": 2, "PAYMENT": 3, "DEBIT": 4}
    df = df.copy()
    df["type_enc"]     = df["type"].map(type_map).fillna(3).astype(int)
    df["balance_diff"] = df["oldbalanceOrg"] - df["newbalanceOrig"]
    df["amount_ratio"] = df["amount"] / (df["oldbalanceOrg"] + 1.0)

    cols = ["amount", "type_enc", "oldbalanceOrg", "newbalanceOrig",
            "balance_diff", "amount_ratio"]
    return df[cols].values.astype(np.float64), df["isFraud"].values.astype(int)


def balance_dataset(X, y, ratio=3):
    """
    PaySim is heavily imbalanced — only ~0.1% of rows are fraud.
    Training on raw data produces a model that labels everything
    as legitimate and still gets 99.9% accuracy — useless.
    We undersample legit transactions to get a 1:3 fraud-to-legit ratio.
    """
    fraud_idx  = np.where(y == 1)[0]
    normal_idx = np.random.choice(
        np.where(y == 0)[0],
        size=min(len(fraud_idx) * ratio, (y == 0).sum()),
        replace=False
    )
    idx = np.concatenate([fraud_idx, normal_idx])
    np.random.shuffle(idx)
    print(f"\n  Balanced: {len(fraud_idx):,} fraud + {len(normal_idx):,} legit = {len(idx):,} total")
    return X[idx], y[idx]


def train_model(X_train, y_train) -> RandomForestClassifier:
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=14,
        min_samples_leaf=4,
        max_features="sqrt",
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    print("  Training Random Forest (200 trees) ...")
    t0 = time.time()
    model.fit(X_train, y_train)
    print(f"  Done in {time.time()-t0:.1f}s")
    return model


def evaluate(model, X_test, y_test) -> float:
    y_pred  = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    auc     = roc_auc_score(y_test, y_proba)
    tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()

    print("\n" + "─" * 48)
    print("  RESULTS")
    print("─" * 48)
    print(classification_report(y_test, y_pred, target_names=["Legit", "Fraud"]))
    print(f"  ROC-AUC : {auc:.4f}   (target: above 0.95)")
    print(f"  Fraud caught    : {tp:,}  |  Missed : {fn:,}")
    print(f"  False alerts    : {fp:,}  |  Correct clears : {tn:,}")
    print("─" * 48)

    cols = ["amount", "type", "old_balance", "new_balance", "balance_diff", "amount_ratio"]
    pairs = sorted(zip(cols, model.feature_importances_), key=lambda x: x[1], reverse=True)
    print("\n  What the model found most useful:")
    for name, imp in pairs:
        bar = "█" * int(imp * 36)
        print(f"    {name:<20} {bar}  {imp:.3f}")
    print()
    return auc


def main():
    print("\n" + "=" * 48)
    print("  Inkingi Shield — Fraud Model Training")
    print("=" * 48)

    csv_path     = find_csv()
    df           = load_and_inspect(csv_path)
    X, y         = build_features(df)
    X_b, y_b     = balance_dataset(X, y)

    X_train, X_test, y_train, y_test = train_test_split(
        X_b, y_b, test_size=0.2, random_state=42, stratify=y_b
    )

    model = train_model(X_train, y_train)
    auc   = evaluate(model, X_test, y_test)

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    print(f"  Saved → {MODEL_PATH}")
    print("  Restart uvicorn — the API will load the new model automatically.\n")


if __name__ == "__main__":
    main()
