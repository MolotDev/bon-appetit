-- Keep one daily_menu dish per meal type per day (including already locked dates).

ALTER TABLE public.daily_menu DISABLE TRIGGER daily_menu_deadline;
ALTER TABLE public.daily_menu DISABLE TRIGGER daily_menu_delete_deadline;
ALTER TABLE public.order_items DISABLE TRIGGER order_items_deadline;
ALTER TABLE public.order_items DISABLE TRIGGER order_items_delete_deadline;

WITH ranked AS (
  SELECT
    id,
    date,
    meal_type,
    row_number() OVER (PARTITION BY date, meal_type ORDER BY id) AS rn
  FROM public.daily_menu
),
extras AS (
  SELECT
    extra.id AS extra_id,
    keeper.id AS keep_id
  FROM ranked extra
  INNER JOIN ranked keeper
    ON keeper.date = extra.date
    AND keeper.meal_type = extra.meal_type
    AND keeper.rn = 1
  WHERE extra.rn > 1
)
DELETE FROM public.order_items oi
USING extras e
WHERE oi.daily_menu_id = e.extra_id
  AND EXISTS (
    SELECT 1
    FROM public.order_items kept
    WHERE kept.order_id = oi.order_id
      AND kept.daily_menu_id = e.keep_id
  );

WITH ranked AS (
  SELECT
    id,
    date,
    meal_type,
    row_number() OVER (PARTITION BY date, meal_type ORDER BY id) AS rn
  FROM public.daily_menu
),
extras AS (
  SELECT
    extra.id AS extra_id,
    keeper.id AS keep_id
  FROM ranked extra
  INNER JOIN ranked keeper
    ON keeper.date = extra.date
    AND keeper.meal_type = extra.meal_type
    AND keeper.rn = 1
  WHERE extra.rn > 1
)
UPDATE public.order_items oi
SET daily_menu_id = e.keep_id
FROM extras e
WHERE oi.daily_menu_id = e.extra_id;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY date, meal_type ORDER BY id) AS rn
  FROM public.daily_menu
)
DELETE FROM public.daily_menu dm
USING ranked r
WHERE dm.id = r.id
  AND r.rn > 1;

ALTER TABLE public.daily_menu
  ADD CONSTRAINT daily_menu_date_meal_type_unique UNIQUE (date, meal_type);

ALTER TABLE public.daily_menu ENABLE TRIGGER daily_menu_deadline;
ALTER TABLE public.daily_menu ENABLE TRIGGER daily_menu_delete_deadline;
ALTER TABLE public.order_items ENABLE TRIGGER order_items_deadline;
ALTER TABLE public.order_items ENABLE TRIGGER order_items_delete_deadline;
