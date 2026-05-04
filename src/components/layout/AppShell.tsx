import { Suspense, useEffect } from "react"
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom"
import { RouteFallback } from "./RouteFallback"
import { useQuery } from "@tanstack/react-query"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Search,
  ChevronDown,
  LogOut,
  User,
  Building,
  BookmarkIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useApiClient } from "@/api/useApiClient"
import type { SavedView } from "@/api/types"
import { stashPendingSavedView } from "@/components/saved-views/handoff"
import { Toaster } from "@/components/ui/sonner"
import { ThemeToggle } from "./ThemeToggle"
import { NotificationBell } from "./NotificationBell"
import { CommandPalette } from "./CommandPalette"
import { getNavItems } from "./nav-items"
import { useAuth } from "@/auth/AuthProvider"
import { WrenMark } from "@/components/brand/WrenMark"

function SidebarNav() {
  const location = useLocation()
  const { tenantId = "default" } = useParams()
  const items = getNavItems(tenantId)
  return (
    <SidebarMenu>
      {items.map((item) => {
        const active =
          location.pathname === item.to ||
          location.pathname.startsWith(`${item.to}/`)
        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton asChild isActive={active}>
              <NavLink to={item.to}>
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

// ---------------------------------------------------------------------------
// Saved-views sidebar group (plan section P4 iter 1, task 3). Lists the
// active tenant's segments scoped to the current site (via the URL when
// available, otherwise tenant-wide). Click navigates to the segment's
// route; the destination route reads the stashed handoff on mount.
// ---------------------------------------------------------------------------

/** Substitutes :siteId / :crawlId in a saved-view route pattern with concrete
 *  ids. Returns null when the pattern requires a crawlId and we have not been
 *  given one (the caller's job to resolve a sensible default before navigating). */
function resolveSavedViewPath(
  route: string,
  ctx: { tenantId: string; siteId?: string | null; crawlId?: string | null },
): string | null {
  let path = route
  if (path.includes(":siteId")) {
    if (!ctx.siteId) return null
    path = path.replaceAll(":siteId", ctx.siteId)
  }
  if (path.includes(":crawlId")) {
    if (!ctx.crawlId) return null
    path = path.replaceAll(":crawlId", ctx.crawlId)
  }
  return `/t/${ctx.tenantId}${path}`
}

function SavedViewsGroup() {
  const { tenantId = "default", siteId: routeSiteId } = useParams<{
    tenantId: string
    siteId: string
  }>()
  const navigate = useNavigate()
  const client = useApiClient()

  const viewsQ = useQuery<SavedView[]>({
    queryKey: ["sidebar-saved-views", tenantId, routeSiteId ?? null],
    queryFn: () =>
      client.listSavedViews(tenantId, {
        siteId: routeSiteId,
      }),
    enabled: Boolean(tenantId),
    // Best-effort: a 404 from a BE that has not shipped saved-views yet
    // shouldn't blow up the sidebar.
    retry: false,
  })

  const onPick = async (v: SavedView) => {
    let parsed: unknown = null
    try {
      parsed = v.filterJson ? JSON.parse(v.filterJson) : null
    } catch {
      toast.error("Saved view is corrupt; cannot apply")
      return
    }
    let crawlId: string | null = null
    if (v.route.includes(":crawlId") && v.siteId) {
      try {
        const runs = await client.listCrawlsBySite(v.siteId)
        const completed = runs
          .filter((r) => r.status === "completed")
          .sort(
            (a, b) =>
              new Date(b.startedAt).getTime() -
              new Date(a.startedAt).getTime(),
          )
        crawlId = completed[0]?.id ?? runs[0]?.id ?? null
      } catch {
        // fall through
      }
    }
    const path = resolveSavedViewPath(v.route, {
      tenantId,
      siteId: v.siteId ?? routeSiteId ?? null,
      crawlId,
    })
    if (!path) {
      toast.error("This saved view needs a crawl to be available first")
      return
    }
    stashPendingSavedView({ id: v.id, route: v.route, filter: parsed })
    navigate(path)
  }

  const views = viewsQ.data ?? []
  if (viewsQ.isError) return null
  if (!viewsQ.isLoading && views.length === 0) return null

  return (
    <>
      <SidebarSeparator />
      <SidebarGroup data-testid="sidebar-saved-views">
        <SidebarGroupLabel>Saved views</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {viewsQ.isLoading ? (
              <SidebarMenuItem>
                <span className="px-2 py-1 text-xs text-muted-foreground">
                  Loading...
                </span>
              </SidebarMenuItem>
            ) : (
              views.map((v) => (
                <SidebarMenuItem key={v.id}>
                  <SidebarMenuButton
                    onClick={() => {
                      void onPick(v)
                    }}
                    data-testid={`sidebar-saved-view-${v.id}`}
                  >
                    <BookmarkIcon className="size-4" />
                    <span className="truncate">{v.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}

function initialFromEmail(email: string): string {
  return email.length > 0 ? email[0]!.toUpperCase() : "?"
}

function UserMenu() {
  const { user, memberships, logout } = useAuth()
  const navigate = useNavigate()
  const { tenantId = "default" } = useParams()
  const email = user?.email ?? ""
  const initial = initialFromEmail(email)

  const onProfile = () => {
    navigate(`/t/${tenantId}/settings`)
  }
  const onSwitchTenant = (tid: string) => {
    navigate(`/t/${tid}/sites`)
  }
  const onSignOut = () => {
    logout()
    navigate("/login", { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
            {initial}
          </div>
          <span className="hidden text-sm font-medium sm:inline">{email}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{email || "My Account"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onProfile}>
          <User className="mr-2 size-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        {memberships.length > 0 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Building className="mr-2 size-4" />
              <span>Switch tenant</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {memberships.map((m) => (
                <DropdownMenuItem
                  key={m.tenantId}
                  onSelect={() => onSwitchTenant(m.tenantId)}
                >
                  <span className="truncate">{m.tenantName}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut className="mr-2 size-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppShell() {
  const { tenantId } = useParams()
  const { setActiveTenant, branding } = useAuth()

  // The /t/:tenantId URL is the source of truth while inside the shell.
  // Mirror it into AuthProvider state so the user menu / future widgets
  // that read activeTenantId stay in sync with the route.
  useEffect(() => {
    if (tenantId) setActiveTenant(tenantId)
  }, [tenantId, setActiveTenant])

  const safeTenantId = tenantId ?? "default"
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-3 py-3">
          <Link
            to={`/t/${safeTenantId}/sites`}
            className="flex items-center gap-2 px-1"
          >
            {branding?.logoDataUrl ? (
              <img
                src={branding.logoDataUrl}
                alt="Tenant logo"
                className="h-7 w-auto max-w-[10rem] object-contain"
                data-testid="tenant-branded-logo"
              />
            ) : (
              <>
                <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <WrenMark className="size-4" />
                </div>
                <span className="text-base font-semibold tracking-tight">
                  Wrendex
                </span>
              </>
            )}
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarNav />
            </SidebarGroupContent>
          </SidebarGroup>
          <SavedViewsGroup />
        </SidebarContent>
        <SidebarFooter className="px-3 py-2 text-xs text-muted-foreground">
          v0.1.0 - bootstrap
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-muted-foreground hidden md:inline-flex"
            onClick={() => {
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", metaKey: true }),
              )
            }}
          >
            <Search className="size-3.5" />
            <span>Search...</span>
            <kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
              cmd K
            </kbd>
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {/* P5 iter 1 FE-A: every route under AppShell is React.lazy(), so
              wrap the nested <Outlet /> in <Suspense> so navigations show a
              skeleton while the destination chunk loads. The shell + sidebar
              + topbar stay on screen throughout. */}
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </SidebarInset>
      <CommandPalette />
      <Toaster />
    </SidebarProvider>
  )
}
