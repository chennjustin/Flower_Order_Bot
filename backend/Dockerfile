FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SKIP_ALEMBIC_ON_START=1

COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --default-timeout=120 -r /app/requirements.txt

COPY . /app

EXPOSE 8000

# Supabase schema is migrated locally (shared DB). Set SKIP_ALEMBIC_ON_START=0 to run on boot.
CMD ["sh", "-c", "if [ \"$SKIP_ALEMBIC_ON_START\" != \"1\" ]; then alembic upgrade head || exit 1; fi && exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"]

