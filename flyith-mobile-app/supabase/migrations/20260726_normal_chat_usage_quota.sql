-- Free users may claim up to 3 normal chat conversations.
-- Claim is sticky per conversation (resume does not re-consume a slot).

ALTER TABLE public.trip_plans
  ADD COLUMN IF NOT EXISTS normal_usage_claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS trip_plans_user_normal_usage_idx
  ON public.trip_plans (user_id, normal_usage_claimed_at)
  WHERE normal_usage_claimed_at IS NOT NULL;

-- Backfill: for each user, claim the oldest up to 3 existing normal chat rows.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY user_id ORDER BY created_at ASC) AS rn
  FROM public.trip_plans
  WHERE planning_mode = 'chat'
    AND normal_usage_claimed_at IS NULL
    AND (
      jsonb_array_length(messages) > 0
      OR COALESCE(brief->>'destination', '') <> ''
      OR COALESCE(brief->>'status', '') = 'confirmed'
    )
)
UPDATE public.trip_plans AS t
SET normal_usage_claimed_at = COALESCE(t.created_at, now())
FROM ranked AS r
WHERE t.id = r.id
  AND r.rn <= 3;

CREATE OR REPLACE FUNCTION public.claim_normal_chat_usage(p_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_claimed_at timestamptz;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF p_conversation_id IS NULL THEN
    RETURN false;
  END IF;

  -- Serialize claims per user to avoid racing past the free limit.
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text));

  SELECT normal_usage_claimed_at
  INTO v_claimed_at
  FROM public.trip_plans
  WHERE id = p_conversation_id
    AND user_id = v_uid
  FOR UPDATE;

  IF FOUND AND v_claimed_at IS NOT NULL THEN
    RETURN true;
  END IF;

  SELECT count(*)::integer
  INTO v_count
  FROM public.trip_plans
  WHERE user_id = v_uid
    AND normal_usage_claimed_at IS NOT NULL;

  IF v_count >= 3 THEN
    RETURN false;
  END IF;

  IF FOUND THEN
    UPDATE public.trip_plans
    SET normal_usage_claimed_at = now()
    WHERE id = p_conversation_id
      AND user_id = v_uid;
  ELSE
    INSERT INTO public.trip_plans (
      id,
      user_id,
      messages,
      brief,
      title,
      planning_mode,
      normal_usage_claimed_at
    )
    VALUES (
      p_conversation_id,
      v_uid,
      '[]'::jsonb,
      jsonb_build_object('status', 'planning'),
      'Travel plan',
      'chat',
      now()
    );
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_normal_chat_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_normal_chat_usage(uuid) TO authenticated;
