-- =====================================================================
-- Proval Drive : schéma de la base Supabase (PostgreSQL)
-- À exécuter une fois dans Supabase > SQL Editor, puis exécuter seed.sql.
-- =====================================================================

-- ---------- Tables ----------

create table public.categories (
  id    text primary key,
  name  text not null,
  emoji text not null default '',
  aisle int  not null default 99
);

create table public.products (
  id         text primary key default 'p' || substr(md5(random()::text), 1, 10),
  name       text not null check (length(name) between 1 and 120),
  cat        text not null references public.categories(id),
  price      numeric(10,2) not null check (price >= 0),
  unit       text not null check (unit in ('piece', 'kg')),
  step       numeric(6,3) not null default 1 check (step > 0),
  available  boolean not null default true,
  temp       text not null default 'sec' check (temp in ('sec', 'frais', 'surgele')),
  format     text not null default '',
  origin     text not null default '',
  emoji      text not null default '🛒',
  max_qty    numeric(6,2) check (max_qty > 0),
  updated_at timestamptz not null default now()
);

create table public.settings (
  id            int primary key default 1 check (id = 1),
  slot_minutes  int not null default 30 check (slot_minutes between 10 and 120),
  capacity      int not null default 4 check (capacity between 1 and 50),
  min_order     numeric(10,2) not null default 20 check (min_order >= 0),
  lead_hours    int not null default 2 check (lead_hours between 0 and 48),
  days_ahead    int not null default 7 check (days_ahead between 1 and 30),
  open_time     time not null default '09:00',
  close_time    time not null default '19:00',
  closed_days   int[] not null default '{0}',          -- 0 = dimanche
  parking_spots int not null default 4 check (parking_spots between 1 and 20),
  weight_margin numeric(4,3) not null default 0.10 check (weight_margin between 0 and 0.5),
  check (open_time < close_time)
);
insert into public.settings (id) values (1);

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  name       text not null default '',
  phone      text not null default '',
  plate      text not null default '',
  role       text not null default 'client' check (role in ('client', 'staff', 'admin')),
  created_at timestamptz not null default now()
);

create sequence public.order_seq start 1001;

create table public.orders (
  id           text primary key default 'PD-' || nextval('public.order_seq'),
  user_id      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  customer     jsonb not null,
  slot_date    date not null,
  slot_start   time not null,
  slot_end     time not null,
  status       text not null default 'recue'
               check (status in ('recue', 'preparation', 'prete', 'arrive', 'retiree', 'annulee')),
  items        jsonb not null,
  estimated    numeric(10,2) not null,
  preauth      numeric(10,2) not null,
  final        numeric(10,2),
  capped       boolean not null default false,
  bin          text not null default '',
  spot         int,
  arrived_at   timestamptz,
  picked_up_at timestamptz,
  refunded     boolean not null default false,
  pickup_code  text not null default lpad((floor(random() * 9000) + 1000)::int::text, 4, '0'),
  history      jsonb not null default '[]'
);
create index orders_slot_idx on public.orders (slot_date, slot_start);
create index orders_user_idx on public.orders (user_id, created_at desc);

-- ---------- Rôles ----------

create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon')
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role_name() in ('staff', 'admin')
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role_name() = 'admin'
$$;

-- Un profil « client » est créé automatiquement pour chaque nouveau compte.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Sécurité (Row Level Security) ----------

alter table public.categories enable row level security;
alter table public.products   enable row level security;
alter table public.settings   enable row level security;
alter table public.profiles   enable row level security;
alter table public.orders     enable row level security;

-- Catalogue et réglages : lisibles par tous, modifiables par l'administrateur.
create policy categories_read  on public.categories for select using (true);
create policy categories_admin on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_read    on public.products   for select using (true);
create policy products_admin   on public.products   for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy settings_read    on public.settings   for select using (true);
create policy settings_admin   on public.settings   for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Profils : chacun voit le sien, l'équipe voit tout. Le rôle ne se change que dans le SQL Editor.
create policy profiles_read   on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (name, phone, plate) on public.profiles to authenticated;

-- Commandes : le client voit les siennes, l'équipe voit et modifie tout.
-- Les clients ne créent et ne modifient leurs commandes que par les fonctions ci-dessous.
create policy orders_read   on public.orders for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy orders_staff  on public.orders for update to authenticated using (public.is_staff()) with check (public.is_staff());
revoke insert, delete on public.orders from anon, authenticated;
revoke update on public.orders from anon;

-- ---------- Fonctions appelées par l'application ----------

-- Passer une commande : prix, créneau, minimum et capacité sont vérifiés côté serveur.
create or replace function public.place_order(p_customer jsonb, p_slot_date date, p_slot_start time, p_lines jsonb)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  s        public.settings;
  v_today  date := (now() at time zone 'Europe/Paris')::date;
  v_end    time;
  v_booked int;
  v_items  jsonb := '[]'::jsonb;
  v_est    numeric := 0;
  v_pre    numeric := 0;
  v_qty    numeric;
  v_max    numeric;
  v_name   text := left(trim(coalesce(p_customer->>'name', '')), 120);
  v_phone  text := left(trim(coalesce(p_customer->>'phone', '')), 30);
  v_plate  text := left(trim(coalesce(p_customer->>'plate', '')), 20);
  v_email  text;
  l        jsonb;
  p        record;
  v_order  public.orders;
