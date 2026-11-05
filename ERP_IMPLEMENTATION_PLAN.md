# Masion Debrah ERP implementation plan

Date: 5 November 2026  
Status: planning baseline; no ERP application or database has been created

## 1. Current state and source of truth

- This folder contains ERP quotation/agreement PDFs and document-generation files. It has no ERP source code, migrations, database, or deployment configuration. Its Git repository has no commits yet.
- `C:\Users\hp\Documents\MD - ERP STRUCTURE.pdf` describes HQ-managed product information and independently managed local inventory, sales, and customer relationships.
- `C:\Users\hp\Documents\FEEDBACK INVENTORY DOCUMENT.pdf` confirms that HQ supplies official product information but does not share central stock. It requests local stock integration with the website and clarification of reservations, payments, returns, damage, warranty, and adjustment authority.
- `output/pdf/Maison_Debrah_ERP_Quotation.pdf` and `output/pdf/Maison_Debrah_Ethiopia_ERP_Development_Agreement_Draft.pdf` define the proposed custom ERP, one warehouse and three showrooms, demonstration and live handover, acceptance checks, and exclusions. The agreement is a review draft with open workflow and commercial terms; it is not a signed specification.
- The separate `C:\Users\hp\Documents\ChatGPT\Maisondebrah Ethiopia staging website` project is a React/Vite/TypeScript review preview on GitHub Pages. It has no backend or Supabase connection. Its `admin/` product studio saves only to browser storage. Its public catalogue is generated from 268 JSON records at build time. A read-only audit found 26 records without a SKU and no duplicate nonblank SKUs. Existing reference prices are not approved Ethiopia selling prices.
- The website repo is a candidate integration target, not automatically the approved production website. Brand-facing changes and launch need Maison Debrah's separate written approval.

## 2. Intended operating model and boundaries

1. HQ owns the official catalogue fields: product code/SKU, name, collection, specifications, descriptions, and approved images. Import an HQ-approved file; do not treat the preview site's snapshot as authoritative.
2. The Ethiopia operation owns local stock by location, local selling prices, customers, sales and orders, reservations, receipts and transfers, payment records, deliveries, returns, damage, and warranty cases.
3. The ERP is private to named staff. The public website receives only approved catalogue information and a derived local availability status. It never receives customer, payment, staff, movement, or raw stock-count records.
4. The website retains the full approved catalogue. Show **Available in Ethiopia** only when unreserved sellable stock is positive at an eligible local location. With zero or no matching local stock, show the brand-approved inquiry wording. On an availability lookup error, use a neutral **Check availability** state rather than asserting stock.
5. Website orders, checkout, online payment, automatic HQ purchasing, HQ inventory/manufacturing integration, payroll, and statutory accounting remain outside the quoted scope.

## 3. Proposed technical architecture

| Layer | Proposed approach | Reason |
| --- | --- | --- |
| ERP front end | Separate private React/Vite/TypeScript application, following existing website conventions | Avoid putting private ERP screens in the public preview build; preserve the existing website |
| Data and identity | Client-controlled Supabase project using PostgreSQL and Supabase Auth | One durable database with named staff access; matches the quotation |
| Business operations | PostgreSQL transactions/functions for receipts, transfers, reservations, sales fulfilment, reversals, and payments | Concurrent staff actions must not oversell or leave half-written movements |
| Authorization | Row-level security on every private table; explicit role/permission checks inside privileged database functions | UI restrictions alone cannot protect data or stock actions |
| Website feed | Narrow public read endpoint/view returning product code and derived availability only; no service-role key in browser | Allows safe public lookup while keeping ERP data private |
| Deployment | ERP on restricted client-controlled hosting; approved website deployment remains separate | Clear ownership, access, and brand release boundary |

Prefer the existing React/TypeScript stack and Supabase's supported client libraries. Introduce a server component only if a verified requirement cannot be met safely with database functions and RLS. Keep migrations, seed/configuration templates, and deployment instructions in the new ERP project.

### Data flow

`HQ-approved catalogue file -> validated product import -> private products table`  
`Verified Ethiopia stock -> authorized receipt/opening balance -> stock ledger and balances`  
`Sale/reservation/return/transfer -> one atomic database operation -> updated available quantity`  
`Approved product code + derived availability -> public website display`

## 4. Data model to implement through migrations

The following are proposed logical entities, not claims that these tables already exist. Final column names and rules follow the signed workflow schedule.

