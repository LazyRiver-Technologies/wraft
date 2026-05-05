-- Run this in your Supabase SQL Editor to correctly initialize new users

-- 1. Create the function that will handle the trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_trial_plan_id uuid;
BEGIN
    -- Look up the 'trial' plan ID
    SELECT id INTO v_trial_plan_id FROM public.plans WHERE name = 'trial' LIMIT 1;

    -- If there's no trial plan in the DB, it will insert NULL (or we could handle it differently)
    -- But assuming the plans table is properly seeded, it will find it.
    
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        plan_id,
        trial_started_at
    )
    VALUES (
        new.id,
        new.email,
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'avatar_url',
        v_trial_plan_id,
        now()
    );

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the trigger if it already exists (to allow for clean updates)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Create the trigger on auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
