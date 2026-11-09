-- Shared inventory: products (stock) and sales (daily sales)
create table public.products (
  codigo text primary key,
  nombre text not null,
  cantidad integer not null default 0,
  precio numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  codigo text not null,
  nombre text not null,
  cantidad integer not null,
  precio numeric(12,2) not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index sales_fecha_idx on public.sales (fecha);
create index sales_codigo_idx on public.sales (codigo);

-- Data API needs explicit grants on the public schema
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signed in users can read products"
  ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "signed in users can add products"
  ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "signed in users can update products"
  ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "signed in users can delete products"
  ON public.products FOR DELETE TO authenticated USING (true);

CREATE POLICY "signed in users can read sales"
  ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "signed in users can add sales"
  ON public.sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "signed in users can delete sales"
  ON public.sales FOR DELETE TO authenticated USING (true);

-- Register a sale atomically: checks stock, decrements it and records the sale.
create or replace function public.register_sale(p_codigo text, p_fecha date, p_cantidad integer)
returns public.sales
language plpgsql
security invoker
as $$
declare
  p_row public.products;
  v_sale public.sales;
begin
  if p_codigo is null or btrim(p_codigo) = '' then
    raise exception 'Elegí un producto.';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a cero.';
  end if;

  select * into p_row from public.products where codigo = p_codigo for update;
  if not found then
    raise exception 'Producto no encontrado.';
  end if;
  if p_row.cantidad < p_cantidad then
    raise exception 'Stock insuficiente: quedan %', p_row.cantidad;
  end if;

  update public.products set cantidad = cantidad - p_cantidad where codigo = p_codigo;

  insert into public.sales (fecha, codigo, nombre, cantidad, precio, created_by)
    values (p_fecha, p_codigo, p_row.nombre, p_cantidad, p_row.precio, auth.uid())
    returning * into v_sale;

  return v_sale;
end;
$$;

-- Cancel a sale: removes it and returns the units to stock.
create or replace function public.undo_sale(p_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  s public.sales;
begin
  select * into s from public.sales where id = p_id for update;
  if not found then
    return;
  end if;
  delete from public.sales where id = p_id;
  update public.products set cantidad = cantidad + s.cantidad where codigo = s.codigo;
end;
$$;

GRANT EXECUTE ON FUNCTION public.register_sale(text, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_sale(uuid) TO authenticated;

-- Live updates between phones
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;