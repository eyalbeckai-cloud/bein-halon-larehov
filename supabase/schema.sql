-- =====================================================================
--  בין חלון לרחוב — טבלת הזמנות
--  להרצה פעם אחת: Supabase > SQL Editor > New query > הדבקה > Run
--  בטוח להריץ שוב (לא מוחק נתונים קיימים).
-- =====================================================================

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     bigint generated always as identity (start with 1001) unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- מצב ההזמנה
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'payment_review', 'failed', 'shipped', 'cancelled', 'refunded')),

  -- מה הוזמן
  delivery_method  text not null check (delivery_method in ('shipping', 'pickup')),
  quantity         int  not null check (quantity between 1 and 10),
  unit_price       numeric(10,2) not null check (unit_price >= 0),
  shipping_fee     numeric(10,2) not null default 0 check (shipping_fee >= 0),
  total            numeric(10,2) not null check (total >= 0),
  currency         text not null default 'ILS',

  -- פרטי המזמין
  full_name        text not null check (char_length(full_name) between 2 and 80),
  phone            text not null check (char_length(phone) between 9 and 20),
  email            text not null check (char_length(email) between 5 and 120),

  -- כתובת (רק במשלוח)
  city             text check (char_length(city) <= 60),
  street           text check (char_length(street) <= 80),
  house_number     text check (char_length(house_number) <= 10),
  apartment        text check (char_length(apartment) <= 10),
  zip              text check (char_length(zip) <= 10),
  delivery_notes   text check (char_length(delivery_notes) <= 300),

  -- הסכמה לתקנון ולמדיניות הפרטיות
  terms_accepted_at timestamptz not null,

  -- PayPal
  paypal_order_id    text unique,
  paypal_capture_id  text,
  paypal_payer_email text,
  paypal_payer_name  text,
  paypal_shipping    jsonb,
  paid_at            timestamptz,

  -- לשימוש שלך
  shipped_at       timestamptz,
  admin_notes      text,

  constraint shipping_needs_address check (
    delivery_method = 'pickup'
    or (city is not null and street is not null and house_number is not null)
  )
);

-- ---------------------------------------------------------------------
--  אבטחה (RLS): אף אחד מבחוץ לא יכול לקרוא או לכתוב לטבלה.
--  רק פונקציית השרת (Edge Function) כותבת אליה, עם המפתח הסודי.
--  אתה רואה את ההזמנות ב-Supabase > Table Editor.
-- ---------------------------------------------------------------------
alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;

-- למי שכבר הריץ גרסה קודמת של הקובץ: מוסיף את עמודת דמי המשלוח
alter table public.orders add column if not exists shipping_fee numeric(10,2) not null default 0;

create index if not exists orders_status_idx on public.orders (status, created_at desc);

-- updated_at מתעדכן לבד
create or replace function public.orders_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.orders_touch_updated_at();

-- ---------------------------------------------------------------------
--  תצוגות נוחות (פתוחות רק לך, דרך לוח הבקרה של Supabase)
-- ---------------------------------------------------------------------

-- הזמנות ששולמו וממתינות למשלוח
create or replace view public.orders_to_ship
with (security_invoker = true) as
select
  order_number, paid_at, quantity, full_name, phone, email,
  city, street, house_number, apartment, zip, delivery_notes
from public.orders
where status = 'paid' and delivery_method = 'shipping'
order by paid_at;

-- הזמנות ששולמו וממתינות לאיסוף עצמי
create or replace view public.orders_to_pickup
with (security_invoker = true) as
select order_number, paid_at, quantity, full_name, phone, email
from public.orders
where status = 'paid' and delivery_method = 'pickup'
order by paid_at;

-- סיכום מכירות
create or replace view public.sales_summary
with (security_invoker = true) as
select
  count(*) filter (where status in ('paid', 'shipped'))                    as paid_orders,
  coalesce(sum(quantity) filter (where status in ('paid', 'shipped')), 0) as books_sold,
  coalesce(sum(total)    filter (where status in ('paid', 'shipped')), 0) as revenue_ils,
  count(*) filter (where status = 'paid' and delivery_method = 'shipping') as waiting_to_ship,
  count(*) filter (where status = 'paid' and delivery_method = 'pickup')   as waiting_for_pickup
from public.orders;

revoke all on public.orders_to_ship, public.orders_to_pickup, public.sales_summary from anon, authenticated;

-- ---------------------------------------------------------------------
--  שימושי:
--    סימון הזמנה כנשלחה:
--      update public.orders set status = 'shipped', shipped_at = now() where order_number = 1001;
--    מחיקת הזמנות שלא שולמו ונשארו פתוחות יותר משבוע:
--      delete from public.orders where status = 'pending' and created_at < now() - interval '7 days';
-- ---------------------------------------------------------------------
