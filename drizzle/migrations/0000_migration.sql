CREATE TABLE public.ap_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ap_events TO authenticated;
GRANT ALL ON public.ap_events TO service_role;
ALTER TABLE public.ap_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events read" ON public.ap_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own events insert" ON public.ap_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own events reset" ON public.ap_events FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX ap_events_user_created ON public.ap_events (user_id, created_at);