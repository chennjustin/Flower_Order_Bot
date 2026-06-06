-- Manual apply if `alembic upgrade head` fails (multi-store LINE credentials).
-- Safe to run only if these columns do not exist yet.

ALTER TABLE public.store
  ADD COLUMN IF NOT EXISTS line_channel_access_token VARCHAR NULL;

ALTER TABLE public.store
  ADD COLUMN IF NOT EXISTS line_channel_secret VARCHAR NULL;

-- After success, align alembic_version with repo head (if your DB was on e2f1a4b5c6d7):
-- UPDATE public.alembic_version SET version_num = 'f1a2b3c4d5e6';
-- If alembic_version has an unknown revision, fix it to match your actual schema first.

-- Store owner auth columns (Alembic revision b3c4d5e6f7a8) — prefer `make migrate` when possible.
-- ALTER TABLE public.store ADD COLUMN IF NOT EXISTS owner_email VARCHAR;
-- UPDATE public.store SET owner_email = 'unprovisioned-' || id::text || '@local' WHERE owner_email IS NULL;
-- ALTER TABLE public.store ALTER COLUMN owner_email SET NOT NULL;
-- ALTER TABLE public.store ADD CONSTRAINT uq_store_owner_email UNIQUE (owner_email);
-- ALTER TABLE public.store ALTER COLUMN owner_auth_user_id DROP NOT NULL;
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_store_owner_auth_user_id ON public.store (owner_auth_user_id) WHERE owner_auth_user_id IS NOT NULL;
