alter table public.sales add column if not exists importe numeric(12,2);
alter table public.sales add column if not exists regalo boolean not null default false;
update public.sales set importe = cantidad * precio where importe is null;
alter table public.sales alter column importe set not null;
alter table public.sales alter column importe set default 0;

drop function if exists public.register_sale(text, date, integer);
create or replace function public.register_sale(p_codigo text, p_fecha date, p_cantidad integer, p_importe numeric default null, p_regalo boolean default false)
returns public.sales
language plpgsql
security invoker
set search_path = public
as $$
declare
  p_row public.products;
  v_sale public.sales;
  v_importe numeric;
begin
  if p_codigo is null or btrim(p_codigo) = '' then raise exception 'Elegí un producto.'; end if;
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'La cantidad debe ser mayor a cero.'; end if;
  if p_importe is not null and p_importe < 0 then raise exception 'El importe no puede ser negativo.'; end if;
  select * into p_row from public.products where codigo = p_codigo for update;
  if not found then raise exception 'Producto no encontrado.'; end if;
  if p_row.cantidad < p_cantidad then raise exception 'Stock insuficiente: quedan %', p_row.cantidad; end if;
  if coalesce(p_regalo, false) then v_importe := 0;
  else v_importe := coalesce(p_importe, p_row.precio * p_cantidad); end if;
  update public.products set cantidad = cantidad - p_cantidad where codigo = p_codigo;
  insert into public.sales (fecha, codigo, nombre, cantidad, precio, importe, regalo, created_by)
    values (p_fecha, p_codigo, p_row.nombre, p_cantidad, p_row.precio, v_importe, coalesce(p_regalo,false), auth.uid())
    returning * into v_sale;
  return v_sale;
end;
$$;
grant execute on function public.register_sale(text, date, integer, numeric, boolean) to authenticated;