| Area | Proposed entities | Critical constraints |
| --- | --- | --- |
| Catalogue | `products`, `product_import_batches`, `product_import_errors` | Unique nonblank official SKU; version/source reference; imports reject missing or duplicate codes for stock-linked items |
| Locations and stock | `locations`, `stock_balances`, `stock_movements`, `stock_counts` | Four configured locations; nonnegative balances; movement history append-only; each adjustment has actor, time, reason, and reference |
| Orders and allocations | `customers`, `sales_orders`, `sales_order_lines`, `reservations` | Reservation cannot exceed sellable unreserved stock; cancellation releases exactly once; order transitions validated |
| Payments | `payments`, `refunds` or equivalent reversal records | Amounts stored as exact currency values; linked to an order; no silent editing/deletion; balance derived from charge and payment records |
| Fulfilment and exceptions | `deliveries`, `returns`, `damage_cases`, `warranty_cases` | Delivery and return transitions cannot double-deduct or reintroduce unsellable stock |
| Security and traceability | `staff_profiles`, `role_assignments`, `audit_events` | Named Auth user for each staff member; restricted operations checked in database; actor and prior/new state captured for sensitive changes |

Stock quantities must be counted in individual sellable units or an approved unit of measure per SKU. If products have separately stocked sizes, finishes, or bundles, HQ must confirm whether each has its own SKU before schema finalization.

### Stock invariant

For each SKU and location: `available = sellable_on_hand - active_reserved`. Available and sellable on-hand may never be negative. Damaged, returned-pending-inspection, and otherwise unsellable units never contribute to public availability. A sale allocated from a reservation must consume that reservation and the physical stock once, not twice. Use a transaction with row locking or an equivalent atomic database operation for every quantity change.

### Website status invariant

For an approved catalogue SKU, sum positive unreserved sellable stock across locations authorized for public availability. The proposed default is the warehouse plus three showrooms, subject to the Client confirming whether stock at every location can be offered to customers. Publish only a boolean/status, not location counts or financial data. An unmatched or blank SKU must never be marked available by a name match.

## 5. Staff workflows and screens

| Workflow | Minimum screen and behavior | Acceptance example |
| --- | --- | --- |
| Sign-in and roles | Login, password recovery, named staff list, role assignment, session expiry | Unauthorized user cannot read orders or post an adjustment |
| Catalogue | Search by SKU/name, approved product details, import preview with row-level errors | Duplicate/blank SKU is flagged; import does not silently overwrite HQ data |
| Opening stock and receipts | Select SKU, location, quantity, evidence/reference; authorized posting | Correct location increases, actor and time recorded |
| Stock by location | Search, filter, sellable/reserved/available totals, movement history | Figures reconcile to posted movements |
| Transfer | Select source, destination, SKU, quantity; enforce agreed issue/receipt rule | Source falls, destination rises, local total stays equal when completed |
| Count and adjustment | Enter count, show variance, require reason and authorized approval | Unapproved adjustment cannot change balance |
| Customer and order | Capture minimum approved customer details and order lines; validate stock/order state | Second user cannot sell the same last unit |
| Reservation | Reserve, release, expire/cancel according to approved rule | Available quantity changes; physical on-hand does not until fulfilment |
| Deposit and payment | Record payment reference, date, amount, method; show paid and due | Partial payment updates balance without changing stock twice |
| Delivery | Record dispatch/delivery state and authorized reversal | Delivered item leaves physical stock once |
| Returns, damage, warranty | Register case and disposition; inspected return enters sellable stock only when approved | Damaged return does not appear on website |
| Reports | Stock by location, low/zero availability, movements, orders, balances, exception cases | Totals can be traced to source records |
| Public availability | Product page/card uses derived status with loading/error state | One-unit reservation switches status from available to inquiry wording |

The workflow must specify whether a showroom sale is fulfilled immediately or after delivery. That decision determines the exact stock-posting event and prevents double deduction.

## 6. Roles and permissions to approve

Start with a permission matrix for administrator, stock clerk, showroom sales, finance approver, and manager/reviewer. These are design candidates, not assigned staff roles. At minimum, separate: catalogue import; receipt; transfer; stock adjustment approval; customer/order access; payment recording; refund approval; report access; user management. The Client supplies named users and approves which role can do each action. RLS and database functions enforce the matrix; the interface hides actions the user cannot perform.

## 7. Import and reconciliation plan

1. Obtain the official HQ catalogue export, field definitions, rights to use content/images, and import cut-off date. Preserve its original file and record import batch/version.
2. Compare HQ SKUs with the draft website's 268 records. Resolve the 26 blank-SKU records and any renamed, variant, retired, or absent products with HQ. Never create a stock match from product name alone.
3. Import official catalogue into a staging table or validated dry run. Report blank/duplicate codes, unknown categories, missing required images, and conflicts. Get an owner to approve the reconciliation report before promoting it.
4. Obtain physically verified opening stock by SKU, condition, and each of the four locations. Import with a signed opening-balance record, not inferred from the website.
5. Obtain approved Ethiopia prices separately if price entry is in scope. The preview's reference price values must not be copied into live local selling prices without approval.
6. For cutover, freeze legacy stock changes during the final count/import window or record a controlled delta and reconcile before live use.

