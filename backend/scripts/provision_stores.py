#!/usr/bin/env python3
"""
Provision store rows from JSON (owner_email + LINE credentials).

Slug is resolved automatically via GET https://api.line.me/v2/bot/info (userId).

Usage:
  cd backend
  PYTHONPATH=. ./venv/bin/python scripts/provision_stores.py --file config/stores.provision.json
  PYTHONPATH=. ./venv/bin/python scripts/provision_stores.py --file config/stores.provision.json --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.settings import resolve_provision_database_url
from app.core.supabase_db_url import asyncpg_connect_args_for_url, is_supabase_transaction_pooler_url
from app.repositories.store_repository import upsert_store_from_provision
from app.schemas.store_provision import StoreProvisionEntry, StoreProvisionFile
from app.utils.line_bot_info import fetch_line_bot_user_id


async def _resolve_slug(entry: StoreProvisionEntry) -> str:
    user_id = await fetch_line_bot_user_id(entry.line_channel_access_token)
    if entry.slug and entry.slug != user_id:
        raise ValueError(
            f"slug in JSON ({entry.slug}) does not match LINE userId ({user_id})"
        )
    return user_id


async def run(file_path: Path, dry_run: bool, reset_owner_binding: bool) -> int:
    raw = json.loads(file_path.read_text(encoding="utf-8"))
    payload = StoreProvisionFile.model_validate(raw)

    db_url = resolve_provision_database_url()
    if not dry_run and is_supabase_transaction_pooler_url(db_url):
        print("Using Supabase transaction pooler :6543 (avoids session pooler EMAXCONNSESSION).")

    engine = create_async_engine(
        db_url,
        poolclass=NullPool,
        pool_pre_ping=True,
        connect_args=asyncpg_connect_args_for_url(db_url),
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        for i, entry in enumerate(payload.stores, start=1):
            try:
                slug = await _resolve_slug(entry)
            except ValueError as e:
                print(f"[{i}] {entry.name}: ERROR — {e}", file=sys.stderr)
                return 1

            if dry_run:
                print(
                    f"[{i}] DRY-RUN {entry.name}: owner_email={entry.owner_email} "
                    f"slug={slug} active={entry.active}"
                )
                continue

            try:
                store, created = await upsert_store_from_provision(
                    db,
                    name=entry.name,
                    owner_email=entry.owner_email,
                    slug=slug,
                    line_channel_access_token=entry.line_channel_access_token,
                    line_channel_secret=entry.line_channel_secret,
                    timezone=entry.timezone,
                    active=entry.active,
                    reset_owner_binding=reset_owner_binding,
                )
                action = "created" if created else "updated"
                print(
                    f"[{i}] {action} store id={store.id} name={store.name!r} "
                    f"slug={store.slug} owner_email={store.owner_email}"
                )
            except Exception as e:
                print(f"[{i}] {entry.name}: DB ERROR — {e}", file=sys.stderr)
                await db.rollback()
                return 1

        if not dry_run:
            await db.commit()
            print("Done. Owners can log in with owner_email (Google) to claim the store.")

    await engine.dispose()
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Provision stores from JSON into Supabase")
    parser.add_argument(
        "--file",
        type=Path,
        default=Path("config/stores.provision.json"),
        help="Path to provision JSON (default: config/stores.provision.json)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Resolve slug from LINE API but do not write to database",
    )
    parser.add_argument(
        "--reset-owner-binding",
        action="store_true",
        help="Clear owner_auth_user_id on update (owner must log in again)",
    )
    args = parser.parse_args()

    if not args.file.is_file():
        print(
            f"File not found: {args.file}\n"
            "Copy config/stores.provision.example.json to config/stores.provision.json",
            file=sys.stderr,
        )
        sys.exit(1)

    exit_code = asyncio.run(
        run(args.file, args.dry_run, args.reset_owner_binding)
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
