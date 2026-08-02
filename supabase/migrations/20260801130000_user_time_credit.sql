-- Shared time credits: minutes a player received from another player's session
alter table users
  add column if not exists time_credit_minutes integer not null default 0;
