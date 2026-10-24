UPDATE public.profiles
SET full_name = username
WHERE full_name IS DISTINCT FROM username;
