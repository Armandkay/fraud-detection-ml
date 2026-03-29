"""
app/services/seed.py

Populates the database with the same data the frontend uses as mock data.
Called on first request to each endpoint — only inserts if the table is empty.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.alert       import Alert
from app.models.transaction import Transaction
from app.models.customer    import Customer
from app.models.analyst     import Analyst
from app.models.partner     import PartnerRequest


# ── Seed data — mirrors ALERTS_DATA, TRANSACTIONS_DATA, CUSTOMERS_DATA in the frontend ──

_MTN = "MTN Rwanda"   # institution tag for all seed data

ALERTS = [
    dict(id="RW-4821", customer="Jean Pierre Habimana", initials="JH", score=92, level="CRITICAL",
         amount="RWF 4,250,000", amount_num=4250000, phone="+250 788 234 567",
         email="jp.habimana@gmail.com", address="KG 45 Ave, Kigali", device="iPhone 14 — New",
         type="Mobile Money", time="2m ago", phone_risk="high", email_risk="medium",
         address_risk="low", device_risk="high", status="pending", institution=_MTN,
         reason="IP mismatch + new device + 4.2× avg amount"),
    dict(id="RW-4820", customer="Amina Uwase", initials="AU", score=74, level="HIGH",
         amount="RWF 1,800,000", amount_num=1800000, phone="+250 722 891 234",
         email="amina.uwase@yahoo.com", address="KN 12 St, Kigali", device="Samsung S22",
         type="Bank Transfer", time="18m ago", phone_risk="medium", email_risk="low",
         address_risk="low", device_risk="medium", status="pending", institution=_MTN,
         reason="Velocity spike · 3 transfers in 1 hour"),
    dict(id="RW-4819", customer="Eric Nshimiyimana", initials="EN", score=58, level="MEDIUM",
         amount="RWF 920,000", amount_num=920000, phone="+250 733 445 678",
         email="eric.n@company.rw", address="KG 101 Blvd, Kigali", device="Android (rooted)",
         type="Merchant Pay", time="41m ago", phone_risk="low", email_risk="low",
         address_risk="medium", device_risk="high", status="pending", institution=_MTN,
         reason="Rooted device detected"),
    dict(id="RW-4818", customer="Grace Mukamana", initials="GM", score=31, level="LOW",
         amount="RWF 350,000", amount_num=350000, phone="+250 788 112 334",
         email="grace.m@gmail.com", address="KK 25 Ave, Kigali", device="iPhone 13",
         type="Mobile Money", time="1h ago", phone_risk="low", email_risk="low",
         address_risk="low", device_risk="low", status="approved", institution=_MTN,
         reason="Routine transfer within normal range"),
    dict(id="RW-4817", customer="Patrick Niyonzima", initials="PN", score=85, level="HIGH",
         amount="RWF 2,100,000", amount_num=2100000, phone="+250 788 567 890",
         email="p.niyonzima@rw.co", address="KG 78 Ave, Kigali", device="Unknown Device",
         type="Bank Transfer", time="2h ago", phone_risk="high", email_risk="medium",
         address_risk="low", device_risk="high", status="cancelled", institution=_MTN,
         reason="Unknown device + off-hours transfer"),
    dict(id="RW-4816", customer="Claudine Umutoniwase", initials="CU", score=67, level="HIGH",
         amount="RWF 780,000", amount_num=780000, phone="+250 722 334 556",
         email="c.umutoniwase@rw.co", address="KG 22 Ave, Kigali", device="Samsung A53",
         type="Mobile Money", time="3h ago", phone_risk="medium", email_risk="low",
         address_risk="low", device_risk="low", status="pending", institution=_MTN,
         reason="Unusual location — Musanze, account based in Kigali"),
]

TRANSACTIONS = [
    dict(id="TXN-8821", customer="Jean Pierre Habimana", amount="RWF 4,250,000", amount_num=4250000, type="Mobile Money",   date="Feb 22, 2026 14:32", score=92, status="flagged",  channel="MoMo App",        institution=_MTN),
    dict(id="TXN-8820", customer="Amina Uwase",          amount="RWF 1,800,000", amount_num=1800000, type="Bank Transfer",  date="Feb 22, 2026 14:15", score=74, status="flagged",  channel="Online Banking",   institution=_MTN),
    dict(id="TXN-8819", customer="Eric Nshimiyimana",    amount="RWF 920,000",   amount_num=920000,  type="Merchant Pay",   date="Feb 22, 2026 13:51", score=58, status="flagged",  channel="POS Terminal",     institution=_MTN),
    dict(id="TXN-8818", customer="Grace Mukamana",       amount="RWF 350,000",   amount_num=350000,  type="Mobile Money",   date="Feb 22, 2026 13:22", score=31, status="clear",    channel="MoMo App",        institution=_MTN),
    dict(id="TXN-8817", customer="Patrick Niyonzima",    amount="RWF 2,100,000", amount_num=2100000, type="Bank Transfer",  date="Feb 22, 2026 12:18", score=85, status="blocked",  channel="Online Banking",   institution=_MTN),
    dict(id="TXN-8816", customer="Claudine Umutoniwase", amount="RWF 780,000",   amount_num=780000,  type="Mobile Money",   date="Feb 22, 2026 11:45", score=67, status="flagged",  channel="MoMo App",        institution=_MTN),
    dict(id="TXN-8815", customer="Olivier Hakizimana",   amount="RWF 125,000",   amount_num=125000,  type="Merchant Pay",   date="Feb 22, 2026 10:30", score=12, status="clear",    channel="POS Terminal",     institution=_MTN),
    dict(id="TXN-8814", customer="Vestine Uwimana",      amount="RWF 540,000",   amount_num=540000,  type="Bank Transfer",  date="Feb 22, 2026 09:14", score=22, status="clear",    channel="Online Banking",   institution=_MTN),
    dict(id="TXN-8813", customer="Thierry Mugisha",      amount="RWF 3,400,000", amount_num=3400000, type="Mobile Money",   date="Feb 22, 2026 08:55", score=78, status="flagged",  channel="MoMo App",        institution=_MTN),
    dict(id="TXN-8812", customer="Sandrine Ineza",       amount="RWF 95,000",    amount_num=95000,   type="Merchant Pay",   date="Feb 22, 2026 08:10", score=9,  status="clear",    channel="POS Terminal",     institution=_MTN),
]

CUSTOMERS = [
    dict(id="CUST-001", name="Jean Pierre Habimana", initials="JH", phone="+250 788 234 567", email="jp.habimana@gmail.com",    location="Kigali",  joined="Jan 2021", transactions=247, total_volume="RWF 42.5M", risk_score=78, status="high-risk",   flags=3, institution=_MTN),
    dict(id="CUST-002", name="Amina Uwase",          initials="AU", phone="+250 722 891 234", email="amina.uwase@yahoo.com",     location="Kigali",  joined="Mar 2020", transactions=512, total_volume="RWF 18.2M", risk_score=42, status="medium-risk", flags=1, institution=_MTN),
    dict(id="CUST-003", name="Eric Nshimiyimana",    initials="EN", phone="+250 733 445 678", email="eric.n@company.rw",         location="Kigali",  joined="Jul 2022", transactions=89,  total_volume="RWF 8.9M",  risk_score=55, status="medium-risk", flags=2, institution=_MTN),
    dict(id="CUST-004", name="Grace Mukamana",       initials="GM", phone="+250 788 112 334", email="grace.m@gmail.com",         location="Kigali",  joined="Feb 2019", transactions=634, total_volume="RWF 12.1M", risk_score=18, status="low-risk",    flags=0, institution=_MTN),
    dict(id="CUST-005", name="Patrick Niyonzima",    initials="PN", phone="+250 788 567 890", email="p.niyonzima@rw.co",         location="Kigali",  joined="Nov 2021", transactions=178, total_volume="RWF 31.4M", risk_score=82, status="high-risk",   flags=4, institution=_MTN),
    dict(id="CUST-006", name="Claudine Umutoniwase", initials="CU", phone="+250 722 334 556", email="c.umutoniwase@rw.co",       location="Musanze", joined="May 2020", transactions=294, total_volume="RWF 9.7M",  risk_score=61, status="medium-risk", flags=1, institution=_MTN),
]

ANALYSTS = [
    dict(id="AK-001", name="Armand Kayiranga", role="Senior Fraud Analyst", institution="MTN Rwanda", email="armand.k@inkingi.rw"),
    dict(id="AK-002", name="Demo Analyst",     role="Fraud Analyst",        institution="Demo",        email="demo@inkingi.rw"),
]

PARTNER_REQUESTS = []  # no seed data — only real submissions from the website form appear here


# ── Generic seed helper ───────────────────────────────────────────────────────
async def _seed_if_empty(db: AsyncSession, Model, rows: list):
    count = await db.scalar(select(func.count()).select_from(Model))
    if count == 0:
        db.add_all([Model(**row) for row in rows])
        await db.commit()


# ── Public functions called from routers ──────────────────────────────────────
async def seed_alerts(db: AsyncSession):
    await _seed_if_empty(db, Alert, ALERTS)

async def seed_transactions(db: AsyncSession):
    await _seed_if_empty(db, Transaction, TRANSACTIONS)

async def seed_customers(db: AsyncSession):
    await _seed_if_empty(db, Customer, CUSTOMERS)

async def seed_analysts(db: AsyncSession):
    await _seed_if_empty(db, Analyst, ANALYSTS)

async def seed_partners(db: AsyncSession):
    await _seed_if_empty(db, PartnerRequest, PARTNER_REQUESTS)
