begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

select has_view('public', 'admin_request_feed', 'bounded admin request feed exists');
select has_index('public', 'orders', 'orders_created_at_idx', 'orders list has a created-at index');
select has_index('public', 'orders', 'orders_status_created_idx', 'orders status filter has a matching index');
select has_index('public', 'booking_requests', 'booking_requests_created_at_idx', 'booking list has a created-at index');
select has_index('public', 'booking_requests', 'booking_requests_status_created_idx', 'booking status filter has a matching index');
select has_index('public', 'customer_requests', 'customer_requests_created_at_idx', 'customer request list has a created-at index');
select has_index('public', 'vouchers', 'vouchers_created_at_idx', 'voucher list has a created-at index');

select * from finish();
rollback;
