alter table public.orders
add column receipt_token uuid not null default gen_random_uuid() unique;

comment on column public.orders.receipt_token is
  'High-entropy bearer capability used only to read a guest-safe order receipt.';

create function public.issue_order_receipt(p_idempotency_key uuid)
returns table (order_id uuid, receipt_token uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select orders.id, orders.receipt_token
  from public.orders
  where orders.idempotency_key = p_idempotency_key
    and orders.user_id is not distinct from (select auth.uid())
$$;

create function public.get_order_receipt(p_order_id uuid, p_receipt_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', orders.id,
    'number', orders.order_number,
    'customerName', orders.customer_name,
    'customerPhone', orders.customer_phone,
    'fulfillment', orders.fulfillment,
    'pickupAt', orders.pickup_at,
    'deliveryAddress', orders.delivery_address,
    'note', orders.note,
    'subtotalVnd', orders.subtotal_vnd,
    'discountVnd', orders.discount_vnd,
    'totalVnd', orders.total_vnd,
    'paymentMethod', orders.payment_method,
    'paymentStatus', orders.payment_status,
    'status', orders.status,
    'createdAt', orders.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', order_items.id,
        'productId', order_items.product_id,
        'nameVi', order_items.product_name_vi,
        'nameEn', order_items.product_name_en,
        'imageUrl', order_items.image_url,
        'quantity', order_items.quantity,
        'unitPriceVnd', order_items.unit_price_vnd,
        'lineTotalVnd', order_items.line_total_vnd,
        'specialNote', order_items.special_note,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', order_item_options.option_id,
            'nameVi', order_item_options.option_name_vi,
            'nameEn', order_item_options.option_name_en,
            'extraPriceVnd', order_item_options.extra_price_vnd
          ) order by order_item_options.option_id)
          from public.order_item_options
          where order_item_options.order_item_id = order_items.id
        ), '[]'::jsonb)
      ) order by order_items.created_at, order_items.id)
      from public.order_items
      where order_items.order_id = orders.id
    ), '[]'::jsonb)
  )
  from public.orders
  where orders.id = p_order_id
    and orders.receipt_token = p_receipt_token
$$;

revoke all on function public.issue_order_receipt(uuid) from public;
revoke all on function public.get_order_receipt(uuid, uuid) from public;
grant execute on function public.issue_order_receipt(uuid) to anon, authenticated;
grant execute on function public.get_order_receipt(uuid, uuid) to anon, authenticated;
