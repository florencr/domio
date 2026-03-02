# Domio – Implementation status & next steps

## Done

- **Stack:** Next.js (App Router), Tailwind, Shadcn/UI, Supabase client + SSR helpers.
- **Env:** Copy `.env.local.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **DB schema:** `supabase/migrations/001_initial_schema.sql` – profiles (Manager/Owner/Tenant), buildings, units, unit_owners, unit_tenant_assignments, services, expenses, bills, bill_lines, payments. Run in Supabase SQL Editor (or `supabase db push` if using CLI).
- **Types:** `types/database.ts` – all entities and enums.

## Next steps (in order)

1. **Apply migration** – In Supabase Dashboard → SQL Editor, run the contents of `supabase/migrations/001_initial_schema.sql`. Then create a profile row when a user signs up (same `id` as `auth.users.id`).
2. **Auth + RLS** – Sign in/sign up pages, middleware for protected routes, RLS policies so Manager sees all, Owner sees own units/assignments, Tenant sees only assigned units where they are payment responsible.
3. **Bill generation** – API or Server Action: Manager picks Month/Year; for each unit, create a `bills` row and `bill_lines` from recurrent services (by unit type) and recurrent expenses; support manual overrides (extra bill_lines). Option to reverse/delete a month’s batch and rerun.
4. **Manager dashboard** – Cards: Income, Expenses, Net Fund, Outstanding Debt. Tabs: Billing, Expenses, Payments, Ledger (master list of bills + payments per unit).
5. **Owner dashboard** – Financial overview, My Units (tenants + payment responsibility), My Bills (per-unit debt).
6. **Tenant dashboard** – Same as Owner but filtered to assigned units and only bills they are payment responsible for.
7. **Transparency ledger** – Shared view: financial movement by Unit ID only (no names) for all roles.
8. **Top-up flow** – Mobile-first screen: upload photo/PDF of bank slip → save to Supabase Storage, create `payments` row with `proof_file_url` / `proof_storage_path`.

## Financial logic (reference)

- **Income:** Sum of payments.
- **Expenses:** Sum of expense amounts (recurrent + ad-hoc).
- **Net building fund:** Total Income − Total Expenses.
- **Outstanding debt:** Sum of published bills not yet covered by payments (by unit/period).
- **Ledger:** List all bills and payments per unit ID (and optionally period).
