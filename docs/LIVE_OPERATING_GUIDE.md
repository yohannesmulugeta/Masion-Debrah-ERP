# Maison Debrah live ERP — operating guide

**Updated:** 11 November 2026. This guide describes the live Supabase workspace. Staff must complete onboarding and a supervised walkthrough before using real customer transactions.

## Set up products and stock

1. Admin or Manager opens **Products & Prices**, searches the SKU, and checks the exact product identity and image. A missing image is shown explicitly. Upload only a photo verified against that SKU.
2. Enter the approved ETB price with its approval reference. For many products, paste `SKU,price` lines into **Apply approved price list**. The batch saves atomically and leaves products paused.
3. Review name, category, description, price, and **Sale status**. Activate only the approved product. Pausing it prevents new orders; it does not erase old order prices or stock history.
4. Sign a physical count sheet for Warehouse and Showrooms 1–3. In **Receipts & Transfers**, post each opening count or paste `SKU,area code,quantity` rows. Area codes are `WH`, `SR-1`, `SR-2`, and `SR-3`. Zero is a valid confirmed count. Existing opening counts cannot be posted twice.
5. Later incoming stock uses **Receive at Warehouse** and a supplier/receipt reference. Moves between rooms use **Transfer between areas**. Neither operation should be used to invent an opening count.

## From customer agreement to handover

1. Sales selects an active product and reviews the displayed unit price, total, and available quantity before confirming the order. If the quantity is unavailable, record the agreed fulfilment plan in Notes and acknowledge it on the screen. The system does not yet manage supplier purchase orders or promise an arrival date.
2. Finance verifies money received and records each deposit or payment against the order using a unique transaction reference. Finance may attach a private PDF or image of payment proof afterward. Only Finance can post a payment.
3. After a deposit, Sales may reserve stock. The form suggests a customer review around day 3 and a decision by day 5; the agreed dates remain editable. A hold may be extended with a reason. Once expired, Sales can release it after customer discussion; this releases stock only. Finance handles any refund separately.
4. Stock dispatches an item only after the **entire order balance is zero**. The dispatch records the exact line, quantity, source area, recipient, phone, and address. A retry of the same submission retains its request key.
5. Staff record who signed and the signed handover reference, then attach the signed document privately. A dispatch is not a completed handover until the signature is recorded.
6. If delivery fails, record the reason. On physical return, Stock receives the item into quarantine. It is not sellable. Finance may record a full refund and cancellation only when every dispatched item has returned without signed handover. A signed handover blocks this refund path.

## Roles and evidence

| Work | Staff role |
| :--- | :--- |
| Drafts, prices, activation, product photos, opening counts | Admin or Manager |
| Goods receipts, transfers, dispatch, signed handover, failed-delivery receipt | Admin, Manager, or Stock Clerk |
| Orders and deposit holds | Admin, Manager, or Showroom Sales |
| Payments, refunds, payment-proof upload | Finance only |
| Payment-proof viewing | Finance, Admin, or Manager |

## Required before real use

- Obtain approved ETB prices and physical opening counts. The imported 93 drafts remain inactive and unpriced; no opening stock has been posted.
- Resolve the two conflicting `SF26002-C1` source rows. Twenty-eight imported products still lack a verified primary image.
- Complete the Finance Test invitation and perform a supervised order-to-handover walkthrough. Replace the test account with a named Finance staff member before real transactions.
- Review the no-refund-after-signed-handover policy with management and applicable local requirements. The ERP does not yet provide supplier purchase orders, post-handover complaints, or quarantine-to-sellable inspection approval.
- The GitHub Pages workflow still publishes the browser-local demo. Switch to live mode only after onboarding, access, and deployment checks.
