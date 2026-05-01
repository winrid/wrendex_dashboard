# Wrendex Dashboard

Customer-facing admin dashboard for Wrendex, a technical SEO audit tool. Consumes the Java + Javalin backend on port 7070. Built with React, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Table / Query / Virtual, and React Router 6. This iteration is the foundation: AppShell layout (Sidebar + topbar + cmd-k command palette + dark mode toggle), routes stubbed for every sidebar item, a shared DataTable wrapper that the eight reports and drill-ins will reuse, and TanStack Query wired at the root with a 30 second default stale time.

## Running

```
pnpm install
pnpm dev
```

For a production bundle:

```
pnpm build
```

## Plan

The full engineering plan lives at `../backend/DASHBOARD_PLAN.txt`. Section 0.1 covers the stack rationale; section 0.2 covers the API client; sections 4 and 4A enumerate the reports and drill-ins that will reuse `src/components/data-table/DataTable.tsx`.
