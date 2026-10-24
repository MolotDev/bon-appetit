DROP FUNCTION IF EXISTS public.get_kitchen_cancelled_after_cooking(date);
DROP FUNCTION IF EXISTS public.get_kitchen_report(date);

CREATE FUNCTION public.get_kitchen_report(target_date date)
RETURNS TABLE (
  dish_title text,
  meal_type text,
  portions bigint,
  cancelled_portions bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only ADMIN can read kitchen reports'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    d.title AS dish_title,
    dm.meal_type,
    count(*) FILTER (WHERE o.status <> 'CANCELLED')::bigint AS portions,
    count(*) FILTER (
      WHERE o.status = 'CANCELLED'
        AND o.cooking_started_at IS NOT NULL
    )::bigint AS cancelled_portions
  FROM public.order_items oi
  INNER JOIN public.orders o ON o.id = oi.order_id
  INNER JOIN public.daily_menu dm ON dm.id = oi.daily_menu_id
  INNER JOIN public.dishes d ON d.id = dm.dish_id
  WHERE o.date = target_date
    AND dm.date = target_date
    AND (
      o.status <> 'CANCELLED'
      OR o.cooking_started_at IS NOT NULL
    )
  GROUP BY d.title, dm.meal_type
  HAVING
    count(*) FILTER (WHERE o.status <> 'CANCELLED') > 0
    OR count(*) FILTER (
      WHERE o.status = 'CANCELLED'
        AND o.cooking_started_at IS NOT NULL
    ) > 0
  ORDER BY
    CASE dm.meal_type
      WHEN 'BREAKFAST' THEN 1
      WHEN 'LUNCH_FIRST' THEN 2
      WHEN 'LUNCH_SECOND' THEN 3
      WHEN 'DINNER' THEN 4
      ELSE 5
    END,
    d.title;
END;
$$;

REVOKE ALL ON FUNCTION public.get_kitchen_report(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_kitchen_report(date) TO authenticated;
