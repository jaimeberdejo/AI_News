-- ============================================================
-- profiles table
-- Mirrors auth.users. Auto-populated by trigger on signup.
-- ============================================================
CREATE TABLE public.profiles (
  id           uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  display_name text,
  avatar_url   text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- All users (including anonymous) can read profiles (needed for comment display in Phase 10)
CREATE POLICY "profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  TO authenticated, anon
  USING (true);

-- Users can only update their own profile row
CREATE POLICY "users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- Auto-create trigger: fires after every new auth.users insert
-- Creates the corresponding profiles row automatically.
-- SECURITY DEFINER + empty search_path prevents search-path injection.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;  -- safety valve: prevents crash on duplicate
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
