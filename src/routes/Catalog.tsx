// Catalog explorer (plan section 6, basic list view). Lists every check
// shipped by the dashboard, grouped by category. This is a polish surface;
// per-check detail pages are out of scope for this iteration. Backed by
// the static check catalog at src/api/checkCatalog.ts.

import { useMemo, useState } from "react"
import { getAllCategories, getAllChecks, type CheckCatalogEntry } from "@/api/checkCatalog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge-fallback"
import { cn } from "@/lib/utils"

function severityBadgeClass(sev: "ERROR" | "WARNING" | "NOTICE"): string {
  switch (sev) {
    case "ERROR":
      return "bg-red-500/15 text-red-700 dark:text-red-300"
    case "WARNING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    case "NOTICE":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
  }
}

export function Catalog() {
  const [query, setQuery] = useState("")
  const all = getAllChecks()
  const cats = getAllCategories()

  const filtered = useMemo(() => {
    if (!query.trim()) return all
    const q = query.trim().toLowerCase()
    return all.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        e.marketingId.toLowerCase().includes(q),
    )
  }, [query, all])

  const grouped = useMemo(() => {
    const map = new Map<string, CheckCatalogEntry[]>()
    for (const cat of cats) map.set(cat, [])
    for (const entry of filtered) {
      const list = map.get(entry.category) ?? []
      list.push(entry)
      map.set(entry.category, list)
    }
    return Array.from(map.entries()).filter(([, items]) => items.length > 0)
  }, [filtered, cats])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-sm text-muted-foreground">
          {all.length} checks across {cats.length} categories.
        </p>
      </div>

      <Input
        type="search"
        placeholder="Search checks..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-md"
        aria-label="Search catalog"
      />

      {grouped.length === 0 ? (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          No checks match your search.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cat, items]) => (
            <section key={cat} className="space-y-2">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {cat}
              </h2>
              <ul className="divide-y rounded-md border bg-card">
                {items.map((entry) => (
                  <li key={entry.type} className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={cn(severityBadgeClass(entry.severityDefault))}
                      >
                        {entry.severityDefault}
                      </Badge>
                      <span className="font-medium">{entry.title}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {entry.marketingId}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed">
                      {entry.description}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
