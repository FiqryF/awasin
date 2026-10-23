# AWASIN Phase 2 — Identity implementation and activation review

## Current login policy — owner change, 23 October 2026

Admin and ordinary users now sign in with email/password. Admin authorization
still requires a verified session, confirmed account and the current database
admin role; aal2 is no longer a prerequisite. MFA enrollment UI and its link were
removed. Old /auth/mfa links redirect to protected account settings. JWTs with aal1
or aal2 remain valid; assurance alone never grants the admin role.

The backend was restarted with this policy. 50 backend tests and 41 frontend
tests passed, including admin aal1 acceptance and ordinary-user admin rejection;
TypeScript, lint and production compilation passed (temporary HTTPS example API
URL, no local .env changes). After explicit action-time owner confirmation,
Supabase TOTP was saved Disabled and Limit duration of AAL1 sessions was saved
off; both updates returned success notifications. The dashboard removed the old
admin factors, and a read-only SQL check returned zero factors across auth.mfa_factors,
one admin account and the intended account still holding role admin. The invitation
template now instructs email/password login without authenticator enrollment.
The current administrator dashboard remained accessible. A fresh password login
has not been performed by the agent. Earlier MFA requirements and
enrollment steps below describe the historical policy, not current application
login behavior. The consumed initial-bootstrap migration is retained as history.

## Status and repository audit

Local implementation extends Phase 1; real Supabase end-to-end verification is
pending configuration and explicit remote approval. Do not describe Phase 2 as
complete until remote flows, migrations, grants/RLS and MFA are demonstrated.

Before implementation, the relevant source tree and previous audit were reviewed:
frontend React/TypeScript/Vite, shared auth components, five existing auth pages,
routes/placeholders, API helper, environment examples, scripts, backend factory,
settings, logging, exception handlers and tests. No Supabase integration or real
dashboard existed. The five pages used local validation, with timers simulating
work. Existing `frontend/src/index.css` changes belong to the owner and were kept.
Phase 1 baseline: 27 tests passed on Windows/Python 3.13.2 before edits.

The project URL supplied by the owner is
`https://nqruowgbxiopfhslznyb.supabase.co`. Its public JWKS was read, without
credentials or mutation, on 23 October 2026: an ES256 signing key was available.
This does not establish database contents, Auth settings, email delivery or RLS.
No actual environment secret files were read or printed during implementation.

## Architecture and responsibilities

- Browser: official Supabase JS client, PKCE, persistent session and SDK refresh.
- Supabase Auth: signup, confirmation, password login/recovery/change and TOTP MFA.
- FastAPI: signature/claim verification, online account check, own-profile access,
  current database role lookup and admin-role enforcement.
- PostgreSQL: profile ownership, column privileges, current session check and role
  protection. User-editable metadata never supplies authorization.

No custom login/register backend, password database, token issuance, refresh-token
rotation or runtime administrative key was introduced. HTTPX is now a runtime
dependency; PyJWT with cryptography verifies asymmetric signatures. Frontend adds
Supabase JS plus Vitest/jsdom for deterministic unit/component tests.

## Files and routes

```text
backend/app/modules/identity/
  service.py             # JWT/JWKS, provider calls, current role and profile
  router.py              # reusable auth dependencies and protected endpoints
backend/tests/test_identity.py
frontend/src/features/auth/
  client.ts              # official PKCE client
  actions.ts             # signup/login/recovery/change/logout SDK operations
  policy.ts              # password and fixed internal return-path policy
  identity.ts            # authenticated backend transport/runtime shape validation
  context.ts, useAuth.ts, AuthProvider.tsx
  ProtectedRoute.tsx, callback.ts
frontend/src/pages/AccountPage.tsx
frontend/tests/auth.test.tsx, callback.test.tsx, password-setup.test.tsx
frontend/vitest.config.ts
supabase/migrations/202610230001_identity.sql
supabase/tests/identity_rls.sql
docs/PHASE_2_IDENTITY.md
```

