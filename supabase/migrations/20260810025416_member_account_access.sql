create policy "Members read active vouchers"
on public.vouchers
for select
to authenticated
using (
  is_active
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

create index vouchers_active_window_idx
on public.vouchers (is_active, starts_at, ends_at);
