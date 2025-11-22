create table if not exists user_credits (
  telegram_user_id bigint primary key,
  credits int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null,
  xtr_amount int not null,
  credits_added int not null,
  paid_at timestamptz not null,
  payment_ref text unique,
  payload jsonb,
  status text default 'pending',
  error text
);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_id bigint not null,
  invitee_id bigint not null unique,
  created_at timestamptz not null default now()
);