# Phase 6 — reviewed cloud execution plan

Target: **AWASIN `nqruowgbxiopfhslznyb`, branch `main / PRODUCTION`**.
The application is development, but this is the primary database, not a disposable
test branch. No migration execution is authorized by the implementation brief alone.

## Exact change set

1. Apply only `supabase/migrations/202610290005_admin_workspace.sql`, once.
   Adds `feedback_handling`, `registry_organizations`, `registry_domains`,
   `education_articles`, `admin_audit_events`; indexes, private validation/role/audit
   helpers and three narrow RPCs `admin_mutate`, `admin_overview`,
   `admin_feedback_page`. Existing DB role and active_session must both authorize
   every admin RPC. No direct application write privilege on the five tables.
2. Existing administrators gain SELECT access to submitted Feedback for management.
   Internal notes stay in a separate admin-only table; original text is immutable.
   This intentionally expands admin access to private submissions/contact details;
   list/overview omit contact data, detail reveals only voluntarily supplied contact.
   Ordinary users retain their existing self-feedback access, never internal notes.
3. Apply only `supabase/migrations/202610290006_education_seed.sql`, once, after 005.
   Imports the four exact original articles as published; original slugs/content/
   references/images unchanged. An equivalence guard aborts on mismatch. It locks
   the new article table and disables ONLY its audit trigger within the transaction
   for deterministic system import, reenables it, and adds actor-null import events.
   These import timestamps are not claimed as original publication dates.
4. Public published articles become selectable through RLS; drafts and archived
   rows stay private. Source constants remain intact. Default frontend still uses
   `VITE_EDUCATION_SOURCE=local`; switch to `cms` only after exact cloud seed
   equivalence and anonymous publication restrictions are checked. Then restart
   the frontend normally to load the changed local environment value.

No migration 001–004 replay, db push, ledger edits, admin provisioning/role changes,
Auth setting changes, deletions, user-data reset, deployment, purchases, or commit.
No automated domain collection, detection engine, or new service-role credential.

## Dependencies and preservation

Needs existing auth/users/sessions, active_session, user_roles, profiles, Feedback
and scan_reports objects from 001–004. Source and local PostgreSQL tests cover these
dependencies. Read-only cloud preflight on 29 October confirmed admin_roles=1,
bootstrap_records=1, Phase 6 tables absent, standard migration ledger absent.
Do not rerun first-admin bootstrap; it has already been recorded once. Runtime
admin authorization does not require MFA.

Capture non-sensitive preflight counts and existing-object fingerprints immediately
before execution; do not export passwords, tokens, or raw Feedback to source.
Private evidence belongs in Git-ignored `.phase6.local/`, not committed reports.

## Backup and recovery limits

**No verified full backup/restore is available.** A catalog snapshot does not restore
application data. This limitation must be acknowledged in cloud approval. Both
migrations are transactional and additive. A failure within a migration rolls that
migration back. If 005 succeeds but 006 fails, keep CMS source local, stop activation,
inspect the failure, and prepare a reviewed forward correction; never drop objects
or replay applied migrations blindly. Once admin writes exist, dropping new tables
would destroy that work and requires separate approval.

## Verification and activation

- Run `supabase/tests/phase6_cloud_audit.sql`: expected five new tables with RLS,
  no direct writes granted, four published seed rows and four import events.
- Compare actual cloud content against the original four article objects; do not
  activate CMS on hash/content mismatch or merely because four rows exist.
- Verify Guest/User cannot invoke admin RPCs or read notes/audit/registry/drafts.
- User operates login for the existing administrator. No password/OTP/token in chat,
  no extracting browser session credentials, no owner logout/password changes.
- Test live overview/filter/list reads and anonymous CMS content. Management write
  QA requires approval for explicitly identified test records and actions. Do not
  change existing real Feedback status or publish invented public articles merely
  to test. Local fixtures already exercise these workflows under PostgreSQL.
- Domain live verification needs real official evidence and an authorized manual
  decision; no fake trusted registry entry or forged analysis report.
- Test UI at desktop/tablet/mobile; report browser E2E separately from static shell
  review and mocked integration tests.

## Local evidence before approval

`npm.cmd run check:admin-db` passed actual local PostgreSQL semantics for migrations
001–006, seed equivalence, ACL/RLS, audit atomicity, conflicts, revoked sessions,
private notes, evidence review reset, publication and immutable article URLs.
New backend tests cover IDNA, PSL boundaries, forbidden caller roles, validation,
provider errors and filters. UI tests cover protected navigation, inert content,
confirmation before publication, API states and no stale local fallback from CMS.
Full counts and final command results are in `PHASE6_IMPLEMENTATION.md`.

## Execution status (30 October 2026)

The user explicitly approved 005–006 on main / PRODUCTION with the stated backup limitation. Both were applied successfully on 29 October. Forced RLS on all five tables, zero direct application write grants, four exact published original article objects and enabled article audit trigger were verified. Original data preservation fingerprints matched. Local CMS opt-in was activated only after deep equality checks. Do not rerun migrations. The three specifically approved live write workflows are complete: Feedback restored to new/empty note, candidate archived without verification, and draft created/edited/archived without publication. Final read-only SQL confirmed unchanged original-data fingerprints and eight administrator-attributed test events. Evidence and limits are recorded in PHASE6_IMPLEMENTATION.md.
