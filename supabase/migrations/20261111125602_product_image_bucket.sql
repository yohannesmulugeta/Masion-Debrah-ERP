-- Product photographs are website media. Public reads are intentional; uploads
-- remain restricted to the linked project administrator (no client write policy).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'erp-product-images',
  'erp-product-images',
  TRUE,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
