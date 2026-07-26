-- Allow multiple conversations per user
ALTER TABLE public.trip_plans DROP CONSTRAINT IF EXISTS trip_plans_user_id_key;
DROP INDEX IF EXISTS public.trip_plans_user_id_key;

-- List / resume metadata
ALTER TABLE public.trip_plans
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS planning_mode text NOT NULL DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS locale text,
  ADD COLUMN IF NOT EXISTS asked_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS answered_topics jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS trip_plans_user_id_updated_at_idx
  ON public.trip_plans (user_id, updated_at DESC);

-- Keep updated_at fresh on write
CREATE OR REPLACE FUNCTION public.set_trip_plans_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trip_plans_set_updated_at ON public.trip_plans;
CREATE TRIGGER trip_plans_set_updated_at
  BEFORE UPDATE ON public.trip_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_trip_plans_updated_at();
