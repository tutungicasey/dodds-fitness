# Dodds Fitness - v1 prototype

A secure, mobile-friendly gym web app for **Dodds Fitness** (Melbourne, AUD, Australia/Melbourne time).
Combines PT-hub style trainer/client management with a Zander-style member diary, class booking,
payments and an admin analytics dashboard. Installable as a PWA (Add to Home Screen) and ready to be
wrapped with Capacitor for the App Store / Google Play later (see `ARCHITECTURE.md`).

> **DEMO PROTOTYPE** - all people, bookings and payments in the seeded database are fictional demo data.

## Quick start

Requirements: Node.js 20+ (tested on Node 24), Linux/macOS/Windows.

```bash
npm install
npm run seed        # creates ./data/dodds.db with demo data (also happens automatically on first start)
npm run build
npm start           # http://localhost:3100
# or: ./scripts/serve.sh   (restarts in the background, logs to data/server.log)
# dev mode with hot reload: npm run dev
```

Smoke test + screenshots (needs Chrome/Chromium; set `CHROME=/path/to/chrome` if not `/usr/bin/google-chrome`):

```bash
BASE_URL=http://localhost:3100 node scripts/e2e.mjs
```

It checks sign-in, cookie flags, booking, waitlist join/leave, CSRF rejection, diary entries, demo payment,
role-based access, data export, admin dashboard, audit log and login rate limiting, and writes screenshots to `screenshots/`.

## Demo logins

| Role | Email | Password |
|---|---|---|
| Admin (owner) | `admin@doddsfitness.demo` | `DemoAdmin!2026` |
| Trainer | `trainer@doddsfitness.demo` | `DemoTrainer!2026` |
| Member | `member@doddsfitness.demo` | `DemoMember!2026` |

Other seeded members (`*@example.demo`) cannot log in. Demo accounts can't be deleted (so the demo keeps working) - sign up a new account to try account deletion.

## Features (v1)

- **Accounts & security**: sign up / log in / log out; bcrypt (cost 12) password hashing; opaque session tokens (only a SHA-256 hash is stored) in `HttpOnly`, `SameSite=Lax`, `Secure` (production) cookies; CSRF tokens on every form plus Next.js same-origin checks; login & sign-up rate limiting; zod input validation; roles **member / trainer / admin** enforced server-side; members only ever see their own data; trainers only see their assigned clients.
- **Member profile**: contact details, DOB, emergency contact, goals, injuries; change password (signs out other devices).
- **Class timetable & booking**: weekly **calendar view** and list view; admin creates recurring weekly or one-off classes (name, trainer, day/time, duration, capacity); members book/cancel; automatic **waitlist** with auto-promotion when a spot opens; my bookings + history; booking requires an active membership or class credits (credits refunded on cancellation).
- **Diary** (body-weight tracking intentionally removed at Casey's request; kg lifted in workouts is kept): workouts (exercise, sets, reps, kg), food log with calories/macros, body measurements, notes; progress charts (body fat, waist, weekly training volume, calories, per-lift progression).
- **Trainer tools**: client list, client profile + diary/progress, **trainer notes** (private or shared with the client), assign **workout programs**, class rosters with attendance marking.
- **Payments**: memberships & class packs priced in AUD (GST incl.). Stripe Checkout (hosted page - card data never touches the app) when `STRIPE_SECRET_KEY` is a **test** key; otherwise a clearly labelled **DEMO** payment flow. Live keys are refused unless `STRIPE_ALLOW_LIVE=true`. Webhook endpoint at `/api/stripe/webhook`.
- **Admin dashboard**: members, revenue (30-day + trend + by week/plan), most popular classes, fill rate & attendance by class, busiest-times heatmap, upcoming classes; member management (roles, trainer assignment); bookings; payments; **audit log** of staff/admin actions and privacy events.
- **Privacy**: privacy notice page (draft, Australian Privacy Act oriented); member **data export** (JSON) and **account deletion**.
- **Security headers**: CSP, HSTS, X-Frame-Options/frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy, COOP.
- **PWA**: web manifest, icons, service worker (offline page; personal data is never cached).

## Configuration

Copy `.env.example` to `.env.local`. Key settings:

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` enables Stripe Checkout in test mode. Blank = demo payments. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/stripe/webhook` (`checkout.session.completed`). |
| `APP_URL` | Public base URL for Stripe redirects. |
| `COOKIE_SECURE` | Defaults to `true` in production. Set `false` only for plain-HTTP testing on a LAN IP. |
| `ALLOWED_ORIGINS` | Extra hosts allowed to post server actions when behind a proxy. |
| `DATABASE_PATH` | SQLite file location (default `./data/dodds.db`). |

Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC.

## What's needed for production

1. **Hosting**: a small Node host with a persistent disk (e.g. Render, Railway, Fly.io, a DigitalOcean/Lightsail VPS, or Azure App Service in Australia East) - or move to managed Postgres (Neon/Supabase/RDS Sydney) for serverless hosts like Vercel. Automated daily backups of the database.
2. **Domain + HTTPS**: e.g. `app.doddsfitness.com.au`, TLS via the host/Cloudflare.
3. **Stripe**: Casey's Stripe account (ABN, bank account), live keys, webhook configured, decide on recurring subscriptions vs one-off passes, refund policy, GST/tax invoice wording.
4. **Email** (Postmark/SendGrid/Amazon SES): password reset, email verification, booking confirmations, waitlist promotion and class cancellation notices. *Not built in v1.*
5. **Legal**: finalised privacy notice & terms, waiver/PAR-Q health questionnaire, data retention policy.
6. **Hardening**: shared rate-limit store (Redis) if running >1 instance, CSP nonces, 2FA for staff, error monitoring (Sentry), uptime checks, dependency updates.

## Known gaps in v1

- No password reset / email verification / notifications (needs an email provider).
- No recurring Stripe subscriptions (one-off purchases that grant 30/365 days or credits).
- No in-app messaging, exercise library/videos, or food database lookup.
- Rate limiting is in-memory (single server).
- Times shown in Melbourne time; the audit log is in UTC.
