"""Upload chat images to Supabase Storage and return public HTTPS URLs for LINE."""

from __future__ import annotations

import logging
import re
import time
from typing import Any
from urllib.parse import quote

import httpx
import jwt

from app.core.deps import get_settings

logger = logging.getLogger(__name__)

DEFAULT_CHAT_IMAGES_BUCKET = "chat-images"
_UPLOAD_TIMEOUT = 30.0
_SERVICE_ROLE_TTL_SECONDS = 60 * 60 * 24 * 365 * 10


def _storage_headers(service_role_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
    }


def _project_ref_from_supabase_url(supabase_url: str) -> str | None:
    match = re.match(r"https?://([^.]+)\.supabase\.co", supabase_url.strip())
    return match.group(1) if match else None


def _mint_service_role_jwt(jwt_secret: str, project_ref: str) -> str:
    """Build a service_role JWT when only SUPABASE_JWT_SECRET is available."""
    now = int(time.time())
    payload = {
        "iss": "supabase",
        "ref": project_ref,
        "role": "service_role",
        "iat": now,
        "exp": now + _SERVICE_ROLE_TTL_SECONDS,
    }
    return jwt.encode(payload, jwt_secret, algorithm="HS256")


def _resolve_service_role_key(
    *,
    supabase_url: str,
    explicit_key: str | None,
    jwt_secret: str | None,
) -> str:
    if explicit_key:
        return explicit_key
    if not jwt_secret:
        raise RuntimeError(
            "Configure SUPABASE_SERVICE_ROLE_KEY or SUPABASE_JWT_SECRET for Storage uploads"
        )
    project_ref = _project_ref_from_supabase_url(supabase_url)
    if not project_ref:
        raise RuntimeError("SUPABASE_URL must look like https://<ref>.supabase.co")
    return _mint_service_role_jwt(jwt_secret, project_ref)


def _require_storage_config() -> tuple[str, str, str]:
    settings = get_settings()
    if not settings.supabase_url:
        raise RuntimeError("SUPABASE_URL is not configured")
    service_role_key = _resolve_service_role_key(
        supabase_url=settings.supabase_url,
        explicit_key=settings.supabase_service_role_key,
        jwt_secret=settings.supabase_jwt_secret,
    )
    bucket = settings.supabase_storage_bucket or DEFAULT_CHAT_IMAGES_BUCKET
    return settings.supabase_url.rstrip("/"), service_role_key, bucket


def public_storage_url(object_path: str, *, bucket: str | None = None) -> str:
    """Build the public object URL served by a public Supabase Storage bucket."""
    base, _, resolved_bucket = _require_storage_config()
    bucket_name = bucket or resolved_bucket
    encoded_path = quote(object_path.lstrip("/"), safe="/")
    return f"{base}/storage/v1/object/public/{bucket_name}/{encoded_path}"


def ensure_public_bucket(
    *,
    bucket: str | None = None,
    file_size_limit: int = 5 * 1024 * 1024,
) -> None:
    """
    Create the chat-images bucket if missing (idempotent).
    Requires service role key; safe to run from a one-off setup script.
    """
    base, service_role_key, bucket_name = _require_storage_config()
    resolved = bucket or bucket_name
    url = f"{base}/storage/v1/bucket"
    payload: dict[str, Any] = {
        "id": resolved,
        "name": resolved,
        "public": True,
        "file_size_limit": file_size_limit,
        "allowed_mime_types": [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
        ],
    }
    with httpx.Client(timeout=_UPLOAD_TIMEOUT) as client:
        response = client.post(
            url,
            headers={**_storage_headers(service_role_key), "Content-Type": "application/json"},
            json=payload,
        )
        if response.status_code in (200, 201):
            logger.info("Supabase Storage bucket ready: %s", resolved)
            return
        # Supabase may return HTTP 409 or HTTP 400 with a Duplicate payload.
        if response.status_code == 409 or (
            response.status_code == 400 and "Duplicate" in response.text
        ):
            logger.info("Supabase Storage bucket already exists: %s", resolved)
            return
        raise RuntimeError(
            f"Failed to ensure bucket {resolved!r}: "
            f"{response.status_code} {response.text}"
        )


def upload_public_object(
    object_path: str,
    raw: bytes,
    content_type: str,
    *,
    bucket: str | None = None,
) -> str:
    """Upload bytes to a public bucket and return the public HTTPS URL."""
    base, service_role_key, bucket_name = _require_storage_config()
    resolved_bucket = bucket or bucket_name
    normalized_path = object_path.lstrip("/")
    upload_url = f"{base}/storage/v1/object/{resolved_bucket}/{normalized_path}"

    with httpx.Client(timeout=_UPLOAD_TIMEOUT) as client:
        response = client.post(
            upload_url,
            headers={
                **_storage_headers(service_role_key),
                "Content-Type": content_type,
                "x-upsert": "false",
            },
            content=raw,
        )
        if response.status_code not in (200, 201):
            raise RuntimeError(
                f"Supabase Storage upload failed ({response.status_code}): {response.text}"
            )

    return public_storage_url(normalized_path, bucket=resolved_bucket)
