# Dashboard Engineering Conventions

Read this before changing the dashboard. The plan is at
`../backend/DASHBOARD_PLAN.txt`; that is the source of truth for what
to build. This file is the source of truth for HOW to build it.

## Stack

React 19, Vite 8, TypeScript 6, Tailwind CSS v4, shadcn/ui (Radix
primitives copied into the repo), TanStack Table / Virtual / Query,
React Hook Form + Zod, Recharts, lucide-react, sonner, cmdk,
framer-motion, React Router 6. See plan section 0.1.

## Hard rules (no exceptions)

1. **Type-safe API client only.** No raw `fetch`, no `axios`, no hand-
   written URL strings pointing at `/api/...`. Every backend call goes
   through the typed client. Methods live in `src/api/client.ts`, types
   in `src/api/types.ts`; nothing outside `src/api/` may construct a URL
   string for the backend. Reviewer agents reject PRs that bypass it.
   If an endpoint is missing, add the method + types in `src/api/`;
   do NOT escape-hatch around it.

2. **Tenant-scoped routes only.** All authenticated routes nest under
   `/t/:tenantId/...`. New routes that don't follow this pattern are
   rejected. The placeholder `default` tenant resolves while 0.3a auth
   is pending.

3. **Use `DataTable` for every report grid.** Do not hand-roll tables.
   `src/components/data-table/DataTable.tsx` exposes controlled props
   for sorting, pagination, columnFilters, columnPinning, and a
   `rowCount` prop for server pagination.

4. **Accept shadcn defaults.** Spacing scale, typography ramp, focus
   rings, motion timings: do NOT tweak. Customise only the token block
   in `globals.css`, the `DataTable` wrapper, the health-score ring,
   and the crawl-progress component.

5. **No emojis in source / commits unless explicitly asked.**

6. **No em dashes anywhere.** Use a regular hyphen, comma, or rephrase.

7. **No `Co-Authored-By Claude` or AI attribution in commit messages.**

8. **No bash scripts.** If you need scripting, use Python or Node.js.

9. **Never pipe test or build output to grep.** Tee to a file in `/tmp`
   and read the file.

## Repo layout

```
src/
  api/                typed client (client.ts) + types (types.ts) +
                      useApiClient hook; the only place URL strings live
  auth/               AuthProvider + RequireAuth route guard
  components/
    data-table/       shared TanStack Table wrapper
    layout/           AppShell, CommandPalette, ThemeToggle, nav-items
    ui/               shadcn primitives (copied in, edit in place)
  hooks/
  lib/
  routes/             one file per route; thin, no business logic
  styles/globals.css  tokens for light + dark
```

All authenticated state flows through `useAuth()` from
`src/auth/AuthProvider.tsx`. Routes that need the session use
`<RequireAuth>` (already applied to `/t/:tenantId/...`). The bearer token
lives in localStorage (`wrendex.sessionToken`) and is auto-injected into
every API call via the client's `getAuthHeader` hook.

## Adding a new route

1. Add the route to `src/router.tsx` under `/t/:tenantId/...`.
2. Read `tenantId` and any other params with `useParams`.
3. If the route lists data, use `DataTable` with controlled state.
4. Server calls go through `useApiClient()` from `src/api/`.

## Adding a new shadcn component

`pnpm dlx shadcn@latest add <name>`. Then edit the generated file in
`src/components/ui/<name>.tsx` if you need to. Do NOT depend on
external component libraries.
