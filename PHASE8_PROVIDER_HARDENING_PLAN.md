# Phase 8 — Provider hardening proposal

5 November 2026. Read-only dashboard audit on existing project `awasin`, main.
This document does not authorize changes.

## Package P1 — minimum password length only

Observed Email provider minimum: 6 characters. AWASIN's shared frontend policy
requires 8–128 characters. Proposed exact change: Supabase Authentication →
Sign In / Providers → Email → Minimum password length **6 → 8**, then Save.
No account/password reset, logout, user record edit, new account, or API test
signup. Existing passwords are not changed by this setting. Future signup and
password changes become subject to the provider minimum.

Verify by closing/reopening the Email provider panel and reading persisted value
8 with Save disabled. Retain dashboard evidence in the security report. No
temporary weakening or automatic rollback to 6. If unexpected UI/schema differs,
stop before Save and report the difference.

## Observed controls outside P1

- Signup/login: 30 requests/5 minutes/IP; refresh: 150/5 minutes;
  token verification: 30/5 minutes; outgoing email: 30/hour.
- Signup enabled; manual linking disabled; anonymous sign-in disabled;
  email confirmation disabled. Email provider and secure email change enabled.
- Secure password change disabled; require-current-password disabled.
- Leaked-password protection disabled; dashboard identifies it as Pro-and-above.
- CAPTCHA disabled; OTP expiry 3600 seconds and length 8.

Do not toggle these controls under P1. CAPTCHA needs provider keys and frontend
challenge/error integration. Password-change controls require checking both
Settings reauthentication and Account/recovery flows before enabling. Email
confirmation changes signup and inbox dependencies. Paid features need separate
product/billing decisions. No brute-force/load test on the production project.

## Authorization

Phase 8 master prompt section 14 requires approval for persistent cloud changes.
User explicitly approved P1 only in this chat on 5 November 2026. Executed through
the existing Supabase dashboard session: minimum 6→8, Save, success notice
“Successfully updated settings”. Reopened Email panel: persisted minimum 8,
Save disabled, OTP expiry still 3600 and OTP length still 8. No other setting was
edited. This proves persisted configuration, not a live signup/password-change
negative test. P1 COMPLETE; remaining controls are outside this approval.
