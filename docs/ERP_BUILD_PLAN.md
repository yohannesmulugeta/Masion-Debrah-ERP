# Maison Debrah ERP build plan

**Date:** 10 November 2026
**Status:** Implementation proposal based on the returned workflow questionnaire. Planning only; no application or database changes are authorized by this document.
**Business decision source:** `output/docs/Maison_Debrah_ERP_Workflow_Decisions.md`

**Implementation update, 10 November 2026:** The browser-local demo now has Finance-only payment/refund actions, deposit-backed reservation dates and extension, a full-payment dispatch gate, item-level dispatch, signed delivery references, and failed-delivery quarantine. These changes do not complete work packages 2 or 8 for a live shared ERP. See [WORKFLOW_SOP_DRAFT.md](WORKFLOW_SOP_DRAFT.md) for the current demo procedure.

## 1. Current state

The repository already contains a React 19, TypeScript, and Vite staff demo, with pages for stock, orders, reservations, payments, exceptions, audit history, and a simulated website feed. It uses browser `localStorage` and sample records. Selecting a staff role in the UI is a demo control, and the interface does not use the Supabase client for its workflows. The Supabase SQL migrations are draft assets, not evidence of a deployed production database. GitHub Pages publishes the static demo from `main`.

At the start of this build, the demo allowed Sales to record payments and could mark an entire order delivered at stock deduction without checking full payment. The browser-local implementation now addresses those screen flows. The draft SQL fulfilment function still lacks the full-payment guard and marks an order delivered at stock deduction; live transactions remain unavailable to client roles. Existing tests cover selected local stock, finance, and delivery calculations, but not live permissions or concurrent use. The older `ERP_IMPLEMENTATION_PLAN.md` predates this application and still discusses an HQ catalogue; it is superseded for this build.

## 2. Agreed operating rules

- Use **Warehouse** and **Showroom 1, 2, 3** as the four areas in one building. Manage the local product list and local prices; remove HQ catalogue concepts from the proposed live workflow and UI.
- Sales creates an order after the customer agrees to the item, price, payment terms, and collection or delivery plan.
- Finance alone verifies and records every payment. A deposit can reserve an item until the agreed date. Review an unresolved deposit reservation after about 3–5 days; discuss extension or refund with the customer.
- **No item leaves with an unpaid order balance.** The earlier credit/handover-with-balance proposal is withdrawn. Finance must confirm full payment before stock release.
- Partial fulfilment is allowed, but each order line and remaining undelivered quantity must be visible. The full order balance requirement applies before the first release unless the business later approves a different written rule.
- Deliver to the customer's location and collect a signed handover/delivery receipt. Keep payment receipt, stock dispatch, and customer acceptance as different events.
- The stated no-refund point is the **signed handover receipt**, not the payment receipt. The stated post-acceptance no-voluntary-return/no-warranty policy requires management and local legal review before it becomes an automated denial rule. Staff must still be able to log a complaint or defect.

## 3. Target end-to-end flow

| Step | Staff action | System result |
| --- | --- | --- |
| Enquiry | Discuss product, price, availability, and fulfilment | Quote/enquiry remains separate from a confirmed order. |
| Order | Confirm customer and exact item(s) | Order and line items created with an agreed fulfilment plan. |
| Stock allocation | Identify item in Warehouse or a showroom; move it if needed | Reservation or transfer is recorded without overselling. If unavailable, show awaiting stock and no immediate handover promise. |
| Deposit, when used | Finance verifies and records deposit | Amount due stays visible; reservation has an agreed review/collection date. |
| Final payment | Finance verifies the remaining amount | Order becomes financially cleared only when the full balance is zero. |
| Preparation | Staff inspect and pack the exact item(s) | Item-level readiness and any damage/shortage are recorded. |
| Release | Staff check finance clearance and record each item leaving the building | Stock is deducted once, with dispatch/pickup evidence; unreleased order lines remain open. |
| Delivery | Deliver to customer location and capture recipient signature | Delivery/acceptance date and signed evidence are linked to the released items. |
| Exception | Handle cancellation, extension, failed delivery, damage, or complaint | Finance manages eligible refunds; stock and payment history remain traceable. |

An order needs **separate financial, stock, and delivery states**. A payment must not automatically mean delivered; dispatch must not automatically mean customer acceptance. Exact state names and transitions will be written and reviewed before migration work.

## 4. Implementation sequence

