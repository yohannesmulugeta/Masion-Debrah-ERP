# Maison Debrah ERP

**12 November 2026 — temporary open testing:** the shared live backend currently permits the staff workflows without sign-in or role restrictions, at the owner's explicit request. The live local app at `http://127.0.0.1:5175/` detects this mode automatically. Business validation remains enabled. See [the testing report and restoration procedure](docs/OPEN_TESTING_REPORT.md) before using shared records. Port 5173 remains the separate browser-local demo.

The ERP handles inventory, orders, Finance-recorded payments, deposit reservations, dispatch, and signed handover for **Warehouse** and **Showrooms 1–3**. The local demo uses sample data. The connected preview uses the shared Maison Debrah Supabase workspace.

## Public connected preview

GitHub Pages builds from `main` via `.github/workflows/deploy-pages.yml` and serves the preview at <https://yohannesmulugeta.github.io/Masion-Debrah-ERP/>. The workflow uses the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` GitHub Actions secrets. The client requires a publishable browser key. While open testing is enabled, actions affect shared records. Use simulated customer, transaction, and evidence data.

The interface uses the supplied Maison Debrah logo artwork, the brand guideline's dark `#2A352F` and light `#AFBBA3` colors, and Playfair Display with Inter. The web logo in `public/brand/` is a tightly framed copy of the supplied light logo with the guideline's light color. See `docs/PRESENTATION_GUIDE.md` for a short demonstration sequence.

## Run locally

```powershell
npm install
npm run dev
```

Open the URL printed by Vite. Demo changes are stored in this browser's local storage. The header reset restores the sample dataset.

## Run the connected staff app locally

The repository is linked to the dedicated Maison Debrah Supabase project. A local `.env.live.local` file holds its URL and **publishable browser key**; it is ignored by Git. Copy `.env.example` to that file and fill those two values only if they are not already configured. Never place a service-role key or database password in a Vite environment file.

```powershell
npm run dev -- --mode live --host 127.0.0.1 --port 5175
```

Open <http://127.0.0.1:5175/>. When named access is restored, the invited administrator can use **Need to set or reset your password?** to request a fresh email link. The temporary Auth redirect is configured for this local address. Add the Pages path to the allowed redirects before using password setup on the public preview.

## Checks

```powershell
npm test
npm run build
```

There is no lint script. The test suite covers selected stock and import rules; it does not prove multiuser transaction safety or production readiness.

## Current architecture

- React, TypeScript, and Vite render the staff demo.
- `src/context/ErpContext.tsx` stores state in the browser. `src/lib/mockData.ts` supplies unverified sample data.
- The demo now keeps payments, refunds, stock release, and signed delivery as separate records. Finance alone records payments and pre-dispatch refunds in the demo; dispatch requires a zero order balance. These controls are browser-local and are not production authorization.
- `src/live/LiveApp.tsx` provides the separate connected staff interface with named Supabase Auth accounts and server-checked workflow calls. It still needs a real-user walkthrough before operational use.
- `supabase/migrations/` contains the deployed PostgreSQL schema, functions, row-level security, and workflow transactions for the dedicated Maison Debrah project.
- The SQL migrations insert only the four generic areas by default. Demo products and balances require `app.allow_demo_seed = 'on'` in an isolated development database. Do not enable the demo seed against business data.
- Remote SQL smoke tests pass for core workflows, product permissions, and price audit history. They roll back their test records. Staff UI sign-in and transaction testing with real approved data remain open.
- The website feed screen is a simulation. No website connection has been implemented or verified.

## Before live use

1. Confirm the area layout and staff responsibilities for Warehouse and Showroom 1–3.
2. Obtain the approved local product and price list and a signed physical opening stock count.
3. Have the invited administrator set an ERP password and verify the connected staff app in the browser.
4. Load approved products, prices, and signed opening counts; verify orders, reservations, Finance payments, dispatch, and signed delivery end to end.
5. Review the public availability feed and integrate it with the website using verified SKU mapping and a neutral error state.
6. Configure final GitHub Pages Auth redirects and deploy the live build only after the workflow and data checks pass.

See `docs/ACCEPTANCE_CHECKLIST.md` for the handover gates.
See `docs/ERP_BUILD_PLAN.md` and `docs/WORKFLOW_SOP_DRAFT.md` for the current build sequence and process rules.
See `docs/IMPLEMENTATION_STATUS.md` for verified progress and remaining limits.
