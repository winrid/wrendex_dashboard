import { useNavigate, useParams } from "react-router-dom"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table/DataTable"
import { StubPage } from "./StubPage"
import { Badge } from "@/components/ui/badge-fallback"

type Site = {
  id: string
  name: string
  url: string
  lastCrawl: string
  healthScore: number
}

const MOCK_SITES: Site[] = [
  {
    id: "s_1",
    name: "Acme Corp",
    url: "https://acme.example",
    lastCrawl: "2026-04-30 09:14",
    healthScore: 92,
  },
  {
    id: "s_2",
    name: "Northwind",
    url: "https://northwind.example",
    lastCrawl: "2026-04-30 06:02",
    healthScore: 78,
  },
  {
    id: "s_3",
    name: "Globex",
    url: "https://globex.example",
    lastCrawl: "2026-04-29 22:48",
    healthScore: 64,
  },
  {
    id: "s_4",
    name: "Initech",
    url: "https://initech.example",
    lastCrawl: "2026-04-29 18:11",
    healthScore: 51,
  },
  {
    id: "s_5",
    name: "Soylent",
    url: "https://soylent.example",
    lastCrawl: "2026-04-29 11:33",
    healthScore: 88,
  },
]

function scoreColor(score: number) {
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 65) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

export function Sites() {
  const navigate = useNavigate()
  const { tenantId = "default" } = useParams()
  const columns: ColumnDef<Site>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <button
          className="font-medium hover:underline"
          onClick={() => navigate(`/t/${tenantId}/sites/${row.original.id}`)}
        >
          {row.original.name}
        </button>
      ),
    },
    {
      accessorKey: "url",
      header: "URL",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.url}</span>
      ),
    },
    {
      accessorKey: "lastCrawl",
      header: "Last crawl",
    },
    {
      accessorKey: "healthScore",
      header: "Health",
      cell: ({ row }) => (
        <Badge variant="outline" className={scoreColor(row.original.healthScore)}>
          {row.original.healthScore}
        </Badge>
      ),
    },
  ]

  return (
    <StubPage
      title="Sites"
      description="Monitor crawl health across every site under this tenant."
    >
      <DataTable columns={columns} data={MOCK_SITES} />
    </StubPage>
  )
}
