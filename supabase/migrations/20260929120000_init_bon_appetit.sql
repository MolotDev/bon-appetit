-- bon-appetit: core schema, RLS, Europe/Kyiv deadline + report RPCs
-- Execution order: tables -> ENABLE RLS -> helpers/policies/RPCs/triggers

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  CONSTRAINT locations_name_unique UNIQUE (name),
  CONSTRAINT locations_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'USER',
  default_location_id uuid REFERENCES public.locations (id) ON DELETE SET NULL,
  is_blocked boolean NOT NULL DEFAULT false,
  must_change_password boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_unique UNIQUE (username),
  CONSTRAINT profiles_username_not_blank CHECK (length(trim(username)) > 0),
  CONSTRAINT profiles_role_check CHECK (role IN ('ADMIN', 'USER'))
);

CREATE TABLE public.dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  meal_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT dishes_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT dishes_meal_type_check CHECK (
    meal_type IN ('BREAKFAST', 'LUNCH_FIRST', 'LUNCH_SECOND', 'DINNER')
  )
);

CREATE TABLE public.daily_menu (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  dish_id uuid NOT NULL REFERENCES public.dishes (id) ON DELETE RESTRICT,
  meal_type text NOT NULL,
  CONSTRAINT daily_menu_meal_type_check CHECK (
    meal_type IN ('BREAKFAST', 'LUNCH_FIRST', 'LUNCH_SECOND', 'DINNER')
  ),
  CONSTRAINT daily_menu_date_dish_unique UNIQUE (date, dish_id)
);

CREATE INDEX daily_menu_date_idx ON public.daily_menu (date);
CREATE INDEX daily_menu_dish_id_idx ON public.daily_menu (dish_id);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  target_location_id uuid NOT NULL REFERENCES public.locations (id) ON DELETE RESTRICT,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_status_check CHECK (
    status IN ('PENDING', 'IN_DELIVERY', 'COMPLETED', 'CANCELLED')
  ),
  CONSTRAINT orders_user_date_unique UNIQUE (user_id, date)
);

CREATE INDEX orders_date_idx ON public.orders (date);
CREATE INDEX orders_user_id_idx ON public.orders (user_id);
CREATE INDEX orders_target_location_id_idx ON public.orders (target_location_id);
CREATE INDEX orders_status_idx ON public.orders (status);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  daily_menu_id uuid NOT NULL REFERENCES public.daily_menu (id) ON DELETE RESTRICT,
  CONSTRAINT order_items_order_menu_unique UNIQUE (order_id, daily_menu_id)
);

CREATE INDEX order_items_order_id_idx ON public.order_items (order_id);
CREATE INDEX order_items_daily_menu_id_idx ON public.order_items (daily_menu_id);

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint),
  CONSTRAINT push_subscriptions_endpoint_not_blank CHECK (length(trim(endpoint)) > 0),
  CONSTRAINT push_subscriptions_p256dh_not_blank CHECK (length(trim(p256dh)) > 0),
  CONSTRAINT push_subscriptions_auth_not_blank CHECK (length(trim(auth)) > 0)
);

CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions (user_id);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.locations, public.dishes, public.daily_menu TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.orders, public.order_items, public.push_subscriptions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.locations, public.dishes, public.daily_menu TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Enable RLS (policies come after helper functions)
-- ---------------------------------------------------------------------------

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Helper functions (LANGUAGE sql is planned at CREATE time — tables must exist)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.now_kyiv()
RETURNS timestamp
LANGUAGE sql
STABLE
AS $$
  SELECT (now() AT TIME ZONE 'Europe/Kyiv');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.role = 'ADMIN' AND NOT p.is_blocked
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_blocked_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_blocked FROM public.profiles p WHERE p.id = auth.uid()),
    true
  );
$$;

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

REVOKE ALL ON FUNCTION public.now_kyiv() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_blocked_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_password_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.now_kyiv() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS policies
-- ---------------------------------------------------------------------------

