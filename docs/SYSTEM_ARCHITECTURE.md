# Bin Khalid Dairy Farm V2 — System Architecture

Reference document. Read this fully before writing any code. This is the
single source of truth for how the system is structured — do not deviate
from it without explicitly flagging the reason and getting approval.

---

## 1. Overview

A complete dairy farm management, billing, and ledger system replacing an
old Flask/SQLite local application. Manages three separate financial
relationships for the business:

- **Customers** who buy milk and other dairy products from the farm
- **Suppliers** who sell farm materials (feed, etc.) to the farm
- **Employees** who work for the farm and draw salary/advances

Built as a single Next.js web application, mobile-first, usable from an
iPhone (Safari) and from a laptop browser, deployed on Vercel.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15, App Router, TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Icons | Lucide React |
| Auth | Firebase Authentication (Email/Password + Google) |
| Database | Cloud Firestore |
| Trusted server layer | Next.js Server Actions using Firebase Admin SDK |
| Hosting | Vercel |
| Version control | GitHub — https://github.com/mibrahim-O2/Bin-Khalid-Dairy-Farm-V2 |

No Firebase Storage in v1 unless a specific need comes up. No Android app —
web only, must behave correctly on iOS Safari and desktop browsers.

---

## 3. Core Trust Boundary — READ THIS CAREFULLY

This is the single most important architectural rule in the project.

**Client-side direct Firestore writes are allowed ONLY for non-financial
master data:**
- Customers, Products, Suppliers, Farm Supply Items, Employees,
  Authorized People list, Settings

These are protected by Firestore Security Rules (admin-only), but the
write itself can originate from the browser.

**ALL financial writes MUST go through a Next.js Server Action using the
Firebase Admin SDK. The client must never write directly to these
collections. Firestore Security Rules must explicitly deny direct client
writes to them.**

Financial writes include:
- Customer bill finalize / void / replace
- Customer payment record
- Supplier purchase record / void / replace
- Supplier payment (Jama) record
- Employee salary accrual
- Employee advance/payment record
- Opening balance (any domain)
- Adjustment (any domain)
- Any ledger transaction of any kind
- Bill/purchase number counters

Why: financial correctness depends on atomic, validated writes (e.g. "when
a bill is finalized, create exactly one ledger debit, update exactly one
balance cache, in one transaction"). A browser cannot be trusted to do this
correctly or safely — a Server Action running with Admin privileges can
validate inputs server-side and use a Firestore transaction to guarantee
this happens atomically and cannot be tampered with from the client.

---

## 4. The Three Financial Domains

Each domain has its own collections and its own ledger. They are **never**
merged into a shared table. Each domain's balance is always **derived**
from its ledger (sum of debits − sum of credits, or the reverse for
employees — see below), never stored as a directly-editable field. A
cached balance field may exist for fast reads, but it is written only
inside the same server-side transaction that writes the ledger entry.

### Domain A — Customers
- Debit = a finalized bill (customer owes more)
- Credit = a payment (customer owes less)
- Balance = Σdebits − Σcredits = amount customer owes the farm

### Domain B — Suppliers
- Debit = a purchase (farm owes more)
- Credit = a payment / Jama (farm owes less)
- Balance = Σdebits − Σcredits = amount farm owes the supplier

### Domain C — Employees (sign convention is REVERSED vs A and B)
- Credit = salary accrued (farm owes the employee more)
- Debit = advance/payment taken (farm owes the employee less)
- Balance = Σcredits − Σdebits
  - Positive = farm still owes the employee salary
  - Negative = employee has taken an advance against future salary

---

## 5. Financial Integrity Rules (apply to ALL three domains, no exceptions)

1. Never hard-delete a finalized/posted financial record.
2. Finalized records are immutable. No silent "Edit" on a posted bill,
   purchase, payment, salary accrual, or ledger transaction.
3. Corrections use **void + reason + actor + timestamp**, optionally
   followed by a **replacement record** linked to the voided one
   (`replacesRecordId` / `replacedByRecordId`).
4. Opening balances are real ledger transactions (`type: opening_balance`),
   never a manually editable field on a customer/supplier/employee doc.
5. Rate/salary changes are effective-dated and historized — a later change
   must never alter the calculation shown on an older finalized record.
   Finalized bills/purchases/statements snapshot the rate/salary that was
   in effect at the time.
6. Sequential document numbers (e.g. bill numbers `BK-YYYY-NNNN`) are
   generated via a Firestore transaction on a counter document, never
   client-side, to avoid duplicates under concurrent use.

---

## 6. Firestore Schema (collections)

```
/users/{uid}
/customers/{customerId}
/customerRates/{id}                 # customerId + productId + rate history
/products/{productId}
/bills/{billId}
/payments/{paymentId}
/paymentAllocations/{id}
/customerLedgerTransactions/{id}

/suppliers/{supplierId}
/farmSupplyItems/{itemId}
/purchases/{purchaseId}
/supplierPayments/{paymentId}
/supplierLedgerTransactions/{id}
/supplierStatements/{id}            # generated monthly snapshot, not a live ledger

/employees/{employeeId}
/employeeSalaryHistory/{id}
/employeePayments/{paymentId}
/employeeLedgerTransactions/{id}
/employeeStatements/{id}            # generated monthly snapshot, not a live ledger
/authorizedPeople/{personId}        # replaces hardcoded "who hired"/"given by" names

/activityLogs/{logId}
/settings/business
/settings/payments
/settings/invoices
/settings/system
/counters/{year}                    # e.g. customer bill number counter
/counters/{domain}_{year}           # separate counters per domain if needed
```

Monthly supplier/employee "records" are **generated snapshot documents**,
not a second mutable ledger — the purchases/payments/advances themselves
are the source of truth; a statement aggregates a date range into an
immutable, shareable document, same pattern as a customer bill.

---

## 7. Security Model

- Firestore Security Rules deny-by-default.
- `/users/{uid}` — self-read only; `active: true` required for any other
  access, checked via custom claim on the Auth token (not a rules `get()`
  call, for latency reasons) once implemented.
- Non-financial collections — read/write allowed only to authenticated,
  authorized admin users.
- Financial collections — **read** allowed to authorized admin only,
  **write denied entirely at the rules level** (`allow write: if false`);
  all writes happen via Server Actions using the Admin SDK, which bypasses
  client rules by design (server-side trust).
- `.env.local` holds Firebase client config AND Admin SDK service account
  credentials. This file is NEVER committed to GitHub. Confirm
  `.gitignore` covers it before the first commit of the project.

---

## 8. Design/Calculation Reference

**Customer milk billing:**
```
Total Milk = (Daily Milk × Days) + Extra Milk − Less/Used Milk
Amount = Total Milk × Rate
Days = auto-calculated from (endDate − startDate + 1), not manually typed
Final Payable = Current Bill Subtotal + Previous Outstanding Balance (from ledger)
```

**Other customer products (Ghee, Dahi, Makhan):** `Quantity × Rate = Line Total`

**Supplier purchase:** multiple line items per purchase, each
`Quantity × Rate = Line Total`; purchase total + previous supplier balance
(from ledger) = total payable.

**Employee salary:** monthly salary accrual (credit) minus
advances/payments taken (debit) = remaining payable or advance balance.

---

*Companion documents: `DESIGN.md` (brand/visual system, landing page),
`PHASES.md` (10-phase roadmap, per-phase deliverables and testing).*
