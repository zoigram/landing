# Tiny contact-form backend: receives the landing's /api/contacto POSTs
# (proxied by nginx) and relays them to Resend. No state, no volumes.
FROM python:3.12-slim

WORKDIR /srv

COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api/main.py .

ENV PYTHONUNBUFFERED=1
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8090/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090"]
