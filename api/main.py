"""
zoidev.com · contact API

Tiny FastAPI service sitting behind nginx that receives the landing's
contact panel and relays it to CONTACT_TO via Resend's HTTP API — same
honeypot + Resend pattern zoigram/eva uses for its own contact form, plus
a submit-time trap since this endpoint is public and unauthenticated.

If RESEND_API_KEY / RESEND_FROM aren't set, the request still returns ok
(so the panel never looks broken) but nothing is actually sent — same
fail-open behaviour as eva's email_util.
"""
import html
import os
import re
import time
from collections import defaultdict, deque

import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

RESEND_URL = "https://api.resend.com/emails"
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM = os.getenv("RESEND_FROM", "")
CONTACT_TO = os.getenv("CONTACT_TO", "contacto@zoidev.com")
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "https://zoidev.com").split(",") if o.strip()]

RE_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_MS_TO_FILL = 3000  # a person can't read + fill the form faster than this

app = FastAPI(title="zoidev contact api")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST"],
    allow_headers=["*"],
)

# In-memory rate limit: a handful of requests per IP every 10 minutes is
# plenty for a one-person studio's contact form — no shared store needed
# for a single small container.
RATE_LIMIT = 5
RATE_WINDOW_S = 600
_hits: dict[str, deque] = defaultdict(deque)


class ContactoIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    email: str = Field(max_length=200)
    mensaje: str = Field(min_length=1, max_length=2000)
    asunto_web: str = ""  # honeypot: real visitors never see or fill this
    ts: int = 0            # client render timestamp (ms epoch) for the time-trap


def _rate_limited(ip: str) -> bool:
    now = time.time()
    hits = _hits[ip]
    while hits and now - hits[0] > RATE_WINDOW_S:
        hits.popleft()
    if len(hits) >= RATE_LIMIT:
        return True
    hits.append(now)
    return False


def _enviar_contacto(nombre: str, email_remitente: str, mensaje: str) -> bool:
    if not (RESEND_API_KEY and RESEND_FROM):
        print(f"[email] RESEND no configurado - no se envia el mensaje de {email_remitente}")
        return False
    html_body = f"""
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0b0d0c;color:#e6efe9">
      <h1 style="color:#00ff88;font-size:20px;margin:0 0 16px">zoidev · contacto</h1>
      <p style="font-size:14px;color:#c7d3cc">
        <strong>De:</strong> {html.escape(nombre)} ({html.escape(email_remitente)})
      </p>
      <p style="font-size:14px;color:#e6efe9;white-space:pre-wrap;border-left:3px solid #00ff88;padding-left:12px">
        {html.escape(mensaje)}
      </p>
    </div>
    """
    try:
        resp = requests.post(
            RESEND_URL,
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": RESEND_FROM,
                "to": [CONTACT_TO],
                "subject": f"Contacto zoidev.com: {nombre}",
                "html": html_body,
                "reply_to": email_remitente,
            },
            timeout=15,
        )
        if resp.status_code >= 400:
            print(f"[email] Resend devolvio {resp.status_code}: {resp.text[:300]}")
            return False
        return True
    except requests.RequestException as exc:
        print(f"[email] no se pudo enviar el mensaje de {email_remitente}: {exc}")
        return False


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/contacto")
def contacto(payload: ContactoIn, request: Request):
    # Honeypot: invisible to a person, a blind bot fills every field it
    # finds — if this one came back filled in, pretend success without
    # sending anything real.
    if payload.asunto_web.strip():
        return {"ok": True}

    # Time-trap: reject (silently, same as the honeypot) anything sent
    # faster than a human could plausibly read the form and type a reply.
    if payload.ts and (time.time() * 1000 - payload.ts) < MIN_MS_TO_FILL:
        return {"ok": True}

    ip = request.client.host if request.client else "unknown"
    if _rate_limited(ip):
        raise HTTPException(status_code=429, detail="Demasiadas solicitudes, inténtalo más tarde.")

    nombre, email_in, mensaje = payload.nombre.strip(), payload.email.strip(), payload.mensaje.strip()
    if not (nombre and mensaje) or not RE_EMAIL.match(email_in):
        raise HTTPException(status_code=400, detail="Revisa el correo y el mensaje.")

    _enviar_contacto(nombre[:120], email_in, mensaje[:2000])
    return {"ok": True}
