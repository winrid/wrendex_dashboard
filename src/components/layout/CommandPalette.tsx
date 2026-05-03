// Cmd-K palette. Existing behaviour: lists Navigate-group entries from
// nav-items.ts. Extended for P4 iter 3 BE-C: when the user types a query,
// the palette debounces the input and calls client.search({q, tenantId,
// limit: 20}). Results are grouped by kind (Sites / Pages / Alerts / Checks)
// and clicking a result navigates to result.route. The Navigate group is
// always rendered at the bottom; when the query is empty, only Navigate
// is shown (the original behaviour).

import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Globe,
  FileText,
  AlertTriangle,
  BookOpen,
  type LucideIcon,
} from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useApiClient } from "@/api/useApiClient"
import type { SearchResult, SearchResultKind } from "@/api/types"
import { getNavItems } from "./nav-items"

const SEARCH_DEBOUNCE_MS = 200

const KIND_META: Record<
  SearchResultKind,
  { heading: string; icon: LucideIcon }
> = {
  site: { heading: "Sites", icon: Globe },
  page: { heading: "Pages", icon: FileText },
  alert: { heading: "Alerts", icon: AlertTriangle },
  check: { heading: "Checks", icon: BookOpen },
}

const KIND_ORDER: SearchResultKind[] = ["site", "page", "alert", "check"]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [rawQuery, setRawQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const navigate = useNavigate()
  const { tenantId = "default" } = useParams()
  const items = getNavItems(tenantId)
  const client = useApiClient()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Reset everything when the dialog closes so reopening starts clean.
  useEffect(() => {
    if (!open) {
      setRawQuery("")
      setDebouncedQuery("")
    }
  }, [open])

  // Debounce the raw query so we don't call /api/search on every keystroke.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedQuery(rawQuery.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [rawQuery])

  const searchQ = useQuery({
    queryKey: ["cmdk-search", tenantId, debouncedQuery],
    queryFn: () =>
      client.search({ q: debouncedQuery, tenantId, limit: 20 }),
    enabled: open && debouncedQuery.length > 0,
    staleTime: 30_000,
  })

  const grouped = useMemo(() => {
    const out: Record<SearchResultKind, SearchResult[]> = {
      site: [],
      page: [],
      alert: [],
      check: [],
    }
    for (const r of searchQ.data ?? []) {
      const kind = r.kind in out ? r.kind : null
      if (kind) out[kind].push(r)
    }
    return out
  }, [searchQ.data])

  const hasQuery = debouncedQuery.length > 0
  const hasAnyResult =
    hasQuery &&
    (grouped.site.length +
      grouped.page.length +
      grouped.alert.length +
      grouped.check.length) >
      0

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Search across the app"
    >
      <CommandInput
        placeholder="Search sites, pages, alerts, checks, or jump to..."
        value={rawQuery}
        onValueChange={setRawQuery}
      />
      <CommandList>
        {hasQuery && !searchQ.isLoading && !hasAnyResult ? (
          <CommandEmpty data-testid="cmdk-empty">
            No results found.
          </CommandEmpty>
        ) : null}

        {hasQuery
          ? KIND_ORDER.map((kind) => {
              const rows = grouped[kind]
              if (rows.length === 0) return null
              const meta = KIND_META[kind]
              const Icon = meta.icon
              return (
                <CommandGroup
                  key={kind}
                  heading={meta.heading}
                  data-testid={`cmdk-group-${kind}`}
                >
                  {rows.map((r) => (
                    <CommandItem
                      key={`${kind}-${r.id}`}
                      value={`${kind}-${r.id}-${r.title}`}
                      onSelect={() => {
                        setOpen(false)
                        navigate(r.route)
                      }}
                      data-testid={`cmdk-result-${kind}-${r.id}`}
                    >
                      <Icon className="mr-2 size-4" />
                      <span className="flex flex-col items-start">
                        <span className="font-medium">{r.title}</span>
                        {r.snippet ? (
                          <span className="text-xs text-muted-foreground">
                            {r.snippet}
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })
          : null}

        {hasQuery && hasAnyResult ? <CommandSeparator /> : null}

        <CommandGroup heading="Navigate">
          {items.map((item) => (
            <CommandItem
              key={item.to}
              value={item.label}
              onSelect={() => {
                setOpen(false)
                navigate(item.to)
              }}
            >
              <item.icon className="mr-2 size-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
