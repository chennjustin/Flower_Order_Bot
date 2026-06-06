-- Manual apply if `alembic upgrade head` fails (Google Calendar integration).
-- Alembic revision c4d5e6f7a8b9. Safe / idempotent: uses IF NOT EXISTS. All columns nullable.
-- Run in Supabase SQL Editor if you manage schema there instead of Alembic.

ALTER TABLE public.store
  ADD COLUMN IF NOT EXISTS google_calendar_refresh_token VARCHAR NULL;

ALTER TABLE public.store
  ADD COLUMN IF NOT EXISTS google_calendar_email VARCHAR NULL;

ALTER TABLE public.store
  ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR NULL;

ALTER TABLE public."order"
  ADD COLUMN IF NOT EXISTS google_calendar_event_id VARCHAR NULL;

-- After success, align alembic_version with repo head (if your DB was on b3c4d5e6f7a8):
-- UPDATE public.alembic_version SET version_num = 'c4d5e6f7a8b9';
