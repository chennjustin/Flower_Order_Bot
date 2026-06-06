#!/usr/bin/env python3
"""Create the public Supabase Storage bucket for chat images (idempotent)."""

from __future__ import annotations

import sys
from pathlib import Path

# Allow `python scripts/ensure_chat_images_bucket.py` from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

from app.core.deps import get_settings
from app.core.settings import load_settings
from app.utils.supabase_storage import DEFAULT_CHAT_IMAGES_BUCKET, ensure_public_bucket

load_dotenv()
get_settings.cache_clear()


def _psycopg2_dsn(alem_url: str) -> str:
    """Strip SQLAlchemy driver prefix so psycopg2.connect accepts the URL."""
    for prefix in ("postgresql+psycopg2://", "postgresql+asyncpg://", "postgresql://"):
        if alem_url.startswith(prefix):
            return "postgresql://" + alem_url[len(prefix) :]
    return alem_url


def _ensure_bucket_via_sql(bucket: str) -> None:
    """Fallback when service role API is unavailable; uses DATABASE_ALEM_URL."""
    import psycopg2

    from app.core.settings import resolve_database_alem_url

    dsn = _psycopg2_dsn(resolve_database_alem_url())
    sql = """
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            %(bucket)s,
            %(bucket)s,
            TRUE,
            %(file_size_limit)s,
            ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
        )
        ON CONFLICT (id) DO UPDATE
        SET public = EXCLUDED.public,
            file_size_limit = EXCLUDED.file_size_limit,
            allowed_mime_types = EXCLUDED.allowed_mime_types;
    """
    with psycopg2.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql,
                {
                    "bucket": bucket,
                    "file_size_limit": 5 * 1024 * 1024,
                },
            )
        conn.commit()


def main() -> int:
    settings = load_settings()
    bucket = settings.supabase_storage_bucket or DEFAULT_CHAT_IMAGES_BUCKET

    try:
        ensure_public_bucket(bucket=bucket)
    except RuntimeError as api_err:
        if settings.supabase_service_role_key:
            print(f"ERROR: {api_err}", file=sys.stderr)
            return 1
        try:
            _ensure_bucket_via_sql(bucket)
            print(f"OK: bucket {bucket!r} ensured via SQL (service role API skipped)")
            print(
                "NOTE: Ensure SUPABASE_JWT_SECRET or SUPABASE_SERVICE_ROLE_KEY is set for uploads."
            )
            return 0
        except Exception as sql_err:
            print(f"ERROR: API setup failed ({api_err}); SQL fallback failed ({sql_err})", file=sys.stderr)
            return 1

    print(f"OK: chat images bucket {bucket!r} is ready")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