| Work package | Build work | Evidence needed to finish |
| --- | --- | --- |
| 0. Finalize rules and data | Confirm open details in section 8; collect approved product/price list, physical opening stock, payment methods, and sample documents | Signed workflow and sample data/document pack. |
| 1. Transaction design | Define order-line, reservation, payment, refund, stock movement, dispatch, and acceptance states; map who can perform each action; design screens around one order timeline | Reviewed state diagram, permission matrix, screen flow, and acceptance examples. |
| 2. Data foundation | Add **forward-only** Supabase migrations on top of the existing schema; make stock and finance operations atomic; derive paid/due values from ledger entries; enforce unique references and valid transitions | Migrations apply to an isolated database; rollback/recovery method documented; concurrent and retry tests pass. |
| 3. Inventory | Receive purchased goods, record opening counts, transfer among four areas, reserve exact stock, inspect and quarantine damage | Count and movement reconciliation by item and location; last-unit oversell test passes. |
| 4. Orders and deposits | Build customer/order/line workflow, awaiting-stock handling, item allocation, deposit reservation, 3–5 day review queue, extension/cancellation paths | Scenario tests for deposit, expiry/review, transfer, and unavailable stock. |
| 5. Finance | Build finance-only payment confirmation, payment receipt, full-balance release gate, pre-handover refund workflow, and payment reconciliation | Sales cannot post payments; unpaid orders cannot release; duplicate payment and refund attempts are rejected. |
| 6. Handover and delivery | Build per-line partial release, dispatch/pickup, signed proof capture, failed-delivery recovery, and customer acceptance | One physical stock deduction per released unit; partial orders remain visibly open; signed document is linked to the correct release. |
| 7. Exceptions and reporting | Record damage, cancellations, complaints, and reviewed return/refund cases; provide traceable stock, order, payment, and delivery reports | Staff can reconstruct who did what and when; totals match underlying movements and payments. |
| 8. UI integration and release | Replace demo-local actions with typed data calls; add loading, empty, error, and retry states; test keyboard/mobile flows; prepare staff guide and production cutover | Typecheck/build and automated tests pass; key flows verified in browser; approved opening data reconciles; written business acceptance. |

Build the vertical customer journey incrementally: a small order/payment/stock/delivery slice should work end to end in an isolated environment before expanding all screens. Keep the public GitHub Pages demo separate from live business data until the live controls pass acceptance.

## 5. Architecture and data flow

- **Frontend:** keep the existing React/Vite/TypeScript interface and brand system. Split the large `ErpContext` into focused domain data access and state modules as each live workflow is implemented. Use typed request/response contracts, explicit validation, and clear loading/error states.
- **Backend:** use Supabase/PostgreSQL for shared durable data. Transactional database operations own stock allocation, financial posting, refund, and release state changes. Enforce permissions in the database; UI permissions provide guidance, not authority.
- **Inventory:** an append-only movement ledger explains every change. Available stock is sellable on-hand minus active reservations; damaged or pending-inspection stock is unavailable. Physical release consumes the reservation and stock exactly once.
- **Finance:** immutable payment/refund records determine the balance. Finance confirmation is a required precondition for release. Keep financial clearance separate from the delivery state.
- **Documents:** store references to order acceptance, payment proof, dispatch/pickup evidence, and signed delivery receipt with actor and timestamp. Define retention/access rules before using real customer documents.
- **Hosting:** GitHub Pages can host the static React frontend. It cannot run the database or private transaction logic. The live workflow needs a separate approved backend such as Supabase, with no privileged key in the Pages build. Do not connect production records to the current public demo URL without a reviewed deployment and access design.

## 6. Expected files to change during implementation

| Area | Likely files or folders |
| --- | --- |
| Domain types and state | `src/types/index.ts`, `src/context/ErpContext.tsx`, new focused modules under `src/lib/` or `src/context/` |
| Screens | `src/views/OrdersView.tsx`, `ReservationsView.tsx`, `PaymentsView.tsx`, `StockOperationsView.tsx`, `ExceptionsView.tsx`, `AuditView.tsx`, and shared components/styles |
| Data integration | `src/lib/supabase.ts`, new typed data access modules, `.env.example` |
| Database | New versioned files in `supabase/migrations/`; preserve existing migrations and data |
| Verification and guidance | `tests/`, `docs/`, `README.md`, and GitHub Pages workflow only if deployment needs change |

Remove obsolete HQ catalogue labels and import assumptions through a targeted UI, schema, and documentation review. Do not drop existing tables or data as a shortcut; use additive migrations and an explicit data transition.

## 7. Verification and release gates

Before each work package is accepted, run typecheck/build, available tests, and focused tests for its new rules. Add database integration tests for concurrent last-unit reservations, duplicate request retries, full-balance release, finance-only posting, partial delivery, refund reversal, and single stock deduction. Test each role against database permissions. Verify desktop/mobile layout, keyboard access, loading/empty/error states, browser console, and failed-network behavior for the main journey.

Before production use, apply migrations to an isolated copy, reconcile opening stock and financial totals, verify backup/restore and document access, rehearse a failed delivery and cancellation, and obtain staff/business sign-off. The current 9 tests and production build pass as of this plan; they do not establish live ERP readiness. There is no lint script yet.

## 8. Decisions needed before transaction rules are coded

1. Does every purchased item enter Warehouse first, and can a showroom display piece be sold? Confirm the physical stock route.
2. When does the deposit's 3–5 day review period begin? Are those calendar or working days? Who contacts the customer, authorizes an extension, and approves a refund? How does this relate to a later agreed delivery date?
3. Which payment methods and evidence does Finance accept? What constitutes Finance confirmation for bank or mobile payments?
4. What proves order acceptance, dispatch, and signed delivery? Who may sign at the customer's location? When exactly is stock deducted if a delivery fails?
5. Which manager owns complaints and disputed deliveries? Obtain management/legal review of refund, return, and warranty language, including how defective or incorrectly supplied goods are handled.
6. Supply approved local products/prices and a signed opening stock count by item and area. Confirm whether the production frontend remains on GitHub Pages with a separate Supabase backend.

No coding should turn an unresolved answer above into a silent business rule. Continue with the design and prototype of unaffected screens while these decisions are collected.