Modified: backend settings, application lifespan/CORS, v1 router, error cache
headers, dependency manifest and environment example; frontend App, routes,
existing auth pages, field ARIA hint, environment declarations/example, package
manifest/lock, route smoke check and referrer meta. Existing CSS was not edited.
Phase 1 OpenAPI route-inventory assertion was expanded to include new endpoints;
health, error, configuration and regression checks remain in place.

| Method | Endpoint | Protection |
| --- | --- | --- |
| GET | `/health`, `/api/v1/health` | Public, no provider calls |
| GET | `/api/v1/auth/me` | Verified token, confirmed account, active session/own role/profile |
| PATCH | `/api/v1/profiles/me` | Same identity, display_name only |
| GET | `/api/v1/admin/identity` | Same identity and current admin role |

There is no endpoint accepting another user's ID for profile access. Forbidden
profile fields return 422. Missing/invalid/expired authentication returns 401;
insufficient role returns 403; provider/configuration failures return
503. Identity and error responses use `Cache-Control: no-store`.

Frontend paths `/dashboard`, `/settings`, `/history` require verified identity.
`/admin/dashboard` and existing `/admin*` routes also require current admin role.
`/auth/mfa` redirects to account settings. Other product features stay placeholders.

## Configuration — enter locally

Do not paste passwords, JWTs, secret/service-role keys or database connection
strings into chat, source files, screenshots or Git. Browser publishable keys are
not administrative secrets, but must belong to this project.

Only modern `sb_publishable_...` keys are accepted. Secret/service-role and legacy
JWT keys are rejected by configuration; do not put any secret into VITE_* even to
test validation because environment values can be embedded into a build.

Frontend `.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://nqruowgbxiopfhslznyb.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<project publishable key>
```

Backend `.env`:

```env
SUPABASE_URL=https://nqruowgbxiopfhslznyb.supabase.co
SUPABASE_PUBLISHABLE_KEY=<same project publishable key>
SUPABASE_JWT_ALGORITHM=ES256
```

Retain Phase 1 settings. Keys in these examples are placeholders. Never use a
service-role/secret key in either field. Backend identity endpoints fail closed
when unconfigured; public health still works. Frontend displays unavailable
configuration rather than fake login success. Restart Vite after environment edits.

The selected project uses ES256. RS256 is configurable if an owner-approved
signing migration changes the project. HS256 is intentionally rejected: legacy
projects require a separately reviewed provider-side verification path, not a
JWKS fallback, secret copied to the browser, or disabled signature verification.

## JWT and session verification

The backend pins the configured algorithm and trusted project JWKS URL. It checks
JWT type, key ID, signature, issuer, audience, expiry, issued-at, role, UUID subject,
UUID session ID, AAL and non-anonymous semantics. Required claims cannot be omitted.
User metadata and arbitrary token-supplied JWKS URLs are ignored.

JWKS cache lifetime: 300 seconds per worker; unknown keys can refresh only after
30 seconds. Expired cached keys are not retained on refresh failure. Requests have
five-second timeout, no redirects and no ambient proxy configuration. Cache
revocation propagation is bounded by its TTL; emergency key revocation also needs
worker restart/cache eviction and provider coordination.

Each protected request checks Supabase Auth `/user` and current role/profile through
PostgREST using the user's own JWT and a publishable key. Role data is not cached;
role revocation affects the next request, even for an existing JWT. RLS checks
that `session_id` still exists in `auth.sessions` and belongs to the confirmed,
non-anonymous account. This control depends on the reviewed migration being applied.

SDK `getSession()` is used only to obtain the token, never as permission proof.
AuthProvider waits for server identity, synchronizes SDK auth events, clears identity
on logout, guards stale responses with a generation counter and rechecks on focus.
Cross-tab persistence/refresh uses the official SDK. Frontend state is only UX;
every API operation still performs backend verification and RLS.

Current-device logout uses `signOut({ scope: 'local' })`. It is not global logout.
Supabase access tokens can remain cryptographically valid until expiry; database
session checks provide the additional application boundary after session removal.
Do not claim every external JWT consumer immediately revokes a signed JWT.

