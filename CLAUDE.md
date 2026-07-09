# AppBarber - Claude Guide

## Purpose

This file is a short operating guide for anyone changing the AppBarber codebase.
It should help an agent decide what to do, what to avoid, and how to verify the result without needing to dig through project history.

## Product context

AppBarber is a SaaS for barbershop operations. The product centers on scheduling, customer management, service management, barber availability, and WhatsApp-based notifications.

The app should feel reliable, premium, and operational. It is not a generic admin panel.

Recent work has already pushed the app toward that goal:
- Dashboard now surfaces immediate operational attention
- Booking shows a fixed summary and clearer availability flow
- Appointments include a detail surface with quick actions
- Barbers, Services, and Clients use search/filter patterns for faster scanning
- Reports, WhatsApp settings, and the login surface were aligned to the same visual standard

Next implementation pass should follow this order:
1. Replace hardcoded `shop_id` values with the authenticated shop context. This base is now implemented on the main operational screens, including clients.
2. Tighten Supabase RLS policies by shop and user.
3. Audit all date/time creation, filtering, and display for UTC-3 consistency. The main booking, dashboard, appointments, reports, and availability paths are now explicit about UTC-3.
4. Convert remaining manual form flows to `React Hook Form + Zod` where it adds clarity.
5. Validate webhook, cron, and WhatsApp behavior after backend changes.

For existing databases, use the incremental migration path instead of replaying `supabase/schema.sql`:
- Apply `supabase/migrations/20260708194000_multitenancy_rls.sql`
- This migration is meant for an already provisioned database and only alters existing tables, policies, and helper functions
- It is the preferred handoff for the multitenancy/RLS pass because it avoids `relation already exists` failures
- The active-shop resolver now claims the first unowned shop for the signed-in user, so the existing dataset can be preserved instead of being stranded behind a new shop record

For the next working session, start with [NEXT_SESSION_QA.md](./NEXT_SESSION_QA.md) and follow the steps in order before moving on to any new feature work.

For the public-site expansion and future integrations, start with [FUTURE_IMPROVEMENTS.md](./FUTURE_IMPROVEMENTS.md). That file contains the handoff and roadmap for connecting the public site with the SaaS panel, and should be the source of truth for the next implementation pass.

## Hard rules

1. Do not modify shadcn/ui source components directly.
2. Keep dark mode as the default.
3. All user-facing time must stay in UTC-3.
4. Keep TypeScript strict and avoid `any`.
5. Use React Hook Form + Zod for forms.
6. Keep Zod schemas inferred from their source definitions.
7. Keep the Supabase client singleton pattern through context/providers.
8. Keep auth state managed through a provider.

## UI and UX expectations

- Keep the indigo visual identity consistent across screens.
- Prefer clear, premium, operational layouts over decorative ones.
- Make the booking flow calm, guided, and hard to misunderstand.
- Show real availability only. Never suggest blocked slots as valid options.
- Keep status colors, time display, and action hierarchy consistent across the app.
- Use composition via `className` and `asChild` instead of changing shadcn internals.

## Code conventions

- Pages live in `src/pages/`
- Domain components live in `src/components/`
- Hooks live in `src/hooks/`
- Utilities live in `src/lib/`
- Types live in `src/types/`
- Prefer the repo's existing patterns before introducing new abstractions
- Keep changes small and local unless the task clearly needs a wider refactor

## Areas that need extra care

- Booking and availability logic
- Timezone conversion and date handling
- Supabase queries and mutations
- WhatsApp notification flow
- Auth and session state

## Before you finish

Check these points before considering a change complete:

- The UI still matches the AppBarber identity
- The flow is clearer than before, not just different
- Empty, loading, and error states are handled
- Time display remains in UTC-3
- No shadcn/ui source file was modified
- TypeScript stays strict and clean

## Relationship to AGENTS.md

`AGENTS.md` is the broader project memory and change history.
`CLAUDE.md` is the short working manual.

If the two conflict, prefer the current repo code and the specific task request, then update these files later if needed.
