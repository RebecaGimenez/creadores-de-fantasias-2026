CREATE TABLE public.team_invites (
  email text PRIMARY KEY,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.team_invites TO service_role;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.list_team()
RETURNS TABLE(email text, estado text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'staff') THEN RAISE EXCEPTION 'Sin permiso'; END IF;
  RETURN QUERY
    SELECT lower(u.email)::text, 'activo'::text FROM auth.users u JOIN public.user_roles r ON r.user_id = u.id AND r.role = 'staff'
    UNION
    SELECT i.email, 'pendiente'::text FROM public.team_invites i
      WHERE NOT EXISTS (SELECT 1 FROM auth.users u JOIN public.user_roles r ON r.user_id = u.id AND r.role='staff' WHERE lower(u.email) = i.email)
    ORDER BY 1;
END $$;

CREATE OR REPLACE FUNCTION public.add_team_member(_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e text := lower(trim(_email)); uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'staff') THEN RAISE EXCEPTION 'Sin permiso'; END IF;
  IF e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Email no válido'; END IF;
  SELECT id INTO uid FROM auth.users WHERE lower(email) = e LIMIT 1;
  IF uid IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (uid, 'staff') ON CONFLICT DO NOTHING;
    RETURN 'activo';
  END IF;
  INSERT INTO public.team_invites(email, invited_by) VALUES (e, auth.uid()) ON CONFLICT DO NOTHING;
  RETURN 'pendiente';
END $$;

CREATE OR REPLACE FUNCTION public.remove_team_member(_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e text := lower(trim(_email));
BEGIN
  IF NOT public.has_role(auth.uid(), 'staff') THEN RAISE EXCEPTION 'Sin permiso'; END IF;
  IF e = (SELECT lower(email) FROM auth.users WHERE id = auth.uid()) THEN RAISE EXCEPTION 'No podés quitarte a vos misma'; END IF;
  DELETE FROM public.team_invites WHERE email = e;
  DELETE FROM public.user_roles WHERE role = 'staff' AND user_id IN (SELECT id FROM auth.users WHERE lower(email) = e);
END $$;

CREATE OR REPLACE FUNCTION public.claim_team_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS NOT NULL AND EXISTS (SELECT 1 FROM public.team_invites WHERE email = lower(NEW.email)) THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'staff') ON CONFLICT DO NOTHING;
    DELETE FROM public.team_invites WHERE email = lower(NEW.email);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_claim_invite AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.claim_team_invite();

REVOKE EXECUTE ON FUNCTION public.list_team(), public.add_team_member(text), public.remove_team_member(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.list_team(), public.add_team_member(text), public.remove_team_member(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_team_invite() FROM anon, authenticated, public;