CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  unidad text NOT NULL DEFAULT 'unidades',
  cantidad numeric NOT NULL DEFAULT 0,
  minimo numeric NOT NULL DEFAULT 0,
  costo numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff can read materials" ON public.materials FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "staff can add materials" ON public.materials FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "staff can update materials" ON public.materials FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'staff')) WITH CHECK (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "staff can delete materials" ON public.materials FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'staff'));