# Shared live testing — 12 November 2026

**Subsequent browser acceptance run:** actual form submissions, product image uploads, private evidence upload/opening, and the completed-sale/cancellation/failed-delivery paths have now been exercised. See [live browser test results](LIVE_BROWSER_TEST_RESULTS_2026-11-12.md) for current retained QA records, verified totals, and issues found. The initial verification table below describes the earlier database-focused check.

The owner explicitly requested removal of login and staff-role restrictions from the shared live database for testing. Temporary open testing is enabled. Open `http://127.0.0.1:5175/` and refresh an existing browser tab. All current staff workflows are available without signing in.

This is the shared Supabase database, not the browser-local demo at port 5173. Anyone with the project's public API key can read the ERP records and call the opened workflow endpoints while this mode remains enabled. Do not treat hiding or stopping the local website as restoring database access restrictions.

## What changed

- Migration `20261111221854_temporary_shared_testing_access.sql` creates a private control schema, preserves the exact deployed definitions of 18 workflow functions, and creates one clearly named testing identity with no password.
- Workflow functions use that identity and the required workflow role while testing is enabled. Their business validation, transactions, stock constraints, duplicate references, payment gates, and audit records remain intact.
- Conditional read policies allow the UI to load shared records. Conditional Storage policies allow image/evidence uploads and reads from the two existing ERP buckets. The evidence bucket remains private; testing access permits signed-link creation.
- The UI checks the database mode before attempting staff authentication, exposes all workflow controls, hides Sign out, and displays an open-testing banner. No privileged database or service-role credential is included in the browser.
- The switch is owned by the database; browser users cannot update it. Disabling it restores the existing staff checks even for an already-open testing tab. Refresh the tab to show sign-in again.

## Verification completed

| Check | Result |
| --- | --- |
| `npm test` | 23 tests passed |
| `tsc -b` and `npm run build -- --mode live` | Passed; existing bundle-size warning |
| Anonymous SQL workflow suite | Passed and rolled back |
| Existing upgraded workflow suite with testing disabled inside a rollback transaction | Passed, including staff role checks |
| No-login startup and eight screen navigation | Passed in a real browser |
| Product review drawer and existing name prefilling | Passed |
| Add product duplicate-SKU detection, case insensitive | Passed; creation disabled and existing review opens |
| Escape closes the review panel | Passed |
| Mobile review panel at 390 × 844 | Passed; inspected screenshot |
| Browser console | Missing `/favicon.ico` returns 404; no application error observed |
| Final database check | 93 products, 0 customers, 0 orders, 0 leftover QA products |

The anonymous SQL suite covers draft creation, duplicate SKU rejection, batch pricing, activation, opening counts, duplicate opening-count rejection, receipts, transfers, order creation, deposit requirements, duplicate payment references, reservations and extensions, full-payment dispatch gates, partial dispatch, signed handover, failed-delivery quarantine, full refunds, expired-hold release, and image/evidence metadata linking. It also disables the switch inside the transaction and verifies anonymous reads and product creation become blocked again. All its data changes roll back.

SQL evidence checks insert only temporary Storage metadata. They do not prove actual file bytes transfer through the Storage HTTP service. Full browser form submission from customer order through signed handover, actual file upload/download, concurrent sessions, and recovery after network failure remain unverified. The database suite proves server workflow execution rather than every browser submission path.

Supplier purchase orders, website integration, post-handover complaints, and quarantine inspection/release are still not implemented. Open access does not add those features. Most imported products still need approved prices/activation before they can be ordered.

## Restore staff-only access

Run from this repository in PowerShell:

```powershell
supabase db query --linked --file docs/RESTORE_STAFF_ACCESS.sql
```

Then refresh all browsers. The statement sets `erp_testing.access_control.enabled` to `FALSE`; existing accounts, data, files, and audit history are preserved. Restoration was verified and then rolled back; open testing remains on at the owner's request.

The security advisor flags anonymous execution of privileged workflow functions, as expected for this deliberately open mode. Review [Supabase's anonymous-function advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) when restoring production security. The advisor also reports the existing leaked-password protection setting; this work did not change account password policy.
