-- Additive workflow fields. Existing tables, users, and records are preserved.
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'partially_dispatched';
ALTER TYPE public.movement_type ADD VALUE IF NOT EXISTS 'delivery_return_quarantine';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS local_price NUMERIC(12, 2) CHECK (local_price >= 0);

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS review_at TIMESTAMPTZ;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS line_id UUID REFERENCES public.sales_order_lines(id),
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS quantity INT CHECK (quantity > 0),
  ADD COLUMN IF NOT EXISTS source_location_id UUID REFERENCES public.locations(id),
  ADD COLUMN IF NOT EXISTS dispatched_by UUID REFERENCES public.staff_profiles(id),
  ADD COLUMN IF NOT EXISTS request_key UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS signed_by TEXT,
  ADD COLUMN IF NOT EXISTS signed_reference TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;

ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_delivery_status_check;
ALTER TABLE public.deliveries ADD CONSTRAINT deliveries_delivery_status_check
  CHECK (delivery_status IN ('pending', 'out_for_delivery', 'delivered', 'failed', 'returned_for_review'));

ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS reference_no TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_unique_reference
  ON public.payments (LOWER(TRIM(reference_no)));
CREATE INDEX IF NOT EXISTS idx_deliveries_order_line
  ON public.deliveries (order_id, line_id);
CREATE INDEX IF NOT EXISTS idx_reservations_review_at
  ON public.reservations (review_at) WHERE status = 'active';

CREATE POLICY "Staff can view deliveries" ON public.deliveries FOR SELECT TO authenticated
  USING (public.current_staff_role() IS NOT NULL);
CREATE POLICY "Staff can view refunds" ON public.refunds FOR SELECT TO authenticated
  USING (public.current_staff_role() IS NOT NULL);

-- All operational writes go through authenticated, validated RPCs.
REVOKE INSERT, UPDATE, DELETE ON public.sales_orders, public.sales_order_lines,
  public.reservations, public.payments, public.refunds, public.deliveries,
  public.stock_balances, public.stock_movements FROM anon, authenticated;
