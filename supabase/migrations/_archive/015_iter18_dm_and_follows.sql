-- ============================================================================
-- 015_iter18_dm_and_follows.sql
-- Iteration 18 — Direct Messaging & Follow rendszer.
--
-- Új táblák:
--   1. follows         — egyirányú követés (follower -> following)
--   2. conversations   — két user közötti DM-szál (kanonikus participant order)
--   3. messages        — egy szálhoz tartozó üzenetek
--
-- Logika:
--   - Bárki követhet bárkit (egyirányú).
--   - DM-szál csak kölcsönös követés esetén indítható (mutual follow).
--   - Conversation-ben a két részvevő rendezve van: participant_a < participant_b
--     (UUID lex. összehasonlítás), így UNIQUE(a, b) elég az idempotenciához.
--
-- Idempotens: minden objektumot DROP IF EXISTS előz meg.
-- ============================================================================

-- ============================================================================
-- 1. follows
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.follows (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT follows_unique_pair UNIQUE (follower_id, following_id),
  CONSTRAINT follows_no_self_follow CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx  ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows(following_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. conversations
--
-- Canonical order: participant_a < participant_b. A POST /api/conversations
-- mindig MIN/MAX-szal rendezi a két user-id-t mielőtt INSERT-elne, így a
-- (a, b) UNIQUE elég az idempotens "indítsd vagy add vissza a meglévőt"
-- viselkedéshez.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_a   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_b   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT conversations_canonical_order CHECK (participant_a < participant_b),
  CONSTRAINT conversations_unique_pair     UNIQUE (participant_a, participant_b)
);

CREATE INDEX IF NOT EXISTS conversations_participant_a_idx ON public.conversations(participant_a);
CREATE INDEX IF NOT EXISTS conversations_participant_b_idx ON public.conversations(participant_b);
CREATE INDEX IF NOT EXISTS conversations_last_message_idx  ON public.conversations(last_message_at DESC NULLS LAST);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages(conversation_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Helper: is_mutual_follow(a, b)
--
-- Igaz, ha mindkét irányban létezik follows row. SECURITY DEFINER, hogy az
-- RLS policy-k ne akadjanak ki a saját SELECT-jükön (a hívó usernek a saját
-- follows soraira van olvasási joga, de nem feltétlen a másikéra — ezt a
-- függvény elegáns módon megkerüli).
-- ============================================================================

DROP FUNCTION IF EXISTS public.is_mutual_follow(UUID, UUID);

CREATE OR REPLACE FUNCTION public.is_mutual_follow(p_a UUID, p_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follows
     WHERE follower_id = p_a AND following_id = p_b
  )
  AND EXISTS (
    SELECT 1 FROM public.follows
     WHERE follower_id = p_b AND following_id = p_a
  );
$$;

REVOKE ALL ON FUNCTION public.is_mutual_follow(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_mutual_follow(UUID, UUID) TO authenticated, service_role;

-- ============================================================================
-- RLS — follows
--
-- A követési gráf publikus: bárki láthatja, ki kit követ. INSERT/DELETE csak
-- a saját follower_id-vel.
-- ============================================================================

DROP POLICY IF EXISTS "follows_select_public" ON public.follows;
CREATE POLICY "follows_select_public"
  ON public.follows
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
CREATE POLICY "follows_insert_own"
  ON public.follows
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;
CREATE POLICY "follows_delete_own"
  ON public.follows
  FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- ============================================================================
-- RLS — conversations
--
-- SELECT: csak résztvevő látja.
-- INSERT: a hívó az egyik résztvevő, ÉS kölcsönös követés áll fenn.
-- UPDATE: csak résztvevő (last_message_at karbantartás a /messages POST-ban).
-- ============================================================================

DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = participant_a OR auth.uid() = participant_b);

DROP POLICY IF EXISTS "conversations_insert_participant_with_mutual_follow" ON public.conversations;
CREATE POLICY "conversations_insert_participant_with_mutual_follow"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = participant_a OR auth.uid() = participant_b)
    AND public.is_mutual_follow(participant_a, participant_b)
  );

DROP POLICY IF EXISTS "conversations_update_participant" ON public.conversations;
CREATE POLICY "conversations_update_participant"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = participant_a OR auth.uid() = participant_b)
  WITH CHECK (auth.uid() = participant_a OR auth.uid() = participant_b);

-- ============================================================================
-- RLS — messages
--
-- SELECT: csak ha a szál résztvevője.
-- INSERT: csak ha sender_id = auth.uid() ÉS résztvevő.
-- UPDATE: csak a befogadó (sender_id <> auth.uid()) — ezzel a read_at-et
--         a fogadó tudja beállítani, a feladó nem.
-- ============================================================================

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id = messages.conversation_id
         AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_insert_participant_as_sender" ON public.messages;
CREATE POLICY "messages_insert_participant_as_sender"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id = messages.conversation_id
         AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_update_recipient_marks_read" ON public.messages;
CREATE POLICY "messages_update_recipient_marks_read"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id = messages.conversation_id
         AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  )
  WITH CHECK (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id = messages.conversation_id
         AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

-- ============================================================================
-- Realtime publication
--
-- A frontend a Supabase Realtime-on keresztül iratkozik fel az új üzenetekre.
-- A messages és conversations táblákat hozzá kell adni a supabase_realtime
-- publikációhoz, hogy a postgres_changes events kimenjenek a klienseknek.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- messages
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'messages'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
    END IF;

    -- conversations
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'conversations'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations';
    END IF;
  END IF;
END $$;
