create or replace function public.undo_sale(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_codigo text;
  v_cant integer;
begin
  delete from public.sales where id = p_id returning codigo, cantidad into v_codigo, v_cant;
  if not found then
    raise exception 'No se encontró la venta';
  end if;
  update public.products set cantidad = cantidad + v_cant where codigo = v_codigo;
end;
$$;
GRANT EXECUTE ON FUNCTION public.undo_sale(uuid) TO authenticated;