create table if not exists public.website_feedback (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  message text not null,
  rating integer not null,
  created_at timestamptz not null default now(),
  constraint website_feedback_name_length check (char_length(name) <= 60),
  constraint website_feedback_message_length check (char_length(btrim(message)) between 8 and 1000),
  constraint website_feedback_rating_range check (rating between 1 and 5)
);

alter table public.website_feedback enable row level security;

create table if not exists public.website_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.website_admins enable row level security;

create table if not exists public.dish_suggestions (
  id uuid primary key default gen_random_uuid(),
  dish_name text not null,
  origin text not null,
  ingredients text not null,
  description text not null,
  status text not null default 'pending',
  submitted_at timestamptz not null default now(),
  constraint dish_suggestions_name_length check (char_length(btrim(dish_name)) between 2 and 100),
  constraint dish_suggestions_origin_length check (char_length(btrim(origin)) between 2 and 120),
  constraint dish_suggestions_ingredients_length check (char_length(btrim(ingredients)) between 3 and 500),
  constraint dish_suggestions_description_length check (char_length(btrim(description)) between 8 and 1000),
  constraint dish_suggestions_status check (status in ('pending', 'approved'))
);

alter table public.dish_suggestions enable row level security;

grant select, insert on public.website_feedback to anon, authenticated;
grant delete on public.website_feedback to authenticated;
grant select on public.website_admins to authenticated;
grant insert on public.dish_suggestions to anon, authenticated;
grant select, delete on public.dish_suggestions to authenticated;
grant update (status) on public.dish_suggestions to authenticated;

drop policy if exists "Anyone can read website feedback" on public.website_feedback;
create policy "Anyone can read website feedback"
  on public.website_feedback
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can post valid website feedback" on public.website_feedback;
create policy "Anyone can post valid website feedback"
  on public.website_feedback
  for insert
  to anon, authenticated
  with check (
    char_length(name) <= 60
    and char_length(btrim(message)) between 8 and 1000
    and rating between 1 and 5
  );

drop policy if exists "Admins can remove website feedback" on public.website_feedback;
create policy "Admins can remove website feedback"
  on public.website_feedback
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.website_admins
      where website_admins.user_id = (select auth.uid())
    )
  );

drop policy if exists "Admins can read their own administrator record" on public.website_admins;
create policy "Admins can read their own administrator record"
  on public.website_admins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Anyone can submit a dish suggestion" on public.dish_suggestions;
create policy "Anyone can submit a dish suggestion"
  on public.dish_suggestions
  for insert
  to anon, authenticated
  with check (
    char_length(btrim(dish_name)) between 2 and 100
    and char_length(btrim(origin)) between 2 and 120
    and char_length(btrim(ingredients)) between 3 and 500
    and char_length(btrim(description)) between 8 and 1000
    and status = 'pending'
  );

drop policy if exists "Admins can read dish suggestions" on public.dish_suggestions;
create policy "Admins can read dish suggestions"
  on public.dish_suggestions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.website_admins
      where website_admins.user_id = (select auth.uid())
    )
  );

drop policy if exists "Admins can review dish suggestions" on public.dish_suggestions;
create policy "Admins can review dish suggestions"
  on public.dish_suggestions
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.website_admins
      where website_admins.user_id = (select auth.uid())
    )
  )
  with check (
    status in ('pending', 'approved')
    and exists (
      select 1
      from public.website_admins
      where website_admins.user_id = (select auth.uid())
    )
  );

drop policy if exists "Admins can remove dish suggestions" on public.dish_suggestions;
create policy "Admins can remove dish suggestions"
  on public.dish_suggestions
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.website_admins
      where website_admins.user_id = (select auth.uid())
    )
  );
