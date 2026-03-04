# Domio App – Technical Documentation

**Current state documentation.** Condo / HOA management web and mobile app.

---

## 1. Overview

**Domio** is a condo (HOA) management app with role-based dashboards:
- **Admin** – sites and managers
- **Manager** – billing, expenses, config per site
- **Owner** – own units, bills, ledger
- **Tenant** – own bills, ledger

Includes mobile shells (iOS/Android) via Capacitor that load the deployed web app.

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

---

## 4. Folder Structure

```
domio-app/
├── app/
│   ├── (auth)/                 # Auth route group
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── api/                    # REST API routes
│   │   ├── admin/              # Admin CRUD, maintenance, audit-log
│   │   ├── auth/signout/
│   │   ├── bills/
│   │   ├── expenses/
│   │   ├── invoice/             # PDF generation
│   │   ├── notifications/       # get, read, send, sent
│   │   ├── receipt/             # Serve receipt files
│   │   ├── receipt-record/
│   │   ├── owner/data/
│   │   ├── tenant/data/
│   │   └── users/              # create, update
│   ├── actions/                # Server actions
│   │   ├── auth.ts
│   │   ├── billing.ts
│   │   ├── config.ts
│   │   └── users.ts
│   ├── dashboard/
│   │   ├── page.tsx             # Redirects via DashboardRouter
│   │   ├── dashboard-router.tsx
│   │   ├── owner/page.tsx
│   │   ├── manager/page.tsx
│   │   ├── tenant/page.tsx
│   │   └── admin/
│   │       ├── page.tsx
│   │       └── managers/[id]/page.tsx
│   ├── layout.tsx
│   ├── page.tsx                 # Home
│   └── not-found.tsx
├── components/
│   ├── ui/                      # shadcn-style components
│   ├── NotificationBell.tsx
│   ├── DomioLogo.tsx
├── lib/
│   ├── supabase/client.ts       # Browser client
│   ├── supabase/server.ts       # Server client
│   └── utils.ts
├── public/
├── supabase/migrations/          # SQL migrations (40 files)
├── android/                     # Capacitor Android project
├── ios/                         # Capacitor iOS project
├── capacitor.config.ts
├── middleware.ts
└── package.json
```

---

## 5. Routes & Pages

| Route | Purpose |
|-------|---------|
| `/` | Home – Sign in / Sign up or Dashboard link |
| `/login` | Sign in |
| `/signup` | Sign up (creates owner by default) |
| `/dashboard` | DashboardRouter → redirect by role |
| `/dashboard/admin` | Admin dashboard |
| `/dashboard/admin/managers/[id]` | Edit manager |
| `/dashboard/manager` | Manager dashboard |
| `/dashboard/owner` | Owner dashboard |
| `/dashboard/tenant` | Tenant dashboard |

**Auth flow:**
- `/dashboard` loads `DashboardRouter`.
- Reads Supabase user and `profiles.role`.
- Redirects to `/dashboard/admin`, `/manager`, `/owner`, or `/tenant`.
- If not logged in → `/login`.

---

## 6. Features by Role

### Admin

- **Sites**: List, create, update; assign managers.
- **Managers**: Create (with optional site); list; edit via `/admin/managers/[id]`.
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
- **Audit Log**: View changes for their site only (entity type filter).
- **Mobile**: Bottom tabs (Billing, Expenses, Payments, Ledger); config via cog icon.

### Owner

- **My Units**: Units owned, building, type, m², assign/remove tenants. Sortable (unit, building, type, size, tenant).
- **Billing**:
  - Bills grouped by period + payer.
  - Download PDF invoice, upload slip (image/PDF).
  - Filters: Period, unit type, unit, payment status. Sortable columns.
  - Mobile: Filter icon (top right) toggles collapsible filters.
- **Ledger**: Income vs expenses, running balance. Filters: Period, type, status. Sortable columns.
- **Summary Cards**: Collected, Outstanding, Monthly expenses, Net fund.
- **Notifications**: Bell with unread count, mark read, “See all”.
- **Mobile**: Bottom tabs (My Units, Billing, Ledger); notifications via bell.

### Tenant

- **My Units**: Read-only units assigned.
- **Billing**: Own bills (payment responsible); download PDF, upload slips.
- **Ledger**: View transactions.
- **Notifications**: Same as owner.

---

## 7. Database Schema

### Main Tables

| Table | Purpose |
|-------|---------|
| `profiles` | id, name, surname, phone, email, role (app_role) |
| `sites` | id, name, address, manager_id, vat_account |
| `buildings` | id, name, site_id |
| `units` | id, building_id, unit_name, type, size_m2, block, entrance, floor |
| `unit_owners` | unit_id, owner_id |
| `unit_tenant_assignments` | unit_id, tenant_id, is_payment_responsible |
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

- `app_role`: manager, owner, tenant, admin
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

## 8. API Routes

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
| `/api/owner/data` | GET | Owner data |
| `/api/tenant/data` | GET | Tenant data |
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

## 9. Components

| Component | Purpose |
|-----------|---------|
| `DomioLogo` | Logo component |
| `NotificationBell` | Bell icon, unread count, dropdown (first 4 + “See all”), mark read. Manager: “Send notification” entry. |
| `DashboardRouter` | Redirects to role dashboard |
| `SortableTh` | Sortable table header (column, sortCol, sortDir, onSort) |
| `sortBy()` | Utility from sortable-th for client-side sort |
| UI (button, card, input, label, select, tabs, table, dropdown-menu, hover-card) | Shared UI primitives |

---

## 10. Integrations

### Supabase

- Auth: email/password.
- DB: PostgreSQL, RLS by role and site.
- Storage: `payment-slips`, `documents` buckets.
- Client: `createClient` from `@/lib/supabase/client` (browser).
- Server: `createClient` from `@/lib/supabase/server` / `@supabase/ssr`.

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

## 11. Mobile Layout


- **Owner**: Bottom tabs (My Units, Billing, Ledger); Notifications via bell; filter icon toggles collapsible filters on Billing and Ledger.
- **Manager**: Bottom tabs (Billing, Expenses, Payments, Ledger); Config via cog; filters collapsible on mobile.
- **Tenant**: Same pattern as owner where applicable.

---

## 12. Audit Logs, Document Management & Lock Rules

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

## 13. Key Behaviors

- **PDF invoice**: Generated per (period, paymentResponsibleId) for owner, or per bill.
- **Receipt upload**: Owner/tenant uploads slip; stored in Supabase Storage; path recorded.
- **Unit assignment**: Manager assigns owners to units; owner/manager assigns tenants; one tenant per unit can be payment responsible.
- **Bill grouping**: Bills grouped by (period, payer); one PDF and one slip per group.

---

## 14. Push Notifications

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
