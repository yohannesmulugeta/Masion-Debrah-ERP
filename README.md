# Maison Debrah ERP prototype

This is a browser-local demonstration of inventory, orders, and staff workflows for four areas in one building: **Warehouse** and **Showroom 1–3**. It is not connected to a live database or the Ethiopia website. The role selector is for demonstration and is not authentication. Product names, stock, prices, customers, and payments in the demo are sample data.

## Public demo

The GitHub Pages build is published from `main` by `.github/workflows/deploy-pages.yml` at <https://yohannesmulugeta.github.io/Masion-Debrah-ERP/>. The site is a public demo: anyone can open it, change their own browser-local copy, and reset that copy. Do not enter real customer, staff, stock, or payment information.

## Run locally

```powershell
npm install
npm run dev
```

Open the URL printed by Vite. Demo changes are stored in this browser's local storage. The header reset restores the sample dataset.

## Checks

```powershell
npm test
npm run build
```

There is no lint script. The test suite covers selected stock and import rules; it does not prove multiuser transaction safety or production readiness.

## Current architecture

- React, TypeScript, and Vite render the staff demo.
- `src/context/ErpContext.tsx` stores state in the browser. `src/lib/mockData.ts` supplies unverified sample data.
- `src/lib/supabase.ts` contains a client helper, but the UI does not use it for its workflows.
- `supabase/migrations/` contains a proposed PostgreSQL schema, functions, row-level security, a public availability view, and optional demo seed data. These files are not a deployed backend.
- The SQL migrations insert only the four generic areas by default. Demo products and balances require `app.allow_demo_seed = 'on'` in an isolated development database. Do not enable the demo seed against business data.
- Operational SQL functions remain unavailable to client roles pending a verified authentication, authorization, and transaction design. Do not connect the current UI to production data.
- The website feed screen is a simulation. No website connection has been implemented or verified.

## Before live use

1. Confirm the area layout and staff responsibilities for Warehouse and Showroom 1–3.
2. Obtain the approved HQ catalogue, local prices, and a signed physical opening stock count.
3. Implement staff sign-in and scoped access, then complete and review each server-side transaction with concurrency tests.
4. Connect the UI to the live backend and replace browser-local storage. Verify orders, reservations, payments, adjustments, and audit logs end to end.
5. Review the public availability view and integrate it with the website using verified SKU mapping and a neutral error state.
6. Test migration and rollback plans on a copy of the intended database before production deployment.

See `docs/ACCEPTANCE_CHECKLIST.md` for the handover gates.
