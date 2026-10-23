-- PWA Web Push subscriptions (VAPID)

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

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
