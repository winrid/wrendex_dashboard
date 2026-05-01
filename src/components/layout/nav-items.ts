import {
  Globe,
  Inbox,
  FileBarChart,
  BookOpen,
  CalendarClock,
  Users,
  CreditCard,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
}

const NAV_PATHS: { path: string; label: string; icon: LucideIcon }[] = [
  { path: "sites", label: "Sites", icon: Globe },
  { path: "inbox", label: "Inbox", icon: Inbox },
  { path: "reports", label: "Reports", icon: FileBarChart },
  { path: "catalog", label: "Catalog", icon: BookOpen },
  { path: "schedule", label: "Schedule", icon: CalendarClock },
  { path: "team", label: "Team", icon: Users },
  { path: "billing", label: "Billing", icon: CreditCard },
  { path: "settings", label: "Settings", icon: Settings },
]

export function getNavItems(tenantId: string): NavItem[] {
  return NAV_PATHS.map((p) => ({
    to: `/t/${tenantId}/${p.path}`,
    label: p.label,
    icon: p.icon,
  }))
}
