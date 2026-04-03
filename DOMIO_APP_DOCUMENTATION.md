# Domio App – Technical Documentation

**Current state documentation.** Condo / HOA management web and mobile app.

---

## 1. Overview

**Domio** is a condo (HOA) management app with role-based dashboards:
- **Admin** – sites, managers, residents; user creation and unit assignment
- **Manager** – billing, expenses, config per site, **community polls / voting**
- **Resident** – single app experience for people who live in the community; **owner vs tenant is per unit**, not a separate login “role”

Includes mobile shells (iOS/Android) via Capacitor that load the deployed web app.

**Important:** A person’s **account role** in `profiles` is typically **`resident`** (or `manager` / `admin`). Whether they act as **owner** or **tenant** for a given **unit** is stored on **unit links** (`unit_memberships`, and legacy `unit_owners` / `unit_tenant_assignments`). The same resident can be **owner of one unit** (e.g. apartment) and **tenant of another** (e.g. parking).

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, TypeScript, Tailwind CSS 4 |
| UI Components | shadcn / Radix UI |
| Database & Auth | Supabase (PostgreSQL, Auth, Storage) |
| Mobile | Capacitor (iOS, Android) |
| PDF | PDFKit |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Client (Browser / Capacitor iOS/Android)                    │
│  - Next.js pages                                             │
│  - Supabase client (createBrowserClient)                     │
└──────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│  Next.js Server                                              │
│  - API routes (REST)                                         │
│  - Server actions (auth, billing, config, users)              │
│  - Supabase server client (createClient from @supabase/ssr)   │
└──────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│  Supabase                                                    │
│  - Auth (email/password)                                     │
│  - PostgreSQL + RLS                                           │
│  - Storage (payment-slips)                                    │
└─────────────────────────────────────────────────────────────┘
```

- **Auth**: Supabase Auth; role stored in `profiles`.
- **Data**: PostgreSQL with RLS and role-based access.
- **Mobile**: Capacitor app points to web URL (`CAPACITOR_APP_URL`).
- **Session refresh:** `proxy.ts` (Next.js 16) refreshes the Supabase session cookie on matched routes (`/dashboard`, `/api`, `/auth`, `/login`, `/signup`).

---

## 4. User management & roles

### Account roles (`profiles.role`)

| Role | Meaning |
|------|--------|
| `admin` | Cross-site administration |
| `manager` | Runs one site (linked via `sites.manager_id`) |
| `resident` | Default for residents created in the app; uses the **resident** dashboard |

Admin and manager creation flows still create those roles directly. **Admin “create user”** typically offers **Manager** or **Resident**; assigning someone to a unit uses an **assignment role** of **owner** or **tenant** on that unit only (see below). The profile usually stays **`resident`** so one person can hold **multiple unit relationships** with different hats.

### Unit-level owner / tenant (not the same as `profiles.role`)

| Mechanism | Purpose |
|-----------|--------|
| `unit_memberships` | Preferred model: `user_id`, `unit_id`, `role` (`owner` \| `tenant`), `status`, `is_payment_responsible` (for tenants) |
| `unit_owners` | Legacy one-owner-per-unit row; kept in sync when managers/admins assign |
| `unit_tenant_assignments` | Legacy tenant + `is_payment_responsible`; kept in sync with `unit_memberships` |

APIs such as `/api/manager/assign-unit`, `/api/admin/assign-user`, and `/api/owner/tenant-assignment` update these tables (and memberships). Billing and dashboards resolve access from **memberships + legacy tables**, not from forcing `profiles.role` to `owner` or `tenant`.

### Routes

- **`/dashboard/resident`** – main experience for residents (billing, units, notifications, **polls**).
- **`/dashboard/owner`** and **`/dashboard/tenant`** – redirected to resident paths (see `next.config.ts` / resident billing & preferences).

---

## 5. Folder Structure

```
domio-app/
├── app/
│   ├── (auth)/                 # Auth route group
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── api/                    # REST API routes
│   │   ├── admin/              # sites, managers, users, assign-user, audit, …
│   │   ├── manager/           # buildings, units, bills, expenses, polls, …
│   │   ├── polls/              # manager + resident poll APIs
│   │   ├── resident/data/
│   │   ├── memberships/
│   │   ├── notifications/
│   │   ├── owner/              # e.g. tenant-assignment (owner of unit)
│   │   └── …
│   ├── auth/callback/          # OAuth / email confirm
│   ├── dashboard/
│   │   ├── dashboard-router.tsx
│   │   ├── manager/            # layout + billing, config, …
│   │   ├── resident/           # billing, units, notifications (polls), …
│   │   └── admin/
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── community-polls.ts      # Eligibility, formal vs informal voting rules
│   ├── poll-publish-notify.ts # Publish poll + in-app + push
│   ├── dashboard-redirect.ts
│   ├── unit-memberships.ts    # Sync unit_memberships with legacy tables
│   └── supabase/              # client, server, service-role helper
├── supabase/migrations/        # includes unit_memberships, polls (e.g. 068+, 070)
├── proxy.ts                    # Supabase session refresh (Next 16)
├── capacitor.config.ts
└── package.json
```

---

## 6. Routes & Pages

| Route | Purpose |
|-------|---------|
| `/` | Home – Sign in / Sign up or Dashboard link |
| `/login` | Sign in |
| `/signup` | Sign up (profile role **resident** by default; see auth callback) |
| `/dashboard` | `DashboardRouter` → redirect by `profiles.role` + session |
| `/dashboard/admin` | Admin dashboard |
| `/dashboard/manager` | Manager dashboard |
| `/dashboard/resident` | Resident dashboard (units, billing, notifications, polls) |
| `/dashboard/owner/*`, `/dashboard/tenant/*` | **Redirects** to resident routes (legacy URLs) |

**Auth flow:**
- `/dashboard` loads `DashboardRouter` (browser Supabase session + `profiles`, with API fallback as needed).
- Redirects to `/dashboard/admin`, `/dashboard/manager`, or **`/dashboard/resident`** for residents.
- If not logged in → `/login`.

---

## 7. Features by Role

### Admin

- **Sites**: List, create, update; assign managers.
- **Managers**: Create (with optional site); list; edit via `/admin/managers/[id]`.
- **Users**: Create **manager** or **resident**; list by site; assign users to units as **unit owner** or **unit tenant** (assignment API); edit profiles.
- **Buildings**: Create, update, delete.
- **Maintenance**: Toggle delete locks (bills/expenses); clear site data (keeps user accounts).
- **Audit Log**: View all changes across sites (entity type filter, who/what/when).
- **Multi-site**: Sites isolate data; managers scoped to their site(s).

### Manager

- **Config**: Buildings, units, unit types, vendors, services, expenses templates, owner/tenant assignments.
- **Billing**:
  - Generate bills from recurrent services and expenses.
  - Mark paid/unpaid.
  - Filters: Period, unit type, unit, payment status.
  - Sortable columns.
  - Lock: bill delete only current month; amount locked for past periods; status/paid_at always editable.
- **Expenses**: Create, filter (period, category, vendor, frequency), sort.
- **Payments**: View payments, mark paid/unpaid.
- **Ledger**: Income vs expenses, running balance.
- **Documents**: Attach contracts, invoices, maintenance docs to buildings or expenses. Categories: contract, maintenance, invoice, other.
- **Notifications**: Send to owners, tenants, by unit type; filter by unpaid.
- **Polls & formal resolutions** (Config → Notifications area): Create drafts (questions, options, category scope: apartment / parking / garden / global); optional document attachment; **informal survey** (1 user = 1 vote) vs **formal resolution** (1 unit = 1 vote, configurable **approval threshold %** on a chosen question/option). Publish (with optional notify eligible residents in-app + push). View **results** (readable summary), **close** voting. APIs: `/api/polls/manager/...`.
- **Audit Log**: View changes for their site only (entity type filter).
- **Mobile**: Bottom tabs (Billing, Expenses, Payments, Ledger); config via cog icon.

### Resident (replaces separate Owner / Tenant apps in the UI)

Experience is driven by **unit memberships**: owners see owned units and can manage tenants where applicable; tenants see assigned units and bills where they are payment responsible.

- **Units**: Units linked via owner/tenant assignments; owner flows can assign or release tenants (subject to APIs).
- **Billing**: Bills per unit / payer; PDF invoice; upload slip; filters and sorting as before.
- **Ledger**: Income vs expenses, running balance where exposed.
- **Notifications**: Bell, unread, “See all”; includes **poll notifications** with deep link payload.
- **Polls & voting** (Notifications area): List published/closed polls for sites the user belongs to; open poll, vote (single/multi select per question); formal polls vote **per eligible unit**; informal **per user**. API: `/api/polls/resident/...`.
- **Mobile**: Bottom tabs and patterns aligned with previous owner/tenant mobile layout (billing, units, etc.).

---

## 8. Community polls & voting (reference)

| Concept | Behavior |
|--------|----------|
| **Scope** | Poll targets units by **category** (`apartment`, `parking`, `garden`, or **global** for whole site). |
| **Informal survey** | Each **user** has at most one ballot per question. |
| **Formal resolution** | Each **unit** in scope has at most one ballot per question; **threshold %** (default 70%) compares approving **units** to **registered units in scope**. |
| **Lifecycle** | `draft` → `published` (with `published_at`) → `closed`. Only drafts are editable. |
| **Notifications** | On publish, eligible users get in-app notification rows (+ FCM push if configured). |
| **Schema** | `polls`, `poll_questions`, `poll_options`, `poll_question_votes` — see `supabase/migrations/070_polls.sql`. |
| **Logic** | `lib/community-polls.ts` (eligibility, counts); `lib/poll-publish-notify.ts` (publish + notify). |

Server routes use the **Supabase service role** where needed; ensure `SUPABASE_SERVICE_ROLE_KEY` is set in every environment.

---

## 9. Database Schema

### Main Tables

| Table | Purpose |
|-------|---------|
| `profiles` | id, name, surname, phone, email, role (app_role) |
| `sites` | id, name, address, manager_id, vat_account |
| `buildings` | id, name, site_id |
| `units` | id, building_id, unit_name, type, size_m2, block, entrance, floor |
| `unit_memberships` | unit_id, user_id, role (`owner` \| `tenant`), status, is_payment_responsible; canonical link for dashboards/polls (migrations 068+) |
| `unit_owners` | unit_id, owner_id (legacy; synced from assignments) |
| `unit_tenant_assignments` | unit_id, tenant_id, is_payment_responsible (legacy; synced) |
| `polls` | site_id, title, classification, category_scope, status, closes_at, threshold fields, attachment metadata (`070_polls.sql`) |
| `poll_questions` | poll_id, prompt, kind (single/multi select), sort_order |
| `poll_options` | question_id, label, sort_order |
| `poll_question_votes` | poll_id, question_id, voter_user_id, unit_id (formal), option_ids[] |
| `unit_types` | Config (name) |
| `vendors` | Config (name) |
| `service_categories` | Config (name) |
| `services` | name, unit_type, pricing_model, price_value, frequency |
| `expenses` | category, title, vendor, amount, frequency, building_id, period_month, period_year, template_id, reference_code, paid_at |
| `bills` | unit_id, period_month, period_year, total_amount, status, paid_at, receipt_url, receipt_path, receipt_filename, reference_code |
| `bill_lines` | bill_id, line_type, reference_id, description, amount |
| `payments` | unit_id, amount, paid_at, period, proof |
| `notifications` | title, body, created_by, target_audience, target_unit_types, unpaid_only |
| `notification_recipients` | notification_id, user_id, read_at |
| `device_tokens` | user_id, token, platform (push notification FCM/APNS tokens) |
| `audit_log` | id, created_at, user_id, user_email, action, entity_type, entity_id, entity_label, site_id, old_values, new_values |
| `documents` | id, building_id, unit_id, expense_id, name, path, mime_type, size_bytes, category (contract/maintenance/invoice/other), uploaded_by, created_at |

### Enums

- `app_role`: **admin**, **manager**, **resident** (primary resident accounts); **owner** / **tenant** may still appear in older data but product logic prefers **unit-level** owner/tenant via memberships (see §4).
- Poll enums: `poll_classification`, `poll_category_scope`, `poll_status`, `poll_question_kind` (see migration `070_polls.sql`).
- `pricing_model`: per_m2, fixed_per_unit
- `service_frequency`: recurrent, one_time, ad_hoc
- `expense_frequency`: recurrent, ad_hoc

### RPCs / Functions

- `get_my_bills(lim)` – Bills for owner or payment-responsible tenant.
- `is_manager()`, `is_admin()`, `my_site_id()` – Role/site helpers.
- `is_period_current(m, y)` – True only for current month (lock logic).
- `is_period_editable(m, y)` – True for current and previous month (UI).

### Triggers

- `generate_bill_reference`, `generate_expense_reference`.
- `trg_prevent_bill_delete_locked` – Blocks bill DELETE when period is not current month.
- `trg_prevent_bill_update_locked` – Blocks bill amount change for past periods; status/paid_at always editable.
- `trg_prevent_bill_line_update_locked`, `trg_prevent_bill_line_delete_locked` – Block bill line edits when parent bill period is past.
- `trg_prevent_expense_delete_locked` – Blocks expense DELETE when paid.
- `trg_prevent_expense_update_locked` – Blocks amount/category/vendor/title change when paid; paid_at always editable.

### Lock Rules (updated)

| Entity | Delete | Update |
|--------|-------|--------|
| **Bills** | Only current month. Past months cannot be deleted. | Status and paid_at can change anytime. Amount locked for past periods. |
| **Bill lines** | Locked when parent bill period is past. | Same. |
| **Expenses** | Only when unpaid. Paid expenses cannot be deleted. | Amount, category, vendor, title locked when paid. paid_at can change anytime. |

- `is_period_current(m, y)` – True only for current month (used by delete/amount locks).
- `is_period_editable(m, y)` – True for current and previous month (used by UI for display).

### Storage

- Bucket: `payment-slips` – Paths: `payer-{id}/{year}-{month}.{ext}` for slips, `{billId}.{ext}` for bill receipts.
- Bucket: `documents` – Contracts, invoices, maintenance files. Manager-uploaded via API.

---

## 10. API Routes

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/auth/signout` | POST | Sign out |
| `/api/bills` | PATCH | Mark bill(s) paid/unpaid |
| `/api/expenses` | PATCH | Mark expense paid |
| `/api/invoice` | GET | Generate PDF invoice (by period or bill) |
| `/api/receipt` | GET | Serve receipt file |
| `/api/receipt-record` | POST | Record receipt metadata after upload |
| `/api/notifications` | GET | List user notifications |
| `/api/notifications/read` | POST | Mark notification read |
| `/api/notifications/register-device` | POST | Register push device token (mobile) |
| `/api/notifications/send` | POST | Send notification (manager) |
| `/api/notifications/sent` | GET | List sent notifications |
| `/api/resident/data` | GET | Aggregated resident dashboard data (memberships + legacy) |
| `/api/owner/data` | GET | Legacy/compatibility owner-shaped data where still used |
| `/api/tenant/data` | GET | Legacy/compatibility tenant-shaped data where still used |
| `/api/memberships` | GET | Active `unit_memberships` for the signed-in user (+ unit names) |
| `/api/polls/manager` | GET, POST | List polls; create draft (+ optional publish & notify) |
| `/api/polls/manager/[pollId]` | GET, PATCH, DELETE | Draft detail / update / delete |
| `/api/polls/manager/[pollId]/publish` | POST | Publish formal/informal with threshold options |
| `/api/polls/manager/[pollId]/close` | POST | Close poll |
| `/api/polls/manager/[pollId]/results` | GET | Aggregated results for managers |
| `/api/polls/manager/[pollId]/attachment` | POST | Upload draft attachment |
| `/api/polls/resident` | GET | List polls visible to current resident |
| `/api/polls/resident/[pollId]` | GET | Poll detail + signed attachment URL |
| `/api/polls/resident/[pollId]/vote` | POST | Submit votes |
| `/api/admin/users/create` | POST | Create manager or resident (see admin UI) |
| `/api/admin/assign-user` | POST | Assign user to unit as owner or tenant |
| `/api/admin/users-by-site` | GET | Users listing / grouping for admin |
| `/api/admin/sites` | GET, POST | List/create sites |
| `/api/admin/sites/[id]` | PATCH | Update site |
| `/api/admin/buildings` | POST | Create building |
| `/api/admin/buildings/[id]` | PATCH, DELETE | Update/delete building |
| `/api/admin/create-manager` | POST | Create manager and optional site |
| `/api/admin/managers/[id]` | PATCH | Update manager |
| `/api/admin/maintenance` | GET, POST | Get lock state; toggle locks; clear site data |
| `/api/admin/audit-log` | GET | List audit entries (admin: all; manager: own site). Params: limit, offset, entityType |
| `/api/documents` | GET, POST | List by buildingId or expenseId; upload (FormData: file, buildingId|expenseId, category, name) |
| `/api/documents/[id]` | GET, DELETE | Get signed URL for download; delete document |
| `/api/users/create` | POST | Create user |
| `/api/users/update` | PATCH, DELETE, POST | Update/delete/create user |

---

## 11. Components

| Component | Purpose |
|-----------|---------|
| `DomioLogo` | Logo component |
| `NotificationBell` | Bell icon, unread count, dropdown (first 4 + “See all”), mark read. Manager: “Send notification” entry. |
| `DashboardRouter` | Redirects to role dashboard (admin / manager / resident) |
| `ManagerPollsPanel` | Manager: create/edit/publish polls, results, close (notifications config page) |
| `ResidentPollsSection` | Resident: list polls, vote, view results state |
| `SortableTh` | Sortable table header (column, sortCol, sortDir, onSort) |
| `sortBy()` | Utility from sortable-th for client-side sort |
| UI (button, card, input, label, select, tabs, table, dropdown-menu, hover-card) | Shared UI primitives |

---

## 12. Integrations

### Supabase

- Auth: email/password.
- DB: PostgreSQL, RLS by role and site.
- Storage: `payment-slips`, `documents` buckets.
- Client: `createClient` from `@/lib/supabase/client` (browser).
- Server: `createClient` from `@/lib/supabase/server` (`@supabase/ssr`); service role via `@/lib/supabase/service-role` where needed (`SUPABASE_SERVICE_ROLE_KEY`).

### Capacitor

- iOS and Android projects.
- App loads web app URL from `CAPACITOR_APP_URL`.
- Dev: `http://localhost:3001` (ngrok for device).
- Prod: e.g. `https://your-app.vercel.app`.
- `capacitor.config.ts`: appId `com.domio.app`, appName `Domio`.

**Scripts:**
- `npm run cap:sync`
- `npm run cap:open:ios` / `cap:open:android`

---

## 13. Mobile Layout

- **Resident**: Bottom tabs (e.g. units, billing, ledger, payments as routed); notifications via bell; collapsible filters where used; polls under notifications flow.
- **Manager**: Bottom tabs (Billing, Expenses, Payments, Ledger); Config via cog; filters collapsible on mobile.

---

## 14. Audit Logs, Document Management & Lock Rules

### Audit Logs

- **Table**: `audit_log` – Records who did what and when. Fields: user_id, user_email, action (create/update/delete), entity_type, entity_id, entity_label, site_id, old_values, new_values.
- **Access**: Admin sees all entries; Manager sees only their site. Insert via API (service role); clients cannot insert.
- **UI**: Admin and Manager dashboards have an Audit tab. Filter by entity type (bills, expenses, sites, etc.).

### Document Management

- **Table**: `documents` – Links to building, unit, or expense. Categories: contract, maintenance, invoice, other.
- **Storage**: Bucket `documents`. Files uploaded via `/api/documents` POST.
- **UI**: Manager Config → Documents (per building); Expenses table has "Attach documents" for invoices/contracts per expense.
- **APIs**: GET list by buildingId or expenseId; POST upload; GET/[id] signed URL; DELETE.

### Lock Rules (summary)

- **Bills**: Delete only current month. Amount locked for past periods; status/paid_at always editable.
- **Expenses**: Delete only when unpaid. When paid: amount, category, vendor, title locked; paid_at editable.
- **Bill lines**: Locked when parent bill period is past.

---

## 15. Key Behaviors

- **PDF invoice**: Generated per (period, paymentResponsibleId) for owner, or per bill.
- **Receipt upload**: Owner/tenant uploads slip; stored in Supabase Storage; path recorded.
- **Unit assignment**: Manager (or admin) assigns **unit owner** and **unit tenant**; assignments maintain `unit_memberships` and legacy tables. **Payment responsibility** is per tenant assignment. One person can be owner on one unit and tenant on another while staying a **resident** at account level.
- **Bill grouping**: Bills grouped by (period, payer); one PDF and one slip per group.

---

## 16. Push Notifications

Push notifications use Capacitor's `@capacitor/push-notifications` plugin and Firebase Cloud Messaging (FCM).

### Requirements

- **Firebase project**: Required for both platforms.
- **Android**: Add `google-services.json` to the `android/app` directory.
- **iOS**: Add `GoogleService-Info.plist` to the iOS project; enable **Push Notifications** capability in Xcode. Add the AppDelegate handlers from [Capacitor Push Notifications docs](https://capacitorjs.com/docs/apis/push-notifications#ios) (didRegisterForRemoteNotificationsWithDeviceToken / didFailToRegisterForRemoteNotificationsWithError).
- **Server**: Set `FIREBASE_SERVICE_ACCOUNT_JSON` env var to the full JSON string of your Firebase service account key (from Firebase Console → Project settings → Service accounts). Required for server-side push when manager sends notifications.

### What's Included

- **Table `device_tokens`**: Stores FCM/APNS tokens per user per platform (`user_id`, `token`, `platform`).
- **API `/api/notifications/register-device`**: POST with `{ token, platform }`; upserts token for the authenticated user.
- **Component `PushNotificationSetup`**: Runs only on native (Capacitor) platforms; requests permissions, registers, and sends the token to the API. Included in the dashboard layout.
- **FCM sending**: When a manager sends a notification via `/api/notifications/send`, the app also sends push to all registered device tokens of the recipients (if `FIREBASE_SERVICE_ACCOUNT_JSON` is set).

---

*Document reflects the current state of the Domio app.*
