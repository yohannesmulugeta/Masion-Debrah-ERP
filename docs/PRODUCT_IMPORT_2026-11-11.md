# Ethiopia product catalogue staging — 11 November 2026

Source: `Excel File with Product Descriptions - For Website.xlsx`, sheet `Ethiopia List`.
SHA-256: `2368e88b7c6e5c316b70fb4f12d9e20f17e26113d6a4db7c4586f693ae2a6be6`.
Supabase project: Maison Debrah ERP (`zcjnyljavilczubvelwb`).
Import batch: `ETHIOPIA-WEBSITE-2368E88B7C6E5C31`.

## What was loaded

- 95 nonempty source rows were checked. 93 unique item codes were inserted as **inactive drafts**. Each has the source item code, category, dimensions, and material description.
- The marketing name and description were used when supplied. For 26 staged rows without a marketing name, the displayed name combines the source item type and code; it needs editorial review.
- Approved local price is `NULL` for every draft because the workbook has no price column. No quantities were posted to stock: its showroom total does not identify Showroom 1, 2, or 3, and opening counts have not been reconciled.
- The import created one batch record, 93 `PRODUCT_STAGED` audit events, and two import-error records. The source workbook was not changed.

## Items requiring a decision

1. Rows 50 and 51 both use `SF26002-C1`, but one says “4 seaters sofa” and the other says “3 seaters sofa.” Confirm the correct distinct item codes and descriptions before adding either.
2. Provide an approved ETB selling price for each SKU. Drafts must remain unavailable for orders until prices are entered and the products are approved.
3. Confirm the physical opening quantity for each SKU separately in Warehouse and Showrooms 1–3. The workbook's combined showroom quantity is not enough to assign stock to a specific room.

Verification after import: 93 products total; 93 inactive with no local price; 0 active products; 0 duplicate SKUs; 0 stock-balance rows; 93 audit events; 2 flagged source rows.

## Product photographs

Primary images were added later on 11 November 2026. A public-read Supabase Storage bucket, `erp-product-images`, holds 65 images. The ERP `products.image_url` field links the matching 65 draft SKUs to these objects. The bucket is restricted to JPEG, PNG, or WebP files of at most 10 MB; browser clients have no write policy. The original source files remain untouched.

- 26 primary images came from exact product-code folders in `Product Photos - Ethiopia Website.zip`.
- 32 came from exact-SKU product records in the local Maison Debrah website media. Matching marketing names were preferred where the sources disagreed.
- 7 came from exact-code supplier photo review workbook previews. These are small review thumbnails and need higher-resolution replacements.
- 28 imported products have no confirmed primary image. Do not fill these with similar names, partial codes, or room-scene photographs without a product identity check.

Verification: 65 stored objects, 65 linked products, zero broken database image paths, and 65 `PRODUCT_IMAGE_LINKED` audit events. A public sample image returned HTTP 200. All products remain inactive and unpriced; no opening stock was posted. Photo files are public-read because they are product media intended for the website; uploads are not open to browser users.
