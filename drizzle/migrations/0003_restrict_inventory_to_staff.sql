CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Existing users keep access as staff
INSERT INTO public.user_roles (user_id, role) SELECT id, 'staff' FROM auth.users ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "signed in users can add products" ON public.products;
DROP POLICY IF EXISTS "signed in users can delete products" ON public.products;
DROP POLICY IF EXISTS "signed in users can read products" ON public.products;
DROP POLICY IF EXISTS "signed in users can update products" ON public.products;
CREATE POLICY "staff can read products" ON public.products FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "staff can add products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "staff can update products" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'staff')) WITH CHECK (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "staff can delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'staff'));

DROP POLICY IF EXISTS "signed in users can add sales" ON public.sales;
DROP POLICY IF EXISTS "signed in users can delete sales" ON public.sales;
DROP POLICY IF EXISTS "signed in users can read sales" ON public.sales;
CREATE POLICY "staff can read sales" ON public.sales FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'staff'));
CREATE POLICY "staff can add sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'staff') AND (created_by IS NULL OR created_by = auth.uid()));
CREATE POLICY "staff can delete sales" ON public.sales FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'staff'));