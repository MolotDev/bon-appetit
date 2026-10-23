-- Run in SQL editor after migrations. Compares Europe/Kyiv clock with deadline RPCs.

SELECT
  current_setting('TIMEZONE') AS session_timezone,
  now() AS utc_now,
  (now() AT TIME ZONE 'Europe/Kyiv') AS kyiv_now,
  (now() AT TIME ZONE 'Europe/Kyiv')::date AS kyiv_today,
  ((now() AT TIME ZONE 'Europe/Kyiv')::date + 1) AS kyiv_tomorrow,
  public.check_admin_menu_deadline(((now() AT TIME ZONE 'Europe/Kyiv')::date + 1)) AS admin_menu_open_for_tomorrow,
  public.check_user_order_deadline(((now() AT TIME ZONE 'Europe/Kyiv')::date + 1)) AS user_order_open_for_tomorrow,
  public.check_admin_menu_deadline((now() AT TIME ZONE 'Europe/Kyiv')::date) AS admin_menu_open_for_today,
  public.check_user_order_deadline((now() AT TIME ZONE 'Europe/Kyiv')::date) AS user_order_open_for_today;

-- Expected:
-- user_order_open_for_tomorrow = true until Kyiv midnight
-- user_order_open_for_today = false after Kyiv 00:00 of today
-- admin_menu_open_for_tomorrow = true only before 10:00 Kyiv today
-- admin_menu_open_for_today = false (deadline was 10:00 yesterday)