CREATE POLICY locations_select_authenticated
  ON public.locations
  FOR SELECT
  TO authenticated
  USING (NOT public.is_blocked_user());

CREATE POLICY locations_write_admin
  ON public.locations
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_admin_all
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY dishes_select_authenticated
  ON public.dishes
  FOR SELECT
  TO authenticated
  USING (NOT public.is_blocked_user());

CREATE POLICY dishes_write_admin
  ON public.dishes
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY daily_menu_select_authenticated
  ON public.daily_menu
  FOR SELECT
  TO authenticated
  USING (NOT public.is_blocked_user());

CREATE POLICY daily_menu_write_admin
  ON public.daily_menu
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY orders_select_own_or_admin
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (user_id = auth.uid() AND NOT public.is_blocked_user())
  );

CREATE POLICY orders_insert_own_or_admin
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      user_id = auth.uid()
      AND NOT public.is_blocked_user()
    )
  );

CREATE POLICY orders_update_own_or_admin
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (user_id = auth.uid() AND NOT public.is_blocked_user())
  )
  WITH CHECK (
    public.is_admin()
    OR (user_id = auth.uid() AND NOT public.is_blocked_user())
  );

CREATE POLICY orders_delete_own_or_admin
  ON public.orders
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR (user_id = auth.uid() AND NOT public.is_blocked_user())
  );

CREATE POLICY order_items_select_own_or_admin
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.user_id = auth.uid()
        AND NOT public.is_blocked_user()
    )
  );

CREATE POLICY order_items_insert_own_or_admin
  ON public.order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.user_id = auth.uid()
        AND NOT public.is_blocked_user()
    )
  );

CREATE POLICY order_items_update_own_or_admin
  ON public.order_items
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.user_id = auth.uid()
        AND NOT public.is_blocked_user()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.user_id = auth.uid()
        AND NOT public.is_blocked_user()
    )
  );

CREATE POLICY order_items_delete_own_or_admin
  ON public.order_items
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.user_id = auth.uid()
        AND NOT public.is_blocked_user()
    )
  );

CREATE POLICY push_subscriptions_select_own_or_admin
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (user_id = auth.uid() AND NOT public.is_blocked_user())
  );

CREATE POLICY push_subscriptions_insert_own_or_admin
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (user_id = auth.uid() AND NOT public.is_blocked_user())
  );

CREATE POLICY push_subscriptions_update_own_or_admin
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (user_id = auth.uid() AND NOT public.is_blocked_user())
  )
  WITH CHECK (
    public.is_admin()
    OR (user_id = auth.uid() AND NOT public.is_blocked_user())
  );

CREATE POLICY push_subscriptions_delete_own_or_admin
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR (user_id = auth.uid() AND NOT public.is_blocked_user())
  );

-- ---------------------------------------------------------------------------
-- 5. Deadline RPCs, integrity triggers, reports
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_daily_menu_meal_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  dish_meal text;
BEGIN
  SELECT d.meal_type INTO dish_meal
  FROM public.dishes d
  WHERE d.id = NEW.dish_id;

  IF dish_meal IS NULL THEN
    RAISE EXCEPTION 'Dish % does not exist', NEW.dish_id;
  END IF;

  IF NEW.meal_type IS DISTINCT FROM dish_meal THEN
    RAISE EXCEPTION
      'daily_menu.meal_type (%) must match dishes.meal_type (%)',
      NEW.meal_type,
      dish_meal;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER daily_menu_sync_meal_type
  BEFORE INSERT OR UPDATE OF dish_id, meal_type
  ON public.daily_menu
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_daily_menu_meal_type();

CREATE OR REPLACE FUNCTION public.check_admin_menu_deadline(target_date date)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET timezone = 'UTC'
AS $$
DECLARE
  deadline timestamptz;
