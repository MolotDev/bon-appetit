ALTER TABLE public.orders
  DROP CONSTRAINT orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN ('PENDING', 'COOKING', 'IN_DELIVERY', 'COMPLETED', 'CANCELLED')
  );

ALTER TABLE public.orders
  ADD COLUMN cooking_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.enforce_order_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND public.is_admin()
     AND NEW.date IS NOT DISTINCT FROM OLD.date
     AND NEW.target_location_id IS NOT DISTINCT FROM OLD.target_location_id
     AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
  THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() AND TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.user_id = auth.uid()
     AND OLD.status IN ('COOKING', 'IN_DELIVERY')
     AND NEW.status IN ('COMPLETED', 'CANCELLED')
     AND NEW.date IS NOT DISTINCT FROM OLD.date
     AND NEW.target_location_id IS NOT DISTINCT FROM OLD.target_location_id
     AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
     AND NEW.cooking_started_at IS NOT DISTINCT FROM OLD.cooking_started_at
  THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NOT public.is_admin()
     AND OLD.status IN ('COOKING', 'IN_DELIVERY', 'COMPLETED')
  THEN
    RAISE EXCEPTION 'Order can no longer be edited after cooking has started'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.assert_user_order_deadline(NEW.date);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_order_item_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  order_row public.orders%ROWTYPE;
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  SELECT * INTO order_row
  FROM public.orders o
  WHERE o.id = NEW.order_id;

  IF order_row.id IS NULL THEN
    RAISE EXCEPTION 'Order % does not exist', NEW.order_id;
  END IF;

  IF order_row.status IN ('COOKING', 'IN_DELIVERY', 'COMPLETED')
     OR order_row.cooking_started_at IS NOT NULL
  THEN
    RAISE EXCEPTION 'Order items can no longer be changed after cooking has started'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.assert_user_order_deadline(order_row.date);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_order_item_delete_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  order_row public.orders%ROWTYPE;
BEGIN
  IF public.is_admin() THEN
    RETURN OLD;
  END IF;

  SELECT * INTO order_row
  FROM public.orders o
  WHERE o.id = OLD.order_id;

  IF order_row.status IN ('COOKING', 'IN_DELIVERY', 'COMPLETED')
     OR order_row.cooking_started_at IS NOT NULL
  THEN
    RAISE EXCEPTION 'Order items can no longer be changed after cooking has started'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.assert_user_order_deadline(order_row.date);
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_kitchen_cooking(target_date date)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only ADMIN can start kitchen cooking'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.orders
  SET
    status = 'COOKING',
    cooking_started_at = coalesce(cooking_started_at, now())
  WHERE date = target_date
    AND status = 'PENDING';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_order_received(target_order_id uuid)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.orders;
BEGIN
  UPDATE public.orders
  SET status = 'COMPLETED'
  WHERE id = target_order_id
    AND user_id = auth.uid()
    AND status IN ('COOKING', 'IN_DELIVERY')
  RETURNING * INTO updated_row;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'Order cannot be marked as received'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN updated_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_own_order(target_order_id uuid)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.orders;
  updated_row public.orders;
BEGIN
  SELECT * INTO current_row
  FROM public.orders
  WHERE id = target_order_id
    AND user_id = auth.uid();

  IF current_row.id IS NULL THEN
    RAISE EXCEPTION 'Order not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF current_row.status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Order cannot be cancelled'
      USING ERRCODE = 'P0001';
  END IF;

  IF current_row.status = 'PENDING' THEN
    PERFORM public.assert_user_order_deadline(current_row.date);
  ELSIF current_row.status NOT IN ('COOKING', 'IN_DELIVERY') THEN
    RAISE EXCEPTION 'Order cannot be cancelled'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders
  SET status = 'CANCELLED'
  WHERE id = current_row.id
  RETURNING * INTO updated_row;

  RETURN updated_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_kitchen_cancelled_after_cooking(target_date date)
RETURNS TABLE (
  full_name text,
  dish_title text,
  meal_type text
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
    p.full_name,
    d.title AS dish_title,
    dm.meal_type
  FROM public.orders o
  INNER JOIN public.profiles p ON p.id = o.user_id
  INNER JOIN public.order_items oi ON oi.order_id = o.id
  INNER JOIN public.daily_menu dm ON dm.id = oi.daily_menu_id
  INNER JOIN public.dishes d ON d.id = dm.dish_id
  WHERE o.date = target_date
    AND o.status = 'CANCELLED'
    AND o.cooking_started_at IS NOT NULL
    AND dm.date = target_date
  ORDER BY
    p.full_name,
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

REVOKE ALL ON FUNCTION public.start_kitchen_cooking(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_order_received(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_own_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_kitchen_cancelled_after_cooking(date) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.start_kitchen_cooking(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_received(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_own_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_kitchen_cancelled_after_cooking(date) TO authenticated;