begin
  if auth.uid() is null then raise exception 'Connexion requise pour commander'; end if;
  if v_name = '' or v_phone = '' then raise exception 'Nom et téléphone obligatoires'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Panier vide'; end if;
  if jsonb_array_length(p_lines) > 100 then raise exception 'Panier trop grand'; end if;

  select * into s from public.settings where id = 1;
  v_end := p_slot_start + make_interval(mins => s.slot_minutes);

  if extract(dow from p_slot_date)::int = any (s.closed_days) then raise exception 'Le drive est fermé ce jour-là'; end if;
  if p_slot_date < v_today or p_slot_date >= v_today + s.days_ahead then raise exception 'Date de retrait hors période'; end if;
  if p_slot_start < s.open_time or v_end > s.close_time or v_end <= p_slot_start
     or (extract(epoch from (p_slot_start - s.open_time)) / 60)::int % s.slot_minutes <> 0 then
    raise exception 'Créneau invalide';
  end if;
  if ((p_slot_date + p_slot_start) at time zone 'Europe/Paris') < now() + make_interval(hours => s.lead_hours) then
    raise exception 'Ce créneau est trop proche, choisissez-en un plus tard';
  end if;

  -- Un seul client à la fois réserve un créneau donné.
  perform pg_advisory_xact_lock(hashtext(p_slot_date::text || ' ' || p_slot_start::text));
  select count(*) into v_booked from public.orders
   where slot_date = p_slot_date and slot_start = p_slot_start and status <> 'annulee';
  if v_booked >= s.capacity then raise exception 'Ce créneau est complet, choisissez-en un autre'; end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    select pr.*, coalesce(c.aisle, 99) as aisle into p
      from public.products pr left join public.categories c on c.id = pr.cat
     where pr.id = l->>'productId';
    if not found or not p.available then raise exception 'Produit indisponible : %', coalesce(p.name, l->>'productId'); end if;
    v_qty := (l->>'qty')::numeric;
    v_max := coalesce(p.max_qty, case when p.unit = 'kg' then 5 else 10 end);
    if v_qty is null or v_qty <= 0 or v_qty > v_max then raise exception 'Quantité invalide pour %', p.name; end if;
    if p.unit = 'piece' and v_qty <> trunc(v_qty) then raise exception 'Quantité invalide pour %', p.name; end if;

    v_est := v_est + p.price * v_qty;
    v_pre := v_pre + p.price * v_qty * (case when p.unit = 'kg' then 1 + s.weight_margin else 1 end);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'productId', p.id, 'name', p.name, 'emoji', p.emoji, 'unit', p.unit, 'price', p.price,
      'cat', p.cat, 'aisle', p.aisle, 'temp', p.temp, 'qty', v_qty,
      'allowSub', coalesce((l->>'allowSub')::boolean, true),
      'pick', null, 'actualQty', null, 'sub', null));
  end loop;

  if round(v_est, 2) < s.min_order then raise exception 'Minimum de commande : % €', s.min_order; end if;

  select email into v_email from auth.users where id = auth.uid();
  update public.profiles set name = v_name, phone = v_phone, plate = v_plate where id = auth.uid();

  insert into public.orders (user_id, customer, slot_date, slot_start, slot_end, items, estimated, preauth, history)
  values (auth.uid(),
          jsonb_build_object('name', v_name, 'phone', v_phone, 'email', v_email, 'plate', v_plate),
          p_slot_date, p_slot_start, v_end, v_items, round(v_est, 2), round(v_pre, 2),
          jsonb_build_array(jsonb_build_object('status', 'recue', 'at', now())))
  returning * into v_order;
  return v_order;
end $$;

-- Le client signale son arrivée sur le parking.
create or replace function public.customer_arrived(p_id text, p_spot int) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_spot is null or p_spot < 1 or p_spot > (select parking_spots from public.settings where id = 1) then
    raise exception 'Numéro de place invalide';
  end if;
  update public.orders
     set status = 'arrive', spot = p_spot, arrived_at = now(),
         history = history || jsonb_build_array(jsonb_build_object('status', 'arrive', 'at', now()))
   where id = p_id and user_id = auth.uid() and status = 'prete';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Commande introuvable ou pas encore prête'; end if;
end $$;

-- Le client annule sa commande tant que la préparation n'a pas commencé.
create or replace function public.customer_cancel(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.orders
     set status = 'annulee',
         history = history || jsonb_build_array(jsonb_build_object('status', 'annulee', 'at', now()))
   where id = p_id and user_id = auth.uid() and status = 'recue';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Cette commande ne peut plus être annulée en ligne'; end if;
end $$;

-- Nombre de commandes par créneau (sans aucune donnée personnelle), pour afficher les places restantes.
create or replace function public.slot_counts(p_from date, p_to date)
returns table (slot_date date, slot_start time, booked int)
language sql stable security definer set search_path = public as $$
  select o.slot_date, o.slot_start, count(*)::int
    from public.orders o
   where o.status <> 'annulee' and o.slot_date between p_from and p_to
   group by o.slot_date, o.slot_start
$$;

revoke execute on function public.place_order(jsonb, date, time, jsonb) from public, anon;
revoke execute on function public.customer_arrived(text, int)        from public, anon;
revoke execute on function public.customer_cancel(text)              from public, anon;
grant  execute on function public.place_order(jsonb, date, time, jsonb) to authenticated;
grant  execute on function public.customer_arrived(text, int)        to authenticated;
grant  execute on function public.customer_cancel(text)              to authenticated;
grant  execute on function public.slot_counts(date, date)            to anon, authenticated;

-- ---------- Temps réel ----------
alter publication supabase_realtime add table public.orders, public.products, public.settings;
