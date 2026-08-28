# Bin Khalid Dairy Farm V2

Dairy farm management, billing, and ledger system. Next.js 15 (App Router,
TypeScript, Tailwind, shadcn/ui) with Firebase Authentication and Cloud
Firestore, deployed on Vercel.

See `docs/SYSTEM_ARCHITECTURE.md`, `docs/DESIGN.md`, and `docs/PHASES.md`
for the full architecture, design system, and phased build roadmap.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in real Firebase values
npm run dev
```

The dev server binds to `0.0.0.0` so it's reachable from a phone on the
same network (e.g. `http://<your-lan-ip>:3000`) — useful for testing on
real iOS Safari over a mobile hotspot. If assets fail to load from that
origin, add it to `allowedDevOrigins` in `next.config.ts`.

## Activating a user

New sign-ins land on a "pending approval" screen until an admin activates
them (sets the `active: true` custom claim). Run:

```bash
node scripts/set-user-active.mjs someone@example.com
```

The user must sign out and back in afterward for the claim to take effect.