## Registration, verification and password recovery

Existing typography, layout, CSS and form components were retained. Timers were
replaced with awaited SDK calls and actual busy/error states. Password input policy
is 12–128 characters, with confirmation. Name is capped at 100 characters. The
owner must configure provider-side minimum password length/security; browser-only
validation cannot prevent direct API abuse.

Signup includes only display_name metadata and a fixed `/verify-email` redirect.
Duplicate-registration responses remain generic. If signup unexpectedly creates a
session without confirmation, the client signs out and reports configuration failure.
The backend also rejects unconfirmed users.

Confirmation and recovery exchange PKCE authorization codes via the SDK. Codes
are removed from the URL before exchange; implicit access-token fragments are
rejected and removed. Redirect destinations are fixed, and return paths are an
allowlist. PKCE links must be opened in the browser that initiated the request.
Callbacks are deduplicated across React StrictMode remounts.

Recovery readiness comes from the SDK `PASSWORD_RECOVERY` event during successful
code exchange, not from a query-string `type` supplied by the user. The existing
reset screen stays disabled without a valid recovery exchange. Password updates
use Supabase `updateUser`; after success the local session is signed out and the
user is asked to log in again. Existing authenticated users can request a
reauthentication email and submit the nonce for password change in account settings.
Provider-side Secure password change must be enabled; otherwise direct SDK callers
may not be required to reauthenticate. Fresh sessions may qualify under Supabase's
recent-authentication policy even when no additional nonce is needed server-side.

Forgot-password and signup messages do not reveal account existence. Login errors
are generic, including unverified-account failures. Provider network/rate limits
are not represented as success. Actual email delivery and duplicate-account timing
remain provider behaviors to verify after owner-approved setup.

## Database migration and RLS — pending approval

The migration is prepared only; it has NOT been applied remotely. Before approval,
an owner must inspect existing schemas, table/function/trigger names, grants and
Auth settings. Name collisions intentionally stop migration rather than overwriting.

Proposed objects:

- `public.profiles`: UUID referencing auth.users, display_name and timestamps.
- `public.user_roles`: one server-controlled user/admin assignment per account.
- `awasin_private.active_session()`: non-exposed security-definer predicate.
- `awasin_private.provision_identity()`: atomic signup profile/normal-role trigger.
- `awasin_private.touch_profile()`: timestamp trigger.
- `awasin_private.admin_bootstrap` and owner-only bootstrap function.

RLS and grants work together: authenticated users may select their own profile and
own role, and update only their own display_name. They cannot insert/delete rows,
change IDs/timestamps, modify roles or access another profile. Guests have no
table privileges. Admin status does not provide blanket private-profile access.
Security-definer functions pin an empty search_path and use qualified object names.
Only the session predicate is executable by authenticated users. Keep awasin_private
out of the Supabase exposed-schema list.

The signup trigger inserts both profile and role in the auth.users transaction.
Errors are not swallowed: a failure aborts user creation instead of silently
leaving a partial identity. Existing accounts are backfilled as ordinary users.
This is a deliberate remote data mutation requiring approval.

`supabase/tests/identity_rls.sql` is a transaction/rollback test for a disposable
local Supabase database, never production. It covers ownership, cross-user denial,
grants, role/ID protection, insert denial, guest denial, revoked sessions and atomic
provisioning failure. It has not yet been run because a local PostgreSQL/Supabase
test instance was unavailable; Docker executable exists but its engine was not running.

Recovery plan: retain a verified backup before remote application; the migration
is transactional, so errors before commit roll back. After commit, disable the
new auth UI/API deployment if required and preserve identity data for diagnosis.
Do not automatically drop tables, disable RLS or recreate users to roll back.
An owner-reviewed forward repair is preferred for an already active deployment.

## Initial administrator and MFA — exact manual sequence

No real admin account or default password was created. No public bootstrap API
exists and ordinary users cannot execute the private bootstrap function.

