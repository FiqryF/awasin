# AWASIN Phase 6 — Admin Dashboard & Management System

Updated 30 October 2026 (Asia/Bangkok).
**Phase 6 implementation and the approved controlled-write cloud QA are complete. Verification limits and production prerequisites remain explicit below.**

## A. Initial Audit

Phase 5 working changes and existing AuthProvider, JWT checks, database roles and account transport were preserved. Admin routes were placeholders; Feedback lacked a handling workflow; four education articles used frontend constants; registry/CMS/audit tables did not exist. Cloud preflight found one administrator role and one bootstrap record. No new bootstrap, role assignment, Auth setting change or MFA flow was introduced.

Target: `nqruowgbxiopfhslznyb`, **main / PRODUCTION**. The user describes the app as development and explicitly approved migrations 005–006 on this branch, acknowledging the unverified full-backup limit. Applied migrations 001–004 were not rerun.

## B. Implemented Modules

| Module | Behavior | Verification |
| --- | --- | --- |
| Admin workspace | Five protected screens, sidebar, account/logout integration, responsive editors | Local UI/routes; actual authenticated cloud dashboard |
| Dashboard | Real aggregates and recent audit, no invented detection statistics | Actual cloud: 5 Feedback and 4 original published articles |
| Feedback | Server search/filter/pagination, immutable original, separate status/private notes, optimistic version | Local UI/API/PostgreSQL tests; live list/search/detail. Actual cloud status changed to in_review then restored to new with empty note |
| Registry | Manual organizations/candidates, IDNA/offline PSL normalization, explicit evidence review, verification reset on edits | Test organization/candidate persisted; candidate archived without verification. Local tests cover review/reset/conflicts |
| Education CMS | Structured editor, preview, draft/publish/archive, immutable existing slugs, published-only API | Four originals deeply equal cloud objects; local editorial tests. Actual cloud create/edit/preview/archive passed; never published; public URL returned 404 |
| Audit | Trusted database actor, append-only events, safe metadata, atomic with mutation | Local ACL/transaction tests; real import/organization events. Actual cloud audit: 12 events, including all 8 authorized test actions, each attributed to the existing administrator |

No crawler, automated domain collection, detection engine, fabricated verdict, fake verified domain, role editor or unrestricted SQL explorer was added.

## C. Architecture

Frontend reuses protected routes and accountRequest. FastAPI verifies the caller and existing database administrator role. Supabase requests use the caller JWT and publishable key; the module needs no service-role credential.

Narrow PostgreSQL RPCs independently check administrator role and active session, apply optimistic versions, mutate and audit in one transaction. The database derives actor identity from auth.uid(). Record pages and searches are bounded and server-side.

Public education queries deliberately use anonymous access even for signed-in administrators, returning published content only. Repository `.env.example` retains the local source default. This PC's ignored `.env` uses `VITE_EDUCATION_SOURCE=cms` after cloud equality checks. CMS errors do not resurrect withdrawn local content through fallback.

## D. Database Changes

Both reviewed migrations succeeded through Supabase SQL Editor on 29 October 2026. **Do not rerun or edit these applied migrations.**

- 005 `202610290005_admin_workspace.sql`: feedback_handling, registry_organizations, registry_domains, education_articles, admin_audit_events; forced RLS, narrow RPCs, aggregates, article validation and audit triggers.
- 006 `202610290006_education_seed.sql`: exact four original article objects and explicit import events. Import dates are not invented publication dates. Only the article audit trigger is disabled inside the locked seed transaction and re-enabled afterward.

Migration postflight: five forced-RLS tables; zero direct application write grants; four published originals; four seed audit events; article audit trigger enabled. Existing profiles/roles/Feedback/reports remained 4/4/5/0, and recorded preservation fingerprints matched preflight. This is migration evidence, not a fresh final write-QA audit.

Reviewed local artifact SHA-256 values still match:

```text
005 79ced7bf0acc5e1a2dd8f5a679fcd707a8b3a1944b11197752be24d68b59be32
006 25685b0017ea7385816799981036508e01823c2e72bfdd97cb12289474b7586f
```

Native transport altered non-ASCII text in a leading SQL comment in 005; functional SQL was ASCII. Before applying 006, JSON Unicode was escaped for ASCII transport. Actual decoded cloud article objects, including Unicode wording, were deeply compared to source and all four matched. Hashes identify reviewed local files, not a claimed byte-exact SQL Editor history export.

