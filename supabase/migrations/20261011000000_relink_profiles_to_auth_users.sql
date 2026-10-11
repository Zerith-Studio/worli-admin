-- ============================================
-- Relink public.users profiles to their auth.users logins
-- ============================================
--
-- The 2026-09-28/29 data import inserted public.users rows without their ids,
-- so uuid_generate_v4() gave every imported profile a fresh id that no login
-- carries. Orders, wallets, subscriptions and admin rows followed the new ids,
-- which left those accounts unreachable: logging in lands on an auth id with
-- no profile, and the dashboard's admin check finds no row and signs out.
--
-- Nothing stopped it because public.users.id is not tied to auth.users. A
-- plain FK cannot be the fix: rpc_delete_my_account() tombstones the profile
-- and the delete-account function then removes the auth row, so the profile
-- must be able to outlive its login. A trigger guards inserts and id changes
-- instead, which is exactly where the import went wrong.
--
-- 1. Every FK onto public.users gains ON UPDATE CASCADE, so moving a profile
--    to its real id carries all of its rows with it.
-- 2. phone_number loses stray whitespace (7 rows); OTP logins arrive as
--    +91XXXXXXXXXX and could never match those profiles.
-- 3. Profiles whose phone matches an existing login are moved to that login's id.
-- 4. Profiles with no login yet are moved when one appears: the first time
--    that phone is confirmed, the profile takes the new auth id.
-- 5. A profile can no longer be created with, or moved to, an id that has no
--    login.

-- ── 1. Cascade id changes to every referencing table ─────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.users'::regclass
      AND c.confupdtype <> 'c'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s ON UPDATE CASCADE', r.tbl, r.conname, r.def);
  END LOOP;
END $$;

-- ── 2. Normalise whitespace in stored phone numbers ──────────────────────────
UPDATE public.users
SET phone_number = btrim(phone_number, E' \t\r\n')
WHERE phone_number <> btrim(phone_number, E' \t\r\n');

-- ── 3. Move split profiles onto their login's id ─────────────────────────────
CREATE TEMP TABLE relink_map AS
SELECT u.id AS old_id, a.id AS new_id
FROM public.users u
JOIN auth.users a
  ON regexp_replace(a.phone, '\D', '', 'g') = regexp_replace(u.phone_number, '\D', '', 'g')
WHERE NOT EXISTS (SELECT 1 FROM auth.users x WHERE x.id = u.id)
  AND NOT EXISTS (SELECT 1 FROM public.users y WHERE y.id = a.id);

DO $$
BEGIN
  IF (SELECT count(*) FROM relink_map) <> (SELECT count(DISTINCT old_id) FROM relink_map)
     OR (SELECT count(*) FROM relink_map) <> (SELECT count(DISTINCT new_id) FROM relink_map) THEN
    RAISE EXCEPTION 'relink map is not one-to-one; refusing to move profiles';
  END IF;
END $$;

UPDATE public.users u
SET id = m.new_id
FROM relink_map m
WHERE u.id = m.old_id;

DROP TABLE relink_map;

-- ── 4. Relink the rest when their phone is first confirmed ───────────────────
-- Fires on phone_confirmed_at rather than on insert: signInWithOtp creates the
-- auth row before anyone proves they hold the number, and the profile must
-- only follow a login whose phone has been verified.
CREATE OR REPLACE FUNCTION public.relink_profile_to_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.phone IS NULL OR NEW.phone_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  UPDATE public.users u
  SET id = NEW.id
  WHERE regexp_replace(u.phone_number, '\D', '', 'g') = regexp_replace(NEW.phone, '\D', '', 'g')
    AND u.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A failed relink must never block a login; the account is no worse off
  -- than before this trigger existed.
  RAISE WARNING '[relink_profile_to_auth_user] % for auth user %', SQLERRM, NEW.id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_phone_confirmed_relink ON auth.users;
CREATE TRIGGER on_auth_user_phone_confirmed_relink
AFTER INSERT OR UPDATE OF phone_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.relink_profile_to_auth_user();

-- ── 5. No new profile without a login ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.users_id_must_match_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'public.users.id % has no matching auth.users row', NEW.id
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_users_id_must_match_auth_user ON public.users;
CREATE TRIGGER trg_users_id_must_match_auth_user
BEFORE INSERT OR UPDATE OF id ON public.users
FOR EACH ROW EXECUTE FUNCTION public.users_id_must_match_auth_user();
