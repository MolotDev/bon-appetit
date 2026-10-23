CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET must_change_password = false
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.complete_password_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated;