After migration and provider settings are explicitly approved:

1. Owner reviews the Invite User email template to send a one-time invitation hash
   to the approved app origin (replace this example host, no wildcards):

```html
<a href="https://APPROVED-FRONTEND/reset-password?token_hash={{ .TokenHash }}&type=invite">Siapkan akun AWASIN</a>
```

   The reset page uses supported `verifyOtp(type: invite)` before password setup;
   it never accepts access tokens in query/hash. The one-time hash is removed from
   the URL immediately. This template change requires separate owner approval.
2. Project owner invites the intended email using Supabase Dashboard Auth Users.
   Use a provider password-setup/invitation flow, never distribute a plaintext
   default password. Email/password is supplied securely by the owner/user.
3. The invited user accepts the email flow, sets their password with supported
   Supabase UI/flow, verifies email, signs in and opens `/auth/mfa`.
4. Enroll TOTP, scan its private QR and verify a challenge. The account still has
   only user privileges. Do not record or share enrollment secrets/screenshots.
5. Owner independently verifies the intended account UUID, accepted email and
   verified TOTP in the dashboard. Review before running this separate SQL action:

```sql
-- Replace the placeholder locally after owner review; execute as project postgres.
select awasin_private.bootstrap_first_admin('<verified-account-uuid>'::uuid);
```

6. The database atomically refuses a duplicate initial bootstrap and refuses a
   target without confirmed email and verified TOTP. The user refreshes identity,
   then completes MFA if needed before `/admin/dashboard` or `/admin/identity`.

The minimal MFA screen lists existing verified TOTP, challenges and verifies with
the SDK. For new enrollment it can clear only abandoned unverified TOTP factors;
it never deletes a verified factor. QR SVG is encoded as an image rather than
injected as HTML. Secret/QR/code are transient component state and cleared after
successful verification. The backend requires both current admin role and a
verified `aal2` token; correct password alone is insufficient.

Lost-factor recovery is intentionally not self-service bypass. Owner must verify
identity out of band, revoke admin role, invalidate sessions and review factor
replacement using trusted Supabase administration. These are separate approved
remote mutations. Regrant privilege only after verified replacement enrollment.
Example role revocation for owner review (not executed):

```sql
update public.user_roles set role = 'user' where user_id = '<reviewed-uuid>'::uuid;
```

## Provider settings requiring owner review/approval

- Confirm email required; anonymous signup disabled for this application's scope.
- Site URL and exact redirect URLs for `/verify-email` and `/reset-password`, on
  each approved frontend origin. Do not use broad production redirect wildcards.
- Validate invitation email template/password-setup journey before issuing an
  invite; the app does not issue invitations or custom password tokens.
- Secure password change/reauthentication, minimum length 12, supported leaked
  password protections, reasonable access-token lifetime and session policies.
- TOTP enrollment/verification enabled, MFA settings and recovery procedures.
- SMTP sender/delivery, Auth rate limits and abuse monitoring.
- CAPTCHA/bot protection requires a matching frontend integration and site key;
  no CAPTCHA widget is shipped here, so do not enable a setting and assume the
  current UI satisfies it. Brute-force resistance is not provided by submit disabling.
- Exposed database schemas and migration permissions reviewed.

None of these project-wide settings were changed by this implementation.

## Browser threat model and deployment controls

Supabase JS persistence uses browser storage. XSS or a hostile browser extension
can steal sessions; persistence is not equivalent to HttpOnly cookies. This SPA
choice preserves SDK multi-tab/refresh behavior and existing routing, but has
residual XSS risk. Do not host untrusted apps/scripts on the same origin. React
text escaping is retained; no new dangerouslySetInnerHTML or token logging was added.
No custom auth cookies were introduced; authenticated API requests explicitly
use Authorization and credentials:omit. A cookie/BFF migration would need separate
CSRF, origin and secure-cookie design rather than being assumed safe automatically.

The HTML now specifies no-referrer. Auth codes are scrubbed on callback; hosting
must avoid logging callback query strings and must not cache protected responses.
Production HTTPS and headers must be configured at the actual deployment layer:

