# Maison Debrah ERP — Standard Operating Procedures (SOP)

> **Earlier demo procedure:** This document includes the old 48-hour hold and HQ catalogue assumptions. Use [WORKFLOW_SOP_DRAFT.md](WORKFLOW_SOP_DRAFT.md) for the current proposed order-to-handover procedure.

This document proposes staff workflows for managing Ethiopian inventory, showroom sales, customer holds, and exceptions. The current UI is a browser-local demo, so these steps are not yet approved production procedures.

---

## 1. Goods Receipt (Warehouse & Showroom Stock Inflow)
1. **Authorized Staff:** Stock Clerk (Warehouse), Showroom Manager.
2. **Procedure:**
   - Physical container arrival or air freight clearance at the building.
   - Verify package integrity, product SKU, and physical unit count.
   - Open ERP screen **Receipts & Transfers** > **Goods Receipt**.
   - Select official HQ SKU and receiving location.
   - Enter Bill of Lading / Customs Declaration reference.
   - Click **Post Goods Receipt**.
   - Result: `sellable_on_hand` increases; an append-only `receipt` record is posted to the ledger.

---

## 2. Inter-Location Transfer (Warehouse <-> Showrooms)
1. **Authorized Staff:** Stock Clerk, Showroom Manager.
2. **Rule:** Total stock across Ethiopia remains constant.
3. **Procedure:**
   - Open **Receipts & Transfers** > **Move Stock Between Areas**.
   - Select SKU, Source Location, and Destination Location.
   - Verify unreserved availability at source (must be $\ge$ transfer quantity).
   - Enter Transfer Waybill Number.
   - Click **Execute Stock Transfer**.
   - Result: Source location `sellable_on_hand` drops by $N$; Destination location `sellable_on_hand` rises by $N$.

---

## 3. Showroom Sales & Customer Reservations
1. **Authorized Staff:** Showroom Sales Consultant, Showroom Manager.
2. **Rules:**
   - Customer holds are time-bound (default: 48 hours).
   - Placing a hold decrements `sellable_available` immediately so other staff or website visitors cannot claim the unit.
   - Physical on-hand remains untouched until delivery/dispatch.
3. **Procedure:**
   - Open **Showroom Orders** > **New Showroom Order**.
   - Enter customer name and phone number.
   - Add product line items; check real-time available stock.
   - When customer requests time to arrange payment, click **Place Hold (Reservation)**.
   - When deposit arrives, open **Payments & Cashier** and record the payment against the order.
   - When order is ready for delivery, click **Fulfil & Dispatch**.
   - Intended live result: Both physical on-hand and the reservation hold are updated in one verified database transaction. The demo only prevalidates and updates browser-local state.

---

## 4. Damaged Goods, Returns & Warranty Quarantine
1. **Authorized Staff:** Stock Clerk, Showroom Manager.
2. **Rule:** Damaged or uninspected items must **NEVER** contribute to public website availability.
3. **Procedure:**
   - Open **Returns & Damage** > **Register Exception Case**.
   - Select SKU, area, quantity, and disposition (`quarantined` or `pending_inspection`).
   - Describe transit or handling defect.
   - Current demo result: The case is logged for review. It does not change stock or public availability. A separate approved and auditable stock adjustment is required to segregate affected units.

---

## 5. Month-End Physical Inventory Audit & Adjustment
1. **Authorized Staff:** Showroom Manager or Administrator **ONLY**.
2. **Procedure:**
   - Conduct physical floor count.
   - Open **Receipts & Transfers** > **Physical Audit & Adjustment**.
   - Select product and location; enter verified physical count.
   - Enter justification note.
   - Click **Authorize & Post Adjustment**.
   - Result: System variance delta is computed and posted to `audit_events` and `stock_movements`.