BEGIN
  IF target_date IS NULL THEN
    RAISE EXCEPTION 'target_date is required';
  END IF;

  deadline := ((target_date - 1) + time '10:00') AT TIME ZONE 'Europe/Kyiv';

  RETURN now() < deadline;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_user_order_deadline(target_date date)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET timezone = 'UTC'
AS $$
DECLARE
  deadline timestamptz;
BEGIN
  IF target_date IS NULL THEN
    RAISE EXCEPTION 'target_date is required';
  END IF;

  deadline := (target_date::timestamp) AT TIME ZONE 'Europe/Kyiv';

  RETURN now() < deadline;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_admin_menu_deadline(target_date date)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.check_admin_menu_deadline(target_date) THEN
    RAISE EXCEPTION
      'Menu deadline passed: menu for % must be saved before 10:00 Europe/Kyiv on %',
      target_date,
      (target_date - 1)
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_user_order_deadline(target_date date)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.check_user_order_deadline(target_date) THEN
    RAISE EXCEPTION
      'Order deadline passed: orders for % must be saved before 00:00 Europe/Kyiv on that date (until 23:59 on %)',
      target_date,
      (target_date - 1)
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_daily_menu_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.assert_admin_menu_deadline(NEW.date);
  RETURN NEW;
END;
$$;

CREATE TRIGGER daily_menu_deadline
  BEFORE INSERT OR UPDATE OF date, dish_id, meal_type
  ON public.daily_menu
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_daily_menu_deadline();

CREATE OR REPLACE FUNCTION public.enforce_daily_menu_delete_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.assert_admin_menu_deadline(OLD.date);
  RETURN OLD;
END;
$$;

CREATE TRIGGER daily_menu_delete_deadline
  BEFORE DELETE
  ON public.daily_menu
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_daily_menu_delete_deadline();

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

  PERFORM public.assert_user_order_deadline(NEW.date);
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_deadline
  BEFORE INSERT OR UPDATE
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_deadline();

CREATE OR REPLACE FUNCTION public.enforce_order_item_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  order_date date;
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  SELECT o.date INTO order_date
  FROM public.orders o
  WHERE o.id = NEW.order_id;

  IF order_date IS NULL THEN
    RAISE EXCEPTION 'Order % does not exist', NEW.order_id;
  END IF;

  PERFORM public.assert_user_order_deadline(order_date);
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_items_deadline
  BEFORE INSERT OR UPDATE
  ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_item_deadline();

CREATE OR REPLACE FUNCTION public.enforce_order_item_delete_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  order_date date;
BEGIN
  IF public.is_admin() THEN
    RETURN OLD;
  END IF;

  SELECT o.date INTO order_date
  FROM public.orders o
  WHERE o.id = OLD.order_id;

  PERFORM public.assert_user_order_deadline(order_date);
  RETURN OLD;
END;
$$;

CREATE TRIGGER order_items_delete_deadline
  BEFORE DELETE
  ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_item_delete_deadline();

CREATE OR REPLACE FUNCTION public.get_kitchen_report(target_date date)
RETURNS TABLE (
  dish_title text,
  meal_type text,
  portions bigint
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
    count(*)::bigint AS portions
  FROM public.order_items oi
  INNER JOIN public.orders o ON o.id = oi.order_id
  INNER JOIN public.daily_menu dm ON dm.id = oi.daily_menu_id
  INNER JOIN public.dishes d ON d.id = dm.dish_id
  WHERE o.date = target_date
    AND o.status <> 'CANCELLED'
    AND dm.date = target_date
  GROUP BY d.title, dm.meal_type
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

CREATE OR REPLACE FUNCTION public.get_delivery_report(target_date date)
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

REVOKE ALL ON FUNCTION public.check_admin_menu_deadline(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_user_order_deadline(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_kitchen_report(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_delivery_report(date) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.check_admin_menu_deadline(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_order_deadline(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_kitchen_report(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_report(date) TO authenticated;
