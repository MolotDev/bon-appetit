-- DEV/TEST seed. Re-runnable.
-- Kyiv "tomorrow" is used for daily_menu and orders.
-- Login emails: {username}@bon-appetit.local
--
-- admin / admin123
-- ivan / ivan123
-- oksana / oksana123
-- petro / petro123

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public._seed_auth_user(
  p_id uuid,
  p_email text,
  p_password text,
  p_full_name text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_instance uuid;
BEGIN
  SELECT id INTO v_instance FROM auth.instances LIMIT 1;
  IF v_instance IS NULL THEN
    v_instance := '00000000-0000-0000-0000-000000000000';
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    v_instance,
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', p_full_name, 'username', split_part(p_email, '@', 1)),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_id,
    jsonb_build_object('sub', p_id::text, 'email', p_email),
    'email',
    p_email,
    now(),
    now(),
    now()
  );
END;
$$;

DELETE FROM auth.users
WHERE email IN (
  'admin@bon-appetit.local',
  'ivan@bon-appetit.local',
  'oksana@bon-appetit.local',
  'petro@bon-appetit.local'
);

DELETE FROM public.daily_menu;
DELETE FROM public.dishes;
DELETE FROM public.locations
WHERE name IN ('Офіс Центр', 'Офіс Лівобережна', 'Склад', 'Штаб');

SELECT public._seed_auth_user(
  'a0000000-0000-4000-8000-000000000001',
  'admin@bon-appetit.local',
  'admin123',
  'Адміністратор Системи'
);
SELECT public._seed_auth_user(
  'a0000000-0000-4000-8000-000000000002',
  'ivan@bon-appetit.local',
  'ivan123',
  'Іван Коваленко'
);
SELECT public._seed_auth_user(
  'a0000000-0000-4000-8000-000000000003',
  'oksana@bon-appetit.local',
  'oksana123',
  'Оксана Мельник'
);
SELECT public._seed_auth_user(
  'a0000000-0000-4000-8000-000000000004',
  'petro@bon-appetit.local',
  'petro123',
  'Петро Шевченко'
);

INSERT INTO public.locations (id, name) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Офіс Центр'),
  ('10000000-0000-4000-8000-000000000002', 'Офіс Лівобережна'),
  ('10000000-0000-4000-8000-000000000003', 'Склад'),
  ('10000000-0000-4000-8000-000000000004', 'Штаб');

INSERT INTO public.profiles (
  id, username, full_name, role, default_location_id, is_blocked, must_change_password
) VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'admin',
    'Адміністратор Системи',
    'ADMIN',
    '10000000-0000-4000-8000-000000000004',
    false,
    false
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'ivan',
    'Іван Коваленко',
    'USER',
    '10000000-0000-4000-8000-000000000001',
    false,
    false
  ),
  (
    'a0000000-0000-4000-8000-000000000003',
    'oksana',
    'Оксана Мельник',
    'USER',
    '10000000-0000-4000-8000-000000000002',
    false,
    false
  ),
  (
    'a0000000-0000-4000-8000-000000000004',
    'petro',
    'Петро Шевченко',
    'USER',
    '10000000-0000-4000-8000-000000000003',
    false,
    false
  );

INSERT INTO public.dishes (id, title, description, meal_type, is_active) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'Вівсяна каша', 'На молоці з ягодами', 'BREAKFAST', true),
  ('d0000000-0000-4000-8000-000000000002', 'Омлет з овочами', 'Яйця, перець, томати', 'BREAKFAST', true),
  ('d0000000-0000-4000-8000-000000000003', 'Сирники', 'Зі сметаною', 'BREAKFAST', true),
  ('d0000000-0000-4000-8000-000000000004', 'Борщ', 'З пампушками', 'LUNCH_FIRST', true),
  ('d0000000-0000-4000-8000-000000000005', 'Курячий бульйон', 'З локшиною', 'LUNCH_FIRST', true),
  ('d0000000-0000-4000-8000-000000000006', 'Гречка з котлетою', 'Котлета куряча', 'LUNCH_SECOND', true),
  ('d0000000-0000-4000-8000-000000000007', 'Плов', 'З куркою', 'LUNCH_SECOND', true),
  ('d0000000-0000-4000-8000-000000000008', 'Риба з овочами', 'Запечена', 'LUNCH_SECOND', true),
  ('d0000000-0000-4000-8000-000000000009', 'Запіканка', 'Картопляна', 'DINNER', true),
  ('d0000000-0000-4000-8000-000000000010', 'Салат Цезар', 'Курка, соус', 'DINNER', true);

