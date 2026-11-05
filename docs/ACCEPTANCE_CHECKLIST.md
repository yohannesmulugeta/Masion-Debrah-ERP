# Maison Debrah ERP — Acceptance checklist

The current UI is a **browser-local prototype**. Its sample workflows and SQL files are not a live, accepted ERP. Mark a live item complete only after testing it with approved business data and authorized staff.

| Area | Prototype evidence | Live acceptance gate |
| :--- | :--- | :--- |
| Areas | Warehouse and Showroom 1–3 display as separate rooms in one building. | Confirm room labels and physical inventory ownership. |
| Catalogue and prices | Import preview checks basic SKU errors; demo contains sample products and prices. | Import and reconcile approved HQ SKUs and approved Ethiopia prices. |
| Opening stock | Demo movements and balances exist in browser storage. | Sign off physical counts and post verified opening balances with an audit trail. |
| Receipts and transfers | Demo flows can be exercised locally. | Test authorized, atomic posting, reversal procedure, and concurrent use. |
| Orders and holds | Demo order creation and fulfilment reject several invalid states. | Implement and test durable reservations, expiration, cancellation, and concurrent overselling prevention. |
| Payments and refunds | Demo payment validation runs locally. | Define finance approvals and verify server-side ledger and reconciliation. |
| Damage and returns | Exception cases are logged without changing stock. | Approve and implement a separate, auditable quarantine/stock adjustment workflow. |
| Staff permissions | Demo role switcher changes visible controls; SQL client writes are restricted. | Implement real staff authentication and database authorization for each operation. |
| Website availability | Inspector shows a simulated status. | Review public view security, connect website, and test SKU mapping, stale data, and errors. |
| Handover | Source and migrations are present locally. | Complete deployment, recovery, training, and written business sign-off. |
