-- ============================================================================
-- 014_iter17_polls_none_option.sql
--
-- Iteration 17: extend the voting system with an optional "Más / Egyik sem"
-- ("Other / None of the above") option.
--
-- PostgreSQL does not allow subqueries directly in CHECK constraints
-- (ERROR 0A000). The workaround is an IMMUTABLE helper function whose body
-- may contain set-returning functions and subqueries freely.
-- ============================================================================

-- 1. Helper function (idempotent via CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.polls_none_option_valid(options JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  none_count INTEGER;
BEGIN
  -- Must be a JSON array
  IF jsonb_typeof(options) IS DISTINCT FROM 'array' THEN
    RETURN FALSE;
  END IF;

  -- Count elements with is_none = true
  SELECT COUNT(*) INTO none_count
  FROM jsonb_array_elements(options) AS elem
  WHERE (elem ->> 'is_none')::boolean IS TRUE;

  -- 0 none options: standard poll, always valid
  IF none_count = 0 THEN
    RETURN TRUE;
  END IF;

  -- More than 1 none option: invalid
  IF none_count > 1 THEN
    RETURN FALSE;
  END IF;

  -- Exactly 1 none option: must be the last element
  RETURN (options -> (jsonb_array_length(options) - 1) ->> 'is_none')::boolean IS TRUE;
END;
$$;

-- 2. CHECK constraint using the helper function
ALTER TABLE public.polls
  DROP CONSTRAINT IF EXISTS polls_options_none_option_shape;

ALTER TABLE public.polls
  ADD CONSTRAINT polls_options_none_option_shape
  CHECK (public.polls_none_option_valid(options));

COMMENT ON CONSTRAINT polls_options_none_option_shape ON public.polls IS
  'Iter17: at most one option may have is_none=true, and if present it must be the last array element.';