DO $$
BEGIN
  ALTER TABLE public.daily_menu DISABLE TRIGGER daily_menu_deadline;
  ALTER TABLE public.orders DISABLE TRIGGER orders_deadline;
  ALTER TABLE public.order_items DISABLE TRIGGER order_items_deadline;
  ALTER TABLE public.order_items DISABLE TRIGGER order_items_delete_deadline;
  BEGIN
    ALTER TABLE public.daily_menu DISABLE TRIGGER daily_menu_delete_deadline;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
END;
$$;

DO $$
DECLARE
  v_tomorrow date := ((now() AT TIME ZONE 'Europe/Kyiv')::date + 1);
  v_menu_oats uuid := 'e0000000-0000-4000-8000-000000000001';
  v_menu_omelet uuid := 'e0000000-0000-4000-8000-000000000002';
  v_menu_borsch uuid := 'e0000000-0000-4000-8000-000000000003';
  v_menu_broth uuid := 'e0000000-0000-4000-8000-000000000004';
  v_menu_buckwheat uuid := 'e0000000-0000-4000-8000-000000000005';
  v_menu_plov uuid := 'e0000000-0000-4000-8000-000000000006';
  v_menu_bake uuid := 'e0000000-0000-4000-8000-000000000007';
  v_menu_salad uuid := 'e0000000-0000-4000-8000-000000000008';
  v_order_ivan uuid := 'f0000000-0000-4000-8000-000000000001';
  v_order_oksana uuid := 'f0000000-0000-4000-8000-000000000002';
  v_order_petro uuid := 'f0000000-0000-4000-8000-000000000003';
BEGIN
  INSERT INTO public.daily_menu (id, date, dish_id, meal_type) VALUES
    (v_menu_oats, v_tomorrow, 'd0000000-0000-4000-8000-000000000001', 'BREAKFAST'),
    (v_menu_omelet, v_tomorrow, 'd0000000-0000-4000-8000-000000000002', 'BREAKFAST'),
    (v_menu_borsch, v_tomorrow, 'd0000000-0000-4000-8000-000000000004', 'LUNCH_FIRST'),
    (v_menu_broth, v_tomorrow, 'd0000000-0000-4000-8000-000000000005', 'LUNCH_FIRST'),
    (v_menu_buckwheat, v_tomorrow, 'd0000000-0000-4000-8000-000000000006', 'LUNCH_SECOND'),
    (v_menu_plov, v_tomorrow, 'd0000000-0000-4000-8000-000000000007', 'LUNCH_SECOND'),
    (v_menu_bake, v_tomorrow, 'd0000000-0000-4000-8000-000000000009', 'DINNER'),
    (v_menu_salad, v_tomorrow, 'd0000000-0000-4000-8000-000000000010', 'DINNER');

  INSERT INTO public.orders (id, user_id, target_location_id, date, status) VALUES
    (
      v_order_ivan,
      'a0000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001',
      v_tomorrow,
      'PENDING'
    ),
    (
      v_order_oksana,
      'a0000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000002',
      v_tomorrow,
      'PENDING'
    ),
    (
      v_order_petro,
      'a0000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000003',
      v_tomorrow,
      'PENDING'
    );

  INSERT INTO public.order_items (order_id, daily_menu_id) VALUES
    (v_order_ivan, v_menu_oats),
    (v_order_ivan, v_menu_borsch),
    (v_order_ivan, v_menu_buckwheat),
    (v_order_oksana, v_menu_broth),
    (v_order_oksana, v_menu_plov),
    (v_order_oksana, v_menu_salad),
    (v_order_petro, v_menu_omelet),
    (v_order_petro, v_menu_bake);
END;
$$;

DO $$
BEGIN
  ALTER TABLE public.daily_menu ENABLE TRIGGER daily_menu_deadline;
  ALTER TABLE public.orders ENABLE TRIGGER orders_deadline;
  ALTER TABLE public.order_items ENABLE TRIGGER order_items_deadline;
  ALTER TABLE public.order_items ENABLE TRIGGER order_items_delete_deadline;
  BEGIN
    ALTER TABLE public.daily_menu ENABLE TRIGGER daily_menu_delete_deadline;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
END;
$$;

DROP FUNCTION public._seed_auth_user(uuid, text, text, text);
