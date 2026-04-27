-- ----------------------------------------------------------------------------
-- Iter 13: matches table — football-data.org integration columns
--
-- football-data.org returns home/away team crest images, the full-time
-- score and the competition name directly with the match payload. Storing
-- them denormalized on `matches` saves us a join and lets the public match
-- list render straight from `SELECT *`.
-- ----------------------------------------------------------------------------

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS home_team_crest TEXT;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS away_team_crest TEXT;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS score TEXT;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS competition TEXT;
