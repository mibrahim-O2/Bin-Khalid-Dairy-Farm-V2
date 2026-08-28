# Bin Khalid Dairy Farm V2 — Design System & Landing Page

Reference document for visual identity. The farm logo (attached separately)
is the primary source of truth for the logo itself (do not redesign/alter/
distort it) — re-check the exact colors against it before finalizing tokens.

---

## 1. Brand Color Palette (from logo analysis)

| Role | Hex | Usage |
|---|---|---|
| Primary | `#1B4332` | Headings, primary buttons, nav, banner elements |
| Primary Dark | `#0D2818` | High-contrast text, dark surfaces |
| Secondary / Black | `#0A0A0A` | Logo background, premium accents |
| Accent (Gold) | `#C9A227` | Sparingly — badges, highlights, key numbers. Not present in the logo itself; used for brand continuity with the developer's existing dark/gold portfolio identity. Use narrowly. |
| Background | `#FAF7F0` | App background (warm ivory, not stark white) |
| Surface / Card | `#FFFFFF` | Cards on ivory background |
| Border | `#D8DED5` | Dividers, subtle borders |
| Text Primary | `#14231A` | Body text |
| Text Secondary | `#5B6B60` | Labels, meta text |
| Success | `#2E7D4F` | "Paid" status |
| Warning | `#C97A1B` | "Partially Paid" status |
| Error | `#B23B3B` | "Void" / overdue status |

## 2. Design Direction

- Premium, professional, agricultural — not a generic SaaS dashboard.
- No gradients, no glassmorphism, no neon, minimal animation.
- Generous whitespace, consistent spacing, high-contrast accessible text.
- Mobile-first: large touch targets, no cramped desktop-shrunk layouts.
- Typography: clean sans-serif for UI (Inter/Manrope-class), bolder
  serif/slab weight acceptable for the "Bin Khalid Dairy Farm" wordmark
  treatment to echo the logo's banner lettering.
- Urdu text (invoices, notices) needs a properly bundled RTL-compatible
  web font (e.g. Noto Nastaliq Urdu or similar open-license option) —
  self-hosted, not dependent on a CDN being available at render time.

## 3. Financial Status Colors (used consistently across all 3 domains)

- Paid / Settled — Success green
- Partially Paid / Pending — Warning gold-orange
- Void / Overdue — Error red
- Draft — neutral gray, visually distinct from posted/finalized states

## 4. Landing Page Requirements

The app's public landing/marketing page (before login) should be genuinely
professional — this represents both the farm business and the developer's
own portfolio-quality work. Requirements:

- Clean hero section: Bin Khalid Dairy Farm branding, logo, short
  description of the farm/business.
- Overview of what the system does (not a feature dump — a few clear,
  well-designed sections: customer billing, supplier tracking, staff
  management, or similar, described simply).
- Footer credit line: **"Made with ❤️ by [developer name]"** — include the
  developer's GitHub profile photo and a brief credit/attribution, linking
  to their GitHub profile.
  - Developer: **Muhammad Ibrahim** — Co-Founder & CTO, AINEXO; BS Computer
    Science, Institute of Mathematics and Computer Science (IMCS),
    University of Sindh, Jamshoro.
  - GitHub: https://github.com/mibrahim-O2
  - GitHub avatar can be pulled from `https://github.com/mibrahim-O2.png`
    for the credit section.
- Keep this section tasteful and small — a footer or "About the developer"
  card, not a competing focal point against the farm's own branding. The
  farm's identity leads the page; the developer credit is a quiet,
  well-crafted footnote.
- Fully responsive — this page will be viewed on iPhone Safari as often as
  desktop, per the project's mobile-first requirement.

---

*Companion documents: `SYSTEM_ARCHITECTURE.md` (data model, security,
financial logic), `PHASES.md` (roadmap and per-phase testing).*
