# app/routers/email_router.py
import os
import re
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


class EmailRequest(BaseModel):
    to:      str
    subject: str
    body:    str


@router.post("")
async def send_email(req: EmailRequest):
    """
    Send a plain-text email via Gmail SMTP.
    Requires EMAIL_FROM and EMAIL_PASS environment variables:
      EMAIL_FROM  — your Gmail address  e.g. armandkayiranga7@gmail.com
      EMAIL_PASS  — Gmail App Password  (Google Account → Security → App passwords)
    """
    email_from = os.getenv("EMAIL_FROM", "")
    email_pass = os.getenv("EMAIL_PASS", "")

    if not _EMAIL_RE.match(req.to):
        raise HTTPException(status_code=400, detail="Invalid recipient email address")

    if not email_from or not email_pass:
        # Env vars not configured — tell the frontend to fall back to mailto
        raise HTTPException(
            status_code=503,
            detail="Email service not configured. Set EMAIL_FROM and EMAIL_PASS in environment variables."
        )

    try:
        msg = MIMEMultipart()
        msg["From"]    = f"Inkingi Shield <{email_from}>"
        msg["To"]      = req.to
        msg["Subject"] = req.subject
        msg["Reply-To"] = email_from
        msg.attach(MIMEText(req.body, "plain"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as server:
            server.login(email_from, email_pass)
            server.sendmail(email_from, req.to, msg.as_string())

        return {"success": True, "to": req.to}

    except smtplib.SMTPAuthenticationError:
        raise HTTPException(
            status_code=401,
            detail="Gmail authentication failed. Check EMAIL_FROM and EMAIL_PASS."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
