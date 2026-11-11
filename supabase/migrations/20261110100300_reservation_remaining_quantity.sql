-- A completed reservation has zero remaining units. Active holds remain positive.
ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_quantity_check;
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_quantity_check
  CHECK (quantity >= 0 AND (status <> 'active' OR quantity > 0));
