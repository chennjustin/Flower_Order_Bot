-- Manual apply if `alembic upgrade head` fails (multi-store LINE credentials).
-- Safe to run only if these columns do not exist yet.

ALTER TABLE public.store
  ADD COLUMN IF NOT EXISTS line_channel_access_token VARCHAR NULL;

ALTER TABLE public.store
  ADD COLUMN IF NOT EXISTS line_channel_secret VARCHAR NULL;

-- After success, align alembic_version with repo head (if your DB was on e2f1a4b5c6d7):
-- UPDATE public.alembic_version SET version_num = 'f1a2b3c4d5e6';
-- If alembic_version has an unknown revision, fix it to match your actual schema first.
