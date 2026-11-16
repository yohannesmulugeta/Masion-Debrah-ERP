-- Immediate restoration. Run with the database owner's SQL editor or linked CLI.
-- Existing accounts, records, files and history are preserved.
BEGIN;
UPDATE erp_testing.access_control SET enabled = FALSE WHERE singleton;
NOTIFY pgrst, 'reload schema';
COMMIT;
-- Refresh every open browser. The app will require a named staff sign-in again.
