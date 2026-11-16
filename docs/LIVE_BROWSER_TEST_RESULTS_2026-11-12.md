# Live browser test results — 12 November 2026

## Scope and method

Actual browser form submissions against the shared live Supabase workspace at `http://127.0.0.1:5175/`. Playwright operated the UI, selected products/areas/orders, submitted forms, uploaded actual PNG files, opened private evidence links, and refreshed the application. No SQL or direct API calls were used to create or advance these test records. Responses to the browser's own requests were observed to distinguish successful writes from rejected actions.

This was deliberately open testing, with no staff sign-in or role enforcement. It does not verify named staff permissions or production readiness. All customer details, product media, approval references, payment entries, delivery addresses, signatures, and refunds were clearly marked as simulated QA data. No money moved and no goods were physically handled.

## Results

| Feature exercised in the browser | Result |
| --- | --- |
| Add two new draft products | Passed; persisted after refresh |
| Review, price and activate products | Passed |
| Upload actual product PNG files | Passed; images loaded from Storage after refresh |
| Duplicate SKU detection, including lower-case entry | Passed; create action disabled and existing review opens |
| Complete an existing product while leaving optional description/price blank | Passed; saved values preserved while category changed |
| Invalid image format | Rejected with a useful JPEG/PNG/WebP validation message |
| Bulk pricing: unknown SKU | Rejected in preview; save disabled |
| Bulk pricing: change QA table from 50 to 55 ETB | Passed; existing sale retained its original 50 ETB line price and 250 ETB total |
| Restore QA table price to 50 ETB | Passed |
| Single opening stock entry | Passed |
| Batch opening counts, including zero counts for other areas | Passed |
| Duplicate opening count | Rejected; no duplicate stock added |
| Warehouse goods receipts | Passed; +2 QA chairs and +1 QA table |
| Warehouse → Showroom 1 transfers | Passed; moved 4 chairs and 2 tables without changing building totals |
| Transfer 999 units with insufficient stock | Rejected; no negative stock |
| Create multi-item sale and two separate exception orders | Passed; totals 250, 50 and 100 ETB |
| Reserve before any deposit | Rejected |
| Record deposit/final payments | Passed; four simulated payments retained |
| Duplicate payment reference | Rejected; no extra payment |
| Upload and open actual private payment proof | Passed; PNG bytes loaded through a signed link |
| Reserve stock after deposit | Passed; physical stock unchanged, available quantity reduced |
| Extend a reservation | Passed; new dates saved |
| Expire and release a short-lived QA hold | Passed using actual elapsed time; no clock or database override |
| Dispatch before full payment | Rejected |
| Partial dispatch | Passed; order remained partially dispatched, stock deducted by the exact quantity |
| Complete all three signed handovers | Passed; sale became delivered |
| Upload and open actual private signed-handover document | Passed; PNG bytes loaded through a signed link |
| Refund selection after signed handover | Signed order excluded |
| Cancel and refund a deposit before dispatch | Passed; 10 ETB simulated refund |
| Failed delivery | Passed; delivery marked failed |
| Refund before failed goods return | Failed order excluded until received back |
| Receive failed delivery into quarantine | Passed; quarantine +1 and sellable stock unchanged by return |
| Refund after quarantine return | Passed; 100 ETB simulated refund and cancellation |
| Page reload and persistent order/stock/Finance records | Passed |
| Warehouse stock-view filter | Passed |
| Mobile navigation, product review and order list at 390 × 844 | Passed; no document-level horizontal overflow; modal fills viewport |
| Pause QA products after testing | Passed; neither QA product offered for new orders |

Expected 400/409 responses occurred for deliberate rejection tests. Browser automation encountered selector/session interruptions; saved UI state was rechecked before resuming, and completed transactions were not repeated. A final fresh-browser console check reported no errors; earlier contexts included the existing missing-favicon 404 and expected rejection responses.

## Retained QA records and reconciliation

These records intentionally remain for inspection. They are not business transactions.

| Product | Final price | Sale status | Warehouse sellable | Showroom 1 sellable | Quarantine |
| --- | ---: | --- | ---: | ---: | ---: |
| `QA-TEST-20261112-A` — QA TEST Chair | 100 ETB | Paused | 7 | 2 | 1 in Warehouse |
| `QA-TEST-20261112-B` — QA TEST Table | 50 ETB | Paused | 5 | 1 | 0 |

