-- ========================================
-- おうちキッチン — Supabase スキーマ
-- Supabase Dashboard > SQL Editor で実行
-- ========================================

create table if not exists ingredients (
  id          text primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  amount      text not null,
  kind        text not null,
  location    text not null,
  added_at    text not null,
  created_at  timestamptz default now()
);

create table if not exists presets (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  location    text not null,
  kind        text not null,
  name        text not null,
  unique (user_id, location, kind, name)
);

create table if not exists history (
  id          text primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  date        text not null,
  recipes     jsonb not null,
  ingredients jsonb not null,
  ratings     jsonb default '{}',
  memo        text default '',
  created_at  timestamptz default now()
);

-- Row Level Security
alter table ingredients enable row level security;
alter table presets     enable row level security;
alter table history     enable row level security;

create policy "own ingredients" on ingredients for all using (auth.uid() = user_id);
create policy "own presets"     on presets     for all using (auth.uid() = user_id);
create policy "own history"     on history     for all using (auth.uid() = user_id);

-- Settings（ユーザー設定）
create table if not exists settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  data    jsonb default '{}'
);
alter table settings enable row level security;
create policy "own settings" on settings for all using (auth.uid() = user_id);

-- レシピ集（保存済みレシピ）
create table if not exists saved_recipes (
  id             text primary key,
  user_id        uuid references auth.users(id) on delete cascade not null,
  title          text not null,
  genre          text default 'その他',
  source_type    text default 'manual',
  source_url     text default '',
  source_name    text default '',
  image_url      text default '',
  image_urls     jsonb default '[]',
  servings       numeric default 2,
  ingredients    jsonb default '[]',
  steps          jsonb default '[]',
  notes          text default '',
  cook_memo      text default '',
  tags           jsonb default '[]',
  favorite       boolean default false,
  cooked_count   integer default 0,
  last_cooked_at timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table saved_recipes add column if not exists image_urls jsonb default '[]';
alter table saved_recipes enable row level security;
create policy "own saved recipes" on saved_recipes for all using (auth.uid() = user_id);

-- レシピ写真（iPhone等から取り込んだ画像）
-- 公開URLは推測困難なUUIDですが、URLを知っている人は表示できます。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "own recipe image uploads" on storage.objects
for insert to authenticated
with check (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own recipe image updates" on storage.objects
for update to authenticated
using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own recipe image deletes" on storage.objects
for delete to authenticated
using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);