## 8. Delivery stages and concrete work

| Stage | Work | Exit evidence |
| --- | --- | --- |
| A. Decision and data audit | Confirm workflows, roles, site target, four locations, official catalogue, opening stock, account ownership | Signed workflow/permission schedule and import sample |
| B. Foundation | Create ERP repo/app, client Supabase project, Auth setup, migrations, RLS, deployment environments | Migration applies to an empty database; permission checks pass |
| C. Catalogue and inventory | Import validation, locations, receipts, balances, transfers, counts, adjustments, audit | Reconciliation report; no-negative-stock and transfer tests |
| D. Sales and fulfilment | Customer/order, reservation, payment/balance, delivery, return/damage/warranty workflows | Demonstration checklist using isolated test records |
| E. Website integration | Add public status feed and UI to the approved website target; review wording and failure behavior | SKU mapping and availability tests; brand approval before publishing |
| F. Live handover | Final stock count/import, staff accounts, role review, backup/restore check, user guide, training, acceptance | Signed pass/fail/deferred record, source/migrations and admin access transferred |

The quotation's **one-week live handover target** depends on delivery of the approved catalogue, stock counts, operating rules, client-owned accounts, approvers, and fast testing. Given the full scope, a reliable one-week handover cannot be promised from the current starting point. Set dates after stage A and show the critical path. A demonstration can use test data; real transactions begin only after cutover checks and written acceptance. The quoted 60-calendar-day defect warranty starts after written live handover.

## 9. Test and release gates

- **Database:** migration up/down strategy without destructive production changes; unique SKU, foreign-key, nonnegative balance, valid state, and payment amount constraints; concurrent last-unit reservation/sale tests; duplicate request/retry tests; reversal tests.
- **Security:** RLS tests for each staff role and anonymous website visitor; verify public access returns only intended fields; no credentials in repository/build output; administrator recovery ownership reviewed.
- **Data:** HQ import dry run and signed exception report; opening stock reconciles by SKU/location; financial balances checked against payment entries.
- **Application:** typecheck, lint, focused unit/integration tests, production build; browser checks for desktop/mobile, keyboard access, loading/empty/error states, and key operational flows.
- **Operations:** staging demonstration; production backup and restore verification; server logs and monitoring; deployment rollback plan; written acceptance results and known-issue list.

No production migration, real customer-data entry, public website change, or live deployment has been performed by this planning work.

## 10. Expected files and repositories

Create a separate client-owned ERP repository after account ownership is confirmed. Anticipated structure:

```text
erp/
  src/                 private React/TypeScript screens and data access
  supabase/migrations/ safe versioned PostgreSQL schema, functions, and RLS
  tests/               stock, security, and workflow checks
  docs/                permissions, imports, runbook, acceptance records
  .env.example         variable names only, never secrets
```

In the approved Ethiopia website repository, the likely changes are `src/App.tsx`, `src/data/catalog.ts`, a small availability client/helper, related styles, and deployment environment configuration. The current `content/products/*.json` remains a review snapshot until reconciled against the HQ file. This planning document is the only file changed in the present workspace.

## 11. Decisions and inputs needed before implementation

| Priority | Owner decision/input | Why it blocks or changes design |
| --- | --- | --- |
| 1 | Confirm legal Client/account owner, Supabase and repository owner, authorized decision maker, and website integration target | Production ownership, access, and release authority |
| 1 | Supply official HQ catalogue with unique SKU/variant rules and permission to use content | Product identity and safe website matching |
| 1 | Supply verified opening quantities by SKU, condition, and location | Cannot make trustworthy availability claims without them |
| 1 | Approve order, reservation, cancellation, sale fulfilment, transfer, return, damage, warranty, refund, and stock-adjustment rules | Determines transaction states and constraints |
| 1 | Approve staff permission matrix and named users | Required for RLS and restricted actions |
| 2 | Confirm which locations count as customer-available and the exact public status wording | Defines website status query and UI |
| 2 | Confirm local price/discount/tax and receipt or invoice requirements | Determines sales and payment fields; statutory accounting remains excluded |
| 2 | Confirm delivery workflow, required reports/forms, backup retention, and support arrangements | Completes screens, operations, and handover |
| 2 | Complete agreement schedules, milestone dates/payment, third-party charges, and legal review | Commercial readiness; the current draft has open terms |

## 12. First executable work package

Once priority-1 inputs are available: (1) create the client-owned ERP repository and development Supabase project; (2) write the initial migrations for products, locations, stock ledger/balances, staff roles and RLS; (3) implement catalogue import dry run and receipt/transfer operations; (4) test concurrent stock integrity and permission denial; (5) demonstrate stock changes against a private test dataset. Keep the public website disconnected until HQ product codes and brand-facing wording are approved.