```text
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Cache-Control: no-store   # auth callbacks and sensitive/API responses
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self'; font-src 'self'; connect-src 'self' https://nqruowgbxiopfhslznyb.supabase.co https://<approved-api-host>; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
```

This is a review template, NOT an applied production policy. Replace API host,
test Motion inline styles, MFA QR, image previews and Supabase requests under
report-only CSP before enforcing it. Configure HSTS only for the real HTTPS host.
No deployment target was available to verify these controls.

## Windows setup and verification

Backend, from repository root:

```powershell
cd backend
py -3.13 -m venv .venv  # only if absent
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
Copy-Item .env.example .env  # only if absent; edit locally, never overwrite secrets
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m app
```

Frontend in another PowerShell window:

```powershell
cd frontend
npm.cmd ci
Copy-Item .env.example .env  # only if absent; fill publishable key locally
npm.cmd run test
npm.cmd run check:routes
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
```

Open the actual Vite origin (default localhost:5173). Configure CORS and approved
redirects if the port/origin changes. Do not copy Windows .venv to Ubuntu; Ubuntu
execution is outside this phase's verification scope.

Local database test command, only after an owner-approved disposable local
Supabase instance has been prepared with the migration:

```text
psql <LOCAL-ONLY-connection-entered-securely> -v ON_ERROR_STOP=1 -f supabase/tests/identity_rls.sql
```

Remote verification checklist after approval: signup and duplicate signup; email
confirmation and expired links; invalid credentials/unconfirmed login; session
restore/refresh across tabs; recovery with same/cross browser; password change
with nonce; current-device logout/back navigation; A/B/guest direct REST RLS;
attempted role escalation; initial admin bootstrap/duplicate denial; admin aal1
denial/aal2 success; role revocation with old token; lost-factor recovery procedure.

## Verification boundaries and next phase

Local results on Windows/Python 3.13.2 and Node 22.13.0:

| Check | Result |
| --- | --- |
| Backend pytest | 50 passed, 0 failed; includes Phase 1 regression |
| Frontend Vitest/jsdom | 48 passed, 0 failed, across four files after onboarding fixes |
| Frontend TypeScript + Vite production build (no provider key configured) | Passed |
| ESLint | Passed |
| Route/validation/API transport smoke | Passed with explicit SSR fixtures |
| pip check | No broken requirements |
| Live Uvicorn loopback | Public health/docs 200; guest identity/admin 401; error no-store |
| Database grants/RLS SQL test | Not executed: no local Supabase/PostgreSQL engine |
| Real invitation | Supabase reported invite email sent to adminawasin@gmail.com; user row created; inbox receipt pending |
| Password setup/TOTP/admin access | Pending account holder activation and verified TOTP |

Backend retains the known Starlette TestClient/HTTPX deprecation warning. Early
frontend MFA tests needed a jsdom matchMedia shim and a QR-specific assertion
(icons also use SVG); all tests passed after correcting the test environment and
selector. No failed test was skipped or removed.

Backend tests use locally generated ephemeral signing keys, actual signature
verification and mocked Supabase HTTP responses. Frontend tests mock SDK responses
and run component/session/redirect/callback logic in jsdom. Route smoke uses explicit
SSR identity fixtures, never a runtime auth bypass. These are not evidence of
real email delivery, deployed RLS, TOTP verification or provider abuse settings.

Do not begin product analysis features or claim production security. Phase 2
remains partial until owner-approved remote setup and the above end-to-end checks
pass. On 2026-10-23, the owner-authorized migration was applied to project
`nqruowgbxiopfhslznyb`; RLS was verified enabled on profiles, user_roles and
the private bootstrap table (forced on the two public tables). Gmail SMTP was
saved by the owner. The invite template was saved with the local AWASIN password
setup link, and Supabase confirmed the invitation was sent. The created user ID
is `42979b34-1634-4970-a878-62742cc14ac2`. After the account holder verified TOTP
and explicitly approved the role grant, the owner-only first-admin bootstrap
succeeded for adminawasin@gmail.com.