## E. UI/UX

A compact admin shell uses AWASIN black/honeydew/blood red, existing typography/icons, tables and native forms. No public hero/video or fake chart grid. Narrow screens stack editor panels; mobile navigation and tables allow horizontal scrolling. Labels, visible focus, loading/error/retry/empty states and reduced motion are retained.

Browser QA found and addressed two issues:

1. Stacked editors did not receive focus. Shared EditorHead now focuses its heading and restores the previous connected element on close; UI assertion covers this.
2. Confirm dialogs disappeared immediately in development. StrictMode replays effects; cleanup called native dialog.close(), whose close handler cleared the parent's confirmation state. Teardown closure no longer cancels a new mount; explicit cancellation still updates state. A regression with StrictMode and native close events failed before the fix, then passed. The real candidate archive confirmation subsequently remained open and the archive persisted.

## F. Security

- FastAPI administrator authorization plus independent database role/session checks.
- Local PostgreSQL Guest/User/Admin isolation; real anonymous cloud private-table/RPC denial.
- Private notes are separate from original Feedback/self-service grants; handling never edits original text.
- No direct application writes to new tables; no application audit rewrite/delete capability.
- Audit metadata excludes Feedback bodies, contact and private note contents; import actors are explicitly absent.
- Structured article text renders inertly. Evidence/source URLs require HTTPS; submitted evidence URLs are not fetched automatically.
- IDNA and offline PSL reject malformed, IP, suffix-only and URL/path inputs. Homographs are not silently equated. Domain verification never promises website safety.
- Optimistic versions reject stale updates; UI locks duplicate submissions; admin reads are no-store.

## G. Tests

Checks executed on 30 October 2026:

| Check | Observed result |
| --- | --- |
| Full frontend suite | 210 tests / 21 files passed after final dialog fix |
| Admin tests after final dialog fix | 11 passed, including StrictMode confirmation regression |
| Lint after final fix | Passed |
| Build with local HTTP API | Rejected as intended by production HTTPS guard |
| Build with process-only HTTPS placeholder API | Passed after final dialog fix. Compilation only, no deployment. Existing main bundle >500 kB warning |
| Route checks | 24 routes and form/transport boundaries passed; fixture SSR, not cloud browser E2E |
| Admin database checks | PGlite migrations/seed/RLS/RPC/audit/conflicts/editorial/revoked-session checks passed; local only |
| History database regression | PGlite ownership/preferences/ingestion/deletion checks passed |
| Backend pytest | 123 passed; one existing Starlette/httpx deprecation warning |
| Read-only public cloud verifier | 7 passed again after all writes: four exact original objects and anonymous private-table/RPC rejection |
| Final cloud SQL | 10 evidence rows confirm restored Feedback, archived/unverified candidate, archived edited draft, original-data fingerprints and audit actor/count |
| Public backend draft URL | 404 while draft and after archive |

Sandbox blocked esbuild directory reads on the first attempt; the approved execution context resolved startup. Lint found a control-character regex in the seed generator; the equivalent explicit non-ASCII range fixes lint without regenerating applied SQL.

Actual browser QA observed authenticated metrics, Feedback list/search/detail, registry writes and public cloud articles. Static desktop/tablet/mobile shell reviews are distinct from live workflow E2E.

### Controlled-write QA ledger

| Approved record | Verified state |
| --- | --- |
| Organization UJI PHASE 6 - QA 20261029 | Created once on 29 October; id fd20341b-6d8a-4ca5-8ff5-5b70cb084325; retained |
| Candidate phase6-20261029.example.com | Created pending on 30 October, then archived through confirmed UI; never verified. Description explicitly says relationship is unproved |
| Feedback dbe26222-98eb-474e-b419-dcc45bc5506b | Actual cloud in_review write and restore to new/empty note verified; final version 3; original content fingerprint unchanged |
| Draft uji-phase6-20261029 | Created, edited and archived without publishing; id a6ec3806-bff2-4adc-a35f-bc05ef9c0964; final version 3; saved edit verified |

