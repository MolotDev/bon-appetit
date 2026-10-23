CREATE OR REPLACE FUNCTION public.enforce_daily_menu_delete_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.assert_admin_menu_deadline(OLD.date);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS daily_menu_delete_deadline ON public.daily_menu;
CREATE TRIGGER daily_menu_delete_deadline
  BEFORE DELETE
  ON public.daily_menu
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_daily_menu_delete_deadline();

DROP FUNCTION IF EXISTS public.get_delivery_report(date);

CREATE FUNCTION public.get_delivery_report(target_date date)
RETURNS TABLE (
  location_name text,
  breakfast_count bigint,
  lunch_first_count bigint,
  lunch_second_count bigint,
  dinner_count bigint,
  kits_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only ADMIN can read delivery reports'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    loc.name AS location_name,
    count(*) FILTER (WHERE dm.meal_type = 'BREAKFAST')::bigint AS breakfast_count,
    count(*) FILTER (WHERE dm.meal_type = 'LUNCH_FIRST')::bigint AS lunch_first_count,
    count(*) FILTER (WHERE dm.meal_type = 'LUNCH_SECOND')::bigint AS lunch_second_count,
    count(*) FILTER (WHERE dm.meal_type = 'DINNER')::bigint AS dinner_count,
    count(DISTINCT o.id)::bigint AS kits_count
  FROM public.locations loc
  LEFT JOIN public.orders o
    ON o.target_location_id = loc.id
   AND o.date = target_date
   AND o.status <> 'CANCELLED'
  LEFT JOIN public.order_items oi ON oi.order_id = o.id
  LEFT JOIN public.daily_menu dm
    ON dm.id = oi.daily_menu_id
   AND dm.date = target_date
  GROUP BY loc.id, loc.name
  ORDER BY loc.name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_delivery_report(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_delivery_report(date) TO authenticated;
