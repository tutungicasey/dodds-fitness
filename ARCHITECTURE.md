# Dodds Fitness - Architecture (v1 prototype)

## 1. Overview

```
 Browser / installed PWA / (later) Capacitor iOS & Android shell
        │  HTTPS (HSTS, CSP)
        ▼
 Next.js 15 app (React 19, App Router) on Node.js ── one process
   ├─ middleware.js          CSRF cookie issuance
   ├─ app/**/page.js         React Server Components (HTML rendered on the server)
   ├─ app/actions/*.js       Server Actions (all mutations: CSRF + authz + zod validation)
   ├─ app/api/*              Route handlers: data export, Stripe webhook
   └─ lib/*                  auth, sessions, booking engine, payments, audit, db
        │
        ▼
 SQLite (better-sqlite3, WAL)  ./data/dodds.db        Stripe Checkout (hosted) ⇄ webhook
```

The app is server-rendered: almost no JavaScript ships to the browser (≈100 kB shared Next runtime), charts are
SVG rendered on the server, and every form works even before JS loads. This keeps it fast on phones and simple
to secure, because all business rules run on the server.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| UI | React 19 + Next.js 15 App Router, plain CSS | Casey prefers React/Next; one codebase for web, PWA and Capacitor wrapper |
| Data | SQLite via better-sqlite3 | Zero-ops, fast, transactional; easy to migrate to Postgres (plain SQL) |
| Auth | Custom session auth (bcryptjs, DB-backed sessions) | Small, auditable, no third-party dependency; swap for Auth.js/Clerk later if SSO is wanted |
| Validation | zod | Every server action validates input |
| Payments | Stripe Checkout (hosted) | PCI scope stays with Stripe (SAQ A); AUD supported; Apple/Google Pay out of the box |
| Charts | Dependency-free SVG components | No client JS, prints well |
| PWA | manifest + service worker | Installable now; foundation for app-store wrapping |
| Testing | Playwright (playwright-core) smoke test `scripts/e2e.mjs` | End-to-end proof of key flows |

## 3. Data model (SQLite)

- `users` (role: member | trainer | admin, profile fields, `trainer_id` for client assignment)
- `sessions` (SHA-256 of session token, user, expiry)
- `class_types` (weekly template or one-off) → `class_sessions` (concrete dated instances, generated 21 days ahead)
- `bookings` (booked | waitlist | cancelled | attended | no_show, `credit_used`)
- Diary: `workouts` + `workout_sets` (kg lifted), `food_entries`, `measurements` (body fat %, waist/chest/hips - no body weight by design; a migration drops the legacy `weight_kg` column), `notes`
- Coaching: `trainer_notes` (private/shared), `programs`
- Commerce: `plans` (membership | pack, AUD cents), `payments` (demo | stripe, status), `memberships` (dates/credits)
- `audit_log` (actor, action, target, details, IP, timestamp)

Times for classes are stored as Melbourne-local `YYYY-MM-DD HH:MM` strings (sortable, DST-safe for a single-site gym).
System timestamps (`created_at`, audit) are UTC.

## 4. Security model

