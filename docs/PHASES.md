# Bin Khalid Dairy Farm V2 — Phased Roadmap & Workflow

Read this alongside `SYSTEM_ARCHITECTURE.md` and `DESIGN.md` before
starting. This document governs HOW work proceeds, phase by phase.

---

## Working Rules (apply to every phase, all 10)

1. **Work autonomously within an approved phase.** Once a phase is
   approved to start, create files, install packages, run commands, and
   self-test (build, dev server, lint/type errors, actual functional
   checks) without stopping for approval on every individual file.

2. **Stop only at the end of a phase.** When a phase is complete and
   self-tested, stop and report:
   - What was built
   - What you tested yourself, and the result
   - A clear list of manual test steps for the human to perform —
     including real iPhone Safari testing over a mobile hotspot
     (laptop + phone on the same hotspot network) wherever relevant to
     that phase, not just desktop browser checks
   - Do not start the next phase until explicitly told to continue.

3. **Flag manual-only steps clearly**, labeled "MANUAL STEP NEEDED":
   - Firebase Console actions (project creation, enabling Auth providers,
     enabling Firestore, creating indexes, etc.)
   - Any `.env.local` value — state exactly what key/value is needed and
     where to find it (e.g. "Firebase Console → Project Settings →
     General → Web app config"). Confirm `.env.local` is git-ignored
     before proceeding. Secrets are never committed to GitHub.
   - Any other action outside the codebase (e.g., manually setting a
     Firestore doc to mark the first admin user).

4. **Git discipline:**
   - One commit per distinct file or tightly-related group of files.
   - Conventional Commit messages (`feat:`, `fix:`, `refactor:`, `chore:`,
     `docs:`, `test:`) describing what that specific change does.
   - Never batch a whole phase into one commit.
   - Never use `git add .` — add specific file paths only.
   - Never commit `.env.local` or any credential/secret file.
   - Every file changed in a phase should have its own clear commit
     history entry so the GitHub log reads as a readable build log.

5. **On errors:** if something can't be resolved after reasonable
   attempts, stop, explain the exact error, the likely cause, and what's
   needed to proceed — don't guess indefinitely.

---

## Phase 1 — Foundation
- Next.js project init (TypeScript, App Router, Tailwind, ESLint)
- Firebase client SDK + Admin SDK configuration (`.env.local` → MANUAL
  STEP for actual key values)
- Firebase Authentication (Email/Password + Google)
- Protected routes / auth redirect guard
- `/users/{uid}` authorization check (`active: true`)
- Firestore Security Rules v1 (deny-all default)
- `.gitignore` verification

## Phase 2 — Design System & Dashboard Shell
- Brand theme tokens from `DESIGN.md` / logo
- App shell, responsive navigation (mobile-first)
- Dashboard structure (no fake data — real Firestore queries, even if
  showing zeros until Phase 3+ adds real records)
- Landing/marketing page per `DESIGN.md`, including the developer credit
  section

## Phase 3 — Customers & Products
- Customer CRUD, search, archive (not hard delete)
- Product/service management, pre-seeded products
- Customer-specific rate support (with rate history)
- Opening balance entry point (ledger transaction, per architecture doc)

## Phase 4 — Customer Billing
- Milk calculation logic (auto day count, live preview)
- Multi-line-item bills
- Draft → Finalize workflow (Server Action, atomic transaction)
- Bill number generation (`BK-YYYY-NNNN`, transactional counter)
- Void/replacement workflow

## Phase 5 — Customer Payments & Ledger
- Full/partial payments, payment allocation
- Customer ledger/Khata view (running balance)
- Automatic bill status updates

## Phase 6 — Suppliers & Farm Supplies
- Supplier CRUD
- Farm supply item management (pre-seeded + custom)
- Multi-item purchase entry, previous balance snapshot
- Supplier payments (Jama), supplier ledger
- Monthly statement generation (snapshot pattern)

## Phase 7 — Staff & Salary
- Employee CRUD, salary history (effective-dated)
- Authorized people list (Settings-managed, not hardcoded)
- Advance/payment entry (source: Ghar/Dukan, given by)
- Employee ledger (reversed sign convention), monthly salary statement

## Phase 8 — Bills, Statements, Sharing
- Bilingual (English + Urdu RTL) customer invoice
- Supplier and employee statement templates
- Image generation for sharing (WhatsApp-friendly)
- Native share flow

## Phase 9 — Reports & Settings
- Cross-domain reports (customer, supplier, employee)
- CSV export where practical
- Settings module (business info, payment accounts, invoice notices,
  item/people management)

## Phase 10 — Testing, Security, Deployment
- Full financial workflow testing across all 3 domains
- Firestore Security Rules review
- Mobile (real iPhone Safari) + desktop pass on every module
- Backup/export strategy
- Vercel production deployment, environment variable setup on Vercel
  (MANUAL STEP — production `.env` values entered directly in Vercel
  dashboard, never committed)

---

*Companion documents: `SYSTEM_ARCHITECTURE.md`, `DESIGN.md`.*