Both have confirmed zero counts in Showrooms 2 and 3 and zero active reserved units. Starting opening counts were 16 units, receipts added 3, the completed sale removed 3, and one failed item returned to quarantine: **15 sellable + 1 quarantined = 16 retained units**. Original non-QA stock was not used. The dashboard shows 30 sellable units because it includes 15 pre-existing units plus 15 QA units; pausing products does not remove their inventory from totals.

| Scenario | Order number | Final result |
| --- | --- | --- |
| Main sale | `MD-ORD-2026-766F417DBFC2` | Delivered; 2 chairs + 1 table; 250 ETB paid; 0 due; three signed handovers |
| Expired hold and deposit cancellation | `MD-ORD-2026-0AF87C07D737` | Cancelled; 10 ETB deposit refunded; hold released |
| Failed delivery and return | `MD-ORD-2026-06B57D968802` | Cancelled; 100 ETB refunded after one chair returned to quarantine |

**Finance:** 50 + 10 + 100 + 200 = **360 ETB simulated payments**. Refunds are 10 + 100 = **110 ETB**. Net recorded receipts are **250 ETB**, matching the completed sale. The dashboard shows zero open-order balances, active holds, and items out for delivery.

There are two actual product images, one private payment-proof PNG, and one private handover PNG uploaded in this run. The latter two documents explicitly state that they are simulated and are not real financial/signature evidence. The 200 ETB final payment has no attached proof, intentionally; attachment is a separate supported step.

## Issues found; next implementation work

1. **Cancelled-order balance presentation:** the deposit-cancelled order shows its original 40 ETB unpaid amount under `Balance` in the list. The order is cancelled and excluded from dashboard receivables, but the list needs to distinguish historical unpaid value from a collectible balance.
2. **Reservation history:** the completed sale's timeline says `Reservation created … 0`, because it displays the now-consumed remaining quantity. The original hold was 2 and was verified at creation. Preserve/display original held quantity and extension history in the timeline.
3. **Bulk-pricing message:** the UI says `Products remain paused until reviewed` even when an already-active product remains active. The observed database behavior preserves sale status; the message and post-save filter should accurately describe that behavior.

These issues were recorded rather than changing application code during this browser acceptance run. No source-code or schema changes were made for the run.

### Follow-up display fixes

After the acceptance run, the cancelled-order list and Finance panel were changed to label the stored balance as **historical** and excluded from open receivables. A read-only browser check confirmed the 40 ETB cancelled-order value is no longer presented as collectible. The reservation panel now labels the current hold state, and the creation timeline no longer misstates the consumed quantity as the original quantity; a read-only browser check confirmed **Reservation fulfilled** and no “0 reserved” label on the completed order. The bulk-price success message now says sale status is unchanged and returns to the all-products filter. All 23 automated tests and the live build pass after these display changes.

The original reservation quantity and the sequence of extension decisions are still not shown in the order timeline. They remain an open audit-visibility improvement; this follow-up did not change database records or permissions.

Before real operation: resolve those display issues; agree how to retain/exclude QA records from operational reporting; restore named staff access and verify each role; approve actual product prices and physical counts. Supplier purchase orders, website integration, quarantine inspection/release, and post-handover complaints remain unimplemented.

Not exercised here: real staff authentication/authorization, concurrent competing transactions, forced network-loss recovery/retry, every file type/size boundary, a real payment provider, or real delivery identity verification. A successful simulated browser journey does not prove these.

## Evidence

Screenshots and repeatable UI scripts/logs are in `output/qa-live-20261112/`. Useful checkpoints:

- `01-products.png`: created products and uploaded images.
- `02-stock.png`: stock after receipt/transfer checks.
- `03-payments.png`: payment ledger and attached proof.
- `04-partial-dispatch.png`: partially dispatched order.
- `05-signed-handover.png`: delivered items and signed evidence.
- `06-completed-order.png`: completed order workspace.
- `07-final-stock.png`: final sellable/quarantine balances.
- `08-mobile-review-viewport.png`: actual mobile viewport with product drawer.
- `09-mobile-order.png`: mobile order screen.
- `10-dashboard.png`: final dashboard totals.

The earlier guided-test baseline is superseded by the retained quantities and paused product statuses above. Do not rerun stock submissions blindly; use new unique references and record the current starting balance.