| Threat | Control |
|---|---|
| Password theft | bcrypt cost 12; min 10 chars with letters+digits; constant-time dummy compare for unknown emails |
| Session hijack | 256-bit random token in `HttpOnly`, `SameSite=Lax`, `Secure` cookie; only its SHA-256 stored; 7-day expiry; rotated on login; all sessions revoked on password change/role change |
| CSRF | Double-submit token (HttpOnly cookie + hidden field, constant-time compare) on every mutation **plus** Next.js server-action Origin/Host check |
| Brute force | Login: 5 attempts / 15 min per IP+email and 30 / 15 min per IP; sign-up 10 / hour per IP (in-memory; Redis when scaled) |
| Broken access control | `requireUser(roles)` on every page/action; ownership enforced in SQL `WHERE user_id = ?`; trainers limited to assigned clients (`canAccessClient`); members cannot reach `/admin`, `/trainer`, other clients |
| Injection | Parameterised SQL everywhere; React escapes output; zod validation & length limits |
| XSS / clickjacking | CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`), X-Frame-Options DENY, nosniff |
| Transport | HSTS; deploy behind HTTPS only |
| Card data | Never handled: Stripe-hosted Checkout; payment confirmed server-side by retrieving the session or verified webhook signature; live keys refused unless explicitly allowed |
| Accountability | Append-only `audit_log` for staff logins, role/trainer changes, class create/cancel, attendance, trainer notes/programs, member export & deletion |
| Privacy (APPs) | Privacy notice, consent at sign-up, self-service export (APP 12) & correction (APP 13), account deletion with anonymised payment retention; health data visible only to the member, their trainer and admins |

**Production hardening backlog:** CSP nonces (remove `'unsafe-inline'`), staff 2FA (TOTP/passkeys), Redis rate limits,
email verification & password reset, encrypted backups, dependency scanning, penetration test before launch.

## 5. Payments flow

1. Member picks a plan → server creates a `pending` payment row.
2. **Stripe mode** (`STRIPE_SECRET_KEY=sk_test_…`): server creates a Checkout Session (AUD, metadata = payment id) and redirects to Stripe.
   On return, `/membership/success` retrieves the session from Stripe and only then marks the payment `paid`; the webhook does the same idempotently.
3. **Demo mode** (no key): a clearly labelled mock checkout page simulates success; no card is requested.
4. `grantPlan` creates a membership (30/365 days, extended if one is active) or class credits.

## 6. App Store / Google Play path

The app is already a PWA (installable from Safari/Chrome "Add to Home Screen"). To ship store apps:

1. **Host the web app** on a production HTTPS domain first (the native apps load it).
2. **Wrap with Capacitor** (`@capacitor/core`, `@capacitor/ios`, `@capacitor/android`):
   - Use `server.url = "https://app.doddsfitness.com.au"` (remote-loaded shell) - simplest because the app uses server rendering and server actions. Offline screen comes from the service worker.
   - Add native value so Apple accepts it (Guideline 4.2 "minimum functionality"): push notifications for bookings/waitlist (`@capacitor/push-notifications` + APNs/FCM), app icon & splash, native share, optionally HealthKit/Google Fit sync for workouts, biometric unlock.
3. **Payments in-app**: gym memberships and in-person classes are physical services, so Apple/Google allow external payment (Stripe) - no in-app purchase cut. Digital-only content (e.g. paid video programs) would require IAP.
4. **Accounts**: Apple requires in-app account deletion (already built) and Sign in with Apple only if other social logins are added.
5. **Stores**: Apple Developer Program (US$99/yr), Google Play Console (US$25 once), privacy nutrition labels / Data safety form (health & fitness data declared), screenshots, review.
6. Alternative: **Expo/React Native** rewrite of the member app reusing the same backend via a JSON API - more native feel, more work. Recommended only if the Capacitor app proves limiting.

## 7. Scaling & migration path

- Single small VM handles thousands of members on SQLite. For multi-instance/serverless: move to Postgres (schema is portable SQL), Redis for rate limits, object storage for any uploads.
- Background jobs (reminder emails, waitlist notifications, session generation) → cron/queue worker.
- Multi-location support → add `locations` table and `location_id` on classes.

## 8. Repository layout

```
app/            pages (server components), actions/, api/
components/     Nav, charts, diary views, CSRF field, flash messages
lib/            db, schema, seed, auth, csrf, ratelimit, audit, booking, membership, payments, stripe, time, money
public/         manifest, service worker, icons
scripts/        seed.mjs, serve.sh, e2e.mjs, make-icons.mjs
screenshots/    generated by e2e.mjs
data/           SQLite database + server log (git-ignored)
```
