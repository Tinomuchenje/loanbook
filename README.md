# Loan Book

A loan management system for a small lender. Loan officers capture borrowers and applications, record payouts and repayments, and follow up late payers. The manager approves or declines loans and watches the portfolio and arrears.

Built with **Next.js 16.4** (App Router), **Convex** (database, backend functions, file storage), **Convex Auth** (email and password sign-in) and **Tailwind CSS 4**, and deployed on **Vercel**.

## What it does

| # | Feature | Where |
|---|---|---|
| 1 | Email and password sign-in and app shell. The first account becomes the manager, who adds staff by email; only those emails can create accounts. Managers can reset a forgotten password. | `convex/auth.ts`, `convex/users.ts`, `src/app/sign-in`, `src/components/shell.tsx`, `/staff` |
| 2 | Borrowers: add, edit, search by name or ID number. ID numbers are unique. | `convex/borrowers.ts`, `/borrowers` |
| 3 | Applications: amount, term of 1–24 months, purpose, uploaded payslip, live quote. Sent-back applications can be fixed and resubmitted. | `convex/loans.ts`, `/applications/new`, `/loans/[id]` |
| 4 | Approvals (managers only): approve as requested, approve with a lower amount or shorter term, send back with a note, or decline with a reason. Every decision records who and when. | `loans.decide`, `/applications` |
| 5 | Payout and schedule: record the bank deposit. 1% fee and 0.5% insurance are deducted; instalments are created. | `loans.disburse` |
| 6 | Repayments: cash or direct debit, oldest instalment first, part-payments, settle in full, receipt numbers. | `convex/repayments.ts`, `/repayments` |
| 7 | Arrears and follow-up: loans past due, days late, amount due, follow-up notes with promised dates. | `convex/arrears.ts`, `/arrears` |
| 8 | Dashboard: outstanding, arrears and share of portfolio, collected today and this month, approvals waiting, due today. | `convex/dashboard.ts`, `/dashboard` |
| 9 | Spreadsheet import (managers only): CSV of active loans with paid-to-date, checked row by row, all-or-nothing. | `convex/importer.ts`, `/import` |

### Loan rules

All in one tested module, `convex/lib/loanMath.ts`:

- Flat interest of **10% a month on the amount lent**, for every month of the term.
- Terms of **1 to 24** monthly instalments; rounding lands on the last one.
- **1% processing fee** and **0.5% insurance**, charged once and **deducted from the payout**.
- First instalment due **one month after the deposit date** (month-end dates clamp, e.g. 31 Jan → 28 Feb).
- Payments fill the **oldest unpaid instalment first**. An instalment is **late the day after** its due date.
- Settling early means paying the **full remaining balance**.
- Money is stored in **whole cents**; dates as `YYYY-MM-DD` in **Harare time** (UTC+2).
- Each loan stores its own rates, so changing the defaults never rewrites old loans.

Worked example: $1,000 over 6 months → $985 deposited, $600 interest, $1,600 repayable, five instalments of $266.67 and a last one of $266.65.

## Run it locally

You need Node 20.9 or later and a free [Convex](https://convex.dev) account. Nothing else.

1. **Install**
   ```bash
   npm install
   ```

2. **Start Convex** and leave it running:
   ```bash
   npx convex dev
   ```
   Log in and create a project when asked. This creates `.env.local`, regenerates `convex/_generated`, and keeps pushing the backend as you edit.

3. **Set up sign-in keys** in a second terminal. This is needed once per deployment:
   ```bash
   npm run setup:auth
   ```

4. **Start the app**:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000, choose **Create your account**, and set a password. **The first account becomes the manager.** Add loan officers under **Staff**; they then create their own accounts on the sign-in page with that email address.

**Forgotten password:** a manager opens **Staff** and chooses **Reset password**. Email-based resets can come later, once an email service is connected.

## Deploy to Vercel

Following [Using Convex with Vercel](https://docs.convex.dev/production/hosting/vercel):

1. Push this folder to a Git repository and import it at vercel.com/new.
2. Override the **Build Command** with:
   ```
   npx convex deploy --cmd 'npm run build'
   ```
3. In the Convex dashboard, create a **Production deploy key** and add it in Vercel as `CONVEX_DEPLOY_KEY` for the **Production** environment only. For previews, add a **Preview deploy key** under the same name for the **Preview** environment.
4. Set up sign-in keys on production once, from your machine:
   ```bash
   npm run setup:auth -- --prod
   npx convex env set --prod SITE_URL https://<your-vercel-domain>
   ```
5. Deploy, then create the first account on the live site. It becomes the production manager.

## Checks

```bash
npm test          # 30 tests: loan maths, CSV import, and the full journey against the real Convex functions
npm run typecheck
npm run lint
npm run build
```

The journey tests (`tests/journey.test.ts`) run every Convex function in memory with [convex-test](https://docs.convex.dev/testing/convex-test). They cover who can create an account (first one is the manager, then only staff emails), role checks (an officer can't approve, even by calling the backend directly), the worked example to the cent, part-payments, arrears and days late, settling in full, and an all-or-nothing import.

## Going live (feature 9)

1. Download the template from **Import**, fill in each active loan with `paid_to_date` (the total repaid so far), and import it.
2. On **Loans → All**, check each outstanding balance against the spreadsheet.
3. Run one month with both side by side. When the officer runs the month without the spreadsheet, retire it.

## Not built yet

From the brief's "won't do yet" list and its open questions: penalties, grace periods and default stages; an interest discount for early settlement; a minimum or maximum loan amount; ZiG or other currencies; SMS reminders; branches; accounting; a borrower portal; credit scoring. Also worth adding before the parallel month: a manager-only way to **reverse a payment recorded by mistake**.

## Project layout

```
convex/              Backend: schema, queries and mutations, one file per feature
  lib/loanMath.ts    Interest, fees, schedule, allocation, arrears (pure, shared with the screens)
src/app/(app)/       Screens behind sign-in: dashboard, borrowers, applications, loans, repayments, arrears, staff, import
src/components/      UI kit, app shell, shared loan components
src/app/sign-in/     Email and password sign-in and account creation
scripts/setup-auth.mjs  Generates and saves the sign-in signing keys
tests/               Vitest: maths, CSV, end-to-end journey
```
