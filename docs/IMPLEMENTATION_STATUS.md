# Maison Debrah ERP implementation status

## Workflow update — 11 November 2026, pending staff walkthrough

- Two additive migrations are applied to the linked Maison Debrah project: product draft review/activation, batch prices, verified opening counts, explicit expired-hold release, private payment and signed-handover evidence, and a refund path after an unsigned failed delivery returns to quarantine. Existing product, stock, and customer rows were preserved.
- The live UI now has product search, filters, pagination, image review/upload, individual and batch price entry, opening count entry, order price/availability review, an order detail timeline, Finance proof upload, handover document upload, suggested reservation review dates, and explicit expired-hold release.
- A new rollback SQL smoke test covers draft pricing/activation, duplicate opening counts, hold release, Finance proof role checks, and a refund after a failed item returns to quarantine. It passed against the linked project and left no test records.
- The imported 93 products are still inactive and unpriced. Sixty-five have linked images. There is still no approved opening stock or real order. A Finance Test account has been invited through a unique alias of the administrator's Gmail inbox and assigned the Finance role; its first sign-in is pending. Real transactions must wait for approved prices, physical counts, and named Finance access.
- The browser interaction and mobile layout could not be verified in this update because computer use is disabled in the current Work settings. The live build and test suite are checked separately. GitHub Pages still publishes the demo build.
- Current procedure: [LIVE_OPERATING_GUIDE.md](LIVE_OPERATING_GUIDE.md).

**Checked:** 11 November 2026
**Branch:** `codex/order-to-delivery-workflow`

## Implemented in the browser-local demo

- Finance role selection is required to record payments or a full pre-dispatch refund and cancellation.
- A deposit is required before placing a new stock reservation. Staff enter a review date and an agreed collection/delivery date, and may extend them with a recorded reason.
- No item can dispatch until the whole order balance is zero. A partial item release deducts only its quantity and consumes the matching reservation once.
- Dispatch, signed handover, failed delivery, and returned-for-inspection are distinct records. Failed items return to quarantine, not sellable stock.
- The UI names the four areas Warehouse and Showroom 1–3 and removes HQ catalogue wording from current screens.
- New domain tests cover unpaid release, partial dispatch, duplicate release, refund reservation release, and refund blocking after dispatch. The existing and new tests pass; the production build passes.

## Supabase connection and live mode

- Project `zcjnyljavilczubvelwb` (Maison Debrah ERP) is active and linked to this repository through the Supabase CLI.
- The workflow migrations through `product_onboarding_rpc` are applied to the new project. A remote rollback smoke test passed for receipts, transfers, order/payment permissions, deposit reservations, dispatch, signed delivery, and pre-dispatch refunds.
- A second remote rollback test passed for product creation permissions and audited price changes. Both SQL checks leave no test records behind.
- `.env.live.local` contains the project URL and publishable browser key and is ignored by Git. The live app runs locally with `npm run dev -- --mode live --host 127.0.0.1 --port 5175`.
- The first administrator was invited at the confirmed account email and has an active `staff_profiles` row. The initial link was used or expired; the live app now offers a fresh password setup link. The replacement reset email was visible in the administrator inbox. The administrator must open the newest email and set the ERP password personally. Actual end-user sign-in and live UI transactions still need verification.
- Supabase Auth's temporary development Site URL is `http://127.0.0.1:5175/`; its invitation redirect is `http://127.0.0.1:5175/?setup=1`. Both must be changed to the final GitHub Pages URL before publishing live mode.

## Still required for a live ERP

- The public demo still uses browser `localStorage` and a switchable demo role. A separate live-mode UI now uses named Supabase Auth accounts, shared tables, and server-checked workflow RPCs; it has not yet passed a real user walkthrough.
- The live database now holds 93 inactive draft products from the Ethiopia website-description workbook. Sixty-five have exact-code primary images in Supabase Storage; 28 still need confirmed images. They have no approved local prices or posted opening stock, so they cannot be ordered yet. Two source rows share SKU `SF26002-C1` and are flagged for review.
- Signed documents are represented by a reference number; the demo does not upload or retain the actual document.
- Refunds after dispatch, complaints, inspection/release of quarantined goods, and legal policy wording require reviewed procedures.
- Product pricing and opening stock reconciliation are pending. The browser-local demo still uses sample products and quantities; the live catalogue contains the 93 draft source records only.
- GitHub Pages has not yet been switched to live mode. The Supabase project serves the shared backend.

## Environment check

- `npm test`: passed, 16 tests.
- `npm run build`: passed.
- `npm run build -- --mode live`: passed. Vite reports a bundle-size warning; it does not fail the build.
- `supabase db query --linked --file tests/sql/erp_remote_smoke.sql`: passed and rolled back.
- `supabase db query --linked --file tests/sql/erp_product_remote_smoke.sql`: passed and rolled back.
- Browser walkthrough on an isolated local origin: Finance final payment → reservation extension → Stock dispatch → signed handover. Status stayed dispatched until signature, then changed to delivered.
- Supabase CLI is linked to Maison Debrah. Docker Desktop's service could not be started here; the remote rollback smoke test passed instead.
