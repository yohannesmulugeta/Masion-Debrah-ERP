# Maison Debrah ERP demo presentation

## Before presenting

1. Open the [public demo](https://yohannesmulugeta.github.io/Masion-Debrah-ERP/) or run `npm run dev` and open the local Vite URL.
2. Select **Administrator** in the demo role picker and **All Areas** in the stock view.
3. Click **Reset Baseline** to restore the sample dataset in that browser. This discards any demo changes previously made in that browser.
4. Check that the logo, dashboard, and navigation load at the presentation screen size.

## Suggested five-minute walkthrough

1. **Dashboard:** Explain that the warehouse and three showroom areas are rooms in one building. Point out the stock, reservation, order, and exception summaries.
2. **Stock by Area:** Show how the same product can have different quantities across the four areas, and how reserved units reduce the immediately available quantity.
3. **Receipts & Transfers:** Open the transfer form to show the intended movement workflow. Submit only if you want to demonstrate a browser-local sample transaction; reset afterward.
4. **Showroom Orders and Reservations:** Show the order list and customer holds. The role picker demonstrates proposed staff views; it does not sign anyone in.
5. **Website Feed Inspector:** Show the intended availability rule, then state clearly that this screen is a simulation and is not connected to the public website.

## What to say about readiness

“This is a branded workflow demonstration with sample products, prices, stock, and customers. Changes stay in this browser. Before staff can use it for real operations, it needs approved catalogue data, a verified opening stock count, authentication, server-side transaction controls, and a live database connection.”

Do not enter real customer, payment, or stock information during the demonstration.
