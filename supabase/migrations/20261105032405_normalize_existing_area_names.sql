-- Update only the four known demo location rows. Preserve IDs, stock history,
-- and any address or phone that differs from the old sample value.
UPDATE public.locations
SET code = 'WH', name = 'Warehouse',
    address = CASE WHEN address = 'Logistics District, Addis Ababa' THEN NULL ELSE address END,
    phone = CASE WHEN phone = '+251 11 661 0001' THEN NULL ELSE phone END
WHERE id = 'c0000000-0000-0000-0000-000000000001'
  AND code = 'WH-CENTRAL'
  AND NOT EXISTS (SELECT 1 FROM public.locations WHERE code = 'WH');

UPDATE public.locations
SET code = 'SR-1', name = 'Showroom 1',
    address = CASE WHEN address = 'Bole Medhanialem Commercial Blvd' THEN NULL ELSE address END,
    phone = CASE WHEN phone = '+251 11 662 0002' THEN NULL ELSE phone END
WHERE id = 'c0000000-0000-0000-0000-000000000002'
  AND code = 'SR-BOLE'
  AND NOT EXISTS (SELECT 1 FROM public.locations WHERE code = 'SR-1');

UPDATE public.locations
SET code = 'SR-2', name = 'Showroom 2',
    address = CASE WHEN address = 'Kazanchis Executive District' THEN NULL ELSE address END,
    phone = CASE WHEN phone = '+251 11 663 0003' THEN NULL ELSE phone END
WHERE id = 'c0000000-0000-0000-0000-000000000003'
  AND code = 'SR-KAZANCHIS'
  AND NOT EXISTS (SELECT 1 FROM public.locations WHERE code = 'SR-2');

UPDATE public.locations
SET code = 'SR-3', name = 'Showroom 3',
    address = CASE WHEN address = 'Old Airport / Sarbet Residential Hub' THEN NULL ELSE address END,
    phone = CASE WHEN phone = '+251 11 664 0004' THEN NULL ELSE phone END
WHERE id = 'c0000000-0000-0000-0000-000000000004'
  AND code = 'SR-SARBET'
  AND NOT EXISTS (SELECT 1 FROM public.locations WHERE code = 'SR-3');