Final read-only SQL returned 10 evidence rows: Feedback restored to new/empty note/version 3; candidate id 5ef49ec6-c0fa-49fa-8822-54ed8ad75e24 archived with verified_at null; draft archived/version 3 with saved edit present; four published articles; zero test-article publication events; 12 total audit events; all eight test events attributed to an existing administrator role.

Existing Feedback fingerprint remains 5650d1c846d51c30d829488bbae072d6, profiles a329fcf0d33ad362f2a0481b2e21c413, roles ead042c9870eeba3666ba8a97f56574c, matching preflight. Four original article objects passed deep equality again after the writes. The draft URL returned 404 both while draft and after archive through the public backend. No original Feedback content, profile, role or original article content changed. Test records/audit are retained as approved. Audit metadata shown in the actual UI contained status/version transitions, not private bodies/notes.

## H. Known Limitations

The approved cloud write QA is finished. Local role tests and actual anonymous cloud checks do not establish live ordinary-user JWT isolation; an authenticated ordinary-user cloud test was not performed in this continuation. Public publish/unpublish and domain verification/reset were tested in isolated PostgreSQL and UI/API tests, not by publishing a test article or asserting a fake relationship in cloud. Exhaustive browser/device E2E is not claimed.

Full backup/restore remains unverified. Standard migration ledger was absent; no ledger repair or db push attempted. Cloud main is labeled PRODUCTION despite development use. Existing Phase 5 recovery-email/browser lifecycle gaps are separate. No deployment occurred; the HTTPS placeholder build is not a usable deployment API configuration.

## I. Files Changed

- backend/app/modules/admin/{__init__,router,schemas,service}.py: admin/public APIs, validation and caller-JWT transport.
- backend/app/api/v1/router.py, backend/pyproject.toml: registration and IDNA/PSL dependencies.
- backend/tests/test_admin.py, test_foundation.py: security/validation and expanded API contract.
- frontend/src/features/admin/: AdminLayout, OverviewPage, FeedbackPage, DomainsPage, ArticlesPage, AuditPage, shared ui/api and scoped CSS.
- frontend/src/features/education/useEducation.ts, pages/EducationPage.tsx, sections/EducationSection.tsx: public CMS adapter, originals retained.
- frontend/src/routes/AppRoutes.tsx, routeConfig.ts: real admin routes replace placeholders.
- frontend/src/features/settings/api.ts: admin conflict/validation messages via existing transport.
- frontend/tests/admin.test.tsx, vitest.config.ts, scripts/check-routes.mjs, check-admin-db.mjs, generate-education-seed.mjs, package.json, .env.example: tests/tooling/CMS opt-in.
- supabase/migrations/202610290005_admin_workspace.sql, 202610290006_education_seed.sql, tests/phase6_cloud_audit.sql: forward schema/seed and read-only checks.
- PHASE6_CLOUD_PLAN.md and this report: approved scope and execution evidence.

Prior Phase 5 uncommitted auth/settings work is preserved. Local ignored QA evidence contains no credentials and is not an application deliverable. No commit or push.

## J. Next Steps

No remaining authorized controlled-write cleanup is outstanding: Feedback was restored, candidate and draft were archived, and audit retained. Before production, verify full backup/restore, set a real HTTPS API deployment endpoint, run live ordinary-user negative authorization checks and complete broader browser/device/auth lifecycle testing. Engines, automated collection and provider analytics belong to later phases.



## Maintenance verification — 30 October 2026

Addressed the 30 reported SonarQube findings across nine files: reused ordered async execution for the local migration harness; passed rejection operations as callbacks; used explicit Error construction, raw Unicode escapes and codePointAt in the seed generator; expanded ambiguous one-line guards; added explicit submit button types; replaced article editor index keys with stable local IDs stripped from API payloads; simplified the audit query template and account transport error handling; merged duplicate auth policy imports and used optional chaining.

Regression evidence: the section-removal identity test failed before the stable-key change and passed afterward. Added a payload equality test proving editor IDs are not sent to the backend. Final checks: 212 frontend tests / 21 files, ESLint, TypeScript/Vite build, 24 route checks and local administrator PostgreSQL checks passed. Unicode roundtrip and equality with the existing applied seed were verified read-only, including a supplementary Unicode character. Migration 005/006 hashes are unchanged. Production build verification used a process-only HTTPS placeholder API URL as documented above; no deployment or cloud mutation was performed for these fixes.