Site URL and redirect settings were subsequently verified persisted: Site URL is
http://localhost:5173, with /verify-email and /reset-password allowed. The user
detail page confirmed email activation and a successful sign-in. The account holder
subsequently completed password setup, TOTP and reached the administrator dashboard
after the approved bootstrap. Invitation setup uses an explicit localhost:5173 template
link. Ignored local environment files now contain the
project URL and public publishable key. No service-role key or password was stored.
Live user login and administrator access succeeded. The real dashboard at
/admin/dashboard displayed role admin and aal2 after its backend admin identity
check. Cross-user RLS behavior has not yet been verified.

Recovery follow-up: the reset template now displays Supabase's one-time
`{{ .Token }}` and links to /reset-password without a credential in the URL.
The page accepts email plus the recovery code and calls verifyOtp with the fixed
type recovery; password entry appears only after a confirmed user/session is
returned. Verified invite/recovery token hashes and PKCE callbacks remain supported.
The account holder completed the recovery/password flow and logged in. This does
not establish that every email delivery, expiry or cross-browser scenario passed.

### Onboarding corrections after live use

- Protected content remains mounted during background identity checks, preserving
  MFA QR and unfinished forms across focus and token refresh events.
- A per-tab UI progress marker (user ID, 15-minute expiry, completed flag; no
  password/token/OTP) resumes password setup after reload. A ready marker is
  checked against the online provider user; it never grants authorization.
- Password success is recorded before logout. Logout failure is reported
  separately on both reset and account settings pages. A same-password response
  completes setup instead of sending the user into another recovery loop.
- Recovery errors use an alert, successful setup hides the password fields, and
  the next action is an explicit login button. Email recovery uses a single code
  flow; old invitation/PKCE links remain supported for compatibility.
- MFA handles the actual SDK SVG data URL. Preparing another QR is unavailable
  while one is active. Reload only reads existing factors; replacing an unfinished
  enrollment requires the explicit 'Buat QR baru (ganti QR lama)' action. Verified
  factors are reused and never removed by this flow.
- MFA verification and backend access checks are separate. A backend failure after
  successful MFA offers an access retry instead of calling the code invalid.
  A user awaiting owner role assignment remains on an explanatory completion
  screen and can recheck access after the owner-only bootstrap; no client grants
  admin privileges.
- `start-dev.ps1` runs/checks both local services with logs and reuses healthy
  instances. Unavailable backend/login transport now has an actionable message
  that does not suggest resetting the password.

Verification: 48 frontend tests, TypeScript, ESLint and production compilation
passed. Production compilation used the temporary HTTPS example API URL
https://api.example.invalid to satisfy the production configuration guard; it is
not a deployed backend and did not replace local .env settings. The startup script
confirmed both existing live services healthy and reused them. Its cold-start
branches were not exercised against the running servers. Tests include StrictMode callback exchange,
reload recovery, password success/logout failure, QR payloads, pending-role access
retry and protected-form preservation. SDK calls in these tests remain mocked.
The browser currently shows an unfinished MFA enrollment with an explicit QR
replacement action. No real authenticator credential was created or verified by
the agent, and no role was granted during these corrections. Subsequently, the
account holder completed MFA; after explicit action-time approval, the agent ran
the prepared owner-only bootstrap. SQL returned adminawasin@gmail.com with role
admin, and the application access recheck opened Dashboard Administrator with
admin/aal2. No password, TOTP code or authenticator secret was entered by the agent.

## Official references consulted

- https://supabase.com/docs/guides/auth/jwts
- https://supabase.com/docs/guides/auth/signing-keys
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://supabase.com/docs/guides/auth/auth-mfa
- https://supabase.com/docs/reference/javascript/auth-reauthenticate
- https://supabase.com/docs/reference/javascript/auth-updateuser
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://fastapi.tiangolo.com/tutorial/cors/
- https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html
