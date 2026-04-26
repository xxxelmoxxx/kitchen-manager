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
